const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parsePng } = require('../scripts/piece-asset-runtime.cjs');

const root = path.resolve(__dirname, '..');
const obstacles = [];
for (const region of fs.readdirSync(path.join(root, 'game/assets/boards/obstacles')).sort()) {
  const directory = path.join(root, 'game/assets/boards/obstacles', region);
  for (const file of fs.readdirSync(directory).filter((name) => /^obstacle_\d\d\.png$/.test(name)).sort()) obstacles.push(path.join(directory, file));
}
assert.strictEqual(obstacles.length, 128, 'eight regional sheets must yield 128 obstacle props');
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
console.log('Skirmish obstacle source slicing and runtime asset budget: PASS');
