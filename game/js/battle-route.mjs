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
import './presentation-bootstrap.mjs';
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

// ui-redesign-final owns the Battle Prep lifecycle class until its remaining CTA reparenting is
// replaced by a stable owner slot. battle-route only keeps the aftermath visibility bridge here.
if (!globalThis.__RPChessLandscapeVisibilitySync) {
  const syncVisibilityClasses = () => {
    const skirmishAftermath = document.querySelector('[data-skirmish-aftermath]');
    const battleAftermath = document.querySelector('[data-battle-aftermath]');
    document.body.classList.toggle('compact-aftermath-active', Boolean((skirmishAftermath && !skirmishAftermath.hidden) || (battleAftermath && !battleAftermath.hidden)));
  };
  const app = document.querySelector('#app') || document.body;
  new MutationObserver(syncVisibilityClasses).observe(app, { subtree:true, childList:true, attributes:true, attributeFilter:['hidden'] });
  syncVisibilityClasses();
  globalThis.__RPChessLandscapeVisibilitySync = true;
}
