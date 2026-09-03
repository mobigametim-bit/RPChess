const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const pieceRuntime = require('../scripts/piece-asset-runtime.cjs');
const portraitRuntime = require('../scripts/portrait-asset-runtime.cjs');

function fixturePng(side) {
  const rgba = Buffer.alloc(side * side * 4);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const i = (y * side + x) * 4;
      rgba[i] = (x * 7 + y * 3) % 256;
      rgba[i + 1] = (x * 5 + y * 11) % 256;
      rgba[i + 2] = (x + y * 13) % 256;
      rgba[i + 3] = 255;
    }
  }
  return pieceRuntime.encodeRgbaPng(side, side, rgba);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rpchess-portrait-budget-'));
const largeRelative = 'assets/kings/oathkeeper/portrait.png';
const smallRelative = 'assets/heroes/test/portrait.png';
for (const [relative, png] of [[largeRelative, fixturePng(768)], [smallRelative, fixturePng(320)]]) {
  const full = path.join(tmp, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, png);
}

const smallBefore = fs.readFileSync(path.join(tmp, smallRelative));
const report = portraitRuntime.optimizePortraitAssets(tmp, { expectedCount: 2 });
assert.strictEqual(report.count, 2);
const largeAfter = pieceRuntime.parsePng(fs.readFileSync(path.join(tmp, largeRelative)));
assert.strictEqual(largeAfter.width, portraitRuntime.PORTRAIT_RUNTIME_MAX_SIDE);
assert.strictEqual(largeAfter.height, portraitRuntime.PORTRAIT_RUNTIME_MAX_SIDE);
const smallAfter = fs.readFileSync(path.join(tmp, smallRelative));
assert(smallAfter.equals(smallBefore), 'portrait optimizer must not upscale or rewrite already-budgeted small portraits');
portraitRuntime.assertPortraitAssetBudget(tmp, { expectedCount: 2 });
assert.throws(() => portraitRuntime.assertPortraitAssetBudget(tmp, { expectedCount: 3 }), /expected 3 runtime portraits/);
assert.throws(() => portraitRuntime.assertPortraitAssetBudget(tmp, { expectedCount: 2, maxSide: 512 }), /portrait asset budget/);
console.log(`Portrait asset runtime optimizer: PASS (${report.count} fixtures; 768px fixture capped to ${portraitRuntime.PORTRAIT_RUNTIME_MAX_SIDE}px; small fixture preserved)`);
