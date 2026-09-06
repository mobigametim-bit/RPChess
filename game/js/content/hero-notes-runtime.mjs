import './post-pages-ui-polish-constraints.mjs';
import '../post-pages-ui-polish.mjs';
import './post-pages-ui-review2.mjs';
import './post-pages-ui-review3.mjs';
import './post-pages-ui-review4.mjs';
import { heroNoteForId } from './hero-notes.mjs';

function acceptedNote(note, current) {
  const translated = globalThis.RPChessI18n?.translateLegacy?.(note) || note;
  return current === note || current === translated;
}

function applyRosterNote(root = document) {
  const selected = root.querySelector?.('[data-roster-card][aria-pressed="true"]');
  const description = root.querySelector?.('.roster-detail__description');
  const note = heroNoteForId(selected?.dataset?.rosterCard || '');
  if (description && note && !acceptedNote(note, description.textContent)) description.textContent = note;
}

function applySettlementNotes(root = document) {
  for (const card of root.querySelectorAll?.('[data-settlement-recruit-card]') || []) {
    const note = heroNoteForId(card.dataset?.settlementRecruitCard || '');
    const description = card.querySelector('.settlement-recruit__body > p');
    if (description && note && !acceptedNote(note, description.textContent)) description.textContent = note;
  }
  // The compact Market row is presentation-only. Mark its price node so repeated lifecycle
  // refreshes preserve the same price until the real Settlement renderer updates the stock.
  for (const price of root.querySelectorAll?.('.settlement-supply-card__compact > strong:last-child') || []) {
    price.classList.add('settlement-price');
  }
}

function applyHeroNotes(root = document) {
  applyRosterNote(root);
  applySettlementNotes(root);
}

let scheduled = false;
function scheduleApply() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    applyHeroNotes(document);
  });
}

const app = document.querySelector('#app');
if (app && typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver(scheduleApply);
  observer.observe(app, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'hidden'] });
}

for (const eventName of ['rpchess:run-updated', 'rpchess:run-continue', 'rpchess:settlement-open']) {
  addEventListener(eventName, scheduleApply);
}

// Battle's mercenary quote is intentionally rendered in a zero-delay task after the open event.
// Refresh the presentation after that task so the cost is immediately normalized to icon + value.
addEventListener('rpchess:battle-open', () => {
  setTimeout(() => globalThis.RPChessPostPagesUIPolish?.refresh?.(), 0);
});

applyHeroNotes(document);

globalThis.RPChessHeroNotes = Object.freeze({ apply: applyHeroNotes, noteForId: heroNoteForId });

export { applyHeroNotes };