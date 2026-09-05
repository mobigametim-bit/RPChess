const GOLD_ICON = 'generated_assets/reward_gold.png';
// Existing campaign-map shop asset: a merchant pouch / supply-stall symbol designed to stay readable at icon size.
const SUPPLIES_ICON = 'generated_assets/node_shop.png';
const BOARD_SELECTOR = '.classic-board[data-chess-board], .puzzle-board[data-puzzle-board]';
const SKIP_TEXT_PARENTS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION', 'NOSCRIPT']);
const SUPPLY_ICON_HOLDER_SELECTOR = '.resource-chip__supply-icon, [aria-labelledby="settlement-supplies-title"] .settlement-service__icon';
const LANDSCAPE_ACCEPTANCE_STYLE = 'data-landscape-acceptance-revision-style';

function ensureCss() {
  if (!document.querySelector('[data-ux-consistency-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/ux-consistency.css?v=20260901-playtest-pass1';
    link.dataset.uxConsistencyCss = '';
    document.head.append(link);
  }
  if (!document.querySelector('[data-playtest-fixes-css]')) {
    const fixes = document.createElement('link');
    fixes.rel = 'stylesheet';
    fixes.href = 'css/playtest-fixes.css?v=20260831-1';
    fixes.dataset.playtestFixesCss = '';
    document.head.append(fixes);
  }
}

function ensureLandscapeAcceptanceRevision() {
  if (document.querySelector(`[${LANDSCAPE_ACCEPTANCE_STYLE}]`)) return;
  const style = document.createElement('style');
  style.setAttribute(LANDSCAPE_ACCEPTANCE_STYLE, '');
  style.textContent = `
/* Human Acceptance revision 2 — only the four requested responsive corrections. */
@media (orientation: landscape) and (max-width: 980px) and (max-height: 520px) {
  /* Travel: route icon owns a fixed left rail; title/meta start to its right. */
  html[data-landscape-ui='1'] body.travel-choice-active .travel-choice-card__icon {
    left: 10px !important;
    top: 50% !important;
    width: 42px !important;
    height: 42px !important;
    transform: translateY(-50%) !important;
    transform-origin: center !important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active .travel-choice-card__overlay {
    left: 62px !important;
    right: 7px !important;
    top: 5px !important;
    bottom: 5px !important;
    width: auto !important;
    padding: 0 !important;
    box-sizing: border-box !important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active .travel-choice-card__type,
  html[data-landscape-ui='1'] body.travel-choice-active .travel-choice-card__threat,
  html[data-landscape-ui='1'] body.travel-choice-active .travel-choice-card__safe,
  html[data-landscape-ui='1'] body.travel-choice-active .travel-choice-card__meta {
    min-width: 0 !important;
  }

  /* Settlement phone: keep service emblems above the copy instead of over it. */
  html[data-landscape-ui='1'] body.settlement-active .settlement-service__icon {
    top: 1px !important;
    right: 7px !important;
    transform: scale(.66) !important;
    transform-origin: top right !important;
  }
  html[data-landscape-ui='1'] body.settlement-active .settlement-service h2 {
    padding-right: 48px !important;
    box-sizing: border-box !important;
  }

  /* Run summary phone: remove decorative wordmark and make all four metric rows fit fully. */
  html[data-landscape-ui='1'] body.endless-run-active .endless-run-logo {
    display: none !important;
  }
  html[data-landscape-ui='1'] body.endless-run-active .endless-run-screen {
    width: 100vw !important;
    height: 100dvh !important;
    min-height: 0 !important;
    max-height: 100dvh !important;
    padding: 5px 7px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  html[data-landscape-ui='1'] body.endless-run-active .endless-run-shell {
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    display: grid !important;
    place-items: center !important;
    box-sizing: border-box !important;
  }
  html[data-landscape-ui='1'] body.endless-run-active .endless-run-panel {
    width: min(830px, 100%) !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: 100% !important;
    margin: 0 !important;
    padding: 9px 11px !important;
    grid-template-columns: minmax(230px,.8fr) minmax(0,1.2fr) !important;
    grid-template-rows: auto auto minmax(0,1fr) auto !important;
    gap: 5px 10px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  html[data-landscape-ui='1'] body.endless-run-active .endless-run-metrics {
    height: 100% !important;
    min-height: 0 !important;
    max-height: 100% !important;
    grid-template-columns: repeat(2,minmax(0,1fr)) !important;
    grid-template-rows: repeat(4,minmax(0,1fr)) !important;
    grid-auto-rows: minmax(0,1fr) !important;
    gap: 4px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  html[data-landscape-ui='1'] body.endless-run-active .endless-run-metric {
    min-height: 0 !important;
    height: auto !important;
    padding: 5px 7px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }

  /* Portrait lock is deliberately bilingual so the English rotate instruction is visible too. */
  html[data-landscape-ui='1'] .landscape-orientation-lock__ru,
  html[data-landscape-ui='1'] .landscape-orientation-lock__en {
    display: block !important;
  }
}

@media (orientation: portrait) and (max-width: 1180px) {
  html[data-landscape-ui='1'] .landscape-orientation-lock {
    grid-template-areas:
      'device rotate'
      'label-ru label-ru'
      'label-en label-en' !important;
    row-gap: 12px !important;
  }
  html[data-landscape-ui='1'] .landscape-orientation-lock__ru {
    grid-area: label-ru !important;
    display: block !important;
  }
  html[data-landscape-ui='1'] .landscape-orientation-lock__en {
    grid-area: label-en !important;
    display: block !important;
    color: rgba(224,229,236,.82) !important;
    font-family: Inter, system-ui, sans-serif !important;
    font-size: clamp(18px,4vw,26px) !important;
    font-weight: 700 !important;
    line-height: 1.05 !important;
    letter-spacing: .04em !important;
    text-align: center !important;
  }
}

/* Tablet Settlement: Tavern is the primary left column; Healer and Market stack on the right. */
@media (orientation: landscape) and (min-width: 981px) and (max-width: 1180px) {
  html[data-landscape-ui='1'] body.settlement-active .settlement-services {
    height: 100% !important;
    min-height: 0 !important;
    display: grid !important;
    grid-template-columns: minmax(0,1.72fr) minmax(300px,.88fr) !important;
    grid-template-rows: repeat(2,minmax(0,1fr)) !important;
    gap: 10px !important;
    align-items: stretch !important;
    overflow: hidden !important;
  }
  html[data-landscape-ui='1'] body.settlement-active .settlement-service:nth-child(1) {
    grid-column: 2 !important;
    grid-row: 1 !important;
  }
  html[data-landscape-ui='1'] body.settlement-active .settlement-service--tavern {
    grid-column: 1 !important;
    grid-row: 1 / 3 !important;
  }
  html[data-landscape-ui='1'] body.settlement-active .settlement-service:nth-child(3) {
    grid-column: 2 !important;
    grid-row: 2 !important;
  }
  html[data-landscape-ui='1'] body.settlement-active .settlement-service {
    min-height: 0 !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  html[data-landscape-ui='1'] body.settlement-active .settlement-service--tavern .settlement-recruits {
    min-height: 0 !important;
    height: 100% !important;
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
  }
}
`;
  document.head.append(style);
}

function resourceIcon(type) {
  const image = document.createElement('img');
  image.className = `resource-inline-icon resource-inline-icon--${type}`;
  image.src = type === 'gold' ? GOLD_ICON : SUPPLIES_ICON;
  image.alt = '';
  image.draggable = false;
  image.setAttribute('aria-hidden', 'true');
  return image;
}

function resourceName(type, amountText = '') {
  const amount = Math.abs(Number.parseInt(String(amountText).replace(/[^0-9-]/g, ''), 10) || 0);
  if (type === 'gold') return `${amountText} золота`;
  return `${amountText} ${amount === 1 ? 'припас' : 'припасов'}`;
}

function resourceAmount(type, amountText) {
  const span = document.createElement('span');
  span.className = `resource-inline resource-inline--${type}`;
  span.setAttribute('aria-label', resourceName(type, amountText));
  const amount = document.createElement('span');
  amount.className = 'resource-inline__amount';
  amount.textContent = amountText;
  span.append(amount, resourceIcon(type));
  return span;
}

const RESOURCE_WORD = 'gold|золота|золото|припас(?:ы|а|ов)?';
const RESOURCE_PATTERN = new RegExp(`([+-]?\\d+)\\s*(${RESOURCE_WORD})|(${RESOURCE_WORD})\\s*[:·]?\\s*([+-]?\\d+)`, 'giu');

function iconizeTextNode(node) {
  const parent = node.parentElement;
  if (!parent || SKIP_TEXT_PARENTS.has(parent.tagName) || parent.closest('.resource-inline')) return;
  const value = node.nodeValue || '';
  RESOURCE_PATTERN.lastIndex = 0;
  if (!RESOURCE_PATTERN.test(value)) return;
  RESOURCE_PATTERN.lastIndex = 0;
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const match of value.matchAll(RESOURCE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) fragment.append(document.createTextNode(value.slice(cursor, index)));
    const word = String(match[2] || match[3] || '').toLowerCase();
    const amountText = match[1] || match[4] || '0';
    const type = word === 'gold' || word.startsWith('золот') ? 'gold' : 'supplies';
    fragment.append(resourceAmount(type, amountText));
    cursor = index + match[0].length;
  }
  if (cursor < value.length) fragment.append(document.createTextNode(value.slice(cursor)));
  node.replaceWith(fragment);
}

function iconizeText(root = document.body) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    iconizeTextNode(root);
    return;
  }
  if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) iconizeTextNode(node);
}

function replaceSupplyDiamonds(root = document) {
  if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) return;
  const candidates = [];
  if (root instanceof Element && root.matches(SUPPLY_ICON_HOLDER_SELECTOR)) candidates.push(root);
  candidates.push(...(root.querySelectorAll?.(SUPPLY_ICON_HOLDER_SELECTOR) || []));
  for (const holder of candidates) {
    if (holder.querySelector('img')) continue;
    holder.textContent = '';
    const image = resourceIcon('supplies');
    image.classList.add('resource-chip__supply-image');
    holder.append(image);
  }
}

function visibleAxes(board) {
  const squares = [...board.querySelectorAll(':scope > [data-square]')];
  if (squares.length !== 64) return null;
  const files = squares.slice(0, 8).map((square) => square.dataset.square?.[0] || '');
  const ranks = Array.from({ length: 8 }, (_, index) => squares[index * 8]?.dataset.square?.[1] || '');
  return files.every(Boolean) && ranks.every(Boolean) ? { files, ranks } : null;
}

function axis(className, values, label) {
  const root = document.createElement('div');
  root.className = className;
  root.setAttribute('aria-label', label);
  root.setAttribute('aria-hidden', 'true');
  for (const value of values) {
    const item = document.createElement('span');
    item.textContent = value;
    root.append(item);
  }
  return root;
}

function ensureBoardFrame(board) {
  let frame = board.parentElement?.matches('.board-coordinate-frame') ? board.parentElement : null;
  if (!frame) {
    frame = document.createElement('div');
    frame.className = 'board-coordinate-frame';
    board.parentNode?.insertBefore(frame, board);
    frame.append(board);
    frame.append(axis('board-coordinate-ranks', Array(8).fill(''), 'Горизонтали доски'));
    frame.append(axis('board-coordinate-files', Array(8).fill(''), 'Вертикали доски'));
  }
  return frame;
}

function removeBoardFrame(board) {
  const frame = board.parentElement?.matches('.board-coordinate-frame') ? board.parentElement : null;
  if (!frame || !frame.parentNode) return;
  frame.parentNode.insertBefore(board, frame);
  frame.remove();
}

function syncBoard(board) {
  if (document.documentElement.dataset.landscapeUi === '1') {
    removeBoardFrame(board);
    return;
  }
  const values = visibleAxes(board);
  if (!values) return;
  const frame = ensureBoardFrame(board);
  const files = frame.querySelector('.board-coordinate-files');
  const ranks = frame.querySelector('.board-coordinate-ranks');
  if (!files || !ranks) return;
  [...files.children].forEach((item, index) => { item.textContent = values.files[index]; });
  [...ranks.children].forEach((item, index) => { item.textContent = values.ranks[index]; });
  frame.dataset.orientation = values.files[0] === 'h' ? 'black' : 'white';
}

function difficultyLabel(encounter) {
  return String(encounter?.label || '').split(' · ')[0].trim();
}

function activeCombat() {
  if (globalThis.RPChessBattle?.battlePlan) return { api:globalThis.RPChessBattle, title:'Битва' };
  if (globalThis.RPChessSkirmish?.battlePlan) return { api:globalThis.RPChessSkirmish, title:'Стычка' };
  return null;
}

function syncCombatSummary() {
  const classic = document.querySelector('[data-classic-screen]');
  const combat = activeCombat();
  if (!classic || classic.hidden || !combat) return;
  const heading = classic.querySelector('.classic-party-panel h2');
  const mode = classic.querySelector('[data-game-mode]');
  const difficulty = difficultyLabel(combat.api.encounter || combat.api.battlePlan?.encounter);
  if (heading && heading.textContent !== combat.title) heading.textContent = combat.title;
  if (mode && difficulty && mode.textContent !== difficulty) mode.textContent = difficulty;
}

function syncPuzzlePresentation() {
  const status = document.querySelector('[data-puzzle-status]');
  const source = 'Ваш ход';
  const localized = globalThis.RPChessI18n?.translateLegacy?.(source) || source;
  if (status && [source, localized].includes(status.textContent.trim())) status.textContent = '';
}

let refreshQueued = false;
function refresh() {
  refreshQueued = false;
  syncCombatSummary();
  syncPuzzlePresentation();
  replaceSupplyDiamonds(document);
  iconizeText(document.body);
  for (const board of document.querySelectorAll(BOARD_SELECTOR)) syncBoard(board);
}
function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refresh);
}

ensureCss();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleRefresh, { once:true });
else scheduleRefresh();

for (const name of [
  'rpchess:run-updated','rpchess:resources-updated','rpchess:power-updated','rpchess:run-continue',
  'rpchess:travel-open','rpchess:skirmish-open','rpchess:battle-open','rpchess:puzzle-open',
  'rpchess:event-open','rpchess:settlement-open','rpchess:starvation-open'
]) addEventListener(name, () => queueMicrotask(scheduleRefresh));

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('button,[data-square],[data-event-choice],[data-puzzle-board]')) queueMicrotask(scheduleRefresh);
}, true);

// This module loads before the landscape layer. Defer the acceptance override by one task so its
// style element is appended after the landscape stylesheet and final board-edge runtime styles.
setTimeout(ensureLandscapeAcceptanceRevision, 0);

globalThis.RPChessResourceIcons = Object.freeze({ GOLD_ICON, SUPPLIES_ICON, refresh:scheduleRefresh });
