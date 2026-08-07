'use strict';

const {
  selectVariant,
  createProductionEventState,
  resolveProductionEventChoice
} = require('./production-events.cjs');

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function normalizedContext(context = {}) {
  return Object.freeze({
    ...context,
    seed: Number(context.seed || 1),
    flags: freezeArray(context.flags || []),
    gold: context.resources?.gold ?? context.gold ?? 0,
    supplies: context.resources?.supplies ?? context.supplies ?? 0,
    roster: freezeArray(context.roster || []),
    heroIds: freezeArray(context.heroIds || []),
    doctrineId: context.doctrineId || null,
    relicIds: freezeArray(context.relicIds || []),
    participatedRosterIds: freezeArray(context.participatedRosterIds || [])
  });
}

function firstStageChoice(definition, choiceId, context) {
  const variant = selectVariant(definition, context);
  const stage = variant.stages[0];
  const choice = stage.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error(`${definition.id} has no production choice ${choiceId}`);
  return Object.freeze({ variant, stage, choice });
}

function normalizeResolution(input = {}) {
  return Object.freeze({
    resourceDelta: Object.freeze({
      gold: input.resourceDelta?.gold ?? 0,
      supplies: input.resourceDelta?.supplies ?? 0,
      meta: input.resourceDelta?.meta ?? 0
    }),
    addFlags: freezeArray(input.addFlags || []),
    removeFlags: freezeArray(input.removeFlags || []),
    chronicleKeys: freezeArray(input.chronicleKeys || []),
    outcomeKey: input.outcomeKey || null
  });
}

function resolveFirstStageCompatibility(library, definition, choiceId, context) {
  const selected = firstStageChoice(definition, choiceId, context);
  if (selected.choice.compatibilityOutcome) return normalizeResolution(selected.choice.compatibilityOutcome);

  const permissive = Object.freeze({
    ...context,
    gold: Number.MAX_SAFE_INTEGER,
    supplies: Number.MAX_SAFE_INTEGER,
    resources: Object.freeze({ gold: Number.MAX_SAFE_INTEGER, supplies: Number.MAX_SAFE_INTEGER })
  });
  const state = createProductionEventState(library, definition.id, permissive);
  const resolved = resolveProductionEventChoice(library, state, choiceId, permissive);
  const outcome = resolved.resolution?.outcome;
  if (!outcome) throw new Error(`${definition.id}.${choiceId} produced no compatibility outcome`);
  return normalizeResolution(outcome);
}

function createCompatibleProductionEventChoiceResolver(libraryInput, fallbackResolver = null) {
  const library = libraryInput.eventsById ? libraryInput : null;
  if (!library) throw new Error('validated production event library is required');
  return ({ event, choice, context = {} }) => {
    const definition = library.eventsById[event.eventId];
    if (!definition) {
      if (typeof fallbackResolver !== 'function') throw new Error(`no event resolver for ${event.eventId}`);
      return fallbackResolver({ event, choice, context });
    }
    return resolveFirstStageCompatibility(library, definition, choice.id, normalizedContext(context));
  };
}

module.exports = {
  normalizedContext,
  firstStageChoice,
  normalizeResolution,
  resolveFirstStageCompatibility,
  createCompatibleProductionEventChoiceResolver
};
