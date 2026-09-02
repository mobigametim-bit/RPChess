const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';
const OPEN_ROOK_FEN = 'rnbqkbnr/1ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';

function route(id) {
  return {
    id,
    step: 1,
    type: 'battle',
    label: 'БИТВА',
    stars: 6,
    threatLabel: 'ОПАСНАЯ',
    flavor: 'Дорогу перекрывает армия противника.',
    mechanicalHint: 'Полная армия противника.',
    seed: `${id}-seed`,
    difficultyModel: 'power-v1',
    playerColor: 'w',
    enemyColor: 'b',
    enemyRaceTag: 'animals',
    enemyRoleRaces: { pawn:'animals', knight:'animals', bishop:'animals', rook:'animals', queen:'animals', king:'animals' }
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
    await page.reload({ waitUntil: 'networkidle' });
    await startNewRun(page);
    await page.evaluate(({ key, routes }) => {
      const run = JSON.parse(localStorage.getItem(key));
      run.id = 'battle-animation-art-browser';
      run.currentTravelChoices = routes;
      run.activeTravelChoice = null;
      localStorage.setItem(key, JSON.stringify(run));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
    }, { key: RUN_KEY, routes: [route('manual.battle.animation.1'), route('manual.battle.animation.2'), route('manual.battle.animation.3')] });

    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    await page.locator('[data-travel-type="battle"]').first().click();
    await page.locator('[data-battle-screen]:not([hidden])').waitFor();
    await page.locator('[data-battle-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();

    await page.evaluate((fen) => {
      const plan = globalThis.RPChessBattle.battlePlan;
      plan.encounter.enemyRaceTag = 'animals';
      plan.encounter.enemyRoleRaces = { pawn:'animals', knight:'animals', bishop:'animals', rook:'animals', queen:'animals', king:'animals' };
      globalThis.RPChessChessAI.replaceAdapter({
        destroy() {},
        stop() {},
        snapshot() { return { degraded:false }; },
        async chooseMove() { return null; }
      });
      globalThis.RPChessClassicChess.loadFen(fen, { mode:'ai', playerColor:'w', aiElo:800 });
      globalThis.RPChessBattle.syncBattleFromChess();
    }, OPEN_ROOK_FEN);

    await page.waitForFunction(() => {
      const src = document.querySelector('[data-square="a8"] .classic-piece')?.getAttribute('src') || '';
      return src.includes('assets/races/animals/pieces/rook.png');
    });

    const movement = await page.evaluate(() => {
      const source = document.querySelector('[data-square="a8"] .classic-piece')?.getAttribute('src') || '';
      const result = globalThis.RPChessClassicChess.move('a8', 'a7');
      const flyer = document.querySelector('.classic-piece-flyer')?.getAttribute('src') || '';
      return { ok:result.ok, source, flyer };
    });

    assert.strictEqual(movement.ok, true, 'test rook move must be legal');
    assert(movement.source.includes('assets/races/animals/pieces/rook.png'), `enemy rook must start with Animals art: ${movement.source}`);
    assert.strictEqual(movement.flyer, movement.source, `moving enemy rook must keep the exact rendered race art instead of generic Classic art: ${movement.flyer}`);
    assert.deepStrictEqual(errors, []);
    console.log('Battle moving-piece race-art continuity: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});