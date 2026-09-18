const fs = require('fs');
const path = require('path');
const { parsePng, optimizePngBuffer, formatBytes } = require('./piece-asset-runtime.cjs');

const BRAND_LOGO_FILES = Object.freeze([
  'generated_assets/logo_ru.png',
  'generated_assets/logo_en.png'
]);
const BRAND_LOGO_RUNTIME_MAX_SIDE = 832;
const BRAND_LOGO_RUNTIME_MAX_BYTES = 512 * 1024;
const BRAND_LOGO_RUNTIME_MAX_TOTAL_BYTES = 1024 * 1024;

function inspectBrandLogoAssets(root) {
  const records = BRAND_LOGO_FILES.map((relative) => {
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) throw new Error(`[brand logo asset contract] missing ${relative}`);
    const buffer = fs.readFileSync(full);
    const png = parsePng(buffer);
    return { path:relative, bytes:buffer.length, width:png.width, height:png.height, colorType:png.colorType };
  });
  return { count:records.length, totalBytes:records.reduce((sum, item) => sum + item.bytes, 0), records };
}

function assertBrandLogoAssetBudget(root, {
  maxSide = BRAND_LOGO_RUNTIME_MAX_SIDE,
  maxBytes = BRAND_LOGO_RUNTIME_MAX_BYTES,
  maxTotalBytes = BRAND_LOGO_RUNTIME_MAX_TOTAL_BYTES
} = {}) {
  const report = inspectBrandLogoAssets(root);
  const failures = [];
  for (const item of report.records) {
    if (item.width <= item.height) failures.push(`${item.path}: expected a landscape logo, got ${item.width}x${item.height}`);
    if (item.width > maxSide || item.height > maxSide) failures.push(`${item.path}: ${item.width}x${item.height} exceeds ${maxSide}px max side`);
    if (item.bytes > maxBytes) failures.push(`${item.path}: ${formatBytes(item.bytes)} exceeds ${formatBytes(maxBytes)}`);
    if (![3, 4, 6].includes(item.colorType)) failures.push(`${item.path}: expected transparent-capable PNG, colorType=${item.colorType}`);
  }
  if (report.totalBytes > maxTotalBytes) failures.push(`aggregate ${formatBytes(report.totalBytes)} exceeds ${formatBytes(maxTotalBytes)}`);
  if (failures.length) throw new Error(`[brand logo asset contract]\n${failures.join('\n')}`);
  return report;
}

function projectBrandLogoAssets(root, maxSide = BRAND_LOGO_RUNTIME_MAX_SIDE) {
  const source = inspectBrandLogoAssets(root);
  const records = source.records.map((item) => {
    const optimized = optimizePngBuffer(fs.readFileSync(path.join(root, item.path)), maxSide);
    return { ...item, afterBytes:optimized.buffer.length, afterWidth:optimized.width, afterHeight:optimized.height };
  });
  const afterBytes = records.reduce((sum, item) => sum + item.afterBytes, 0);
  return { count:records.length, beforeBytes:source.totalBytes, afterBytes, savedBytes:source.totalBytes - afterBytes, savedPercent:source.totalBytes ? (source.totalBytes - afterBytes) * 100 / source.totalBytes : 0, records };
}

module.exports = {
  BRAND_LOGO_FILES,
  BRAND_LOGO_RUNTIME_MAX_SIDE,
  BRAND_LOGO_RUNTIME_MAX_BYTES,
  BRAND_LOGO_RUNTIME_MAX_TOTAL_BYTES,
  inspectBrandLogoAssets,
  assertBrandLogoAssetBudget,
  projectBrandLogoAssets
};
