import { readRun } from './run-persistence.mjs';
import { readPlayerRating } from './player-rating.mjs';
import { summarizeRun } from './endless-run-core.mjs';

let screen = null;
let activeRun = null;

function audio() { return globalThis.RPChessRebootAudio; }

function ensureCss() {
  if (document.querySelector('[data-endless-run-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/endless-run.css?v=20260830-endless-1';
  link.dataset.endlessRunCss = '';
  document.head.append(link);
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
  screen.setAttribute('aria-label', 'Итоги забега');
  screen.innerHTML = `
    <div class="endless-run-backdrop" aria-hidden="true"><img src="generated_assets/scene_defeat.jpg" alt=""></div>
    <div class="endless-run-shell">
      <img class="endless-run-logo" src="generated_assets/title_wordmark.png" alt="RPChess">
      <section class="endless-run-panel ui-panel-safe">
        <div class="reboot-eyebrow">ПУТЕШЕСТВИЕ ОКОНЧЕНО</div>
        <h1>ЗАБЕГ ЗАВЕРШЁН</h1>
        <p class="endless-run-reason" data-endless-run-reason></p>
        <div class="endless-run-metrics" aria-label="Статистика завершённого забега">
          <div class="endless-run-metric"><span>НЕДЕЛЬ В ПУТИ</span><strong data-endless-run-metric="weeks">0</strong></div>
          <div class="endless-run-metric"><span>ЗАРАБОТАНО ЗОЛОТА</span><strong data-endless-run-metric="goldEarned">0</strong></div>
          <div class="endless-run-metric"><span>ПОБЕД В СТЫЧКАХ</span><strong data-endless-run-metric="skirmishWins">0</strong></div>
          <div class="endless-run-metric"><span>ПОБЕД В БИТВАХ</span><strong data-endless-run-metric="battleWins">0</strong></div>
          <div class="endless-run-metric"><span>РЕШЕНО ЗАДАЧ</span><strong data-endless-run-metric="puzzlesSolved">0</strong></div>
          <div class="endless-run-metric"><span>ПРОЙДЕНО СОБЫТИЙ</span><strong data-endless-run-metric="eventsResolved">0</strong></div>
          <div class="endless-run-metric"><span>НАНЯТО ГЕРОЕВ</span><strong data-endless-run-metric="heroesRecruited">0</strong></div>
          <div class="endless-run-metric endless-run-metric--power"><span>ИТОГОВАЯ МОЩЬ</span><strong data-endless-run-metric="finalPower">500</strong></div>
        </div>
        <div class="endless-run-actions">
          <button class="reboot-button reboot-button--primary" type="button" data-endless-run-new>НОВАЯ ИГРА</button>
          <button class="reboot-button reboot-button--primary" type="button" data-endless-run-menu>ГЛАВНОЕ МЕНЮ</button>
        </div>
      </section>
    </div>`;
  app.append(screen);
  screen.querySelector('[data-endless-run-new]')?.addEventListener('click', startNewRun);
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
  const profile = readPlayerRating();
  const summary = summarizeRun(run, { power: profile.power });
  const reason = root.querySelector('[data-endless-run-reason]');
  if (reason) reason.textContent = `${summary.kingName}. ${summary.endReasonLabel}`;
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
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-new', { detail: { source: 'endless-run-summary' } }));
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

ensureScreen();
addEventListener('rpchess:run-end', (event) => open(event?.detail?.run || null));
const storedRun = readRun();
if (storedRun?.ended) queueMicrotask(() => open(storedRun));

globalThis.RPChessEndlessRun = Object.freeze({
  open,
  hide,
  render,
  get run() { return activeRun; }
});
