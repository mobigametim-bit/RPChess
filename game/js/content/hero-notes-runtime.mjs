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

applyHeroNotes(document);

globalThis.RPChessHeroNotes = Object.freeze({ apply: applyHeroNotes, noteForId: heroNoteForId });

export { applyHeroNotes };
