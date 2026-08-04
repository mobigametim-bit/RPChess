const assert = require('assert');
const { parseFen } = require('../src/core/chess/position.cjs');
const {
  STATUS_DEFINITIONS,
  createStatusState,
  statusFor,
  applyPrimaryStatus,
  consumeStatus,
  advanceStatuses,
  statusView
} = require('../src/combat/statuses.cjs');
const {
  createBattleState,
  legalBattleCommands,
  executeBattleCommand,
  applyBattleStatus,
  replayBattle
} = require('../src/combat/battle.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const move = (from, to, promotion = null) => ({ type: 'MovePiece', payload: { from, to, promotion } });

test('all release primary statuses are visible and never hide geometry', () => {
  assert.deepStrictEqual(Object.keys(STATUS_DEFINITIONS).sort(), ['bound', 'cursed', 'marked', 'provoked', 'silenced', 'ward']);
  for (const definition of Object.values(STATUS_DEFINITIONS)) {
    assert.strictEqual(definition.category, 'primary');
    assert.strictEqual(definition.visible, true);
    assert.strictEqual(definition.geometryChange, false);
  }
});

test('one-primary-status invariant rejects stacking unless replacement is explicit', () => {
  let state = createStatusState();
  state = applyPrimaryStatus(state, 'piece_1', 'marked', { sourceId: 'hero_1' }).state;
  assert.throws(() => applyPrimaryStatus(state, 'piece_1', 'silenced'), /already has primary status/);
  const replaced = applyPrimaryStatus(state, 'piece_1', 'silenced', { replace: true, sourceId: 'relic_1' });
  assert.strictEqual(replaced.replaced.id, 'marked');
  assert.strictEqual(statusFor(replaced.state, 'piece_1').id, 'silenced');
});

test('consumable ward is removed explicitly and other statuses cannot be consumed', () => {
  let state = applyPrimaryStatus(createStatusState(), 'piece_1', 'ward').state;
  const consumed = consumeStatus(state, 'piece_1', 'ward', 'first_capture');
  assert.strictEqual(statusFor(consumed.state, 'piece_1'), null);
  state = applyPrimaryStatus(createStatusState(), 'piece_2', 'cursed').state;
  assert.throws(() => consumeStatus(state, 'piece_2'), /not consumable/);
});

test('side-action duration advances only on the affected piece side', () => {
  let state = applyPrimaryStatus(createStatusState(), 'white_piece', 'marked', {
    expiry: { kind: 'side_actions', remaining: 2 }
  }).state;
  let advanced = advanceStatuses(state, { actingSide: 'b', actedPieceId: 'black_piece', sideByPiece: { white_piece: 'w', black_piece: 'b' } });
  assert.strictEqual(statusFor(advanced.state, 'white_piece').expiry.remaining, 2);
  advanced = advanceStatuses(advanced.state, { actingSide: 'w', actedPieceId: 'other_white', sideByPiece: { white_piece: 'w', other_white: 'w' } });
  assert.strictEqual(statusFor(advanced.state, 'white_piece').expiry.remaining, 1);
  advanced = advanceStatuses(advanced.state, { actingSide: 'w', actedPieceId: 'white_piece', sideByPiece: { white_piece: 'w' } });
  assert.strictEqual(statusFor(advanced.state, 'white_piece'), null);
  assert.strictEqual(advanced.expired[0].id, 'marked');
});

test('permanent status view exposes clear duration information', () => {
  const state = applyPrimaryStatus(createStatusState(), 'piece_1', 'cursed', { sourceId: 'event_1' }).state;
  assert.deepStrictEqual(statusView(state, 'piece_1'), {
    id: 'cursed', visible: true, geometryChange: false,
    remaining: null, expiryKind: null, sourceId: 'event_1'
  });
});

test('battle status application emits explicit events and replacement event', () => {
  let state = createBattleState({
    battleId: 'apply-status', seed: 31,
    position: parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e2: 'pawn_w', e8: 'king_b' }
  });
  let result = applyBattleStatus(state, 'pawn_w', 'marked', { sourceId: 'hero_w' });
  state = result.state;
  assert.deepStrictEqual(result.events.map((event) => event.type), ['StatusApplied']);
  assert.strictEqual(result.events[0].payload.pieceId, 'pawn_w');
  result = applyBattleStatus(state, 'pawn_w', 'silenced', { replace: true, sourceId: 'relic_w' });
  assert.deepStrictEqual(result.events.map((event) => event.type), ['StatusRemoved', 'StatusApplied']);
  assert.strictEqual(statusFor(result.state.statuses, 'pawn_w').id, 'silenced');
});

test('bound piece has no move commands and direct execution is rejected', () => {
  let state = createBattleState({
    battleId: 'bound', seed: 32,
    position: parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e2: 'pawn_w', e8: 'king_b' }
  });
  state = applyBattleStatus(state, 'pawn_w', 'bound').state;
  assert.strictEqual(legalBattleCommands(state).some((command) => command.type === 'MovePiece' && command.payload.from === 'e2'), false);
  assert.throws(() => executeBattleCommand(state, move('e2', 'e3')), /bound and cannot move/);
});

test('bound expires after another action by the same side and emits expiration', () => {
  let state = createBattleState({
    battleId: 'bound-expiry', seed: 33,
    position: parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e2: 'pawn_w', e8: 'king_b' }
  });
  state = applyBattleStatus(state, 'pawn_w', 'bound').state;
  const result = executeBattleCommand(state, move('e1', 'd1'));
  assert.strictEqual(statusFor(result.state.statuses, 'pawn_w'), null);
  const expired = result.events.find((event) => event.type === 'StatusExpired');
  assert.strictEqual(expired.payload.pieceId, 'pawn_w');
  assert.strictEqual(expired.payload.statusId, 'bound');
});

test('captured piece status is removed with a deterministic event', () => {
  let state = createBattleState({
    battleId: 'status-capture', seed: 34,
    position: parseFen('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b', e4: 'pawn_w', d5: 'pawn_b' }
  });
  state = applyBattleStatus(state, 'pawn_b', 'cursed').state;
  const result = executeBattleCommand(state, move('e4', 'd5'));
  assert.strictEqual(statusFor(result.state.statuses, 'pawn_b'), null);
  const removed = result.events.find((event) => event.type === 'StatusRemoved');
  assert.strictEqual(removed.payload.pieceId, 'pawn_b');
  assert.strictEqual(removed.payload.reason, 'piece_captured');
});

test('promotion preserves status because identity is preserved', () => {
  let state = createBattleState({
    battleId: 'status-promotion', seed: 35,
    position: parseFen('7k/P7/8/8/8/8/8/7K w - - 0 1'),
    identitiesBySquare: { a7: 'hero_pawn', h1: 'king_w', h8: 'king_b' }
  });
  state = applyBattleStatus(state, 'hero_pawn', 'cursed').state;
  const result = executeBattleCommand(state, move('a7', 'a8', 'q'));
  assert.strictEqual(statusFor(result.state.statuses, 'hero_pawn').id, 'cursed');
});

test('status-bearing battle replay is deterministic', () => {
  const create = () => {
    let state = createBattleState({
      battleId: 'status-replay', seed: 36,
      position: parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'),
      identitiesBySquare: { e1: 'king_w', e2: 'pawn_w', e8: 'king_b' }
    });
    state = applyBattleStatus(state, 'pawn_w', 'marked', { expiry: { kind: 'side_actions', remaining: 2 } }).state;
    return state;
  };
  const commands = [move('e2', 'e4'), move('e8', 'd8'), move('e4', 'e5')];
  const first = replayBattle(create(), commands);
  const second = replayBattle(create(), commands);
  assert.deepStrictEqual(first.state.statuses, second.state.statuses);
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
console.log(`\nStatus system: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
