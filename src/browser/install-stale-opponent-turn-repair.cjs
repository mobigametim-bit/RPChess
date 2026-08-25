'use strict';

const verticalSlice = require('../runtime/vertical-slice.cjs');

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

if (!verticalSlice[PATCH]) {
  const originalValidate = verticalSlice.validateVerticalSliceSnapshot;
  verticalSlice.validateVerticalSliceSnapshot = function validateVerticalSliceSnapshotWithTurnRepair(snapshot, options = {}) {
    const validated = originalValidate(snapshot, options);
    const repaired = repairStaleOpponentTurn(validated);
    return repaired === validated ? validated : originalValidate(repaired, options);
  };
  Object.defineProperty(verticalSlice, PATCH, { value: true, enumerable: false });
}

module.exports = { repairStaleOpponentTurn };
