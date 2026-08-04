const assert = require('assert');
const {
  squareToIndex,
  indexToSquare,
  parseFen,
  toFen,
  findKing
} = require('../src/core/chess/position.cjs');
const {
  isSquareAttacked,
  isInCheck,
  generateLegalMoves,
  makeMove,
  gameStatus,
  perft
} = require('../src/core/chess/rules.cjs');

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const moveNames = (position) => generateLegalMoves(position).map((move) => `${indexToSquare(move.from)}${indexToSquare(move.to)}${move.promotion || ''}`).sort();

function play(fen, moves) {
  let position = parseFen(fen);
  for (const move of moves) position = makeMove(position, move).position;
  return position;
}

test('square conversion and FEN round trip are stable', () => {
  assert.strictEqual(squareToIndex('a8'), 0);
  assert.strictEqual(squareToIndex('h1'), 63);
  assert.strictEqual(indexToSquare(squareToIndex('e4')), 'e4');
  assert.strictEqual(toFen(parseFen(START_FEN)), START_FEN);
});

test('initial position perft matches standard reference values', () => {
  const position = parseFen(START_FEN);
  assert.strictEqual(perft(position, 1), 20);
  assert.strictEqual(perft(position, 2), 400);
  assert.strictEqual(perft(position, 3), 8902);
});

test('kiwipete position exercises castling, pins and captures', () => {
  const position = parseFen('r3k2r/p1ppqpb1/bn2pnp1/2pP4/1p2P3/2N2N2/PPQBBPPP/R3K2R w KQkq - 0 1');
  const names = moveNames(position);
  if (names.length !== 48) console.log('KIWIPETE MOVES', JSON.stringify(names));
  assert.strictEqual(names.length, 48);
  assert.strictEqual(perft(position, 2), 2039);
});

test('pinned rook cannot expose its king', () => {
  const position = parseFen('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1');
  const moves = moveNames(position);
  assert.strictEqual(moves.includes('e2d2'), false);
  assert.strictEqual(moves.includes('e2e8'), true);
});

test('check detection uses real attack geometry', () => {
  const position = parseFen('4k3/8/8/8/1b6/8/8/4K3 w - - 0 1');
  assert.strictEqual(isInCheck(position, 'w'), true);
  assert.strictEqual(isSquareAttacked(position, 'e1', 'b'), true);
  assert.strictEqual(isInCheck(position, 'b'), false);
});

test('fools mate is recognized as checkmate', () => {
  const position = play(START_FEN, [
    { from: 'f2', to: 'f3' },
    { from: 'e7', to: 'e5' },
    { from: 'g2', to: 'g4' },
    { from: 'd8', to: 'h4' }
  ]);
  const status = gameStatus(position);
  assert.strictEqual(status.state, 'checkmate');
  assert.strictEqual(status.winner, 'b');
  assert.strictEqual(status.legalMoves, 0);
});

test('known position is recognized as stalemate', () => {
  const position = parseFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  const status = gameStatus(position);
  assert.strictEqual(status.state, 'stalemate');
  assert.strictEqual(status.check, false);
  assert.strictEqual(status.winner, null);
});

test('castling is generated and moves the rook', () => {
  const position = parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const names = moveNames(position);
  assert.strictEqual(names.includes('e1g1'), true);
  assert.strictEqual(names.includes('e1c1'), true);
  const next = makeMove(position, { from: 'e1', to: 'g1' }).position;
  assert.strictEqual(next.board[squareToIndex('g1')].type, 'k');
  assert.strictEqual(next.board[squareToIndex('f1')].type, 'r');
  assert.strictEqual(next.board[squareToIndex('h1')], null);
  assert.strictEqual(next.castling, 'kq');
});

test('castling through attack is illegal', () => {
  const position = parseFen('r3k2r/8/8/8/2b5/8/8/R3K2R w KQkq - 0 1');
  const names = moveNames(position);
  assert.strictEqual(names.includes('e1g1'), false);
  assert.strictEqual(names.includes('e1c1'), true);
});

test('rook movement and rook capture remove castling rights', () => {
  const moved = makeMove(parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), { from: 'h1', to: 'h2' }).position;
  assert.strictEqual(moved.castling, 'Qkq');
  const captured = makeMove(parseFen('r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1'), { from: 'g2', to: 'h1' }).position;
  assert.strictEqual(captured.castling, 'Qkq');
});

test('en passant capture is legal and removes the passed pawn', () => {
  const position = play(START_FEN, [
    { from: 'e2', to: 'e4' },
    { from: 'a7', to: 'a6' },
    { from: 'e4', to: 'e5' },
    { from: 'd7', to: 'd5' }
  ]);
  assert.strictEqual(indexToSquare(position.enPassant), 'd6');
  assert.strictEqual(moveNames(position).includes('e5d6'), true);
  const next = makeMove(position, { from: 'e5', to: 'd6' }).position;
  assert.strictEqual(next.board[squareToIndex('d5')], null);
  assert.strictEqual(next.board[squareToIndex('d6')].type, 'p');
});

test('en passant is rejected when it exposes own king', () => {
  const position = parseFen('4r1k1/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  assert.strictEqual(moveNames(position).includes('e5d6'), false);
});

test('promotion exposes all four standard choices and preserves side', () => {
  const position = parseFen('7k/P7/8/8/8/8/8/7K w - - 0 1');
  const promotions = moveNames(position).filter((name) => name.startsWith('a7a8'));
  assert.deepStrictEqual(promotions, ['a7a8b', 'a7a8n', 'a7a8q', 'a7a8r']);
  const next = makeMove(position, { from: 'a7', to: 'a8', promotion: 'n' }).position;
  assert.deepStrictEqual(next.board[squareToIndex('a8')], { side: 'w', type: 'n' });
});

test('illegal move that leaves king in check is rejected', () => {
  const position = parseFen('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1');
  assert.throws(() => makeMove(position, { from: 'e2', to: 'd2' }), /illegal move/);
});

test('king capture is never generated as a legal move', () => {
  const position = parseFen('4k3/4Q3/8/8/8/8/8/4K3 b - - 0 1');
  const whiteKing = findKing(position, 'w');
  const blackMoves = generateLegalMoves(position);
  assert.strictEqual(blackMoves.some((move) => move.to === whiteKing), false);
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
console.log(`\nLegal chess core: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
