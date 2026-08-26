const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const mod = await import(pathToFileURL(path.resolve(__dirname, '../game/js/classic-chess-engine.mjs')).href);
  const { ClassicChessEngine } = mod;

  function play(engine, moves) {
    for (const entry of moves) {
      const [from, to, promotion] = entry;
      const result = engine.move(from, to, promotion);
      assert(result.ok, `expected ${from}-${to}${promotion || ''} to be legal: ${JSON.stringify(result)}`);
    }
  }

  function destinations(engine, square) {
    return engine.legalMoves(square).map((move) => `${move.to}${move.promotion || ''}`).sort();
  }

  function perft(fen, depth) {
    if (depth === 0) return 1;
    const engine = new ClassicChessEngine(fen);
    let nodes = 0;
    for (const move of engine.legalMoves()) {
      const child = new ClassicChessEngine(fen);
      const result = child.move(move.from, move.to, move.promotion || null);
      assert(result.ok, `perft move failed: ${move.from}-${move.to}`);
      nodes += perft(result.fen, depth - 1);
    }
    return nodes;
  }

  {
    const engine = new ClassicChessEngine();
    assert.strictEqual(engine.legalMoves().length, 20, 'initial position must have 20 legal moves');
    assert.deepStrictEqual(destinations(engine, 'e2'), ['e3', 'e4']);
    assert.deepStrictEqual(destinations(engine, 'g1'), ['f3', 'h3']);
    assert.strictEqual(perft(engine.fen(), 2), 400, 'initial perft(2) must equal 400');
    assert.strictEqual(perft(engine.fen(), 3), 8902, 'initial perft(3) must equal 8902');
  }

  {
    const kiwipete = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
    assert.strictEqual(perft(kiwipete, 1), 48, 'Kiwipete perft(1) must equal 48');
    assert.strictEqual(perft(kiwipete, 2), 2039, 'Kiwipete perft(2) must equal 2039');
  }

  {
    const endgame = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1';
    assert.strictEqual(perft(endgame, 3), 2812, 'canonical endgame perft(3) must equal 2812');
  }

  {
    const engine = new ClassicChessEngine('4k3/8/8/8/8/8/4r3/4K2R w K - 0 1');
    assert.strictEqual(engine.isCheck('w'), true, 'white must be in check');
    assert(!destinations(engine, 'h1').includes('h2'), 'unrelated rook move may not leave own king in check');
  }

  {
    const engine = new ClassicChessEngine('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    assert(destinations(engine, 'e1').includes('g1'), 'white king-side castling must be legal');
    assert(destinations(engine, 'e1').includes('c1'), 'white queen-side castling must be legal');
    const result = engine.move('e1', 'g1');
    assert(result.ok, 'castling move must execute');
    assert.deepStrictEqual(engine.pieceAt('g1'), { type: 'k', color: 'w' });
    assert.deepStrictEqual(engine.pieceAt('f1'), { type: 'r', color: 'w' });
    assert.strictEqual(engine.pieceAt('h1'), null);
  }

  {
    const engine = new ClassicChessEngine('r3k2r/8/8/8/2b5/8/8/R3K2R w KQkq - 0 1');
    assert(!destinations(engine, 'e1').includes('g1'), 'castling through attacked f1 must be illegal');
  }

  {
    const engine = new ClassicChessEngine();
    play(engine, [['e2', 'e4'], ['a7', 'a6'], ['e4', 'e5'], ['d7', 'd5']]);
    const ep = engine.legalMoves('e5').find((move) => move.to === 'd6');
    assert(ep?.enPassant, 'en passant must be generated');
    const result = engine.move('e5', 'd6');
    assert(result.ok && result.move.enPassant, 'en passant must execute');
    assert.strictEqual(engine.pieceAt('d5'), null, 'captured pawn must be removed');
    assert.deepStrictEqual(engine.pieceAt('d6'), { type: 'p', color: 'w' });
  }

  {
    const engine = new ClassicChessEngine('4r1k1/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    assert(!destinations(engine, 'e5').includes('d6'), 'pinned en passant exposing the king must be illegal');
  }

  {
    const engine = new ClassicChessEngine('7k/P7/8/8/8/8/8/7K w - - 0 1');
    const pending = engine.move('a7', 'a8');
    assert.strictEqual(pending.ok, false);
    assert.strictEqual(pending.reason, 'promotion_required');
    assert.deepStrictEqual(pending.choices, ['q', 'r', 'b', 'n']);
    const promoted = engine.move('a7', 'a8', 'n');
    assert(promoted.ok, 'promotion choice must execute');
    assert.deepStrictEqual(engine.pieceAt('a8'), { type: 'n', color: 'w' });
  }

  {
    const engine = new ClassicChessEngine();
    play(engine, [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]);
    const status = engine.status();
    assert.strictEqual(status.type, 'checkmate');
    assert.strictEqual(status.winner, 'b');
  }

  {
    const engine = new ClassicChessEngine('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    const status = engine.status();
    assert.strictEqual(status.type, 'stalemate');
    assert.strictEqual(status.winner, null);
  }

  {
    assert.strictEqual(new ClassicChessEngine('4k3/8/8/8/8/8/8/4K3 w - - 0 1').status().type, 'draw_insufficient');
    assert.strictEqual(new ClassicChessEngine('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1').status().type, 'draw_insufficient');
    assert.strictEqual(new ClassicChessEngine('4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1').status().type, 'draw_insufficient', 'same-color bishops only must be insufficient');
  }

  {
    const engine = new ClassicChessEngine('7k/8/8/8/8/8/2R5/K7 w - - 99 1');
    const result = engine.move('c2', 'c3');
    assert(result.ok);
    assert.strictEqual(engine.status().type, 'draw_50_move');
  }

  {
    const engine = new ClassicChessEngine();
    play(engine, [
      ['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8'],
      ['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']
    ]);
    assert.strictEqual(engine.status().type, 'draw_threefold');
  }

  {
    const engine = new ClassicChessEngine('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    assert(engine.move('h1', 'h2').ok);
    assert(engine.move('e8', 'e7').ok);
    assert(engine.move('h2', 'h1').ok);
    assert(!destinations(engine, 'e1').includes('g1'), 'castling rights must not return after rook comes home');
  }

  console.log('Classic Chess engine acceptance: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
