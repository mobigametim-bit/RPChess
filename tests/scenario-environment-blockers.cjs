'use strict';

const assert = require('assert');
const { parseFen } = require('../src/core/chess/position.cjs');
const { createBattleState, legalBattleCommands } = require('../src/combat/battle.cjs');
const { createEnvironmentRegistry, blockingCells } = require('../src/scenario/environment.cjs');
const { createScenarioState, executeScenarioCommand } = require('../src/scenario/scenario.cjs');

function rookBattle(options = {}) {
  return createBattleState({
    battleId: options.battleId || 'scenario_environment_blockers',
    seed: 2901,
    playerSide: 'w',
    position: parseFen(options.fen || '4k3/8/8/8/8/8/8/R3K3 w - - 0 1'),
    identitiesBySquare: options.identitiesBySquare || { a1: 'rook_w', e1: 'king_w', e8: 'king_b' },
    scenarioRules: options.scenarioRules || {}
  });
}

function escortScenario(battle, environment, target = 'a2') {
  return createScenarioState({
    scenarioId: 'environment_blocker_route',
    seed: 3901,
    battle,
    objectives: [{ id: 'objective.reach_exit', type: 'escort', pieceId: 'rook_w', targetCells: [target] }],
    environment
  });
}

{
  const registry = createEnvironmentRegistry({
    objects: [
      { id: 'environment.active_wall', type: 'blocker', visible: true, active: true, cells: ['d4'] },
      { id: 'environment.inactive_wall', type: 'blocker', visible: true, active: false, cells: ['e4'] },
      { id: 'environment.fire', type: 'hazard', visible: true, cells: ['f4'] }
    ]
  });
  assert.deepStrictEqual(blockingCells(registry), ['d4']);
}

{
  const battle = rookBattle({
    scenarioRules: {
      baseBlockedSquares: ['h3'],
      blockers: [{ square: 'g3', sourceId: 'ability.forge_line', ownerId: 'orell', kind: 'temporary', expiresAfterAction: 2 }],
      gateSquares: ['f3']
    }
  });
  const scenario = escortScenario(battle, [
    { id: 'environment.visible_wall', type: 'blocker', visible: true, cells: ['a4'] }
  ]);
  assert.deepStrictEqual(scenario.battle.scenarioRules.baseBlockedSquares, ['h3', 'a4']);
  assert(scenario.battle.scenarioRules.blockedSquares.includes('g3'));
  assert(scenario.battle.scenarioRules.blockedSquares.includes('a4'));
  assert.deepStrictEqual(scenario.battle.scenarioRules.gateSquares, ['f3']);

  const rookMoves = legalBattleCommands(scenario.battle)
    .filter((command) => command.type === 'MovePiece' && command.payload.from === 'a1')
    .map((command) => command.payload.to);
  assert(rookMoves.includes('a2'));
  assert(rookMoves.includes('a3'));
  assert(!rookMoves.includes('a4'));
  assert(!rookMoves.includes('a5'));
  assert.throws(
    () => executeScenarioCommand(scenario, { type: 'MovePiece', payload: { from: 'a1', to: 'a5', promotion: null } }),
    /illegal move|not legal/i
  );
}

{
  const battle = rookBattle({
    battleId: 'occupied_environment_blocker',
    fen: '4k3/8/8/8/3R4/8/8/4K3 w - - 0 1',
    identitiesBySquare: { d4: 'rook_w', e1: 'king_w', e8: 'king_b' }
  });
  assert.throws(
    () => escortScenario(battle, [
      { id: 'environment.occupied_wall', type: 'blocker', visible: true, cells: ['d4'] }
    ], 'd5'),
    /blocked square contains a piece: d4/
  );
}

{
  const scenario = escortScenario(rookBattle({ battleId: 'inactive_environment_blocker' }), [
    { id: 'environment.open_wall', type: 'blocker', visible: true, active: false, cells: ['a4'] }
  ]);
  const rookMoves = legalBattleCommands(scenario.battle)
    .filter((command) => command.type === 'MovePiece' && command.payload.from === 'a1')
    .map((command) => command.payload.to);
  assert(rookMoves.includes('a4'));
  assert(rookMoves.includes('a5'));
}

console.log('Scenario environment blockers: 4/4 passed.');
