'use strict';

const { DeterministicIdFactory } = require('../core/determinism.cjs');
const { DomainEnvelopeFactory } = require('../core/domain.cjs');
const { createScenarioState, executeScenarioCommand } = require('./scenario.cjs');

function freezeArray(items) {
  return Object.freeze(items.slice());
}

function cleanId(value) {
  return String(value || 'boss').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'boss';
}

function initialEnvelope(bossId, seed) {
  return new DomainEnvelopeFactory({ idFactory: new DeterministicIdFactory(cleanId(bossId), seed) }).snapshot();
}

function envelopeFactory(snapshot) {
  return new DomainEnvelopeFactory({
    idFactory: DeterministicIdFactory.fromSnapshot(snapshot.idFactory),
    sequence: snapshot.sequence
  });
}

function normalizePhase(record, index) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`boss phase ${index} must be an object`);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(String(record.id || ''))) throw new Error(`boss phase ${index} requires a stable id`);
  if (!Array.isArray(record.objectives) || record.objectives.length === 0) throw new Error(`boss phase ${record.id} requires objectives`);
  return Object.freeze({
    id: record.id,
    titleKey: record.titleKey || null,
    board: Object.freeze({ width: record.board?.width ?? 8, height: record.board?.height ?? 8 }),
    completionMode: record.completionMode || 'all',
    objectives: freezeArray(record.objectives),
    failures: freezeArray(record.failures || []),
    environment: freezeArray(record.environment || [])
  });
}

function phaseScenarioId(bossId, phaseId, phaseIndex) {
  return `${cleanId(bossId)}_${String(phaseIndex + 1).padStart(2, '0')}_${cleanId(phaseId)}`;
}

function createPhaseScenario(options, phaseIndex, battle) {
  const phase = options.phases[phaseIndex];
  return createScenarioState({
    scenarioId: phaseScenarioId(options.bossId, phase.id, phaseIndex),
    seed: options.seed + phaseIndex,
    battle,
    playerSide: options.playerSide,
    board: phase.board,
    completionMode: phase.completionMode,
    objectives: phase.objectives,
    failures: phase.failures,
    environment: phase.environment
  });
}

function createBossPhaseState(options = {}) {
  const bossId = String(options.bossId || '');
  if (!/^boss\.[a-z0-9][a-z0-9_-]*$/.test(bossId)) throw new Error('bossId must use boss.* format');
  if (!Array.isArray(options.phases) || options.phases.length < 2 || options.phases.length > 3) throw new Error('boss requires 2 or 3 phases');
  if (!options.initialBattle || options.initialBattle.format !== 'rpchess-battle-state') throw new Error('boss requires an initial battle state');
  const phases = options.phases.map(normalizePhase);
  if (new Set(phases.map((phase) => phase.id)).size !== phases.length) throw new Error('boss phase IDs must be unique');
  const playerSide = options.playerSide || options.initialBattle.playerSide;
  const seed = options.seed || 1;
  const normalized = { bossId, phases, playerSide, seed };
  const scenario = createPhaseScenario(normalized, 0, options.initialBattle);
  return Object.freeze({
    format: 'rpchess-boss-phase-state',
    schemaVersion: 1,
    bossId,
    playerSide,
    seed,
    phases: freezeArray(phases),
    phaseIndex: 0,
    currentPhaseId: phases[0].id,
    scenario,
    status: 'active',
    result: null,
    envelope: initialEnvelope(bossId, seed),
    phaseHistory: freezeArray([]),
    eventLog: freezeArray([])
  });
}

function executeBossCommand(state, request) {
  if (!state || state.format !== 'rpchess-boss-phase-state') throw new Error('invalid boss phase state');
  if (state.status !== 'active') throw new Error(`boss state does not accept battle commands while ${state.status}`);
  const scenarioResult = executeScenarioCommand(state.scenario, request);
  const factory = envelopeFactory(state.envelope);
  const events = [];
  let status = 'active';
  let result = null;
  let phaseHistory = state.phaseHistory;

  if (scenarioResult.state.status === 'completed') {
    const phaseRecord = Object.freeze({
      phaseIndex: state.phaseIndex,
      phaseId: state.currentPhaseId,
      outcome: scenarioResult.state.result.outcome,
      reason: scenarioResult.state.result.reason,
      actionCount: scenarioResult.state.actionIndex,
      finalBattleActionIndex: scenarioResult.state.battle.actionIndex
    });
    phaseHistory = freezeArray([...state.phaseHistory, phaseRecord]);
    events.push(factory.event('BossPhaseCompleted', {
      bossId: state.bossId,
      phaseIndex: state.phaseIndex,
      phaseId: state.currentPhaseId,
      outcome: phaseRecord.outcome,
      reason: phaseRecord.reason
    }));

    if (phaseRecord.outcome !== 'victory') {
      status = 'completed';
      result = Object.freeze({ outcome: phaseRecord.outcome, reason: 'boss_phase_failed', phaseId: state.currentPhaseId });
      events.push(factory.event('BossBattleCompleted', { bossId: state.bossId, ...result }));
    } else if (state.phaseIndex === state.phases.length - 1) {
      status = 'completed';
      result = Object.freeze({ outcome: 'victory', reason: 'all_boss_phases_completed' });
      events.push(factory.event('BossBattleCompleted', { bossId: state.bossId, ...result }));
    } else {
      status = 'awaiting_phase_transition';
      events.push(factory.event('BossPhaseTransitionRequested', {
        bossId: state.bossId,
        completedPhaseId: state.currentPhaseId,
        nextPhaseId: state.phases[state.phaseIndex + 1].id
      }));
    }
  }

  const next = Object.freeze({
    ...state,
    scenario: scenarioResult.state,
    status,
    result,
    envelope: factory.snapshot(),
    phaseHistory,
    eventLog: freezeArray([...state.eventLog, ...events])
  });
  return Object.freeze({
    state: next,
    battleEvents: scenarioResult.battleEvents,
    scenarioEvents: scenarioResult.scenarioEvents,
    bossEvents: freezeArray(events)
  });
}

function beginNextBossPhase(state, nextBattle) {
  if (!state || state.format !== 'rpchess-boss-phase-state') throw new Error('invalid boss phase state');
  if (state.status !== 'awaiting_phase_transition') throw new Error('boss is not awaiting a phase transition');
  if (!nextBattle || nextBattle.format !== 'rpchess-battle-state' || nextBattle.status !== 'active') throw new Error('next boss phase requires an active battle state');
  const phaseIndex = state.phaseIndex + 1;
  const scenario = createPhaseScenario(state, phaseIndex, nextBattle);
  const factory = envelopeFactory(state.envelope);
  const event = factory.event('BossPhaseStarted', {
    bossId: state.bossId,
    phaseIndex,
    phaseId: state.phases[phaseIndex].id
  });
  const next = Object.freeze({
    ...state,
    phaseIndex,
    currentPhaseId: state.phases[phaseIndex].id,
    scenario,
    status: 'active',
    envelope: factory.snapshot(),
    eventLog: freezeArray([...state.eventLog, event])
  });
  return Object.freeze({ state: next, events: freezeArray([event]) });
}

module.exports = {
  cleanId,
  normalizePhase,
  phaseScenarioId,
  createBossPhaseState,
  executeBossCommand,
  beginNextBossPhase
};
