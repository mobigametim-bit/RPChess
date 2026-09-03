const fs = require('fs');
const path = require('path');
const { parsePng, optimizePngBuffer, formatBytes } = require('./piece-asset-runtime.cjs');

const PORTRAIT_RUNTIME_MAX_SIDE = 640;
const PORTRAIT_RUNTIME_MAX_BYTES = 1536 * 1024;
const PORTRAIT_RUNTIME_MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const PORTRAIT_RUNTIME_EXPECTED_COUNT = 37;

function collectPortraitAssetPaths(root) {
  const output = [];
  const heroes = path.join(root, 'assets/heroes');
  if (fs.existsSync(heroes)) {
    for (const entry of fs.readdirSync(heroes, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const relative = `assets/heroes/${entry.name}/portrait.png`;
      if (fs.existsSync(path.join(root, relative))) output.push(relative);
    }
  }
  const oathkeeper = 'assets/kings/oathkeeper/portrait.png';
  if (fs.existsSync(path.join(root, oathkeeper))) output.push(oathkeeper);
  return [...new Set(output)].sort();
}

function assertPortraitAssetBudget(root, {
  maxSide = PORTRAIT_RUNTIME_MAX_SIDE,
  maxBytes = PORTRAIT_RUNTIME_MAX_BYTES,
  maxTotalBytes = PORTRAIT_RUNTIME_MAX_TOTAL_BYTES,
  expectedCount = PORTRAIT_RUNTIME_EXPECTED_COUNT
} = {}) {
  const paths = collectPortraitAssetPaths(root);
  const failures = [];
  if (paths.length !== expectedCount) failures.push(`expected ${expectedCount} runtime portraits, found ${paths.length}`);
  let totalBytes = 0;
  let maxWidth = 0;
  let maxHeight = 0;
  for (const relative of paths) {
    const full = path.join(root, relative);
    const buffer = fs.readFileSync(full);
    const png = parsePng(buffer);
    totalBytes += buffer.length;
    maxWidth = Math.max(maxWidth, png.width);
    maxHeight = Math.max(maxHeight, png.height);
    if (png.width > maxSide || png.height > maxSide || buffer.length > maxBytes) {
      failures.push(`${relative}: ${png.width}x${png.height}, ${buffer.length} bytes (allowed <= ${maxSide}px side, <= ${maxBytes} bytes)`);
    }
  }
  if (totalBytes > maxTotalBytes) failures.push(`aggregate portrait payload ${totalBytes} bytes exceeds ${maxTotalBytes} bytes`);
  if (failures.length) throw new Error(`[portrait asset budget] runtime portraits exceed budget:\n${failures.join('\n')}`);
  return { count: paths.length, totalBytes, maxWidth, maxHeight };
}

function optimizePortraitAssets(root, {
  write = true,
  maxSide = PORTRAIT_RUNTIME_MAX_SIDE,
  maxBytes = PORTRAIT_RUNTIME_MAX_BYTES,
  maxTotalBytes = PORTRAIT_RUNTIME_MAX_TOTAL_BYTES,
  expectedCount = PORTRAIT_RUNTIME_EXPECTED_COUNT
} = {}) {
  const paths = collectPortraitAssetPaths(root);
  if (paths.length !== expectedCount) throw new Error(`[portrait asset budget] expected ${expectedCount} runtime portraits, found ${paths.length}`);
  const records = [];
  for (const relative of paths) {
    const full = path.join(root, relative);
    const source = fs.readFileSync(full);
    const before = source.length;
    const metadata = parsePng(source);
    const overDimensions = metadata.width > maxSide || metadata.height > maxSide;
    const overBytes = before > maxBytes;
    if (!overDimensions && !overBytes) {
      records.push({ path: relative, before, after: before, width: metadata.width, height: metadata.height, sourceWidth: metadata.width, sourceHeight: metadata.height, skipped: true });
      continue;
    }
    const optimized = optimizePngBuffer(source, maxSide);
    const canKeepSource = !overDimensions && optimized.buffer.length >= source.length;
    const output = canKeepSource ? source : optimized.buffer;
    const width = canKeepSource ? metadata.width : optimized.width;
    const height = canKeepSource ? metadata.height : optimized.height;
    if (output.length > maxBytes) throw new Error(`[portrait asset budget] optimizer produced oversized file ${relative}: ${output.length} bytes`);
    if (width > maxSide || height > maxSide) throw new Error(`[portrait asset budget] optimizer left oversized dimensions ${relative}: ${width}x${height}`);
    if (write) fs.writeFileSync(full, output);
    records.push({ path: relative, before, after: output.length, width, height, sourceWidth: metadata.width, sourceHeight: metadata.height, skipped: canKeepSource });
  }
  const beforeBytes = records.reduce((sum, item) => sum + item.before, 0);
  const afterBytes = records.reduce((sum, item) => sum + item.after, 0);
  if (afterBytes > maxTotalBytes) throw new Error(`[portrait asset budget] optimized aggregate ${afterBytes} bytes exceeds ${maxTotalBytes} bytes`);
  const savedBytes = beforeBytes - afterBytes;
  const report = {
    count: records.length,
    beforeBytes,
    afterBytes,
    savedBytes,
    savedPercent: beforeBytes ? (savedBytes / beforeBytes) * 100 : 0,
    records
  };
  if (write) assertPortraitAssetBudget(root, { maxSide, maxBytes, maxTotalBytes, expectedCount });
  return report;
}

module.exports = {
  PORTRAIT_RUNTIME_MAX_SIDE,
  PORTRAIT_RUNTIME_MAX_BYTES,
  PORTRAIT_RUNTIME_MAX_TOTAL_BYTES,
  PORTRAIT_RUNTIME_EXPECTED_COUNT,
  collectPortraitAssetPaths,
  optimizePortraitAssets,
  assertPortraitAssetBudget,
  formatBytes
};
