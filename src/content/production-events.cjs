'use strict';

const fs = require('fs');
const { hash32 } = require('../core/determinism.cjs');

const EVENT_CLASSES = Object.freeze(['small', 'standard', 'key']);
const PHASES = Object.freeze(['early', 'mid', 'late']);
const SEVERITIES = Object.freeze(['none', 'low', 'serious', 'permanent']);
const STAGE_LIMITS = Object.freeze({
  small: Object.freeze({ min: 1, max: 1, choicesMin: 2, choicesMax: 2 }),
  standard: Object.freeze({ min: 1, max: 2, choicesMin: 2, choicesMax: 3 }),
  key: Object.freeze({ min: 2, max: 3, choicesMin: 3, choicesMax: 4 })
});

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return value;
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function stableId(value, label, pattern = /^[a-z0-9][a-z0-9_.-]*$/) {
  const normalized = String(value || '');
  if (!pattern.test(normalized)) throw new Error(`${label} must be a stable lowercase ID`);
  return normalized;
}

function uniqueIds(values = [], label) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  const normalized = values.map((value, index) => stableId(value, `${label}[${index}]`));
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} must not contain duplicates`);
  return Object.freeze(normalized);
}

function localizedText(value, label) {
  assertObject(value, label);
  const ru = String(value.ru || '').trim();
  const en = String(value.en || '').trim();
  if (!ru || !en) throw new Error(`${label} requires ru and en text`);
  return Object.freeze({ ru, en });
}

function normalizeResourceDelta(input = {}, label) {
  assertObject(input, label);
  const output = { gold: 0, supplies: 0, meta: 0 };
  for (const key of Object.keys(input)) if (!Object.prototype.hasOwnProperty.call(output, key)) throw new Error(`${label} has unsupported key ${key}`);
  for (const key of Object.keys(output)) {
    const value = input[key] ?? 0;
    if (!Number.isInteger(value)) throw new Error(`${label}.${key} must be an integer`);
    output[key] = value;
  }
  return Object.freeze(output);
}

function normalizeCondition(input = {}, label) {
  assertObject(input, label);
  return Object.freeze({
    allFlags: uniqueIds(input.allFlags || [], `${label}.allFlags`),
    anyFlags: uniqueIds(input.anyFlags || [], `${label}.anyFlags`),
    noneFlags: uniqueIds(input.noneFlags || [], `${label}.noneFlags`),
    minimumGold: Number.isInteger(input.minimumGold) ? input.minimumGold : 0,
    minimumSupplies: Number.isInteger(input.minimumSupplies) ? input.minimumSupplies : 0,
    requiredHeroIds: uniqueIds(input.requiredHeroIds || [], `${label}.requiredHeroIds`),
    requiredDoctrineIds: uniqueIds(input.requiredDoctrineIds || [], `${label}.requiredDoctrineIds`),
    requiredRelicIds: uniqueIds(input.requiredRelicIds || [], `${label}.requiredRelicIds`)
  });
}

function normalizeParticipant(input = {}, label) {
  assertObject(input, label);
  const mode = input.mode || 'none';
  if (!['none', 'random', 'authored'].includes(mode)) throw new Error(`${label}.mode is invalid`);
  return Object.freeze({
    mode,
    requiredHeroId: input.requiredHeroId ? stableId(input.requiredHeroId, `${label}.requiredHeroId`) : null,
    allowedKinds: uniqueIds(input.allowedKinds || [], `${label}.allowedKinds`),
    allowedTypes: uniqueIds(input.allowedTypes || [], `${label}.allowedTypes`),
    requiredTags: uniqueIds(input.requiredTags || [], `${label}.requiredTags`),
    allowKing: input.allowKing === true
  });
}

function normalizeModifier(input, label) {
  assertObject(input, label);
  const delta = Number(input.delta);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 95) throw new Error(`${label}.delta must be a non-zero integer between -95 and 95`);
  return Object.freeze({
    id: stableId(input.id, `${label}.id`),
    condition: normalizeCondition(input.condition || {}, `${label}.condition`),
    delta,
    label: localizedText(input.label, `${label}.label`)
  });
}

function normalizeCombat(input, label) {
  if (input == null) return null;
  assertObject(input, label);
  const dangerOffset = input.dangerOffset ?? 0;
  if (!Number.isInteger(dangerOffset) || dangerOffset < 0 || dangerOffset > 1) throw new Error(`${label}.dangerOffset must be 0 or 1`);
  return Object.freeze({
    encounterId: stableId(input.encounterId, `${label}.encounterId`, /^encounter\.[a-z0-9][a-z0-9_-]*$/),
    dangerOffset,
    warning: localizedText(input.warning, `${label}.warning`),
    objective: localizedText(input.objective, `${label}.objective`),
    rewardMode: input.rewardMode || 'event_only'
  });
}

function normalizeOutcome(input, label) {
  assertObject(input, label);
  const probability = input.probability ?? 100;
  if (!Number.isInteger(probability) || probability < 0 || probability > 100) throw new Error(`${label}.probability must be an integer from 0 to 100`);
  const severity = input.severity || 'none';
  if (!SEVERITIES.includes(severity)) throw new Error(`${label}.severity is invalid`);
  const consequences = Array.isArray(input.consequences) ? input.consequences.map(String) : [];
  if (consequences.length < 1 || consequences.length > 3) throw new Error(`${label}.consequences must contain one to three entries`);
  return Object.freeze({
    id: stableId(input.id, `${label}.id`),
    probability,
    resourceDelta: normalizeResourceDelta(input.resourceDelta || {}, `${label}.resourceDelta`),
    addFlags: uniqueIds(input.addFlags || [], `${label}.addFlags`),
    removeFlags: uniqueIds(input.removeFlags || [], `${label}.removeFlags`),
    chronicleKeys: uniqueIds(input.chronicleKeys || [], `${label}.chronicleKeys`),
    consequences: Object.freeze(consequences),
    severity,
    journal: localizedText(input.journal, `${label}.journal`),
    nextStageId: input.nextStageId ? stableId(input.nextStageId, `${label}.nextStageId`, /^[a-z0-9][a-z0-9_-]*$/) : null,
    combat: normalizeCombat(input.combat, `${label}.combat`)
  });
}

function normalizeCompatibilityOutcome(input, label) {
  if (input == null) return null;
  assertObject(input, label);
  return Object.freeze({
    resourceDelta: normalizeResourceDelta(input.resourceDelta || {}, `${label}.resourceDelta`),
    addFlags: uniqueIds(input.addFlags || [], `${label}.addFlags`),
    removeFlags: uniqueIds(input.removeFlags || [], `${label}.removeFlags`),
    chronicleKeys: uniqueIds(input.chronicleKeys || [], `${label}.chronicleKeys`),
    outcomeKey: input.outcomeKey ? stableId(input.outcomeKey, `${label}.outcomeKey`) : null
  });
}

function normalizeChoice(input, label) {
  assertObject(input, label);
  const outcomes = (input.outcomes || []).map((outcome, index) => normalizeOutcome(outcome, `${label}.outcomes[${index}]`));
  if (outcomes.length < 1 || outcomes.length > 2) throw new Error(`${label}.outcomes must contain one or two outcomes`);
  if (outcomes.length === 1 && outcomes[0].probability !== 100) throw new Error(`${label} deterministic outcome must have probability 100`);
  if (outcomes.length === 2 && outcomes.reduce((sum, outcome) => sum + outcome.probability, 0) !== 100) throw new Error(`${label} outcome probabilities must sum to 100`);
  const serious = outcomes.filter((outcome) => ['serious', 'permanent'].includes(outcome.severity));
  if (serious.length > 1) throw new Error(`${label} may contain at most one serious immediate punishment`);
  const modifiers = (input.modifiers || []).map((modifier, index) => normalizeModifier(modifier, `${label}.modifiers[${index}]`));
  const positive = modifiers.filter((modifier) => modifier.delta > 0);
  const negative = modifiers.filter((modifier) => modifier.delta < 0);
  if (positive.length > 2 || negative.length > 1) throw new Error(`${label} exceeds the modifier limit`);
  return Object.freeze({
    id: stableId(input.id, `${label}.id`, /^[a-z0-9][a-z0-9_-]*$/),
    label: localizedText(input.label, `${label}.label`),
    preview: localizedText(input.preview, `${label}.preview`),
    effectIds: uniqueIds(input.effectIds || [], `${label}.effectIds`),
    requirements: normalizeCondition(input.requirements || {}, `${label}.requirements`),
    participant: normalizeParticipant(input.participant || {}, `${label}.participant`),
    modifiers: Object.freeze(modifiers),
    outcomes: Object.freeze(outcomes),
    compatibilityOutcome: normalizeCompatibilityOutcome(input.compatibilityOutcome, `${label}.compatibilityOutcome`)
  });
}

function normalizeStage(input, label, eventClass) {
  assertObject(input, label);
  const limits = STAGE_LIMITS[eventClass];
  const choices = (input.choices || []).map((choice, index) => normalizeChoice(choice, `${label}.choices[${index}]`));
  if (choices.length < limits.choicesMin || choices.length > limits.choicesMax) {
    throw new Error(`${label}.choices must contain ${limits.choicesMin}-${limits.choicesMax} choices for ${eventClass}`);
  }
  if (new Set(choices.map((choice) => choice.id)).size !== choices.length) throw new Error(`${label}.choices contains duplicate IDs`);
  return Object.freeze({
    id: stableId(input.id, `${label}.id`, /^[a-z0-9][a-z0-9_-]*$/),
    title: localizedText(input.title, `${label}.title`),
    body: localizedText(input.body, `${label}.body`),
    choices: Object.freeze(choices)
  });
}

function normalizeVariant(input, label, eventClass) {
  assertObject(input, label);
  const stages = (input.stages || []).map((stage, index) => normalizeStage(stage, `${label}.stages[${index}]`, eventClass));
  const limits = STAGE_LIMITS[eventClass];
  if (stages.length < limits.min || stages.length > limits.max) throw new Error(`${label}.stages must contain ${limits.min}-${limits.max} stages for ${eventClass}`);
  if (new Set(stages.map((stage) => stage.id)).size !== stages.length) throw new Error(`${label}.stages contains duplicate IDs`);
  const stageIds = new Set(stages.map((stage) => stage.id));
  for (const stage of stages) {
    for (const choice of stage.choices) {
      for (const outcome of choice.outcomes) if (outcome.nextStageId && !stageIds.has(outcome.nextStageId)) throw new Error(`${label} references unknown next stage ${outcome.nextStageId}`);
    }
  }
  return Object.freeze({
    id: stableId(input.id, `${label}.id`, /^[a-z0-9][a-z0-9_-]*$/),
    condition: normalizeCondition(input.condition || {}, `${label}.condition`),
    stages: Object.freeze(stages)
  });
}

function normalizeEvent(input, label) {
  assertObject(input, label);
  const eventClass = input.class;
  if (!EVENT_CLASSES.includes(eventClass)) throw new Error(`${label}.class is invalid`);
  assertObject(input.phaseWeights, `${label}.phaseWeights`);
  const phaseWeights = {};
  for (const phase of PHASES) {
    const value = input.phaseWeights[phase] ?? 0;
    if (!Number.isInteger(value) || value < 0) throw new Error(`${label}.phaseWeights.${phase} must be a non-negative integer`);
    phaseWeights[phase] = value;
  }
  if (!Object.values(phaseWeights).some(Boolean)) throw new Error(`${label} must be available in at least one phase`);
  const variants = (input.variants || []).map((variant, index) => normalizeVariant(variant, `${label}.variants[${index}]`, eventClass));
  if (!variants.length || variants.length > 3) throw new Error(`${label}.variants must contain one to three variants`);
  if (new Set(variants.map((variant) => variant.id)).size !== variants.length) throw new Error(`${label}.variants contains duplicate IDs`);
  const defaultVariantId = input.defaultVariantId || variants[0].id;
  if (!variants.some((variant) => variant.id === defaultVariantId)) throw new Error(`${label}.defaultVariantId is unknown`);
  const chain = input.chain || {};
  const chainRole = chain.role || 'standalone';
  if (!['standalone', 'start', 'followup'].includes(chainRole)) throw new Error(`${label}.chain.role is invalid`);
  return Object.freeze({
    id: stableId(input.id, `${label}.id`, /^event\.[a-z0-9][a-z0-9_-]*$/),
    class: eventClass,
    scope: stableId(input.scope || 'iron_marches', `${label}.scope`, /^[a-z0-9][a-z0-9_-]*$/),
    sceneArt: String(input.sceneArt || ''),
    tags: uniqueIds(input.tags || [], `${label}.tags`),
    phaseWeights: Object.freeze(phaseWeights),
    chain: Object.freeze({
      id: chain.id ? stableId(chain.id, `${label}.chain.id`) : null,
      role: chainRole,
      followupId: chain.followupId ? stableId(chain.followupId, `${label}.chain.followupId`, /^event\.[a-z0-9][a-z0-9_-]*$/) : null,
      weightMultiplier: Number.isInteger(chain.weightMultiplier) ? chain.weightMultiplier : 2
    }),
    defaultVariantId,
    variants: Object.freeze(variants)
  });
}

function validateProductionEventLibrary(input) {
  assertObject(input, 'production event library');
  if (input.schemaVersion !== 1) throw new Error('unsupported production event library schemaVersion');
  const events = (input.events || []).map((event, index) => normalizeEvent(event, `events[${index}]`));
  if (events.length !== 7) throw new Error('Iron Marches production library must contain exactly seven events');
  if (new Set(events.map((event) => event.id)).size !== events.length) throw new Error('production event IDs must be unique');
  const counts = events.reduce((result, event) => ({ ...result, [event.class]: (result[event.class] || 0) + 1 }), {});
  if (counts.small !== 3 || counts.standard !== 3 || counts.key !== 1) throw new Error('event class distribution must be 3 small, 3 standard and 1 key');
  const ids = new Set(events.map((event) => event.id));
  for (const event of events) if (event.chain.followupId && !ids.has(event.chain.followupId)) throw new Error(`${event.id} references missing followup ${event.chain.followupId}`);
  return deepFreeze({
    schemaVersion: 1,
    libraryId: stableId(input.libraryId, 'production event library.libraryId', /^[a-z0-9][a-z0-9_-]*$/),
    metaPersistence: input.metaPersistence === true,
    events: Object.freeze(events),
    eventsById: Object.freeze(Object.fromEntries(events.map((event) => [event.id, event])))
  });
}

function loadProductionEventLibrary(filePath) {
  return validateProductionEventLibrary(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function conditionMatches(condition, context = {}) {
  const flags = new Set(context.flags || []);
  const heroIds = new Set(context.heroIds || context.roster?.filter((entry) => entry.kind === 'hero').map((entry) => entry.contentId || entry.heroId || entry.id) || []);
  const doctrineIds = new Set(context.doctrineIds || (context.doctrineId ? [context.doctrineId] : []));
  const relicIds = new Set(context.relicIds || []);
  if (condition.allFlags.some((flag) => !flags.has(flag))) return false;
  if (condition.anyFlags.length && !condition.anyFlags.some((flag) => flags.has(flag))) return false;
  if (condition.noneFlags.some((flag) => flags.has(flag))) return false;
  if ((context.gold ?? context.resources?.gold ?? 0) < condition.minimumGold) return false;
  if ((context.supplies ?? context.resources?.supplies ?? 0) < condition.minimumSupplies) return false;
  if (condition.requiredHeroIds.some((id) => !heroIds.has(id))) return false;
  if (condition.requiredDoctrineIds.some((id) => !doctrineIds.has(id))) return false;
  if (condition.requiredRelicIds.some((id) => !relicIds.has(id))) return false;
  return true;
}

function selectVariant(event, context = {}) {
  return event.variants.find((variant) => variant.id !== event.defaultVariantId && conditionMatches(variant.condition, context))
    || event.variants.find((variant) => variant.id === event.defaultVariantId);
}

function participantCandidates(rule, context = {}) {
  if (rule.mode === 'none') return [];
  const roster = Array.isArray(context.roster) ? context.roster : [];
  return roster.filter((entry) => {
    if (!entry || entry.available === false || entry.injury === 'heavy' || entry.storyLocked) return false;
    if (entry.kind === 'king' && !rule.allowKing) return false;
    if (rule.requiredHeroId && ![entry.id, entry.heroId, entry.contentId].includes(rule.requiredHeroId)) return false;
    if (rule.allowedKinds.length && !rule.allowedKinds.includes(String(entry.kind || ''))) return false;
    if (rule.allowedTypes.length && !rule.allowedTypes.includes(String(entry.type || entry.pieceType || ''))) return false;
    const tags = new Set(entry.tags || []);
    return rule.requiredTags.every((tag) => tags.has(tag));
  });
}

function selectProductionParticipant(rule, context = {}, salt = '') {
  if (rule.mode === 'none') return null;
  const candidates = participantCandidates(rule, context);
  if (!candidates.length) return null;
  if (rule.mode === 'authored') return candidates[0];
  const participated = new Set(context.participatedRosterIds || []);
  const fresh = candidates.filter((entry) => !participated.has(entry.id));
  const pool = fresh.length ? fresh : candidates;
  const index = hash32(`${context.seed || 1}:${salt}:participant`) % pool.length;
  return pool[index];
}

function visibleChoices(stage, context = {}) {
  return Object.freeze(stage.choices.filter((choice) => conditionMatches(choice.requirements, context)));
}

function createProductionEventState(libraryInput, eventId, context = {}) {
  const library = libraryInput.eventsById ? libraryInput : validateProductionEventLibrary(libraryInput);
  const event = library.eventsById[eventId];
  if (!event) throw new Error(`unknown production event: ${eventId}`);
  const variant = selectVariant(event, context);
  const stage = variant.stages[0];
  const choices = visibleChoices(stage, context);
  if (!choices.length) throw new Error(`${eventId}.${variant.id}.${stage.id} has no visible choices`);
  const participantRule = choices.find((choice) => choice.participant.mode !== 'none')?.participant || Object.freeze({ mode: 'none' });
  const participant = selectProductionParticipant(participantRule, context, `${eventId}:${variant.id}:${stage.id}`);
  return deepFreeze({
    format: 'rpchess-production-event-state',
    schemaVersion: 1,
    libraryId: library.libraryId,
    eventId,
    eventClass: event.class,
    variantId: variant.id,
    stageId: stage.id,
    stageIndex: 0,
    status: 'active',
    participant: participant ? { id: participant.id, kind: participant.kind || null, type: participant.type || participant.pieceType || null } : null,
    title: stage.title,
    body: stage.body,
    choices,
    history: Object.freeze([]),
    resolution: null
  });
}

function applyProbabilityModifiers(choice, context = {}) {
  if (choice.outcomes.length === 1) return Object.freeze({ outcomes: choice.outcomes, appliedModifiers: Object.freeze([]) });
  const applied = choice.modifiers.filter((modifier) => conditionMatches(modifier.condition, context));
  const delta = applied.reduce((sum, modifier) => sum + modifier.delta, 0);
  const success = Math.max(5, Math.min(95, choice.outcomes[0].probability + delta));
  const outcomes = Object.freeze([
    Object.freeze({ ...choice.outcomes[0], probability: success }),
    Object.freeze({ ...choice.outcomes[1], probability: 100 - success })
  ]);
  return Object.freeze({ outcomes, appliedModifiers: Object.freeze(applied) });
}

function resolveProductionEventChoice(libraryInput, state, choiceId, context = {}) {
  const library = libraryInput.eventsById ? libraryInput : validateProductionEventLibrary(libraryInput);
  if (!state || state.format !== 'rpchess-production-event-state' || state.status !== 'active') throw new Error('active production event state is required');
  const event = library.eventsById[state.eventId];
  const variant = event.variants.find((candidate) => candidate.id === state.variantId);
  const stage = variant.stages.find((candidate) => candidate.id === state.stageId);
  const choice = visibleChoices(stage, context).find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error(`${state.eventId}.${state.stageId} has no visible choice ${choiceId}`);
  const probabilities = applyProbabilityModifiers(choice, context);
  const roll = choice.outcomes.length === 1 ? 1 : (hash32(`${context.seed || 1}:${state.eventId}:${state.variantId}:${state.stageId}:${choice.id}:roll`) % 100) + 1;
  let cursor = 0;
  const outcome = probabilities.outcomes.find((candidate) => {
    cursor += candidate.probability;
    return roll <= cursor;
  }) || probabilities.outcomes.at(-1);
  const entry = Object.freeze({ stageId: stage.id, choiceId: choice.id, outcomeId: outcome.id, roll, probability: outcome.probability });
  const history = Object.freeze([...state.history, entry]);
  if (outcome.nextStageId) {
    const nextStage = variant.stages.find((candidate) => candidate.id === outcome.nextStageId);
    const choices = visibleChoices(nextStage, context);
    if (!choices.length) throw new Error(`${state.eventId}.${nextStage.id} has no visible choices`);
    return deepFreeze({
      ...state,
      stageId: nextStage.id,
      stageIndex: variant.stages.indexOf(nextStage),
      title: nextStage.title,
      body: nextStage.body,
      choices,
      history,
      resolution: Object.freeze({ outcome, appliedModifiers: probabilities.appliedModifiers, terminal: false })
    });
  }
  return deepFreeze({
    ...state,
    status: 'resolved',
    choices: Object.freeze([]),
    history,
    resolution: Object.freeze({ outcome, appliedModifiers: probabilities.appliedModifiers, terminal: true })
  });
}

function localizationKey(eventId, variantId, stageId, suffix) {
  return `production.${eventId}.${variantId}.${stageId}.${suffix}`;
}

function compileProductionLocalization(libraryInput, language) {
  const library = libraryInput.eventsById ? libraryInput : validateProductionEventLibrary(libraryInput);
  if (!['ru', 'en'].includes(language)) throw new Error(`unsupported production event language: ${language}`);
  const dictionary = {};
  for (const event of library.events) {
    for (const variant of event.variants) {
      for (const stage of variant.stages) {
        dictionary[localizationKey(event.id, variant.id, stage.id, 'title')] = stage.title[language];
        dictionary[localizationKey(event.id, variant.id, stage.id, 'body')] = stage.body[language];
        for (const choice of stage.choices) dictionary[localizationKey(event.id, variant.id, stage.id, `choice.${choice.id}`)] = `${choice.label[language]} — ${choice.preview[language]}`;
      }
    }
  }
  return Object.freeze(dictionary);
}

function compileProductionEventPack(basePackInput, libraryInput) {
  const library = libraryInput.eventsById ? libraryInput : validateProductionEventLibrary(libraryInput);
  const pack = JSON.parse(JSON.stringify(basePackInput));
  const existing = new Map((pack.content?.events || []).map((event) => [event.id, event]));
  for (const event of library.events) {
    if (!existing.has(event.id)) throw new Error(`production event override is missing from base pack: ${event.id}`);
    const variant = event.variants.find((candidate) => candidate.id === event.defaultVariantId);
    const stage = variant.stages[0];
    existing.set(event.id, {
      id: event.id,
      nameKey: localizationKey(event.id, variant.id, stage.id, 'title'),
      titleKey: localizationKey(event.id, variant.id, stage.id, 'title'),
      bodyKey: localizationKey(event.id, variant.id, stage.id, 'body'),
      status: 'approved',
      tags: [...new Set(['production', 'iron_marches', event.class, ...event.tags])],
      scope: event.scope,
      sceneArt: event.sceneArt,
      choices: stage.choices.map((choice) => ({
        id: choice.id,
        textKey: localizationKey(event.id, variant.id, stage.id, `choice.${choice.id}`),
        effectIds: choice.effectIds
      }))
    });
  }
  pack.content.events = (pack.content.events || []).map((event) => existing.get(event.id));
  pack.packId = `${pack.packId}_production_events`;
  return deepFreeze(pack);
}

function compatibilityResolution(choice, resolved) {
  if (resolved.status === 'resolved') {
    const outcome = resolved.resolution.outcome;
    return Object.freeze({
      resourceDelta: outcome.resourceDelta,
      addFlags: outcome.addFlags,
      removeFlags: outcome.removeFlags,
      chronicleKeys: outcome.chronicleKeys,
      outcomeKey: null
    });
  }
  if (choice.compatibilityOutcome) return choice.compatibilityOutcome;
  const outcome = resolved.resolution.outcome;
  return Object.freeze({
    resourceDelta: outcome.resourceDelta,
    addFlags: outcome.addFlags,
    removeFlags: outcome.removeFlags,
    chronicleKeys: outcome.chronicleKeys,
    outcomeKey: null
  });
}

function createProductionEventChoiceResolver(libraryInput, fallbackResolver = null) {
  const library = libraryInput.eventsById ? libraryInput : validateProductionEventLibrary(libraryInput);
  return ({ event, choice, context = {} }) => {
    const definition = library.eventsById[event.eventId];
    if (!definition) {
      if (typeof fallbackResolver !== 'function') throw new Error(`no event resolver for ${event.eventId}`);
      return fallbackResolver({ event, choice, context });
    }
    const productionState = createProductionEventState(library, event.eventId, {
      ...context,
      seed: context.seed || 1,
      flags: context.flags || [],
      gold: context.resources?.gold ?? 0,
      supplies: context.resources?.supplies ?? 0,
      roster: context.roster || [],
      participatedRosterIds: context.participatedRosterIds || []
    });
    const selected = productionState.choices.find((candidate) => candidate.id === choice.id);
    if (!selected) throw new Error(`${event.eventId} has no production choice ${choice.id}`);
    const resolved = resolveProductionEventChoice(library, productionState, choice.id, {
      ...context,
      seed: context.seed || 1,
      flags: context.flags || [],
      gold: context.resources?.gold ?? 0,
      supplies: context.resources?.supplies ?? 0
    });
    return compatibilityResolution(selected, resolved);
  };
}

module.exports = {
  EVENT_CLASSES,
  PHASES,
  SEVERITIES,
  STAGE_LIMITS,
  validateProductionEventLibrary,
  loadProductionEventLibrary,
  conditionMatches,
  selectVariant,
  participantCandidates,
  selectProductionParticipant,
  createProductionEventState,
  applyProbabilityModifiers,
  resolveProductionEventChoice,
  compileProductionLocalization,
  compileProductionEventPack,
  createProductionEventChoiceResolver
};
