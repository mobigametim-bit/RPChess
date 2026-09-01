const CSS_HREF = 'css/compact-combat-ui-pass.css?v=20260901-1';
let combatPresentation = null;
let queued = false;

const classicScreen = document.querySelector('[data-classic-screen]');
const movePanel = classicScreen?.querySelector('.classic-panel--moves') || null;
const movePanelHome = movePanel?.parentElement || null;
const movePanelNext = movePanel?.nextSibling || null;

function ensureCss() {
  if (document.querySelector('[data-compact-combat-ui-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  link.dataset.compactCombatUiCss = '';
  document.head.append(link);
}

function visible(root) { return Boolean(root && !root.hidden); }
function desktop() { return matchMedia('(min-width: 901px)').matches; }

function restoreMovePanel() {
  if (!movePanel || !movePanelHome || movePanel.parentElement === movePanelHome) return;
  const anchor = movePanelNext?.parentNode === movePanelHome ? movePanelNext : null;
  movePanelHome.insertBefore(movePanel, anchor);
}

function syncCombatBoard() {
  const active = desktop() && visible(classicScreen) && Boolean(combatPresentation);
  document.body.classList.toggle('compact-combat-active', active);
  if (!active) {
    restoreMovePanel();
    return;
  }
  const party = classicScreen.querySelector('.classic-party-panel');
  if (party && movePanel && movePanel.parentElement !== party) party.append(movePanel);
}

function syncPuzzle() {
  const puzzle = document.querySelector('[data-puzzle-screen]');
  const active = visible(puzzle);
  document.body.classList.toggle('compact-puzzle-active', active);
  if (!active) {
    document.body.classList.remove('puzzle-resolved-compact');
    return;
  }
  const outcome = puzzle.querySelector('[data-puzzle-outcome]');
  document.body.classList.toggle('puzzle-resolved-compact', Boolean(outcome && !outcome.hidden));
}

function stripBattleDescription(screen) {
  const description = screen?.querySelector('[data-battle-description]');
  if (!description) return;
  const next = description.textContent
    .replace(/Победа решится по классическим шахматным правилам\.\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (next !== description.textContent) description.textContent = next;
}

function ensureBattleCardGlyphs(screen) {
  for (const card of screen?.querySelectorAll?.('[data-battle-character]') || []) {
    if (card.querySelector('.battle-card__tech-glyph')) continue;
    const meta = card.querySelector('.battle-card__meta');
    const text = meta?.textContent?.trim() || '';
    const glyph = Array.from(text)[0] || '';
    if (!glyph) continue;
    const mark = document.createElement('span');
    mark.className = 'battle-card__tech-glyph';
    mark.textContent = glyph;
    mark.setAttribute('aria-hidden', 'true');
    card.append(mark);
  }
}

function syncBattleStartPlacement(screen, active) {
  const start = screen?.querySelector('[data-battle-start]');
  const actionbar = screen?.querySelector('.battle-actionbar');
  const army = screen?.querySelector('.battle-army');
  if (!start || !actionbar) return;
  if (active && desktop() && army) {
    const quote = army.querySelector('[data-battle-mercenary-quote]');
    if (start.parentElement !== army) {
      if (quote) quote.insertAdjacentElement('afterend', start);
      else army.append(start);
    } else if (quote && start.previousElementSibling !== quote) {
      quote.insertAdjacentElement('afterend', start);
    }
    return;
  }
  if (start.parentElement !== actionbar) actionbar.append(start);
}

function syncBattlePrep() {
  const screen = document.querySelector('[data-battle-screen]');
  const active = visible(screen);
  document.body.classList.toggle('battle-prep-compact-active', active);
  if (!screen) return;
  stripBattleDescription(screen);
  ensureBattleCardGlyphs(screen);
  syncBattleStartPlacement(screen, active);
}

function refresh() {
  queued = false;
  syncCombatBoard();
  syncPuzzle();
  syncBattlePrep();
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(refresh);
}

ensureCss();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true });
else schedule();

addEventListener('resize', schedule, { passive:true });
addEventListener('rpchess:new-game', () => { combatPresentation = null; schedule(); });
addEventListener('rpchess:skirmish-open', schedule);
addEventListener('rpchess:battle-open', schedule);

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  if (target.closest('[data-skirmish-start]')) combatPresentation = 'skirmish';
  else if (target.closest('[data-battle-start]')) combatPresentation = 'battle';
  else if (target.closest('[data-classic-new]')) combatPresentation = null;
  else if (!target.closest('[data-battle-character],[data-battle-participant],[data-puzzle-board],[data-puzzle-continue]')) return;
  queueMicrotask(schedule);
}, true);

new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes') return schedule();
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches?.('[data-battle-screen],[data-puzzle-screen],[data-battle-character],[data-battle-mercenary-quote],.classic-panel--moves') ||
          node.querySelector?.('[data-battle-screen],[data-puzzle-screen],[data-battle-character],[data-battle-mercenary-quote],.classic-panel--moves')) return schedule();
    }
  }
}).observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden'] });

globalThis.RPChessCompactCombatUI = Object.freeze({ refresh:schedule });
