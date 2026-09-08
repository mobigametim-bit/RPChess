const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun, waitForVisible } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';
const SETTINGS_KEY = 'rpchess.reboot.v1.settings';
const TOLERANCE = 1;

async function clearState(page) {
  await page.goto(url, { waitUntil:'networkidle' });
  await page.evaluate(([runKey, settingsKey]) => {
    localStorage.removeItem(runKey);
    localStorage.removeItem(settingsKey);
  }, [RUN_KEY, SETTINGS_KEY]);
  await page.reload({ waitUntil:'networkidle' });
}

async function assertDocumentFits(page, label) {
  const metrics = await page.evaluate(() => ({
    sw:document.documentElement.scrollWidth,
    cw:document.documentElement.clientWidth,
    sh:document.documentElement.scrollHeight,
    ch:document.documentElement.clientHeight,
    x:window.scrollX,
    y:window.scrollY
  }));
  assert(metrics.sw <= metrics.cw + TOLERANCE, `${label}: horizontal page overflow ${metrics.sw}/${metrics.cw}`);
  assert(metrics.sh <= metrics.ch + TOLERANCE, `${label}: vertical page overflow ${metrics.sh}/${metrics.ch}`);
  assert(Math.abs(metrics.x) <= TOLERANCE && Math.abs(metrics.y) <= TOLERANCE, `${label}: page must remain at viewport origin`);
}

async function assertInsideViewport(locator, label) {
  await locator.waitFor({ state:'visible' });
  const rect = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { left:box.left, top:box.top, right:box.right, bottom:box.bottom, vw:innerWidth, vh:innerHeight };
  });
  assert(rect.left >= -TOLERANCE && rect.top >= -TOLERANCE, `${label}: starts outside viewport`);
  assert(rect.right <= rect.vw + TOLERANCE && rect.bottom <= rect.vh + TOLERANCE, `${label}: escapes viewport`);
}

async function desktopContract(browser) {
  const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
  const errors=[]; page.on('pageerror', (error)=>errors.push(String(error.stack||error)));
  try {
    await clearState(page);
    const menu = await waitForVisible(page, '[data-reboot-foundation]:not([hidden])', 'Desktop main menu');
    assert.strictEqual(await menu.locator('[data-new-game]').count(), 1);
    assert.strictEqual(await menu.locator('[data-continue-run]').isDisabled(), true);
    assert.strictEqual(await menu.locator('[data-settings]').count(), 1);
    assert.strictEqual(await menu.locator('[data-language]').count(), 1);
    await assertDocumentFits(page, 'desktop menu');

    await menu.locator('[data-settings]').click();
    const settings = await waitForVisible(page, '[data-settings-modal]:not([hidden])', 'Settings');
    await assertInsideViewport(settings.locator('.reboot-modal__panel'), 'desktop Settings frame');
    await settings.locator('[data-music-volume]').evaluate((input)=>{ input.value='33'; input.dispatchEvent(new Event('input',{bubbles:true})); });
    await settings.locator('[data-close-modal]').click();

    const navigationCount = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    await menu.locator('[data-language]').click();
    const language = await waitForVisible(page, '[data-language-modal]:not([hidden])', 'Language');
    await assertInsideViewport(language.locator('.reboot-modal__panel'), 'desktop Language frame');
    await language.locator('[data-language-option="en"]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.strictEqual(await menu.locator('[data-new-game]').textContent(), 'New Game');
    assert.strictEqual(await menu.locator('[data-settings]').textContent(), 'Settings');
    assert.strictEqual(await page.evaluate(() => performance.getEntriesByType('navigation').length), navigationCount, 'language switch must not reload');
    assert.strictEqual(await page.evaluate((key)=>localStorage.getItem(key), RUN_KEY), null, 'language switch must not create run state');
    await language.locator('[data-close-modal].reboot-language-back').click();

    await startNewRun(page, { playerName:'Browser Tester' });
    const roster = await waitForVisible(page, '[data-roster-screen]:not([hidden])', 'Roster');
    await assertInsideViewport(roster, 'desktop Roster');
    assert.strictEqual(await page.locator('[data-roster-card]').count(), 6);
    await page.locator('[data-roster-travel]').click();
    await waitForVisible(page, '[data-travel-choice-screen]:not([hidden])', 'Travel Choice');
    assert.strictEqual(await page.locator('[data-travel-choice]').count(), 3);
    await assertDocumentFits(page, 'desktop Travel');
    assert.deepStrictEqual(errors, [], `desktop browser errors:\n${errors.join('\n')}`);
  } finally { await page.close(); }
}

async function landscapePhoneContract(browser) {
  const page = await browser.newPage({ viewport:{ width:844, height:390 } });
  const errors=[]; page.on('pageerror', (error)=>errors.push(String(error.stack||error)));
  try {
    await clearState(page);
    const menu = await waitForVisible(page, '[data-reboot-foundation]:not([hidden])', 'Phone landscape menu');
    await assertInsideViewport(menu, 'phone landscape menu');
    await assertDocumentFits(page, 'phone landscape menu');
    await menu.locator('[data-settings]').click();
    const settings = await waitForVisible(page, '[data-settings-modal]:not([hidden])', 'Phone Settings');
    await assertInsideViewport(settings.locator('.reboot-modal__panel'), 'phone Settings frame');
    await assertDocumentFits(page, 'phone Settings');
    await settings.locator('[data-close-modal]').click();
    await startNewRun(page, { playerName:'Phone Tester' });
    await assertInsideViewport(page.locator('[data-roster-screen]:not([hidden])'), 'phone landscape Roster');
    await assertDocumentFits(page, 'phone landscape Roster');
    assert.deepStrictEqual(errors, [], `phone landscape errors:\n${errors.join('\n')}`);
  } finally { await page.close(); }
}

async function portraitLockContract(browser) {
  const page = await browser.newPage({ viewport:{ width:390, height:844 } });
  const errors=[]; page.on('pageerror', (error)=>errors.push(String(error.stack||error)));
  try {
    await clearState(page);
    const lock = await waitForVisible(page, '[data-orientation-lock]', 'Portrait orientation lock');
    await assertInsideViewport(lock, 'portrait orientation lock');
    const rect = await lock.evaluate((element)=>{ const box=element.getBoundingClientRect(); return { w:box.width,h:box.height,vw:innerWidth,vh:innerHeight }; });
    assert(Math.abs(rect.w-rect.vw)<=TOLERANCE && Math.abs(rect.h-rect.vh)<=TOLERANCE, 'portrait lock must cover the viewport');
    assert((await lock.innerText()).includes('Поверните устройство'));
    await assertDocumentFits(page, 'portrait lock');
    assert.deepStrictEqual(errors, [], `portrait errors:\n${errors.join('\n')}`);
  } finally { await page.close(); }
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    await desktopContract(browser);
    await landscapePhoneContract(browser);
    await portraitLockContract(browser);
    console.log('Reboot Foundation one-screen desktop/landscape/portrait Chromium acceptance: PASS');
  } finally { await browser.close(); }
})().catch((error)=>{ console.error(error.stack||error); process.exitCode=1; });
