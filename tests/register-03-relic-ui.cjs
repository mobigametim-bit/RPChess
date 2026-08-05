'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

(async () => {
  const manifest = JSON.parse(read('content/manifests/register-03-relics.json'));
  const presenter = read('game/js/vertical-slice-presenter-register-02.mjs');
  const heroCodex = read('game/js/register-02-codex.mjs');
  const html = read('game/vertical-slice.html');
  const moduleSource = read('game/js/register-03-relic-codex.mjs');

  assert.strictEqual(manifest.records.length, 72);
  assert(presenter.includes("relicChipMarkup(hero.relicIds, { compact: true })"));
  assert(!presenter.includes("hero.relicIds?.length || 0} реликв."));
  assert(presenter.includes('installRegister03RelicCodex'));
  assert(heroCodex.includes('relicChipMarkup(relicIds)'));
  assert(html.includes('js/register-03-relic-codex.mjs'));
  assert(moduleSource.includes('Реликвии · ${RELIC_ROWS.length}'));

  const module = await import(pathToFileURL(path.join(root, 'game/js/register-03-relic-codex.mjs')).href);
  assert.strictEqual(module.filteredRelics().length, 72);
  assert.strictEqual(module.filteredRelics('', 'knight').length > 0, true);
  const markup = module.relicCodexMarkup();
  for (const record of manifest.records) {
    assert(markup.includes(record.path), record.path);
    assert(markup.includes(record.name.ru), record.id);
  }
  const chip = module.relicChipMarkup(['relic.echo_shield', 'relic.circle_warding']);
  assert(chip.includes('assets/relics/echo_shield.png'));
  assert(chip.includes('assets/relics/circle_warding.png'));

  console.log('Register 03 relic UI: 72/72 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
