const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';
const STANDARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

function route(id, { playerColor = 'w', stars = 6, race = 'orcs' } = {}) {
  const enemyRoleRaces = { pawn: race, knight: race, bishop: race, rook: race, queen: race, king: race };
  return {
    id,
    step: 1,
    type: 'battle',
    label: 'БИТВА',
    stars,
    threatLabel: 'ОПАСНАЯ',
    flavor: 'Дорогу перекрывает полностью развёрнутая армия противника.',
    mechanicalHint: 'Полная армия противника.',
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

async function fresh(page, { woundedKing = false, playerColor = 'w', stars = 6, race = 'orcs' } = {}) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await startNewRun(page);
  const routes = [
    route('manual.battle.1', { playerColor, stars, race }),
    route('manual.battle.2', { playerColor, stars, race }),
    route('manual.battle.3', { playerColor, stars, race })
  ];
  await page.evaluate(({ key, woundedKing, routes }) => {
    const run = JSON.parse(localStorage.getItem(key));
    run.id = `battle-browser-${routes[0].playerColor}`;
    run.currentTravelChoices = routes;
    run.activeTravelChoice = null;
    if (woundedKing) run.roster.find((character) => character.isRunKing).status = 'wounded';
    localStorage.setItem(key, JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, { key: RUN_KEY, woundedKing, routes });
}

async function enter(page) {
  await page.locator('[data-roster-travel]').click();
  await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
  const card = page.locator('[data-travel-type="battle"]').first();
  assert.strictEqual(await card.count(), 1);
  await card.click();
  await page.locator('[data-battle-screen]:not([hidden])').waitFor();
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

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));

    await fresh(page, { playerColor: 'w', stars: 12, race: 'orcs' });
    await enter(page);
    assert.strictEqual(await page.locator('[data-battle-character]').count(), 6);
    assert.strictEqual((await page.locator('[data-battle-personalized-count]').innerText()).trim(), '6');
    await assertResponsiveStars(page, '[data-battle-stars]', '.battle-threat-card');
    assert.strictEqual(await page.locator('.battle-actionbar').isVisible(), false, 'desktop compact Battle prep replaces the legacy actionbar with the canonical Start button in the army panel');
    assert.strictEqual(await page.locator('[data-battle-start]').isVisible(), true);
    await page.locator('[data-battle-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    const state = await page.evaluate(() => ({ fen: globalThis.RPChessClassicChess.snapshot().fen, plan: globalThis.RPChessBattle.battlePlan }));
    assert.strictEqual(state.fen, state.plan.fen);
    assert.strictEqual(state.fen.split(' ')[0], STANDARD);
    assert.strictEqual(state.plan.playerColor, 'w');
    assert.strictEqual(state.plan.encounter.stars, 12);
    assert.strictEqual(state.plan.playerFormation.filter((piece) => piece.id).length, 6);
    const generic = state.plan.playerFormation.find((piece) => !piece.id);
    const enemyQueen = state.plan.enemyFormation.find((piece) => piece.pieceType === 'queen');
    const art = await page.evaluate(({ genericSquare, enemySquare }) => ({
      generic: document.querySelector(`[data-square="${genericSquare}"] .classic-piece`)?.getAttribute('src') || '',
      enemy: document.querySelector(`[data-square="${enemySquare}"] .classic-piece`)?.getAttribute('src') || ''
    }), { genericSquare: generic.square, enemySquare: enemyQueen.square });
    assert(art.generic.includes('assets/races/humans/pieces/white/'));
    assert(art.enemy.includes('assets/races/orcs/pieces/queen.png'));
    await page.evaluate(() => globalThis.RPChessBattle.finishBattle({ over: true, type: 'stalemate', winner: null }));
    await page.locator('[data-battle-aftermath]:not([hidden])').waitFor();
    assert.strictEqual((await page.locator('[data-battle-continue]').innerText()).trim(), 'Продолжить путь');
    await page.locator('[data-battle-continue]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    assert.strictEqual(await page.locator('[data-roster-screen]:not([hidden])').count(), 0, 'Battle aftermath must not route through Roster');
    assert.strictEqual(await page.locator('[data-travel-choice]').count(), 3, 'Battle aftermath must produce the next Travel Choice');
    const continued = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(continued.activeTravelChoice, null, 'completed Battle route must be cleared before next Travel Choice');

    const black = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const blackErrors = [];
    black.on('pageerror', (error) => blackErrors.push(String(error.stack || error)));
    await fresh(black, { playerColor: 'b', stars: 9, race: 'dark_elves' });
    await enter(black);
    assert((await black.locator('[data-battle-description]').innerText()).includes('оборону'));
    await black.locator('[data-battle-start]').click();
    await black.locator('[data-classic-screen]:not([hidden])').waitFor();
    const blackPlan = await black.evaluate(() => globalThis.RPChessBattle.battlePlan);
    assert.strictEqual(blackPlan.playerColor, 'b');
    assert.strictEqual(blackPlan.playerFormation.find((piece) => piece.pieceType === 'king').square, 'e8');
    const blackGeneric = blackPlan.playerFormation.find((piece) => !piece.id);
    const darkEnemy = blackPlan.enemyFormation.find((piece) => piece.pieceType === 'rook');
    const blackArt = await black.evaluate(({ genericSquare, enemySquare }) => ({
      generic: document.querySelector(`[data-square="${genericSquare}"] .classic-piece`)?.getAttribute('src') || '',
      enemy: document.querySelector(`[data-square="${enemySquare}"] .classic-piece`)?.getAttribute('src') || '',
      mode: document.querySelector('[data-game-mode]')?.textContent || '',
      firstSquare: document.querySelector('[data-chess-board] [data-square]')?.dataset.square || ''
    }), { genericSquare: blackGeneric.square, enemySquare: darkEnemy.square });
    assert(blackArt.generic.includes('assets/races/humans/pieces/black/'));
    assert(blackArt.enemy.includes('assets/races/dark_elves/pieces/rook.png'));
    assert.strictEqual(blackArt.firstSquare, 'h1', 'Black-side Battle must render the board from Black perspective');
    assert.strictEqual(blackArt.mode, 'Безжалостный Полководец', 'shared combat summary must render the canonical difficulty label');

    const wounded = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const woundedErrors = [];
    wounded.on('pageerror', (error) => woundedErrors.push(String(error.stack || error)));
    await fresh(wounded, { woundedKing: true });
    await enter(wounded);
    assert.strictEqual(await wounded.locator('[data-battle-participant="king.oathkeeper"]').count(), 1);
    assert.strictEqual(await wounded.locator('[data-battle-start]').isDisabled(), false);
    await wounded.locator('[data-battle-start]').click();
    await wounded.locator('[data-classic-screen]:not([hidden])').waitFor();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await fresh(mobile, { stars: 12 });
    await enter(mobile);
    await assertResponsiveStars(mobile, '[data-battle-stars]', '.battle-threat-card');
    const layout = await mobile.evaluate(() => {
      const start = document.querySelector('[data-battle-start]');
      const army = document.querySelector('.battle-army');
      const actionbar = document.querySelector('.battle-actionbar');
      const startBox = start?.getBoundingClientRect();
      const armyBox = army?.getBoundingClientRect();
      return {
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        sh: document.documentElement.scrollHeight,
        ch: document.documentElement.clientHeight,
        actionbarHidden: Boolean(actionbar?.hidden),
        actionbarVisible: Boolean(actionbar && getComputedStyle(actionbar).display !== 'none' && actionbar.getClientRects().length),
        startParent: start?.parentElement?.className || '',
        startWidth: startBox?.width || 0,
        armyWidth: armyBox?.width || 0
      };
    });
    assert(layout.sw <= layout.cw + 1);
    assert(layout.sh > layout.ch);
    assert.strictEqual(layout.actionbarHidden, true, 'mobile Battle prep must keep the legacy duplicate actionbar hidden');
    assert.strictEqual(layout.actionbarVisible, false, 'mobile Battle prep must not show duplicate counters below the army panel');
    assert(layout.startParent.includes('battle-army'), 'mobile Battle Start CTA must live in the army panel');
    assert(layout.startWidth >= layout.armyWidth - 40, `mobile Battle Start CTA must be effectively full width: ${layout.startWidth}/${layout.armyWidth}`);

    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(blackErrors, []);
    assert.deepStrictEqual(woundedErrors, []);
    assert.deepStrictEqual(mobileErrors, []);
    console.log('Battle aftermath→Travel, compact desktop prep, canonical combat summary, standalone mobile CTA, human color sets, enemy race art, Black-side and wounded King acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
