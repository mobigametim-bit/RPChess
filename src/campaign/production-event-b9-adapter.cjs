'use strict';

const {
  createProductionEventSelectorState,
  reserveProductionEvents,
  releaseProductionEventReservations,
  reopenProductionEventReservation,
  completeProductionEventReservation,
  selectorAssignment
} = require('./production-event-selector.cjs');
const {
  createProductionEventState,
  applyProbabilityModifiers
} = require('../content/production-events.cjs');

function freezeArray(values) {
  return Object.freeze((values || []).slice());
}

function selectorStateFor(library, state, seed) {
  if (state) return state;
  return createProductionEventSelectorState(library, { seed: Number(seed || 1) });
}

function materializationContext(payload = {}, baseContext = {}) {
  const storyFacts = payload.storyFacts || payload.flags || baseContext.storyFacts || baseContext.flags || [];
  return Object.freeze({
    ...baseContext,
    ...payload.eventContext,
    seed: Number(payload.seed || baseContext.seed || 1),
    flags: freezeArray(storyFacts),
    heroIds: freezeArray(payload.heroIds || baseContext.heroIds || []),
    doctrineIds: freezeArray(payload.doctrineIds || baseContext.doctrineIds || []),
    relicIds: freezeArray(payload.relicIds || baseContext.relicIds || []),
    roster: freezeArray(payload.roster || baseContext.roster || []),
    participatedRosterIds: freezeArray(payload.participatedRosterIds || baseContext.participatedRosterIds || []),
    gold: payload.gold ?? baseContext.gold ?? 0,
    supplies: payload.supplies ?? baseContext.supplies ?? 0
  });
}

function eventMaterializationSnapshot(library, eventId, context) {
  const eventState = createProductionEventState(library, eventId, context);
  const choiceProbabilities = eventState.choices.map((choice) => Object.freeze({
    choiceId: choice.id,
    outcomes: freezeArray(applyProbabilityModifiers(choice, context).outcomes.map((outcome) => Object.freeze({
      outcomeId: outcome.id,
      probability: outcome.probability
    })))
  }));
  const firstProbabilistic = choiceProbabilities.find((choice) => choice.outcomes.length === 2) || choiceProbabilities[0] || null;
  return Object.freeze({
    eventState,
    choiceProbabilities: freezeArray(choiceProbabilities),
    percentages: firstProbabilistic ? freezeArray(firstProbabilistic.outcomes.map((outcome) => outcome.probability)) : freezeArray([100])
  });
}

function createProductionEventMaterializationCallbacks(library, baseContext = {}) {
  if (!library?.eventsById || !Array.isArray(library.events)) throw new Error('validated production event library is required');

  function selectEvent(payload = {}) {
    const node = payload.node;
    if (!node?.id || !node.phase) throw new Error('B9 event materialization requires node id and phase');
    const state = selectorStateFor(library, payload.selectorState, payload.graph?.rootSeed || payload.seed);
    const reserved = reserveProductionEvents(library, state, [{ nodeId: node.id, phase: node.phase }], {
      excludedEventIds: payload.excludedEventIds || []
    });
    const assignment = reserved.assignments[0];
    if (!assignment) return Object.freeze({ eventId: null, selectorState: reserved.state });
    const context = materializationContext(payload, baseContext);
    const preview = eventMaterializationSnapshot(library, assignment.eventId, context);
    return Object.freeze({
      eventId: assignment.eventId,
      eventVersion: library.schemaVersion || 1,
      variantId: preview.eventState.variantId,
      participantId: preview.eventState.participant?.id || null,
      percentages: preview.percentages,
      snapshot: Object.freeze({
        eventId: assignment.eventId,
        variantId: preview.eventState.variantId,
        stageId: preview.eventState.stageId,
        participant: preview.eventState.participant,
        choiceProbabilities: preview.choiceProbabilities
      }),
      selectorState: reserved.state
    });
  }

  function onBranchesClosed(payload = {}) {
    const state = selectorStateFor(library, payload.state, payload.graph?.rootSeed);
    return Object.freeze({ selectorState: releaseProductionEventReservations(library, state, payload.nodeIds || []) });
  }

  function onBranchReopened(payload = {}) {
    const state = selectorStateFor(library, payload.state, payload.graph?.rootSeed);
    return Object.freeze({ selectorState: reopenProductionEventReservation(library, state, payload.nodeId) });
  }

  function onNodeCompleted(payload = {}) {
    const state = selectorStateFor(library, payload.state, payload.graph?.rootSeed);
    if (payload.materializedContent?.type !== 'event') return Object.freeze({ selectorState: state });
    const assignment = selectorAssignment(state, payload.nodeId);
    if (!assignment || assignment.status !== 'reserved') return Object.freeze({ selectorState: state });
    return Object.freeze({ selectorState: completeProductionEventReservation(library, state, payload.nodeId) });
  }

  return Object.freeze({ selectEvent, onBranchesClosed, onBranchReopened, onNodeCompleted });
}

module.exports = {
  selectorStateFor,
  materializationContext,
  eventMaterializationSnapshot,
  createProductionEventMaterializationCallbacks
};
