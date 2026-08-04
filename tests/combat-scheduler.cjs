const assert = require('assert');
const { parseFen, toFen } = require('../src/core/chess/position.cjs');
const {
  createBattleState,
  legalBattleCommands,
  executeBattleCommand,
  replayBattle
} = require('../src/combat/battle.cjs');

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const move = (from, to, promotion = null) => ({ type: 'MovePiece', payload: { from, to, promotion } });

test('standard battle exposes exactly the current side legal actions', () => {
  const state = createBattleState({ battleId: 'opening', seed: 11, position: parseFen(START_FEN), playerSide: 'w' });
  assert.strictEqual(state.status, 'active');
  assert.strictEqual(legalBattleCommands(state).length, 20);
  assert.strictEqual(state.position.sideToMove, 'w');
});

test('one move immediately passes action to the other side', () => {
  let state = createBattleState({ battleId: 'alternating', seed: 12, position: parseFen(START_FEN), playerSide: 'w' });
  let resolution = executeBattleCommand(state, move('e2', 'e4'));
  state = resolution.state;
  assert.strictEqual(state.position.sideToMove, 'b');
  assert.strictEqual(state.actionIndex, 1);
  assert.deepStrictEqual(resolution.events.map((event) => event.type), ['PieceMoved']);
  assert.throws(() => executeBattleCommand(state, move('g1', 'f3')), /illegal move/);

  resolution = executeBattleCommand(state, move('e7', 'e5'));
  state = resolution.state;
  assert.strictEqual(state.position.sideToMove, 'w');
  assert.strictEqual(state.actionIndex, 2);
});

test('capture produces explicit move and capture events', () => {
  const state = createBattleState({
    battleId: 'capture', seed: 13,
    position: parseFen('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'),
    playerSide: 'w'
  });
  const resolution = executeBattleCommand(state, move('e4', 'd5'));
  assert.deepStrictEqual(resolution.events.map((event) => event.type), ['PieceMoved', 'PieceCaptured']);
  assert.strictEqual(resolution.events[1].payload.capturedType, 'p');
  assert.strictEqual(resolution.events[1].payload.square, 'd5');
});

test('fools mate completes the battle after four alternating actions', () => {
  let state = createBattleState({ battleId: 'mate', seed: 14, position: parseFen(START_FEN), playerSide: 'w' });
  const sequence = [move('f2', 'f3'), move('e7', 'e5'), move('g2', 'g4'), move('d8', 'h4')];
  let finalEvents = [];
  for (const command of sequence) {
    const result = executeBattleCommand(state, command);
    state = result.state;
    finalEvents = result.events;
  }
  assert.strictEqual(state.status, 'completed');
  assert.deepStrictEqual(state.result, { outcome: 'defeat', winner: 'b', reason: 'checkmate' });
  assert.deepStrictEqual(finalEvents.map((event) => event.type), ['PieceMoved', 'CheckmateDeclared', 'BattleCompleted']);
  assert.strictEqual(state.history.length, 4);
  assert.throws(() => executeBattleCommand(state, move('a2', 'a3')), /already completed/);
});

test('initial stalemate is represented as a completed draw', () => {
  const state = createBattleState({
    battleId: 'stalemate', seed: 15,
    position: parseFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'),
    playerSide: 'w'
  });
  assert.strictEqual(state.status, 'completed');
  assert.deepStrictEqual(state.result, { outcome: 'draw', winner: null, reason: 'stalemate' });
  assert.deepStrictEqual(legalBattleCommands(state), []);
});

test('promotion produces a dedicated domain event', () => {
  const state = createBattleState({
    battleId: 'promotion', seed: 16,
    position: parseFen('7k/P7/8/8/8/8/8/7K w - - 0 1'),
    playerSide: 'w'
  });
  const resolution = executeBattleCommand(state, move('a7', 'a8', 'n'));
  assert.deepStrictEqual(resolution.events.map((event) => event.type), ['PieceMoved', 'PawnPromoted']);
  assert.strictEqual(resolution.events[1].payload.promotedTo, 'n');
});

test('replay is deterministic down to state and event IDs', () => {
  const commands = [move('e2', 'e4'), move('c7', 'c5'), move('g1', 'f3'), move('d7', 'd6')];
  const create = () => createBattleState({ battleId: 'replay', seed: 991, position: parseFen(START_FEN), playerSide: 'w' });
  const first = replayBattle(create(), commands);
  const second = replayBattle(create(), commands);
  assert.strictEqual(first.finalFen, second.finalFen);
  assert.strictEqual(first.finalFen, toFen(first.state.position));
  assert.deepStrictEqual(first.events, second.events);
  assert.deepStrictEqual(first.state.envelope, second.state.envelope);
});

test('command and event sequences share deterministic monotonic order', () => {
  const state = createBattleState({ battleId: 'sequence', seed: 55, position: parseFen(START_FEN), playerSide: 'w' });
  const resolution = executeBattleCommand(state, move('e2', 'e4'));
  assert.strictEqual(resolution.command.sequence, 0);
  assert.strictEqual(resolution.events[0].sequence, 1);
  assert.strictEqual(resolution.state.envelope.sequence, 2);
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
console.log(`\nCombat scheduler: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
