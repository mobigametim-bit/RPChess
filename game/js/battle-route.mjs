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

// The phone-landscape aftermath panel is sized against the viewport. Make the screen itself
// border-box so its 5px safe-area padding cannot add 10px beyond 100dvh and push the CTA offscreen.
if (!document.querySelector('[data-landscape-aftermath-viewport-fix]')) {
  const style = document.createElement('style');
  style.dataset.landscapeAftermathViewportFix = '';
  style.textContent = `
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
