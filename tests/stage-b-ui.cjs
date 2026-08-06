'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

(async () => {
  const app = read('game/js/vertical-slice-app.mjs');
  const presenter = read('game/js/vertical-slice-presenter.mjs');
  const register01 = read('game/js/register-01-assets.mjs');
  const clientSource = read('game/js/runtime-command-client.mjs');
  const extension = read('game/js/vertical-slice-presenter-register-02.mjs');
  const css = read('game/css/stage-b-ui.css');
  const armyFoundationCss = read('game/css/army-foundation-approved.css');
  const armyFoundation = read('game/js/army-foundation-approved.mjs');
  const index = read('game/index.html');
  const isolated = read('game/vertical-slice.html');

  for (const html of [index, isolated]) {
    assert(html.includes('css/stage-b-ui.css'));
    assert(html.includes('css/army-foundation-approved.css'));
    assert(html.includes('js/army-foundation-approved.mjs'));
  }
  assert(app.includes('rpa-menu__main--open'));
  assert.strictEqual(app.includes('Проведите живую шахматную армию через Железные Марши'), false);
  assert(app.includes('data-profile-primary'));
  assert(app.includes('data-chronicle-commander'));
  assert(app.includes("card.setAttribute('aria-pressed'"));
  assert(css.includes('.rpa-menu__main--open'));
  assert(css.includes('border-image:none!important'));
  assert(css.includes('.rpa-chronicle-card{display:grid;grid-template-columns:190px minmax(0,1fr) auto'));
  assert(css.includes('.rpa-chronicle-card__copy{align-self:stretch!important'));
  assert(css.includes('background:linear-gradient(135deg,#101f34f5,#081422f5)!important'));
  assert(css.includes('.rpvs__top--battle{border:0!important'));
  assert(css.includes('.rpvs__battle-sidebar-scroll'));
  assert(css.includes('overflow-y:auto'));
  assert(css.includes('max-height:calc(100dvh - 205px)'));
  assert(css.includes('.rp02-mechanic-card,.rp02-relic-slot{display:grid!important;grid-template-columns:58px minmax(0,1fr)'));
  assert(css.includes('.rp02-hero-panel__body{display:contents!important}'));
  assert(css.includes('.rpvs__moving-piece'));
  assert(css.includes('.rpvs__moving-piece small{position:absolute;left:4%;top:4%'));
  assert(css.includes('width:33%;aspect-ratio:1.35'));
  assert(css.includes('font:700 20px/.9 Georgia,serif'));
  assert(css.includes('.rpvs__reserve-piece small{position:absolute;left:3px;top:3px'));
  assert(css.includes('.rp02-media>span{line-height:.84!important;overflow:visible!important}'));
  assert(presenter.includes('const glyphSize = Math.max(14, Math.floor(rect.size * .264))'));
  assert(presenter.includes('const cx = rect.x + glyphInset + glyphSize * .72'));
  assert(presenter.includes('animateBattleChanges(previous, snapshot)'));
  assert.strictEqual(register01.includes('legal_move.png'), false);
  assert.strictEqual(register01.includes('capture_move.png'), false);
  assert(presenter.includes('].filter(Boolean)'));
  assert(presenter.includes('markerSource ? this.assetCache.get(markerSource) : null'));
  assert(css.includes('stage-b-visual-qa-polish-v2'));
  assert(presenter.includes('this.hiddenAnimatedPieceIds = new Set'));
  assert(presenter.includes("event.type === 'PieceMoved'"));
  assert(presenter.includes('renderDraft(snapshot)'));
  assert(presenter.includes('renderBriefing(snapshot)'));
  assert(presenter.includes('renderRewardChoice(snapshot)'));
  assert(presenter.includes('renderService(snapshot)'));
  assert(presenter.includes('renderRetreat(snapshot)'));
  assert(presenter.includes('renderActOutcome(snapshot)'));
  assert(presenter.includes('renderReorganization(snapshot)'));
  assert(presenter.includes('register04EventAsset(event.eventId'));
  assert(extension.includes("sidebar.querySelector('.rpvs__battle-sidebar-scroll')"));
  assert(clientSource.includes("'ChooseDraftHero'"));
  assert(clientSource.includes("'ScoutNode'"));
  assert(clientSource.includes("'ChooseRewardOffer'"));
  assert(clientSource.includes("'ConfirmReorganization'"));
  assert(clientSource.includes("'reward_choice'"));

  assert(armyFoundation.includes("heroAssets(heroId)?.portrait"));
  assert(armyFoundation.includes("generated_assets/reward_artifact.png"));
  assert(armyFoundation.includes("Железные марши Акт ${roman(act)}"));
  assert(armyFoundation.includes("headings[0].textContent = 'Именной герой: выберите одного'"));
  assert(armyFoundation.includes("headings[1].textContent = 'Пополнение: выберите одну фигуру'"));
  assert(armyFoundationCss.includes("url('../generated_assets/splash_poster.jpg')"));
  assert(armyFoundationCss.includes("url('../generated_assets/ui_panel_frame.png')"));
  assert(armyFoundationCss.includes("url('../generated_assets/ui_chip.png')"));
  assert(armyFoundationCss.includes('width:142px!important;min-width:142px!important'));
  assert(armyFoundationCss.includes('font:700 clamp(31px,2.15vw,41px)/1 BrahmsGotischCyr'));

  const appModule = await import(pathToFileURL(path.join(root, 'game/js/vertical-slice-app.mjs')).href);
  const progress = appModule.readShellProgress({ getItem: () => null });
  const menu = appModule.menuMarkup([], progress, 'ru');
  assert(menu.includes('rpa-menu__main--open'));
  assert(!menu.includes('rpa-menu__lead'));
  const chronicle = appModule.chronicleMarkup(progress, 'ru');
  assert(chronicle.includes('data-chronicle-commander'));
  assert(chronicle.includes('rpa-chronicle-list'));

  const armyFoundationModule = await import(pathToFileURL(path.join(root, 'game/js/army-foundation-approved.mjs')).href);
  assert.strictEqual(armyFoundationModule.roman(1), 'I');
  assert.strictEqual(armyFoundationModule.roman(4), 'IV');
  assert.strictEqual(armyFoundationModule.REGULAR_COPY.r.title, 'Щитоносец');
  console.log('Stage B UI: menu, chronicle, approved army draft, battle panel, scrolling and animations passed.');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
