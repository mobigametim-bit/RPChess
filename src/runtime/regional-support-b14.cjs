'use strict';

const { GOVERNMENTS } = require('./political-finale-b14.cjs');

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value); Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child, seen); return value;
}

function assertSupport(support) {
  if (!support || support.regionId !== 'region.iron_marches') throw new Error('Iron Marches support state is required');
  if (!Number.isInteger(support.charges) || support.charges < 0) throw new Error('support charges must be a non-negative integer');
  if (!Number.isInteger(support.maximum) || support.maximum < 1 || support.charges > support.maximum) throw new Error('invalid support maximum');
  return support;
}

function eligibleRegionalSupportOptions({ governmentId, support, candidates = [] } = {}) {
  assertSupport(support);
  if (support.charges <= 0) return Object.freeze([]);
  const government = GOVERNMENTS[governmentId];
  if (!government) throw new Error('known B14 government is required');
  const allowedForces = new Set(government.forces || []);
  const eligible = candidates
    .filter((candidate) => candidate && candidate.id && allowedForces.has(candidate.forceId) && candidate.available !== false)
    .map((candidate) => deepFreeze({
      id: String(candidate.id),
      forceId: String(candidate.forceId),
      title: String(candidate.title || candidate.id),
      description: String(candidate.description || ''),
      exactEffect: candidate.exactEffect == null ? null : candidate.exactEffect,
      contextId: candidate.contextId == null ? null : String(candidate.contextId)
    }));
  // Authored caller controls relevance/order. B14 UI exposes only the first one or two applicable choices.
  return Object.freeze(eligible.slice(0, 2));
}

function spendRegionalSupport(supportInput, option) {
  const support = assertSupport(supportInput);
  if (support.charges <= 0) throw new Error('regional support has no charges');
  if (!option?.id || option.exactEffect == null) throw new Error('support option must expose its exact authored effect before spending');
  return deepFreeze({
    support: {
      ...support,
      charges: support.charges - 1,
      history: Object.freeze([...(support.history || []), Object.freeze({ optionId: String(option.id), contextId: option.contextId || null })])
    },
    selected: option
  });
}

module.exports = { eligibleRegionalSupportOptions, spendRegionalSupport };
