const assert = require('assert');
const { squareToIndex, parseFen } = require('../src/core/chess/position.cjs');
const {
  createDeploymentPlan,
  placeUnit,
  removeUnit,
  deploymentSummary,
  finalizeDeployment
} = require('../src/combat/deployment.cjs');
const { createOrderPoints, gainOrderPoints, spendOrderPoints, resetOrderPoints } = require('../src/combat/order-points.cjs');
const { createBattleState, legalBattleCommands, executeBattleCommand } = require('../src/combat/battle.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function roster() {
  return [
    { id: 'king', type: 'k', commandCost: 0, required: true, fixedSquare: 'e1' },
    { id: 'rook', type: 'r', commandCost: 3 },
    { id: 'knight', type: 'n', commandCost: 2 },
    { id: 'pawn', type: 'p', commandCost: 1 }
  ];
}

test('order points gain, spend, clamp and reset immutably', () => {
  const start = createOrderPoints({ current: 2, max: 5 });
  const gained = gainOrderPoints(start, 9, 'objective');
  assert.strictEqual(gained.pool.current, 5);
  assert.strictEqual(gained.changedBy, 3);
  const spent = spendOrderPoints(gained.pool, 4, 'reserve');
  assert.strictEqual(spent.pool.current, 1);
  assert.strictEqual(start.current, 2);
  assert.strictEqual(resetOrderPoints(spent.pool).current, 0);
  assert.throws(() => spendOrderPoints(start, 3), /not enough/);
});

test('deployment plan enforces fixed king, zone and command limit', () => {
  let plan = createDeploymentPlan({
    side: 'w', commandLimit: 5, roster: roster(),
    zone: ['a1','b1','c1','d1','e1','f1','g1','h1','a2','b2','c2','d2','e2','f2','g2','h2']
  });
  plan = placeUnit(plan, 'rook', 'a1');
  plan = placeUnit(plan, 'knight', 'b1');
  const summary = deploymentSummary(plan);
  assert.strictEqual(summary.commandSpent, 5);
  assert.deepStrictEqual(summary.missingRequired, []);
  assert.deepStrictEqual(summary.reserveIds, ['pawn']);
  assert.throws(() => placeUnit(plan, 'pawn', 'a2'), /command limit/);
  assert.throws(() => placeUnit(plan, 'rook', 'a3'), /outside deployment zone/);
  assert.throws(() => removeUnit(plan, 'king'), /fixed/);
  const reduced = removeUnit(plan, 'knight');
  assert.strictEqual(deploymentSummary(reduced).commandSpent, 3);
});

test('finalized deployment builds a legal position and reserve', () => {
  let plan = createDeploymentPlan({
    side: 'w', commandLimit: 5, roster: roster(),
    zone: ['a1','b1','c1','d1','e1','f1','g1','h1','a2','b2','c2','d2','e2','f2','g2','h2']
  });
  plan = placeUnit(plan, 'rook', 'a1');
  plan = placeUnit(plan, 'knight', 'b1');
  const result = finalizeDeployment(plan, {
    enemyPieces: [{ id: 'enemy_king', side: 'b', type: 'k', square: 'e8' }]
  });
  assert.strictEqual(result.position.board[squareToIndex('e1')].type, 'k');
  assert.strictEqual(result.position.board[squareToIndex('a1')].type, 'r');
  assert.strictEqual(result.position.board[squareToIndex('e8')].side, 'b');
  assert.deepStrictEqual(result.reserve.map((unit) => unit.id), ['pawn']);
  assert.strictEqual(result.commandSpent, 5);
});

test('finalized ordinary deployment rejects a king already in check', () => {
  const plan = createDeploymentPlan({
    side: 'w', commandLimit: 0, roster: [{ id: 'king', type: 'k', commandCost: 0, required: true, fixedSquare: 'e1' }],
    zone: ['e1']
  });
  assert.throws(() => finalizeDeployment(plan, {
    enemyPieces: [
      { id: 'enemy_king', side: 'b', type: 'k', square: 'a8' },
      { id: 'enemy_rook', side: 'b', type: 'r', square: 'e8' }
    ]
  }), /starts in check/);
});

test('reserve deployment spends order points and passes the action', () => {
  const state = createBattleState({
    battleId: 'reserve', seed: 22,
    position: parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1'),
    playerSide: 'w',
    orderPoints: { w: { current: 2, max: 5 }, b: { current: 0, max: 5 } },
    reserve: [{ id: 'white_rook', side: 'w', type: 'r', orderCost: 2 }],
    reserveCells: { w: ['a1', 'e2'], b: [] }
  });
  const reserveCommands = legalBattleCommands(state).filter((command) => command.type === 'DeployReserve');
  assert.deepStrictEqual(reserveCommands.map((command) => command.payload.square).sort(), ['a1', 'e2']);

  const resolution = executeBattleCommand(state, { type: 'DeployReserve', payload: { entryId: 'white_rook', square: 'a1' } });
  assert.strictEqual(resolution.state.position.sideToMove, 'b');
  assert.strictEqual(resolution.state.position.board[squareToIndex('a1')].type, 'r');
  assert.strictEqual(resolution.state.orderPoints.w.current, 0);
  assert.strictEqual(resolution.state.reserve.length, 0);
  assert.strictEqual(resolution.state.actionIndex, 1);
  assert.deepStrictEqual(resolution.events.map((event) => event.type), ['ReserveDeployed', 'OrderPointsChanged']);
});

test('reserve deployment can legally give check and emits the check event', () => {
  const state = createBattleState({
    battleId: 'reserve-check', seed: 23,
    position: parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1'),
    playerSide: 'w',
    orderPoints: { w: { current: 1, max: 5 }, b: { current: 0, max: 5 } },
    reserve: [{ id: 'white_rook', side: 'w', type: 'r', orderCost: 1 }],
    reserveCells: { w: ['e2'], b: [] }
  });
  const resolution = executeBattleCommand(state, { type: 'DeployReserve', payload: { entryId: 'white_rook', square: 'e2' } });
  assert.deepStrictEqual(resolution.events.map((event) => event.type), ['ReserveDeployed', 'OrderPointsChanged', 'KingChecked']);
});

test('reserve deployment is unavailable without enough order points', () => {
  const state = createBattleState({
    battleId: 'reserve-poor', seed: 24,
    position: parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1'),
    playerSide: 'w',
    orderPoints: { w: { current: 0, max: 5 }, b: { current: 0, max: 5 } },
    reserve: [{ id: 'white_rook', side: 'w', type: 'r', orderCost: 1 }],
    reserveCells: { w: ['a1'], b: [] }
  });
  assert.strictEqual(legalBattleCommands(state).some((command) => command.type === 'DeployReserve'), false);
  assert.throws(() => executeBattleCommand(state, { type: 'DeployReserve', payload: { entryId: 'white_rook', square: 'a1' } }), /not enough order points/);
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
  }
}
console.log(`\nDeployment and reserve: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
