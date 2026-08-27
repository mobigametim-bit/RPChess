import './resources-app.mjs';
import './battle-app.mjs';
import './settlement-app.mjs';
import './travel-choice-app.mjs';

if (!document.querySelector('[data-travel-choice-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/travel-choice.css?v=20260827-travel-2';
  link.dataset.travelChoiceCss = '';
  document.head.append(link);
}
