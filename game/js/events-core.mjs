import { EVENT_CATALOG, EVENT_IDS, eventById } from './events-data.mjs';
import { RECRUIT_LIBRARY } from './settlement-core.mjs';
import { hashString, seededRandom } from './travel-choice-core.mjs';
import { clampStars } from './encounter-difficulty.mjs';
import { combatTheme } from './race-assets.mjs';

const EVENT_COUNT = 100;
const ROLE_TYPES = Object.freeze(['pawn', 'knight', 'bishop', 'rook', 'queen']);

function safeInt(value) { return Number.isInteger(value) ? value : 0; }
function splitEffects(text) { return String(text || '').split(',').map((part) => part.trim()).filter(Boolean); }

function normalizeCost(choice) {
  const action = String(choice?.action || '');
  const raw = choice?.cost || {};
  const buy = action.match(/Купить\s+\d+\s+Suppl(?:y|ies)\s+за\s+(\d+)\s+Gold/i);
  if (buy) return { gold: Number(buy[1]), supplies: 0 };
  const goldPrice = action.match(/(?:за|—)\s*(\d+)\s+Gold/i);
  const supplyPrice = action.match(/Отдать\s+(\d+)\s+Suppl(?:y|ies)/i);
  return {
    gold: goldPrice ? Number(goldPrice[1]) : Math.max(0, safeInt(raw.gold)),
    supplies: supplyPrice ? Number(supplyPrice[1]) : Math.max(0, safeInt(raw.supplies))
  };
}

function effectFromToken(token, choice) {
  if (!token || /без эффекта|шанс без побочного эффекта/i.test(token)) return null;
  let match = token.match(/^([+-]\d+)\s+Gold/i);
  if (match) return { type: 'gold', delta: Number(match[1]) };
  match = token.match(/^([+-]\d+)\s+Suppl(?:y|ies)/i);
  if (match) return { type: 'supplies', delta: Number(match[1]) };
  if (/^recruit$/i.test(token)) return { type: 'recruit' };
  match = token.match(/^start(Skirmish|Battle)\s*([+-]\d+)?/i);
  if (match) return { type: 'combat', combatType: match[1].toLowerCase(), threatMod: Number(match[2] || 0) };
  if (/случайн.*non-King\s+wound/i.test(token)) return { type: 'wound', target: 'randomNonKing' };
  if (/случайн.*non-King\s+death/i.test(token)) return { type: 'death', target: 'randomNonKing' };
  match = token.match(/выбранн.*\b(Pawn|Knight|Bishop|Rook|Queen)\b\s+(wound|death)/i);
  if (match) return { type: match[2].toLowerCase(), target: 'roleHero', role: match[1].toLowerCase() };
  if (/\bKing\b.*wound|wound.*\bKing\b/i.test(token)) return { type: 'wound', target: 'king' };
  if (/\bKing\b.*death|death.*\bKing\b/i.test(token)) return { type: 'death', target: 'king', kingRisk: Boolean(choice?.kingRisk) };
  return null;
}
function parseEffects(text, choice) { return splitEffects(text).map((token) => effectFromToken(token, choice)).filter(Boolean); }

function normalizeChoice(choice) {
  return {
    ...choice,
    chance: Math.max(1, Math.min(100, Number(choice?.chance) || 100)),
    cost: normalizeCost(choice),
    successEffects: Array.isArray(choice?.successEffects) ? choice.successEffects : parseEffects(choice?.success, choice),
    failureEffects: Array.isArray(choice?.failureEffects) ? choice.failureEffects : parseEffects(choice?.failure, choice),
    alwaysEffects: Array.isArray(choice?.alwaysEffects) ? choice.alwaysEffects : [],
    warnings: Array.isArray(choice?.warnings) ? choice.warnings : [],
    kingRisk: Boolean(choice?.kingRisk)
  };
}

function normalizedEvent(id) {
  const source = eventById(id);
  if (!source) return null;
  return { ...source, choices: source.choices.map(normalizeChoice) };
}

function shuffledEventIds(runId, cycle = 0) {
  const random = seededRandom(`${runId}:events:cycle:${cycle}`);
  const result = [...EVENT_IDS];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function eventHistory(run) { return Array.isArray(run?.eventHistory) ? run.eventHistory.filter((id) => EVENT_IDS.includes(id)) : []; }
function nextEventId(run) {
  const history = eventHistory(run);
  const cycle = Math.floor(history.length / EVENT_COUNT);
  const index = history.length % EVENT_COUNT;
  return shuffledEventIds(run.id, cycle)[index];
}

function isEventState(value) {
  if (!value || typeof value !== 'object') return false;
  if (!value.routeId || typeof value.routeId !== 'string') return false;
  if (!EVENT_IDS.includes(value.eventId)) return false;
  if (value.choiceId != null && typeof value.choiceId !== 'string') return false;
  if (value.roll != null && (!Number.isInteger(value.roll) || value.roll < 1 || value.roll > 100)) return false;
  if (value.resolved != null && typeof value.resolved !== 'boolean') return false;
  return true;
}

function createEventState(run, routeChoice) {
  if (!run || routeChoice?.type !== 'event') throw new Error('Event state requires an active Event route');
  if (isEventState(run.currentEvent) && run.currentEvent.routeId === routeChoice.id) return { run, state: run.currentEvent };
  const eventId = nextEventId(run);
  const history = [...eventHistory(run), eventId];
  const state = { routeId: routeChoice.id, eventId, choiceId: null, roll: null, success: null, resolved: false, outcome: null, combat: null };
  return { run: { ...run, eventHistory: history, currentEvent: state }, state };
}

function livingRoleHero(run, role) {
  return (run?.roster || []).filter((c) => c.pieceType === role && c.status === 'healthy' && !c.isRunKing).sort((a, b) => a.id.localeCompare(b.id))[0] || null;
}

function choiceAvailability(run, choice) {
  const normalized = normalizeChoice(choice);
  if ((run?.gold || 0) < normalized.cost.gold) return { enabled: false, reason: `Нужно ${normalized.cost.gold} Gold`, hero: null, choice: normalized };
  if ((run?.supplies || 0) < normalized.cost.supplies) return { enabled: false, reason: `Нужно ${normalized.cost.supplies} Supplies`, hero: null, choice: normalized };
  if (normalized.role) {
    const hero = livingRoleHero(run, normalized.role);
    if (!hero) return { enabled: false, reason: `Нужен здоровый ${normalized.role}`, hero: null, choice: normalized };
    return { enabled: true, reason: '', hero, choice: normalized };
  }
  return { enabled: true, reason: '', hero: null, choice: normalized };
}

function deterministicRoll(run, state, choice) { return 1 + (hashString(`${run.id}:${run.activeTravelChoice?.seed || state.routeId}:${state.eventId}:${choice.id}:roll`) % 100); }
function deterministicTarget(run, key, candidates) {
  if (!candidates.length) return null;
  const ordered = [...candidates].sort((a, b) => a.id.localeCompare(b.id));
  return ordered[hashString(`${run.id}:${key}`) % ordered.length];
}
function recruitCandidate(run, key) {
  const present = new Set((run.roster || []).map((c) => c.id));
  const eligible = RECRUIT_LIBRARY.filter((c) => !present.has(c.id) && !c.isRunKing);
  return deterministicTarget(run, `${key}:recruit`, eligible);
}

function applyEffect(run, effect, key) {
  let next = run;
  const notes = [];
  let combat = null;
  if (!effect) return { run: next, notes, combat };
  if (effect.type === 'gold') {
    const before = next.gold || 0;
    next = { ...next, gold: Math.max(0, before + safeInt(effect.delta)) };
    notes.push(`${next.gold - before >= 0 ? '+' : ''}${next.gold - before} Gold`);
  } else if (effect.type === 'supplies') {
    const before = next.supplies || 0;
    next = { ...next, supplies: Math.max(0, before + safeInt(effect.delta)) };
    notes.push(`${next.supplies - before >= 0 ? '+' : ''}${next.supplies - before} Supplies`);
  } else if (effect.type === 'recruit') {
    const recruit = recruitCandidate(next, key);
    if (recruit) {
      next = { ...next, roster: [...next.roster, { ...recruit, status: 'healthy', isRunKing: false }] };
      notes.push(`${recruit.name} присоединяется к отряду`);
    } else {
      next = { ...next, gold: (next.gold || 0) + 18 };
      notes.push('+18 Gold (нет свободных рекрутов)');
    }
  } else if (effect.type === 'wound' || effect.type === 'death') {
    let target = null;
    if (effect.target === 'king') target = (next.roster || []).find((c) => c.isRunKing && c.status !== 'dead') || null;
    else if (effect.target === 'roleHero') target = livingRoleHero(next, effect.role);
    else {
      const candidates = (next.roster || []).filter((c) => !c.isRunKing && (effect.type === 'wound' ? c.status === 'healthy' : c.status !== 'dead'));
      target = deterministicTarget(next, `${key}:${effect.type}`, candidates);
    }
    if (target) {
      const status = effect.type === 'death' ? 'dead' : 'wounded';
      next = { ...next, roster: next.roster.map((c) => c.id === target.id ? { ...c, status } : c) };
      notes.push(`${target.name}: ${status === 'dead' ? 'погиб' : 'тяжело ранен'}`);
      if (target.isRunKing && status === 'dead') next = { ...next, ended: true, endReason: 'event_king' };
    }
  } else if (effect.type === 'combat') {
    const stars = clampStars((next.activeTravelChoice?.stars || 1) + safeInt(effect.threatMod));
    combat = { type: effect.combatType, stars, seed: `${next.activeTravelChoice?.seed || key}:event:${key}:${effect.combatType}`, threatMod: safeInt(effect.threatMod) };
    notes.push(effect.combatType === 'battle' ? 'Начинается Битва' : 'Начинается Стычка');
  }
  return { run: next, notes, combat };
}

function resolveEventChoice(run, choiceId) {
  if (!run || run.activeTravelChoice?.type !== 'event') return { run, success: false, reason: 'not-event' };
  const state = run.currentEvent;
  if (!isEventState(state)) return { run, success: false, reason: 'missing-state' };
  if (state.resolved) return { run, success: true, reason: 'already-resolved', state };
  const event = normalizedEvent(state.eventId);
  const authored = event?.choices.find((c) => c.id === choiceId);
  if (!authored) return { run, success: false, reason: 'unknown-choice' };
  const availability = choiceAvailability(run, authored);
  if (!availability.enabled) return { run, success: false, reason: availability.reason };
  const choice = availability.choice;
  const roll = deterministicRoll(run, state, choice);
  const succeeded = roll <= choice.chance;
  let next = { ...run, gold: Math.max(0, (run.gold || 0) - choice.cost.gold), supplies: Math.max(0, (run.supplies || 0) - choice.cost.supplies) };
  const effects = [...(succeeded ? choice.successEffects : choice.failureEffects), ...choice.alwaysEffects];
  const notes = [];
  let combat = null;
  effects.forEach((effect, index) => {
    const applied = applyEffect(next, effect, `${state.eventId}:${choice.id}:${index}`);
    next = applied.run;
    notes.push(...applied.notes);
    if (applied.combat) combat = applied.combat;
  });
  if (combat) {
    const theme = combatTheme({ seed: combat.seed, raceTag: event?.raceTag || 'mixed', mixed: event?.raceTag === 'mixed' });
    combat = { ...combat, ...theme, sourceEventId: event.id, sourceEventTitle: event.title, raceTag: event.raceTag || 'mixed' };
  }
  const outcome = { choiceId: choice.id, roll, chance: choice.chance, success: succeeded, notes, heroId: availability.hero?.id || null, combat };
  const nextState = { ...state, choiceId: choice.id, roll, success: succeeded, resolved: true, outcome, combat };
  next = { ...next, currentEvent: nextState };
  return { run: next, success: true, reason: 'resolved', state: nextState, outcome, event, choice };
}

function completeEvent(run) { if (!run || run.activeTravelChoice?.type !== 'event') return run; return { ...run, activeTravelChoice: null, currentEvent: null }; }
function markEventCombatStarted(run) {
  const state = run?.currentEvent;
  const combat = state?.combat;
  if (!combat || combat.started) return run;
  const count = combat.type === 'battle' ? (run.battleCount || 0) : (run.skirmishCount || 0);
  return { ...run, currentEvent: { ...state, combat: { ...combat, started: true, countAtStart: count } } };
}
function eventCombatCompleted(run) {
  const combat = run?.currentEvent?.combat;
  if (!combat?.started || !Number.isInteger(combat.countAtStart)) return false;
  const count = combat.type === 'battle' ? (run.battleCount || 0) : (run.skirmishCount || 0);
  return count > combat.countAtStart;
}

if (EVENT_CATALOG.length !== EVENT_COUNT) throw new Error(`Events catalog must contain ${EVENT_COUNT} events, got ${EVENT_CATALOG.length}`);

export { EVENT_COUNT, ROLE_TYPES, normalizeChoice, normalizedEvent, shuffledEventIds, nextEventId, isEventState, createEventState, livingRoleHero, choiceAvailability, deterministicRoll, resolveEventChoice, completeEvent, markEventCombatStarted, eventCombatCompleted };
