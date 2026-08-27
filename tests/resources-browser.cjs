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
    const initial = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(initial.gold, 80, 'new run must expose starting Gold');
    assert.strictEqual(initial.supplies, 10, 'new run must expose starting Supplies');
    const hud = page.locator('[data-resource-hud]');
    await hud.waitFor({ state: 'visible' });
    assert.strictEqual((await page.locator('[data-resource-gold]').innerText()).trim(), '80');
    assert.strictEqual((await page.locator('[data-resource-supplies]').innerText()).trim(), '10');

    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    assert.strictEqual(await page.locator('.travel-choice-card__cost').count(), 3, 'each route must disclose its Supply cost');
    for (const text of await page.locator('.travel-choice-card__cost').allInnerTexts()) assert(text.includes('1 ПРИПАС'), `route cost must disclose one Supply: ${text}`);

    const skirmishCard = page.locator('[data-travel-type="skirmish"]').first();
    await skirmishCard.click();
    await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
    const committed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(committed.supplies, 9, 'committing a new route must spend exactly one Supply');
    assert.strictEqual(committed.activeTravelChoice.supplyPaid, 1, 'active route must remember the exact Supply payment');
    assert.strictEqual((await page.locator('[data-resource-supplies]').innerText()).trim(), '9');

    await page.locator('[data-skirmish-back]').click();
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
    const resumed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(resumed.supplies, 9, 'resuming an already committed route must never charge Supplies twice');

    const stars = resumed.activeTravelChoice.stars;
    await page.locator('[data-skirmish-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    await page.evaluate(() => globalThis.RPChessSkirmish.finishBattle({ over: true, type: 'stalemate', winner: null }));
    await page.locator('[data-skirmish-aftermath]:not([hidden])').waitFor();
    const expectedReward = Math.floor((12 + stars * 4) / 2);
    const rewarded = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(rewarded.gold, 80 + expectedReward, 'Skirmish draw must grant the deterministic half Gold reward once');
    const visibleReward = page.locator('[data-skirmish-aftermath]:not([hidden]) [data-resource-combat-reward]:not([hidden])');
    assert.strictEqual(await visibleReward.count(), 1, 'active aftermath must present exactly one visible Gold reward');
    assert((await visibleReward.innerText()).includes(`+${expectedReward}`));

    await page.evaluate(() => globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated')));
    const afterRepeatedSync = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(afterRepeatedSync.gold, rewarded.gold, 'repeated run synchronization must not duplicate Gold rewards');

    await page.locator('[data-aftermath-continue]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    await page.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      run.supplies = 0;
      localStorage.setItem(key, JSON.stringify(run));
      globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
    }, RUN_KEY);
    await page.waitForTimeout(30);
    assert.strictEqual(await page.locator('.travel-choice-card__cost.is-empty').count(), 3, 'zero Supplies must be disclosed before route commitment');
    const zeroCard = page.locator('[data-travel-type="skirmish"], [data-travel-type="battle"]').first();
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
    assert(hudBox && hudBox.x >= -1 && hudBox.x + hudBox.width <= 391, `mobile resource HUD must stay inside the viewport: ${JSON.stringify(hudBox)}`);
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
