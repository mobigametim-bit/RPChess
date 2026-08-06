'use strict';

const { hash32, XorShift32 } = require('../core/determinism.cjs');
const { deepFreeze, freezeArray } = require('./production-map-contract.cjs');

const FACTOR_KEYS = Object.freeze(['region', 'phase', 'danger', 'branchProfile', 'board', 'objective', 'environment']);
const SCENARIO_CANDIDATE_FORMAT = 'rpchess-production-scenario-candidate';

function stringArray(value) {
  return freezeArray(Array.isArray(value) ? value.map(String) : value == null ? [] : [String(value)]);
}
function normalizeScenarioCandidate(input) {
  if (input?.format === SCENARIO_CANDIDATE_FORMAT && input.schemaVersion === 1) return input;
  if (!input || typeof input !== 'object') throw new Error('scenario candidate must be an object');
  const id = String(input.id || input.scenarioId || '');
  if (!id) throw new Error('scenario candidate requires id');
  const baseWeight = Number(input.baseWeight ?? 1);
  if (!(baseWeight >= 0)) throw new Error(`${id} baseWeight must be non-negative`);
  const danger = input.danger || {};
  const factorWeights = {};
  for (const key of FACTOR_KEYS) factorWeights[key] = deepFreeze({ ...(input.factorWeights?.[key] || {}) });
  return deepFreeze({
    format: SCENARIO_CANDIDATE_FORMAT,
    schemaVersion: 1,
    id,
    baseWeight,
    regionIds: stringArray(input.regionIds),
    phases: stringArray(input.phases),
    branchProfiles: stringArray(input.branchProfiles),
    boardIds: stringArray(input.boardIds),
    objectiveIds: stringArray(input.objectiveIds),
    environmentIds: stringArray(input.environmentIds),
    minimumDanger: Number.isFinite(danger.minimum) ? Number(danger.minimum) : 0,
    maximumDanger: Number.isFinite(danger.maximum) ? Number(danger.maximum) : Number.MAX_SAFE_INTEGER,
    requiredFacts: stringArray(input.requiredFacts),
    excludedFacts: stringArray(input.excludedFacts),
    incompatibleScenarioIds: stringArray(input.incompatibleScenarioIds),
    factorWeights: deepFreeze(factorWeights),
    optionalObjectiveRequirements: deepFreeze({ ...(input.optionalObjectiveRequirements || {}) }),
    metadata: deepFreeze({ ...(input.metadata || {}) })
  });
}
function factorValue(context, key) {
  if (key === 'region') return context.regionId;
  if (key === 'phase') return context.phase;
  if (key === 'danger') return String(context.danger);
  if (key === 'branchProfile') return context.branchProfile;
  if (key === 'board') return context.boardId;
  if (key === 'objective') return context.objectiveId;
  if (key === 'environment') return context.environmentId;
  return null;
}
function matchesRestriction(values, value) {
  return !values.length || value == null || values.includes(String(value));
}
function scenarioEligibility(candidateInput, context = {}) {
  const candidate = normalizeScenarioCandidate(candidateInput);
  const facts = new Set(context.storyFacts || context.flags || []);
  const excluded = new Set(context.excludedScenarioIds || []);
  const adjacent = new Set(context.adjacentScenarioIds || []);
  if (excluded.has(candidate.id) || adjacent.has(candidate.id)) return deepFreeze({ eligible: false, reason: 'exact_repeat' });
  if (candidate.incompatibleScenarioIds.some((id) => excluded.has(id) || adjacent.has(id))) return deepFreeze({ eligible: false, reason: 'scenario_incompatibility' });
  if (!matchesRestriction(candidate.regionIds, context.regionId)) return deepFreeze({ eligible: false, reason: 'region' });
  if (!matchesRestriction(candidate.phases, context.phase)) return deepFreeze({ eligible: false, reason: 'phase' });
  if (!matchesRestriction(candidate.branchProfiles, context.branchProfile)) return deepFreeze({ eligible: false, reason: 'branch_profile' });
  if (!matchesRestriction(candidate.boardIds, context.boardId)) return deepFreeze({ eligible: false, reason: 'board' });
  if (!matchesRestriction(candidate.objectiveIds, context.objectiveId)) return deepFreeze({ eligible: false, reason: 'objective' });
  if (!matchesRestriction(candidate.environmentIds, context.environmentId)) return deepFreeze({ eligible: false, reason: 'environment' });
  if (Number(context.danger || 0) < candidate.minimumDanger || Number(context.danger || 0) > candidate.maximumDanger) return deepFreeze({ eligible: false, reason: 'danger' });
  if (candidate.requiredFacts.some((fact) => !facts.has(fact))) return deepFreeze({ eligible: false, reason: 'required_fact' });
  if (candidate.excludedFacts.some((fact) => facts.has(fact))) return deepFreeze({ eligible: false, reason: 'excluded_fact' });
  return deepFreeze({ eligible: candidate.baseWeight > 0, reason: candidate.baseWeight > 0 ? null : 'zero_weight' });
}
function scenarioWeight(candidateInput, context = {}) {
  const candidate = normalizeScenarioCandidate(candidateInput);
  const eligibility = scenarioEligibility(candidate, context);
  if (!eligibility.eligible) return deepFreeze({ candidate, eligible: false, weight: 0, factors: freezeArray([]), reason: eligibility.reason });
  let weight = candidate.baseWeight;
  const factors = [];
  for (const key of FACTOR_KEYS) {
    const value = factorValue(context, key);
    if (value == null) continue;
    const table = candidate.factorWeights[key] || {};
    const multiplier = Number(table[String(value)] ?? table['*'] ?? 1);
    if (!(multiplier >= 0)) throw new Error(`${candidate.id} has invalid ${key} multiplier`);
    weight *= multiplier;
    factors.push(deepFreeze({ key, value: String(value), multiplier }));
  }
  return deepFreeze({ candidate, eligible: weight > 0, weight, factors: freezeArray(factors), reason: weight > 0 ? null : 'factor_zero' });
}
function selectProductionScenario(options = {}) {
  const candidates = (options.candidates || []).map(normalizeScenarioCandidate);
  if (!candidates.length) return null;
  const context = deepFreeze({ ...(options.context || {}), excludedScenarioIds: freezeArray(options.excludedScenarioIds || options.context?.excludedScenarioIds || []) });
  const weighted = candidates.map((candidate) => scenarioWeight(candidate, context)).filter((entry) => entry.eligible && entry.weight > 0);
  if (!weighted.length) return null;
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const rng = new XorShift32(hash32(`${Number(options.seed || 1) >>> 0}:production-scenario-selector`));
  let roll = rng.float() * total;
  let selected = weighted.at(-1);
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll < 0) { selected = entry; break; }
  }
  return deepFreeze({
    scenarioId: selected.candidate.id,
    weight: selected.weight,
    totalWeight: total,
    appliedFactors: selected.factors,
    optionalObjectiveRequirements: selected.candidate.optionalObjectiveRequirements,
    metadata: selected.candidate.metadata
  });
}

module.exports = {
  FACTOR_KEYS,
  SCENARIO_CANDIDATE_FORMAT,
  normalizeScenarioCandidate,
  scenarioEligibility,
  scenarioWeight,
  selectProductionScenario
};
