'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

(async () => {
  const app = read('game/js/vertical-slice-app.mjs');
  const legacyPresenter = read('game/js/vertical-slice-presenter.mjs');
  const presenterV2 = read('game/js/vertical-slice-presenter-v2.mjs');
  const approvedPresenter = read('game/js/vertical-slice-presenter-approved.mjs');
  const uiSystem = read('game/js/ui-system-v2.mjs');
  const clientSource = read('game/js/runtime-command-client.mjs');
  const register01 = read('game/js/register-01-assets.mjs');
  const register02V2 = read('game/js/register-02-codex-v2.mjs');
  const register03V2 = read('game/js/register-03-relic-codex-v2.mjs');
  const uiCss = read('game/css/ui-system-v2.css');
  const shellCss = read('game/css/ui-system-v2-shell.css');
  const approvedCss = read('game/css/ui-approved-screens.css');
  const index = read('game/index.html');
  const isolated = read('game/vertical-slice.html');

  for (const html of [index, isolated]) {
    assert(html.includes('css/stage-b-ui.css'));
    assert(html.includes('css/ui-system-v2.css'));
    assert(html.includes('css/ui-system-v2-shell.css'));
    assert(html.includes('css/ui-approved-screens.css'));
    assert(html.includes('js/ui-system-v2.mjs'));
    assert(html.includes('vertical-slice-presenter-approved.mjs'));
    assert(html.includes('register-02-codex-v2.mjs'));
    assert(html.includes('register-03-relic-codex-v2.mjs'));
    assert.strictEqual(html.includes('js/army-foundation-approved.mjs'), false);
    assert.strictEqual(html.includes('js/register-02-runtime-enhancer.mjs'), false);
    assert.strictEqual(html.includes('js/register-03-relic-codex.mjs"></script>'), false);
    assert.strictEqual(html.includes('css/army-foundation-approved.css'), false);
  }

  for (const method of ['renderDraft(snapshot)', 'renderBriefing(snapshot)', 'renderRewardChoice(snapshot)', 'renderService(snapshot)', 'renderRetreat(snapshot)', 'renderActOutcome(snapshot)', 'renderReorganization(snapshot)']) {
    assert(legacyPresenter.includes(method), `legacy gameplay presenter must retain ${method}`);
  }
  assert(legacyPresenter.includes('register04EventAsset(event.eventId'));
  assert(legacyPresenter.includes('animateBattleChanges(previous, snapshot)'));
  assert(legacyPresenter.includes('this.hiddenAnimatedPieceIds = new Set'));
  assert(legacyPresenter.includes("event.type === 'PieceMoved'"));
  assert(legacyPresenter.includes('const glyphSize = Math.max(14, Math.floor(rect.size * .264))'));
  assert.strictEqual(register01.includes('legal_move.png'), false);
  assert.strictEqual(register01.includes('capture_move.png'), false);

  assert(presenterV2.includes('class VerticalSlicePresenter extends LegacyVerticalSlicePresenter'));
  assert(presenterV2.includes('rpu-topbar'));
  assert(presenterV2.includes("resourceChip('gold'"));
  assert(presenterV2.includes("resourceChip('supplies'"));
  assert(presenterV2.includes("resourceChip('meta'"));
  assert(presenterV2.includes('data-runtime-menu'));
  assert.strictEqual(presenterV2.includes('data-rp02-codex-launch'), false);
  assert.strictEqual(presenterV2.includes('data-rp03-codex-launch'), false);
  assert(presenterV2.includes('rpu-talent-modal'));
  assert(presenterV2.includes('ВЫБОР НЕОБРАТИМ'));
  assert(presenterV2.includes("finale.stage === 'cabinet'"));
  assert(presenterV2.includes("finale.stage === 'government'"));
  assert(presenterV2.includes("finale.stage === 'law'"));
  assert(presenterV2.includes('НАГРАДА ЗА ЗАВЕРШЕНИЕ АКТА'));
  assert(presenterV2.includes('МЕЖАКТОВОЕ СОСТОЯНИЕ'));
  assert(presenterV2.includes('bossAssets('));
  assert(presenterV2.includes('bossPhaseSigil('));

  assert(approvedPresenter.includes('class VerticalSlicePresenter extends UnifiedVerticalSlicePresenter'));
  assert(approvedPresenter.includes('rpu-draft__layout'));
  assert(approvedPresenter.includes('rpu-base-reward'));
  assert(approvedPresenter.includes('rpu-reward-choice-grid'));
  assert(approvedPresenter.includes('rpu-service-layout'));
  assert(approvedPresenter.includes('rpu-retreat__consequences'));
  assert(approvedPresenter.includes('rpu-terminal'));
  assert(approvedPresenter.includes('PIECE_GLYPHS'));
  assert(approvedPresenter.includes('unitArt({ side:\'w\''));

  assert(uiCss.includes("url('../generated_assets/splash_poster.jpg')"));
  assert(uiCss.includes("url('../generated_assets/ui_button_primary.png')"));
  assert(uiCss.includes("url('../generated_assets/ui_button_danger.png')") || shellCss.includes("url('../generated_assets/ui_button_danger.png')"));
  assert(uiCss.includes('.rpa-menu [data-shell-action="chronicle"]{display:none!important}'));
  assert(uiCss.includes('.rpu-topbar__resources'));
  assert(uiCss.includes('.rpu-government-grid'));
  assert(uiCss.includes('.rpu-law-grid'));
  assert(uiCss.includes('.rpu-talent-options'));
  assert(uiCss.includes('.rpu-codex__layout'));
  assert(uiCss.includes('@media(max-width:620px)'));
  assert(uiCss.includes('@media(prefers-reduced-motion:reduce)'));
  assert(approvedCss.includes('.rpu-draft-summary'));
  assert(approvedCss.includes('.rpu-service-grid'));
  assert(approvedCss.includes('.rpu-terminal__king'));
  assert(approvedCss.includes('@media(max-width:760px)'));

  assert(uiSystem.includes('function createSystemModal'));
  assert(uiSystem.includes('ПЕРЕИМЕНОВАТЬ ХРОНИКУ'));
  assert(uiSystem.includes('УДАЛИТЬ ХРОНИКУ?'));
  assert(uiSystem.includes('НАЧАТЬ ЗАНОВО?'));
  assert(uiSystem.includes("root.querySelectorAll('[data-shell-action=\"chronicle\"]')"));
  assert(uiSystem.includes("back.innerHTML = '<img src=\"generated_assets/logo_main.png\" alt=\"RPChess\">'"));

  assert(register02V2.includes('rpu-codex__layout'));
  assert(register02V2.includes('rpu-person-detail'));
  assert.strictEqual(register02V2.includes('autoInstall()'), false);
  assert(register03V2.includes('rpu-relic-detail'));
  assert(register03V2.includes('rpu-relic-list-card'));
  assert.strictEqual(register03V2.includes('autoInstall()'), false);

  assert(clientSource.includes("'ChooseDraftHero'"));
  assert(clientSource.includes("'ScoutNode'"));
  assert(clientSource.includes("'ChooseRewardOffer'"));
  assert(clientSource.includes("'ConfirmReorganization'"));
  assert(clientSource.includes("'reward_choice'"));

  const appModule = await import(pathToFileURL(path.join(root, 'game/js/vertical-slice-app.mjs')).href);
  const progress = appModule.readShellProgress({ getItem: () => null });
  const menu = appModule.menuMarkup([], progress, 'ru');
  assert(menu.includes('rpa-menu__main--open'));
  assert(!menu.includes('rpa-menu__lead'));
  assert(app.includes('data-profile-primary'));
  assert(app.includes('data-chronicle-commander'));
  assert(app.includes('Продолжить поход'));

  console.log('Stage B UI: unified design system, approved gameplay presenter, retired enhancers, B14 surfaces and responsive contracts passed.');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
