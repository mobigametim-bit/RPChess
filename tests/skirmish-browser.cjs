const assert = require('assert');
const { chromium } = require('playwright');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';
const EXPECTED_PERSONALIZED_ART = Object.freeze({
  'king.oathkeeper': 'assets/kings/oathkeeper/piece.png',
  'hero.aldric_wall': 'assets/heroes/aldric_wall/piece_badge.png',
  'hero.mara_chain': 'assets/heroes/mara_chain/piece_badge.png',
  'hero.nemea_quill': 'assets/heroes/nemea_quill/piece_badge.png',
  'hero.brother_orell': 'assets/heroes/brother_orell/piece_badge.png',
  'hero.vael_hammer': 'assets/heroes/vael_hammer/piece_badge.png'
});

async function freshRun(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-new-game]').click();
  await page.locator('[data-roster-screen]:not([hidden])').waitFor();
}

async function enterSkirmishFromTravel(page) {
  await page.locator('[data-roster-travel]').click();
  await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
  const card = page.locator('[data-travel-type="skirmish"]').first();
  assert.strictEqual(await card.count(), 1, 'Travel Choice must offer a Skirmish route');
  const chosen = await card.evaluate((node) => ({ id: node.dataset.travelChoice, stars: Number(node.dataset.travelStars) }));
  await card.click();
  await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
  return chosen;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));

    await freshRun(page);
    assert.strictEqual(
      await page.locator('[data-aftermath-dead]').evaluate((node) => node.closest('section').hidden),
      true,
      'ordinary Skirmish aftermath must not expose a dead-pieces frame'
    );

    const chosenSkirmish = await enterSkirmishFromTravel(page);
    const skirmish = page.locator('[data-skirmish-screen]');
    const routedStars = await page.evaluate(() => globalThis.RPChessSkirmish.encounter.stars);
    assert.strictEqual(routedStars, chosenSkirmish.stars, 'Travel threat must reach Skirmish encounter');

    assert.strictEqual(await page.locator('[data-skirmish-available] [data-skirmish-character]').count(), 6, 'Skirmish must show all starter roster members');
    assert.strictEqual(await page.locator('[data-skirmish-selected] [data-selected-character]').count(), 6, 'all healthy starter pieces should be preselected');
    assert.strictEqual((await page.locator('[data-skirmish-piece-count]').innerText()).trim(), '6 / 16');
    assert.strictEqual((await page.locator('[data-skirmish-point-count]').innerText()).trim(), '13 / 39');
    assert.strictEqual(await page.locator('[data-skirmish-character="king.oathkeeper"]').getAttribute('aria-pressed'), 'true');
    assert.strictEqual(await page.locator('[data-selected-character="king.oathkeeper"]').isDisabled(), true, 'King cannot be removed from selected combat roster');
    assert((await page.locator('[data-skirmish-character="king.oathkeeper"]').innerText()).includes('КОРОЛЬ · ОБЯЗАТЕЛЕН'));

    await page.locator('[data-skirmish-character="hero.aldric_wall"]').click();
    assert.strictEqual((await page.locator('[data-skirmish-piece-count]').innerText()).trim(), '5 / 16');
    assert.strictEqual((await page.locator('[data-skirmish-point-count]').innerText()).trim(), '8 / 39');
    await page.locator('[data-skirmish-character="hero.aldric_wall"]').click();
    assert.strictEqual((await page.locator('[data-skirmish-point-count]').innerText()).trim(), '13 / 39');

    const formationCells = page.locator('[data-skirmish-formation] .skirmish-formation-cell');
    assert.strictEqual(await formationCells.count(), 16, 'auto-placement preview must show exactly two starting ranks');

    await page.locator('[data-skirmish-start]').click();
    const classic = page.locator('[data-classic-screen]');
    await classic.waitFor({ state: 'visible' });
    assert.strictEqual(await skirmish.isHidden(), true, 'starting Skirmish must replace composition scene with chess board');
    assert.strictEqual(await page.locator('[data-chess-board] [data-square]').count(), 64, 'Skirmish must reuse the real 64-square chess board');
    assert.strictEqual(await page.locator('[data-classic-new]').isHidden(), true, 'active Skirmish must hide standalone New Game navigation');
    assert.strictEqual(await page.locator('[data-classic-menu]').isHidden(), true, 'active Skirmish must hide standalone Main Menu navigation');
    const started = await page.evaluate(() => ({
      fen: globalThis.RPChessClassicChess.snapshot().fen,
      config: globalThis.RPChessChessAI.config,
      battleFen: globalThis.RPChessSkirmish.battlePlan.fen,
      personalized: globalThis.RPChessSkirmish.battlePlan.playerFormation.map(({ id, square }) => {
        const image = document.querySelector(`[data-square="${square}"] .classic-piece`);
        return { id, square, src: image?.getAttribute('src') || '', personalizedId: image?.dataset.personalizedId || '' };
      })
    }));
    assert.strictEqual(started.fen, started.battleFen, 'real chess engine must start from Skirmish-generated FEN');
    assert.notStrictEqual(started.fen.split(' ')[0], 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', 'Skirmish start position must be non-standard');
    assert.strictEqual(started.config.mode, 'ai');
    assert.strictEqual(started.config.playerColor, 'w');
    assert.strictEqual(started.personalized.length, 6, 'all selected starter characters must have personalized board identities');
    for (const piece of started.personalized) {
      assert.strictEqual(piece.personalizedId, piece.id, `${piece.id} must keep its personalized identity on the board`);
      assert.strictEqual(piece.src, EXPECTED_PERSONALIZED_ART[piece.id], `${piece.id} must render its approved personalized board art`);
    }

    await page.evaluate(() => globalThis.RPChessSkirmish.finishBattle({ over: true, type: 'checkmate', winner: 'b', checked: true }));
    const runEnd = page.locator('[data-skirmish-run-end]');
    await runEnd.waitFor({ state: 'visible' });
    assert.strictEqual(await page.locator('[data-skirmish-aftermath]').isHidden(), true, 'King death must not use the ordinary Skirmish aftermath screen');
    assert.strictEqual((await page.locator('[data-run-end-title]').innerText()).trim(), 'КОРОЛЬ ПОГИБ');
    assert((await page.locator('[data-run-end-text]').innerText()).includes('Хранитель Клятвы'), 'run-end summary must identify the fallen personalized King');
    assert.strictEqual((await page.locator('[data-run-end-metric="skirmishes"]').innerText()).trim(), '1', 'run-end summary must count the completed Skirmish');
    const ended = await page.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      return { ended: run.ended, reason: run.endReason, king: run.roster.find((character) => character.isRunKing).status, count: run.skirmishCount };
    }, RUN_KEY);
    assert.deepStrictEqual(ended, { ended: true, reason: 'king_dead', king: 'dead', count: 1 });
    assert.strictEqual((await page.locator('[data-run-end-continue]').innerText()).trim(), 'Главное меню');
    await page.locator('[data-run-end-continue]').click();
    await page.locator('[data-reboot-foundation]').waitFor({ state: 'visible' });
    assert.strictEqual(await page.locator('[data-continue-run]').isDisabled(), true, 'ended run must not be continuable');
    const navigationUnlocked = await page.evaluate(() => ({
      newHidden: document.querySelector('[data-classic-new]').hidden,
      menuHidden: document.querySelector('[data-classic-menu]').hidden,
      newAriaHidden: document.querySelector('[data-classic-new]').getAttribute('aria-hidden'),
      menuAriaHidden: document.querySelector('[data-classic-menu]').getAttribute('aria-hidden')
    }));
    assert.deepStrictEqual(navigationUnlocked, { newHidden: false, menuHidden: false, newAriaHidden: 'false', menuAriaHidden: 'false' }, 'standalone chess navigation must be unlocked after Skirmish ends even while the chess scene itself is not visible');

    const woundedPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const woundedErrors = [];
    woundedPage.on('pageerror', (error) => woundedErrors.push(String(error.stack || error)));
    await freshRun(woundedPage);
    await woundedPage.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      run.roster.find((character) => character.id === 'hero.mara_chain').status = 'wounded';
      run.roster.find((character) => character.id === 'hero.nemea_quill').status = 'dead';
      localStorage.setItem(key, JSON.stringify(run));
    }, RUN_KEY);
    await woundedPage.reload({ waitUntil: 'networkidle' });
    await woundedPage.locator('[data-continue-run]').click();
    await enterSkirmishFromTravel(woundedPage);
    assert.strictEqual(await woundedPage.locator('[data-skirmish-character="hero.mara_chain"]').isDisabled(), true, 'wounded piece must stay visible but disabled');
    assert.strictEqual(await woundedPage.locator('[data-skirmish-character="hero.nemea_quill"]').isDisabled(), true, 'dead piece must stay visible but disabled');
    assert.strictEqual((await woundedPage.locator('[data-skirmish-piece-count]').innerText()).trim(), '4 / 16', 'default selection must exclude unavailable pieces');

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await freshRun(mobile);
    await enterSkirmishFromTravel(mobile);
    assert.strictEqual(await mobile.locator('[data-skirmish-start]').isVisible(), true, 'mobile sticky action must expose Start Skirmish');
    const mobileState = await mobile.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      actionPosition: getComputedStyle(document.querySelector('.skirmish-actionbar')).position
    }));
    assert(mobileState.scrollHeight > mobileState.clientHeight, 'mobile Skirmish must scroll vertically');
    assert(mobileState.scrollWidth <= mobileState.clientWidth + 1, `mobile Skirmish must not overflow horizontally: ${mobileState.scrollWidth}/${mobileState.clientWidth}`);
    assert.strictEqual(mobileState.actionPosition, 'sticky');

    assert.deepStrictEqual(errors, [], `Skirmish desktop page errors:\n${errors.join('\n')}`);
    assert.deepStrictEqual(woundedErrors, [], `Skirmish wounded-state page errors:\n${woundedErrors.join('\n')}`);
    assert.deepStrictEqual(mobileErrors, [], `Skirmish mobile page errors:\n${mobileErrors.join('\n')}`);
    console.log('Travel-routed Skirmish composition, personalized board art, separate King-death run summary and mobile Chromium acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
