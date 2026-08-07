'use strict';

const { hash32 } = require('../core/determinism.cjs');

const EVENT_PHASES = Object.freeze(['early', 'mid', 'late']);
const ASSIGNMENT_STATUSES = Object.freeze(['reserved', 'released', 'completed']);

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function freezeObject(value) {
  return Object.freeze({ ...(value || {}) });
}

function assertLibrary(library) {
  if (!library?.eventsById || !Array.isArray(library.events)) throw new Error('validated production event library is required');
  return library;
}

function normalizeAssignment(input) {
  const status = input.status || 'reserved';
  if (!ASSIGNMENT_STATUSES.includes(status)) throw new Error(`invalid event assignment status: ${status}`);
  return Object.freeze({
    nodeId: String(input.nodeId),
    eventId: String(input.eventId),
    phase: String(input.phase),
    status
  });
}

function createProductionEventSelectorState(libraryInput, options = {}) {
  const library = assertLibrary(libraryInput);
  const assignments = freezeArray((options.assignments || []).map(normalizeAssignment));
  const completedEventIds = new Set(options.completedEventIds || assignments.filter((entry) => entry.status === 'completed').map((entry) => entry.eventId));
  for (const id of completedEventIds) if (!library.eventsById[id]) throw new Error(`unknown completed production event: ${id}`);
  return Object.freeze({
    format: 'rpchess-production-event-selector',
    schemaVersion: 1,
    libraryId: library.libraryId,
    seed: Number(options.seed || 1),
    assignments,
    completedEventIds: freezeArray([...completedEventIds].sort()),
    activeChainIds: freezeArray([...new Set(options.activeChainIds || [])].sort()),
    history: freezeArray(options.history || [])
  });
}

function assertSelectorState(state, library) {
  if (!state || state.format !== 'rpchess-production-event-selector' || state.schemaVersion !== 1) throw new Error('invalid production event selector state');
  if (state.libraryId !== library.libraryId) throw new Error('production event selector library mismatch');
  return state;
}

function reservationByNode(state) {
  return new Map(state.assignments.map((entry) => [entry.nodeId, entry]));
}

function reservedEventIds(state) {
  return new Set(state.assignments.filter((entry) => entry.status === 'reserved').map((entry) => entry.eventId));
}

function eventWeight(event, phase, activeChainIds) {
  if (!EVENT_PHASES.includes(phase)) throw new Error(`unsupported event phase: ${phase}`);
  let weight = Number(event.phaseWeights[phase] || 0);
  if (weight <= 0) return 0;
  if (event.chain.role === 'followup' && event.chain.id && activeChainIds.has(event.chain.id)) {
    weight *= Math.max(1, Number(event.chain.weightMultiplier || 2));
  }
  return weight;
}

function weightedIndex(entries, seed, salt) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!(total > 0)) return -1;
  let roll = (hash32(`${seed}:${salt}`) / 0x100000000) * total;
  for (let index = 0; index < entries.length; index += 1) {
    roll -= entries[index].weight;
    if (roll < 0) return index;
  }
  return entries.length - 1;
}

function eligibleEvents(library, state, phase, excludedIds = new Set()) {
  const completed = new Set(state.completedEventIds);
  const reserved = reservedEventIds(state);
  const activeChains = new Set(state.activeChainIds);
  return library.events
    .filter((event) => !completed.has(event.id) && !reserved.has(event.id) && !excludedIds.has(event.id))
    .map((event) => Object.freeze({ event, weight: eventWeight(event, phase, activeChains) }))
    .filter((entry) => entry.weight > 0);
}

function selectEventForSlot(libraryInput, stateInput, slot, excludedIds = new Set()) {
  const library = assertLibrary(libraryInput);
  const state = assertSelectorState(stateInput, library);
  const nodeId = String(slot.nodeId || '');
  const phase = String(slot.phase || '');
  if (!nodeId) throw new Error('event slot requires nodeId');
  if (!EVENT_PHASES.includes(phase)) throw new Error('event slot requires early, mid or late phase');
  const existing = reservationByNode(state).get(nodeId);
  if (existing && existing.status !== 'released') return existing.eventId;
  const candidates = eligibleEvents(library, state, phase, excludedIds);
  const index = weightedIndex(candidates, state.seed, `${nodeId}:${phase}:${state.history.length}`);
  return index < 0 ? null : candidates[index].event.id;
}

function reserveProductionEvents(libraryInput, stateInput, slots = [], options = {}) {
  const library = assertLibrary(libraryInput);
  let state = assertSelectorState(stateInput, library);
  if (!Array.isArray(slots)) throw new Error('event slots must be an array');
  const batchIds = new Set(options.excludedEventIds || []);
  const assignments = [...state.assignments];
  const results = [];
  for (const slot of slots) {
    const nodeId = String(slot.nodeId || '');
    const existingIndex = assignments.findIndex((entry) => entry.nodeId === nodeId);
    const existing = existingIndex >= 0 ? assignments[existingIndex] : null;
    if (existing && existing.status !== 'released') {
      batchIds.add(existing.eventId);
      results.push(existing);
      continue;
    }
    const interim = Object.freeze({ ...state, assignments: freezeArray(assignments) });
    const eventId = selectEventForSlot(library, interim, slot, batchIds);
    if (!eventId) {
      results.push(null);
      continue;
    }
    const assignment = normalizeAssignment({ nodeId, eventId, phase: slot.phase, status: 'reserved' });
    if (existingIndex >= 0) assignments[existingIndex] = assignment;
    else assignments.push(assignment);
    batchIds.add(eventId);
    results.push(assignment);
  }
  const record = Object.freeze({
    index: state.history.length,
    type: 'events_reserved',
    nodeIds: freezeArray(results.filter(Boolean).map((entry) => entry.nodeId)),
    eventIds: freezeArray(results.filter(Boolean).map((entry) => entry.eventId))
  });
  state = Object.freeze({
    ...state,
    assignments: freezeArray(assignments),
    history: freezeArray([...state.history, record])
  });
  return Object.freeze({ state, assignments: freezeArray(results) });
}

function releaseProductionEventReservations(libraryInput, stateInput, nodeIds = []) {
  const library = assertLibrary(libraryInput);
  const state = assertSelectorState(stateInput, library);
  const release = new Set(nodeIds.map(String));
  const changed = [];
  const assignments = state.assignments.map((entry) => {
    if (!release.has(entry.nodeId) || entry.status !== 'reserved') return entry;
    const next = normalizeAssignment({ ...entry, status: 'released' });
    changed.push(next);
    return next;
  });
  if (!changed.length) return state;
  return Object.freeze({
    ...state,
    assignments: freezeArray(assignments),
    history: freezeArray([...state.history, Object.freeze({
      index: state.history.length,
      type: 'event_reservations_released',
      nodeIds: freezeArray(changed.map((entry) => entry.nodeId)),
      eventIds: freezeArray(changed.map((entry) => entry.eventId))
    })])
  });
}

function reopenProductionEventReservation(libraryInput, stateInput, nodeId) {
  const library = assertLibrary(libraryInput);
  const state = assertSelectorState(stateInput, library);
  const target = String(nodeId);
  let restored = null;
  const assignments = state.assignments.map((entry) => {
    if (entry.nodeId !== target || entry.status !== 'released') return entry;
    restored = normalizeAssignment({ ...entry, status: 'reserved' });
    return restored;
  });
  if (!restored) return state;
  return Object.freeze({
    ...state,
    assignments: freezeArray(assignments),
    history: freezeArray([...state.history, Object.freeze({
      index: state.history.length,
      type: 'event_reservation_reopened',
      nodeId: restored.nodeId,
      eventId: restored.eventId
    })])
  });
}

function completeProductionEventReservation(libraryInput, stateInput, nodeId) {
  const library = assertLibrary(libraryInput);
  const state = assertSelectorState(stateInput, library);
  const target = String(nodeId);
  let completed = null;
  const assignments = state.assignments.map((entry) => {
    if (entry.nodeId !== target || entry.status !== 'reserved') return entry;
    completed = normalizeAssignment({ ...entry, status: 'completed' });
    return completed;
  });
  if (!completed) throw new Error(`${target} has no reserved production event`);
  const completedEventIds = [...new Set([...state.completedEventIds, completed.eventId])].sort();
  const event = library.eventsById[completed.eventId];
  const activeChainIds = new Set(state.activeChainIds);
  if (event.chain.role === 'start' && event.chain.id) activeChainIds.add(event.chain.id);
  return Object.freeze({
    ...state,
    assignments: freezeArray(assignments),
    completedEventIds: freezeArray(completedEventIds),
    activeChainIds: freezeArray([...activeChainIds].sort()),
    history: freezeArray([...state.history, Object.freeze({
      index: state.history.length,
      type: 'event_completed',
      nodeId: completed.nodeId,
      eventId: completed.eventId,
      activatedChainId: event.chain.role === 'start' ? event.chain.id : null
    })])
  });
}

function selectorAssignment(stateInput, nodeId) {
  const state = stateInput;
  return state.assignments.find((entry) => entry.nodeId === String(nodeId)) || null;
}

module.exports = {
  EVENT_PHASES,
  ASSIGNMENT_STATUSES,
  createProductionEventSelectorState,
  reservationByNode,
  reservedEventIds,
  eventWeight,
  weightedIndex,
  eligibleEvents,
  selectEventForSlot,
  reserveProductionEvents,
  releaseProductionEventReservations,
  reopenProductionEventReservation,
  completeProductionEventReservation,
  selectorAssignment
};
