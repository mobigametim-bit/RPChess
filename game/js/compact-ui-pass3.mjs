import { readRun } from './run-persistence.mjs';

const CSS_HREF = 'css/compact-ui-pass3.css?v=20260902-3';
let queued = false;

function ensureCss() {
  if (document.querySelector('[data-compact-ui-pass3-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  link.dataset.compactUiPass3Css = '';
  document.head.append(link);
}

function visible(root) {
  return Boolean(root && !root.hidden);
}

function ensureSkirmishGlyphs() {
  const screen = document.querySelector('[data-skirmish-screen]');
  if (!screen) return;
  for (const card of screen.querySelectorAll('[data-skirmish-character]')) {
    if (card.querySelector('.skirmish-card__tech-glyph')) continue;
    const meta = card.querySelector('.skirmish-card__meta');
    const glyph = Array.from(meta?.textContent?.trim() || '')[0] || '';
    if (!glyph) continue;
    const mark = document.createElement('span');
    mark.className = 'skirmish-card__tech-glyph';
    mark.textContent = glyph;
    mark.setAttribute('aria-hidden', 'true');
    card.append(mark);
  }
}

function syncSkirmishHeadingStars() {
  const screen = document.querySelector('[data-skirmish-screen]');
  const title = screen?.querySelector('[data-skirmish-title]');
  const stars = screen?.querySelector('[data-skirmish-stars]');
  if (!title || !stars) return;
  title.dataset.compactStars = stars.textContent.trim();
}

function hasHealthySkirmishCompanion(run) {
  return Boolean((run?.roster || []).some((character) => !character.isRunKing && character.status === 'healthy'));
}

function syncTravelSkirmishAvailability() {
  const screen = document.querySelector('[data-travel-choice-screen]');
  if (!visible(screen)) return;
  const run = readRun();
  if (!run || run.ended || run.activeTravelChoice) return;
  const locked = !hasHealthySkirmishCompanion(run);
  for (const card of screen.querySelectorAll('[data-travel-choice][data-travel-type="skirmish"]')) {
    card.disabled = locked;
    card.setAttribute('aria-disabled', locked ? 'true' : 'false');
    card.classList.toggle('is-skirmish-unavailable', locked);
    if (locked) card.title = 'Недоступно: для стычки нужен хотя бы один здоровый герой кроме короля.';
    else if (card.title.startsWith('Недоступно:')) card.removeAttribute('title');
  }
}

function syncAftermathClass() {
  const battleAftermath = document.querySelector('[data-battle-aftermath]');
  const skirmishAftermath = document.querySelector('[data-skirmish-aftermath]');
  document.body.classList.toggle('compact-aftermath-active', visible(battleAftermath) || visible(skirmishAftermath));
}

function refresh() {
  queued = false;
  ensureSkirmishGlyphs();
  syncSkirmishHeadingStars();
  syncTravelSkirmishAvailability();
  syncAftermathClass();
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(refresh);
}

ensureCss();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
else schedule();

addEventListener('rpchess:skirmish-open', schedule);
addEventListener('rpchess:battle-open', schedule);
addEventListener('rpchess:travel-open', schedule);
addEventListener('rpchess:run-continue', schedule);
addEventListener('rpchess:run-updated', schedule);
addEventListener('resize', schedule, { passive: true });

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const lockedSkirmish = target?.closest('[data-travel-choice].is-skirmish-unavailable');
  if (lockedSkirmish) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (target?.closest('[data-skirmish-character],[data-skirmish-start],[data-battle-start],[data-aftermath-continue],[data-battle-continue]')) queueMicrotask(schedule);
}, true);

new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes') return schedule();
    if (mutation.type === 'characterData') {
      if (mutation.target.parentElement?.closest('[data-skirmish-stars]')) return schedule();
      continue;
    }
    if (mutation.target instanceof Element && mutation.target.closest?.('[data-skirmish-stars],[data-travel-routes]')) return schedule();
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches?.('[data-skirmish-character],[data-battle-aftermath],[data-skirmish-aftermath],[data-travel-choice]') ||
          node.querySelector?.('[data-skirmish-character],[data-battle-aftermath],[data-skirmish-aftermath],[data-travel-choice]')) return schedule();
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });

globalThis.RPChessCompactUIPass3 = Object.freeze({ refresh: schedule });
