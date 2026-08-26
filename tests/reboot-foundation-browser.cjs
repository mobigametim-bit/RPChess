const assert = require('assert');
const { chromium } = require('playwright');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('[data-reboot-foundation]').waitFor();

    assert.strictEqual(await page.locator('[data-new-game]').count(), 1, 'New Game button must exist once');
    assert.strictEqual(await page.getByRole('button', { name: 'Продолжить' }).isDisabled(), true, 'Continue must be disabled before a Reboot save exists');
    assert.strictEqual(await page.locator('[data-settings]').count(), 1, 'Settings button must exist once');

    const scripts = await page.locator('script[src]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src')));
    assert.deepStrictEqual(scripts, ['js/reboot-foundation.mjs?v=20260826-reboot-1'], `unexpected runtime scripts: ${scripts.join(', ')}`);

    const oldRuntimeGlobals = await page.evaluate(() => ({
      verticalSlice: Boolean(window.RPChessVerticalSlice),
      ironMarches: Boolean(window.RPChessIronMarchesRuntime)
    }));
    assert.strictEqual(oldRuntimeGlobals.verticalSlice, false, 'legacy vertical slice global must not be active');
    assert.strictEqual(oldRuntimeGlobals.ironMarches, false, 'legacy Iron Marches global must not be active');

    await page.locator('[data-settings]').click();
    await page.locator('[data-settings-modal]:not([hidden])').waitFor();
    await page.locator('[data-music-volume]').evaluate((input) => {
      input.value = '33';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.strictEqual(await page.locator('[data-music-volume]').inputValue(), '33', 'music setting must be interactive');
    await page.locator('[data-settings-modal] [data-close-modal]').click();
    assert.strictEqual(await page.locator('[data-settings-modal]').getAttribute('hidden'), '', 'settings modal must close');

    await page.locator('[data-new-game]').click();
    await page.locator('[data-foundation-modal]:not([hidden])').waitFor();
    assert((await page.locator('[data-foundation-modal]').innerText()).includes('классические шахматы'), 'New Game must lead to the next-feature boundary, not legacy gameplay');
    await page.locator('[data-foundation-modal] [data-close-modal]').click();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 500 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await mobile.goto(url, { waitUntil: 'networkidle' });
    const scrollContract = await mobile.evaluate(() => ({
      htmlOverflow: getComputedStyle(document.documentElement).overflowY,
      bodyOverflow: getComputedStyle(document.body).overflowY,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight
    }));
    assert(['auto', 'scroll'].includes(scrollContract.htmlOverflow), `html overflowY=${scrollContract.htmlOverflow}`);
    assert(['auto', 'scroll'].includes(scrollContract.bodyOverflow), `body overflowY=${scrollContract.bodyOverflow}`);
    assert(scrollContract.scrollHeight > scrollContract.clientHeight, 'small viewport must create a scrollable page');
    await mobile.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await mobile.waitForTimeout(80);
    assert((await mobile.evaluate(() => window.scrollY)) > 0, 'page must actually scroll vertically');

    assert.deepStrictEqual(errors, [], `desktop browser errors:\n${errors.join('\n')}`);
    assert.deepStrictEqual(mobileErrors, [], `mobile browser errors:\n${mobileErrors.join('\n')}`);
    console.log('Reboot Foundation real Chromium acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
