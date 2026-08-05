'use strict';

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function normalizeResourceDelta(input = {}) {
  const delta = {
    gold: input.gold ?? 0,
    supplies: input.supplies ?? 0,
    meta: input.meta ?? 0
  };
  for (const [key, value] of Object.entries(delta)) {
    if (!Number.isInteger(value)) throw new Error(`event resource delta ${key} must be an integer`);
  }
  return Object.freeze(delta);
}

function normalizeFlags(values = []) {
  if (!Array.isArray(values)) throw new Error('event flags must be an array');
  const flags = values.map((value) => String(value));
  if (flags.some((value) => !/^[a-z0-9][a-z0-9_.-]*$/.test(value))) throw new Error('event flags must use stable lowercase IDs');
  if (new Set(flags).size !== flags.length) throw new Error('event flags must not contain duplicates');
  return freezeArray(flags);
}

function createAuthoredEventState(content, options = {}) {
  if (!content || content.kind !== 'event') throw new Error('authored event requires a compiled event record');
  if (!Array.isArray(content.choices) || content.choices.length < 3 || content.choices.length > 4) throw new Error(`${content.id} must expose three or four choices`);
  return Object.freeze({
    format: 'rpchess-authored-event-state',
    schemaVersion: 1,
    eventId: content.id,
    nodeId: String(options.nodeId || ''),
    titleKey: content.titleKey,
    bodyKey: content.bodyKey,
    sceneArt: content.sceneArt || null,
    scope: content.scope,
    choices: freezeArray(content.choices.map((choice) => Object.freeze({
      id: choice.id,
      textKey: choice.textKey,
      effectIds: freezeArray(choice.effectIds)
    }))),
    status: 'active',
    selectedChoiceId: null,
    resolution: null
  });
}

function resolveAuthoredEventChoice(state, choiceIdInput, resolver, context = {}) {
  if (!state || state.format !== 'rpchess-authored-event-state') throw new Error('invalid authored event state');
  if (state.status !== 'active') throw new Error('authored event is already resolved');
  const choiceId = String(choiceIdInput || '');
  const choice = state.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error(`${state.eventId} has no choice ${choiceId}`);
  if (typeof resolver !== 'function') throw new Error('event choice resolver is required');
  const raw = resolver(Object.freeze({ event: state, choice, context })) || {};
  if (raw && typeof raw !== 'object') throw new Error('event choice resolver must return an object');
  const resolution = Object.freeze({
    resourceDelta: normalizeResourceDelta(raw.resourceDelta || raw.resources || {}),
    addFlags: normalizeFlags(raw.addFlags || []),
    removeFlags: normalizeFlags(raw.removeFlags || []),
    chronicleKeys: normalizeFlags(raw.chronicleKeys || []),
    effectIds: freezeArray(choice.effectIds),
    outcomeKey: raw.outcomeKey ? String(raw.outcomeKey) : null
  });
  return Object.freeze({
    ...state,
    status: 'resolved',
    selectedChoiceId: choice.id,
    resolution
  });
}

function applyFlagChanges(existingFlags = [], resolution) {
  const flags = new Set(existingFlags);
  for (const flag of resolution.removeFlags) flags.delete(flag);
  for (const flag of resolution.addFlags) flags.add(flag);
  return freezeArray([...flags].sort());
}

module.exports = {
  normalizeResourceDelta,
  normalizeFlags,
  createAuthoredEventState,
  resolveAuthoredEventChoice,
  applyFlagChanges
};
