const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';

async function fresh(page, playerName) {
  await page.goto(url, { waitUntil:'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil:'networkidle' });
  await startNewRun(page, { playerName });
  await page.evaluate((key) => {
    const run = JSON.parse(localStorage.getItem(key));
    run.id = 'settlement-1';
    run.currentTravelChoices = null;
    run.activeTravelChoice = null;
    run.currentSettlement = null;
    localStorage.setItem(key, JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, RUN_KEY);
}

async function enter(page) {
  await page.locator('[data-roster-travel]').click();
  await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
  const card = page.locator('[data-travel-type="settlement"]').first();
  assert.strictEqual(await card.count(), 1, 'deterministic Settlement route must exist');
  await card.click();
  await page.locator('[data-settlement-screen]:not([hidden])').waitFor();
  await page.locator('.settlement-market-row__product').waitFor({ state:'visible' });
}

async function readMarketLayout(page) {
  return page.evaluate(() => {
    const rect = (node) => {
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { left:box.left, right:box.right, top:box.top, bottom:box.bottom, width:box.width, height:box.height };
    };
    const screen = document.querySelector('[data-settlement-screen]');
    const services = [...document.querySelectorAll('.settlement-service')];
    const market = document.querySelector('[aria-labelledby="settlement-supplies-title"]');
    const card = market?.querySelector('[data-settlement-supply-card]');
    const product = card?.querySelector('.settlement-market-row__product');
    const button = card?.querySelector('[data-settlement-buy-supply]');
    const marketIcon = market?.querySelector('.settlement-service__icon');
    const nestedMarketImage = marketIcon?.querySelector(':scope > img');
    const itemIcon = product?.querySelector('.settlement-market-row__item-icon');
    const goldIcon = product?.querySelector('.settlement-market-row__gold-icon');
    const separator = product?.querySelector('.settlement-market-row__separator');
    const stock = product?.querySelector('[data-settlement-supply-stock]');
    const productStyle = product ? getComputedStyle(product) : null;
    const marketStyle = market ? getComputedStyle(market) : null;
    const marketIconStyle = marketIcon ? getComputedStyle(marketIcon) : null;
    const childRects = product ? [...product.children].map(rect) : [];
    return {
      vw:innerWidth,
      vh:innerHeight,
      documentWidth:document.documentElement.scrollWidth,
      documentHeight:document.documentElement.scrollHeight,
      bodyHeight:document.body.scrollHeight,
      screen:rect(screen),
      services:services.map(rect),
      market:rect(market),
      card:rect(card),
      product:rect(product),
      button:rect(button),
      childRects,
      productScrollWidth:product?.scrollWidth || 0,
      productClientWidth:product?.clientWidth || 0,
      productOverflowX:productStyle?.overflowX || '',
      marketScrollHeight:market?.scrollHeight || 0,
      marketClientHeight:market?.clientHeight || 0,
      marketOverflowY:marketStyle?.overflowY || '',
      marketBackground:marketIconStyle?.backgroundImage || '',
      nestedMarketImageDisplay:nestedMarketImage ? getComputedStyle(nestedMarketImage).display : null,
      itemSrc:itemIcon?.getAttribute('src') || '',
      itemWidth:itemIcon?.getBoundingClientRect().width || 0,
      goldWidth:goldIcon?.getBoundingClientRect().width || 0,
      stockFont:stock ? parseFloat(getComputedStyle(stock).fontSize) : 0,
      separatorFont:separator ? parseFloat(getComputedStyle(separator).fontSize) : 0,
      buttonFont:button ? parseFloat(getComputedStyle(button).fontSize) : 0,
      separatorText:separator?.textContent?.trim() || '',
      buttonText:button?.textContent?.trim() || ''
    };
  });
}

function inside(inner, outer, tolerance = 1) {
  return Boolean(inner && outer
    && inner.left >= outer.left - tolerance
    && inner.right <= outer.right + tolerance
    && inner.top >= outer.top - tolerance
    && inner.bottom <= outer.bottom + tolerance);
}

function assertMarketLayout(layout, label, language) {
  const viewport = { left:0, top:0, right:layout.vw, bottom:layout.vh };
  assert(inside(layout.screen, viewport), `${label}: Settlement screen must fit in one viewport`);
  assert(layout.services.length === 3 && layout.services.every((box) => inside(box, viewport)), `${label}: all Settlement service frames must remain inside the viewport`);
  assert(inside(layout.market, viewport), `${label}: Market frame must remain inside the viewport`);
  assert(inside(layout.card, layout.market), `${label}: purchase card must remain inside the Market frame`);
  assert(inside(layout.product, layout.card), `${label}: product rail must remain inside its purchase card`);
  assert(inside(layout.button, layout.card), `${label}: Buy button must remain inside its purchase card`);
  assert(layout.documentWidth <= layout.vw + 1, `${label}: Settlement must not create page-level horizontal scrolling`);
  assert(layout.documentHeight <= layout.vh + 1 && layout.bodyHeight <= layout.vh + 1, `${label}: Settlement must remain a one-screen layout without page scrolling`);

  const productNeedsScroll = layout.productScrollWidth > layout.productClientWidth + 1;
  if (productNeedsScroll) {
    assert(['auto','scroll'].includes(layout.productOverflowX), `${label}: constrained Market product rail must use internal horizontal scrolling`);
  } else {
    assert(layout.childRects.every((box) => inside(box, layout.product)), `${label}: Market product elements must remain inside the product rail when scrolling is unnecessary`);
  }
  if (layout.marketScrollHeight > layout.marketClientHeight + 1) {
    assert(['auto','scroll'].includes(layout.marketOverflowY), `${label}: vertically constrained Market frame must use internal scrolling`);
  }

  assert(layout.marketBackground.includes('node_shop.png'), `${label}: Market service emblem must use node_shop.png`);
  if (layout.nestedMarketImageDisplay !== null) assert.strictEqual(layout.nestedMarketImageDisplay, 'none', `${label}: duplicate nested Market icon must be hidden`);
  assert(layout.itemSrc.endsWith('generated_assets/reward_supplies.png'), `${label}: Market purchase row must use reward_supplies.png`);

  const expected = layout.vw <= 980 && layout.vh <= 520
    ? { icon:35, stock:19, separator:15, button:15 }
    : layout.vw <= 1180
      ? { icon:41, stock:23, separator:19, button:17 }
      : { icon:51, stock:31, separator:25, button:29 };
  assert(layout.itemWidth >= expected.icon && layout.goldWidth >= expected.icon, `${label}: purchase-row icons must keep the accepted enlarged size`);
  assert(layout.stockFont >= expected.stock && layout.separatorFont >= expected.separator && layout.buttonFont >= expected.button, `${label}: purchase-row typography must keep the accepted enlarged size`);
  assert.strictEqual(layout.separatorText, language === 'en' ? 'for' : 'за', `${label}: Market separator localization mismatch`);
  assert.strictEqual(layout.buttonText, language === 'en' ? 'Buy' : 'Купить', `${label}: Market Buy localization mismatch`);
}

async function auditSettlement(browser, width, height, { gameplay = false } = {}) {
  const page = await browser.newPage({ viewport:{ width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error)));
  const label = `${width}x${height}`;
  try {
    await fresh(page, `Settlement ${width}`);
    await enter(page);
    let run = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(run.supplies, 9);
    assert.strictEqual(run.currentSettlement.offers.length, 3);
    assert.strictEqual(run.currentSettlement.supplyStock, 4);
    assert.strictEqual(await page.locator('[data-settlement-roster],[data-settlement-settings]').count(), 0, `${label}: obsolete Settlement shortcuts must remain absent`);
    assert.deepStrictEqual((await page.locator('.settlement-service h2').allInnerTexts()).map((text) => text.trim()), ['Знахарка','Таверна','Рынок']);

    assertMarketLayout(await readMarketLayout(page), `${label} RU`, 'ru');
    await page.evaluate(() => globalThis.RPChessI18n.setLanguage('en'));
    await page.waitForFunction(() => document.querySelector('.settlement-market-row__separator')?.textContent?.trim() === 'for');
    assertMarketLayout(await readMarketLayout(page), `${label} EN`, 'en');

    if (gameplay) {
      await page.evaluate((key) => {
        const current = JSON.parse(localStorage.getItem(key));
        current.gold = 500;
        current.roster.find((character) => character.id === 'hero.mara_chain').status = 'wounded';
        localStorage.setItem(key, JSON.stringify(current));
        dispatchEvent(new CustomEvent('rpchess:run-updated'));
      }, RUN_KEY);
      await page.locator('[data-settlement-heal="hero.mara_chain"]').click();
      run = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
      assert.strictEqual(run.gold, 490);
      assert.strictEqual(run.roster.find((character) => character.id === 'hero.mara_chain').status, 'healthy');
      await page.locator('[data-settlement-buy-supply]').click();
      run = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
      assert.strictEqual(run.supplies, 10);
      const before = run.supplies;
      await page.locator('[data-settlement-continue]').click();
      await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
      run = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
      assert.strictEqual(run.supplies, before);
      assert.strictEqual(run.currentSettlement, null);
      assert.strictEqual(run.activeTravelChoice, null);
    }
    assert.deepStrictEqual(errors, [], `${label} browser errors:\n${errors.join('\n')}`);
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless:true });
  try {
    await auditSettlement(browser, 1920, 1080, { gameplay:true });
    await auditSettlement(browser, 1024, 768);
    await auditSettlement(browser, 844, 390);
    console.log('Settlement Market: desktop/tablet/mobile one-viewport containment, internal-scroll fallback, dedicated Supplies art, RU/EN localization and gameplay acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
