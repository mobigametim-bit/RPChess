const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

(async () => {
  const index = read('game/index.html');
  const isolated = read('game/vertical-slice.html');
  const approvedCss = read('game/css/approved-visual-shell.css');
  const stageCss = read('game/css/stage-b-ui.css');
  const finalQaCss = read('game/css/ui-final-qa.css');
  const app = read('game/js/vertical-slice-app.mjs');
  const presenter = read('game/js/vertical-slice-presenter.mjs');
  const pointerSafety = read('game/js/battle-pointer-coordinate-safety.mjs');
  const build = read('scripts/build.cjs');

  for (const html of [index, isolated]) {
    assert(html.includes('js/generated/iron-marches-runtime.bundle.js?v=20260826-1'));
    assert(html.includes('js/battle-pointer-coordinate-safety.mjs?v=20260826-1'));
    assert(html.includes('js/vertical-slice-app.mjs?v=20260826-1'));
    assert(html.includes('js/vertical-slice-presenter-final.mjs?v=20260826-1'));
    assert(html.includes('js/ui-approved-campaign.mjs?v=20260826-1'));
    assert(html.includes('js/ui-approved-battle.mjs?v=20260826-1'));
    assert(html.includes('css/ui-final-qa.css?v=20260826-1'));
    assert(html.includes('style.css'));
    assert(html.includes('css/approved-visual-shell.css'));
    assert(html.includes('css/stage-b-ui.css'));
    assert(!html.includes('js/core.js'));
    assert(!html.includes('js/main.js'));
  }

  assert(approvedCss.includes("generated_assets/splash_poster.jpg"));
  assert(approvedCss.includes("generated_assets/ui_panel_wide.png"));
  assert(approvedCss.includes('overflow-wrap'));
  assert(approvedCss.includes('min-height:44px'));
  assert(approvedCss.includes('@media(max-width:460px)'));
  assert(stageCss.includes('overflow-y:auto'));
  assert(stageCss.includes('.rp02-mechanic-card,.rp02-relic-slot'));
  assert(finalQaCss.includes('.rpu-brief-roster>[data-save-briefing]{display:none!important}'));
  assert(finalQaCss.includes(':has(>input[type="checkbox"]:checked)'));
  assert(finalQaCss.includes('opacity:0!important'));
  assert(app.includes('commanderSelectionMarkup'));
  assert(app.includes('unlockedCommanders'));
  assert(app.includes('VerticalSliceAudio'));
  assert(app.includes('openRegister02Codex'));
  assert(presenter.includes('drawWarriorPiece'));
  assert(presenter.includes('generated_assets/logo_main.png'));
  assert.strictEqual(presenter.includes('Доступные маршруты'), false);
  assert.strictEqual(presenter.includes('region.environmentSheet'), false);
  assert(pointerSafety.includes("./vertical-slice-presenter-final.mjs?v=20260826-1"));
  assert(pointerSafety.includes('logicalWidth / bounds.width'));
  assert(pointerSafety.includes('logicalHeight / bounds.height'));
  assert(pointerSafety.includes("Symbol.for('rpchess.battle-pointer-coordinate-safety.installed')"));
  assert(build.includes("path.join(dist, 'index.html')"));

  const appModule = await import(pathToFileURL(path.join(root, 'game/js/vertical-slice-app.mjs')).href);
  const progress = appModule.readShellProgress({ getItem: () => null });
  assert.strictEqual(progress.unlockPoints, 0);
  const menu = appModule.menuMarkup([], progress, 'ru');
  assert(menu.includes('generated_assets/title_wordmark.png'));
  assert(menu.includes('Новый поход'));
  assert(menu.includes('Настройки'));
  assert(menu.includes('Хроника'));
  const selection = appModule.commanderSelectionMarkup('profile-1', progress, 'warlord', {
    registry: { get: () => null }, localization: { ru: null }
  }, 'ru');
  assert(selection.includes('Выберите, за кого играть'));
  assert(selection.includes('Начать поход'));
  assert(selection.includes('disabled'));

  console.log('Vertical slice comfort: approved prototype shell, preview cache bust and responsive contracts passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
