import './player-rating-runtime.mjs';
import './resources-app.mjs';
import './battle-app.mjs';
import './settlement-app.mjs';
import './starvation-app.mjs';
import './events-app.mjs';
import './events/combat-art-continuity.mjs';
import './puzzles/puzzle-app.mjs';
import './travel-choice-app.mjs';
import './ux-consistency.mjs';
// Acceptance pass 5: themed scene backgrounds, matched board sizing and victory presentation.
import './cross-scene-visuals.mjs';

const eventsCss = document.querySelector('[data-events-css]');
if (eventsCss) eventsCss.href = 'css/events.css?v=20260829-events-3';

// Foundation owns the critical Travel stylesheet so the direct fallback stays styled.
// Keep this guard for compatibility with older cached shells.
if (!document.querySelector('[data-travel-choice-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/travel-choice.css?v=20260830-acceptance-2';
  link.dataset.travelChoiceCss = '';
  document.head.append(link);
}
