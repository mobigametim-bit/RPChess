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
  .classic-screen,
  .puzzle-screen {
    width: 100vw !important;
    height: 100dvh !important;
    min-height: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
  }
  .classic-shell,
  .puzzle-shell {
    width: 100vw !important;
    max-width: none !important;
    height: 100dvh !important;
    margin: 0 !important;
    display: grid !important;
    grid-template-columns: calc(100vw - 100dvh) 100dvh !important;
    gap: 0 !important;
    align-items: stretch !important;
  }
  .classic-shell {
    grid-template-rows: auto minmax(0, 1fr) minmax(86px, .42fr) !important;
  }
  .puzzle-shell {
    grid-template-rows: auto auto minmax(0, 1fr) !important;
  }
  .classic-main {
    position: fixed !important;
    z-index: 20 !important;
    top: 0 !important;
    right: 0 !important;
    bottom: auto !important;
    left: auto !important;
    grid-column: auto !important;
    grid-row: auto !important;
    width: 100dvh !important;
    height: 100dvh !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
  }
  .classic-board-wrap {
    position: absolute !important;
    inset: 0 !important;
    width: 100dvh !important;
    height: 100dvh !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
    aspect-ratio: 1 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  .puzzle-board-wrap {
    position: fixed !important;
    z-index: 20 !important;
    top: 0 !important;
    right: 0 !important;
    bottom: auto !important;
    left: auto !important;
    grid-column: auto !important;
    grid-row: auto !important;
    width: 100dvh !important;
    height: 100dvh !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
    aspect-ratio: 1 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
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
  .board-coordinate-files,
  .classic-coordinate,
  .puzzle-coordinate {
    display: none !important;
  }
  .board-coordinate-frame > .classic-board,
  .board-coordinate-frame > .puzzle-board,
  .classic-board,
  .puzzle-board {
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    aspect-ratio: 1 !important;
    margin: 0 !important;
    padding: 0 !important;
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
