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
}

/* Accepted Event landscape contract: narrative stays left, choices stay readable on the right.
   The legacy desktop overlay used two columns inside a narrow choice rail; collapse those choices
   to one internally-scrollable column at tablet/phone landscape widths. */
@media (orientation: landscape) and (max-width: 1180px) {
  body.events-active .events-screen {
    height: 100dvh !important;
    min-height: 0 !important;
    padding: 10px 12px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  body.events-active .events-shell {
    position: relative !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    display: grid !important;
    grid-template-rows: auto minmax(0,1fr) !important;
    gap: 7px !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  body.events-active .events-topbar {
    position: relative !important;
    inset: auto !important;
    grid-row: 1 !important;
    min-height: 48px !important;
    margin: 0 !important;
  }
  body.events-active .events-panel {
    position: relative !important;
    inset: auto !important;
    grid-row: 2 !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    display: grid !important;
    grid-template-columns: minmax(0,1.08fr) minmax(330px,.92fr) !important;
    gap: 10px !important;
    overflow: hidden !important;
    pointer-events: auto !important;
  }
  body.events-active .events-copy-frame,
  body.events-active .events-choice-frame {
    position: relative !important;
    inset: auto !important;
    width: auto !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
    box-sizing: border-box !important;
  }
  body.events-active .events-copy-frame { padding: 14px 16px !important; }
  body.events-active .events-choice-frame { padding: 10px !important; }
  body.events-active .events-choices {
    display: grid !important;
    grid-template-columns: minmax(0,1fr) !important;
    grid-auto-flow: row !important;
    gap: 7px !important;
    align-content: start !important;
  }
  body.events-active .events-choice,
  body.events-active .events-choice:last-child:nth-child(odd) {
    grid-column: auto !important;
    min-width: 0 !important;
    min-height: 0 !important;
    height: auto !important;
  }
  body.events-active .events-choice__head strong,
  body.events-active .events-choice__reaction,
  body.events-active .events-choice__hero-line {
    word-break: normal !important;
    overflow-wrap: normal !important;
    hyphens: none !important;
  }
}

@media (orientation: landscape) and (max-width: 980px) and (max-height: 520px) {
  body.events-active .events-screen { padding: 5px 7px !important; }
  body.events-active .events-shell { gap: 4px !important; }
  body.events-active .events-topbar { min-height: 34px !important; }
  body.events-active .events-panel {
    grid-template-columns: minmax(0,1.04fr) minmax(300px,.96fr) !important;
    gap: 6px !important;
  }
  body.events-active .events-copy-frame,
  body.events-active .events-choice-frame { padding: 8px 10px !important; }
  body.events-active .events-choices { gap: 5px !important; }
  body.events-active .events-choice { padding: 7px 9px !important; font-size: 9px !important; }
  body.events-active .events-choice__head strong { font-size: 11px !important; line-height: 1.18 !important; }

  /* Accepted aftermath phone mockup keeps all six named survivors and the continuation CTA
     visible in the same viewport. Compress rows/reward cards instead of making the whole panel scroll. */
  body.compact-aftermath-active .skirmish-aftermath,
  body.compact-aftermath-active .battle-aftermath {
    padding: 5px 7px !important;
    overflow: hidden !important;
  }
  body.compact-aftermath-active .skirmish-aftermath-panel,
  body.compact-aftermath-active .battle-aftermath-panel {
    width: min(816px, calc(100vw - 14px)) !important;
    height: calc(100dvh - 10px) !important;
    max-height: calc(100dvh - 10px) !important;
    min-height: 0 !important;
    display: grid !important;
    grid-template-columns: minmax(0,1fr) minmax(260px,.94fr) !important;
    grid-template-areas:
      'result gold'
      'text power'
      'columns columns'
      'button button' !important;
    grid-template-rows: 42px 34px minmax(0,1fr) 34px !important;
    gap: 3px 10px !important;
    align-items: stretch !important;
    align-content: stretch !important;
    margin: 0 auto !important;
    padding: 8px 10px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  body.compact-aftermath-active .skirmish-aftermath-panel > h1,
  body.compact-aftermath-active .battle-aftermath-panel > h1 {
    align-self: center !important;
    margin: 0 !important;
    font-size: 28px !important;
    line-height: .96 !important;
  }
  body.compact-aftermath-active .skirmish-aftermath-panel > p,
  body.compact-aftermath-active .battle-aftermath-panel > p {
    align-self: start !important;
    margin: 0 !important;
    font-size: 9px !important;
    line-height: 1.18 !important;
  }
  body.compact-aftermath-active .resource-combat-reward,
  body.compact-aftermath-active .power-result {
    width: 100% !important;
    height: 34px !important;
    min-height: 34px !important;
    margin: 0 !important;
    padding: 3px 7px !important;
    box-sizing: border-box !important;
  }
  body.compact-aftermath-active .resource-combat-reward {
    grid-template-columns: 28px minmax(0,1fr) !important;
    gap: 6px !important;
  }
  body.compact-aftermath-active .resource-combat-reward img {
    width: 28px !important;
    height: 28px !important;
  }
  body.compact-aftermath-active .resource-combat-reward::after { font-size: 16px !important; }
  body.compact-aftermath-active .power-result {
    gap: 3px 7px !important;
    padding-left: 43px !important;
  }
  body.compact-aftermath-active .power-result::before {
    left: 5px !important;
    width: 28px !important;
    height: 28px !important;
  }
  body.compact-aftermath-active .power-result__value { font-size: 14px !important; }
  body.compact-aftermath-active .power-result__delta { font-size: 9px !important; }
  body.compact-aftermath-active .power-result__threat { display: none !important; }
  body.compact-aftermath-active .skirmish-aftermath-columns,
  body.compact-aftermath-active .battle-aftermath-columns {
    min-height: 0 !important;
    height: 100% !important;
    display: grid !important;
    grid-template-columns: repeat(2,minmax(0,1fr)) !important;
    gap: 6px !important;
    margin: 2px 0 0 !important;
    padding-top: 4px !important;
    overflow: hidden !important;
  }
  body.compact-aftermath-active .skirmish-aftermath-columns > section,
  body.compact-aftermath-active .battle-aftermath-columns > section {
    min-height: 0 !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    padding: 5px 7px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  body.compact-aftermath-active .skirmish-aftermath-columns h2,
  body.compact-aftermath-active .battle-aftermath-columns h2 {
    flex: 0 0 auto !important;
    margin: 0 0 3px !important;
    font-size: 17px !important;
    line-height: 1 !important;
  }
  body.compact-aftermath-active .skirmish-aftermath-list,
  body.compact-aftermath-active .battle-aftermath-list {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    max-height: none !important;
    display: grid !important;
    grid-auto-rows: minmax(0,1fr) !important;
    gap: 2px !important;
    overflow: hidden !important;
    padding: 0 !important;
  }
  body.compact-aftermath-active .skirmish-aftermath-row,
  body.compact-aftermath-active .battle-aftermath-row {
    min-height: 0 !important;
    height: 100% !important;
    grid-template-columns: 25px minmax(0,1fr) auto !important;
    gap: 5px !important;
    padding: 1px 4px !important;
    box-sizing: border-box !important;
  }
  body.compact-aftermath-active .skirmish-aftermath-row img,
  body.compact-aftermath-active .battle-aftermath-row img {
    width: 23px !important;
    height: 23px !important;
  }
  body.compact-aftermath-active .skirmish-aftermath-row strong,
  body.compact-aftermath-active .battle-aftermath-row strong { font-size: 9px !important; }
  body.compact-aftermath-active .skirmish-aftermath-row span,
  body.compact-aftermath-active .battle-aftermath-row span { font-size: 7px !important; }
  body.compact-aftermath-active .skirmish-aftermath-empty,
  body.compact-aftermath-active .battle-aftermath-empty { font-size: 9px !important; line-height: 1.2 !important; }
  body.compact-aftermath-active .skirmish-aftermath-button,
  body.compact-aftermath-active .battle-aftermath-button {
    align-self: stretch !important;
    justify-self: center !important;
    width: min(300px,100%) !important;
    min-height: 31px !important;
    height: 31px !important;
    margin: 0 !important;
    padding: 3px 8px !important;
    font-size: 11px !important;
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
