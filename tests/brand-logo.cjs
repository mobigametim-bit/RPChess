const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const game = path.join(root, 'game');
const read = (relative) => fs.readFileSync(path.join(game, relative), 'utf8');

const index = read('index.html');
assert.strictEqual(index.includes('FANTASY TACTICAL CHESS ROGUELITE'), false, 'main menu tagline must be removed');
assert.strictEqual((index.match(/data-brand-logo/g) || []).length, 5, 'all visible static screens must use the brand-logo hook');
assert.strictEqual(index.includes('generated_assets/title_wordmark.png'), false, 'static UI must not reference the legacy wordmark');

const resolver = read('js/brand-logo.mjs');
for (const token of ['logo_ru.png', 'logo_en.png', 'currentLanguage', 'subscribe', '[data-brand-logo]']) assert(resolver.includes(token), `brand-logo resolver missing ${token}`);

const dynamicScreens = [
  'js/battle-app.mjs', 'js/events-app.mjs', 'js/skirmish-app.mjs', 'js/starvation-app.mjs',
  'js/endless-run-app.mjs', 'js/settlement-app.mjs', 'js/puzzles/puzzle-app.mjs'
];
for (const relative of dynamicScreens) {
  const source = read(relative);
  assert(source.includes("brand-logo.mjs"), `${relative} must use the shared brand resolver`);
  assert(source.includes('data-brand-logo'), `${relative} must expose the brand-logo hook`);
  assert.strictEqual(source.includes('title_wordmark.png'), false, `${relative} must not reference the legacy wordmark`);
}
assert.strictEqual(read('js/travel-choice-app.mjs').includes('title_wordmark.png'), false, 'hidden Travel legacy wordmark must be removed');

const build = fs.readFileSync(path.join(root, 'scripts/build.cjs'), 'utf8');
for (const token of ['logo_ru.png', 'logo_en.png', 'assertBrandLogoAssetBudget', 'Runtime brand logos']) assert(build.includes(token), `runtime build missing ${token}`);
assert.strictEqual(build.includes("'title_wordmark.png'"), false, 'legacy wordmark must not be a runtime build asset');

const css = read('css/settlement.css');
for (const token of ['grid-auto-rows:max-content', 'align-content:start', 'settlement-product-card__icon--artifact{transform:scale(1.55)}']) assert(css.includes(token), `market compact-card contract missing ${token}`);

const menuCss = read('css/ui-redesign-first-three.css');
for (const token of ['margin:0 0 0 152px', 'transform:translateY(-clamp(12px,1.6vh,20px))', 'margin:34px auto 0']) assert(menuCss.includes(token), `main-menu logo alignment contract missing ${token}`);

console.log('Localized brand logos, tagline removal and compact market-card contract: PASS');
