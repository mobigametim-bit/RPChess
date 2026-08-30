import { RebootAudio } from './reboot-audio.mjs';

// Travel Choice is part of the critical run shell. Its stylesheet must be available even if
// the wider route/content bootstrap fails and Roster has to use the direct Travel fallback.
if (!document.querySelector('[data-travel-choice-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/travel-choice.css?v=20260830-acceptance-2';
  link.dataset.travelChoiceCss = '';
  document.head.append(link);
}
if (!document.querySelector('[data-player-rating-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/player-rating.css?v=20260830-power-1';
  link.dataset.playerRatingCss = '';
  document.head.append(link);
}

// Route/content modules are intentionally bootstrapped asynchronously. The main-menu controls
// must remain usable even if a secondary encounter/UX module throws during evaluation.
const routeReady = import('./battle-route.mjs').catch((error) => {
  console.error('[RPChess] Route bootstrap failed', error);
  return null;
});
globalThis.RPChessRouteReady = routeReady;

const REBOOT_INIT_KEY = 'rpchess.reboot.v1.initialized';
const SETTINGS_KEY = 'rpchess.reboot.v1.settings';

function clearLegacySavesOnce() {
  if (localStorage.getItem(REBOOT_INIT_KEY) === '1') return;
  const remove = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith('rpchess.') && !key.startsWith('rpchess.reboot.')) remove.push(key);
  }
  for (const key of remove) localStorage.removeItem(key);
  localStorage.setItem(REBOOT_INIT_KEY, '1');
}

function readSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      music: Number.isFinite(value.music) ? value.music : 70,
      sfx: Number.isFinite(value.sfx) ? value.sfx : 80,
      reducedMotion: Boolean(value.reducedMotion)
    };
  } catch {
    return { music: 70, sfx: 80, reducedMotion: false };
  }
}

function writeSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function openModal(modal, audio) {
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add('reboot-modal-open');
  audio?.open();
  modal.querySelector('button, input, select')?.focus();
}

function closeModal(modal, audio) {
  if (!modal || modal.hasAttribute('data-modal-static')) return;
  modal.hidden = true;
  document.body.classList.remove('reboot-modal-open');
  audio?.close();
}

clearLegacySavesOnce();

const settings = readSettings();
const audio = new RebootAudio(settings);
const settingsModal = document.querySelector('[data-settings-modal]');
const music = document.querySelector('[data-music-volume]');
const sfx = document.querySelector('[data-sfx-volume]');
const reducedMotion = document.querySelector('[data-reduced-motion]');

if (music) music.value = String(settings.music);
if (sfx) sfx.value = String(settings.sfx);
if (reducedMotion) reducedMotion.checked = settings.reducedMotion;
document.documentElement.dataset.reducedMotion = settings.reducedMotion ? '1' : '0';

globalThis.RPChessRebootAudio = audio;
globalThis.RPChessOpenSettings = () => openModal(settingsModal, audio);

function activateAudio() { audio.activate(); }
document.addEventListener('pointerdown', activateAudio, { once: true, capture: true });
document.addEventListener('keydown', activateAudio, { once: true, capture: true });

document.querySelector('[data-new-game]')?.addEventListener('click', () => {
  audio.click();
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-new'));
});

document.querySelector('[data-continue-run]')?.addEventListener('click', (event) => {
  if (event.currentTarget.disabled) return;
  audio.click();
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue'));
});

document.querySelectorAll('[data-settings]').forEach((button) => {
  button.addEventListener('click', () => {
    audio.click();
    openModal(settingsModal, audio);
  });
});

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => closeModal(button.closest('.reboot-modal'), audio));
});

document.querySelectorAll('.reboot-modal:not([data-modal-static])').forEach((modal) => {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal(modal, audio);
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const open = [...document.querySelectorAll('.reboot-modal:not([data-modal-static])')].find((modal) => !modal.hidden);
  if (open) closeModal(open, audio);
});

function saveSettings({ previewSfx = false } = {}) {
  settings.music = Number(music?.value ?? settings.music);
  settings.sfx = Number(sfx?.value ?? settings.sfx);
  settings.reducedMotion = Boolean(reducedMotion?.checked);
  writeSettings(settings);
  document.documentElement.dataset.reducedMotion = settings.reducedMotion ? '1' : '0';
  audio.applySettings(settings);
  if (previewSfx) audio.adjust();
}

music?.addEventListener('input', () => saveSettings());
sfx?.addEventListener('input', () => saveSettings({ previewSfx: true }));
reducedMotion?.addEventListener('change', () => {
  audio.click();
  saveSettings();
});

addEventListener('beforeunload', () => audio.destroy(), { once: true });
