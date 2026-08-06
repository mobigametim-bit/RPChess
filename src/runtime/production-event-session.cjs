'use strict';

const {
  createProductionEventState,
  resolveProductionEventChoice,
  applyProbabilityModifiers,
  conditionMatches
} = require('../content/production-events.cjs');

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function localized(value, language) {
  if (!value || typeof value !== 'object') return String(value || '');
  return String(value[language] || value.ru || value.en || '');
}

function contextSnapshot(context = {}) {
  return Object.freeze({
    ...context,
    seed: Number(context.seed || 1),
    flags: freezeArray(context.flags || []),
    heroIds: freezeArray(context.heroIds || []),
    relicIds: freezeArray(context.relicIds || []),
    roster: freezeArray(context.roster || []),
    participatedRosterIds: freezeArray(context.participatedRosterIds || []),
    gold: context.gold ?? context.resources?.gold ?? 0,
    supplies: context.supplies ?? context.resources?.supplies ?? 0
  });
}

function mergeContext(base, patch = {}) {
  return contextSnapshot({
    ...base,
    ...patch,
    flags: patch.flags || base.flags,
    heroIds: patch.heroIds || base.heroIds,
    relicIds: patch.relicIds || base.relicIds,
    roster: patch.roster || base.roster,
    participatedRosterIds: patch.participatedRosterIds || base.participatedRosterIds,
    resources: {
      gold: patch.gold ?? patch.resources?.gold ?? base.gold,
      supplies: patch.supplies ?? patch.resources?.supplies ?? base.supplies
    }
  });
}

function applyOutcomeContext(context, outcome) {
  if (!outcome) return context;
  const gold = context.gold + (outcome.resourceDelta?.gold || 0);
  const supplies = context.supplies + (outcome.resourceDelta?.supplies || 0);
  if (gold < 0 || supplies < 0) throw new Error('event outcome would make resources negative');
  const flags = new Set(context.flags || []);
  for (const flag of outcome.removeFlags || []) flags.delete(flag);
  for (const flag of outcome.addFlags || []) flags.add(flag);
  return mergeContext(context, {
    gold,
    supplies,
    flags: [...flags].sort()
  });
}

function definitionForState(library, state) {
  const event = library.eventsById[state.eventId];
  const variant = event.variants.find((candidate) => candidate.id === state.variantId);
  const stage = variant.stages.find((candidate) => candidate.id === state.stageId);
  return Object.freeze({ event, variant, stage });
}

function refreshVisibleChoices(library, state, context) {
  if (state.status !== 'active') return state;
  const { stage } = definitionForState(library, state);
  const choices = stage.choices.filter((choice) => conditionMatches(choice.requirements, context));
  if (!choices.length) throw new Error(`${state.eventId}.${state.stageId} has no visible choices after applying the previous outcome`);
  return Object.freeze({ ...state, choices: freezeArray(choices) });
}

function choiceView(choice, context, language) {
  const probabilities = applyProbabilityModifiers(choice, context);
  return Object.freeze({
    id: choice.id,
    label: localized(choice.label, language),
    preview: localized(choice.preview, language),
    participantRequired: choice.participant.mode !== 'none',
    probabilities: freezeArray(probabilities.outcomes.map((outcome) => Object.freeze({
      outcomeId: outcome.id,
      probability: outcome.probability,
      journal: localized(outcome.journal, language),
      severity: outcome.severity,
      combat: outcome.combat ? Object.freeze({
        encounterId: outcome.combat.encounterId,
        dangerOffset: outcome.combat.dangerOffset,
        warning: localized(outcome.combat.warning, language),
        objective: localized(outcome.combat.objective, language),
        rewardMode: outcome.combat.rewardMode
      }) : null
    }))),
    modifiers: freezeArray(probabilities.appliedModifiers.map((modifier) => Object.freeze({
      id: modifier.id,
      delta: modifier.delta,
      label: localized(modifier.label, language)
    })))
  });
}

function productionEventView(library, state, context, language = 'ru', pendingCombat = null, combatHistory = []) {
  const definition = definitionForState(library, state);
  const resolution = state.resolution?.outcome || null;
  return Object.freeze({
    format: 'rpchess-production-event-view',
    schemaVersion: 1,
    eventId: state.eventId,
    eventClass: state.eventClass,
    variantId: state.variantId,
    stageId: state.stageId,
    stageIndex: state.stageIndex,
    status: pendingCombat ? 'combat_pending' : state.status,
    title: localized(state.title, language),
    body: localized(state.body, language),
    participant: state.participant,
    resources: Object.freeze({ gold: context.gold, supplies: context.supplies }),
    knownFlags: context.flags,
    choices: pendingCombat || state.status !== 'active'
      ? freezeArray([])
      : freezeArray(state.choices.map((choice) => choiceView(choice, context, language))),
    history: state.history,
    combatHistory: freezeArray(combatHistory),
    resolution: resolution ? Object.freeze({
      outcomeId: resolution.id,
      journal: localized(resolution.journal, language),
      resourceDelta: resolution.resourceDelta,
      addFlags: resolution.addFlags,
      removeFlags: resolution.removeFlags,
      chronicleKeys: resolution.chronicleKeys,
      severity: resolution.severity,
      terminal: state.resolution.terminal,
      combatResult: state.resolution.combatResult || null,
      combat: resolution.combat ? Object.freeze({
        encounterId: resolution.combat.encounterId,
        dangerOffset: resolution.combat.dangerOffset,
        warning: localized(resolution.combat.warning, language),
        objective: localized(resolution.combat.objective, language),
        rewardMode: resolution.combat.rewardMode
      }) : null
    }) : null,
    pendingCombat,
    chain: definition.event.chain
  });
}

function sessionFromState(library, initialSnapshot) {
  let context = contextSnapshot(initialSnapshot.context);
  let state = initialSnapshot.state;
  let pendingCombat = initialSnapshot.pendingCombat || null;
  let combatHistory = freezeArray(initialSnapshot.combatHistory || []);
  const language = initialSnapshot.language === 'en' ? 'en' : 'ru';

  function snapshot() {
    return Object.freeze({
      format: 'rpchess-production-event-session',
      schemaVersion: 1,
      language,
      context,
      state,
      pendingCombat,
      combatHistory
    });
  }

  function view() {
    return productionEventView(library, state, context, language, pendingCombat, combatHistory);
  }

  function choose(choiceId, contextPatch = {}) {
    if (pendingCombat) throw new Error('event choice is unavailable while combat is pending');
    if (state.status !== 'active') throw new Error('event session is already resolved');
    context = mergeContext(context, contextPatch);
    state = resolveProductionEventChoice(library, state, String(choiceId), context);
    const outcome = state.resolution?.outcome || null;
    context = applyOutcomeContext(context, outcome);
    state = refreshVisibleChoices(library, state, context);
    const combat = outcome?.combat || null;
    if (combat) {
      pendingCombat = Object.freeze({
        eventId: state.eventId,
        stageId: state.history.at(-1).stageId,
        choiceId: state.history.at(-1).choiceId,
        outcomeId: state.history.at(-1).outcomeId,
        encounterId: combat.encounterId,
        dangerOffset: combat.dangerOffset,
        rewardMode: combat.rewardMode,
        warning: localized(combat.warning, language),
        objective: localized(combat.objective, language)
      });
    }
    return view();
  }

  function completeCombat(result, details = {}) {
    if (!pendingCombat) throw new Error('event session has no pending combat');
    if (!['victory', 'defeat'].includes(result)) throw new Error('event combat result must be victory or defeat');
    combatHistory = freezeArray([...combatHistory, Object.freeze({
      ...pendingCombat,
      result,
      details: Object.freeze({ ...(details || {}) })
    })]);
    pendingCombat = null;
    if (result === 'defeat') {
      state = Object.freeze({
        ...state,
        status: 'resolved',
        choices: freezeArray([]),
        resolution: Object.freeze({
          ...state.resolution,
          terminal: true,
          combatResult: 'defeat'
        })
      });
    } else if (state.resolution) {
      state = Object.freeze({
        ...state,
        resolution: Object.freeze({ ...state.resolution, combatResult: 'victory' })
      });
    }
    return view();
  }

  return Object.freeze({ view, choose, completeCombat, snapshot });
}

function createProductionEventSession(options = {}) {
  const library = options.library?.eventsById ? options.library : null;
  if (!library) throw new Error('validated production event library is required');
  let context = contextSnapshot(options.context || {});
  const state = createProductionEventState(library, String(options.eventId || ''), context);
  if (state.participant?.id) {
    context = mergeContext(context, {
      participatedRosterIds: [...new Set([...context.participatedRosterIds, state.participant.id])]
    });
  }
  return sessionFromState(library, {
    language: options.language,
    context,
    state,
    pendingCombat: null,
    combatHistory: []
  });
}

function restoreProductionEventSession(options = {}) {
  const library = options.library?.eventsById ? options.library : null;
  const snapshot = options.snapshot;
  if (!library || !snapshot || snapshot.format !== 'rpchess-production-event-session' || snapshot.schemaVersion !== 1) {
    throw new Error('valid production event session snapshot is required');
  }
  return sessionFromState(library, snapshot);
}

module.exports = {
  localized,
  contextSnapshot,
  mergeContext,
  applyOutcomeContext,
  definitionForState,
  refreshVisibleChoices,
  choiceView,
  productionEventView,
  createProductionEventSession,
  restoreProductionEventSession
};
