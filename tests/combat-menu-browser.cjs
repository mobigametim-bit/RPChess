const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const key = 'rpchess.reboot.v1.run';

async function openEncounter(page, type) {
  await page.goto(url, { waitUntil:'networkidle' });
  await page.evaluate(runKey => localStorage.removeItem(runKey), key);
  await page.reload({ waitUntil:'networkidle' });
  await startNewRun(page);
  await page.evaluate(async ({ runKey, encounterType }) => {
    const { createTravelChoices } = await import('./js/travel-choice-core.mjs');
    const run = JSON.parse(localStorage.getItem(runKey));
    run.currentTravelChoices = createTravelChoices({ runId:run.id, types:[encounterType], step:1 });
    run.activeTravelChoice = null;
    localStorage.setItem(runKey, JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, { runKey:key, encounterType:type });
  await page.locator('[data-roster-travel]').click();
  await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();

  const travel = await page.evaluate(() => {
    const supplies = document.querySelector('.travel-choice-inline-resources').getBoundingClientRect();
    const firstAction = document.querySelector('[data-travel-roster]').getBoundingClientRect();
    const lastAction = document.querySelector('[data-travel-menu]').getBoundingClientRect();
    const header = document.querySelector('.travel-choice-topbar').getBoundingClientRect();
    return { suppliesRight:supplies.right, actionsLeft:firstAction.left, actionsRight:lastAction.right, headerRight:header.right };
  });
  assert(travel.actionsLeft > travel.suppliesRight + 40 && travel.headerRight - travel.actionsRight < 30,
    `Travel actions should align at the right edge: ${JSON.stringify(travel)}`);
  await page.locator('[data-travel-menu]').click();
  await page.locator('[data-reboot-foundation]:not([hidden])').waitFor();
  assert.equal((await page.evaluate(runKey => JSON.parse(localStorage.getItem(runKey)), key)).activeTravelChoice, null);
  await page.locator('[data-continue-run]').click();
  await page.locator('[data-roster-travel]').click();
  await page.locator(`[data-travel-type="${type}"]`).first().click();
  const prep = type === 'skirmish' ? '[data-skirmish-screen]' : '[data-battle-screen]';
  await page.locator(`${prep}:not([hidden])`).waitFor();
  if (type === 'caravan') {
    const backdrop = await page.evaluate(() => {
      const choice = globalThis.RPChessTravelChoice.activeChoice;
      const expected = globalThis.RPChessSceneVisuals.backdropPath(choice.seed, choice.enemyRaceTag);
      return { expected, actual:document.querySelector('[data-battle-screen]').dataset.battleBackdrop };
    });
    assert.equal(backdrop.actual, backdrop.expected, 'Caravan preparation should match rolled enemy race');
  }
  await page.locator(type === 'skirmish' ? '[data-skirmish-start]' : '[data-battle-start]').click();
  await page.locator('[data-artifact-choice="none"]').click();
  await page.locator('[data-classic-screen]:not([hidden])').waitFor();
  await page.locator('[data-combat-menu]:visible').waitFor();
  if (type === 'caravan') {
    const backdrop = await page.evaluate(() => ({
      prep:document.querySelector('[data-battle-screen]').dataset.battleBackdrop,
      combat:document.querySelector('[data-classic-screen]').dataset.combatBackdrop
    }));
    assert.equal(backdrop.combat, backdrop.prep, 'Caravan combat backdrop should match preparation');
  }
}

(async () => {
  const browser = await chromium.launch({ headless:true });
  try {
    for (const type of ['skirmish', 'battle', 'caravan']) {
      const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await openEncounter(page, type);
      const before = await page.evaluate(runKey => JSON.parse(localStorage.getItem(runKey)), key);
      await page.locator('[data-combat-menu]').click();
      await page.locator('[data-combat-exit-dialog]').waitFor();
      assert((await page.locator('#combat-exit-warning').innerText()).includes('поражение'));
      await page.locator('[data-combat-exit-cancel]').click();
      assert.equal((await page.evaluate(runKey => JSON.parse(localStorage.getItem(runKey)), key))[`${type}Count`] || 0, before[`${type}Count`] || 0);
      assert(await page.locator('[data-classic-screen]').isVisible());
      await page.locator('[data-combat-menu]').click();
      await page.locator('[data-combat-exit-confirm]').click();
      await page.locator('[data-reboot-foundation]:not([hidden])').waitFor();
      const after = await page.evaluate(runKey => JSON.parse(localStorage.getItem(runKey)), key);
      assert.equal(after[`${type}Count`], (before[`${type}Count`] || 0) + 1, `${type}: forfeit counted once`);
      assert.equal(after.activeTravelChoice, null, `${type}: finished route cleared`);
      assert.equal(after.currentCaravan, null, `${type}: no pending Caravan reward`);
      const result = type === 'caravan' ? after.lastCaravan : type === 'battle' ? after.lastBattle : after.lastSkirmish;
      assert.equal(result.result, 'checkmate', `${type}: defeat result recorded`);
      assert.equal(result.winner, result.playerColor === 'w' ? 'b' : 'w', `${type}: enemy wins`);
      await page.reload({ waitUntil:'networkidle' });
      assert.equal((await page.evaluate(runKey => JSON.parse(localStorage.getItem(runKey)), key))[`${type}Count`], after[`${type}Count`]);
      assert.deepEqual(errors, [], `${type}: no browser errors`);
      await page.close();
    }
    console.log('Travel menu and Skirmish/Battle/Caravan defeat confirmation: PASS');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
