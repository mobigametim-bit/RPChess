const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const root = path.resolve(__dirname, '..');
  const buildScript = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
  assert(buildScript.includes("'js/skirmish-obstacles.mjs'"), 'production build must package the Skirmish obstacle runtime module');
  const obstacle = await import(pathToFileURL(path.join(root, 'game/js/skirmish-obstacles.mjs')).href);
  const engine = await import(pathToFileURL(path.join(root, 'game/js/classic-chess-engine.mjs')).href);
  const first = obstacle.generateSkirmishObstacles('obstacle-seed');
  // Exercise the actual renderer as a childList/subtree observer would: every
  // append/remove schedules another pass. Bound delivery so a regression fails
  // instead of hanging the test runner like it hangs a browser's paint loop.
  const vm = require('vm');
  const app = fs.readFileSync(path.join(root, 'game/js/skirmish-app.mjs'), 'utf8');
  const renderer = app.slice(app.indexOf('function renderObstacleProps()'), app.indexOf('function applyBoardArt()'));
  assert(app.includes('new MutationObserver(syncBattleFromChess).observe(board,{childList:true,subtree:true})'));
  let mutations = 0, pending = false;
  const changed = () => { mutations++; pending = true; };
  const cells = new Map();
  const makeImage = () => ({
    dataset: {}, attributes: {}, parentNode: null,
    getAttribute(name) { return this.attributes[name] ?? null; },
    setAttribute(name, value) { this.attributes[name] = value; },
    remove() { this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; changed(); }
  });
  const rebuild = () => {
    cells.clear();
    for (let i = 0; i < 64; i++) cells.set(engine.indexToSquare(i), {
      children: [],
      querySelectorAll() { return [...this.children]; },
      append(node) { node.parentNode = this; this.children.push(node); changed(); }
    });
    changed();
  };
  const board = {
    querySelectorAll(selector) { return selector === '.classic-board-obstacle' ? [...cells.values()].flatMap(cell => cell.children) : []; },
    querySelector(selector) { return cells.get(selector.match(/data-square="([a-h][1-8])"/)?.[1]) || null; }
  };
  const context = vm.createContext({ board, battlePlan: { obstacles: first }, document: { createElement: makeImage } });
  vm.runInContext(renderer, context);
  const settle = () => {
    let passes = 0;
    do { pending = false; context.renderObstacleProps(); passes++; } while (pending && passes < 10);
    assert(!pending, 'obstacle renderer must settle, not indefinitely retrigger its board observer');
    return passes;
  };
  rebuild();
  assert(settle() <= 2);
  const originalNodes = board.querySelectorAll('.classic-board-obstacle');
  const stable = mutations;
  settle();
  assert.strictEqual(mutations, stable, 'unchanged obstacles must not mutate the board');
  assert.deepStrictEqual(board.querySelectorAll('.classic-board-obstacle'), originalNodes, 'keep existing obstacle image nodes');
  rebuild(); settle();
  assert.strictEqual(board.querySelectorAll('.classic-board-obstacle').length, first.length, 'board rebuild after a move must restore obstacles');
  context.battlePlan = { obstacles: [{ ...first[0], asset: 'replacement.png' }] };
  settle();
  assert.strictEqual(board.querySelectorAll('.classic-board-obstacle').length, 1, 'remove stale obstacles');
  assert.strictEqual(board.querySelectorAll('.classic-board-obstacle')[0].getAttribute('src'), 'replacement.png');
  const duplicate = makeImage(); duplicate.dataset.skirmishObstacle = first[0].square;
  cells.get(first[0].square).append(duplicate); settle();
  assert.strictEqual(board.querySelectorAll('.classic-board-obstacle').length, 1, 'remove duplicate obstacle nodes');
  context.battlePlan = { obstacles: [] }; settle();
  assert.strictEqual(board.querySelectorAll('.classic-board-obstacle').length, 0);
  assert.deepStrictEqual(first, obstacle.generateSkirmishObstacles('obstacle-seed'), 'obstacles must be deterministic for a run seed');
  assert(first.length >= 1 && first.length <= 4, 'obstacle count must remain in the approved 1–4 range');
  assert.strictEqual(new Set(first.map((item) => item.square)).size, first.length, 'obstacle squares must not overlap');
  assert(first.every((item) => ['3', '4', '5', '6'].includes(item.square[1])), 'obstacles must only occupy ranks 3–6');
  const blocked = new engine.ClassicChessEngine('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1', { blockedSquares: ['e4'] });
  assert(!blocked.legalMoves('e2').some((move) => move.to === 'e4'), 'a rook may not land on an obstacle');
  assert(!blocked.legalMoves('e2').some((move) => move.to === 'e5'), 'a rook ray must stop at an obstacle');
  const knight = new engine.ClassicChessEngine('4k3/8/8/8/8/8/3N4/4K3 w - - 0 1', { blockedSquares: ['f3'] });
  assert(knight.legalMoves('d2').some((move) => move.to === 'f3') === false, 'a knight may not land on an obstacle');
  assert(knight.legalMoves('d2').some((move) => move.to === 'e4'), 'a knight may jump over an obstacle');
  console.log('Skirmish obstacle determinism and chess legality: PASS');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
