const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';

function route(id, { playerColor = 'w', stars = 6, race = 'orcs' } = {}) {
  const enemyRoleRaces = { pawn: race, knight: race, bishop: race, rook: race, queen: race, king: race };
  return {
    id,
    step: 1,
    type: 'skirmish',
    label: 'СТЫЧКА',
    stars,
    threatLabel: 'ОПАСНАЯ',
    flavor: 'Разведчики заметили впереди небольшой вражеский отряд.',
    mechanicalHint: 'Нестандартный состав противника.',
    seed: `${id}-seed`,
    difficultyModel: 'power-v1',
    playerColor,
    enemyColor: playerColor === 'w' ? 'b' : 'w',
    enemyRaceTag: race,
    enemyRoleRaces,
    sideNarrative: playerColor === 'b'
      ? 'Враг уже занял поле и начинает первым. Ваш отряд принимает бой, удерживая оборону.'
      : 'Ваш отряд перехватывает инициативу и первым выходит на поле.'
  };
}

async function fresh(page, { woundedKing = false, playerColor = 'w', stars = 6, race = 'orcs', runId = null } = {}) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await startNewRun(page);
  const routes = [
    route('manual.skirmish.1', { playerColor, stars, race }),
    route('manual.skirmish.2', { playerColor, stars, race }),
    route('manual.skirmish.3', { playerColor, stars, race })
  ];
  await page.evaluate(({ key, woundedKing, routes, runId }) => {
    const run = JSON.parse(localStorage.getItem(key));
    run.id = runId || `skirmish-browser-${routes[0].playerColor}`;
    run.currentTravelChoices = routes;
    run.activeTravelChoice = null;
    if (woundedKing) run.roster.find((character) => character.isRunKing).status = 'wounded';
    localStorage.setItem(key, JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, { key: RUN_KEY, woundedKing, routes, runId });
}

async function enter(page) {
  await page.locator('[data-roster-travel]').click();
  await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
  const card = page.locator('[data-travel-type="skirmish"]').first();
  assert.strictEqual(await card.count(), 1);
  await card.click();
  await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
}

async function assertResponsiveStars(page, selector, cardSelector) {
  const layout = await page.locator(selector).evaluate((el, cardSelector) => {
    const card = el.closest(cardSelector);
    const range = document.createRange();
    range.selectNodeContents(el);
    const bounds = card.getBoundingClientRect();
    const rects = [...range.getClientRects()].map((rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }));
    return {
      text: (el.textContent || '').replace(/\u200B/g, ''),
      hasBreak: (el.textContent || '').includes('\u200B'),
      rects,
      bounds: { left: bounds.left, right: bounds.right }
    };
  }, cardSelector);
  assert.strictEqual((layout.text.match(/★/g) || []).length, 12);
  assert.strictEqual(layout.hasBreak, true);
  assert(layout.rects.length >= 1 && layout.rects.length <= 2, `12-star label must occupy one or two lines, got ${layout.rects.length}`);
  for (const rect of layout.rects) {
    assert(rect.left >= layout.bounds.left - 1);
    assert(rect.right <= layout.bounds.right + 1);
  }
}

async function assertCompactDesktopStars(page) {
  await page.waitForTimeout(30);
  const stars = await page.locator('[data-skirmish-title]').evaluate((el) => el.dataset.compactStars || '');
  assert.strictEqual((stars.replace(/\u200B/g, '').match(/★/g) || []).length, 12, `compact Skirmish title must carry all 12 stars, got ${stars}`);
  assert.strictEqual(await page.locator('.skirmish-threat-card').isVisible(), false, 'desktop compact prep must not retain the old threat card');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));

    await fresh(page, { playerColor: 'w', stars: 12, race: 'orcs', runId: 'skirmish-event-1' });
    await enter(page);
    assert.strictEqual(await page.locator('[data-skirmish-character]').count(), 6);
    assert.strictEqual((await page.locator('[data-skirmish-piece-count]').innerText()).trim(), '6 / 16');
    await assertCompactDesktopStars(page);
    await page.locator('[data-skirmish-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    const plan = await page.evaluate(() => globalThis.RPChessSkirmish.battlePlan);
    assert.strictEqual(plan.playerColor, 'w');
    assert.strictEqual(plan.encounter.stars, 12);
    assert(plan.playerFormation.filter((piece) => piece.pieceType === 'pawn').every((piece) => piece.square.endsWith('2')));
    assert(plan.playerFormation.filter((piece) => piece.pieceType !== 'pawn').every((piece) => ['1', '2'].includes(piece.square[1])));
    assert(plan.enemyFormation.filter((piece) => piece.pieceType === 'pawn').every((piece) => piece.square.endsWith('7')));
    const enemySrc = await page.evaluate(() => {
      const plan = globalThis.RPChessSkirmish.battlePlan;
      const piece = plan.enemyFormation.find((entry) => entry.pieceType === 'king');
      return document.querySelector(`[data-square="${piece.square}"] .classic-piece`)?.getAttribute('src') || '';
    });
    assert(enemySrc.includes('assets/races/orcs/pieces/king.png'), 'enemy Skirmish art must come from race library');
    const personalized = await page.evaluate(() => globalThis.RPChessSkirmish.battlePlan.playerFormation.map(({ id, square }) => ({
      id,
      src: document.querySelector(`[data-square="${square}"] .classic-piece`)?.getAttribute('src') || ''
    })));
    assert(personalized.find((entry) => entry.id === 'king.oathkeeper').src.includes('assets/kings/oathkeeper/piece.png'));
    await page.evaluate(() => globalThis.RPChessSkirmish.finishBattle({ over: true, type: 'stalemate', winner: null }));
    await page.locator('[data-skirmish-aftermath]:not([hidden])').waitFor();
    assert.strictEqual((await page.locator('[data-aftermath-continue]').innerText()).trim(), 'Продолжить путь');
    await page.locator('[data-aftermath-continue]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    assert.strictEqual(await page.locator('[data-roster-screen]:not([hidden])').count(), 0, 'Skirmish aftermath must not route through Roster');
    assert.strictEqual(await page.locator('[data-travel-choice]').count(), 3, 'Skirmish aftermath must produce the next Travel Choice');
    assert((await page.locator('[data-travel-type="event"]').count()) >= 1, 'Skirmish aftermath regression must persist and render a next fork containing Event');
    const continued = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(continued.activeTravelChoice, null, 'completed Skirmish route must be cleared before next Travel Choice');
    assert(continued.currentTravelChoices.some((choice) => choice.type === 'event' && choice.mechanicalHint === ''), 'persisted post-Skirmish fork must retain Event with intentionally empty mechanical hint');

    const black = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const blackErrors = [];
    black.on('pageerror', (error) => blackErrors.push(String(error.stack || error)));
    await fresh(black, { playerColor: 'b', stars: 8, race: 'elves' });
    await enter(black);
    assert((await black.locator('[data-skirmish-description]').innerText()).includes('оборону'));
    await black.locator('[data-skirmish-start]').click();
    await black.locator('[data-classic-screen]:not([hidden])').waitFor();
    const blackState = await black.evaluate(() => ({
      plan: globalThis.RPChessSkirmish.battlePlan,
      turn: globalThis.RPChessClassicChess.snapshot().turn,
      mode: document.querySelector('[data-game-mode]')?.textContent || '',
      firstSquare: document.querySelector('[data-chess-board] [data-square]')?.dataset.square || ''
    }));
    assert.strictEqual(blackState.plan.playerColor, 'b');
    assert(blackState.plan.playerFormation.every((piece) => ['7', '8'].includes(piece.square[1])));
    assert(blackState.plan.playerFormation.filter((piece) => piece.pieceType === 'pawn').every((piece) => piece.square[1] === '7'));
    assert.strictEqual(blackState.firstSquare, 'h1', 'Black-side Skirmish must render the board from Black perspective');
    assert.strictEqual(blackState.mode, 'Расчётливый Воевода', 'shared combat summary must render the canonical difficulty label');
    const blackEnemy = await black.evaluate(() => {
      const plan = globalThis.RPChessSkirmish.battlePlan;
      const piece = plan.enemyFormation.find((entry) => entry.pieceType === 'queen');
      return document.querySelector(`[data-square="${piece.square}"] .classic-piece`)?.getAttribute('src') || '';
    });
    assert(blackEnemy.includes('assets/races/elves/pieces/queen.png'));

    const wounded = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const woundedErrors = [];
    wounded.on('pageerror', (error) => woundedErrors.push(String(error.stack || error)));
    await fresh(wounded, { woundedKing: true });
    await enter(wounded);
    assert.strictEqual(await wounded.locator('[data-skirmish-character="king.oathkeeper"]').getAttribute('aria-pressed'), 'true');
    assert.strictEqual(await wounded.locator('[data-skirmish-start]').isDisabled(), false);
    await wounded.locator('[data-skirmish-start]').click();
    await wounded.locator('[data-classic-screen]:not([hidden])').waitFor();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await fresh(mobile, { stars: 12 });
    await enter(mobile);
    await assertResponsiveStars(mobile, '[data-skirmish-stars]', '.skirmish-threat-card');
    const layout = await mobile.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      sh: document.documentElement.scrollHeight,
      ch: document.documentElement.clientHeight,
      pos: getComputedStyle(document.querySelector('.skirmish-actionbar')).position
    }));
    assert(layout.sw <= layout.cw + 1);
    assert(layout.sh > layout.ch);
    assert.strictEqual(layout.pos, 'sticky');

    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(blackErrors, []);
    assert.deepStrictEqual(woundedErrors, []);
    assert.deepStrictEqual(mobileErrors, []);
    console.log('Skirmish aftermath→Event fork, compact desktop stars, canonical combat summary, race art, Black-side, wounded-King and mobile acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
