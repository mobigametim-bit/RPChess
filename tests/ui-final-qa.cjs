'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

(async () => {
  const index = read('game/index.html');
  const isolated = read('game/vertical-slice.html');
  const finalCss = read('game/css/ui-final-qa.css');
  const chronicleCss = read('game/css/chronicle-profile-final.css');
  const commanderCss = read('game/css/commander-selection-final.css');

  for (const html of [index, isolated]) {
    assert(html.includes('css/ui-runtime-approved.css'));
    assert(html.includes('css/chronicle-profile-final.css'));
    assert(html.includes('css/commander-selection-final.css'));
    assert(html.includes('css/ui-final-qa.css'));
    assert(html.includes('js/commander-selection-final.mjs'));
    assert(html.includes('js/ui-final-runtime-sanitize.mjs'));
    assert.strictEqual(html.includes('js/chronicle-profile-final.mjs'), false);
  }

  assert(chronicleCss.includes("nth-child(1)::before{content:'I'"));
  assert(chronicleCss.includes("nth-child(2)::before{content:'II'"));
  assert(chronicleCss.includes("nth-child(3)::before{content:'III'"));
  assert(finalCss.includes('.rpa-profile-card--approved::before{display:grid!important}'));
  assert(commanderCss.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
  assert(commanderCss.includes('border-image:none!important'));

  const commander = await import(pathToFileURL(path.join(root, 'game/js/commander-selection-final.mjs')).href);
  const screen = { classList: { added: [], contains: () => false, add(value) { this.added.push(value); } } };
  const fakeRoot = { querySelector: (selector) => selector === '.rpa-commander-layout' ? { closest: () => screen } : null };
  assert.strictEqual(commander.commanderScreen(fakeRoot), screen);
  assert.deepStrictEqual(screen.classList.added, ['is-approved-commander-selection']);

  const battle = await import(pathToFileURL(path.join(root, 'game/js/ui-approved-battle.mjs')).href);
  assert.strictEqual(battle.orderPointsLabel({ orderPoints: { player: { current: 2, max: 5 } } }), '2 / 5');
  assert.strictEqual(battle.unitLabel({ type: 'p', label: 'stage_b_regular_fortress-pawn-1' }), 'Пешка');
  assert.strictEqual(battle.unitLabel({ type: 'r', label: 'Альдрик Стена' }), 'Альдрик Стена');

  const deployment = await import(pathToFileURL(path.join(root, 'game/js/ui-approved-deployment.mjs')).href);
  assert.strictEqual(deployment.unitLabel({ type: 'p', label: 'stage_b_regular_draft-p' }), 'Пешка');

  const sanitizer = await import(pathToFileURL(path.join(root, 'game/js/ui-final-runtime-sanitize.mjs')).href);
  assert.strictEqual(sanitizer.technicalPieceName('stage_b_regular_fortress-pawn-1'), 'Пешка');
  assert.strictEqual(sanitizer.technicalPieceName('Альдрик Стена'), null);

  console.log('Final UI QA: Chronicle slots, commander activation, order points and technical-label sanitation passed.');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
