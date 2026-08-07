'use strict';

const FACT_TYPES = Object.freeze(['fate', 'position', 'obligation', 'knowledge', 'relation', 'control']);
const EVENT_CLASS_PRIORITY = Object.freeze({ small: 100, standard: 200, key: 300, regional_finale: 400 });

function freezeArray(values) { return Object.freeze((values || []).slice()); }
function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return value;
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function factTypeFromId(id) {
  const prefix = String(id || '').split('.')[0];
  if (prefix === 'knowledge') return 'knowledge';
  if (prefix === 'obligation' || prefix === 'law') return 'obligation';
  if (prefix === 'control') return 'control';
  if (prefix === 'politics' || prefix === 'relation') return 'relation';
  if (prefix === 'fate' || prefix === 'destiny') return 'fate';
  return 'position';
}
function scopeFromId(id) {
  const value = String(id || '');
  if (value.includes('.iron_marches.')) return 'region';
  if (value.startsWith('campaign.')) return 'campaign';
  return 'local';
}
function compatibilityKey(id) {
  const parts = String(id || '').split('.');
  if (parts.length <= 2) return String(id || '');
  return parts.slice(0, -1).join('.');
}
function normalizeFact(input = {}) {
  const id = String(input.id || input.factId || '');
  if (!id) throw new Error('narrative fact requires id');
  const type = input.type || factTypeFromId(id);
  if (!FACT_TYPES.includes(type)) throw new Error(`unsupported narrative fact type: ${type}`);
  const eventClass = input.eventClass || 'small';
  const priority = Number.isInteger(input.priority) ? input.priority : (EVENT_CLASS_PRIORITY[eventClass] || EVENT_CLASS_PRIORITY.small);
  return deepFreeze({
    id,
    type,
    source: String(input.source || 'runtime'),
    scope: input.scope || scopeFromId(id),
    visibility: input.visibility || (type === 'knowledge' ? 'known' : 'hidden'),
    eventClass,
    priority,
    replaceable: input.replaceable !== false,
    compatibilityKey: String(input.compatibilityKey || compatibilityKey(id)),
    value: input.value ?? true,
    timestamp: Number.isInteger(input.timestamp) ? input.timestamp : 0
  });
}
function createNarrativeState(snapshot = null) {
  if (snapshot?.format === 'rpchess-production-narrative' && snapshot.schemaVersion === 1) return deepFreeze(clone(snapshot));
  return deepFreeze({
    format: 'rpchess-production-narrative',
    schemaVersion: 1,
    currentFacts: deepFreeze({}),
    decisionHistory: freezeArray([]),
    regionalLines: deepFreeze({}),
    finale: null
  });
}
function canReplace(existing, incoming) {
  if (!existing) return true;
  if (incoming.priority > existing.priority) return true;
  if (incoming.priority < existing.priority) return false;
  return Boolean(existing.replaceable && incoming.replaceable && existing.compatibilityKey === incoming.compatibilityKey);
}
function applyFacts(stateInput, additions = [], removals = [], context = {}) {
  const state = createNarrativeState(stateInput);
  const currentFacts = { ...state.currentFacts };
  const history = state.decisionHistory.slice();
  const removeSet = new Set(removals.map(String));
  for (const [key, existing] of Object.entries(currentFacts)) {
    if (removeSet.has(existing.id)) {
      delete currentFacts[key];
      history.push(deepFreeze({ index: history.length, type: 'fact_removed', factId: existing.id, source: context.source || 'runtime' }));
    }
  }
  for (const addition of additions) {
    const incoming = normalizeFact(typeof addition === 'string' ? {
      id: addition,
      source: context.source,
      eventClass: context.eventClass,
      visibility: context.visibility,
      timestamp: history.length
    } : { ...addition, source: addition.source || context.source, eventClass: addition.eventClass || context.eventClass, timestamp: addition.timestamp ?? history.length });
    const key = incoming.compatibilityKey;
    const existing = currentFacts[key] || null;
    const accepted = canReplace(existing, incoming);
    history.push(deepFreeze({
      index: history.length,
      type: accepted ? 'fact_applied' : 'fact_rejected_by_priority',
      fact: incoming,
      replacedFactId: accepted ? existing?.id || null : null,
      blockingFactId: accepted ? null : existing?.id || null
    }));
    if (accepted) currentFacts[key] = incoming;
  }
  return deepFreeze({ ...state, currentFacts: deepFreeze(currentFacts), decisionHistory: freezeArray(history) });
}
function factsArray(stateInput) {
  const state = createNarrativeState(stateInput);
  return freezeArray(Object.values(state.currentFacts));
}
function hasFact(stateInput, factId) {
  return factsArray(stateInput).some((fact) => fact.id === factId);
}
function factIds(stateInput) { return freezeArray(factsArray(stateInput).map((fact) => fact.id).sort()); }
function applyEventOutcome(stateInput, eventMeta = {}, outcome = {}) {
  const state = applyFacts(stateInput, outcome.addFlags || [], outcome.removeFlags || [], {
    source: `${eventMeta.eventId || 'event'}:${eventMeta.variantId || 'default'}:${eventMeta.stageId || 'stage'}:${eventMeta.choiceId || 'choice'}`,
    eventClass: eventMeta.eventClass || 'small'
  });
  const history = [...state.decisionHistory, deepFreeze({
    index: state.decisionHistory.length,
    type: 'event_decision',
    eventId: eventMeta.eventId || null,
    eventClass: eventMeta.eventClass || null,
    variantId: eventMeta.variantId || null,
    stageId: eventMeta.stageId || null,
    choiceId: eventMeta.choiceId || null,
    outcomeId: outcome.id || null,
    immediate: deepFreeze({ resourceDelta: clone(outcome.resourceDelta || {}), consequences: freezeArray(outcome.consequences || []) })
  })];
  return deepFreeze({ ...state, decisionHistory: freezeArray(history) });
}

function lineStatus(stateInput, lineId) {
  const ids = new Set(factIds(stateInput));
  if (lineId === 'iron_and_bread') {
    if (ids.has('story.strike_broken') || ids.has('politics.iron_marches.workers_hostile')) return 'crisis';
    if (ids.has('story.iron_marches.strike_compromise') || ids.has('story.iron_marches.strike_workers_backed')) return 'favorable';
    if (ids.has('story.iron_marches.strike_audit')) return 'active';
    return 'unstarted';
  }
  if (lineId === 'honor_of_the_marches') {
    if (ids.has('politics.iron_marches.garrison_divided')) return 'crisis';
    if (ids.has('obligation.iron_marches.standard_ratified') || ids.has('politics.iron_marches.garrison_united')) return 'favorable';
    if ([...ids].some((id) => id.startsWith('politics.iron_marches.standard.'))) return 'active';
    return 'unstarted';
  }
  return 'unstarted';
}
function deriveRegionalLines(stateInput) {
  return deepFreeze({
    iron_and_bread: lineStatus(stateInput, 'iron_and_bread'),
    honor_of_the_marches: lineStatus(stateInput, 'honor_of_the_marches')
  });
}
function withRegionalLines(stateInput) {
  const state = createNarrativeState(stateInput);
  return deepFreeze({ ...state, regionalLines: deriveRegionalLines(state) });
}

function buildIronMarchesFinale(stateInput, resources = {}) {
  const state = withRegionalLines(stateInput);
  const ids = new Set(factIds(state));
  const supporters = {
    army: ids.has('politics.iron_marches.council_emboldened') || [...ids].some((id) => id.includes('standard.varn')),
    workers: ids.has('politics.iron_marches.workers_support_crown') || ids.has('story.iron_marches.strike_compromise'),
    reformers: [...ids].some((id) => id.includes('young_masons_supported')) || ids.has('knowledge.iron_marches.mine_abuse_proven'),
    garrison: ids.has('politics.iron_marches.garrison_united') || ids.has('obligation.iron_marches.standard_ratified')
  };
  const supportCost = ids.has('politics.iron_marches.council_resentful') ? 20 : 0;
  const reformCost = ids.has('politics.iron_marches.workers_hostile') ? 30 : 10;
  const choices = [
    deepFreeze({ id: 'support_marches', title: 'Поддержать военный совет', consequence: 'Сохранить военную автономию Маршей и дисциплину гарнизонов.', costGold: supportCost, supporters: freezeArray(['army', ...(supporters.garrison ? ['garrison'] : [])]), visible: true, available: Number(resources.gold || 0) >= supportCost }),
    deepFreeze({ id: 'reform_marches', title: 'Начать реформу', consequence: 'Закрепить новые права и перераспределить полномочия между советом, гильдиями и короной.', costGold: reformCost, supporters: freezeArray([...(supporters.workers ? ['workers'] : []), ...(supporters.reformers ? ['reformers'] : [])]), visible: true, available: Number(resources.gold || 0) >= reformCost }),
    deepFreeze({ id: 'claim_crown', title: 'Подчинить Марши короне', consequence: 'Усилить прямую королевскую власть ценой местной автономии.', costGold: 0, supporters: freezeArray(['crown']), visible: true, available: true })
  ];
  if (state.regionalLines.iron_and_bread === 'favorable' && supporters.workers) choices.push(deepFreeze({
    id: 'workers_compact', title: 'Заключить Железный договор', consequence: 'Закрепить компромисс шахтёров и короны как новую основу снабжения Маршей.', costGold: 20,
    supporters: freezeArray(['workers', 'crown']), visible: true, available: Number(resources.gold || 0) >= 20,
    unlockedBy: freezeArray(['iron_and_bread:favorable'])
  }));
  if (state.regionalLines.honor_of_the_marches === 'favorable' && supporters.garrison) choices.push(deepFreeze({
    id: 'oath_compact', title: 'Утвердить Клятву Маршей', consequence: 'Сохранить честь гарнизонов, привязав их к обновлённой королевской клятве.', costGold: 0,
    supporters: freezeArray(['garrison', 'crown']), visible: true, available: true,
    unlockedBy: freezeArray(['honor_of_the_marches:favorable'])
  }));
  const visible = choices.filter((choice) => choice.visible);
  if (!visible.some((choice) => choice.available)) {
    const crown = visible.find((choice) => choice.id === 'claim_crown');
    if (crown) crown.available = true;
  }
  return deepFreeze({
    format: 'rpchess-iron-marches-political-finale',
    schemaVersion: 1,
    summary: 'Железный Регент повержен. Накопленные решения определяют доступные политические исходы, но финальный выбор делает игрок.',
    choices: freezeArray(visible),
    regionalLines: state.regionalLines,
    supporters: deepFreeze(supporters),
    selectedChoiceId: null
  });
}
function selectIronMarchesFinale(stateInput, finaleInput, choiceId, resources = {}) {
  const state = withRegionalLines(stateInput);
  const finale = finaleInput || buildIronMarchesFinale(state, resources);
  const choice = finale.choices.find((entry) => entry.id === choiceId && entry.visible);
  if (!choice) throw new Error('political finale choice is unavailable');
  if (!choice.available) throw new Error('political finale choice requirements are not met');
  if (Number(resources.gold || 0) < Number(choice.costGold || 0)) throw new Error('not enough gold for political finale choice');
  const finalFact = normalizeFact({
    id: `fate.iron_marches.${choice.id}`,
    type: 'fate',
    source: 'iron_marches_finale',
    scope: 'campaign',
    visibility: 'known',
    eventClass: 'regional_finale',
    priority: EVENT_CLASS_PRIORITY.regional_finale,
    replaceable: false,
    compatibilityKey: 'fate.iron_marches.final_outcome'
  });
  const next = applyFacts(state, [finalFact], [], { source: 'iron_marches_finale', eventClass: 'regional_finale' });
  return deepFreeze({
    narrative: { ...next, finale: { ...finale, selectedChoiceId: choice.id } },
    resources: { ...resources, gold: Number(resources.gold || 0) - Number(choice.costGold || 0) },
    choice
  });
}

module.exports = {
  FACT_TYPES,
  EVENT_CLASS_PRIORITY,
  factTypeFromId,
  scopeFromId,
  compatibilityKey,
  normalizeFact,
  createNarrativeState,
  canReplace,
  applyFacts,
  factsArray,
  factIds,
  hasFact,
  applyEventOutcome,
  lineStatus,
  deriveRegionalLines,
  withRegionalLines,
  buildIronMarchesFinale,
  selectIronMarchesFinale
};
