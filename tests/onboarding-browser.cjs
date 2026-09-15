const assert = require('assert');
const { chromium } = require('playwright');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const HINTS = ['identity','roster','travel','skirmishPrep','skirmishChess','battlePrep','battleChess','event','settlement','puzzle'];
const TUTORIAL_KEY = 'rpchess.reboot.v1.tutorial';

async function setLanguage(page, language) {
  await page.waitForFunction(() => Boolean(globalThis.RPChessI18n?.setLanguage));
  await page.evaluate((next) => globalThis.RPChessI18n.setLanguage(next), language);
  await page.waitForFunction((next) => document.documentElement.lang === next, language);
}

async function assertOverlay(page, label, expectedHint) {
  const overlay = page.locator('[data-tutorial-overlay]:not([hidden])');
  await overlay.waitFor({ state:'visible' });
  const geometry = await overlay.evaluate((root) => {
    const card = root.querySelector('.rpchess-onboarding__card');
    const dismiss = root.querySelector('[data-tutorial-dismiss]');
    const rect = card.getBoundingClientRect();
    return {
      hint:root.dataset.tutorialHint,
      left:rect.left,
      top:rect.top,
      right:rect.right,
      bottom:rect.bottom,
      width:rect.width,
      height:rect.height,
      vw:innerWidth,
      vh:innerHeight,
      scrollHeight:card.scrollHeight,
      clientHeight:card.clientHeight,
      overflowY:getComputedStyle(card).overflowY,
      role:card.getAttribute('role'),
      modal:card.getAttribute('aria-modal'),
      title:root.querySelector('[data-tutorial-title]')?.textContent?.trim() || '',
      body:root.querySelector('[data-tutorial-body]')?.textContent?.trim() || '',
      dismiss: dismiss?.textContent?.trim() || '',
      focused:document.activeElement === dismiss
    };
  });
  assert.strictEqual(geometry.hint, expectedHint, `${label}: wrong hint displayed`);
  assert(geometry.left >= -1 && geometry.top >= -1 && geometry.right <= geometry.vw + 1 && geometry.bottom <= geometry.vh + 1, `${label}: onboarding card escapes viewport`);
  assert(geometry.scrollHeight <= geometry.clientHeight + 1, `${label}: onboarding card must not require internal scrolling`);
  assert.strictEqual(geometry.overflowY, 'hidden', `${label}: onboarding card overflow must stay hidden`);
  assert.strictEqual(geometry.role, 'dialog', `${label}: onboarding must expose dialog role`);
  assert.strictEqual(geometry.modal, 'true', `${label}: onboarding must be modal`);
  assert(geometry.title.length > 0 && geometry.body.length > 0 && geometry.dismiss.length > 0, `${label}: localized onboarding copy missing`);
  await page.waitForFunction(() => document.activeElement?.matches?.('[data-tutorial-dismiss]'));
}

async function audit(browser, { width, height, language, mobile = false }) {
  const context = await browser.newContext({
    viewport:{ width, height },
    isMobile:mobile,
    hasTouch:mobile,
    userAgent:mobile ? 'Mozilla/5.0 (Linux; Android 14; VK Mini Apps) AppleWebKit/537.36 Chrome/152 Mobile Safari/537.36' : undefined
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error)));
  const label = `${mobile ? 'VK Mobile' : 'Web'} ${width}x${height} ${language.toUpperCase()}`;
  try {
    await page.goto(url, { waitUntil:'networkidle' });
    await page.evaluate((key) => localStorage.removeItem(key), TUTORIAL_KEY);
    await page.reload({ waitUntil:'networkidle' });
    await setLanguage(page, language);
    await page.waitForFunction(() => Boolean(globalThis.RPChessOnboardingReady));
    await page.evaluate(() => globalThis.RPChessOnboardingReady);

    await page.locator('[data-new-game]').first().click();
    await assertOverlay(page, `${label} identity`, 'identity');
    const firstDismiss = await page.locator('[data-tutorial-dismiss]').textContent();
    assert.strictEqual(firstDismiss.trim(), language === 'en' ? 'Got it' : 'Понятно', `${label}: wrong dismissal localization`);
    await page.locator('[data-tutorial-dismiss]').click();
    await page.locator('[data-player-identity-modal]:not([hidden])').waitFor({ state:'visible' });
    await page.locator('[data-player-identity-close]').click();

    for (const hint of HINTS.slice(1)) {
      const shown = await page.evaluate(async (key) => {
        const onboarding = await globalThis.RPChessOnboardingReady;
        return onboarding.showHint(key);
      }, hint);
      assert.strictEqual(shown, true, `${label}: ${hint} should show on first visit`);
      await assertOverlay(page, `${label} ${hint}`, hint);
      await page.locator('[data-tutorial-dismiss]').click();
      await page.locator('[data-tutorial-overlay]').waitFor({ state:'hidden' });
    }

    const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), TUTORIAL_KEY);
    assert(state?.activated, `${label}: tutorial must remain activated`);
    assert.deepStrictEqual(Object.keys(state.dismissed).sort(), [...HINTS].sort(), `${label}: dismissed state must contain exactly the ten approved hints`);
    const repeated = await page.evaluate(async () => {
      const onboarding = await globalThis.RPChessOnboardingReady;
      return onboarding.showHint('travel');
    });
    assert.strictEqual(repeated, false, `${label}: dismissed hints must never repeat`);
    assert.deepStrictEqual(errors, [], `${label} browser errors:\n${errors.join('\n')}`);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless:true });
  try {
    for (const language of ['ru','en']) {
      await audit(browser, { width:1366, height:768, language });
      await audit(browser, { width:844, height:390, language });
      await audit(browser, { width:844, height:390, language, mobile:true });
    }
    console.log('Onboarding first-run, RU/EN, desktop, compact and VK Mobile landscape viewport contract: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
