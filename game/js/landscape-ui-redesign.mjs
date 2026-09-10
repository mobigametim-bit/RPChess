import { currentLanguage, subscribe } from './i18n.mjs';

const CSS_MARKER = 'data-landscape-ui-css';
const COMPACT_COMBAT_AIR_MARKER = 'data-compact-combat-air-css';

function ensureStylesheet() {
  if (document.querySelector(`[${CSS_MARKER}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/landscape-ui-redesign.css?v=20260905-1';
  link.setAttribute(CSS_MARKER, '');
  document.head.append(link);
}

function ensureCompactCombatAirGap() {
  if (document.querySelector(`[${COMPACT_COMBAT_AIR_MARKER}]`)) return;
  const style = document.createElement('style');
  style.setAttribute(COMPACT_COMBAT_AIR_MARKER, '');
  style.textContent = `
    html[data-landscape-ui='1'] body.compact-combat-active .classic-party-panel,
    html[data-landscape-ui='1'] body.compact-combat-active .classic-panel--moves {
      width: min(
        calc(100vw - 100dvh - 4px),
        max(220px, calc(48vw - 48dvh - 2px))
      ) !important;
      max-width: none !important;
      justify-self: start !important;
      box-sizing: border-box !important;
    }
  `;
  document.head.append(style);
}

function ensureOrientationLock() {
  let root = document.querySelector('[data-orientation-lock]');
  if (root) return root;
  root = document.createElement('div');
  root.className = 'landscape-orientation-lock';
  root.dataset.orientationLock = '';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.innerHTML = `
    <div class="landscape-orientation-lock__device" aria-hidden="true">
      <span class="landscape-orientation-lock__screen"></span>
    </div>
    <div class="landscape-orientation-lock__rotate" aria-hidden="true">↻</div>
    <strong class="landscape-orientation-lock__ru">Поверните устройство</strong>
    <strong class="landscape-orientation-lock__en">Rotate device</strong>`;
  document.body.append(root);
  return root;
}

function syncLanguage(language = currentLanguage()) {
  document.documentElement.dataset.orientationLanguage = language === 'en' ? 'en' : 'ru';
}

ensureStylesheet();
ensureCompactCombatAirGap();
ensureOrientationLock();
document.documentElement.dataset.landscapeUi = '1';
syncLanguage();
subscribe(syncLanguage);
