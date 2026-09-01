const CSS_HREF = 'css/compact-ui-pass3.css?v=20260902-2';
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

function syncAftermathClass() {
  const battleAftermath = document.querySelector('[data-battle-aftermath]');
  const skirmishAftermath = document.querySelector('[data-skirmish-aftermath]');
  document.body.classList.toggle('compact-aftermath-active', visible(battleAftermath) || visible(skirmishAftermath));
}

function refresh() {
  queued = false;
  ensureSkirmishGlyphs();
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
addEventListener('rpchess:run-updated', schedule);
addEventListener('resize', schedule, { passive: true });

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('[data-skirmish-character],[data-skirmish-start],[data-battle-start],[data-aftermath-continue],[data-battle-continue]')) queueMicrotask(schedule);
}, true);

new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes') return schedule();
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches?.('[data-skirmish-character],[data-battle-aftermath],[data-skirmish-aftermath]') ||
          node.querySelector?.('[data-skirmish-character],[data-battle-aftermath],[data-skirmish-aftermath]')) return schedule();
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

globalThis.RPChessCompactUIPass3 = Object.freeze({ refresh: schedule });
