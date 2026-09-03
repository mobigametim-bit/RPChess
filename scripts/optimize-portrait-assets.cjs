const path = require('path');
const {
  optimizePortraitAssets,
  assertPortraitAssetBudget,
  formatBytes,
  PORTRAIT_RUNTIME_MAX_SIDE,
  PORTRAIT_RUNTIME_MAX_BYTES,
  PORTRAIT_RUNTIME_MAX_TOTAL_BYTES,
  PORTRAIT_RUNTIME_EXPECTED_COUNT
} = require('./portrait-asset-runtime.cjs');

const args = process.argv.slice(2);
const rootArg = args.indexOf('--root');
const root = path.resolve(rootArg >= 0 && args[rootArg + 1] ? args[rootArg + 1] : 'game');
const write = args.includes('--write');
const verifyOnly = args.includes('--verify-only');

if (verifyOnly) {
  const budget = assertPortraitAssetBudget(root);
  console.log(`Portrait asset budget PASS: ${budget.count}/${PORTRAIT_RUNTIME_EXPECTED_COUNT}, <=${PORTRAIT_RUNTIME_MAX_SIDE}px, <=${formatBytes(PORTRAIT_RUNTIME_MAX_BYTES)} each, <=${formatBytes(PORTRAIT_RUNTIME_MAX_TOTAL_BYTES)} aggregate`);
  process.exit(0);
}

const report = optimizePortraitAssets(root, { write });
console.log(`Portrait assets: ${report.count}`);
console.log(`Before: ${formatBytes(report.beforeBytes)}`);
console.log(`${write ? 'After' : 'Projected'}: ${formatBytes(report.afterBytes)}`);
console.log(`Saved: ${formatBytes(report.savedBytes)} (${report.savedPercent.toFixed(1)}%)`);
for (const item of report.records.filter((item) => !item.skipped).sort((a, b) => (b.before - b.after) - (a.before - a.after)).slice(0, 20)) {
  console.log(`${item.path}: ${item.sourceWidth}x${item.sourceHeight} ${formatBytes(item.before)} -> ${item.width}x${item.height} ${formatBytes(item.after)}`);
}
if (write) assertPortraitAssetBudget(root);
