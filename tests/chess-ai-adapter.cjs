const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

class FakeWorker {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.commands = [];
    this.onmessage = null;
    this.onerror = null;
    this.terminated = false;
    FakeWorker.instances.push(this);
  }
  emit(data) { queueMicrotask(() => this.onmessage?.({ data })); }
  postMessage(command) {
    this.commands.push(command);
    if (command === 'uci') this.emit('uciok');
    if (command === 'isready') this.emit('readyok');
    if (command.startsWith('go ')) {
      this.emit('info depth 6 multipv 1 score cp 28 pv e7e5 g1f3');
      this.emit('info depth 6 multipv 2 score cp 19 pv c7c5 g1f3');
      this.emit('info depth 6 multipv 3 score cp 10 pv g8f6 e2e4');
      this.emit('bestmove e7e5 ponder g1f3');
    }
  }
  terminate() { this.terminated = true; }
}

function rngFrom(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

(async () => {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, '../game/js/chess-ai-adapter.mjs')).href;
  const { ChessAIAdapter, ELO_LEVELS, profileForElo, clampElo, moveToUci } = await import(moduleUrl);

  assert.deepStrictEqual(ELO_LEVELS.map((entry) => entry.elo), [400,600,800,1000,1200,1400,1600,1800,2000,2200,2400,2600]);
  assert.strictEqual(clampElo(755), 800);
  assert.strictEqual(profileForElo(2400).label, 'Очень сильный');
  assert.strictEqual(moveToUci({ from: 'a7', to: 'a8', promotion: 'q' }), 'a7a8q');

  FakeWorker.instances.length = 0;
  const high = new ChessAIAdapter({ WorkerClass: FakeWorker, rng: () => 0.5, timeoutMs: 500 });
  const best = await high.chooseMove({
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    elo: 2000,
    legalMoves: ['e7e5', 'c7c5', 'g8f6']
  });
  assert.strictEqual(best, 'e7e5', 'high Elo must use Stockfish bestmove');
  const highCommands = FakeWorker.instances[0].commands;
  assert(highCommands.includes('setoption name UCI_LimitStrength value true'));
  assert(highCommands.includes('setoption name UCI_Elo value 2000'));
  assert(highCommands.includes('setoption name MultiPV value 1'));
  assert(highCommands.some((command) => command.startsWith('position fen ')));

  const low = new ChessAIAdapter({ WorkerClass: FakeWorker, rng: rngFrom([0.9, 0.99]), timeoutMs: 500 });
  const weakened = await low.chooseMove({
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    elo: 400,
    legalMoves: ['e7e5', 'c7c5', 'g8f6']
  });
  assert.strictEqual(weakened, 'g8f6', '400 Elo profile must be able to choose a weaker MultiPV candidate deterministically');
  const lowCommands = FakeWorker.instances.at(-1).commands;
  assert(lowCommands.includes('setoption name UCI_Elo value 1320'), 'sub-1320 profile must clamp native Stockfish Elo');
  assert(lowCommands.includes('setoption name MultiPV value 8'));

  const randomLow = new ChessAIAdapter({ WorkerClass: FakeWorker, rng: rngFrom([0, 0.8]), timeoutMs: 500 });
  const randomMove = await randomLow.chooseMove({ fen: '8/8/8/8/8/8/8/8 w - - 0 1', elo: 400, legalMoves: ['a2a3', 'b2b3', 'c2c3'] });
  assert.strictEqual(randomMove, 'c2c3', 'novice profile must support controlled random legal moves');

  class BrokenWorker { constructor() { throw new Error('worker unavailable'); } }
  const fallback = new ChessAIAdapter({ WorkerClass: BrokenWorker, timeoutMs: 50 });
  const fallbackMove = await fallback.chooseMove({ fen: '8/8/8/8/8/8/8/8 w - - 0 1', elo: 800, legalMoves: ['a2a3', 'b2b3'] });
  assert.strictEqual(fallbackMove, 'a2a3', 'adapter must preserve legality in degraded fallback');
  assert.strictEqual(fallback.snapshot().degraded, true);

  high.destroy(); low.destroy(); randomLow.destroy(); fallback.destroy();
  console.log('Chess AI adapter deterministic contract: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
