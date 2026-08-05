'use strict';

const path = require('path');
const {
  planBoardAssetIntake,
  applyBoardAssetIntake
} = require('../src/assets/intake.cjs');

const args = new Set(process.argv.slice(2));
const projectRoot = path.resolve(__dirname, '..');
const plan = planBoardAssetIntake({ projectRoot });

if (args.has('--apply')) {
  const result = applyBoardAssetIntake(plan, { replace: args.has('--replace') });
  console.log(`[asset intake] copied ${result.copied.length} board-cell assets`);
}

const report = {
  expectedSize: plan.expectedSize,
  dropRoot: path.relative(projectRoot, plan.dropRoot).replace(/\\/g, '/'),
  runtimeRoot: path.relative(projectRoot, plan.runtimeRoot).replace(/\\/g, '/'),
  counts: plan.counts,
  blocking: plan.blocking.map((entry) => ({
    id: entry.id,
    state: entry.state,
    canonicalPath: entry.canonicalPath,
    stagingError: entry.staging.error || null,
    runtimeError: entry.runtime.error || null
  })),
  missingP0: plan.missingP0.map((entry) => entry.canonicalPath),
  ready: plan.ready.map((entry) => ({ id: entry.id, canonicalPath: entry.canonicalPath }))
};

console.log(JSON.stringify(report, null, 2));

if (plan.blocking.length > 0) process.exitCode = 1;
if (args.has('--strict') && plan.missingP0.length > 0) process.exitCode = 1;
