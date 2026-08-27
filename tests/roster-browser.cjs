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
      paddingLeft: style.paddingLeft
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
    const skirmish = page.locator('[data-skirmish-screen]');
    const classic = page.locator('[data-classic-screen]');
    const continueButton = page.locator('[data-continue-run]');

    assert.strictEqual(await menu.isVisible(), true, 'main menu must start visible');
    assert.strictEqual(await continueButton.isDisabled(), true, 'Continue must be disabled without a saved run');

    await page.locator('[data-new-game]').click();
    await roster.waitFor({ state: 'visible' });
    assert.strictEqual(await menu.isHidden(), true, 'New Game must switch to Roster');
    assert.strictEqual(await classic.isHidden(), true, 'Classic Chess must stay hidden during Roster');
    assert.strictEqual(await page.locator('[data-roster-card]').count(), 6, 'starter run must render six personalized characters');
    assert.strictEqual(await page.locator('[data-run-king="true"]').count(), 1, 'starter roster must contain one run king');
    assert.strictEqual(await page.locator('[data-roster-card="king.oathkeeper"]').getAttribute('aria-pressed'), 'true');

    const oathkeeperDetail = await page.locator('[data-roster-detail]').innerText();
    assert(oathkeeperDetail.includes('Хранитель Клятвы'));
    assert(oathkeeperDetail.includes('Последний хранитель древней присяги Железных Маршей'));
    for (const removed of ['Обязательная фигура текущего забега.', 'Готов к участию в будущих сражениях.', 'Король отряда и центральная фигура текущего забега.']) {
      assert(!oathkeeperDetail.includes(removed), `removed Roster detail copy must stay absent: ${removed}`);
    }

    for (const panel of [page.locator('[data-roster-detail]'), page.locator('.roster-catalog')]) {
      const style = await panelStyle(panel);
      assert.strictEqual(style.borderImageSource, 'none', 'Roster production panels must remain frameless');
      assert(parseFloat(style.borderLeftWidth) <= 2, `Roster panel edge must remain thin: ${style.borderLeftWidth}`);
      assert(parseFloat(style.paddingLeft) >= 30, `desktop Roster panel needs safe left inset: ${style.paddingLeft}`);
    }

    await page.locator('[data-roster-travel]').click();
    await skirmish.waitFor({ state: 'visible' });
    assert.strictEqual(await roster.isHidden(), true, 'Start Journey must leave Roster');
    assert.strictEqual(await menu.isHidden(), true, 'Skirmish must be an exclusive scene');
    assert.strictEqual(await classic.isHidden(), true, 'Chess board must not open before Skirmish confirmation');
    assert.strictEqual((await page.locator('[data-skirmish-piece-count]').innerText()).trim(), '6 / 16');
    assert.strictEqual((await page.locator('[data-skirmish-point-count]').innerText()).trim(), '13 / 39');

    await page.locator('[data-skirmish-back]').click();
    await roster.waitFor({ state: 'visible' });

    await page.locator('[data-roster-card="hero.aldric_wall"]').click();
    assert((await page.locator('[data-roster-detail]').innerText()).includes('Альдрик Стена'));
    assert.strictEqual(await page.locator('[data-roster-card="hero.aldric_wall"]').getAttribute('aria-pressed'), 'true');
    const savedSelection = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).selectedCharacterId, RUN_KEY);
    assert.strictEqual(savedSelection, 'hero.aldric_wall');

    await page.locator('[data-roster-menu]').click();
    await menu.waitFor({ state: 'visible' });
    assert.strictEqual(await continueButton.isDisabled(), false, 'Continue must activate after creating a run');

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-continue-run]').click();
    await roster.waitFor({ state: 'visible' });
    assert((await page.locator('[data-roster-detail]').innerText()).includes('Альдрик Стена'), 'Continue must restore selected character');

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
    assert.strictEqual(await page.locator('[data-roster-card]').count(), 1);
    assert((await page.locator('[data-roster-card]').innerText()).includes('Мара Цепь'));
    await page.locator('[data-roster-filter="dead"]').click();
    assert.strictEqual(await page.locator('[data-roster-card]').count(), 1);
    assert((await page.locator('[data-roster-card]').innerText()).includes('Немея Перо'));

    const serializedRun = await page.evaluate((key) => localStorage.getItem(key), RUN_KEY);
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await mobile.goto(url, { waitUntil: 'networkidle' });
    await mobile.evaluate(([key, value]) => localStorage.setItem(key, value), [RUN_KEY, serializedRun]);
    await mobile.reload({ waitUntil: 'networkidle' });
    await mobile.locator('[data-continue-run]').click();
    await mobile.locator('[data-roster-screen]:not([hidden])').waitFor();
    assert.strictEqual(await mobile.locator('[data-roster-card]').count(), 6);
    assert.strictEqual(await mobile.locator('[data-roster-travel]').isVisible(), true);
    const mobilePanelStyle = await panelStyle(mobile.locator('[data-roster-detail]'));
    assert.strictEqual(mobilePanelStyle.borderImageSource, 'none');
    assert(parseFloat(mobilePanelStyle.paddingLeft) >= 26, `mobile Roster needs safe left inset: ${mobilePanelStyle.paddingLeft}`);
    const mobileState = await mobile.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    assert(mobileState.scrollHeight > mobileState.clientHeight, 'mobile Roster must scroll vertically');
    assert(mobileState.scrollWidth <= mobileState.clientWidth + 1, `mobile Roster must not overflow horizontally: ${mobileState.scrollWidth}/${mobileState.clientWidth}`);

    assert.deepStrictEqual(errors, [], `desktop Roster page errors:\n${errors.join('\n')}`);
    assert.deepStrictEqual(mobileErrors, [], `mobile Roster page errors:\n${mobileErrors.join('\n')}`);
    console.log('Roster persistence, frameless surfaces and Roster-to-Skirmish Chromium acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
