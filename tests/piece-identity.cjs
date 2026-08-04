const assert = require('assert');
const { parseFen } = require('../src/core/chess/position.cjs');
const { identityAt, metadataFor } = require('../src/combat/identity.cjs');
const { createBattleState, executeBattleCommand, replayBattle } = require('../src/combat/battle.cjs');

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const move = (from, to, promotion = null) => ({ type: 'MovePiece', payload: { from, to, promotion } });

test('automatic identity assignment is deterministic for battle and seed', () => {
  const create = () => createBattleState({ battleId: 'identity-seed', seed: 451, position: parseFen(START_FEN) });
  assert.deepStrictEqual(create().identities, create().identities);
  assert.notStrictEqual(identityAt(create().identities, 'e2'), identityAt(createBattleState({ battleId: 'other-battle', seed: 451, position: parseFen(START_FEN) }).identities, 'e2'));
});

test('provided identity and hero metadata are retained but cannot falsify board side/type', () => {
  const state = createBattleState({
    battleId: 'provided', seed: 1,
    position: parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'hero_king', e2: 'hero_pawn', e8: 'enemy_king' },
    identityMetadata: {
      hero_pawn: { name: 'Немея', namedHero: true, id: 'forged', side: 'b', initialType: 'p', currentType: 'q' }
    }
  });
  assert.strictEqual(identityAt(state.identities, 'e2'), 'hero_pawn');
  const metadata = metadataFor(state.identities, 'hero_pawn');
  assert.strictEqual(metadata.name, 'Немея');
  assert.strictEqual(metadata.namedHero, true);
  assert.strictEqual(metadata.id, 'hero_pawn');
  assert.strictEqual(metadata.side, 'w');
  assert.strictEqual(metadata.currentType, 'p');
});

test('ordinary movement transfers the same identity and event pieceId', () => {
  const state = createBattleState({
    battleId: 'move-id', seed: 2, position: parseFen(START_FEN),
    identitiesBySquare: { e2: 'pawn_e', e1: 'king_w', e8: 'king_b' }
  });
  const result = executeBattleCommand(state, move('e2', 'e4'));
  assert.strictEqual(identityAt(result.state.identities, 'e2'), null);
  assert.strictEqual(identityAt(result.state.identities, 'e4'), 'pawn_e');
  assert.strictEqual(result.events[0].payload.pieceId, 'pawn_e');
});

test('capture removes captured identity from active squares but preserves metadata history', () => {
  const state = createBattleState({
    battleId: 'capture-id', seed: 3,
    position: parseFen('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b', e4: 'white_pawn', d5: 'black_pawn' },
    identityMetadata: { black_pawn: { name: 'Павший дозорный' } }
  });
  const result = executeBattleCommand(state, move('e4', 'd5'));
  assert.strictEqual(identityAt(result.state.identities, 'd5'), 'white_pawn');
  assert.strictEqual(Object.values(result.state.identities.bySquare).includes('black_pawn'), false);
  assert.strictEqual(metadataFor(result.state.identities, 'black_pawn').name, 'Павший дозорный');
  const capture = result.events.find((event) => event.type === 'PieceCaptured');
  assert.strictEqual(capture.payload.capturedId, 'black_pawn');
  assert.strictEqual(capture.payload.byId, 'white_pawn');
});

test('en passant removes identity from the passed pawn square', () => {
  let state = createBattleState({
    battleId: 'ep-id', seed: 4,
    position: parseFen('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b', e5: 'white_pawn', d7: 'black_pawn' }
  });
  state = executeBattleCommand(state, move('d7', 'd5')).state;
  const result = executeBattleCommand(state, move('e5', 'd6'));
  assert.strictEqual(identityAt(result.state.identities, 'd5'), null);
  assert.strictEqual(identityAt(result.state.identities, 'd6'), 'white_pawn');
  const capture = result.events.find((event) => event.type === 'PieceCaptured');
  assert.strictEqual(capture.payload.capturedId, 'black_pawn');
  assert.strictEqual(capture.payload.square, 'd5');
  assert.strictEqual(capture.payload.enPassant, true);
});

test('castling moves both king and rook identities', () => {
  const state = createBattleState({
    battleId: 'castle-id', seed: 5,
    position: parseFen('4k3/8/8/8/8/8/8/4K2R w K - 0 1'),
    identitiesBySquare: { e1: 'king_w', h1: 'rook_w', e8: 'king_b' }
  });
  const result = executeBattleCommand(state, move('e1', 'g1'));
  assert.strictEqual(identityAt(result.state.identities, 'g1'), 'king_w');
  assert.strictEqual(identityAt(result.state.identities, 'f1'), 'rook_w');
  assert.strictEqual(identityAt(result.state.identities, 'h1'), null);
  const castle = result.events.find((event) => event.type === 'CastleCompleted');
  assert.strictEqual(castle.payload.kingId, 'king_w');
  assert.strictEqual(castle.payload.rookId, 'rook_w');
  assert.strictEqual(castle.payload.rookFrom, 'h1');
  assert.strictEqual(castle.payload.rookTo, 'f1');
});

test('promotion retains pawn identity and persistent metadata', () => {
  const state = createBattleState({
    battleId: 'promotion-id', seed: 6,
    position: parseFen('7k/P7/8/8/8/8/8/7K w - - 0 1'),
    identitiesBySquare: { a7: 'named_pawn', h1: 'king_w', h8: 'king_b' },
    identityMetadata: { named_pawn: { name: 'Немея', stars: 2, talentId: 'talent.patient_step' } }
  });
  const result = executeBattleCommand(state, move('a7', 'a8', 'n'));
  assert.strictEqual(identityAt(result.state.identities, 'a8'), 'named_pawn');
  const metadata = metadataFor(result.state.identities, 'named_pawn');
  assert.strictEqual(metadata.initialType, 'p');
  assert.strictEqual(metadata.currentType, 'n');
  assert.strictEqual(metadata.name, 'Немея');
  assert.strictEqual(metadata.stars, 2);
  assert.strictEqual(metadata.talentId, 'talent.patient_step');
  const promoted = result.events.find((event) => event.type === 'PawnPromoted');
  assert.strictEqual(promoted.payload.pieceId, 'named_pawn');
});

test('reserve deployment activates the reserve identity and metadata', () => {
  const state = createBattleState({
    battleId: 'reserve-id', seed: 7,
    position: parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1'),
    identitiesBySquare: { e1: 'king_w', e8: 'king_b' },
    orderPoints: { w: { current: 2, max: 5 }, b: { current: 0, max: 5 } },
    reserve: [{
      id: 'hero_rook', side: 'w', type: 'r', orderCost: 2,
      metadata: { name: 'Альдрик Стена', namedHero: true, stars: 1 }
    }],
    reserveCells: { w: ['a1'], b: [] }
  });
  const result = executeBattleCommand(state, { type: 'DeployReserve', payload: { entryId: 'hero_rook', square: 'a1' } });
  assert.strictEqual(identityAt(result.state.identities, 'a1'), 'hero_rook');
  const metadata = metadataFor(result.state.identities, 'hero_rook');
  assert.strictEqual(metadata.name, 'Альдрик Стена');
  assert.strictEqual(metadata.namedHero, true);
  assert.strictEqual(metadata.currentType, 'r');
  assert.strictEqual(result.events[0].payload.pieceId, 'hero_rook');
});

test('identity mapping and identity-bearing event log replay deterministically', () => {
  const commands = [move('e2', 'e4'), move('d7', 'd5'), move('e4', 'd5')];
  const create = () => createBattleState({
    battleId: 'identity-replay', seed: 808,
    position: parseFen(START_FEN),
    identitiesBySquare: { e2: 'hero_pawn', d7: 'enemy_pawn' },
    identityMetadata: { hero_pawn: { name: 'Саран', stars: 1 } }
  });
  const first = replayBattle(create(), commands);
  const second = replayBattle(create(), commands);
  assert.deepStrictEqual(first.state.identities, second.state.identities);
  assert.deepStrictEqual(first.events, second.events);
  assert.strictEqual(identityAt(first.state.identities, 'd5'), 'hero_pawn');
  assert.strictEqual(metadataFor(first.state.identities, 'hero_pawn').name, 'Саран');
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
console.log(`\nPiece identity: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
