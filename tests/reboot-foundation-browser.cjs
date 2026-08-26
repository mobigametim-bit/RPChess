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
    const menu = page.locator('[data-reboot-foundation]');
    await menu.waitFor();

    assert.strictEqual(await menu.locator('[data-new-game]').count(), 1, 'New Game button must exist once in the main menu');
    assert.strictEqual(await menu.getByRole('button', { name: 'Продолжить' }).isDisabled(), true, 'Continue must be disabled before a Reboot save exists');
    assert.strictEqual(await menu.locator('[data-settings]').count(), 1, 'Settings button must exist once in the main menu');
    assert.strictEqual(await page.getByText('Новый путь RPChess').count(), 0, 'prototype marketing copy must not appear in production menu');

    const scripts = await page.locator('script[src]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src')));
    assert.deepStrictEqual(scripts, [
      'js/reboot-foundation.mjs?v=20260826-reboot-3',
      'js/classic-chess-app.mjs?v=20260826-ai-1'
    ], `unexpected runtime scripts: ${scripts.join(', ')}`);

    const runtimeState = await page.evaluate(() => ({
      verticalSlice: Boolean(window.RPChessVerticalSlice),
      ironMarches: Boolean(window.RPChessIronMarchesRuntime),
      rebootAudio: Boolean(window.RPChessRebootAudio),
      classicChess: Boolean(window.RPChessClassicChess),
      chessAI: Boolean(window.RPChessChessAI),
      musicSrc: window.RPChessRebootAudio?.music?.src || '',
      activated: Boolean(window.RPChessRebootAudio?.activated)
    }));
    assert.strictEqual(runtimeState.verticalSlice, false, 'legacy vertical slice global must not be active');
    assert.strictEqual(runtimeState.ironMarches, false, 'legacy Iron Marches global must not be active');
    assert.strictEqual(runtimeState.rebootAudio, true, 'Reboot audio layer must be active');
    assert.strictEqual(runtimeState.classicChess, true, 'Classic Chess runtime must coexist with the retained Foundation menu');
    assert.strictEqual(runtimeState.chessAI, true, 'Chess AI adapter surface must be active');
    assert(runtimeState.musicSrc.includes('music/echoes_iron_throne_01.mp3'), `unexpected first music track: ${runtimeState.musicSrc}`);
    assert.strictEqual(runtimeState.activated, false, 'audio must wait for the first browser-approved user gesture');

    await menu.locator('[data-settings]').click();
    await page.locator('[data-settings-modal]:not([hidden])').waitFor();
    assert.strictEqual(await page.evaluate(() => window.RPChessRebootAudio.activated), true, 'opening settings must activate music/SFX after a user gesture');

    await page.locator('[data-music-volume]').evaluate((input) => {
      input.value = '33';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.strictEqual(await page.locator('[data-music-volume]').inputValue(), '33', 'music setting must be interactive');
    const appliedMusic = await page.evaluate(() => ({ setting: window.RPChessRebootAudio.settings.music, volume: window.RPChessRebootAudio.music?.volume }));
    assert.strictEqual(appliedMusic.setting, 33, 'music setting must reach the live audio layer');
    assert(appliedMusic.volume > 0 && appliedMusic.volume < 0.3, `unexpected live music volume: ${appliedMusic.volume}`);

    await page.locator('[data-sfx-volume]').evaluate((input) => {
      input.value = '45';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.strictEqual(await page.evaluate(() => window.RPChessRebootAudio.settings.sfx), 45, 'SFX setting must reach the live audio layer');
    await page.locator('[data-settings-modal] [data-close-modal]').click();

    await menu.locator('[data-new-game]').click();
    await page.locator('[data-game-setup-modal]:not([hidden])').waitFor();
    assert.strictEqual(await menu.isVisible(), true, 'new-game setup must open over the menu, not append a board below it');
    assert.strictEqual(await page.locator('[data-classic-screen]').isHidden(), true, 'game scene must stay hidden until setup is confirmed');
    await page.locator('[data-game-mode-select]').selectOption('local');
    await page.locator('[data-start-game]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    assert.strictEqual(await menu.isHidden(), true, 'Foundation menu must hide when Classic Chess begins');
    assert.strictEqual(await page.locator('[data-chess-board] [data-square]').count(), 64, 'confirmed New Game must open the real 8x8 board');
    await page.locator('[data-classic-menu]').click();
    assert.strictEqual(await menu.isVisible(), true, 'main menu must remain reachable from Classic Chess');

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
    console.log('Reboot Foundation retained-menu Chromium acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
