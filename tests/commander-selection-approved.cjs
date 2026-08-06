'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

(async () => {
  const index = read('game/index.html');
  const isolated = read('game/vertical-slice.html');
  const css = read('game/css/commander-selection-approved.css');
  const source = read('game/js/commander-selection-approved.mjs');
  const app = read('game/js/vertical-slice-app.mjs');

  for (const html of [index, isolated]) {
    assert(html.includes('css/commander-selection-approved.css'));
    assert(html.includes('js/commander-selection-approved.mjs'));
  }

  assert(css.includes('grid-template-columns:minmax(0,1fr) minmax(430px,470px)'));
  assert(css.includes('padding:30px 34px 30px 32px'));
  assert(css.includes('grid-template-columns:128px minmax(0,1fr)'));
  assert(css.includes('.rpa-launch__portrait{height:315px'));
  assert(css.includes('.rpa-field:has([data-world-seed]){display:none!important}'));
  assert(css.includes('overflow-wrap:anywhere'));
  assert(css.includes('@media(max-width:1080px)'));
  assert(css.includes('@media(max-width:480px)'));

  assert(source.includes("return document?.documentElement?.lang === 'en' ? 'Profiles' : 'Профили'"));
  assert(source.includes("screen.querySelector('.rpa-field:has([data-world-seed])')"));
  assert(source.includes("screen.classList.add('is-approved-commander-selection')"));
  assert(source.includes('MutationObserver'));
  assert(!source.includes('← Профили'));

  // The launch handler deliberately falls back to the existing deterministic
  // base seed when the visible seed input has been removed by the approved UI.
  assert(app.includes("root.querySelector('[data-world-seed]')?.value"));
  assert(app.includes('Number.isFinite(seedInput) && seedInput > 0 ? Math.floor(seedInput) : baseOptions.seed'));

  const module = await import(pathToFileURL(path.join(root, 'game/js/commander-selection-approved.mjs')).href);
  assert.strictEqual(module.profileButtonLabel({ documentElement: { lang: 'ru' } }), 'Профили');
  assert.strictEqual(module.profileButtonLabel({ documentElement: { lang: 'en' } }), 'Profiles');
  assert.strictEqual(module.commanderScreen(null), null);

  console.log('Approved commander selection: safe areas, wider preview and simplified controls passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
