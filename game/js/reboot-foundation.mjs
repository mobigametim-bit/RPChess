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

function openModal(modal) {
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  const focusTarget = modal.querySelector('button, input');
  focusTarget?.focus();
}

function closeModal(modal) {
  modal.hidden = true;
  document.body.style.overflow = '';
}

clearLegacySavesOnce();

const settings = readSettings();
const settingsModal = document.querySelector('[data-settings-modal]');
const foundationModal = document.querySelector('[data-foundation-modal]');
const music = document.querySelector('[data-music-volume]');
const sfx = document.querySelector('[data-sfx-volume]');
const reducedMotion = document.querySelector('[data-reduced-motion]');

if (music) music.value = String(settings.music);
if (sfx) sfx.value = String(settings.sfx);
if (reducedMotion) reducedMotion.checked = settings.reducedMotion;
document.documentElement.dataset.reducedMotion = settings.reducedMotion ? '1' : '0';

document.querySelector('[data-new-game]')?.addEventListener('click', () => openModal(foundationModal));
document.querySelector('[data-settings]')?.addEventListener('click', () => openModal(settingsModal));

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => closeModal(button.closest('.reboot-modal')));
});

document.querySelectorAll('.reboot-modal').forEach((modal) => {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal(modal);
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const open = [...document.querySelectorAll('.reboot-modal')].find((modal) => !modal.hidden);
  if (open) closeModal(open);
});

function saveSettings() {
  settings.music = Number(music?.value ?? settings.music);
  settings.sfx = Number(sfx?.value ?? settings.sfx);
  settings.reducedMotion = Boolean(reducedMotion?.checked);
  writeSettings(settings);
  document.documentElement.dataset.reducedMotion = settings.reducedMotion ? '1' : '0';
}

music?.addEventListener('input', saveSettings);
sfx?.addEventListener('input', saveSettings);
reducedMotion?.addEventListener('change', saveSettings);
