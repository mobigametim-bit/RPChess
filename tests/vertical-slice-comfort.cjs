const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

(async () => {
  const index = read('game/index.html');
  const isolated = read('game/vertical-slice.html');
  const css = read('game/css/vertical-slice-comfort.css');
  const app = read('game/js/vertical-slice-app.mjs');
  const build = read('scripts/build.cjs');

  for (const html of [index, isolated]) {
    assert(html.includes('js/generated/iron-marches-runtime.bundle.js'));
    assert(html.includes('js/vertical-slice-app.mjs'));
    assert(html.includes('css/vertical-slice-comfort.css'));
    assert(html.includes('js/vertical-slice-comfort.mjs'));
    assert(!html.includes('js/core.js'));
    assert(!html.includes('js/main.js'));
  }

  assert(css.includes('overflow-wrap:anywhere'));
  assert(css.includes('white-space:normal!important'));
  assert(css.includes('.rpprofile__command-card b'));
  assert(css.includes('.rp02-army-hero strong'));
  assert(css.includes('.rp03-relic-chip>span'));
  assert(css.includes('min-height:44px'));
  assert(css.includes('@media(max-width:460px)'));
  assert(app.includes('profileSelectionMarkup'));
  assert(build.includes("path.join(dist, 'index.html')"));

  const comfort = await import(pathToFileURL(path.join(root, 'game/js/vertical-slice-comfort.mjs')).href);
  assert.strictEqual(comfort.helpCopy('ru').title, 'Как проходить вертикальный срез');
  assert.strictEqual(comfort.helpCopy('en').steps.length, 4);
  const markup = comfort.helpMarkup('ru');
  assert(markup.includes('Выберите профиль'));
  assert(markup.includes('Соберите отряд'));
  assert(markup.includes('Играйте на доске'));
  assert(markup.includes('Следуйте цели'));

  const rootFor = (selector) => ({ querySelector: (candidate) => candidate === selector ? {} : null });
  assert.strictEqual(comfort.screenNameFromRoot(rootFor('.rpprofile')), 'profiles');
  assert.strictEqual(comfort.screenNameFromRoot(rootFor('.rprs')), 'selection');
  assert.strictEqual(comfort.screenNameFromRoot(rootFor('.rpvs')), 'runtime');
  assert.strictEqual(comfort.screenNameFromRoot(null), 'loading');

  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  assert.strictEqual(comfort.helpWasSeen(storage), false);
  comfort.rememberHelpSeen(storage);
  assert.strictEqual(comfort.helpWasSeen(storage), true);

  console.log('Vertical slice comfort: root entry, guidance and overflow guards passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
