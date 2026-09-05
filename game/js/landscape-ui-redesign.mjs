import { currentLanguage, subscribe } from './i18n.mjs';

const CSS_MARKER = 'data-landscape-ui-css';
const BOARD_EDGE_STYLE_MARKER = 'data-landscape-board-edge-style';

function ensureStylesheet() {
  if (document.querySelector(`[${CSS_MARKER}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/landscape-ui-redesign.css?v=20260905-1';
  link.setAttribute(CSS_MARKER, '');
  document.head.append(link);
}

function ensureBoardEdgeStyle() {
  if (document.querySelector(`[${BOARD_EDGE_STYLE_MARKER}]`)) return;
  const style = document.createElement('style');
  style.setAttribute(BOARD_EDGE_STYLE_MARKER, '');
  style.textContent = `
@media (orientation: landscape) {
  .classic-board-wrap > .board-coordinate-frame,
  .puzzle-board-wrap > .board-coordinate-frame {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    display: block !important;
    box-sizing: border-box !important;
  }
  .board-coordinate-ranks,
  .board-coordinate-files {
    display: none !important;
  }
  .board-coordinate-frame > .classic-board,
  .board-coordinate-frame > .puzzle-board {
    width: 100% !important;
    height: 100% !important;
    aspect-ratio: 1 !important;
    box-sizing: border-box !important;
  }
}`;
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
ensureBoardEdgeStyle();
ensureOrientationLock();
document.documentElement.dataset.landscapeUi = '1';
syncLanguage();
subscribe(syncLanguage);
