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
  const settingsCss = read('game/css/settings-final.css');

  for (const html of [index, isolated]) {
    assert(html.includes('css/ui-runtime-approved.css'));
    assert(html.includes('css/chronicle-profile-final.css'));
    assert(html.includes('css/commander-selection-final.css'));
    assert(html.includes('css/settings-final.css'));
    assert(html.includes('css/ui-final-qa.css'));
    assert(html.includes('js/commander-selection-final.mjs'));
    assert(html.includes('js/settings-final.mjs'));
    assert(html.includes('js/ui-final-runtime-sanitize.mjs'));
    assert.strictEqual(html.includes('js/chronicle-profile-final.mjs'), false);
  }

  assert(chronicleCss.includes("nth-child(1)::before{content:'I'"));
  assert(chronicleCss.includes("nth-child(2)::before{content:'II'"));
  assert(chronicleCss.includes("nth-child(3)::before{content:'III'"));
  assert(finalCss.includes('.rpa-profile-card--approved::before{display:grid!important}'));
  assert(finalCss.includes('inset:auto 14px auto auto!important'));
  assert(commanderCss.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
  assert(commanderCss.includes('border-image:none!important'));
  assert(settingsCss.includes('grid-template-columns:1fr!important'));
  assert(settingsCss.includes('border-image:none!important'));

  const commander = await import(pathToFileURL(path.join(root, 'game/js/commander-selection-final.mjs')).href);
  const screen = { classList: { added: [], contains: () => false, add(value) { this.added.push(value); } } };
  const fakeRoot = { querySelector: (selector) => selector === '.rpa-commander-layout' ? { closest: () => screen } : null };
  assert.strictEqual(commander.commanderScreen(fakeRoot), screen);
  assert.deepStrictEqual(screen.classList.added, ['is-approved-commander-selection']);

  const settings = await import(pathToFileURL(path.join(root, 'game/js/settings-final.mjs')).href);
  assert.strictEqual(settings.percentForInput({ name:'uiScale', value:'1', max:'1' }), '100%');
  assert.strictEqual(settings.percentForInput({ name:'masterVolume', value:'.6', max:'1' }), '60%');

  const battle = await import(pathToFileURL(path.join(root, 'game/js/ui-approved-battle.mjs')).href);
  assert.strictEqual(battle.orderPointsLabel({ orderPoints: { player: { current: 2, max: 5 } } }), '2 / 5');
  assert.strictEqual(battle.unitLabel({ type: 'p', label: 'stage_b_regular_fortress-pawn-1' }), 'Пешка');
  assert.strictEqual(battle.unitLabel({ type: 'r', label: 'Альдрик Стена' }), 'Альдрик Стена');

  const deployment = await import(pathToFileURL(path.join(root, 'game/js/ui-approved-deployment.mjs')).href);
  assert.strictEqual(deployment.unitLabel({ type: 'p', label: 'stage_b_regular_draft-p' }), 'Пешка');

  const relicCopy = await import(pathToFileURL(path.join(root, 'game/js/register-03-relic-copy-ru.mjs')).href);
  assert.strictEqual(Object.keys(relicCopy.RELIC_EFFECT_RU).length, 72);
  assert.ok(relicCopy.relicEffectRu('relic.echo_shield').startsWith('Однократно предотвращает'));
  assert.ok(relicCopy.relicEffectRu('last_archive').includes('Хроники'));

  const sanitizer = await import(pathToFileURL(path.join(root, 'game/js/ui-final-runtime-sanitize.mjs')).href);
  assert.strictEqual(sanitizer.technicalPieceName('stage_b_regular_fortress-pawn-1'), 'Пешка');
  assert.strictEqual(sanitizer.technicalPieceName('Альдрик Стена'), null);
  assert.strictEqual(sanitizer.relicSlugFromDetail({ querySelector: () => ({ getAttribute: () => 'assets/relics/echo_shield.png' }) }), 'echo_shield');

  console.log('Final UI QA: Chronicle slots, commander/settings layouts, order points, technical-label sanitation and 72 Russian relic briefs passed.');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
