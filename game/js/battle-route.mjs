import './resources-app.mjs';
import './battle-app.mjs';
import './settlement-app.mjs';
import './starvation-app.mjs';
import './events-app.mjs';
import './events/combat-art-continuity.mjs';
import './puzzles/puzzle-app.mjs';
import './travel-choice-app.mjs';

const eventsCss = document.querySelector('[data-events-css]');
if (eventsCss) eventsCss.href = 'css/events.css?v=20260829-events-3';

if (!document.querySelector('[data-travel-choice-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/travel-choice.css?v=20260829-puzzles-1';
  link.dataset.travelChoiceCss = '';
  document.head.append(link);
}
