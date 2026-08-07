'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

(async () => {
  const index = read('game/index.html');
  const isolated = read('game/vertical-slice.html');
  const css = read('game/css/commander-selection-approved.css');
  const uiCss = read('game/css/ui-system-v2.css');
  const uiShell = read('game/css/ui-system-v2-shell.css');
  const uiSystem = read('game/js/ui-system-v2.mjs');
  const app = read('game/js/vertical-slice-app.mjs');

  for (const html of [index, isolated]) {
    assert(html.includes('css/commander-selection-approved.css'));
    assert(html.includes('css/ui-system-v2.css'));
    assert(html.includes('js/ui-system-v2.mjs'));
    assert.strictEqual(html.includes('js/commander-selection-approved.mjs'), false);
  }

  // Existing approved card sizing remains the base; the unified system owns shell behavior.
  assert(css.includes('grid-template-columns:minmax(0,1fr) minmax(430px,470px)'));
  assert(css.includes('padding:30px 34px 30px 32px'));
  assert(css.includes('grid-template-columns:128px minmax(0,1fr)'));
  assert(css.includes('.rpa-launch__portrait{height:315px'));
  assert(css.includes('.rpa-field:has([data-world-seed]){display:none!important}'));
  assert(css.includes('overflow-wrap:anywhere'));
  assert(css.includes('@media(max-width:1080px)'));
  assert(css.includes('@media(max-width:480px)'));

  assert(uiSystem.includes("screen.querySelector('.rpa-field:has([data-world-seed])')?.remove()"));
  assert(uiSystem.includes("back.setAttribute('aria-label','Вернуться к хроникам')"));
  assert(uiSystem.includes('generated_assets/logo_main.png'));
  assert(uiShell.includes('.rpu-logo-back'));
  assert(uiCss.includes('[data-world-seed]{display:none!important}'));

  // The launch handler deliberately falls back to the existing deterministic
  // base seed when the visible seed input has been removed by the approved UI.
  assert(app.includes("root.querySelector('[data-world-seed]')?.value"));
  assert(app.includes('Number.isFinite(seedInput) && seedInput > 0 ? Math.floor(seedInput) : baseOptions.seed'));

  console.log('Approved commander selection: unified logo-back, removed seed control, safe areas and responsive preview passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
