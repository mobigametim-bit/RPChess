const assert = require('assert');
const { chromium } = require('playwright');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const HINTS = ["identity","roster","travel","artifact","skirmishChess","battleChess","combatAftermath","event","settlement","puzzle","caravanChess","caravanReward","starvation","runEnd","chronicle","arenaCatalog","arenaFoe","arenaArtifact","arenaChess","arenaResult"];
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
      titleLeft:root.querySelector('[data-tutorial-title]')?.getBoundingClientRect().left,
      buttonLeft:dismiss?.getBoundingClientRect().left,
      buttonRight:dismiss?.getBoundingClientRect().right,
      buttonWidth:dismiss?.getBoundingClientRect().width,
      cardRight:rect.right,
      centerOffset:Math.abs((rect.left+rect.right)/2-innerWidth/2),
      cardLayer:Number(getComputedStyle(card).zIndex),
      portraitLayer:Number(getComputedStyle(root.querySelector('.rpchess-onboarding__portrait')).zIndex),
      role:card.getAttribute('role'),
      modal:card.getAttribute('aria-modal'),
      title:root.querySelector('[data-tutorial-title]')?.textContent?.trim() || '',
      body:root.querySelector('[data-tutorial-body]')?.textContent?.trim() || '',
      dismiss:dismiss?.textContent?.trim() || '',
      portrait:{
        loaded:Boolean(root.querySelector('.rpchess-onboarding__portrait')?.complete && root.querySelector('.rpchess-onboarding__portrait')?.naturalWidth),
        left:root.querySelector('.rpchess-onboarding__portrait')?.getBoundingClientRect().left,
        top:root.querySelector('.rpchess-onboarding__portrait')?.getBoundingClientRect().top,
        right:root.querySelector('.rpchess-onboarding__portrait')?.getBoundingClientRect().right,
        bottom:root.querySelector('.rpchess-onboarding__portrait')?.getBoundingClientRect().bottom
      }
    };
  });
  assert.strictEqual(geometry.hint, expectedHint, `${label}: wrong hint displayed`);
  assert(geometry.left >= -1 && geometry.top >= -1 && geometry.right <= geometry.vw + 1 && geometry.bottom <= geometry.vh + 1, `${label}: onboarding card escapes viewport`);
  assert(geometry.scrollHeight <= geometry.clientHeight + 1, `${label}: onboarding card must not require internal scrolling`);
  assert.strictEqual(geometry.overflowY, 'hidden', `${label}: onboarding card overflow must stay hidden`);
  assert.strictEqual(geometry.role, 'dialog', `${label}: onboarding must expose dialog role`);
  assert.strictEqual(geometry.modal, 'true', `${label}: onboarding must be modal`);
  assert(geometry.title.length > 0 && geometry.body.length > 0 && geometry.dismiss.length > 0, `${label}: localized onboarding copy missing`);
  assert(geometry.buttonWidth <= 210 && geometry.buttonWidth >= 100,
    `${label}: "Понятно" must be a compact menu-style button, never stretched across the panel`);
  assert(geometry.buttonRight <= geometry.cardRight + 1 && geometry.buttonLeft >= geometry.cardRight - 230,
    `${label}: dismissal button must stay aligned to the right, as in approved HTML preview`);
  assert(geometry.centerOffset <= 2,
    `${label}: dialog panel must be horizontally centered instead of leaving a portrait column`);
  assert(geometry.portrait.top < geometry.top - 24,
    `${label}: jester must rise above the dialog, not sit beside it`);
  assert(geometry.portrait.bottom > geometry.top + 10,
    `${label}: jester must overlap and peek out from behind the top of the panel`);
  assert(geometry.portrait.left >= geometry.left - 1 && geometry.portrait.right <= geometry.right + 1,
    `${label}: jester must be above/behind the dialog, not in a left-side column`);
  assert(geometry.portraitLayer < geometry.cardLayer,
    `${label}: the dialog must be in front of the jester to partially occlude it`);
  assert(geometry.portrait.loaded, `${label}: compressed jester WebP must load`);
  assert(geometry.portrait.left >= -1 && geometry.portrait.top >= -1 &&
    geometry.portrait.right <= geometry.vw + 1 && geometry.portrait.bottom <= geometry.vh + 1,
    `${label}: jester portrait must remain fully inside the viewport`);
  await page.waitForFunction(() => document.activeElement?.matches?.('[data-tutorial-dismiss]'));
}

async function audit(browser, { width, height, language, mobile = false }) {
  const contextOptions = { viewport:{ width, height }, isMobile:mobile, hasTouch:mobile };
  if (mobile) contextOptions.userAgent = 'Mozilla/5.0 (Linux; Android 14; VK Mini Apps) AppleWebKit/537.36 Chrome/152 Mobile Safari/537.36';
  const context = await browser.newContext(contextOptions);
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
    await page.evaluate(async () => { await globalThis.RPChessOnboardingReady; return true; });

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
    assert.deepStrictEqual(Object.keys(state.dismissed).sort(), [...HINTS].sort(), `${label}: dismissed state must contain exactly the twenty approved hints`);
    const repeated = await page.evaluate(async () => {
      const onboarding = await globalThis.RPChessOnboardingReady;
      return onboarding.showHint('travel');
    });
    assert.strictEqual(repeated, false, `${label}: dismissed hints must never repeat`);

    // Exercise an actual scene owner, not just direct showHint(): Arena needs no journey.
    // Reset only its dismissed bit so the real catalog event must show it.
    await page.evaluate((key) => {
      const state=JSON.parse(localStorage.getItem(key));
      delete state.dismissed.arenaCatalog;
      localStorage.setItem(key,JSON.stringify(state));
    }, TUTORIAL_KEY);
    await page.locator('[data-arena-open]').click();
    await assertOverlay(page, `${label} actual Arena catalog`, 'arenaCatalog');
    await page.locator('[data-tutorial-dismiss]').click();
    await page.locator('[data-tutorial-overlay]').waitFor({state:'hidden'});
    await page.locator('[data-arena-back]').click();
    await page.locator('[data-arena-open]').click();
    await page.waitForTimeout(250);
    assert.strictEqual(await page.locator('[data-tutorial-overlay]:not([hidden])').count(),0,
      `${label}: real Arena catalog tutorial must not repeat`);

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
