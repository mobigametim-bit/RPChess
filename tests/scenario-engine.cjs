const assert = require('assert');
const { parseFen } = require('../src/core/chess/position.cjs');
const { createBattleState } = require('../src/combat/battle.cjs');
const { createEnvironmentRegistry } = require('../src/scenario/environment.cjs');
const {
  createScenarioState,
  executeScenarioCommand,
  scenarioObjectiveEvaluator,
  replayScenario
} = require('../src/scenario/scenario.cjs');
const {
  createBossPhaseState,
  executeBossCommand,
  beginNextBossPhase
} = require('../src/scenario/boss-phases.cjs');
const { chooseAiCommand } = require('../src/ai/search.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const move = (from, to, promotion = null) => ({ type: 'MovePiece', payload: { from, to, promotion } });
const profile = Object.freeze({
  id: 'scenario-test', depth: 1, maxNodes: 10000, timeBudgetMs: 0, rootNoise: 0,
  reserveDiscount: 0.85, mobilityWeight: 2, statusWeight: 22
});

test('environment registry permits only visible, valid tactical objects', () => {
  const registry = createEnvironmentRegistry({
    width: 8, height: 8,
    objects: [
      { id: 'environment.wall', type: 'blocker', visible: true, cells: ['d4'], passable: false },
      { id: 'environment.gates', type: 'portal', visible: true, cells: ['a1', 'h8'], interaction: 'activate' }
    ]
  });
  assert.strictEqual(registry.objects.length, 2);
  assert.deepStrictEqual(registry.byCell.d4, ['environment.wall']);
  assert.deepStrictEqual(registry.byCell.a1, ['environment.gates']);
  assert.throws(() => createEnvironmentRegistry({ width: 8, height: 8, objects: [{ id: 'environment.hidden', type: 'hazard', visible: false, cells: ['e4'] }] }), /hidden tactical objects are forbidden/);
  assert.throws(() => createEnvironmentRegistry({ width: 8, height: 8, objects: [{ id: 'environment.bad_portal', type: 'portal', visible: true, cells: ['a1'] }] }), /exactly two endpoints/);
});

test('escort objective completes a scenario without requiring checkmate', () => {
  const battle = createBattleState({
    battleId: 'escort', seed: 201,
    position: parseFen('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b', e2: 'escort_rook' }
  });
  const scenario = createScenarioState({
    scenarioId: 'escort_route', seed: 301, battle,
    objectives: [{ id: 'objective.reach_exit', type: 'escort', pieceId: 'escort_rook', targetCells: ['e3'] }]
  });
  const result = executeScenarioCommand(scenario, move('e2', 'e3'));
  assert.strictEqual(result.state.status, 'completed');
  assert.strictEqual(result.state.result.outcome, 'victory');
  assert.strictEqual(result.state.result.reason, 'scenario_objective');
  assert.strictEqual(result.state.battle.status, 'active');
  assert.deepStrictEqual(result.scenarioEvents.map((event) => event.type), ['ScenarioObjectiveProgressed', 'ScenarioObjectiveCompleted', 'ScenarioCompleted']);
});

test('capture-target objective tracks identities instead of board piece types', () => {
  const battle = createBattleState({
    battleId: 'capture-target', seed: 202,
    position: parseFen('4k3/8/8/8/3rR3/8/8/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b', e4: 'hunter', d4: 'target_rook' }
  });
  const scenario = createScenarioState({
    scenarioId: 'target_hunt', seed: 302, battle,
    objectives: [{ id: 'objective.capture_guard', type: 'capture_targets', targetPieceIds: ['target_rook'] }]
  });
  const result = executeScenarioCommand(scenario, move('e4', 'd4'));
  assert.strictEqual(result.state.objectiveStates[0].current, 1);
  assert.deepStrictEqual(result.state.objectiveStates[0].details.capturedPieceIds, ['target_rook']);
  assert.strictEqual(result.state.result.outcome, 'victory');
});

test('occupy objective requires consecutive visible board states', () => {
  const battle = createBattleState({
    battleId: 'occupy', seed: 203,
    position: parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b', e2: 'holder' }
  });
  let scenario = createScenarioState({
    scenarioId: 'hold_cell', seed: 303, battle,
    objectives: [{ id: 'objective.hold_e2', type: 'occupy_cells', side: 'w', targetCells: ['e2'], holdActions: 2 }]
  });
  scenario = executeScenarioCommand(scenario, move('e1', 'd1')).state;
  assert.strictEqual(scenario.objectiveStates[0].current, 1);
  scenario = executeScenarioCommand(scenario, move('e8', 'd8')).state;
  assert.strictEqual(scenario.status, 'completed');
  assert.strictEqual(scenario.objectiveStates[0].current, 2);
});

test('explicit piece-loss failure overrides unrelated objective progress', () => {
  const battle = createBattleState({
    battleId: 'failure', seed: 204,
    playerSide: 'w',
    position: parseFen('4k3/8/8/3r4/3R4/8/8/4K3 b - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b', d4: 'protected_rook', d5: 'enemy_rook' }
  });
  const scenario = createScenarioState({
    scenarioId: 'protect_rook', seed: 304, battle,
    objectives: [{ id: 'objective.survive', type: 'survive_actions', side: 'w', requiredActions: 8, protectedPieceIds: ['king_w'] }],
    failures: [{ id: 'failure.rook_lost', type: 'piece_lost', side: 'w', targetPieceIds: ['protected_rook'] }]
  });
  const result = executeScenarioCommand(scenario, move('d5', 'd4'));
  assert.strictEqual(result.state.status, 'completed');
  assert.strictEqual(result.state.result.outcome, 'defeat');
  assert.strictEqual(result.state.result.failureId, 'failure.rook_lost');
  assert.strictEqual(result.scenarioEvents.some((event) => event.type === 'ScenarioFailureTriggered'), true);
});

test('success on the declared final action is allowed before action-limit failure', () => {
  const battle = createBattleState({
    battleId: 'deadline', seed: 205,
    position: parseFen('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b', e2: 'runner' }
  });
  const scenario = createScenarioState({
    scenarioId: 'deadline_route', seed: 305, battle,
    objectives: [{ id: 'objective.exit', type: 'escort', pieceId: 'runner', targetCells: ['e3'] }],
    failures: [{ id: 'failure.deadline', type: 'action_limit', maxActions: 1 }]
  });
  const result = executeScenarioCommand(scenario, move('e2', 'e3'));
  assert.strictEqual(result.state.result.outcome, 'victory');
  assert.strictEqual(result.state.failureStates[0].triggered, false);
});

test('scenario objective evaluator directs AI toward an escort exit', () => {
  const battle = createBattleState({
    battleId: 'escort-ai', seed: 206,
    position: parseFen('4k3/8/8/8/8/8/8/R3K3 w Q - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b', a1: 'runner' }
  });
  const scenario = createScenarioState({
    scenarioId: 'escort_ai', seed: 306, battle,
    objectives: [{ id: 'objective.exit', type: 'escort', pieceId: 'runner', targetCells: ['a2'] }]
  });
  const choice = chooseAiCommand(battle, {
    profile,
    seed: 12,
    now: () => 0,
    objectiveEvaluator: scenarioObjectiveEvaluator(scenario)
  });
  assert.strictEqual(choice.key, 'move:a1:a2:-');
});

test('scenario replay produces identical progress and event IDs', () => {
  const create = () => createScenarioState({
    scenarioId: 'replay_hold', seed: 307,
    battle: createBattleState({
      battleId: 'replay-hold', seed: 207,
      position: parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'),
      identitiesBySquare: { e1: 'king_w', e8: 'king_b', e2: 'holder' }
    }),
    objectives: [{ id: 'objective.hold', type: 'occupy_cells', targetCells: ['e2'], holdActions: 2 }]
  });
  const requests = [move('e1', 'd1'), move('e8', 'd8')];
  const first = replayScenario(create(), requests);
  const second = replayScenario(create(), requests);
  assert.deepStrictEqual(first.state.objectiveStates, second.state.objectiveStates);
  assert.deepStrictEqual(first.events, second.events);
});

test('boss state requires explicit tested transition between two phases', () => {
  const phaseOneBattle = createBattleState({
    battleId: 'boss-phase-one', seed: 208,
    position: parseFen('4k3/8/8/8/3rR3/8/8/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b', e4: 'hero_rook', d4: 'seal_guard' }
  });
  let boss = createBossPhaseState({
    bossId: 'boss.iron_regent', seed: 401, initialBattle: phaseOneBattle,
    phases: [
      { id: 'break_seal', objectives: [{ id: 'objective.break_guard', type: 'capture_targets', targetPieceIds: ['seal_guard'] }] },
      { id: 'final_mate', objectives: [{ id: 'objective.mate', type: 'checkmate', side: 'w' }] }
    ]
  });
  boss = executeBossCommand(boss, move('e4', 'd4')).state;
  assert.strictEqual(boss.status, 'awaiting_phase_transition');
  assert.strictEqual(boss.phaseHistory.length, 1);
  assert.throws(() => executeBossCommand(boss, move('e8', 'f8')), /does not accept battle commands/);

  const phaseTwoBattle = createBattleState({
    battleId: 'boss-phase-two', seed: 209,
    position: parseFen('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1'),
    identitiesBySquare: { h8: 'boss_king', f7: 'hero_queen', g6: 'king_w' }
  });
  boss = beginNextBossPhase(boss, phaseTwoBattle).state;
  assert.strictEqual(boss.currentPhaseId, 'final_mate');
  assert.strictEqual(boss.status, 'active');
  boss = executeBossCommand(boss, move('f7', 'g7')).state;
  assert.strictEqual(boss.status, 'completed');
  assert.strictEqual(boss.result.outcome, 'victory');
  assert.strictEqual(boss.phaseHistory.length, 2);
  assert.strictEqual(boss.eventLog.filter((event) => event.type === 'BossPhaseCompleted').length, 2);
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
console.log(`\nScenario and boss phases: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
