'use strict';

const path = require('path');
const { hash32 } = require('../core/determinism.cjs');
const { generateActGraph } = require('../campaign/graph.cjs');
const { createCampaignState } = require('../campaign/state.cjs');
const { buildProductionContentBundle } = require('../content/production-bundle.cjs');
const {
  loadScenarioTemplateSet,
  createEncounterScenario,
  createBossFromTemplates,
  validateScenarioContentReferences
} = require('../content/scenario-templates.cjs');
const { createVerticalSliceRuntime } = require('./vertical-slice.cjs');
const { createPresenterSnapshot, dispatchPresenterCommand } = require('./presenter-bridge.cjs');

const DEFAULT_SCENARIO_SET = 'content/scenarios/iron_marches_vertical_slice.json';
const DEFAULT_SELECTION = Object.freeze({
  regionId: 'region.iron_marches',
  kingId: 'king.oathkeeper',
  doctrineId: 'doctrine.fortress',
  heroIds: Object.freeze([
    'hero.aldric_wall',
    'hero.mara_chain',
    'hero.brother_orell',
    'hero.vael_hammer',
    'hero.lady_sorn',
    'hero.tomas_gate'
  ]),
  relicIds: Object.freeze([
    'relic.echo_shield',
    'relic.phantom_spurs',
    'relic.circle_warding',
    'relic.twin_command',
    'relic.royal_decree',
    'relic.oath_fallen'
  ])
});

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function boardThemeMap(manifest) {
  return Object.freeze(Object.fromEntries(manifest.themes.map((theme) => [theme.id, Object.freeze({
    id: theme.id,
    light: theme.light,
    dark: theme.dark,
    fallbackLight: theme.fallbackLight,
    fallbackDark: theme.fallbackDark
  })])));
}

function productionContentPools(bundle) {
  return Object.freeze({
    encounters: freezeArray(bundle.registry.list('encounter').map((record) => record.id)),
    events: freezeArray(bundle.registry.list('event').map((record) => record.id)),
    bosses: freezeArray(bundle.registry.list('boss').map((record) => record.id)),
    shops: freezeArray(['shop.iron_field_quartermaster']),
    services: freezeArray(['service.iron_field_smith']),
    treasures: freezeArray(['treasure.iron_march_cache'])
  });
}

function immediateNodeReward(nodeType) {
  if (nodeType === 'shop') return Object.freeze({ gold: 0, supplies: 1, meta: 0 });
  if (nodeType === 'service') return Object.freeze({ gold: 0, supplies: 1, meta: 0 });
  if (nodeType === 'treasure') return Object.freeze({ gold: 5, supplies: 1, meta: 0 });
  return Object.freeze({ gold: 0, supplies: 0, meta: 0 });
}

function assertVerticalSliceSelection(bundle, selection = DEFAULT_SELECTION) {
  const errors = [];
  if (!bundle.registry.get('region', selection.regionId)) errors.push(`missing selected region: ${selection.regionId}`);
  const king = bundle.registry.get('king', selection.kingId);
  if (!king) errors.push(`missing selected king: ${selection.kingId}`);
  if (!bundle.registry.get('doctrine', selection.doctrineId)) errors.push(`missing selected doctrine: ${selection.doctrineId}`);
  if (king && !king.doctrineIds.includes(selection.doctrineId)) errors.push(`${selection.kingId} does not permit ${selection.doctrineId}`);
  for (const heroId of selection.heroIds) if (!bundle.registry.get('hero', heroId)) errors.push(`missing selected hero: ${heroId}`);
  for (const relicId of selection.relicIds) if (!bundle.registry.get('relic', relicId)) errors.push(`missing selected relic: ${relicId}`);
  if (errors.length) {
    const error = new Error(`Iron Marches selection validation failed with ${errors.length} error(s)`);
    error.details = Object.freeze(errors);
    throw error;
  }
  return true;
}

function createIronMarchesDependencies(options) {
  const {
    bundle,
    scenarioTemplates,
    language,
    aiProfile,
    aiMaxNodes,
    aiTimeBudgetMs
  } = options;
  const localization = bundle.localization[language];
  if (!localization) throw new Error(`unsupported Iron Marches language: ${language}`);

  const nodeResolver = ({ runtime, node, content }) => {
    if (node.type === 'event') {
      return Object.freeze({ mode: 'event', reward: Object.freeze({ gold: 1, supplies: 1, meta: 0 }) });
    }
    if (node.type === 'battle' || node.type === 'elite') {
      const created = createEncounterScenario(scenarioTemplates, content.id, {
        seed: hash32(`${runtime.seed}:${node.id}:${content.id}`),
        playerSide: runtime.playerSide,
        scenarioId: `${content.id.replace(/[^a-z0-9_-]+/g, '_')}_${node.id}`
      });
      return Object.freeze({ mode: 'scenario', scenario: created.scenario, reward: created.reward });
    }
    if (node.type === 'boss') {
      const created = createBossFromTemplates(scenarioTemplates, content.id, {
        seed: hash32(`${runtime.seed}:${node.id}:${content.id}`),
        playerSide: runtime.playerSide
      });
      return Object.freeze({ mode: 'boss', boss: created.state, reward: created.reward });
    }
    return Object.freeze({ mode: 'immediate', reward: immediateNodeReward(node.type) });
  };

  const bossPhaseBattleResolver = ({ runtime, bossId, phaseIndex, contentId }) => {
    const created = createBossFromTemplates(scenarioTemplates, contentId || bossId, {
      seed: bossId === runtime.boss?.bossId ? runtime.boss.seed : hash32(`${runtime.seed}:${bossId}`),
      playerSide: runtime.playerSide
    });
    return created.battleForPhase(phaseIndex);
  };

  return Object.freeze({
    contentRegistry: bundle.registry,
    localization,
    boardThemes: boardThemeMap(bundle.boardThemeManifest),
    eventChoiceResolver: bundle.eventChoiceResolver,
    nodeResolver,
    bossPhaseBattleResolver,
    aiProfile,
    aiMaxNodes,
    aiTimeBudgetMs
  });
}

function createIronMarchesVerticalSlice(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.resolve(__dirname, '../..'));
  const language = options.language || 'ru';
  const seed = Number(options.seed ?? 9042);
  const act = options.act ?? 1;
  const nodeCount = options.nodeCount ?? 9;
  const bundle = buildProductionContentBundle({ projectRoot });
  const scenarioTemplates = loadScenarioTemplateSet(path.resolve(projectRoot, options.scenarioSetPath || DEFAULT_SCENARIO_SET));
  validateScenarioContentReferences(scenarioTemplates, bundle.registry);
  assertVerticalSliceSelection(bundle, options.selection || DEFAULT_SELECTION);
  const graph = generateActGraph({
    seed,
    act,
    nodeCount,
    regionId: DEFAULT_SELECTION.regionId,
    contentPools: productionContentPools(bundle)
  });
  const campaign = createCampaignState(graph, {
    supplies: options.supplies ?? 18,
    scouting: options.scouting ?? 1
  });
  const state = createVerticalSliceRuntime({
    runtimeId: options.runtimeId || `iron_marches_${seed}_${act}`,
    seed,
    profileId: options.profileId || 'profile-1',
    playerSide: options.playerSide || 'w',
    aiProfile: options.aiProfile || 'apprentice',
    campaign,
    contentRegistry: bundle.registry
  });
  const dependencies = createIronMarchesDependencies({
    bundle,
    scenarioTemplates,
    language,
    aiProfile: options.aiProfile || 'apprentice',
    aiMaxNodes: options.aiMaxNodes ?? 8000,
    aiTimeBudgetMs: options.aiTimeBudgetMs ?? 0
  });
  return Object.freeze({
    format: 'rpchess-iron-marches-vertical-slice',
    schemaVersion: 1,
    projectRoot,
    language,
    selection: options.selection || DEFAULT_SELECTION,
    bundle,
    scenarioTemplates,
    dependencies,
    state,
    snapshot: createPresenterSnapshot(state, dependencies)
  });
}

function createIronMarchesRuntimeHost(options = {}) {
  const boot = createIronMarchesVerticalSlice(options);
  let state = boot.state;
  const dependencies = options.saveStore
    ? Object.freeze({ ...boot.dependencies, saveStore: options.saveStore })
    : boot.dependencies;
  return Object.freeze({
    format: 'rpchess-local-runtime-host',
    getState: () => state,
    getSnapshot: () => createPresenterSnapshot(state, dependencies),
    dispatch: async (command) => {
      const result = dispatchPresenterCommand(state, command, dependencies);
      state = result.state;
      return Object.freeze({ snapshot: result.snapshot, saveEnvelope: result.saveEnvelope || null });
    },
    dependencies,
    selection: boot.selection
  });
}

module.exports = {
  DEFAULT_SCENARIO_SET,
  DEFAULT_SELECTION,
  boardThemeMap,
  productionContentPools,
  immediateNodeReward,
  assertVerticalSliceSelection,
  createIronMarchesDependencies,
  createIronMarchesVerticalSlice,
  createIronMarchesRuntimeHost
};
