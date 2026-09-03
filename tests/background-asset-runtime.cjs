const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  BACKGROUND_RUNTIME_EXPECTED_COUNT,
  BACKGROUND_RUNTIME_WIDTH,
  BACKGROUND_RUNTIME_HEIGHT,
  BACKGROUND_RUNTIME_MAX_TOTAL_BYTES,
  collectBackgroundAssetPaths,
  inspectBackgroundAssets
} = require('../scripts/background-asset-runtime.cjs');

const root = path.resolve(__dirname, '..', 'game');
const paths = collectBackgroundAssetPaths(root);
assert.strictEqual(paths.length, BACKGROUND_RUNTIME_EXPECTED_COUNT, 'canonical background count must stay fail-closed');
assert.strictEqual(paths.length, 36, 'runtime uses exactly 36 approved Event/cross-scene backgrounds');
assert(!paths.some((relative) => relative.includes('/merfolk/')), 'unused Merfolk backgrounds must not enter the runtime optimization budget');

const source = inspectBackgroundAssets(root);
assert.strictEqual(source.count, 36, 'source inspection must cover the canonical runtime set only');
assert(source.totalBytes > BACKGROUND_RUNTIME_MAX_TOTAL_BYTES, 'master payload should remain larger than the runtime budget; build optimization must not rewrite masters');
for (const record of source.records) {
  assert(record.width >= BACKGROUND_RUNTIME_WIDTH, `${record.path} must not be smaller than runtime width`);
  assert(record.height >= BACKGROUND_RUNTIME_HEIGHT, `${record.path} must not be smaller than runtime height`);
  const ratio = record.width / record.height;
  assert(Math.abs(ratio - (16 / 9)) < 0.01, `${record.path} must remain a 16:9 background`);
}

const implementation = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'background-asset-runtime.cjs'), 'utf8');
assert(implementation.includes('BACKGROUND_RUNTIME_CHANNEL_BITS = 6'), 'runtime background quantization must remain on the accepted 6-bit probe');
assert(implementation.includes('colorType !== 2'), 'runtime budget must enforce opaque RGB PNG output');
assert(implementation.includes('assertBackgroundAssetBudget'), 'runtime background budget must fail closed after build transformation');

console.log(`background-asset-runtime: PASS (${source.count} masters, ${(source.totalBytes / 1024 / 1024).toFixed(2)} MiB source payload)`);
