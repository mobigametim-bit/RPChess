'use strict';

function allChoices(event) {
  return event.variants.flatMap((variant) => variant.stages.flatMap((stage) => stage.choices));
}

function allOutcomes(event) {
  return allChoices(event).flatMap((choice) => choice.outcomes.map((outcome) => ({ choice, outcome })));
}

function assertProductionEventPolicy(library) {
  if (!library?.eventsById || !Array.isArray(library.events)) throw new Error('validated production event library is required');
  const errors = [];
  const classCounts = { small: 0, standard: 0, key: 0 };
  const chainStarts = new Map();
  const chainFollowups = new Map();

  for (const event of library.events) {
    classCounts[event.class] += 1;
    if (event.chain.id && event.chain.role === 'start') chainStarts.set(event.chain.id, event.id);
    if (event.chain.id && event.chain.role === 'followup') chainFollowups.set(event.chain.id, event.id);

    for (const { choice, outcome } of allOutcomes(event)) {
      if (event.class === 'small' && outcome.combat) errors.push(`${event.id}.${choice.id} small events cannot start combat`);
      if (event.class === 'small' && outcome.severity === 'permanent') errors.push(`${event.id}.${choice.id} small events cannot cause permanent loss`);
      if (outcome.severity === 'permanent' && choice.outcomes.length !== 1) errors.push(`${event.id}.${choice.id} permanent loss must be deterministic`);
      if (outcome.combat && !['standard', 'key'].includes(event.class)) errors.push(`${event.id}.${choice.id} combat is restricted to standard and key events`);
      if (outcome.combat && outcome.combat.rewardMode !== 'event_only') errors.push(`${event.id}.${choice.id} combat must use event_only reward mode`);
      if (outcome.combat && outcome.combat.dangerOffset > 1) errors.push(`${event.id}.${choice.id} combat danger may exceed the phase by at most one`);
      if (outcome.resourceDelta.gold < 0 && choice.requirements.minimumGold < Math.abs(outcome.resourceDelta.gold)) {
        errors.push(`${event.id}.${choice.id} must require enough gold for its deterministic cost`);
      }
      if (outcome.resourceDelta.supplies < 0 && choice.requirements.minimumSupplies < Math.abs(outcome.resourceDelta.supplies)) {
        errors.push(`${event.id}.${choice.id} must require enough supplies for its deterministic cost`);
      }
    }
  }

  if (classCounts.small !== 3 || classCounts.standard !== 3 || classCounts.key !== 1) errors.push('event class distribution must remain 3 small, 3 standard and 1 key');
  for (const [chainId, startId] of chainStarts) if (!chainFollowups.has(chainId)) errors.push(`${startId} starts ${chainId} without a followup`);
  for (const [chainId, followupId] of chainFollowups) if (!chainStarts.has(chainId)) errors.push(`${followupId} follows ${chainId} without a start`);
  if (library.metaPersistence !== false) errors.push('event knowledge must not persist between runs');

  if (errors.length) {
    const error = new Error(`production event policy failed with ${errors.length} error(s)`);
    error.details = Object.freeze(errors);
    throw error;
  }
  return library;
}

function productionEventPolicyReport(library) {
  assertProductionEventPolicy(library);
  let combatChoices = 0;
  let probabilisticChoices = 0;
  let permanentChoices = 0;
  for (const event of library.events) {
    for (const choice of allChoices(event)) {
      if (choice.outcomes.length === 2) probabilisticChoices += 1;
      if (choice.outcomes.some((outcome) => outcome.combat)) combatChoices += 1;
      if (choice.outcomes.some((outcome) => outcome.severity === 'permanent')) permanentChoices += 1;
    }
  }
  return Object.freeze({
    ok: true,
    eventCount: library.events.length,
    combatChoices,
    probabilisticChoices,
    permanentChoices,
    chainCount: new Set(library.events.map((event) => event.chain.id).filter(Boolean)).size,
    metaPersistence: library.metaPersistence
  });
}

module.exports = {
  allChoices,
  allOutcomes,
  assertProductionEventPolicy,
  productionEventPolicyReport
};
