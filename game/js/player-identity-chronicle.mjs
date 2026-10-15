import { currentLanguage, subscribe } from './i18n.mjs';
import { runtimeT } from '../localization/runtime-ui.mjs';
import { readRun } from './run-persistence.mjs';
import { readPlayerRating } from './player-rating.mjs';
import { PLAYER_NAME_MAX_LENGTH, normalizePlayerName } from './player-identity-core.mjs';
import { activeRunSnapshot, recordCompletedRun } from './chronicle-core.mjs';
import { currentLeaderboard, loadLeaderboard, submitBestChronicle } from './leaderboard-client.mjs';

let identityModal = null;
let chroniclePanel = null;

function l(key) { return runtimeT(currentLanguage(), key); }

function audio() { return globalThis.RPChessRebootAudio; }
function ensureCss() {
  if (document.querySelector('[data-player-identity-chronicle-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/player-identity-chronicle.css?v=20260925-flag-2';
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
          <div class="reboot-eyebrow">${l('identity.kicker')}</div>
          <h2 id="player-identity-title">${l('identity.title')}</h2>
        </div>
        <button class="reboot-close" type="button" data-player-identity-close aria-label="${l('identity.close')}">×</button>
      </header>
      <p class="identity-copy">${l('identity.copy')}</p>
      <form class="identity-form" data-player-identity-form novalidate>
        <label class="identity-field">
          <span>${l('identity.name')}</span>
          <input type="text" data-player-identity-input maxlength="${PLAYER_NAME_MAX_LENGTH}" autocomplete="off" spellcheck="false" aria-describedby="player-identity-error">
        </label>
        <div class="identity-error" id="player-identity-error" data-player-identity-error aria-live="polite"></div>
        <button class="reboot-button reboot-button--primary identity-submit" type="submit" data-player-identity-submit disabled>${l('identity.continue')}</button>
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
    if (error) error.textContent = input?.value && !name ? l('identity.error') : '';
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

function renderIdentityCopy() {
  if (!identityModal) return;
  for (const [selector, key] of [
    ['.reboot-eyebrow', 'identity.kicker'], ['#player-identity-title', 'identity.title'],
    ['.identity-copy', 'identity.copy'], ['.identity-field span', 'identity.name'],
    ['[data-player-identity-submit]', 'identity.continue']
  ]) identityModal.querySelector(selector).textContent = l(key);
  identityModal.querySelector('[data-player-identity-close]').setAttribute('aria-label', l('identity.close'));
  const error = identityModal.querySelector('[data-player-identity-error]');
  if (error.textContent) error.textContent = l('identity.error');
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
  chroniclePanel.className = 'chronicle-panel';
  chroniclePanel.setAttribute('data-chronicle-panel', '');
  chroniclePanel.setAttribute('aria-label', l('chronicle.ariaLabel'));
  chroniclePanel.innerHTML = `
    <img class="chronicle-flag-art" src="assets/ui/royal_run_flag.png" alt="" aria-hidden="true">
    <div class="chronicle-safe">
      <header class="chronicle-header"><h2>${l('chronicle.title')}</h2></header>
      <div class="chronicle-current" data-chronicle-current></div>
      <div class="chronicle-divider" aria-hidden="true"></div>
      <div class="chronicle-best" data-chronicle-best></div>
    </div>`;
  layout.append(chroniclePanel);
  return chroniclePanel;
}

function metric(label, value, icon) {
  const row = document.createElement('div');
  row.className = 'chronicle-metric';
  const image = document.createElement('img');
  image.src = icon;
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  const detail = document.createElement('div');
  detail.className = 'chronicle-metric-detail';
  const key = document.createElement('span');
  key.textContent = label;
  const strong = document.createElement('strong');
  strong.textContent = String(value);
  detail.append(key, strong);
  row.append(image, detail);
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
  root.setAttribute('aria-label', l('chronicle.ariaLabel'));
  root.querySelector('.chronicle-header h2').textContent = l('chronicle.title');
  const run = readRun();
  const rating = readPlayerRating();
  const current = activeRunSnapshot(run, { power: rating.power });
  const leaderboard = currentLeaderboard();
  const currentRoot = root.querySelector('[data-chronicle-current]');
  const bestRoot = root.querySelector('[data-chronicle-best]');

  currentRoot?.replaceChildren();
  if (currentRoot) {
    if (current) {
      currentRoot.append(sectionTitle(l('chronicle.current'), current.playerName));
      currentRoot.append(metric(l('chronicle.power'), current.power, 'assets/doctrines/royal_court/emblem.png'), metric(l('chronicle.week'), current.week, 'generated_assets/node_story.png'), metric(l('chronicle.heroes'), current.heroes, 'generated_assets/reward_recruit.png'));
    } else {
      currentRoot.append(sectionTitle(l('chronicle.current'), l('chronicle.noActive')));
    }
  }

  bestRoot?.replaceChildren();
  if (bestRoot) {
    const title=document.createElement('h3');
    title.className='chronicle-commanders-title';
    title.textContent=l('chronicle.commanders');
    bestRoot.append(title);

    const own=document.createElement('div');
    own.className='chronicle-leaderboard-self';
    const ownLabel=document.createElement('span');
    ownLabel.textContent=l('leaderboard.yourRank');
    const ownRank=document.createElement('strong');
    ownRank.textContent=leaderboard.me
      ? '#'+leaderboard.me.rank+' · '+leaderboard.me.glory+' '+l('chronicle.glory')
      : l('leaderboard.notRanked');
    own.append(ownLabel,ownRank);
    bestRoot.append(own);

    if (leaderboard.status==='ready' && leaderboard.top.length) {
      const list=document.createElement('ol');
      list.className='chronicle-leaderboard-list';
      list.setAttribute('aria-label',l('leaderboard.top10'));
      for (const entry of leaderboard.top) {
        const row=document.createElement('li');
        row.className='chronicle-leaderboard-row';
        const rank=document.createElement('span');
        rank.className='chronicle-leaderboard-rank';
        rank.textContent=String(entry.rank)+'.';
        const name=document.createElement('span');
        name.className='chronicle-leaderboard-name';
        name.textContent=entry.name;
        name.title=entry.name;
        const glory=document.createElement('strong');
        glory.className='chronicle-leaderboard-glory';
        glory.textContent=String(entry.glory);
        row.append(rank,name,glory);
        list.append(row);
      }
      bestRoot.append(list);
    } else {
      const note=document.createElement('p');
      note.className='chronicle-leaderboard-note';
      note.textContent=leaderboard.status==='ready'
        ? l('leaderboard.empty')
        : leaderboard.status==='offline'?l('leaderboard.offline'):l('leaderboard.unavailable');
      bestRoot.append(note);
    }
  }
}

function syncChronicle() {
  const run = readRun();
  const rating = readPlayerRating();
  if (run?.ended) recordCompletedRun(run, { power: rating.power });
  renderChronicle();
  void loadLeaderboard();
}

subscribe(() => { renderIdentityCopy(); renderChronicle(); });
addEventListener('rpchess:leaderboard-updated', renderChronicle);
addEventListener('rpchess:chronicle-updated', () => { void submitBestChronicle(); });

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
void submitBestChronicle();

globalThis.RPChessPlayerIdentity = Object.freeze({ open: openIdentityPrompt, close: closeIdentityPrompt });
globalThis.RPChessChronicle = Object.freeze({ render: renderChronicle, sync: syncChronicle });

export { openIdentityPrompt, closeIdentityPrompt, renderChronicle, syncChronicle };
