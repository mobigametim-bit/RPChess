'use strict';

const { DeterministicIdFactory } = require('../core/determinism.cjs');
const { DomainEnvelopeFactory } = require('../core/domain.cjs');
const { executeWardAwareCommand } = require('../combat/ward-protection.cjs');
const { createEnvironmentRegistry } = require('./environment.cjs');
const {
  normalizeObjective,
  normalizeFailure,
  activePieceIds,
  initialObjectiveState,
  updateObjective,
  initialFailureState,
  updateFailure,
  objectiveHeuristic
} = require('./objectives.cjs');

function freezeArray(items) {
  return Object.freeze(items.slice());
}

function initialEnvelope(scenarioId, seed) {
  return new DomainEnvelopeFactory({ idFactory: new DeterministicIdFactory(scenarioId, seed) }).snapshot();
}

function envelopeFactory(snapshot) {
  return new DomainEnvelopeFactory({
    idFactory: DeterministicIdFactory.fromSnapshot(snapshot.idFactory),
    sequence: snapshot.sequence
  });
}

function validateInitialPieceReferences(objectives, failures, battle) {
  const active = activePieceIds(battle);
  const errors = [];
  for (const objective of objectives) {
    if (objective.type === 'escort' && !active.has(objective.pieceId)) errors.push(`${objective.id} escort piece is not active: ${objective.pieceId}`);
    if (objective.type === 'capture_targets') for (const pieceId of objective.targetPieceIds) if (!active.has(pieceId)) errors.push(`${objective.id} target is not active: ${pieceId}`);
    if (objective.type === 'survive_actions') for (const pieceId of objective.protectedPieceIds) if (!active.has(pieceId)) errors.push(`${objective.id} protected piece is not active: ${pieceId}`);
  }
  for (const failure of failures) {
    if (failure.type === 'piece_lost') for (const pieceId of failure.targetPieceIds) if (!active.has(pieceId)) errors.push(`${failure.id} protected piece is not active: ${pieceId}`);
  }
  if (errors.length) {
    const error = new Error(`scenario piece validation failed with ${errors.length} error(s)`);
    error.details = Object.freeze(errors);
    throw error;
  }
}

function createScenarioState(options = {}) {
  const battle = options.battle;
  if (!battle || battle.format !== 'rpchess-battle-state') throw new Error('scenario requires a valid battle state');
  const scenarioId = String(options.scenarioId || 'scenario');
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(scenarioId)) throw new Error('scenarioId must be a stable identifier');
  const board = Object.freeze({ width: options.board?.width ?? 8, height: options.board?.height ?? 8 });
  const playerSide = options.playerSide || battle.playerSide;
  if (!['w', 'b'].includes(playerSide)) throw new Error('scenario playerSide must be w or b');
  const completionMode = options.completionMode || 'all';
  if (!['all', 'any'].includes(completionMode)) throw new Error('scenario completionMode must be all or any');
  if (!Array.isArray(options.objectives) || options.objectives.length === 0) throw new Error('scenario requires at least one objective');
  const objectives = options.objectives.map((record) => normalizeObjective(record, board, playerSide));
  const failures = (options.failures || []).map((record) => normalizeFailure(record, board, playerSide));
  const ids = [...objectives, ...failures].map((record) => record.id);
  if (new Set(ids).size !== ids.length) throw new Error('scenario objective/failure IDs must be unique');
  validateInitialPieceReferences(objectives, failures, battle);
  const environment = createEnvironmentRegistry({ width: board.width, height: board.height, objects: options.environment || [] });

  return Object.freeze({
    format: 'rpchess-scenario-state',
    schemaVersion: 1,
    scenarioId,
    playerSide,
    board,
    completionMode,
    battle,
    objectives: freezeArray(objectives),
    objectiveStates: freezeArray(objectives.map(initialObjectiveState)),
    failures: freezeArray(failures),
    failureStates: freezeArray(failures.map(initialFailureState)),
    environment,
    status: 'active',
    result: null,
    actionIndex: 0,
    envelope: initialEnvelope(scenarioId, options.seed || 1),
    history: freezeArray([]),
    eventLog: freezeArray([])
  });
}

function completionReached(state, objectiveStates) {
  const required = state.objectives
    .map((definition, index) => ({ definition, state: objectiveStates[index] }))
    .filter((entry) => entry.definition.mandatory);
  if (!required.length) return false;
  return state.completionMode === 'all'
    ? required.every((entry) => entry.state.status === 'completed')
    : required.some((entry) => entry.state.status === 'completed');
}

function progressEvents(state, objectiveStates, failureStates, factory) {
  const events = [];
  objectiveStates.forEach((next, index) => {
    const previous = state.objectiveStates[index];
    if (next.current !== previous.current || JSON.stringify(next.details) !== JSON.stringify(previous.details)) {
      events.push(factory.event('ScenarioObjectiveProgressed', {
        scenarioId: state.scenarioId,
        objectiveId: next.id,
        current: next.current,
        target: next.target,
        details: next.details
      }));
    }
    if (previous.status !== 'completed' && next.status === 'completed') {
      events.push(factory.event('ScenarioObjectiveCompleted', { scenarioId: state.scenarioId, objectiveId: next.id }));
    }
  });
  failureStates.forEach((next, index) => {
    const previous = state.failureStates[index];
    if (!previous.triggered && next.triggered) {
      events.push(factory.event('ScenarioFailureTriggered', {
        scenarioId: state.scenarioId,
        failureId: next.id,
        details: next.details
      }));
    }
  });
  return events;
}

function resolveScenarioResult(state, battle, objectiveStates, failureStates) {
  const triggered = failureStates.find((failure) => failure.triggered);
  if (triggered) return { status: 'completed', result: { outcome: 'defeat', reason: 'failure_condition', failureId: triggered.id } };
  if (completionReached(state, objectiveStates)) return { status: 'completed', result: { outcome: 'victory', reason: 'scenario_objective', objectiveIds: objectiveStates.filter((item) => item.status === 'completed').map((item) => item.id) } };
  if (battle.status === 'completed') {
    if (battle.result?.outcome === 'victory') return { status: 'completed', result: { outcome: 'victory', reason: battle.result.reason || 'battle_victory' } };
    return { status: 'completed', result: { outcome: battle.result?.outcome || 'defeat', reason: battle.result?.reason || 'battle_completed' } };
  }
  return { status: 'active', result: null };
}

function executeScenarioCommand(state, request) {
  if (!state || state.format !== 'rpchess-scenario-state') throw new Error('invalid scenario state');
  if (state.status !== 'active') throw new Error('scenario is already completed');
  const battleResult = executeWardAwareCommand(state.battle, request);
  const objectiveStates = state.objectives.map((definition, index) => updateObjective(definition, state.objectiveStates[index], battleResult.state, battleResult.events));
  const failureStates = state.failures.map((definition, index) => updateFailure(definition, state.failureStates[index], battleResult.state));
  const factory = envelopeFactory(state.envelope);
  const scenarioEvents = progressEvents(state, objectiveStates, failureStates, factory);
  const resolution = resolveScenarioResult(state, battleResult.state, objectiveStates, failureStates);
  if (resolution.status === 'completed') {
    scenarioEvents.push(factory.event('ScenarioCompleted', { scenarioId: state.scenarioId, ...resolution.result }));
  }
  const historyEntry = Object.freeze({
    actionIndex: state.actionIndex,
    battleCommandId: battleResult.command.id,
    request: Object.freeze({ type: request.type, payload: Object.freeze({ ...(request.payload || {}) }) })
  });
  const next = Object.freeze({
    ...state,
    battle: battleResult.state,
    objectiveStates: freezeArray(objectiveStates),
    failureStates: freezeArray(failureStates),
    status: resolution.status,
    result: resolution.result && Object.freeze(resolution.result),
    actionIndex: state.actionIndex + 1,
    envelope: factory.snapshot(),
    history: freezeArray([...state.history, historyEntry]),
    eventLog: freezeArray([...state.eventLog, ...scenarioEvents])
  });
  return Object.freeze({
    state: next,
    battleCommand: battleResult.command,
    battleEvents: battleResult.events,
    scenarioEvents: freezeArray(scenarioEvents)
  });
}

function scenarioObjectiveEvaluator(state) {
  if (!state || state.format !== 'rpchess-scenario-state') throw new Error('invalid scenario state');
  return (candidateBattle, perspective) => {
    let score = 0;
    state.objectives.forEach((definition, index) => {
      const projected = updateObjective(definition, state.objectiveStates[index], candidateBattle, []);
      const value = objectiveHeuristic(definition, candidateBattle, projected, perspective);
      score += definition.mandatory ? value : value * 0.35;
    });
    state.failures.forEach((definition) => {
      const projected = updateFailure(definition, initialFailureState(definition), candidateBattle);
      if (projected.triggered) score += definition.side === perspective ? -15000 : 15000;
    });
    return score;
  };
}

function replayScenario(initialState, requests) {
  let state = initialState;
  const events = [];
  for (const request of requests) {
    const result = executeScenarioCommand(state, request);
    state = result.state;
    events.push(...result.scenarioEvents);
    if (state.status === 'completed') break;
  }
  return Object.freeze({ state, events: freezeArray(events) });
}

module.exports = {
  createScenarioState,
  completionReached,
  executeScenarioCommand,
  scenarioObjectiveEvaluator,
  replayScenario
};
