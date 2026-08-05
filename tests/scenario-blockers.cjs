const assert = require('assert');
const path = require('path');
const { parseFen, squareToIndex } = require('../src/core/chess/position.cjs');
const { initialPosition } = require('../src/core/chess/position.cjs');
const { isInCheck, generateLegalMoves, perft } = require('../src/core/chess/rules.cjs');
const { createBattleState, applyBattleStatus } = require('../src/combat/battle.cjs');
const { legalWardAwareCommands, executeWardAwareCommand } = require('../src/combat/ward-protection.cjs');
const { createScenarioState, legalScenarioCommands, executeScenarioCommand, replayScenario } = require('../src/scenario/scenario.cjs');
const { chooseAiCommand } = require('../src/ai/search.cjs');
const { buildProductionContentBundle } = require('../src/content/production-bundle.cjs');
const { generateActGraph } = require('../src/campaign/graph.cjs');
const { createCampaignState, availableRoutes } = require('../src/campaign/state.cjs');
const { createVerticalSliceRuntime, enterVerticalSliceNode, saveVerticalSlice, loadVerticalSlice } = require('../src/runtime/vertical-slice.cjs');
const { createPresenterSnapshot } = require('../src/runtime/presenter-bridge.cjs');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { AtomicProfileStore } = require('../src/save/profile-store.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function battle(fen, options = {}) {
  return createBattleState({
    battleId: options.battleId || 'blocker_test',
    seed: options.seed || 1,
    playerSide: options.playerSide || parseFen(fen).sideToMove,
    position: parseFen(fen),
    identitiesBySquare: options.identitiesBySquare || {},
    orderPoints: options.orderPoints,
    reserve: options.reserve,
    reserveCells: options.reserveCells
  });
}

function scenarioFromBattle(inputBattle, environment, options = {}) {
  const side = options.playerSide || inputBattle.playerSide;
  const protectedKing = options.protectedKing || Object.entries(inputBattle.identities.metadata)
    .find(([, metadata]) => metadata.side === side && metadata.currentType === 'k')?.[0];
  return createScenarioState({
    scenarioId: options.scenarioId || `scenario_${inputBattle.battleId}`,
    seed: options.seed || 2,
    playerSide: side,
    battle: inputBattle,
    board: { width: 8, height: 8 },
    objectives: options.objectives || [{
      id: `objective.survive_${inputBattle.battleId}`,
      type: 'survive_actions',
      side,
      requiredActions: options.requiredActions || 6,
      protectedPieceIds: protectedKing ? [protectedKing] : []
    }],
    failures: options.failures || [],
    environment
  });
}

function moveDestinations(commands, from) {
  return commands.filter((command) => command.type === 'MovePiece' && command.payload.from === from).map((command) => command.payload.to).sort();
}

test('standard chess remains unchanged when no scenario blockers are present', () => {
  assert.strictEqual(perft(initialPosition(), 2), 400);
  assert.strictEqual(generateLegalMoves(initialPosition()).length, 20);
});

test('an opaque blocker interrupts a rook attack and recomputes the scenario battle status', () => {
  const base = battle('4r2k/8/8/8/8/8/8/4K3 w - - 0 1', {
    battleId: 'blocked_check',
    playerSide: 'w',
    identitiesBySquare: { e1: 'white_king', e8: 'black_rook', h8: 'black_king' }
  });
  assert.strictEqual(isInCheck(base.position, 'w'), true);
  assert.strictEqual(base.status, 'active');
  const scenario = scenarioFromBattle(base, [{ id: 'environment.iron_wall', type: 'blocker', visible: true, cells: ['e4'], interaction: 'none' }], { protectedKing: 'white_king' });
  assert.deepStrictEqual(scenario.battle.scenarioRules.blockedSquares, ['e4']);
  assert.strictEqual(isInCheck(scenario.battle.position, 'w', scenario.battle.scenarioRules), false);
  assert.strictEqual(scenario.battle.status, 'active');
});

test('sliding pieces cannot land on or move through a blocker and direct execution uses the same rule', () => {
  const base = battle('7k/8/8/8/8/8/8/R3K3 w - - 0 1', {
    battleId: 'blocked_rook',
    identitiesBySquare: { a1: 'white_rook', e1: 'white_king', h8: 'black_king' }
  });
  const scenario = scenarioFromBattle(base, [{ id: 'environment.pillar', type: 'blocker', visible: true, cells: ['a4'], interaction: 'none' }], { protectedKing: 'white_king' });
  const destinations = moveDestinations(legalScenarioCommands(scenario), 'a1');
  assert.ok(destinations.includes('a2'));
  assert.ok(destinations.includes('a3'));
  assert.strictEqual(destinations.includes('a4'), false);
  assert.strictEqual(destinations.includes('a5'), false);
  assert.throws(() => executeScenarioCommand(scenario, { type: 'MovePiece', payload: { from: 'a1', to: 'a5' } }), /environment rules/);
});

test('knights jump over blockers but cannot land on a blocked square', () => {
  const base = battle('7k/8/8/8/8/8/8/1N2K3 w - - 0 1', {
    battleId: 'blocked_knight',
    identitiesBySquare: { b1: 'white_knight', e1: 'white_king', h8: 'black_king' }
  });
  const over = scenarioFromBattle(base, [{ id: 'environment.low_wall', type: 'blocker', visible: true, cells: ['b2'], interaction: 'none' }], { protectedKing: 'white_king' });
  assert.ok(moveDestinations(legalScenarioCommands(over), 'b1').includes('c3'));
  const landing = scenarioFromBattle(base, [{ id: 'environment.high_pillar', type: 'blocker', visible: true, cells: ['c3'], interaction: 'none' }], { protectedKing: 'white_king' });
  assert.strictEqual(moveDestinations(legalScenarioCommands(landing), 'b1').includes('c3'), false);
});

test('pawns and castling respect blocked cells', () => {
  const pawnBattle = battle('7k/8/8/8/8/8/4P3/4K3 w - - 0 1', {
    battleId: 'blocked_pawn',
    identitiesBySquare: { e1: 'white_king', e2: 'white_pawn', h8: 'black_king' }
  });
  const pawnScenario = scenarioFromBattle(pawnBattle, [{ id: 'environment.pawn_gate', type: 'blocker', visible: true, cells: ['e3'], interaction: 'none' }], { protectedKing: 'white_king' });
  assert.deepStrictEqual(moveDestinations(legalScenarioCommands(pawnScenario), 'e2'), []);

  const castleBattle = battle('4k3/8/8/8/8/8/8/4K2R w K - 0 1', {
    battleId: 'blocked_castle',
    identitiesBySquare: { e1: 'white_king', h1: 'white_rook', e8: 'black_king' }
  });
  const castleScenario = scenarioFromBattle(castleBattle, [{ id: 'environment.castle_block', type: 'blocker', visible: true, cells: ['f1'], interaction: 'none' }], { protectedKing: 'white_king' });
  assert.strictEqual(moveDestinations(legalScenarioCommands(castleScenario), 'e1').includes('g1'), false);
});

test('reserve discovery and direct reserve execution exclude blocked deployment cells', () => {
  const base = battle('4k3/8/8/8/8/8/8/4K3 w - - 0 1', {
    battleId: 'blocked_reserve',
    identitiesBySquare: { e1: 'white_king', e8: 'black_king' },
    orderPoints: { w: { current: 1, max: 3 }, b: { current: 0, max: 3 } },
    reserve: [{ id: 'reserve_rook', side: 'w', type: 'r', orderCost: 1 }],
    reserveCells: { w: ['a1', 'b1'], b: [] }
  });
  const scenario = scenarioFromBattle(base, [{ id: 'environment.reserve_block', type: 'blocker', visible: true, cells: ['a1'], interaction: 'none' }], { protectedKing: 'white_king' });
  const reserveSquares = legalScenarioCommands(scenario)
    .filter((command) => command.type === 'DeployReserve')
    .map((command) => command.payload.square);
  assert.deepStrictEqual(reserveSquares, ['b1']);
  assert.throws(() => executeScenarioCommand(scenario, { type: 'DeployReserve', payload: { entryId: 'reserve_rook', square: 'a1' } }), /environment rules/);
});

test('AI inherits blocker legality from battle state and remains deterministic', () => {
  const base = battle('r3k3/8/8/8/8/8/8/4K3 b - - 0 1', {
    battleId: 'blocked_ai',
    playerSide: 'b',
    identitiesBySquare: { a8: 'black_rook', e8: 'black_king', e1: 'white_king' }
  });
  const scenario = scenarioFromBattle(base, [{ id: 'environment.ai_wall', type: 'blocker', visible: true, cells: ['a4'], interaction: 'none' }], {
    playerSide: 'b', protectedKing: 'black_king', requiredActions: 8
  });
  const legal = legalScenarioCommands(scenario);
  const first = chooseAiCommand(scenario.battle, { profile: 'apprentice', perspective: 'b', seed: 91, maxNodes: 3000, timeBudgetMs: 0 });
  const second = chooseAiCommand(scenario.battle, { profile: 'apprentice', perspective: 'b', seed: 91, maxNodes: 3000, timeBudgetMs: 0 });
  assert.deepStrictEqual(second, first);
  assert.ok(legal.some((command) => JSON.stringify(command) === JSON.stringify(first.command)));
  if (first.command.type === 'MovePiece' && first.command.payload.from === 'a8') {
    assert.strictEqual(['a4', 'a3', 'a2', 'a1'].includes(first.command.payload.to), false);
  }
});

test('ward interception and replay preserve blocker rules byte-equivalently', () => {
  let base = battle('4k3/8/8/8/8/r7/8/R3K3 w - - 0 1', {
    battleId: 'blocked_ward',
    identitiesBySquare: { a1: 'white_rook', e1: 'white_king', a3: 'black_rook', e8: 'black_king' }
  });
  base = applyBattleStatus(base, 'black_rook', 'ward').state;
  const scenario = scenarioFromBattle(base, [{ id: 'environment.behind_target', type: 'blocker', visible: true, cells: ['a4'], interaction: 'none' }], { protectedKing: 'white_king' });
  const command = { type: 'MovePiece', payload: { from: 'a1', to: 'a3' } };
  const live = executeScenarioCommand(scenario, command);
  assert.ok(live.battleEvents.some((event) => event.type === 'CapturePrevented'));
  assert.strictEqual(live.state.battle.position.board[squareToIndex('a1')].type, 'r');
  assert.strictEqual(live.state.battle.position.board[squareToIndex('a3')].type, 'r');
  assert.deepStrictEqual(live.state.battle.scenarioRules.blockedSquares, ['a4']);
  assert.deepStrictEqual(replayScenario(scenario, [command]).state, live.state);
});

test('blocked cells reject occupied starting positions before a scenario can start', () => {
  const base = battle('7k/8/8/8/8/8/8/R3K3 w - - 0 1', {
    battleId: 'occupied_blocker',
    identitiesBySquare: { a1: 'white_rook', e1: 'white_king', h8: 'black_king' }
  });
  assert.throws(() => scenarioFromBattle(base, [{ id: 'environment.invalid', type: 'blocker', visible: true, cells: ['a1'], interaction: 'none' }], { protectedKing: 'white_king' }), /blocked square contains a piece/);
});

function productionRuntimeWithBlockedScenario() {
  const projectRoot = path.resolve(__dirname, '..');
  const bundle = buildProductionContentBundle({ projectRoot });
  const pools = {
    encounters: bundle.registry.list('encounter').map((record) => record.id),
    events: bundle.registry.list('event').map((record) => record.id),
    bosses: bundle.registry.list('boss').map((record) => record.id),
    shops: ['shop.field'], services: ['service.smith'], treasures: ['treasure.cache']
  };
  for (let seed = 1; seed < 1000; seed += 1) {
    const graph = generateActGraph({ seed, act: 1, nodeCount: 9, regionId: 'region.iron_marches', contentPools: pools });
    const campaign = createCampaignState(graph, { supplies: 99, scouting: 2 });
    const route = availableRoutes(campaign).find((candidate) => ['battle', 'elite'].includes(graph.nodesById[candidate.to].type));
    if (!route) continue;
    const base = battle('7k/8/8/8/8/8/8/R3K3 w - - 0 1', {
      battleId: `presenter_blocker_${seed}`,
      seed,
      identitiesBySquare: { a1: 'white_rook', e1: 'white_king', h8: 'black_king' }
    });
    const scenario = scenarioFromBattle(base, [{ id: 'environment.presenter_wall', type: 'blocker', visible: true, cells: ['a4'], interaction: 'none' }], { protectedKing: 'white_king' });
    let runtime = createVerticalSliceRuntime({ runtimeId: `blocker_runtime_${seed}`, seed, profileId: 1, playerSide: 'w', campaign, contentRegistry: bundle.registry });
    const dependencies = {
      contentRegistry: bundle.registry,
      localization: bundle.localization.ru,
      nodeResolver: () => ({ mode: 'scenario', scenario, reward: { gold: 1, supplies: 0, meta: 0 } })
    };
    runtime = enterVerticalSliceNode(runtime, route.to, dependencies);
    return { bundle, runtime, dependencies };
  }
  throw new Error('could not find opening combat route');
}

test('presenter, atomic save and reload preserve the exact blocker-aware command set', () => {
  const { bundle, runtime, dependencies } = productionRuntimeWithBlockedScenario();
  const snapshot = createPresenterSnapshot(runtime, dependencies);
  assert.strictEqual(snapshot.status, 'scenario');
  assert.strictEqual(snapshot.scenario.environment[0].type, 'blocker');
  assert.strictEqual(moveDestinations(snapshot.scenario.legalCommands, 'a1').includes('a5'), false);

  const store = new AtomicProfileStore({ storage: new MemoryKeyValueStorage(), deviceId: 'blocker-save', clock: () => 9000 });
  saveVerticalSlice(store, runtime);
  const loaded = loadVerticalSlice(store, 1, { contentRegistry: bundle.registry });
  assert.deepStrictEqual(loaded.state, runtime);
  assert.deepStrictEqual(loaded.state.scenario.battle.scenarioRules.blockedSquares, ['a4']);
  assert.deepStrictEqual(createPresenterSnapshot(loaded.state, dependencies).scenario.legalCommands, snapshot.scenario.legalCommands);
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
console.log(`\nScenario blockers: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
