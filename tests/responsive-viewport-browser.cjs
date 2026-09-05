const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';
const MATRIX = [
  [1920, 1080], [1366, 768], [1280, 720], [1024, 768],
  [768, 1024], [390, 844], [844, 390]
];

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  assert(metrics.scrollWidth <= metrics.clientWidth + 1, `${label}: horizontal overflow ${metrics.scrollWidth}/${metrics.clientWidth}`);
}

async function assertReachable(page, selector, label) {
  const target = page.locator(selector).first();
  await target.waitFor({ state: 'visible' });
  await target.evaluate((element) => element.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  const geometry = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, vw: innerWidth, vh: innerHeight };
  });
  assert(geometry.width > 0 && geometry.height > 0, `${label}: target has no rendered area`);
  assert(geometry.left >= -1 && geometry.right <= geometry.vw + 1, `${label}: target is outside viewport horizontally`);
  assert(geometry.top < geometry.vh && geometry.bottom > 0, `${label}: target is not reachable after scrolling`);
}

async function freshMenu(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-reboot-foundation]:not([hidden])').waitFor();
}

async function auditPortraitLock(browser, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error)));
  const label = `${width}x${height}`;
  try {
    await freshMenu(page);
    const lock = page.locator('[data-orientation-lock]');
    await lock.waitFor({ state: 'visible' });
    const geometry = await lock.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, vw: innerWidth, vh: innerHeight };
    });
    assert(Math.abs(geometry.left) <= 1 && Math.abs(geometry.top) <= 1, `${label}: portrait lock must start at viewport origin`);
    assert(Math.abs(geometry.right - geometry.vw) <= 1 && Math.abs(geometry.bottom - geometry.vh) <= 1, `${label}: portrait lock must cover viewport`);
    const copy = await lock.innerText();
    assert(copy.includes('Поверните устройство'), `${label}: portrait lock copy missing`);
    assert.strictEqual(await page.locator('.landscape-orientation-lock__device').count(), 1, `${label}: device frame missing`);
    assert.deepStrictEqual(errors, [], `${label} browser errors:\n${errors.join('\n')}`);
  } finally {
    await page.close();
  }
}

async function auditViewport(browser, width, height) {
  if (height > width && width <= 1180) return auditPortraitLock(browser, width, height);
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error)));
  const label = `${width}x${height}`;
  try {
    await freshMenu(page);
    await assertNoHorizontalOverflow(page, `${label} menu`);
    for (const selector of ['[data-new-game]', '[data-continue-run]', '[data-settings]']) await assertReachable(page, selector, `${label} ${selector}`);

    await page.locator('[data-settings]').first().click();
    await assertReachable(page, '[data-settings-modal]:not([hidden]) [data-close-modal]', `${label} Settings close`);
    await assertNoHorizontalOverflow(page, `${label} Settings`);
    await page.locator('[data-settings-modal] [data-close-modal]').click();

    await startNewRun(page, { playerName: `Viewport ${width}` });
    await assertNoHorizontalOverflow(page, `${label} Roster`);
    await assertReachable(page, '[data-roster-travel]', `${label} Roster journey CTA`);
    await page.locator('[data-roster-menu]').click();
    await assertReachable(page, '[data-chronicle-panel]', `${label} Chronicle`);
    await assertNoHorizontalOverflow(page, `${label} Chronicle`);
    await page.locator('[data-continue-run]').click();
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    await assertNoHorizontalOverflow(page, `${label} Travel`);
    await assertReachable(page, '[data-travel-choice]', `${label} Travel route`);
    if (width <= 980 && height <= 520) {
      const cards = await page.locator('[data-travel-choice]').evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
      }));
      assert.strictEqual(cards.length, 3, `${label}: Travel must render exactly three choices`);
      assert(cards.every((card) => card.top >= -1 && card.bottom <= height + 1), `${label}: all three Travel choices must be visible without page scroll`);
      assert(cards[1].top >= cards[0].bottom - 2 && cards[2].top >= cards[1].bottom - 2, `${label}: mobile Travel choices must be vertically stacked`);
    }
    assert.deepStrictEqual(errors, [], `${label} browser errors:\n${errors.join('\n')}`);
  } finally {
    await page.close();
  }
}

async function auditPrepAndCombat(browser, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error)));
  const label = `${width}x${height}`;
  try {
    await freshMenu(page);
    await startNewRun(page, { playerName: `Breakpoint ${width}` });
    await page.evaluate(() => dispatchEvent(new CustomEvent('rpchess:skirmish-open')));
    await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
    await assertNoHorizontalOverflow(page, `${label} Skirmish prep`);
    const skirmishColumns = await page.locator('.skirmish-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
    assert.strictEqual(skirmishColumns, 2, `${label}: Skirmish prep must keep two selectable card columns`);
    await assertReachable(page, '[data-skirmish-start]', `${label} Skirmish start`);
    await page.locator('[data-skirmish-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    const board = await page.locator('[data-chess-board]').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const square = element.querySelector('[data-square]')?.getBoundingClientRect();
      const visibleCoordinates = [...element.querySelectorAll('.classic-coordinate')].filter((node) => getComputedStyle(node).display !== 'none').length;
      return {
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        width: rect.width, height: rect.height, squareWidth: square?.width || 0, squareHeight: square?.height || 0,
        visibleCoordinates, vw: innerWidth, vh: innerHeight
      };
    });
    assert(Math.abs(board.width - board.height) <= 2, `${label}: combat board lost square aspect`);
    assert(Math.abs(board.width - board.vh) <= 2, `${label}: combat board must use full viewport height (${board.width}/${board.vh})`);
    assert(Math.abs(board.top) <= 1 && Math.abs(board.bottom - board.vh) <= 1, `${label}: combat board must touch top and bottom viewport edges`);
    assert(Math.abs(board.right - board.vw) <= 1, `${label}: combat board must touch right viewport edge`);
    assert(Math.abs(board.squareWidth - board.squareHeight) <= 1, `${label}: board cells lost square aspect`);
    assert.strictEqual(board.visibleCoordinates, 0, `${label}: board coordinate labels must be hidden`);
    await page.evaluate(() => globalThis.RPChessSkirmish.finishBattle({ over: true, type: 'stalemate', winner: null }));
    await page.locator('[data-skirmish-aftermath]:not([hidden])').waitFor();
    await assertNoHorizontalOverflow(page, `${label} Skirmish aftermath`);
    await assertReachable(page, '[data-aftermath-continue]', `${label} Skirmish aftermath CTA`);

    await page.evaluate(() => dispatchEvent(new CustomEvent('rpchess:battle-open')));
    await page.locator('[data-battle-screen]:not([hidden])').waitFor();
    await page.waitForFunction(() => document.body.classList.contains('battle-prep-compact-active'));
    await assertNoHorizontalOverflow(page, `${label} Battle prep`);
    const battleColumns = await page.locator('.battle-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
    const expectedBattleColumns = height <= 520 ? 2 : 3;
    assert.strictEqual(battleColumns, expectedBattleColumns, `${label}: Battle prep card columns must match approved landscape layout`);
    await assertReachable(page, '[data-battle-start]', `${label} Battle start`);
    assert.deepStrictEqual(errors, [], `${label} browser errors:\n${errors.join('\n')}`);
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of MATRIX) await auditViewport(browser, width, height);
    for (const [width, height] of [[1180, 820], [1024, 768], [932, 430]]) await auditPrepAndCombat(browser, width, height);
    console.log(`Responsive viewport browser: PASS — landscape matrix, portrait lock, stacked mobile Travel, edge-to-edge board and prep/aftermath contracts`);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
