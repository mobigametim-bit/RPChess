'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const write = (relative, content) => fs.writeFileSync(path.join(root, relative), content);

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(search, replacement);
}

let presenter = read('game/js/vertical-slice-presenter-register-02.mjs');
presenter = replaceOnce(
  presenter,
  "import { kingAssets, doctrineAssets } from './register-01-assets.mjs';\n",
  "import { kingAssets, doctrineAssets } from './register-01-assets.mjs';\nimport { relicChipMarkup, installRegister03RelicCodex, ensureRegister03Styles } from './register-03-relic-codex.mjs';\n",
  'presenter relic import'
);
presenter = replaceOnce(
  presenter,
  '<div><strong>${name}</strong><span>${state.label}</span><small>${hero.relicIds?.length || 0} реликв.</small></div>',
  '<div><strong>${name}</strong><span>${state.label}</span>${relicChipMarkup(hero.relicIds, { compact: true })}</div>',
  'army relic placeholder'
);
presenter = replaceOnce(
  presenter,
  "    ensureCodexStyles(this.root.ownerDocument);\n    ensureArmyStyles(this.root.ownerDocument);",
  "    ensureCodexStyles(this.root.ownerDocument);\n    ensureRegister03Styles(this.root.ownerDocument);\n    ensureArmyStyles(this.root.ownerDocument);",
  'presenter relic styles'
);
presenter = replaceOnce(
  presenter,
  "    installRegister02Codex(this.root, { target: '.rpvs__resources', label: 'Кодекс' });",
  "    installRegister02Codex(this.root, { target: '.rpvs__resources', label: 'Кодекс' });\n    installRegister03RelicCodex(this.root, { target: '.rpvs__resources', label: 'Реликвии · 72' });",
  'presenter relic codex install'
);
write('game/js/vertical-slice-presenter-register-02.mjs', presenter);

let codex = read('game/js/register-02-codex.mjs');
codex = replaceOnce(
  codex,
  "} from './register-02-assets.mjs';\n",
  "} from './register-02-assets.mjs';\nimport { relicChipMarkup } from './register-03-relic-codex.mjs';\n",
  'hero panel relic import'
);
codex = replaceOnce(
  codex,
  "<div><dt>Реликвии</dt><dd>${relicIds.length ? relicIds.map((id) => escapeHtml(RELIC_LABELS[id] || id)).join(', ') : 'Нет'}</dd></div>",
  "<div><dt>Реликвии</dt><dd>${relicChipMarkup(relicIds)}</dd></div>",
  'hero panel relic text'
);
write('game/js/register-02-codex.mjs', codex);

let html = read('game/vertical-slice.html');
html = replaceOnce(
  html,
  '  <script type="module" src="js/register-02-runtime-enhancer.mjs"></script>\n',
  '  <script type="module" src="js/register-02-runtime-enhancer.mjs"></script>\n  <script type="module" src="js/register-03-relic-codex.mjs"></script>\n',
  'browser relic codex entry'
);
write('game/vertical-slice.html', html);

const test = `'use strict';

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
`;
write('tests/register-03-relic-ui.cjs', test);

const packagePath = 'package.json';
const packageJson = JSON.parse(read(packagePath));
const command = 'node tests/register-03-relic-ui.cjs';
if (!packageJson.scripts.test.includes(command)) packageJson.scripts.test += ` && ${command}`;
write(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

console.log('Register 03 UI integration applied.');
