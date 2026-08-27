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
    assert.strictEqual(await page.locator('[data-roster-battle]').count(), 0, 'temporary direct Battle shortcut must be removed');
    await page.locator('[data-roster-travel]').click();
    const travelScreen = page.locator('[data-travel-choice-screen]');
    await travelScreen.waitFor({ state: 'visible' });
    assert.strictEqual(await page.locator('[data-travel-choice]').count(), 3, 'Travel Choice must show exactly three paths');
    assert.strictEqual(await page.locator('[data-travel-type="skirmish"]').count() >= 1, true, 'v1 fork must expose Skirmish');
    assert.strictEqual(await page.locator('[data-travel-type="battle"]').count() >= 1, true, 'v1 fork must expose Battle');
    assert.strictEqual(await page.getByText('Отправиться', { exact: true }).count(), 0, 'there must be no second confirmation CTA');

    const firstOffer = await page.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      return run.currentTravelChoices.map((choice) => ({ id: choice.id, type: choice.type, stars: choice.stars, flavor: choice.flavor, seed: choice.seed }));
    }, RUN_KEY);
    assert.strictEqual(firstOffer.length, 3);

    await page.locator('[data-travel-roster]').click();
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    await page.locator('[data-roster-travel]').click();
    await travelScreen.waitFor({ state: 'visible' });
    const afterRosterVisit = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).currentTravelChoices.map((choice) => ({ id: choice.id, type: choice.type, stars: choice.stars, flavor: choice.flavor, seed: choice.seed })), RUN_KEY);
    assert.deepStrictEqual(afterRosterVisit, firstOffer, 'opening Roster must preserve the exact same three paths');

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-continue-run]').click();
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    await page.locator('[data-roster-travel]').click();
    await travelScreen.waitFor({ state: 'visible' });
    const afterReload = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).currentTravelChoices.map((choice) => ({ id: choice.id, type: choice.type, stars: choice.stars, flavor: choice.flavor, seed: choice.seed })), RUN_KEY);
    assert.deepStrictEqual(afterReload, firstOffer, 'reload must not reroll an existing fork');

    const skirmishCard = page.locator('[data-travel-type="skirmish"]').first();
    const chosenId = await skirmishCard.getAttribute('data-travel-choice');
    await skirmishCard.click();
    await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
    const chosenState = await page.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      return { journeyStep: run.journeyStep, current: run.currentTravelChoices, active: run.activeTravelChoice };
    }, RUN_KEY);
    assert.strictEqual(chosenState.journeyStep, 1);
    assert.strictEqual(chosenState.current, null);
    assert.strictEqual(chosenState.active.id, chosenId);
    assert.strictEqual(chosenState.active.type, 'skirmish');
    const routedEncounter = await page.evaluate(() => ({ seed: globalThis.RPChessSkirmish.encounter.seed, stars: globalThis.RPChessSkirmish.encounter.stars }));
    assert.strictEqual(routedEncounter.seed, chosenState.active.seed, 'chosen path seed must reach Skirmish generator');
    assert.strictEqual(routedEncounter.stars, chosenState.active.stars, 'chosen threat must reach Skirmish generator');

    await page.locator('[data-skirmish-back]').click();
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
    assert.strictEqual(await travelScreen.isHidden(), true, 'an already chosen route cannot be reselected');
    const resumedEncounter = await page.evaluate(() => ({ seed: globalThis.RPChessSkirmish.encounter.seed, stars: globalThis.RPChessSkirmish.encounter.stars }));
    assert.deepStrictEqual(resumedEncounter, routedEncounter, 'returning from Roster must resume the same irreversible route');

    await page.locator('[data-skirmish-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    await page.evaluate(() => globalThis.RPChessSkirmish.finishBattle({ over: true, type: 'stalemate', winner: null }));
    await page.locator('[data-skirmish-aftermath]:not([hidden])').waitFor();
    assert.strictEqual((await page.locator('[data-aftermath-continue]').innerText()).trim(), 'Продолжить путь');
    const postEncounter = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(postEncounter.activeTravelChoice, null, 'completed encounter must release the active route');
    assert.strictEqual(postEncounter.skirmishCount, 1);

    await page.locator('[data-aftermath-continue]').click();
    await travelScreen.waitFor({ state: 'visible' });
    assert((await page.locator('[data-travel-step]').innerText()).includes('2'), 'aftermath must continue to the next travel step');
    const secondOfferIds = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).currentTravelChoices.map((choice) => choice.id), RUN_KEY);
    assert.strictEqual(secondOfferIds.length, 3);
    assert.notDeepStrictEqual(secondOfferIds, firstOffer.map((choice) => choice.id), 'next fork must be a newly generated deterministic step');

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await startFresh(mobile);
    await mobile.locator('[data-roster-travel]').click();
    await mobile.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    assert.strictEqual(await mobile.locator('[data-travel-choice]').count(), 3);
    const boxes = await mobile.locator('[data-travel-choice]').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).map((box) => ({ top: box.top, left: box.left, right: box.right, width: box.width })));
    assert(boxes[1].top > boxes[0].top && boxes[2].top > boxes[1].top, 'mobile Travel cards must form a vertical list');
    const mobileLayout = await mobile.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    assert(mobileLayout.scrollHeight > mobileLayout.clientHeight, 'mobile Travel Choice must permit vertical scrolling');
    assert(mobileLayout.scrollWidth <= mobileLayout.clientWidth + 1, `mobile Travel Choice must not overflow horizontally: ${mobileLayout.scrollWidth}/${mobileLayout.clientWidth}`);

    assert.deepStrictEqual(errors, [], `desktop Travel Choice page errors:\n${errors.join('\n')}`);
    assert.deepStrictEqual(mobileErrors, [], `mobile Travel Choice page errors:\n${mobileErrors.join('\n')}`);
    console.log('Travel Choice immediate selection, persistence, irreversible routing, aftermath loop and mobile Chromium acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
