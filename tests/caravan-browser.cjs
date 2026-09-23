const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';

async function resumeCaravan(page, selector) {
  await page.reload({ waitUntil:'networkidle' });
  await page.locator('[data-continue-run]').click();
  await page.locator('[data-roster-screen]:not([hidden])').waitFor();
  await page.locator('[data-roster-travel]').click();
  await page.locator(selector).waitFor();
}

async function openCaravan(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await startNewRun(page);
  await page.evaluate(async (key) => {
    const { createTravelChoices } = await import('./js/travel-choice-core.mjs');
    const run = JSON.parse(localStorage.getItem(key));
    run.currentTravelChoices = createTravelChoices({ runId:run.id, types:['caravan'], step:run.step || 1 });
    run.activeTravelChoice = null;
    localStorage.setItem(key, JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, RUN_KEY);
  await page.locator('[data-roster-travel]').click();
  await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
  const card = page.locator('[data-travel-type="caravan"]').first();
  assert((await card.innerText()).includes('???'), 'route must conceal its reward');
  await card.click();
  await page.locator('[data-battle-screen]:not([hidden])').waitFor();
  const run = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
  assert.equal(run.activeTravelChoice.type, 'caravan');
  assert.equal(run.currentCaravan.phase, 'preparation');
  assert.equal(run.activeTravelChoice.supplyPaid, 1);
  assert(!(await page.locator('[data-battle-army-note]').innerText()).includes('стоит'), 'mercenaries must be free');
  return run;
}

(async () => {
  const browser = await chromium.launch({ headless:true });
  try {
    const page = await browser.newPage({ viewport:{width:1440,height:900} });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));
    const before = await openCaravan(page);
    await resumeCaravan(page, '[data-battle-screen]:not([hidden])');
    const restored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.equal(restored.currentCaravan.encounter.positionIndex, before.currentCaravan.encounter.positionIndex);
    assert.equal(restored.supplies, before.supplies, 'reload must not charge Supplies twice');

    await page.locator('[data-battle-start]').click();
    await page.locator('[data-artifact-choice-modal]').waitFor();
    await page.locator('[data-artifact-choice="none"]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    const plan = await page.evaluate(() => globalThis.RPChessBattle.battlePlan);
    assert(plan.chess960);
    assert.equal(plan.playerFormation.length, 16);
    assert.equal(plan.enemyFormation.length, 16);
    await resumeCaravan(page, '[data-classic-screen]:not([hidden])');
    assert.equal((await page.evaluate(() => globalThis.RPChessBattle.battlePlan)).fen, plan.fen);

    await page.evaluate((color) => globalThis.RPChessBattle.finishBattle({over:true,type:'checkmate',winner:color}), plan.playerColor);
    await page.locator('[data-caravan-rewards]').waitFor();
    assert.equal(await page.locator('[data-caravan-reward]').count(), 3);
    await resumeCaravan(page, '[data-caravan-rewards]');
    const offer = await page.locator('[data-caravan-reward]').first().getAttribute('data-caravan-reward');
    await page.locator('[data-caravan-reward]').first().click();
    await page.locator('[data-battle-aftermath]:not([hidden])').waitFor();
    const claimed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.equal(claimed.currentCaravan.phase, 'aftermath');
    assert.equal(claimed.currentCaravan.claimedReward.id, offer);
    await resumeCaravan(page, '[data-battle-aftermath]:not([hidden])');
    assert.equal(await page.locator('[data-caravan-rewards]').count(), 0, 'claimed reward must not reappear');
    await page.locator('[data-battle-continue]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    const continued = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.equal(continued.currentCaravan, null);
    assert.equal(continued.activeTravelChoice, null);
    assert.deepEqual(errors, []);

    const mobile = await browser.newPage({ viewport:{width:844,height:390} });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await openCaravan(mobile);
    const layout = await mobile.evaluate(() => ({
      pageWidth:document.documentElement.scrollWidth,
      viewportWidth:document.documentElement.clientWidth,
      pageHeight:document.documentElement.scrollHeight,
      viewportHeight:document.documentElement.clientHeight,
      start:(() => {const r=document.querySelector('[data-battle-start]').getBoundingClientRect();return {top:r.top,bottom:r.bottom};})()
    }));
    assert(layout.pageWidth <= layout.viewportWidth + 1 && layout.pageHeight <= layout.viewportHeight + 1, `mobile preparation must fit the viewport: ${JSON.stringify(layout)}`);
    assert(layout.start.top >= 0 && layout.start.bottom <= layout.viewportHeight + 1, 'mobile Start button must be reachable');
    assert.deepEqual(mobileErrors, []);
    console.log('Caravan browser: route, free mercenaries, reload, Chess960, reward claim, aftermath and mobile PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
