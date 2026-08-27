const assert = require('assert');
const { chromium } = require('playwright');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';

async function startSettlementRun(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-new-game]').click();
  await page.locator('[data-roster-screen]:not([hidden])').waitFor();
  await page.evaluate((key) => {
    const run = JSON.parse(localStorage.getItem(key));
    run.id = 'settlement-test';
    run.currentTravelChoices = null;
    run.activeTravelChoice = null;
    run.currentSettlement = null;
    localStorage.setItem(key, JSON.stringify(run));
    globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, RUN_KEY);
  await page.locator('[data-roster-travel]').click();
  await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));

    await startSettlementRun(page);
    assert.strictEqual(await page.locator('[data-travel-choice]').count(), 3, 'Travel Choice still exposes exactly three routes');
    assert.strictEqual(await page.locator('[data-travel-type="skirmish"]').count() >= 1, true);
    assert.strictEqual(await page.locator('[data-travel-type="battle"]').count() >= 1, true);
    assert.strictEqual(await page.locator('[data-travel-type="settlement"]').count(), 1, 'deterministic Settlement test fork must contain one safe route');
    const settlementCard = page.locator('[data-travel-type="settlement"]');
    assert.strictEqual(await settlementCard.locator('.travel-choice-card__threat').count(), 0, 'Settlement card must not render threat stars');
    assert((await settlementCard.innerText()).includes('БЕЗОПАСНОЕ МЕСТО'));
    assert((await settlementCard.innerText()).includes('ЛЕЧЕНИЕ · НАЙМ · СНАБЖЕНИЕ'));

    await settlementCard.click();
    const settlementScreen = page.locator('[data-settlement-screen]');
    await settlementScreen.waitFor({ state: 'visible' });
    const entered = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(entered.supplies, 9, 'entering Settlement spends the standard one Supply');
    assert.strictEqual(entered.activeTravelChoice.type, 'settlement');
    assert.strictEqual(entered.activeTravelChoice.supplyPaid, 1);
    assert.strictEqual(entered.currentSettlement.offers.length, 3);
    assert.strictEqual(entered.currentSettlement.supplyStock, 4);
    const initialOffers = [...entered.currentSettlement.offers];
    assert.strictEqual(await page.locator('[data-settlement-recruit-card]').count(), 3);
    assert((await settlementScreen.innerText()).includes('ЗНАХАРКА'));
    assert((await settlementScreen.innerText()).includes('ТАВЕРНА'));
    assert((await settlementScreen.innerText()).includes('СНАБЖЕНИЕ'));
    assert((await page.locator('[data-settlement-healer-list]').innerText()).includes('Все бойцы готовы к пути.'));

    await page.locator('[data-settlement-roster]').click();
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    assert.strictEqual((await page.locator('[data-roster-travel]').innerText()).trim(), 'Вернуться в поселение');
    const afterRoster = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.deepStrictEqual(afterRoster.currentSettlement.offers, initialOffers, 'Roster visit must preserve the exact offers');
    assert.strictEqual(afterRoster.supplies, 9, 'Roster round-trip must not double-charge Supplies');

    await page.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      run.gold = 500;
      run.roster.find((character) => character.id === 'hero.mara_chain').status = 'wounded';
      localStorage.setItem(key, JSON.stringify(run));
      globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
    }, RUN_KEY);
    await page.locator('[data-roster-travel]').click();
    await settlementScreen.waitFor({ state: 'visible' });
    assert.strictEqual((await page.locator('[data-resource-supplies]').innerText()).trim(), '9');
    assert.strictEqual(await page.locator('[data-settlement-heal="hero.mara_chain"]').count(), 1);

    await page.locator('[data-settlement-heal="hero.mara_chain"]').click();
    let state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(state.gold, 490, 'Pawn treatment costs 10 Gold');
    assert.strictEqual(state.roster.find((character) => character.id === 'hero.mara_chain').status, 'healthy');
    assert((await page.locator('[data-settlement-healer-list]').innerText()).includes('Все бойцы готовы к пути.'));

    const recruitMeta = await page.evaluate(async (key) => {
      const run = JSON.parse(localStorage.getItem(key));
      const core = await import('./js/settlement-core.mjs');
      const id = run.currentSettlement.offers[0];
      const candidate = core.recruitProfile(id);
      return { id, price: core.recruitCost(candidate), pieceType: candidate.pieceType };
    }, RUN_KEY);
    await page.locator(`[data-settlement-recruit="${recruitMeta.id}"]`).click();
    state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(state.roster.length, 7, 'recruitment appends one personalized hero');
    assert.strictEqual(state.roster.find((character) => character.id === recruitMeta.id).status, 'healthy');
    assert.strictEqual(state.gold, 490 - recruitMeta.price, 'recruitment charges the classic-type price exactly once');
    assert.strictEqual((await page.locator(`[data-settlement-recruit="${recruitMeta.id}"]`).innerText()).trim(), 'В отряде');

    const beforeSupplyGold = state.gold;
    await page.locator('[data-settlement-buy-supply]').click();
    state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(state.gold, beforeSupplyGold - 12);
    assert.strictEqual(state.supplies, 10, 'buying one Supply restores the entry Supply in this test');
    assert.strictEqual(state.currentSettlement.supplyStock, 3);
    assert.strictEqual((await page.locator('[data-settlement-supply-stock]').innerText()).trim(), '3 / 4');

    const beforeReload = JSON.parse(JSON.stringify(state));
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-continue-run]').click();
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    assert.strictEqual((await page.locator('[data-roster-travel]').innerText()).trim(), 'Вернуться в поселение');
    await page.locator('[data-roster-travel]').click();
    await settlementScreen.waitFor({ state: 'visible' });
    const afterReload = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.deepStrictEqual(afterReload.currentSettlement.offers, beforeReload.currentSettlement.offers, 'reload must not reroll recruit offers');
    assert.strictEqual(afterReload.currentSettlement.supplyStock, 3, 'reload must not refill local Supply stock');
    assert.strictEqual(afterReload.roster.some((character) => character.id === recruitMeta.id), true, 'recruit survives reload');
    assert.strictEqual(afterReload.gold, beforeReload.gold);
    assert.strictEqual(afterReload.supplies, beforeReload.supplies);

    const suppliesBeforeExit = afterReload.supplies;
    await page.locator('[data-settlement-continue]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    const completed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(completed.activeTravelChoice, null, 'Settlement completion clears the active route');
    assert.strictEqual(completed.currentSettlement, null, 'completed visit state must be released');
    assert.strictEqual(completed.supplies, suppliesBeforeExit, 'leaving Settlement does not charge another Supply');
    assert((await page.locator('[data-travel-step]').innerText()).includes('2'), 'Settlement must return to the next Travel step');

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await startSettlementRun(mobile);
    await mobile.locator('[data-travel-type="settlement"]').click();
    await mobile.locator('[data-settlement-screen]:not([hidden])').waitFor();
    const boxes = await mobile.locator('.settlement-service').evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { top: box.top, left: box.left, right: box.right, width: box.width };
    }));
    assert.strictEqual(boxes.length, 3);
    assert(boxes[1].top > boxes[0].top && boxes[2].top > boxes[1].top, 'mobile Settlement services must form a vertical stack');
    const mobileLayout = await mobile.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    assert(mobileLayout.scrollHeight > mobileLayout.clientHeight, 'mobile Settlement must permit vertical scrolling');
    assert(mobileLayout.scrollWidth <= mobileLayout.clientWidth + 1, `mobile Settlement must not overflow horizontally: ${mobileLayout.scrollWidth}/${mobileLayout.clientWidth}`);

    assert.deepStrictEqual(errors, [], `desktop Settlement page errors:\n${errors.join('\n')}`);
    assert.deepStrictEqual(mobileErrors, [], `mobile Settlement page errors:\n${mobileErrors.join('\n')}`);
    console.log('Settlement Travel entry, safe UI, Roster round-trip, services, persistence, exit and mobile Chromium acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
