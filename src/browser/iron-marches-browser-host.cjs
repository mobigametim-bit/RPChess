'use strict';

const { hash32 } = require('../core/determinism.cjs');
const { generateActGraph } = require('../campaign/graph.cjs');
const { createCampaignState } = require('../campaign/state.cjs');
const { createVerticalSliceRuntime, validateVerticalSliceSnapshot } = require('../runtime/vertical-slice.cjs');
const { createPresenterSnapshot, dispatchPresenterCommand } = require('../runtime/presenter-bridge.cjs');
const {
  createEncounterScenario,
  createBossFromTemplates
} = require('../content/scenario-templates.cjs');
const {
  createRunSelection,
  selectRunKing,
  selectRunDoctrine,
  toggleRunHero,
  lockRunSelection,
  runSelectionPresenter,
  runSelectionSnapshot
} = require('../runtime/run-selection.cjs');
const {
  createRuntimeArmy,
  validateRuntimeArmy,
  runtimeSelectionFromArmy
} = require('../runtime/army-roster.cjs');
const { projectIronMarchesBattleOptions } = require('../runtime/iron-marches-mechanics.cjs');
const { buildBrowserProductionBundle } = require('./production-content-browser.cjs');
const { createScenarioDeploymentGate } = require('../runtime/deployment-gate.cjs');
const {
  createBrowserProfileStore,
  inspectBrowserProfile,
  saveBrowserProfile,
  deleteBrowserProfile
} = require('./profile-persistence.cjs');

const DEFAULT_BROWSER_SELECTION = Object.freeze({
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

const SELECTION_COMMANDS = Object.freeze(['SelectKing', 'SelectDoctrine', 'ToggleHero', 'LockSelection']);

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function localizationValueSafe(localization, key, fallback) {
  if (!key) return fallback;
  return localization?.[key] ?? fallback;
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
  if (nodeType === 'shop' || nodeType === 'service') return Object.freeze({ gold: 0, supplies: 1, meta: 0 });
  if (nodeType === 'treasure') return Object.freeze({ gold: 5, supplies: 1, meta: 0 });
  return Object.freeze({ gold: 0, supplies: 0, meta: 0 });
}

function assertBrowserSelection(bundle, selection) {
  const errors = [];
  const region = bundle.registry.get('region', selection.regionId);
  const king = bundle.registry.get('king', selection.kingId);
  const doctrine = bundle.registry.get('doctrine', selection.doctrineId);
  if (!region) errors.push(`missing selected region: ${selection.regionId}`);
  if (!king) errors.push(`missing selected king: ${selection.kingId}`);
  if (!doctrine) errors.push(`missing selected doctrine: ${selection.doctrineId}`);
  if (king && doctrine && !king.doctrineIds.includes(doctrine.id)) errors.push(`${king.id} does not permit ${doctrine.id}`);
  for (const heroId of selection.heroIds || []) if (!bundle.registry.get('hero', heroId)) errors.push(`missing selected hero: ${heroId}`);
  for (const relicId of selection.relicIds || []) if (!bundle.registry.get('relic', relicId)) errors.push(`missing selected relic: ${relicId}`);
  if (errors.length) {
    const error = new Error(`browser run selection validation failed with ${errors.length} error(s)`);
    error.details = Object.freeze(errors);
    throw error;
  }
  return true;
}

function createBrowserDependencies(options) {
  const { bundle, language, aiProfile, aiMaxNodes, aiTimeBudgetMs, saveStore } = options;
  const localization = bundle.localization[language];
  if (!localization) throw new Error(`unsupported Iron Marches language: ${language}`);
  const scenarioTemplates = bundle.scenarioTemplates;

  const nodeResolver = ({ runtime, node, content }) => {
    const battleProjector = (battleOptions) => projectIronMarchesBattleOptions(battleOptions, runtime.army, runtime.stageB);
    if (node.type === 'event') return Object.freeze({ mode: 'event', reward: Object.freeze({ gold: 1, supplies: 1, meta: 0 }) });
    if (node.type === 'battle' || node.type === 'elite') {
      const created = createEncounterScenario(scenarioTemplates, content.id, {
        seed: hash32(`${runtime.seed}:${node.id}:${content.id}`),
        playerSide: runtime.playerSide,
        scenarioId: `${content.id.replace(/[^a-z0-9_-]+/g, '_')}_${node.id}`,
        battleProjector
      });
      return Object.freeze({ mode: 'scenario', scenario: created.scenario, reward: created.reward });
    }
    if (node.type === 'boss') {
      const created = createBossFromTemplates(scenarioTemplates, content.id, {
        seed: hash32(`${runtime.seed}:${node.id}:${content.id}`),
        playerSide: runtime.playerSide,
        battleProjector
      });
      return Object.freeze({ mode: 'boss', boss: created.state, reward: created.reward });
    }
    return Object.freeze({ mode: 'immediate', reward: immediateNodeReward(node.type) });
  };

  const bossPhaseBattleResolver = ({ runtime, bossId, phaseIndex, contentId }) => {
    const battleProjector = (battleOptions) => projectIronMarchesBattleOptions(battleOptions, runtime.army, runtime.stageB);
    const created = createBossFromTemplates(scenarioTemplates, contentId || bossId, {
      seed: bossId === runtime.boss?.bossId ? runtime.boss.seed : hash32(`${runtime.seed}:${bossId}`),
      playerSide: runtime.playerSide,
      battleProjector
    });
    return created.battleForPhase(phaseIndex);
  };

  const deploymentFactory = ({ runtime, node, scenario }) => createScenarioDeploymentGate(scenario, {
    gateId: `${node.id}_deployment`,
    seed: hash32(`${runtime.seed}:${node.id}:deployment`),
    playerSide: runtime.playerSide,
    localization
  });

  return Object.freeze({
    contentRegistry: bundle.registry,
    combatProfiles: bundle.combatProfiles,
    localization,
    boardThemes: boardThemeMap(bundle.boardThemeManifest),
    eventChoiceResolver: bundle.eventChoiceResolver,
    nodeResolver,
    deploymentFactory,
    bossPhaseBattleResolver,
    aiProfile,
    aiMaxNodes,
    aiTimeBudgetMs,
    saveStore
  });
}

function createBrowserIronMarchesRuntimeHost(options = {}) {
  const bundle = options.bundle || buildBrowserProductionBundle();
  const language = options.language || 'ru';
  const requestedSeed = Number(options.seed ?? 9042);
  const act = options.act ?? 1;
  const stageBEnabled = options.stageB === true;
  const nodeCount = options.nodeCount ?? (stageBEnabled ? null : 9);
  const profileId = options.profileId || 'profile-1';
  const saveStore = options.saveStore || createBrowserProfileStore(options);
  const requestedSelection = Object.freeze({
    regionId: options.selection?.regionId || DEFAULT_BROWSER_SELECTION.regionId,
    kingId: options.selection?.kingId || DEFAULT_BROWSER_SELECTION.kingId,
    doctrineId: options.selection?.doctrineId || DEFAULT_BROWSER_SELECTION.doctrineId,
    heroIds: freezeArray(options.selection?.heroIds || DEFAULT_BROWSER_SELECTION.heroIds),
    relicIds: freezeArray(options.selection?.relicIds || DEFAULT_BROWSER_SELECTION.relicIds)
  });
  assertBrowserSelection(bundle, requestedSelection);
  const requestedArmy = createRuntimeArmy(requestedSelection, bundle.registry, bundle.combatProfiles);
  const runtimeValidation = Object.freeze({
    contentRegistry: bundle.registry,
    combatProfiles: bundle.combatProfiles,
    defaultArmy: requestedArmy,
    heroCatalog: (options.availableHeroIds || requestedSelection.heroIds).map((heroId) => { const hero = bundle.registry.get('hero', heroId); const profile = bundle.combatProfiles.heroes[heroId]; return { id: heroId, name: localizationValueSafe(bundle.localization[language], hero?.nameKey, heroId), pieceType: profile?.battlePieceType || hero?.pieceType || 'pawn', relicIds: profile?.relicIds || [] }; }),
    requireArmy: true
  });

  let resumeInfo = options.resumeInfo || null;
  let state = options.initialState
    ? validateVerticalSliceSnapshot(options.initialState, runtimeValidation)
    : null;
  if (!state && saveStore && options.resume !== false) {
    resumeInfo = inspectBrowserProfile(saveStore, profileId, runtimeValidation);
    state = resumeInfo.state;
  }
  const resumed = Boolean(state);
  const army = state?.army || requestedArmy;
  const selection = runtimeSelectionFromArmy(army);
  assertBrowserSelection(bundle, selection);

  if (!state) {
    const graph = generateActGraph({
      seed: requestedSeed,
      act,
      ...(nodeCount ? { nodeCount } : {}),
      stageB: stageBEnabled,
      regionId: selection.regionId,
      contentPools: productionContentPools(bundle)
    });
    const campaign = createCampaignState(graph, {
      supplies: options.supplies ?? 18,
      scouting: options.scouting ?? 1
    });
    state = createVerticalSliceRuntime({
      runtimeId: options.runtimeId || `iron_marches_browser_${requestedSeed}_${act}`,
      seed: requestedSeed,
      profileId,
      playerSide: options.playerSide || 'w',
      aiProfile: options.aiProfile || 'apprentice',
      campaign,
      army,
      contentRegistry: bundle.registry,
      combatProfiles: bundle.combatProfiles,
      heroCatalog: (options.availableHeroIds || requestedSelection.heroIds).map((heroId) => { const hero = bundle.registry.get('hero', heroId); const profile = bundle.combatProfiles.heroes[heroId]; return { id: heroId, name: localizationValueSafe(bundle.localization[language], hero?.nameKey, heroId), pieceType: profile?.battlePieceType || hero?.pieceType || 'pawn', relicIds: profile?.relicIds || [] }; }),
      preferredHeroId: requestedSelection.heroIds[0],
      preselectPreferredHero: true,
      requireArmy: true
    });
  }
  const dependencies = createBrowserDependencies({
    bundle,
    language,
    aiProfile: state.aiProfile,
    aiMaxNodes: options.aiMaxNodes ?? 8000,
    aiTimeBudgetMs: options.aiTimeBudgetMs ?? 0,
    saveStore
  });
  let lastSaveEnvelope = null;
  if (resumed && resumeInfo?.migratedFrom && saveStore) lastSaveEnvelope = saveBrowserProfile(saveStore, state);
  else if (!resumed && saveStore && options.saveOnStart === true) lastSaveEnvelope = saveBrowserProfile(saveStore, state);

  return Object.freeze({
    format: 'rpchess-browser-runtime-host',
    selection,
    army,
    bundle,
    dependencies,
    saveStore,
    resumed,
    resumeInfo,
    getState: () => state,
    getSnapshot: () => createPresenterSnapshot(state, dependencies),
    getLastSaveEnvelope: () => lastSaveEnvelope,
    dispatch: async (command) => {
      const result = dispatchPresenterCommand(state, command, dependencies);
      state = result.state;
      let saveEnvelope = result.saveEnvelope || null;
      if (saveStore && options.autoSave !== false && command.type !== 'SaveCheckpoint') {
        saveEnvelope = saveBrowserProfile(saveStore, state);
      }
      if (saveEnvelope) lastSaveEnvelope = saveEnvelope;
      return Object.freeze({ snapshot: createPresenterSnapshot(state, dependencies), saveEnvelope });
    }
  });
}

function normalizeSelectionCommand(command) {
  if (!command || typeof command !== 'object') throw new Error('selection command is required');
  const type = String(command.type || '');
  if (!SELECTION_COMMANDS.includes(type)) throw new Error(`unsupported selection command: ${type}`);
  if (type === 'SelectKing') {
    const kingId = String(command.kingId || command.payload?.kingId || '');
    if (!kingId) throw new Error('SelectKing requires kingId');
    return Object.freeze({ type, kingId });
  }
  if (type === 'SelectDoctrine') {
    const doctrineId = String(command.doctrineId || command.payload?.doctrineId || '');
    if (!doctrineId) throw new Error('SelectDoctrine requires doctrineId');
    return Object.freeze({ type, doctrineId });
  }
  if (type === 'ToggleHero') {
    const heroId = String(command.heroId || command.payload?.heroId || '');
    if (!heroId) throw new Error('ToggleHero requires heroId');
    return Object.freeze({ type, heroId });
  }
  return Object.freeze({ type });
}

function createBrowserRunSelectionHost(options = {}) {
  const bundle = options.bundle || buildBrowserProductionBundle();
  const language = options.language || 'ru';
  const localization = bundle.localization[language];
  if (!localization) throw new Error(`unsupported run-selection language: ${language}`);
  const profileId = options.profileId || 'profile-1';
  const saveStore = options.saveStore || createBrowserProfileStore(options);
  if (options.forceNew && saveStore) deleteBrowserProfile(saveStore, profileId);
  let resumeInfo = saveStore && !options.forceNew
    ? inspectBrowserProfile(saveStore, profileId, {
      contentRegistry: bundle.registry,
      combatProfiles: bundle.combatProfiles,
      defaultArmy: createRuntimeArmy(DEFAULT_BROWSER_SELECTION, bundle.registry, bundle.combatProfiles),
      requireArmy: true
    })
    : Object.freeze({ profileId, status: saveStore ? 'empty' : 'unavailable', revision: 0, savedAt: null, recoveredFrom: null, migratedFrom: null, state: null });
  let selection = createRunSelection({
    contentRegistry: bundle.registry,
    selectionId: options.selectionId || `selection:${options.seed || 1}`,
    regionId: options.regionId || DEFAULT_BROWSER_SELECTION.regionId,
    heroLimit: options.heroLimit ?? 6,
    minimumHeroes: options.minimumHeroes ?? 1
  });
  let runtimeHost = resumeInfo.state ? createBrowserIronMarchesRuntimeHost({
    ...options,
    bundle,
    language,
    profileId,
    saveStore,
    initialState: resumeInfo.state,
    resume: false,
    resumeInfo
  }) : null;

  function profileSnapshot() {
    return Object.freeze({
      profileId,
      storageAvailable: Boolean(saveStore),
      status: runtimeHost?.resumed ? 'resumed' : resumeInfo.status,
      revision: runtimeHost?.getLastSaveEnvelope()?.revision || resumeInfo.revision || 0,
      savedAt: runtimeHost?.getLastSaveEnvelope()?.savedAt || resumeInfo.savedAt || null,
      recoveredFrom: resumeInfo.recoveredFrom || null
    });
  }

  function snapshot() {
    return Object.freeze({
      format: 'rpchess-run-selection-host-snapshot',
      schemaVersion: 1,
      status: runtimeHost ? 'ready' : selection.status,
      selection: runSelectionPresenter(selection, bundle.registry, localization),
      profile: profileSnapshot(),
      runtime: runtimeHost?.getSnapshot() || null
    });
  }

  function execute(commandInput) {
    const command = normalizeSelectionCommand(commandInput);
    if (runtimeHost) throw new Error('run selection has already launched');
    if (command.type === 'SelectKing') selection = selectRunKing(selection, command.kingId, bundle.registry);
    else if (command.type === 'SelectDoctrine') selection = selectRunDoctrine(selection, command.doctrineId, bundle.registry);
    else if (command.type === 'ToggleHero') selection = toggleRunHero(selection, command.heroId, bundle.registry);
    else if (command.type === 'LockSelection') {
      selection = lockRunSelection(selection, bundle.registry);
      runtimeHost = createBrowserIronMarchesRuntimeHost({
        ...options,
        bundle,
        language,
        profileId,
        saveStore,
        resume: false,
        saveOnStart: true,
        selection: Object.freeze({
          regionId: selection.regionId,
          kingId: selection.kingId,
          doctrineId: selection.doctrineId,
          heroIds: selection.heroIds,
          relicIds: freezeArray([])
        })
      });
      resumeInfo = Object.freeze({ profileId, status: 'saved', revision: runtimeHost.getLastSaveEnvelope()?.revision || 0, savedAt: runtimeHost.getLastSaveEnvelope()?.savedAt || null, recoveredFrom: null, state: runtimeHost.getState() });
    }
    return Object.freeze({ command, snapshot: snapshot() });
  }

  return Object.freeze({
    format: 'rpchess-browser-run-selection-host',
    getSelection: () => runSelectionSnapshot(selection),
    getRuntimeHost: () => runtimeHost,
    getProfile: profileSnapshot,
    getSnapshot: snapshot,
    dispatch: async (command) => execute(command),
    bundle,
    localization,
    saveStore
  });
}

module.exports = {
  DEFAULT_BROWSER_SELECTION,
  SELECTION_COMMANDS,
  boardThemeMap,
  productionContentPools,
  immediateNodeReward,
  assertBrowserSelection,
  createBrowserDependencies,
  createBrowserIronMarchesRuntimeHost,
  normalizeSelectionCommand,
  createBrowserRunSelectionHost
};
