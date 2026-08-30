import { readRun } from './run-persistence.mjs';
import { readPlayerRating } from './player-rating.mjs';
import { PLAYER_NAME_MAX_LENGTH, normalizePlayerName } from './player-identity-core.mjs';
import { activeRunSnapshot, bestChronicleRun, readChronicle, recordCompletedRun } from './chronicle-core.mjs';

let identityModal = null;
let chroniclePanel = null;

function audio() { return globalThis.RPChessRebootAudio; }
function ensureCss() {
  if (document.querySelector('[data-player-identity-chronicle-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/player-identity-chronicle.css?v=20260831-identity-1';
  link.dataset.playerIdentityChronicleCss = '';
  document.head.append(link);
}

function ensureIdentityModal() {
  ensureCss();
  if (identityModal) return identityModal;
  identityModal = document.createElement('div');
  identityModal.className = 'reboot-modal identity-modal';
  identityModal.dataset.playerIdentityModal = '';
  identityModal.hidden = true;
  identityModal.innerHTML = `
    <section class="reboot-modal__panel identity-panel ui-panel-surface" role="dialog" aria-modal="true" aria-labelledby="player-identity-title">
      <header class="reboot-modal__header">
        <div>
          <div class="reboot-eyebrow">НОВЫЙ ПОХОД</div>
          <h2 id="player-identity-title">Кто ты, воин?</h2>
        </div>
        <button class="reboot-close" type="button" data-player-identity-close aria-label="Закрыть">×</button>
      </header>
      <p class="identity-copy">Это имя будет вписано в события и Летопись похода.</p>
      <form class="identity-form" data-player-identity-form novalidate>
        <label class="identity-field">
          <span>ИМЯ</span>
          <input type="text" data-player-identity-input maxlength="${PLAYER_NAME_MAX_LENGTH}" autocomplete="off" spellcheck="false" aria-describedby="player-identity-error">
        </label>
        <div class="identity-error" id="player-identity-error" data-player-identity-error aria-live="polite"></div>
        <button class="reboot-button reboot-button--primary identity-submit" type="submit" data-player-identity-submit disabled>ПРОДОЛЖИТЬ</button>
      </form>
    </section>`;
  document.body.append(identityModal);

  const input = identityModal.querySelector('[data-player-identity-input]');
  const submit = identityModal.querySelector('[data-player-identity-submit]');
  const form = identityModal.querySelector('[data-player-identity-form]');
  const close = identityModal.querySelector('[data-player-identity-close]');
  const error = identityModal.querySelector('[data-player-identity-error]');

  const validate = () => {
    const name = normalizePlayerName(input?.value || '');
    if (submit) submit.disabled = !name;
    if (error) error.textContent = input?.value && !name ? 'Введите имя.' : '';
    return name;
  };

  input?.addEventListener('input', validate);
  close?.addEventListener('click', () => closeIdentityPrompt());
  identityModal.addEventListener('click', (event) => {
    if (event.target === identityModal) closeIdentityPrompt();
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const playerName = validate();
    if (!playerName) {
      input?.focus();
      return;
    }
    if (submit) submit.disabled = true;
    audio()?.click?.();
    try {
      if (!globalThis.RPChessRoster?.beginRun) await import('./roster-app.mjs');
      closeIdentityPrompt({ silent: true });
      globalThis.dispatchEvent(new CustomEvent('rpchess:run-new', { detail: { playerName, source: 'player-identity' } }));
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  return identityModal;
}

function openIdentityPrompt() {
  const modal = ensureIdentityModal();
  const input = modal.querySelector('[data-player-identity-input]');
  const error = modal.querySelector('[data-player-identity-error]');
  if (input) input.value = '';
  if (error) error.textContent = '';
  const submit = modal.querySelector('[data-player-identity-submit]');
  if (submit) submit.disabled = true;
  modal.hidden = false;
  document.body.classList.add('reboot-modal-open');
  audio()?.open?.();
  requestAnimationFrame(() => input?.focus());
  return true;
}

function closeIdentityPrompt({ silent = false } = {}) {
  if (!identityModal || identityModal.hidden) return;
  identityModal.hidden = true;
  document.body.classList.remove('reboot-modal-open');
  if (!silent) audio()?.close?.();
}

function ensureChroniclePanel() {
  ensureCss();
  if (chroniclePanel) return chroniclePanel;
  const layout = document.querySelector('.reboot-menu-screen__layout');
  if (!layout) return null;
  chroniclePanel = document.createElement('aside');
  chroniclePanel.className = 'chronicle-panel ui-panel-safe';
  chroniclePanel.setAttribute('data-chronicle-panel', '');
  chroniclePanel.setAttribute('aria-label', 'Летопись походов');
  chroniclePanel.innerHTML = `
    <header class="chronicle-header">
      <div class="reboot-eyebrow">ЛЕТОПИСЬ</div>
      <h2>Летопись</h2>
    </header>
    <div class="chronicle-current" data-chronicle-current></div>
    <div class="chronicle-divider" aria-hidden="true"></div>
    <div class="chronicle-best" data-chronicle-best></div>`;
  layout.append(chroniclePanel);
  return chroniclePanel;
}

function metric(label, value) {
  const row = document.createElement('div');
  row.className = 'chronicle-metric';
  const key = document.createElement('span');
  key.textContent = label;
  const strong = document.createElement('strong');
  strong.textContent = String(value);
  row.append(key, strong);
  return row;
}

function sectionTitle(kicker, name) {
  const fragment = document.createDocumentFragment();
  const label = document.createElement('div');
  label.className = 'chronicle-section-label';
  label.textContent = kicker;
  const title = document.createElement('h3');
  title.textContent = name;
  fragment.append(label, title);
  return fragment;
}

function renderChronicle() {
  const root = ensureChroniclePanel();
  if (!root) return;
  const run = readRun();
  const rating = readPlayerRating();
  const current = activeRunSnapshot(run, { power: rating.power });
  const chronicle = readChronicle();
  const best = bestChronicleRun(chronicle);
  const currentRoot = root.querySelector('[data-chronicle-current]');
  const bestRoot = root.querySelector('[data-chronicle-best]');

  currentRoot?.replaceChildren();
  if (currentRoot) {
    if (current) {
      currentRoot.append(sectionTitle('ТЕКУЩИЙ ПОХОД', current.playerName));
      currentRoot.append(metric('МОЩЬ', current.power), metric('НЕДЕЛЯ', current.week), metric('ГЕРОЕВ В СТРОЮ', current.heroes));
    } else {
      currentRoot.append(sectionTitle('ТЕКУЩИЙ ПОХОД', 'Нет активного похода'));
      const text = document.createElement('p');
      text.className = 'chronicle-empty-copy';
      text.textContent = 'Новое имя ещё ждёт своей дороги.';
      currentRoot.append(text);
    }
  }

  bestRoot?.replaceChildren();
  if (bestRoot) {
    if (best) {
      bestRoot.append(sectionTitle('ЛУЧШИЙ ПОХОД', best.playerName));
      bestRoot.append(metric('СЛАВА', best.glory), metric('НЕДЕЛЯ', best.week), metric('МОЩЬ', best.power));
    } else {
      bestRoot.append(sectionTitle('ЛУЧШАЯ ЛЕТОПИСЬ', 'Летопись пуста'));
      const text = document.createElement('p');
      text.className = 'chronicle-empty-copy';
      text.textContent = 'Ни одно имя ещё не вписано в её страницы.';
      bestRoot.append(text);
    }
  }
}

function syncChronicle() {
  const run = readRun();
  const rating = readPlayerRating();
  if (run?.ended) recordCompletedRun(run, { power: rating.power });
  renderChronicle();
}

addEventListener('rpchess:identity-request', openIdentityPrompt);
addEventListener('rpchess:run-updated', syncChronicle);
addEventListener('rpchess:power-updated', syncChronicle);
addEventListener('storage', (event) => {
  if (event.key?.startsWith('rpchess.reboot.')) syncChronicle();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && identityModal && !identityModal.hidden) closeIdentityPrompt();
});

ensureChroniclePanel();
syncChronicle();

globalThis.RPChessPlayerIdentity = Object.freeze({ open: openIdentityPrompt, close: closeIdentityPrompt });
globalThis.RPChessChronicle = Object.freeze({ render: renderChronicle, sync: syncChronicle });

export { openIdentityPrompt, closeIdentityPrompt, renderChronicle, syncChronicle };
