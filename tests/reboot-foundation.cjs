const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const game = path.join(root, 'game');

const html = fs.readFileSync(path.join(game, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(game, 'css/reboot-foundation.css'), 'utf8');
const js = fs.readFileSync(path.join(game, 'js/reboot-foundation.mjs'), 'utf8');
const audio = fs.readFileSync(path.join(game, 'js/reboot-audio.mjs'), 'utf8');
const info = JSON.parse(fs.readFileSync(path.join(game, 'BUILD_INFO.json'), 'utf8'));
const route = fs.readFileSync(path.join(game, 'js/battle-route.mjs'), 'utf8');

assert(html.includes('data-reboot-foundation'), 'Reboot Foundation root is missing');
assert(html.includes('data-new-game'), 'New Game action is missing');
assert(html.includes('data-continue-run'), 'persistent Continue action is missing');
assert(html.includes('data-settings'), 'Settings action is missing');
assert(html.includes('generated_assets/title_wordmark.png'), 'approved RPChess wordmark is missing from menu');
assert(html.includes('css/reboot-foundation.css?v=20260827-frameless-1'), 'frameless Foundation stylesheet cache bust is not pinned');
assert(html.includes('css/classic-chess.css?v=20260827-frameless-1'), 'frameless Classic Chess stylesheet cache bust is not pinned');
assert(html.includes('css/chess-ai-polish.css?v=20260827-frameless-1'), 'frameless Chess AI polish cache bust is not pinned');
assert(html.includes('css/roster.css?v=20260827-roster-2'), 'corrected Roster stylesheet cache bust is not pinned');
assert(html.includes('css/skirmish.css?v=20260827-skirmish-1'), 'Skirmish stylesheet cache bust is not pinned');
assert(html.includes('js/reboot-foundation.mjs?v=20260827-roster-1'), 'Roster Foundation runtime cache bust is not pinned');
assert(html.includes('js/roster-app.mjs?v=20260827-skirmish-1'), 'Skirmish/Travel-aware Roster runtime is not loaded');
assert(html.includes('js/skirmish-app.mjs?v=20260827-skirmish-1'), 'Skirmish runtime is not loaded');

for (const forbidden of ['iron-marches-runtime.bundle.js', 'vertical-slice-app.mjs', 'explicit-run-setup.mjs', 'ui-approved-campaign.mjs', 'commander-selection-final.mjs']) {
  assert(!html.includes(forbidden), `legacy runtime is still referenced: ${forbidden}`);
}
for (const oldUiTerm of ['ДОКТРИН', 'РАЗВЕД', 'ОЧКИ ПРИКАЗА', 'ПОЛИТИЧЕСК']) {
  assert(!html.toUpperCase().includes(oldUiTerm), `legacy UI term leaked into Reboot menu: ${oldUiTerm}`);
}
for (const prototypeCopy of ['Новый путь RPChess', 'Reboot Foundation.', 'feature-by-feature', 'Сейчас проверяется новый visual shell']) {
  assert(!html.includes(prototypeCopy), `prototype explanation leaked into production menu: ${prototypeCopy}`);
}

assert(/html\s*\{[\s\S]*overflow-y:\s*auto/i.test(css), 'html must permit vertical scrolling');
assert(/body\s*\{[\s\S]*overflow-y:\s*auto/i.test(css), 'body must permit vertical scrolling');
assert(css.includes('--ui-panel-safe-left'), 'global frameless panel left safe-area variable is missing');
assert(css.includes('--ui-panel-safe-right'), 'global frameless panel right safe-area variable is missing');
assert(css.includes('.ui-panel-safe'), 'future scenes have no reusable frameless safe-area utility');
assert(/\.ui-panel-safe,[\s\S]*\.reboot-modal__panel,[\s\S]*\.classic-panel[\s\S]*padding-left:\s*var\(--ui-panel-safe-left\)\s*!important/i.test(css), 'current panel surfaces are not bound to the global left safe-area contract');
assert(/--ui-panel-safe-left:\s*clamp\(30px/i.test(css), 'desktop surfaces need a deliberate left inset');
assert(/@media \(max-width: 760px\)[\s\S]*--ui-panel-safe-left:\s*26px/i.test(css), 'mobile surfaces need a deliberate left inset');
assert(css.includes('.ui-panel-surface'), 'global frameless panel surface utility is missing');
assert(css.includes('--ui-panel-border'), 'frameless panel border token is missing');
assert(!css.includes('ui_panel_frame.png'), 'Foundation CSS must never use ornate panel frame assets');
assert(!css.includes('ui_panel_wide.png'), 'Foundation CSS must never use ornate wide panel frame assets');
assert(css.includes('ui_button_primary.png'), 'approved primary button asset must style the menu');
assert(css.includes('splash_poster.jpg'), 'approved splash art must style the menu');
assert(js.includes("key.startsWith('rpchess.')"), 'legacy save cleanup is missing');
assert(js.includes("!key.startsWith('rpchess.reboot.')"), 'reboot saves must be protected from cleanup');
assert(js.includes('new RebootAudio(settings)'), 'Reboot audio layer is not initialized');
assert(js.includes("document.addEventListener('pointerdown', activateAudio"), 'audio must activate after a browser-approved user gesture');
assert(js.includes("CustomEvent('rpchess:run-new')"), 'New Game must begin a reboot run instead of opening standalone chess setup');
assert(js.includes("CustomEvent('rpchess:run-continue')"), 'Continue must reopen a persistent run');
assert(js.includes("import './battle-route.mjs'"), 'Battle/Travel bootstrap is not loaded from Foundation');
assert(route.includes("import './battle-app.mjs'"), 'Battle runtime must remain loaded through the shared route bootstrap');
assert(route.includes("import './travel-choice-app.mjs'"), 'Travel Choice runtime must load through the shared route bootstrap');
assert(String(info.version).startsWith('2.6.0-travel-choice'), 'Travel Choice v2.6 build version is missing');

for (const track of ['echoes_iron_throne_01.mp3', 'echoes_iron_throne_02.mp3', 'echoes_iron_throne_03.mp3', 'echoes_iron_throne_04.mp3']) {
  assert(audio.includes(`music/${track}`), `music playlist is missing ${track}`);
  assert(fs.existsSync(path.join(game, 'music', track)), `music asset is missing: ${track}`);
}
for (const relative of ['generated_assets/logo_main.png', 'generated_assets/title_wordmark.png', 'generated_assets/splash_poster.jpg', 'fonts/BrahmsGotischCyr.otf']) {
  assert(fs.existsSync(path.join(game, relative)), `required reused asset is missing: ${relative}`);
}

console.log('Reboot Foundation frameless production contract with Skirmish/Battle preserved and Travel Choice bootstrap loaded: PASS');
