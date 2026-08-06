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
  const extension = read('game/js/vertical-slice-presenter-register-02.mjs');
  const css = read('game/css/stage-b-ui.css');
  const index = read('game/index.html');
  const isolated = read('game/vertical-slice.html');

  for (const html of [index, isolated]) assert(html.includes('css/stage-b-ui.css'));
  assert(app.includes('rpa-menu__main--open'));
  assert.strictEqual(app.includes('Проведите живую шахматную армию через Железные Марши'), false);
  assert(app.includes('data-profile-primary'));
  assert(app.includes('data-chronicle-commander'));
  assert(app.includes("card.setAttribute('aria-pressed'"));
  assert(css.includes('.rpa-menu__main--open'));
  assert(css.includes('border-image:none!important'));
  assert(css.includes('.rpa-chronicle-card{display:grid;grid-template-columns:190px minmax(0,1fr) auto'));
  assert(css.includes('.rpvs__top--battle{border:0!important'));
  assert(css.includes('.rpvs__battle-sidebar-scroll'));
  assert(css.includes('overflow-y:auto'));
  assert(css.includes('.rp02-mechanic-card,.rp02-relic-slot{display:grid!important;grid-template-columns:58px minmax(0,1fr)'));
  assert(css.includes('.rpvs__moving-piece'));
  assert(presenter.includes('animateBattleChanges(previous, snapshot)'));
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

  const appModule = await import(pathToFileURL(path.join(root, 'game/js/vertical-slice-app.mjs')).href);
  const progress = appModule.readShellProgress({ getItem: () => null });
  const menu = appModule.menuMarkup([], progress, 'ru');
  assert(menu.includes('rpa-menu__main--open'));
  assert(!menu.includes('rpa-menu__lead'));
  const chronicle = appModule.chronicleMarkup(progress, 'ru');
  assert(chronicle.includes('data-chronicle-commander'));
  assert(chronicle.includes('rpa-chronicle-list'));
  console.log('Stage B UI: menu, chronicle, battle panel, scrolling and animations passed.');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
