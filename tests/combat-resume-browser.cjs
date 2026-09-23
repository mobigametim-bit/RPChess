const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const runKey = 'rpchess.reboot.v1.run';

async function exercise(browser, type) {
  const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error.stack || error)));
  try {
    await page.goto(url, { waitUntil:'networkidle' });
    await startNewRun(page);
    await page.evaluate(async ({ key, type }) => {
      const { createTravelChoices } = await import('./js/travel-choice-core.mjs');
      const run = JSON.parse(localStorage.getItem(key));
      run.currentTravelChoices = createTravelChoices({ runId:run.id, types:[type], step:1 })
        .map(choice => ({ ...choice, playerColor:'w', enemyColor:'b' }));
      run.activeTravelChoice = null;
      localStorage.setItem(key, JSON.stringify(run));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
    }, { key:runKey, type });
    await page.locator('[data-roster-travel]').click();
    await page.locator(`[data-travel-type="${type}"]`).first().click();
    await page.locator(type === 'battle' ? '[data-battle-start]' : '[data-skirmish-start]').click();
    await page.locator('[data-artifact-choice="none"]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    assert.strictEqual((await page.evaluate(({ key }) => JSON.parse(localStorage.getItem(key)).currentCombat?.type, { key:runKey })), type);

    const move = await page.evaluate(() => {
      const chess = globalThis.RPChessClassicChess;
      const candidate = chess.engine.legalMoves().find(entry => chess.engine.pieceAt(entry.from)?.color === 'w');
      if (!candidate) throw new Error('No legal player move to checkpoint');
      return chess.move(candidate.from, candidate.uciTo || candidate.to, candidate.promotion || null);
    });
    assert(move.ok, `${type} must accept a legal move`);
    await page.waitForFunction(key => {
      const run = JSON.parse(localStorage.getItem(key));
      return run.currentCombat?.moves.length >= 2 && run.currentCombat.moves.length === globalThis.RPChessClassicChess.moveLog.length;
    }, runKey, { timeout:30000 });
    const before = await page.evaluate(key => ({
      run:JSON.parse(localStorage.getItem(key)),
      fen:globalThis.RPChessClassicChess.snapshot().fen
    }), runKey);
    await page.reload({ waitUntil:'networkidle' });
    await page.locator('[data-continue-run]').click();
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    const after = await page.evaluate(key => ({
      run:JSON.parse(localStorage.getItem(key)),
      fen:globalThis.RPChessClassicChess.snapshot().fen,
      moves:globalThis.RPChessClassicChess.moveLog.length,
      artifactModal:Boolean(document.querySelector('[data-artifact-choice-modal]'))
    }), runKey);
    assert.strictEqual(after.fen, before.fen, `${type} must resume the exact board position`);
    assert.strictEqual(after.moves, before.run.currentCombat.moves.length);
    assert.strictEqual(after.run.supplies, before.run.supplies, `${type} reload must not charge travel again`);
    assert.strictEqual(after.run.gold, before.run.gold, `${type} reload must not charge mercenaries again`);
    assert.strictEqual(after.artifactModal, false, `${type} reload must not offer an artifact again`);
    assert.deepStrictEqual(after.run.currentCombat, before.run.currentCombat);

    await page.evaluate(type => {
      const battle = type === 'battle' ? globalThis.RPChessBattle : globalThis.RPChessSkirmish;
      battle.finishBattle({ over:true, type:'stalemate', winner:null });
    }, type);
    const settled = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), runKey);
    assert.strictEqual(settled.currentCombat, null, `${type} must clear the checkpoint after settlement`);
    assert.strictEqual(settled[type === 'battle' ? 'battleCount' : 'skirmishCount'], 1);
    assert.deepStrictEqual(errors, [], `${type} must not throw during save or resume`);
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch({ headless:true });
  try {
    await exercise(browser, 'battle');
    await exercise(browser, 'skirmish');
    console.log('Battle and Skirmish move checkpoint, reload, exact board restore and single settlement: PASS');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
