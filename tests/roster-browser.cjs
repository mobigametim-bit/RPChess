const assert = require('assert');
const { chromium } = require('playwright');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';

async function startFresh(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil: 'networkidle' });
}

async function panelStyle(locator) {
  return locator.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      borderImageSource: style.borderImageSource,
      borderLeftWidth: style.borderLeftWidth,
      paddingLeft: style.paddingLeft,
      backgroundImage: style.backgroundImage,
      borderRadius: style.borderRadius
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));

    await startFresh(page);
    const menu = page.locator('[data-reboot-foundation]');
    const roster = page.locator('[data-roster-screen]');
    const continueButton = page.locator('[data-continue-run]');

    assert.strictEqual(await menu.isVisible(), true, 'main menu must start visible');
    assert.strictEqual(await roster.isHidden(), true, 'Roster scene must start hidden');
    assert.strictEqual(await continueButton.isDisabled(), true, 'Continue must be disabled without a saved run');

    await page.locator('[data-new-game]').click();
    await roster.waitFor({ state: 'visible' });
    assert.strictEqual(await menu.isHidden(), true, 'New Game must switch to Roster instead of appending another scene');
    assert.strictEqual(await page.locator('[data-classic-screen]').isHidden(), true, 'Classic Chess scene must remain hidden during Roster');
    assert.strictEqual(await page.locator('[data-roster-card]').count(), 6, 'starter run must render six personalized characters');
    assert.strictEqual(await page.locator('[data-run-king="true"]').count(), 1, 'starter roster must visibly contain one run king');
    assert.strictEqual(await page.locator('[data-roster-card="king.oathkeeper"]').getAttribute('aria-pressed'), 'true', 'Oathkeeper must be selected first');
    assert((await page.locator('[data-roster-detail]').innerText()).includes('Хранитель Клятвы'), 'detail panel must show starter king');
    assert((await page.locator('[data-roster-detail]').innerText()).includes('КОРОЛЬ ОТРЯДА'), 'run king must be explicitly identified');
    assert.strictEqual((await page.locator('[data-roster-card="hero.aldric_wall"] .roster-card__value').innerText()).trim(), '5', 'rook must expose classic value 5');
    assert.strictEqual((await page.locator('[data-roster-card="hero.mara_chain"] .roster-card__value').innerText()).trim(), '1', 'pawn must expose classic value 1');

    for (const panel of [page.locator('[data-roster-detail]'), page.locator('.roster-catalog')]) {
      const style = await panelStyle(panel);
      assert.strictEqual(style.borderImageSource, 'none', 'Roster production panels must not render an ornate border image');
      assert(parseFloat(style.borderLeftWidth) <= 2, `Roster production panel edge must remain thin: ${style.borderLeftWidth}`);
      assert(parseFloat(style.paddingLeft) >= 30, `desktop Roster panel needs deliberate left safe-area inset: ${style.paddingLeft}`);
    }

    await page.locator('[data-roster-screen] [data-settings]').click();
    const settingsPanel = page.locator('[data-settings-modal]:not([hidden]) .reboot-modal__panel');
    await settingsPanel.waitFor();
    const settingsStyle = await panelStyle(settingsPanel);
    assert.strictEqual(settingsStyle.borderImageSource, 'none', 'settings modal must use the global frameless surface');
    assert(parseFloat(settingsStyle.borderLeftWidth) <= 2, `settings modal edge must stay thin: ${settingsStyle.borderLeftWidth}`);
    await page.locator('[data-settings-modal] [data-close-modal]').click();

    await page.locator('[data-roster-card="hero.aldric_wall"]').click();
    assert((await page.locator('[data-roster-detail]').innerText()).includes('Альдрик Стена'), 'clicking a card must change selected-character detail');
    assert.strictEqual(await page.locator('[data-roster-card="hero.aldric_wall"]').getAttribute('aria-pressed'), 'true', 'selected card must expose pressed state');

    const savedSelection = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).selectedCharacterId, RUN_KEY);
    assert.strictEqual(savedSelection, 'hero.aldric_wall', 'selected character must persist immediately');

    await page.locator('[data-roster-menu]').click();
    await menu.waitFor({ state: 'visible' });
    assert.strictEqual(await continueButton.isDisabled(), false, 'Continue must activate after creating a run');

    await page.reload({ waitUntil: 'networkidle' });
    assert.strictEqual(await page.locator('[data-continue-run]').isDisabled(), false, 'Continue must survive page reload');
    await page.locator('[data-continue-run]').click();
    await roster.waitFor({ state: 'visible' });
    assert((await page.locator('[data-roster-detail]').innerText()).includes('Альдрик Стена'), 'Continue must restore selected roster character');

    await page.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      run.roster.find((character) => character.id === 'hero.mara_chain').status = 'wounded';
      run.roster.find((character) => character.id === 'hero.nemea_quill').status = 'dead';
      localStorage.setItem(key, JSON.stringify(run));
    }, RUN_KEY);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-continue-run]').click();
    await roster.waitFor({ state: 'visible' });

    await page.locator('[data-roster-filter="wounded"]').click();
    assert.strictEqual(await page.locator('[data-roster-card]').count(), 1, 'Wounded filter must show only wounded characters');
    assert((await page.locator('[data-roster-card]').innerText()).includes('Мара Цепь'), 'wounded filter must show Mara');
    assert((await page.locator('[data-roster-card]').innerText()).includes('ТЯЖЕЛО РАНЕН'), 'wounded card must expose status');

    await page.locator('[data-roster-filter="dead"]').click();
    assert.strictEqual(await page.locator('[data-roster-card]').count(), 1, 'Dead memorial filter must show only dead characters');
    assert((await page.locator('[data-roster-card]').innerText()).includes('Немея Перо'), 'dead memorial must retain Nemea');
    assert((await page.locator('[data-roster-card]').innerText()).includes('ПОГИБ'), 'dead card must expose memorial status');

    await page.locator('[data-roster-filter="all"]').click();
    assert.strictEqual(await page.locator('[data-roster-card]').count(), 6, 'All filter must preserve the full run history including dead characters');

    const detailBounds = await page.locator('[data-roster-detail]').boundingBox();
    const detailContentBounds = await page.locator('[data-roster-detail] .roster-detail__media').boundingBox();
    assert(detailBounds && detailContentBounds && detailContentBounds.x > detailBounds.x + 25, 'Roster detail content must respect global left safe area');

    const serializedRun = await page.evaluate((key) => localStorage.getItem(key), RUN_KEY);
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await mobile.goto(url, { waitUntil: 'networkidle' });
    await mobile.evaluate(([key, value]) => localStorage.setItem(key, value), [RUN_KEY, serializedRun]);
    await mobile.reload({ waitUntil: 'networkidle' });
    await mobile.locator('[data-continue-run]').click();
    await mobile.locator('[data-roster-screen]:not([hidden])').waitFor();
    assert.strictEqual(await mobile.locator('[data-roster-card]').count(), 6, 'mobile Roster must render the same run');
    const mobilePanelStyle = await panelStyle(mobile.locator('[data-roster-detail]'));
    assert.strictEqual(mobilePanelStyle.borderImageSource, 'none', 'mobile Roster must remain frameless');
    assert(parseFloat(mobilePanelStyle.paddingLeft) >= 26, `mobile Roster needs a deliberate safe left inset: ${mobilePanelStyle.paddingLeft}`);
    const mobileState = await mobile.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    assert(mobileState.scrollHeight > mobileState.clientHeight, 'mobile Roster must scroll vertically when it does not fit');
    assert(mobileState.scrollWidth <= mobileState.clientWidth + 1, `mobile Roster must not overflow horizontally: ${mobileState.scrollWidth}/${mobileState.clientWidth}`);

    assert.deepStrictEqual(errors, [], `desktop Roster page errors:\n${errors.join('\n')}`);
    assert.deepStrictEqual(mobileErrors, [], `mobile Roster page errors:\n${mobileErrors.join('\n')}`);
    console.log('Roster new-run, persistence, frameless surfaces, status filters and responsive Chromium acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});