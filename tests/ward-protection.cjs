const assert = require('assert');
const { parseFen, toFen } = require('../src/core/chess/position.cjs');
const { identityAt } = require('../src/combat/identity.cjs');
const { statusFor } = require('../src/combat/statuses.cjs');
const { createBattleState } = require('../src/combat/battle.cjs');
const {
  legalWardAwareCommands,
  applyWardStatus,
  executeWardAwareCommand,
  replayWardAware
} = require('../src/combat/ward-protection.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const move = (from, to, promotion = null) => ({ type: 'MovePiece', payload: { from, to, promotion } });

test('ward prevents one capture, keeps both pieces in place and passes action', () => {
  let state = createBattleState({
    battleId: 'ward-basic', seed: 51,
    position: parseFen('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b', e4: 'pawn_w', d5: 'pawn_b' }
  });
  state = applyWardStatus(state, 'pawn_b', { sourceId: 'relic.echo_shield' }).state;
  const result = executeWardAwareCommand(state, move('e4', 'd5'));
  assert.strictEqual(identityAt(result.state.identities, 'e4'), 'pawn_w');
  assert.strictEqual(identityAt(result.state.identities, 'd5'), 'pawn_b');
  assert.strictEqual(result.state.position.sideToMove, 'b');
  assert.strictEqual(result.state.actionIndex, 1);
  assert.strictEqual(statusFor(result.state.statuses, 'pawn_b'), null);
  assert.deepStrictEqual(result.events.map((event) => event.type), ['CapturePrevented', 'StatusRemoved']);
  assert.strictEqual(result.events[0].payload.attackerId, 'pawn_w');
  assert.strictEqual(result.events[0].payload.protectedId, 'pawn_b');
});

test('after ward is consumed, the next legal capture removes the piece normally', () => {
  let state = createBattleState({
    battleId: 'ward-once', seed: 52,
    position: parseFen('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b', e4: 'pawn_w', d5: 'pawn_b' }
  });
  state = applyWardStatus(state, 'pawn_b').state;
  state = executeWardAwareCommand(state, move('e4', 'd5')).state;
  state = executeWardAwareCommand(state, move('e8', 'f8')).state;
  const result = executeWardAwareCommand(state, move('e4', 'd5'));
  const eventTypes = result.events.map((event) => event.type);
  const correct = identityAt(result.state.identities, 'e4') === null
    && identityAt(result.state.identities, 'd5') === 'pawn_w'
    && eventTypes[0] === 'PieceMoved'
    && eventTypes.includes('PieceCaptured')
    && !eventTypes.includes('CapturePrevented');
  if (!correct) {
    throw new Error(`ward restoration diagnostic: ${JSON.stringify({
      fen: toFen(result.state.position),
      bySquare: result.state.identities.bySquare,
      statuses: result.state.statuses,
      eventTypes
    })}`);
  }
});

test('ward cannot be applied to either king', () => {
  const state = createBattleState({
    battleId: 'ward-king', seed: 53,
    position: parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b' }
  });
  assert.throws(() => applyWardStatus(state, 'king_w'), /cannot be applied to a king/);
  assert.throws(() => applyWardStatus(state, 'king_b'), /cannot be applied to a king/);
});

test('warded checker cannot be captured as a fake check evasion', () => {
  let state = createBattleState({
    battleId: 'ward-check', seed: 54,
    position: parseFen('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e2: 'rook_w', e8: 'rook_b', g8: 'king_b' }
  });
  state = applyWardStatus(state, 'rook_b').state;
  const commands = legalWardAwareCommands(state);
  assert.strictEqual(commands.some((command) => command.type === 'MovePiece' && command.payload.from === 'e2' && command.payload.to === 'e8'), false);
  assert.throws(() => executeWardAwareCommand(state, move('e2', 'e8')), /cannot be used to leave own king in check/);
});

test('ward also protects an en-passant target once', () => {
  let state = createBattleState({
    battleId: 'ward-ep', seed: 55,
    position: parseFen('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b', e5: 'pawn_w', d7: 'pawn_b' }
  });
  state = executeWardAwareCommand(state, move('d7', 'd5')).state;
  state = applyWardStatus(state, 'pawn_b').state;
  const result = executeWardAwareCommand(state, move('e5', 'd6'));
  assert.strictEqual(identityAt(result.state.identities, 'e5'), 'pawn_w');
  assert.strictEqual(identityAt(result.state.identities, 'd5'), 'pawn_b');
  assert.strictEqual(identityAt(result.state.identities, 'd6'), null);
  assert.strictEqual(result.events[0].payload.protectedSquare, 'd5');
});

test('ward action advances other same-side timed statuses', () => {
  const { applyBattleStatus } = require('../src/combat/battle.cjs');
  let state = createBattleState({
    battleId: 'ward-status-tick', seed: 56,
    position: parseFen('4k3/8/8/3p4/4P3/8/3P4/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b', e4: 'pawn_w', d2: 'other_w', d5: 'pawn_b' }
  });
  state = applyWardStatus(state, 'pawn_b').state;
  state = applyBattleStatus(state, 'other_w', 'marked', { expiry: { kind: 'side_actions', remaining: 1 } }).state;
  const result = executeWardAwareCommand(state, move('e4', 'd5'));
  assert.strictEqual(statusFor(result.state.statuses, 'other_w'), null);
  assert.strictEqual(result.events.some((event) => event.type === 'StatusExpired' && event.payload.pieceId === 'other_w'), true);
});

test('ward-aware replay is deterministic including prevented capture events', () => {
  const create = () => {
    let state = createBattleState({
      battleId: 'ward-replay', seed: 57,
      position: parseFen('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'),
      identitiesBySquare: { e1: 'king_w', e8: 'king_b', e4: 'pawn_w', d5: 'pawn_b' }
    });
    return applyWardStatus(state, 'pawn_b').state;
  };
  const commands = [move('e4', 'd5'), move('e8', 'f8'), move('e4', 'd5')];
  const first = replayWardAware(create(), commands);
  const second = replayWardAware(create(), commands);
  assert.strictEqual(first.finalFen, second.finalFen);
  assert.deepStrictEqual(first.state.identities, second.state.identities);
  assert.deepStrictEqual(first.events, second.events);
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
console.log(`\nWard protection: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
