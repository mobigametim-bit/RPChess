const assert = require('assert');
const { chromium } = require('playwright');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';

async function startFresh(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-new-game]').click();
  await page.locator('[data-roster-screen]:not([hidden])').waitFor();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));

    await startFresh(page);
    const hud = page.locator('[data-resource-hud]');
    await hud.waitFor({ state: 'visible' });
    assert.strictEqual((await page.locator('[data-resource-gold]').innerText()).trim(), '80');
    assert.strictEqual((await page.locator('[data-resource-supplies]').innerText()).trim(), '10');

    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    assert.strictEqual(await page.locator('.travel-choice-card__cost').count(), 3, 'every route must disclose its Supply cost');
    const costs = await page.locator('.travel-choice-card__cost').allInnerTexts();
    assert(costs.every((text) => text.includes('1 ПРИПАС')), 'all normal travel cards must show a one-Supply cost');

    const skirmishCard = page.locator('[data-travel-type="skirmish"]').first();
    const stars = Number(await skirmishCard.getAttribute('data-travel-stars'));
    await skirmishCard.click();
    await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
    const afterCommit = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(afterCommit.supplies, 9, 'committing a route must spend exactly one Supply');
    assert.strictEqual(afterCommit.activeTravelChoice.supplyCostAtSelection, 1);
    assert.strictEqual(afterCommit.activeTravelChoice.supplyPaid, 1);
    assert.strictEqual((await page.locator('[data-resource-supplies]').innerText()).trim(), '9');

    await page.locator('[data-skirmish-back]').click();
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
    const afterResume = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(afterResume.supplies, 9, 'resuming an already committed route must never charge Supplies twice');

    await page.locator('[data-skirmish-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    await page.evaluate(() => globalThis.RPChessSkirmish.finishBattle({ over: true, type: 'stalemate', winner: null }));
    await page.locator('[data-skirmish-aftermath]:not([hidden])').waitFor();
    await page.locator('[data-skirmish-aftermath] [data-resource-combat-reward]:not([hidden])').waitFor();

    const expectedGoldReward = 6 + (2 * stars);
    const afterCombat = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(afterCombat.gold, 80 + expectedGoldReward, 'draw reward must be deterministic from encounter stars');
    assert.strictEqual(afterCombat.lastSkirmish.goldReward, expectedGoldReward, 'reward amount must be persisted with the combat result');
    assert.strictEqual(afterCombat.resourceRewards.skirmishCount, 1, 'combat reward must be marked settled exactly once');
    assert((await page.locator('[data-skirmish-aftermath] [data-resource-combat-reward]').innerText()).includes(`+${expectedGoldReward} ЗОЛОТА`));

    await page.evaluate(() => globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated')));
    await page.waitForTimeout(30);
    const afterDuplicateSignal = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(afterDuplicateSignal.gold, afterCombat.gold, 'repeated run-updated events must not duplicate combat Gold');

    await page.locator('[data-aftermath-continue]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    await page.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      run.supplies = 0;
      localStorage.setItem(key, JSON.stringify(run));
      globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
    }, RUN_KEY);
    await page.waitForTimeout(30);
    await page.locator('[data-travel-roster]').click();
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    assert.strictEqual(await page.locator('.travel-choice-card__cost.is-empty').count(), 3, 'zero Supplies must be disclosed before route commitment');
    const zeroCard = page.locator('[data-travel-choice]').first();
    await zeroCard.click();
    await page.locator('[data-skirmish-screen]:not([hidden]), [data-battle-screen]:not([hidden])').first().waitFor();
    const zeroState = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(zeroState.supplies, 0, 'Resources stage must not allow negative Supplies');
    assert.strictEqual(zeroState.activeTravelChoice.supplyPaid, 0, 'zero-Supply transition must record that no Supply was paid');

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await startFresh(mobile);
    await mobile.locator('[data-resource-hud]').waitFor({ state: 'visible' });
    const hudBox = await mobile.locator('[data-resource-hud]').boundingBox();
    assert(hudBox && hudBox.left >= -1 && hudBox.x + hudBox.width <= 391, 'mobile resource HUD must stay inside the viewport');
    const layout = await mobile.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    assert(layout.scrollWidth <= layout.clientWidth + 1, `Resources HUD must not create horizontal overflow: ${layout.scrollWidth}/${layout.clientWidth}`);

    assert.deepStrictEqual(errors, [], `desktop Resources page errors:\n${errors.join('\n')}`);
    assert.deepStrictEqual(mobileErrors, [], `mobile Resources page errors:\n${mobileErrors.join('\n')}`);
    console.log('Resources HUD, one-Supply travel cost, no double-charge, deterministic Gold reward and mobile Chromium acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
