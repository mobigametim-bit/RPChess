import { readRun, writeRun } from './run-persistence.mjs';
import { PIECE_GLYPHS, PIECE_LABELS } from './roster-data.mjs';
import {
  choiceAvailability,
  completeEvent,
  createEventState,
  eventCombatCompleted,
  markEventCombatStarted,
  normalizedEvent,
  resolveEventChoice
} from './events-core.mjs';

let screen = null;
let activeRun = null;
let busy = false;
let syncingCombat = false;

function audio() { return globalThis.RPChessRebootAudio; }

function ensureCss() {
  if (document.querySelector('[data-events-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/events.css?v=20260828-events-1';
  link.dataset.eventsCss = '';
  document.head.append(link);
}

function ensureScreen() {
  if (screen) return screen;
  const app = document.querySelector('#app');
  if (!app) return null;
  ensureCss();
  screen = document.createElement('main');
  screen.className = 'events-screen';
  screen.dataset.eventsScreen = '';
  screen.hidden = true;
  screen.setAttribute('aria-label', 'Дорожное событие');
  screen.innerHTML = `
    <div class="events-shell">
      <header class="events-topbar">
        <img class="events-logo" src="generated_assets/title_wordmark.png" alt="RPChess">
        <div class="events-topbar__actions">
          <button class="reboot-button reboot-button--primary" type="button" data-events-roster>Отряд</button>
          <button class="reboot-button reboot-button--primary" type="button" data-events-settings>Настройки</button>
        </div>
      </header>
      <section class="events-panel ui-panel-safe">
        <div class="events-kicker"><span>СОБЫТИЕ</span><strong data-events-race></strong></div>
        <h1 data-events-title></h1>
        <p class="events-story" data-events-story></p>
        <div class="events-choices" data-events-choices></div>
        <section class="events-outcome" data-events-outcome hidden>
          <div class="reboot-eyebrow" data-events-outcome-eyebrow>ИСХОД</div>
          <h2 data-events-outcome-title></h2>
          <div class="events-roll" data-events-roll></div>
          <div class="events-outcome-notes" data-events-outcome-notes></div>
          <button class="reboot-button reboot-button--primary events-continue" type="button" data-events-continue>ПРОДОЛЖИТЬ ПУТЬ</button>
        </section>
      </section>
    </div>`;
  app.append(screen);
  screen.querySelector('[data-events-roster]')?.addEventListener('click', openRoster);
  screen.querySelector('[data-events-settings]')?.addEventListener('click', () => { audio()?.click?.(); globalThis.RPChessOpenSettings?.(); });
  screen.querySelector('[data-events-continue]')?.addEventListener('click', continueOutcome);
  screen.addEventListener('click', handleChoice);
  return screen;
}

function hideAllScenes() {
  for (const main of document.querySelectorAll('#app > main')) main.hidden = true;
  document.body.classList.remove('roster-active','skirmish-active','battle-active','classic-chess-active','settlement-active','starvation-active','travel-choice-active');
}

function showEvents() {
  const root = ensureScreen();
  if (!root) return;
  hideAllScenes();
  root.hidden = false;
  document.body.classList.add('events-active');
  window.scrollTo({ top: 0, behavior: 'auto' });
  globalThis.RPChessResources?.render?.();
}

function hideEvents() {
  if (screen) screen.hidden = true;
  document.body.classList.remove('events-active');
}

function riskLabel(choice) {
  const warnings = [...(choice.warnings || [])];
  if (choice.kingRisk && !warnings.some((x) => x.includes('КОРОЛЬ'))) warnings.push('КОРОЛЬ МОЖЕТ ПОГИБНУТЬ');
  return warnings.join(' · ');
}

function costLabel(choice) {
  const parts = [];
  if (choice.cost?.gold) parts.push(`${choice.cost.gold} Gold`);
  if (choice.cost?.supplies) parts.push(`${choice.cost.supplies} Supplies`);
  return parts.join(' · ');
}

function choiceButton(eventChoice) {
  const availability = choiceAvailability(activeRun, eventChoice);
  const choice = availability.choice;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'events-choice';
  button.dataset.eventChoice = choice.id;
  button.disabled = !availability.enabled || busy;
  button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
  const role = availability.hero
    ? `${PIECE_GLYPHS[availability.hero.pieceType] || ''} ${availability.hero.name}`
    : choice.role
      ? `${PIECE_GLYPHS[choice.role] || ''} ${PIECE_LABELS[choice.role] || choice.role}`
      : '';
  const chance = choice.chance < 100 ? `${choice.chance}% УСПЕХА` : 'ГАРАНТИРОВАННО';
  const cost = costLabel(choice);
  const risk = riskLabel(choice);
  button.innerHTML = `
    <span class="events-choice__head"><strong>${choice.action}</strong><span>${chance}</span></span>
    <span class="events-choice__meta">${[role, cost, risk].filter(Boolean).map((x) => `<small>${x}</small>`).join('')}</span>
    ${availability.enabled ? '' : `<span class="events-choice__disabled">${availability.reason}</span>`}`;
  return button;
}

function renderEvent() {
  if (!screen || !activeRun?.currentEvent) return;
  const event = normalizedEvent(activeRun.currentEvent.eventId);
  if (!event) return;
  screen.querySelector('[data-events-title]').textContent = event.title;
  screen.querySelector('[data-events-race]').textContent = String(event.race || 'Смешанное').toUpperCase();
  screen.querySelector('[data-events-story]').textContent = event.story;
  const choices = screen.querySelector('[data-events-choices]');
  const outcome = screen.querySelector('[data-events-outcome]');
  if (activeRun.currentEvent.resolved) {
    choices.hidden = true;
    renderOutcome(event);
    return;
  }
  outcome.hidden = true;
  choices.hidden = false;
  choices.replaceChildren(...event.choices.map(choiceButton));
}

function renderOutcome(event) {
  const state = activeRun?.currentEvent;
  const outcome = state?.outcome;
  const root = screen?.querySelector('[data-events-outcome]');
  if (!root || !outcome) return;
  root.hidden = false;
  const title = root.querySelector('[data-events-outcome-title]');
  const roll = root.querySelector('[data-events-roll]');
  const notes = root.querySelector('[data-events-outcome-notes]');
  const button = root.querySelector('[data-events-continue]');
  if (title) title.textContent = outcome.success ? 'УСПЕХ' : 'НЕУДАЧА';
  if (roll) roll.textContent = outcome.chance < 100 ? `Бросок: ${outcome.roll} · шанс: ${outcome.chance}%` : 'Гарантированный исход';
  if (notes) {
    notes.replaceChildren();
    const list = outcome.notes?.length ? outcome.notes : ['Ничего не изменилось.'];
    for (const text of list) { const p = document.createElement('p'); p.textContent = text; notes.append(p); }
  }
  if (button) {
    if (activeRun.ended) button.textContent = 'ГЛАВНОЕ МЕНЮ';
    else if (state.combat) button.textContent = state.combat.type === 'battle' ? 'К БИТВЕ' : 'К СТЫЧКЕ';
    else button.textContent = 'ПРОДОЛЖИТЬ ПУТЬ';
  }
}

function handleChoice(event) {
  const button = event.target?.closest?.('[data-event-choice]');
  if (!button || busy) return;
  const current = readRun();
  if (!current || current.ended || current.activeTravelChoice?.type !== 'event' || current.currentEvent?.resolved) return;
  busy = true;
  audio()?.click?.();
  const result = resolveEventChoice(current, button.dataset.eventChoice);
  if (!result.success) { busy = false; renderEvent(); return; }
  activeRun = writeRun(result.run);
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  globalThis.RPChessResources?.render?.();
  renderEvent();
  busy = false;
}

function dispatchCombat() {
  const current = readRun();
  const combat = current?.currentEvent?.combat;
  if (!current || !combat || current.ended) return;
  activeRun = writeRun(markEventCombatStarted(current));
  const routed = { type: combat.type, stars: combat.stars, seed: combat.seed };
  globalThis.RPChessTravelEncounterOverride = routed;
  hideEvents();
  const detail = { source: 'event', runId: activeRun.id, choice: routed, eventId: activeRun.currentEvent.eventId };
  globalThis.dispatchEvent(new CustomEvent(combat.type === 'battle' ? 'rpchess:battle-open' : 'rpchess:skirmish-open', { detail }));
}

function continueOutcome() {
  if (busy) return;
  const current = readRun();
  if (!current?.currentEvent?.resolved) return;
  audio()?.click?.();
  if (current.ended) {
    hideEvents();
    const menu = document.querySelector('[data-reboot-foundation]');
    if (menu) menu.hidden = false;
    return;
  }
  if (current.currentEvent.combat) { dispatchCombat(); return; }
  activeRun = writeRun(completeEvent(current));
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  hideEvents();
  globalThis.dispatchEvent(new CustomEvent('rpchess:travel-open', { detail: { source: 'event-complete', runId: activeRun.id } }));
}

function openRoster() {
  if (busy) return;
  audio()?.click?.();
  hideEvents();
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue', { detail: { source: 'event' } }));
}

function openEvent(event = null) {
  busy = false;
  activeRun = readRun();
  if (!activeRun || activeRun.ended) return;
  const route = activeRun.activeTravelChoice || event?.detail?.choice;
  if (!route || route.type !== 'event') return;
  const created = createEventState(activeRun, route);
  if (created.run !== activeRun) {
    activeRun = writeRun(created.run);
    globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }
  showEvents();
  renderEvent();
}

function syncRun() {
  if (syncingCombat) return;
  activeRun = readRun();
  if (!activeRun) return;
  if (eventCombatCompleted(activeRun)) {
    syncingCombat = true;
    activeRun = writeRun(completeEvent(activeRun));
    syncingCombat = false;
    globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
    return;
  }
  if (screen && !screen.hidden && activeRun.activeTravelChoice?.type === 'event') renderEvent();
}

ensureScreen();
addEventListener('rpchess:event-open', openEvent);
addEventListener('rpchess:run-updated', syncRun);

globalThis.RPChessEvents = Object.freeze({
  open: openEvent,
  render: renderEvent,
  get run() { return activeRun; },
  get state() { return activeRun?.currentEvent || null; }
});
