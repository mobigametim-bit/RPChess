import { readRun } from './run-persistence.mjs';
import { readPlayerRating } from './player-rating.mjs';
import { summarizeRun } from './endless-run-core.mjs';
import { currentLanguage, subscribe, translateLegacy } from './i18n.mjs';
import { brandLogoSrc } from './brand-logo.mjs';
import { shareRunResult } from './content/share-result.mjs';
import { runtimeT } from '../localization/runtime-ui.mjs';

let screen = null;
let activeRun = null;

function t(key, params = {}) { return runtimeT(currentLanguage(), key, params); }
function audio() { return globalThis.RPChessRebootAudio; }

function ensureStylesheet(marker, href) {
  if (document.querySelector(`[${marker}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute(marker, '');
  document.head.append(link);
}

function ensureCss() {
  ensureStylesheet('data-endless-run-css', 'css/endless-run.css?v=20260925-flag-1');
  ensureStylesheet('data-endless-run-compact-css', 'css/endless-run-compact.css?v=20260925-flag-2');
}

function renderStaticCopy() {
  if (!screen) return;
  screen.setAttribute('aria-label', t('endless.ariaLabel'));
  const kicker = screen.querySelector('.reboot-eyebrow');
  const title = screen.querySelector('h1');
  const metrics = screen.querySelector('.endless-run-metrics');
  if (kicker) kicker.textContent = t('endless.kicker');
  if (title) title.textContent = t('endless.title');
  if (metrics) metrics.setAttribute('aria-label', t('endless.metricsAria'));
  for (const metric of screen.querySelectorAll('[data-endless-run-metric]')) {
    const label = metric.closest('.endless-run-metric')?.querySelector('span');
    if (label) label.textContent = t(`endless.metric.${metric.dataset.endlessRunMetric}`);
  }
  const newButton = screen.querySelector('[data-endless-run-new]');
  const shareButton = screen.querySelector('[data-endless-run-share]');
  const menuButton = screen.querySelector('[data-endless-run-menu]');
  if (newButton) newButton.textContent = t('endless.newGame');
  if (shareButton) shareButton.textContent = currentLanguage() === 'en' ? 'Share result' : 'Поделиться результатом';
  if (menuButton) menuButton.textContent = t('endless.menu');
}

function ensureScreen() {
  if (screen) return screen;
  const app = document.querySelector('#app');
  if (!app) return null;
  ensureCss();
  screen = document.createElement('main');
  screen.className = 'endless-run-screen';
  screen.dataset.endlessRunScreen = '';
  screen.hidden = true;
  const icons={weeks:'generated_assets/node_story.png',goldEarned:'generated_assets/reward_gold.png',skirmishWins:'generated_assets/node_battle.png',battleWins:'generated_assets/node_elite.png',puzzlesSolved:'generated_assets/node_training.png',eventsResolved:'generated_assets/node_story.png',heroesRecruited:'generated_assets/reward_recruit.png',finalPower:'assets/doctrines/royal_court/emblem.png',caravansDefended:'assets/doctrines/cavalry/emblem.png'};
  const metric=(key,extra='')=>`<div class="endless-run-metric ${extra}"><img src="${icons[key]}" alt="" aria-hidden="true"><span></span><strong data-endless-run-metric="${key}">0</strong></div>`;
  screen.innerHTML = `
    <div class="endless-run-backdrop" aria-hidden="true"><img src="generated_assets/scene_defeat.jpg" alt=""></div>
    <div class="endless-run-shell">
      <aside class="endless-run-controls">
        <img class="endless-run-logo" data-brand-logo src="${brandLogoSrc()}" alt="RPChess">
        <div class="endless-run-actions">
          <button class="reboot-button reboot-button--primary" type="button" data-endless-run-new></button>
          <button class="reboot-button reboot-button--primary" type="button" data-endless-run-share></button>
          <button class="reboot-button reboot-button--primary" type="button" data-endless-run-menu></button>
        </div>
      </aside>
      <section class="endless-run-panel" aria-label="Статистика забега">
        <img class="endless-run-flag-art" src="assets/ui/royal_run_flag.png" alt="" aria-hidden="true">
        <div class="endless-run-flag-content">
          <h1></h1>
          <p class="endless-run-reason" data-endless-run-reason></p>
        <div class="endless-run-metrics">
          ${metric('weeks')}${metric('goldEarned')}${metric('skirmishWins')}${metric('battleWins')}
          ${metric('puzzlesSolved')}${metric('eventsResolved')}${metric('heroesRecruited')}${metric('finalPower','endless-run-metric--power')}
          ${metric('caravansDefended','endless-run-metric--caravan')}
        </div>
        </div>
      </section>
    </div>`;
  app.append(screen);
  renderStaticCopy();
  screen.querySelector('[data-endless-run-new]')?.addEventListener('click', startNewRun);
  screen.querySelector('[data-endless-run-share]')?.addEventListener('click', () => void shareResult());
  screen.querySelector('[data-endless-run-menu]')?.addEventListener('click', returnToMenu);
  return screen;
}

function hideAllScenes() {
  for (const main of document.querySelectorAll('#app > main')) main.hidden = true;
  document.body.classList.remove(
    'roster-active','skirmish-active','battle-active','classic-chess-active','settlement-active',
    'starvation-active','events-active','events-outcome-open','puzzles-active','travel-choice-active'
  );
}

function render(run) {
  const root = ensureScreen();
  if (!root || !run) return false;
  renderStaticCopy();
  const profile = readPlayerRating();
  const summary = summarizeRun(run, { power: profile.power });
  const reason = root.querySelector('[data-endless-run-reason]');
  if (reason) reason.textContent = `${translateLegacy(summary.kingName)}. ${translateLegacy(summary.endReasonLabel)}`;
  for (const metric of root.querySelectorAll('[data-endless-run-metric]')) {
    const key = metric.dataset.endlessRunMetric;
    metric.textContent = String(summary[key] ?? 0);
  }
  return true;
}

function open(run = null) {
  const current = run || readRun();
  if (!current?.ended) return false;
  activeRun = current;
  const root = ensureScreen();
  if (!root || !render(current)) return false;
  hideAllScenes();
  root.hidden = false;
  document.body.classList.add('endless-run-active');
  window.scrollTo({ top: 0, behavior: 'auto' });
  globalThis.RPChessResources?.render?.();
  return true;
}

function hide() {
  if (screen) screen.hidden = true;
  document.body.classList.remove('endless-run-active');
}

function startNewRun() {
  audio()?.click?.();
  hide();
  globalThis.dispatchEvent(new CustomEvent('rpchess:identity-request', { detail: { source: 'endless-run-summary' } }));
}

function returnToMenu() {
  audio()?.click?.();
  hide();
  hideAllScenes();
  const menu = document.querySelector('[data-reboot-foundation]');
  if (menu) menu.hidden = false;
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated', { detail: { source: 'endless-run-summary' } }));
  window.scrollTo({ top: 0, behavior: 'auto' });
}

async function shareResult() {
  if (!activeRun) return;
  audio()?.click?.();
  const button = screen?.querySelector('[data-endless-run-share]');
  if (button) button.disabled = true;
  try {
    await shareRunResult(activeRun, { power: readPlayerRating().power });
  } finally {
    if (button) button.disabled = false;
  }
}

ensureScreen();
subscribe(() => { renderStaticCopy(); if (activeRun && screen && !screen.hidden) render(activeRun); });
addEventListener('rpchess:run-end', (event) => open(event?.detail?.run || null));
const storedRun = readRun();
if (storedRun?.ended) queueMicrotask(() => open(storedRun));

globalThis.RPChessEndlessRun = Object.freeze({
  open,
  hide,
  render,
  get run() { return activeRun; }
});
