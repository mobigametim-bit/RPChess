import './travel-choice-commandbar-pass.mjs';
import { readRun } from './run-persistence.mjs';
import { placeArmy } from './skirmish-core.mjs';

function ensureCss() {
  if (document.querySelector('[data-post-redesign-playtest-pass1b-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/post-redesign-playtest-pass1b.css?v=20260901-3';
  link.dataset.postRedesignPlaytestPass1bCss = '';
  document.head.append(link);
}

function syncFormationMetadata() {
  const root = document.querySelector('[data-skirmish-formation]');
  const api = globalThis.RPChessSkirmish;
  const encounter = api?.encounter;
  const selectedIds = api?.selectedIds;
  const run = readRun();
  if (!root || root.closest('[data-skirmish-screen]')?.hidden || !encounter || !run || !Array.isArray(selectedIds)) return;

  const selected = new Set(selectedIds);
  const members = (run.roster || []).filter((character) => selected.has(character.id));
  const color = encounter.playerColor === 'b' ? 'b' : 'w';
  let placements = [];
  try {
    placements = placeArmy(members, color, { seed: `${encounter.seed}:player` });
  } catch {
    return;
  }

  root.dataset.playerColor = color;
  root.dir = color === 'b' ? 'rtl' : 'ltr';

  const bySquare = new Map(placements.map((piece) => [piece.square, piece]));
  const ranks = color === 'w' ? ['2', '1'] : ['7', '8'];
  const cells = [...root.querySelectorAll('.skirmish-formation-cell')];
  if (cells.length !== 16) return;

  let index = 0;
  for (const rank of ranks) {
    for (const file of 'abcdefgh') {
      const cell = cells[index++];
      const piece = bySquare.get(`${file}${rank}`);
      if (piece?.pieceType) cell.dataset.previewPiece = piece.pieceType;
      else delete cell.dataset.previewPiece;
    }
  }
}

let queued = false;
function scheduleSync() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    syncFormationMetadata();
  });
}

ensureCss();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleSync, { once: true });
else scheduleSync();

addEventListener('rpchess:skirmish-open', () => queueMicrotask(scheduleSync));
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('[data-skirmish-character], [data-selected-character]')) queueMicrotask(scheduleSync);
}, true);

new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'characterData') {
      if (mutation.target.parentElement?.closest('[data-skirmish-formation]')) return scheduleSync();
      continue;
    }
    if (mutation.target instanceof Element && mutation.target.closest?.('[data-skirmish-formation]')) return scheduleSync();
    for (const node of mutation.addedNodes) {
      if (node instanceof Element && (node.matches?.('[data-skirmish-formation], .skirmish-formation-cell') || node.querySelector?.('[data-skirmish-formation]'))) return scheduleSync();
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });

globalThis.RPChessPostRedesignPlaytestPass1b = Object.freeze({ sync: scheduleSync });
