'use strict';

const profilePersistence = require('./profile-persistence.cjs');

const PATCH = Symbol.for('rpchess.browser.staleOpponentTurnRepair');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function activeScenarioRef(state) {
  if (state?.status === 'scenario') return state.scenario || null;
  if (state?.status === 'boss') return state.boss?.scenario || null;
  return null;
}

function repairStaleOpponentTurn(state) {
  const scenario = activeScenarioRef(state);
  if (!scenario || scenario.status !== 'active') return state;
  if (!scenario.battle?.position || scenario.battle.position.sideToMove === state.playerSide) return state;

  const repaired = clone(state);
  const target = repaired.status === 'boss' ? repaired.boss.scenario : repaired.scenario;
  const previousSide = target.battle.position.sideToMove;
  target.battle.position.sideToMove = repaired.playerSide;
  repaired.history = [
    ...(repaired.history || []),
    {
      index: (repaired.history || []).length,
      type: 'stale_opponent_turn_repaired',
      previousSide,
      restoredSide: repaired.playerSide,
      scenarioId: target.scenarioId || null
    }
  ];
  return repaired;
}

if (!profilePersistence[PATCH]) {
  const originalInspect = profilePersistence.inspectBrowserProfile;
  profilePersistence.inspectBrowserProfile = function inspectBrowserProfileWithTurnRepair(store, profileId, validationInput = null) {
    const inspected = originalInspect(store, profileId, validationInput);
    if (!inspected?.state) return inspected;
    const repaired = repairStaleOpponentTurn(inspected.state);
    if (repaired === inspected.state) return inspected;
    return Object.freeze({
      ...inspected,
      state: repaired,
      migratedFrom: inspected.migratedFrom || 'stale_opponent_turn'
    });
  };
  Object.defineProperty(profilePersistence, PATCH, { value: true, enumerable: false });
}

module.exports = { repairStaleOpponentTurn };
