import { readRun, writeRun } from './run-persistence.mjs';
import { acknowledgeStarvation, hasPendingStarvation } from './starvation-core.mjs';

let screen = null;
let activeRun = null;

function audio() { return globalThis.RPChessRebootAudio; }

function ensureCss() {
  if (document.querySelector('[data-starvation-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/starvation.css?v=20260828-starvation-1';
  link.dataset.starvationCss = '';
  document.head.append(link);
}

function ensureScreen() {
  if (screen) return screen;
  const app = document.querySelector('#app');
  if (!app) return null;
  ensureCss();
  screen = document.createElement('main');
  screen.className = 'starvation-screen';
  screen.dataset.starvationScreen = '';
  screen.setAttribute('aria-label', 'Последствия голода');
  screen.hidden = true;
  screen.innerHTML = `
    <div class="starvation-shell">
      <img class="starvation-logo" src="generated_assets/title_wordmark.png" alt="RPChess">
      <section class="starvation-panel ui-panel-safe" aria-live="polite">
        <div class="reboot-eyebrow">ПРИПАСЫ ЗАКОНЧИЛИСЬ</div>
        <h1 data-starvation-title>ГОЛОД</h1>
        <img class="starvation-portrait" data-starvation-portrait alt="">
        <div class="starvation-piece" data-starvation-piece></div>
        <h2 data-starvation-name></h2>
        <p data-starvation-text></p>
        <button class="reboot-button reboot-button--primary starvation-button" type="button" data-starvation-continue>ПРОДОЛЖИТЬ ПУТЬ</button>
      </section>
    </div>`;
  app.append(screen);
  screen.querySelector('[data-starvation-continue]')?.addEventListener('click', continueFromStarvation);
  return screen;
}

function hideAllScenes() {
  for (const main of document.querySelectorAll('#app > main')) main.hidden = true;
  document.body.classList.remove('roster-active', 'skirmish-active', 'battle-active', 'classic-chess-active', 'settlement-active', 'travel-choice-active');
}

function showMenu() {
  hideAllScenes();
  const menu = document.querySelector('[data-reboot-foundation]');
  if (menu) menu.hidden = false;
  document.body.classList.remove('starvation-active');
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function render(run) {
  const root = ensureScreen();
  if (!root) return false;
  const choice = run?.activeTravelChoice;
  const victim = (run?.roster || []).find((character) => character.id === choice?.starvationVictimId);
  if (!victim) return false;

  const kingDied = Boolean(choice.starvationKingDied || victim.isRunKing);
  const title = root.querySelector('[data-starvation-title]');
  const portrait = root.querySelector('[data-starvation-portrait]');
  const piece = root.querySelector('[data-starvation-piece]');
  const name = root.querySelector('[data-starvation-name]');
  const text = root.querySelector('[data-starvation-text]');
  const button = root.querySelector('[data-starvation-continue]');

  if (title) title.textContent = kingDied ? 'КОРОЛЬ ПОГИБ ОТ ГОЛОДА' : 'ГОЛОД';
  if (portrait) {
    portrait.src = victim.portrait || victim.pieceArt || '';
    portrait.alt = victim.name || 'Погибший боец';
  }
  if (piece) {
    piece.textContent = victim.pieceType === 'king' ? '♔' : ({ pawn: '♙', knight: '♘', bishop: '♗', rook: '♖', queen: '♕' }[victim.pieceType] || '');
  }
  if (name) name.textContent = victim.name || 'Боец';
  if (text) text.textContent = kingDied
    ? `${victim.name} пал во время перехода без припасов. Путешествие этого отряда завершено.`
    : `${victim.name} не пережил переход без припасов. Выбранный путь уже зафиксирован, отряд должен двигаться дальше.`;
  if (button) button.textContent = kingDied ? 'ИТОГИ ЗАБЕГА' : 'ПРОДОЛЖИТЬ ПУТЬ';
  return true;
}

function open(run = null) {
  activeRun = run || readRun();
  if (!activeRun || !hasPendingStarvation(activeRun)) return false;
  const root = ensureScreen();
  if (!root || !render(activeRun)) return false;
  hideAllScenes();
  root.hidden = false;
  document.body.classList.add('starvation-active');
  window.scrollTo({ top: 0, behavior: 'auto' });
  globalThis.RPChessResources?.render?.();
  return true;
}

function continueFromStarvation() {
  audio()?.click?.();
  const current = readRun() || activeRun;
  const choice = current?.activeTravelChoice;
  if (!current || !choice?.starvationVictimId) return;

  if (choice.starvationKingDied || current.ended) {
    if (screen) screen.hidden = true;
    document.body.classList.remove('starvation-active');
    if (globalThis.RPChessEndlessRun?.open?.(current)) return;
    showMenu();
    globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
    return;
  }

  activeRun = writeRun(acknowledgeStarvation(current));
  if (screen) screen.hidden = true;
  document.body.classList.remove('starvation-active');
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  globalThis.dispatchEvent(new CustomEvent('rpchess:starvation-continue', {
    detail: { runId: activeRun.id, choice: activeRun.activeTravelChoice }
  }));
}

ensureScreen();

globalThis.RPChessStarvation = Object.freeze({
  open,
  get run() { return activeRun; }
});
