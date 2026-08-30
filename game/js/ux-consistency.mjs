const GOLD_ICON = 'generated_assets/reward_gold.png';
// Existing campaign-map shop asset: a merchant pouch / supply-stall symbol designed to stay readable at icon size.
const SUPPLIES_ICON = 'generated_assets/node_shop.png';
const BOARD_SELECTOR = '.classic-board[data-chess-board], .puzzle-board[data-puzzle-board]';
const SKIP_TEXT_PARENTS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION', 'NOSCRIPT']);
const SUPPLY_ICON_HOLDER_SELECTOR = '.resource-chip__supply-icon, [aria-labelledby="settlement-supplies-title"] .settlement-service__icon';

function ensureCss() {
  if (document.querySelector('[data-ux-consistency-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/ux-consistency.css?v=20260831-1';
  link.dataset.uxConsistencyCss = '';
  document.head.append(link);
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

function syncBoard(board) {
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

let refreshQueued = false;
function refresh() {
  refreshQueued = false;
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

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'characterData') {
      iconizeTextNode(mutation.target);
      continue;
    }
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.TEXT_NODE) iconizeTextNode(node);
      else if (node instanceof Element) {
        replaceSupplyDiamonds(node);
        iconizeText(node);
        if (node.matches?.(BOARD_SELECTOR) || node.querySelector?.(BOARD_SELECTOR) || node.closest?.(BOARD_SELECTOR)) scheduleRefresh();
      }
    }
    if (mutation.target instanceof Element && mutation.target.matches?.(BOARD_SELECTOR)) scheduleRefresh();
  }
});
observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });

globalThis.RPChessResourceIcons = Object.freeze({ GOLD_ICON, SUPPLIES_ICON, refresh:scheduleRefresh });
