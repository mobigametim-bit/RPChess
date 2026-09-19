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
