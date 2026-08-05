'use strict';

const fs = require('fs');
const { parseFen } = require('../core/chess/position.cjs');
const { hash32 } = require('../core/determinism.cjs');
const { createBattleState } = require('../combat/battle.cjs');
const { createScenarioState } = require('../scenario/scenario.cjs');
const { createBossPhaseState } = require('../scenario/boss-phases.cjs');

const INTERACTION_ALIASES = Object.freeze({
  none: 'none',
  preview_only: 'none',
  blocks_declared_cell: 'none',
  hold: 'hold',
  escort_destination: 'hold',
  activate: 'activate',
  destroy: 'destroy',
  capture: 'destroy',
  capture_target: 'destroy',
  capture_targets: 'destroy'
});

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function stableRecordMap(input, prefix, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`${label} must be an object`);
  const entries = Object.entries(input);
  for (const [id] of entries) if (!new RegExp(`^${prefix}\\.[a-z0-9][a-z0-9_-]*$`).test(id)) throw new Error(`${label} contains invalid id: ${id}`);
  return entries;
}

function normalizeReward(input = {}, label) {
  const reward = { gold: input.gold ?? 0, supplies: input.supplies ?? 0, meta: input.meta ?? 0 };
  for (const [key, value] of Object.entries(reward)) if (!Number.isInteger(value) || value < 0) throw new Error(`${label}.reward.${key} must be a non-negative integer`);
  return Object.freeze(reward);
}

function normalizeBattleTemplate(input, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`${label}.battle is required`);
  if (typeof input.fen !== 'string' || !input.fen.trim()) throw new Error(`${label}.battle.fen is required`);
  parseFen(input.fen);
  const identitiesBySquare = Object.freeze({ ...(input.identitiesBySquare || {}) });
  const identityMetadata = Object.freeze({ ...(input.identityMetadata || {}) });
  if (!Object.keys(identitiesBySquare).length) throw new Error(`${label}.battle.identitiesBySquare is required`);
  return Object.freeze({
    fen: input.fen,
    identitiesBySquare,
    identityMetadata,
    orderPoints: input.orderPoints ? Object.freeze(input.orderPoints) : null,
    reserve: freezeArray(input.reserve || []),
    reserveCells: input.reserveCells ? Object.freeze(input.reserveCells) : null
  });
}

function normalizeEnvironmentTemplate(record, label) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`${label} must be an object`);
  const requested = record.interaction || 'none';
  const interaction = INTERACTION_ALIASES[requested];
  if (!interaction) throw new Error(`${label}.interaction alias is unsupported: ${requested}`);
  return Object.freeze({
    ...record,
    cells: freezeArray(record.cells || []),
    interaction,
    metadata: Object.freeze({ ...(record.metadata || {}) })
  });
}

function normalizeScenarioTemplate(input, label, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`${label} must be an object`);
  if (!Array.isArray(input.objectives) || !input.objectives.length) throw new Error(`${label}.objectives is required`);
  return Object.freeze({
    id: options.id || label,
    titleKey: input.titleKey || null,
    battle: normalizeBattleTemplate(input.battle, label),
    board: Object.freeze({ width: input.board?.width ?? 8, height: input.board?.height ?? 8 }),
    completionMode: input.completionMode || 'all',
    objectives: freezeArray(input.objectives.map((objective) => Object.freeze({ ...objective }))),
    failures: freezeArray((input.failures || []).map((failure) => Object.freeze({ ...failure }))),
    environment: freezeArray((input.environment || []).map((record, index) => normalizeEnvironmentTemplate(record, `${label}.environment[${index}]`))),
    reward: options.requireReward === false ? null : normalizeReward(input.reward || {}, label)
  });
}

function validateScenarioTemplateSet(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('scenario template set must be an object');
  if (input.schemaVersion !== 1) throw new Error('unsupported scenario template schemaVersion');
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(String(input.scenarioSetId || ''))) throw new Error('scenario template set requires a stable scenarioSetId');
  const encounters = {};
  for (const [id, template] of stableRecordMap(input.encounters, 'encounter', 'encounters')) {
    encounters[id] = normalizeScenarioTemplate(template, id, { id, requireReward: true });
  }
  const bosses = {};
  for (const [id, record] of stableRecordMap(input.bosses, 'boss', 'bosses')) {
    if (!record || typeof record !== 'object' || !Array.isArray(record.phases) || record.phases.length < 2 || record.phases.length > 3) throw new Error(`${id} requires 2 or 3 phases`);
    const phases = record.phases.map((phase, index) => {
      if (!/^[a-z0-9][a-z0-9_-]*$/.test(String(phase.id || ''))) throw new Error(`${id} phase ${index} requires a stable id`);
      return normalizeScenarioTemplate(phase, `${id}.${phase.id}`, { id: phase.id, requireReward: false });
    });
    if (new Set(phases.map((phase) => phase.id)).size !== phases.length) throw new Error(`${id} phase IDs must be unique`);
    bosses[id] = Object.freeze({ id, reward: normalizeReward(record.reward || {}, id), phases: freezeArray(phases) });
  }
  if (!Object.keys(encounters).length) throw new Error('scenario template set requires encounters');
  if (!Object.keys(bosses).length) throw new Error('scenario template set requires bosses');
  return Object.freeze({
    schemaVersion: 1,
    scenarioSetId: input.scenarioSetId,
    encounters: Object.freeze(encounters),
    bosses: Object.freeze(bosses)
  });
}

function loadScenarioTemplateSet(filePath) {
  return validateScenarioTemplateSet(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function createBattleFromTemplate(template, options = {}) {
  const battleId = String(options.battleId || template.id || 'battle');
  const seed = Number(options.seed ?? hash32(battleId));
  const creationOptions = Object.freeze({
    battleId,
    seed,
    playerSide: options.playerSide || 'w',
    position: parseFen(template.battle.fen),
    identitiesBySquare: template.battle.identitiesBySquare,
    identityMetadata: template.battle.identityMetadata,
    orderPoints: template.battle.orderPoints || undefined,
    reserve: template.battle.reserve,
    reserveCells: template.battle.reserveCells || undefined
  });
  const projected = typeof options.battleProjector === 'function'
    ? options.battleProjector(creationOptions)
    : creationOptions;
  if (!projected || typeof projected !== 'object' || !projected.position) {
    throw new Error(`${battleId} battleProjector must return battle creation options`);
  }
  return createBattleState(projected);
}

function createEncounterScenario(templateSet, encounterId, options = {}) {
  const template = templateSet.encounters[encounterId];
  if (!template) throw new Error(`missing encounter scenario template: ${encounterId}`);
  const seed = Number(options.seed ?? hash32(`${templateSet.scenarioSetId}:${encounterId}`));
  const battle = createBattleFromTemplate(template, {
    battleId: options.battleId || `${encounterId}:${seed}`,
    seed,
    playerSide: options.playerSide || 'w',
    battleProjector: options.battleProjector
  });
  return Object.freeze({
    scenario: createScenarioState({
      scenarioId: options.scenarioId || encounterId.replace(/[^a-z0-9_-]+/g, '_'),
      seed,
      playerSide: options.playerSide || 'w',
      battle,
      board: template.board,
      completionMode: template.completionMode,
      objectives: template.objectives,
      failures: template.failures,
      environment: template.environment
    }),
    reward: template.reward,
    template
  });
}

function createBossFromTemplates(templateSet, bossId, options = {}) {
  const template = templateSet.bosses[bossId];
  if (!template) throw new Error(`missing boss scenario template: ${bossId}`);
  const seed = Number(options.seed ?? hash32(`${templateSet.scenarioSetId}:${bossId}`));
  const playerSide = options.playerSide || 'w';
  const battleForPhase = (phaseIndex) => {
    const phase = template.phases[phaseIndex];
    if (!phase) throw new Error(`${bossId} has no phase ${phaseIndex}`);
    return createBattleFromTemplate(phase, {
      battleId: `${bossId}:phase:${phaseIndex + 1}:${seed}`,
      seed: seed + phaseIndex,
      playerSide,
      battleProjector: options.battleProjector
    });
  };
  const phases = template.phases.map((phase) => Object.freeze({
    id: phase.id,
    titleKey: phase.titleKey,
    board: phase.board,
    completionMode: phase.completionMode,
    objectives: phase.objectives,
    failures: phase.failures,
    environment: phase.environment
  }));
  return Object.freeze({
    state: createBossPhaseState({
      bossId,
      seed,
      playerSide,
      initialBattle: battleForPhase(0),
      phases
    }),
    reward: template.reward,
    template,
    battleForPhase
  });
}

function validateScenarioContentReferences(templateSet, registry) {
  if (!registry || typeof registry.get !== 'function') throw new Error('content registry is required');
  const errors = [];
  for (const encounterId of Object.keys(templateSet.encounters)) if (!registry.get('encounter', encounterId)) errors.push(`scenario template references missing encounter: ${encounterId}`);
  for (const bossId of Object.keys(templateSet.bosses)) {
    const boss = registry.get('boss', bossId);
    if (!boss) errors.push(`scenario template references missing boss: ${bossId}`);
    else {
      const templatePhaseIds = templateSet.bosses[bossId].phases.map((phase) => phase.id);
      const contentPhaseIds = boss.phases.map((phase) => phase.id);
      if (JSON.stringify(templatePhaseIds) !== JSON.stringify(contentPhaseIds)) errors.push(`${bossId} phase IDs do not match compiled boss content`);
    }
  }
  if (errors.length) {
    const error = new Error(`scenario content validation failed with ${errors.length} error(s)`);
    error.details = Object.freeze(errors);
    throw error;
  }
  return true;
}

module.exports = {
  INTERACTION_ALIASES,
  normalizeReward,
  normalizeBattleTemplate,
  normalizeEnvironmentTemplate,
  normalizeScenarioTemplate,
  validateScenarioTemplateSet,
  loadScenarioTemplateSet,
  createBattleFromTemplate,
  createEncounterScenario,
  createBossFromTemplates,
  validateScenarioContentReferences
};
