'use strict';

const { MAX_GENERATION_ATTEMPTS, freezeArray, deepFreeze } = require('./production-map-contract.cjs');
const { buildCandidate } = require('./production-map-topology.cjs');
const { validateProductionActGraph } = require('./production-map-validation.cjs');

function normalizeReport(report) {
  if (report === true) return deepFreeze({ ok: true, errors: [] });
  if (report === false) return deepFreeze({ ok: false, errors: ['candidate rejected by validator'] });
  if (!report || typeof report.ok !== 'boolean') throw new Error('candidate validator must return a boolean or { ok, errors }');
  return deepFreeze({ ok: report.ok, errors: freezeArray(report.errors || []) });
}
function reserveProductionActGraph(options = {}, attempts = []) {
  const fallback = buildCandidate(options, MAX_GENERATION_ATTEMPTS - 1, true);
  const report = validateProductionActGraph(fallback);
  if (!report.ok) throw new Error(`prevalidated reserve map is invalid: ${report.errors.join('; ')}`);
  return deepFreeze({ ...fallback, fallbackUsed: true, generationLog: freezeArray(attempts) });
}
function generateProductionActGraph(options = {}) {
  const attempts = [];
  const validator = typeof options.validateCandidate === 'function' ? options.validateCandidate : validateProductionActGraph;
  for (let attemptIndex = 0; attemptIndex < MAX_GENERATION_ATTEMPTS; attemptIndex += 1) {
    const graph = buildCandidate(options, attemptIndex, false);
    const report = normalizeReport(validator(graph, attemptIndex));
    attempts.push(deepFreeze({ attemptIndex, attemptSeed: graph.attemptSeed, generatorVersion: graph.generatorVersion, macroTemplateId: graph.macroTemplateId, isMirrored: graph.isMirrored, errors: report.errors }));
    if (report.ok) return deepFreeze({ ...graph, generationLog: freezeArray(attempts) });
  }
  return reserveProductionActGraph(options, attempts);
}
function generationAnalytics(graphs = []) {
  const values = Array.from(graphs);
  const fallbackCount = values.filter((graph) => graph.fallbackUsed).length;
  const totalAttempts = values.reduce((sum, graph) => sum + (graph.generationLog?.length || 0), 0);
  return deepFreeze({
    graphCount: values.length,
    fallbackCount,
    fallbackRate: values.length ? fallbackCount / values.length : 0,
    averageAttempts: values.length ? totalAttempts / values.length : 0,
    retryCount: values.reduce((sum, graph) => sum + Math.max(0, (graph.generationLog?.length || 1) - 1), 0)
  });
}

module.exports = { normalizeReport, reserveProductionActGraph, generateProductionActGraph, generationAnalytics };
