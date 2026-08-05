const assert = require('assert');
const { parseFen } = require('../src/core/chess/position.cjs');
const { createBattleState } = require('../src/combat/battle.cjs');
const {
  applyWardStatus,
  legalWardAwareCommands,
  executeWardAwareCommand
} = require('../src/combat/ward-protection.cjs');
const { AI_PROFILES, resolveAiProfile } = require('../src/ai/profiles.cjs');
const { commandKey, chooseAiCommand } = require('../src/ai/search.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const deterministicProfile = Object.freeze({
  id: 'test', depth: 1, maxNodes: 10000, timeBudgetMs: 0, rootNoise: 0,
  reserveDiscount: 0.85, mobilityWeight: 3, statusWeight: 22
});

test('three production difficulty profiles resolve with increasing search depth', () => {
  assert.deepStrictEqual(Object.keys(AI_PROFILES), ['apprentice', 'tactician', 'warlord']);
  assert.strictEqual(resolveAiProfile('apprentice').depth, 1);
  assert.strictEqual(resolveAiProfile('tactician').depth, 2);
  assert.strictEqual(resolveAiProfile('warlord').depth, 3);
  assert.throws(() => resolveAiProfile('cheater'), /unknown AI profile/);
});

test('same state, profile and seed choose the same legal command', () => {
  const state = createBattleState({
    battleId: 'deterministic-ai', seed: 91,
    position: parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1')
  });
  const first = chooseAiCommand(state, { profile: 'apprentice', seed: 1234, now: () => 0 });
  const second = chooseAiCommand(state, { profile: 'apprentice', seed: 1234, now: () => 0 });
  assert.strictEqual(first.key, second.key);
  assert.deepStrictEqual(first.command, second.command);
  assert.strictEqual(legalWardAwareCommands(state).some((command) => commandKey(command) === first.key), true);
});

test('AI finds a forced checkmate in one', () => {
  const state = createBattleState({
    battleId: 'mate-one', seed: 92,
    position: parseFen('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1'),
    playerSide: 'w'
  });
  const choice = chooseAiCommand(state, { profile: deterministicProfile, seed: 1, now: () => 0 });
  const result = executeWardAwareCommand(state, choice.command);
  assert.strictEqual(result.state.status, 'completed');
  assert.strictEqual(result.state.result.reason, 'checkmate');
  assert.strictEqual(result.state.result.winner, 'w');
});

test('material-aware AI captures an exposed queen', () => {
  const state = createBattleState({
    battleId: 'capture-queen', seed: 93,
    position: parseFen('4k3/8/8/8/3qR3/8/8/4K3 w - - 0 1')
  });
  const choice = chooseAiCommand(state, { profile: deterministicProfile, seed: 2, now: () => 0 });
  assert.strictEqual(choice.key, 'move:e4:d4:-');
});

test('ward-aware AI never chooses a fake check evasion', () => {
  let state = createBattleState({
    battleId: 'ward-ai', seed: 94,
    position: parseFen('R3r1k1/8/8/8/8/8/8/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', a8: 'rook_w', e8: 'rook_b', g8: 'king_b' }
  });
  state = applyWardStatus(state, 'rook_b').state;
  const choice = chooseAiCommand(state, { profile: deterministicProfile, seed: 3, now: () => 0 });
  assert.notStrictEqual(choice.key, 'move:a8:e8:-');
  assert.strictEqual(legalWardAwareCommands(state).some((command) => commandKey(command) === choice.key), true);
});

test('objective evaluator can prioritize a legal reserve deployment', () => {
  const state = createBattleState({
    battleId: 'objective-reserve', seed: 95,
    position: parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1'),
    orderPoints: { w: { current: 2, max: 5 }, b: { current: 0, max: 5 } },
    reserve: [{ id: 'white_rook', side: 'w', type: 'r', orderCost: 2 }],
    reserveCells: { w: ['a1', 'e2'], b: [] }
  });
  const choice = chooseAiCommand(state, {
    profile: deterministicProfile,
    seed: 4,
    now: () => 0,
    objectiveEvaluator: (candidate) => candidate.identities.bySquare.a1 === 'white_rook' ? 5000 : 0
  });
  assert.strictEqual(choice.key, 'reserve:white_rook:a1');
});

test('node budget returns a legal deterministic fallback instead of hanging', () => {
  const state = createBattleState({
    battleId: 'budget-ai', seed: 96,
    position: parseFen('r3k2r/ppp2ppp/2n5/3qp3/3QP3/2N5/PPP2PPP/R3K2R w KQkq - 0 1')
  });
  const choice = chooseAiCommand(state, {
    profile: { ...deterministicProfile, depth: 3, maxNodes: 1 },
    seed: 5,
    now: () => 0
  });
  assert.strictEqual(choice.abortedBy, 'nodes');
  assert.strictEqual(choice.completedDepth, 0);
  assert.strictEqual(legalWardAwareCommands(state).some((command) => commandKey(command) === choice.key), true);
});

test('hard time ceiling returns a legal command and reports time abort', () => {
  const state = createBattleState({
    battleId: 'time-ai', seed: 97,
    position: parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1')
  });
  let tick = 0;
  const choice = chooseAiCommand(state, {
    profile: { ...deterministicProfile, depth: 3, timeBudgetMs: 1 },
    seed: 6,
    now: () => tick++
  });
  assert.strictEqual(choice.abortedBy, 'time');
  assert.strictEqual(legalWardAwareCommands(state).some((command) => commandKey(command) === choice.key), true);
});

test('AI never emits an illegal command during a deterministic playout corpus', () => {
  let state = createBattleState({
    battleId: 'legal-corpus', seed: 98,
    position: parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  });
  for (let ply = 0; ply < 30 && state.status === 'active'; ply += 1) {
    const legal = legalWardAwareCommands(state);
    const legalKeys = new Set(legal.map(commandKey));
    const choice = chooseAiCommand(state, { profile: deterministicProfile, seed: 1000 + ply, now: () => 0 });
    assert.strictEqual(legalKeys.has(choice.key), true, `illegal AI command on ply ${ply}: ${choice.key}`);
    state = executeWardAwareCommand(state, choice.command).state;
  }
  assert.ok(state.actionIndex > 0);
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
console.log(`\nDeterministic AI search: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
