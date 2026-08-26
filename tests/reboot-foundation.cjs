const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const game = path.join(root, 'game');

const html = fs.readFileSync(path.join(game, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(game, 'css/reboot-foundation.css'), 'utf8');
const js = fs.readFileSync(path.join(game, 'js/reboot-foundation.mjs'), 'utf8');
const info = JSON.parse(fs.readFileSync(path.join(game, 'BUILD_INFO.json'), 'utf8'));

assert(html.includes('data-reboot-foundation'), 'Reboot Foundation root is missing');
assert(html.includes('data-new-game'), 'New Game action is missing');
assert(html.includes('>Продолжить<'), 'Continue action is missing');
assert(html.includes('data-settings'), 'Settings action is missing');
assert(html.includes('css/reboot-foundation.css'), 'Reboot stylesheet is not loaded');
assert(html.includes('js/reboot-foundation.mjs'), 'Reboot runtime is not loaded');

for (const forbidden of [
  'iron-marches-runtime.bundle.js',
  'vertical-slice-app.mjs',
  'explicit-run-setup.mjs',
  'ui-approved-campaign.mjs',
  'commander-selection-final.mjs'
]) {
  assert(!html.includes(forbidden), `legacy runtime is still referenced: ${forbidden}`);
}

for (const oldUiTerm of ['ДОКТРИН', 'РАЗВЕД', 'ОЧКИ ПРИКАЗА', 'ПОЛИТИЧЕСК']) {
  assert(!html.toUpperCase().includes(oldUiTerm), `legacy UI term leaked into Reboot menu: ${oldUiTerm}`);
}

assert(/html\s*\{[\s\S]*overflow-y:\s*auto/i.test(css), 'html must permit vertical scrolling');
assert(/body\s*\{[\s\S]*overflow-y:\s*auto/i.test(css), 'body must permit vertical scrolling');
assert(js.includes("key.startsWith('rpchess.')"), 'legacy save cleanup is missing');
assert(js.includes("!key.startsWith('rpchess.reboot.')"), 'reboot saves must be protected from cleanup');
assert(String(info.version).startsWith('2.0.0-foundation'), 'Reboot Foundation build version is missing');

for (const relative of [
  'generated_assets/logo_main.png',
  'generated_assets/title_wordmark.png',
  'generated_assets/splash_poster.jpg',
  'generated_assets/scene_campaign.jpg',
  'fonts/BrahmsGotischCyr.otf'
]) {
  assert(fs.existsSync(path.join(game, relative)), `required reused asset is missing: ${relative}`);
}

console.log('Reboot Foundation static contract: PASS');
