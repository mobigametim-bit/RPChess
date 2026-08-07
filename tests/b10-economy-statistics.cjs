'use strict';

const assert = require('assert');
const { ECONOMY_STRATEGIES, simulateProductionEconomyCorpus } = require('../src/runtime/production-economy-simulation.cjs');

const report = simulateProductionEconomyCorpus({ seeds: 1500, strategies: ECONOMY_STRATEGIES });
assert.ok(report.totalRuns >= 10000, `expected at least 10,000 simulated acts, got ${report.totalRuns}`);
for (const [strategy, stats] of Object.entries(report.strategies)) {
  assert.strictEqual(stats.softLocks, 0, `${strategy} produced an economic soft-lock`);
  assert.ok(stats.medianRouteCost >= 8 && stats.medianRouteCost <= 10, `${strategy} route cost ${stats.medianRouteCost} outside 8–10`);
  assert.ok(stats.medianForcedMarches >= 0);
  assert.ok(stats.medianPurchases >= 0);
}
const balanced = report.strategies.balanced;
assert.ok(balanced.medianSuppliesEarned >= 2 && balanced.medianSuppliesEarned <= 4, `balanced supply replenishment ${balanced.medianSuppliesEarned} outside 2–4`);
assert.ok(balanced.medianGoldEarned >= 100 && balanced.medianGoldEarned <= 160, `balanced gold income ${balanced.medianGoldEarned} outside 100–160`);
assert.ok(report.strategies.secret.secretVisitRate > 0.05 && report.strategies.secret.secretVisitRate < 0.8);

console.log(JSON.stringify(report, null, 2));
console.log('B10 economy statistics: 10,000+ acts, strategy corpus, target route/supply/gold bands and no soft-locks passed.');
