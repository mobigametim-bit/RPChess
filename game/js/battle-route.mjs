import './player-rating-runtime.mjs';
import './endless-run-app.mjs';
import './resources-app.mjs';
import './battle-app.mjs';
import './battle-mercenaries.mjs';
import './settlement-app.mjs';
import './starvation-app.mjs';
import './events-app.mjs';
import './events/combat-art-continuity.mjs';
import './puzzles/puzzle-app.mjs';
import './travel-choice-app.mjs';
import './ux-consistency.mjs';
import './post-redesign-playtest-pass1b.mjs';
import './content/hero-notes-runtime.mjs';
// Acceptance pass 5: themed scene backgrounds, matched board sizing and victory presentation.
import './cross-scene-visuals.mjs';
// Approved landscape-only presentation layer is evaluated last so it can override legacy responsive rules.
import './landscape-ui-redesign.mjs';

// Aftermath already contains the reward and Power result. Suppress transient reward/payment toasts
// there so they cannot cover those canonical result cards, and preserve semantic hidden sections.
if (!document.querySelector('[data-landscape-aftermath-viewport-fix]')) {
  const style = document.createElement('style');
  style.dataset.landscapeAftermathViewportFix = '';
  style.textContent = `
@media (orientation: landscape) {
  html[data-landscape-ui='1'] body.compact-aftermath-active .resource-toast,
  html[data-landscape-ui='1'] body.compact-aftermath-active .battle-toast {
    display: none !important;
  }
  html[data-landscape-ui='1'] body.compact-aftermath-active .skirmish-aftermath-columns > section[hidden],
  html[data-landscape-ui='1'] body.compact-aftermath-active .battle-aftermath-columns > section[hidden] {
    display: none !important;
  }
}
@media (orientation: landscape) and (max-width: 980px) and (max-height: 520px) {
  html[data-landscape-ui='1'] body.compact-aftermath-active .skirmish-aftermath,
  html[data-landscape-ui='1'] body.compact-aftermath-active .battle-aftermath {
    width: 100vw !important;
    height: 100dvh !important;
    min-height: 0 !important;
    max-height: 100dvh !important;
    box-sizing: border-box !important;
  }
  html[data-landscape-ui='1'] body.compact-aftermath-active .skirmish-aftermath-shell,
  html[data-landscape-ui='1'] body.compact-aftermath-active .battle-aftermath-shell {
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: 100% !important;
    box-sizing: border-box !important;
  }
}`;
  document.head.append(style);
}

// Accepted Battle Prep phone layout: six personal fighters stay visible in a 2x3 grid on the
// left, while formation/mercenary summary and the Start Battle CTA remain simultaneously visible
// in the right rail. Legacy compact CSS has higher selector specificity, so this final override
// deliberately matches that specificity instead of relying on stylesheet load order alone.
if (!document.querySelector('[data-landscape-battle-prep-viewport-fix]')) {
  const style = document.createElement('style');
  style.dataset.landscapeBattlePrepViewportFix = '';
  style.textContent = `
@media (orientation: landscape) and (max-width: 980px) and (max-height: 520px) {
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-screen {
    width: 100vw !important;
    height: 100dvh !important;
    min-height: 0 !important;
    max-height: 100dvh !important;
    padding: 5px 7px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-shell {
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: 100% !important;
    display: grid !important;
    grid-template-rows: auto minmax(0,1fr) !important;
    gap: 4px !important;
    padding: 0 !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-heading {
    grid-row: 1 !important;
    display: grid !important;
    grid-template-columns: minmax(0,1fr) auto !important;
    align-items: end !important;
    gap: 8px !important;
    margin: 0 !important;
    padding: 0 5px 4px !important;
    min-height: 0 !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-heading .reboot-eyebrow {
    font-size: 8px !important;
    line-height: 1 !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-heading h1 {
    margin: 1px 0 2px !important;
    font-size: 22px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-heading p {
    margin: 0 !important;
    font-size: 7px !important;
    line-height: 1.08 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-threat-card {
    min-width: 245px !important;
    max-width: 245px !important;
    min-height: 0 !important;
    padding: 5px 8px !important;
    transform: none !important;
    box-sizing: border-box !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-threat-card strong {
    display: inline-block !important;
    margin-right: 7px !important;
    font-size: 13px !important;
    line-height: 1 !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-threat-card span {
    display: inline !important;
    font-size: 7px !important;
    line-height: 1.05 !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-threat-card small {
    display: block !important;
    margin-top: 2px !important;
    font-size: 6px !important;
    line-height: 1.05 !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-layout {
    grid-row: 2 !important;
    display: grid !important;
    grid-template-columns: minmax(0,1fr) minmax(280px,34%) !important;
    grid-template-rows: minmax(0,1fr) !important;
    gap: 6px !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-roster,
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army {
    min-width: 0 !important;
    min-height: 0 !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 6px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-roster {
    grid-column: 1 !important;
    grid-row: 1 !important;
    display: grid !important;
    grid-template-rows: auto minmax(0,1fr) !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army {
    grid-column: 2 !important;
    grid-row: 1 !important;
    padding-bottom: 43px !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-section-head {
    min-height: 0 !important;
    margin: 0 0 3px !important;
    gap: 4px !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-section-head h2 {
    margin: 0 !important;
    font-size: 16px !important;
    line-height: 1 !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-roster .battle-section-head > span {
    display: none !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army .battle-section-head > span {
    max-width: 150px !important;
    font-size: 5.5px !important;
    line-height: 1.05 !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-grid {
    display: grid !important;
    grid-template-columns: repeat(2,minmax(0,1fr)) !important;
    grid-template-rows: repeat(3,minmax(0,1fr)) !important;
    grid-auto-rows: minmax(0,1fr) !important;
    gap: 4px !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
    padding: 0 !important;
    overflow: hidden !important;
    align-content: stretch !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-card {
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
    display: grid !important;
    grid-template-columns: 45px minmax(0,1fr) 38px !important;
    gap: 3px !important;
    padding: 0 !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-card__art {
    width: 45px !important;
    height: 100% !important;
    min-height: 0 !important;
    padding: 1px !important;
    object-fit: contain !important;
    align-self: stretch !important;
    box-sizing: border-box !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-card__body {
    min-width: 0 !important;
    gap: 1px !important;
    padding: 2px 0 !important;
    align-self: center !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-card__body strong {
    font-size: 9px !important;
    line-height: 1.05 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-card__meta {
    display: none !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-card__status {
    font-size: 6px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-card__tech-glyph {
    width: 38px !important;
    min-width: 38px !important;
    font-size: 31px !important;
    line-height: 1 !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-slot-summary {
    display: grid !important;
    grid-template-columns: repeat(3,minmax(0,1fr)) !important;
    gap: 2px !important;
    margin: 0 0 3px !important;
    overflow: visible !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-slot-chip {
    min-width: 0 !important;
    padding: 2px 2px !important;
    font-size: 5.5px !important;
    line-height: 1 !important;
    text-align: center !important;
    white-space: nowrap !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-formation {
    margin: 0 0 3px !important;
    gap: 1px !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-formation-cell {
    min-height: 0 !important;
    font-size: 8px !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-participants {
    display: none !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-mercenary-quote {
    margin-top: 3px !important;
    padding-top: 3px !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-mercenary-quote__title {
    margin-bottom: 2px !important;
    font-size: 6px !important;
    line-height: 1 !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-mercenary-quote__row {
    min-height: 20px !important;
    padding: 2px 5px !important;
    font-size: 7px !important;
    line-height: 1 !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-actionbar {
    position: absolute !important;
    z-index: 20 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 34% !important;
    min-width: 280px !important;
    max-width: 34% !important;
    margin: 0 !important;
    padding: 4px 6px 5px !important;
    grid-template-columns: 1fr !important;
    gap: 2px !important;
    box-sizing: border-box !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-action-cost,
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-counter {
    display: none !important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-actionbar .battle-start {
    width: 100% !important;
    height: 31px !important;
    min-height: 31px !important;
    margin: 0 !important;
    padding: 3px 6px !important;
    font-size: 11px !important;
  }
}`;
  document.head.append(style);
}

// ui-redesign-final batches its lifecycle refresh in requestAnimationFrame. Keep the two compact
// scene flags in sync on hidden-attribute mutations as well so a newly visible screen never paints
// one transient legacy frame (and geometry checks do not race that frame).
if (!globalThis.__RPChessLandscapeVisibilitySync) {
  const syncVisibilityClasses = () => {
    const skirmishAftermath = document.querySelector('[data-skirmish-aftermath]');
    const battleAftermath = document.querySelector('[data-battle-aftermath]');
    const battlePrep = document.querySelector('[data-battle-screen]');
    document.body.classList.toggle('compact-aftermath-active', Boolean((skirmishAftermath && !skirmishAftermath.hidden) || (battleAftermath && !battleAftermath.hidden)));
    document.body.classList.toggle('battle-prep-compact-active', Boolean(battlePrep && !battlePrep.hidden));
  };
  const app = document.querySelector('#app') || document.body;
  new MutationObserver(syncVisibilityClasses).observe(app, { subtree:true, childList:true, attributes:true, attributeFilter:['hidden'] });
  syncVisibilityClasses();
  globalThis.__RPChessLandscapeVisibilitySync = true;
}
