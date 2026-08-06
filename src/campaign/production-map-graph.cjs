'use strict';

const { MAX_GENERATION_ATTEMPTS, freezeArray, deepFreeze } = require('./production-map-contract.cjs');
const { buildCandidate } = require('./production-map-topology.cjs');
const { validateProductionActGraph } = require('./production-map-validation.cjs');

function generateProductionActGraph(options = {}) {
  const attempts = [];
  for (let attemptIndex = 0; attemptIndex < MAX_GENERATION_ATTEMPTS; attemptIndex += 1) {
    const graph = buildCandidate(options, attemptIndex, false);
    const report = validateProductionActGraph(graph);
    attempts.push(deepFreeze({ attemptIndex, attemptSeed: graph.attemptSeed, errors: report.errors }));
    if (report.ok) return deepFreeze({ ...graph, generationLog: freezeArray(attempts) });
  }
  const fallback = buildCandidate(options, MAX_GENERATION_ATTEMPTS - 1, true);
  const report = validateProductionActGraph(fallback);
  if (!report.ok) throw new Error(`prevalidated reserve map is invalid: ${report.errors.join('; ')}`);
  return deepFreeze({ ...fallback, fallbackUsed: true, generationLog: freezeArray(attempts) });
}

module.exports = { generateProductionActGraph };
