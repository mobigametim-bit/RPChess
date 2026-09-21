const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parsePng } = require('../scripts/piece-asset-runtime.cjs');
const { pathToFileURL } = require('url');

(async () => {
  const root = path.resolve(__dirname, '..');
  const obstacles = [];
  for (const region of fs.readdirSync(path.join(root, 'game/assets/boards/obstacles')).sort()) {
    const directory = path.join(root, 'game/assets/boards/obstacles', region);
    for (const file of fs.readdirSync(directory).filter((name) => /^obstacle_\d\d\.png$/.test(name)).sort()) obstacles.push(path.join(directory, file));
  }
  const obstacleRuntime = await import(`${pathToFileURL(path.join(root, 'game/js/skirmish-obstacles.mjs')).href}?test=${Date.now()}`);
  assert.strictEqual(obstacles.length, 31, 'only the 31 green audit candidates may remain');
  assert.strictEqual(obstacleRuntime.OBSTACLE_PROP_PATHS.length, 31, 'runtime pool must contain every remaining source obstacle');
  const sourcePaths = obstacles.map((file) => path.relative(path.join(root, 'game'), file).split(path.sep).join('/')).sort();
  assert.deepStrictEqual([...obstacleRuntime.OBSTACLE_PROP_PATHS].sort(), sourcePaths, 'Skirmish must never reference a removed obstacle source');
  let bytes = 0;
  for (const file of obstacles) {
    const buffer = fs.readFileSync(file);
    const png = parsePng(buffer);
    assert.strictEqual(png.width, 256, `${file} must be a 256px runtime prop`);
    assert.strictEqual(png.height, 256, `${file} must be a 256px runtime prop`);
    assert([3, 4, 6].includes(png.colorType), `${file} must preserve transparent-capable PNG data`);
    bytes += buffer.length;
  }
  assert(bytes <= 10 * 1024 * 1024, 'the complete obstacle pool must stay within the 10 MiB runtime budget');
  console.log(`Skirmish obstacle audit pool: PASS — ${obstacles.length} green source slices remain`);
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
