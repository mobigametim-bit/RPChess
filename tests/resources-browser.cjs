const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';

async function fresh(page) {
  await page.goto(url, { waitUntil:'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil:'networkidle' });
  await startNewRun(page);
  await page.evaluate((key) => {
    const run = JSON.parse(localStorage.getItem(key));
    run.id = 'skirmish-2';
    run.currentTravelChoices = null;
    run.activeTravelChoice = null;
    localStorage.setItem(key, JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, RUN_KEY);
}

(async () => {
  const browser = await chromium.launch({ headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));
    await fresh(page);
    assert.strictEqual((await page.locator('[data-resource-gold]').innerText()).trim(), '80');
    assert.strictEqual((await page.locator('[data-resource-supplies]').innerText()).trim(), '10');
    await page.locator('[data-roster-travel]').click();
    const travel = page.locator('[data-travel-choice-screen]:not([hidden])');
    await travel.waitFor();
    assert.strictEqual((await page.locator('[data-travel-inline-gold]').innerText()).trim(), '80');
    assert.strictEqual((await page.locator('[data-travel-inline-supplies]').innerText()).trim(), '10');
    assert.strictEqual(await page.locator('.travel-choice-card__cost').count(), 3);
    for (const amount of await page.locator('.travel-choice-card__cost-amount').allInnerTexts()) assert.strictEqual(amount.trim(), '-1');
    assert.strictEqual(await page.locator('.travel-choice-card__cost-icon').count(), 3);
    for (const label of await page.locator('.travel-choice-card__cost').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') || ''))) assert(label.includes('Стоимость пути: 1 припас.'));
    assert.strictEqual(await page.locator('[data-resource-hud]').isVisible(), false, 'fixed HUD must stay visually removed on compact Travel');
    await page.locator('[data-travel-type="skirmish"]').first().click();
    await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
    let run = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(run.supplies, 9);
    const stars = run.activeTravelChoice.stars;
    await page.locator('[data-skirmish-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    await page.evaluate(() => globalThis.RPChessSkirmish.finishBattle({ over:true, type:'stalemate', winner:null }));
    await page.locator('[data-skirmish-aftermath]:not([hidden])').waitFor();
    run = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(run.gold, 80 + Math.floor((12 + stars * 4) / 2));
    await page.locator('[data-aftermath-continue]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    await page.evaluate((key) => {
      const current = JSON.parse(localStorage.getItem(key));
      current.supplies = 0;
      localStorage.setItem(key, JSON.stringify(current));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
    }, RUN_KEY);
    await page.waitForTimeout(30);
    assert.strictEqual(await page.locator('.travel-choice-card__cost.is-empty').count(), 3);
    assert.strictEqual((await page.locator('[data-travel-inline-supplies]').innerText()).trim(), '0');

    const mobile = await browser.newPage({ viewport:{ width:844, height:390 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await fresh(mobile);
    await mobile.locator('[data-roster-travel]').click();
    await mobile.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    const inline = mobile.locator('[data-travel-inline-resources]');
    await inline.waitFor({ state:'visible' });
    const layout = await mobile.evaluate(() => {
      const inline = document.querySelector('[data-travel-inline-resources]')?.getBoundingClientRect();
      return {
        sw:document.documentElement.scrollWidth,
        cw:document.documentElement.clientWidth,
        sh:document.documentElement.scrollHeight,
        ch:document.documentElement.clientHeight,
        inline:inline ? { left:inline.left, right:inline.right, top:inline.top, bottom:inline.bottom } : null
      };
    });
    assert(layout.sw <= layout.cw + 1 && layout.sh <= layout.ch + 1, `landscape-mobile Resources/Travel must stay one-screen: ${layout.sw}/${layout.cw} ${layout.sh}/${layout.ch}`);
    assert(layout.inline && layout.inline.left >= -1 && layout.inline.right <= layout.cw + 1 && layout.inline.top >= -1 && layout.inline.bottom <= layout.ch + 1, 'inline resources must remain inside the viewport');
    assert.strictEqual(await mobile.locator('[data-resource-hud]').isVisible(), false);

    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(mobileErrors, []);
    console.log('Resources inline Travel presentation, canonical charge/reward, zero-Supply warning and landscape-mobile Chromium acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});