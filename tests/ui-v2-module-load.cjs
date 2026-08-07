'use strict';

const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const load = (relative) => import(pathToFileURL(path.resolve(__dirname, '..', relative)).href);
  const presenter = await load('game/js/vertical-slice-presenter-final.mjs');
  const codex = await load('game/js/register-02-codex-v2.mjs');
  const relics = await load('game/js/register-03-relic-codex-v2.mjs');
  assert.strictEqual(typeof presenter.VerticalSlicePresenter, 'function');
  assert.strictEqual(typeof codex.openRegister02Codex, 'function');
  assert.strictEqual(typeof relics.openRegister03RelicCodex, 'function');
  assert.strictEqual(Object.keys(codex.HERO_PROFILES).length, 36);
  assert.strictEqual(Object.keys(codex.POLITICAL_PROFILES).length, 18);
  assert.ok(relics.filteredRelics('', 'all', 'all').length >= 72);
  console.log('UI v2 module load: final presenter, hero/politics codex and relic codex imported successfully.');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
