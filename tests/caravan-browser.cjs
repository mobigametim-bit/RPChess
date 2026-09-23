const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';

async function resumeCaravan(page, selector) {
  const inCombat = await page.evaluate(key => JSON.parse(localStorage.getItem(key))?.currentCaravan?.phase === 'combat', RUN_KEY);
  await page.reload({ waitUntil:'networkidle' });
  await page.locator('[data-continue-run]').click();
  if (!inCombat) {
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    await page.locator('[data-roster-travel]').click();
  }
  await page.locator(selector).waitFor();
}

async function openCaravan(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await startNewRun(page);
  await page.evaluate(async (key) => {
    const { createTravelChoices } = await import('./js/travel-choice-core.mjs');
    const run = JSON.parse(localStorage.getItem(key));
    run.currentTravelChoices = createTravelChoices({ runId:run.id, types:['caravan'], step:run.step || 1 });
    run.activeTravelChoice = null;
    localStorage.setItem(key, JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, RUN_KEY);
  await page.locator('[data-roster-travel]').click();
  await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
  const card = page.locator('[data-travel-type="caravan"]').first();
  assert((await card.innerText()).includes('???'), 'route must conceal its reward');
  await card.click();
  await page.locator('[data-battle-screen]:not([hidden])').waitFor();
  const run = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
  assert.equal(run.activeTravelChoice.type, 'caravan');
  assert.equal(run.currentCaravan.phase, 'preparation');
  assert.equal(run.activeTravelChoice.supplyPaid, 1);
  assert(!(await page.locator('[data-battle-army-note]').innerText()).includes('стоит'), 'mercenaries must be free');
  return run;
}

(async () => {
  const browser = await chromium.launch({ headless:true });
  try {
    const page = await browser.newPage({ viewport:{width:1440,height:900} });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));
    const before = await openCaravan(page);
    await resumeCaravan(page, '[data-battle-screen]:not([hidden])');
    const restored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.equal(restored.currentCaravan.encounter.positionIndex, before.currentCaravan.encounter.positionIndex);
    assert.equal(restored.supplies, before.supplies, 'reload must not charge Supplies twice');

    await page.locator('[data-battle-start]').click();
    await page.locator('[data-artifact-choice-modal]').waitFor();
    await page.locator('[data-artifact-choice="none"]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    assert.equal(await page.locator('[data-classic-screen] .classic-party-panel h2').innerText(), 'Защита каравана');
    const plan = await page.evaluate(() => globalThis.RPChessBattle.battlePlan);
    assert(plan.chess960);
    assert.equal(plan.playerFormation.length, 16);
    assert.equal(plan.enemyFormation.length, 16);
    await page.waitForFunction(() => globalThis.RPChessClassicChess?.snapshot().turn === globalThis.RPChessChessAI?.config.playerColor);
    const move = await page.evaluate(() => {
      const chess = globalThis.RPChessClassicChess;
      const candidate = chess.engine.legalMoves().find(item => chess.engine.pieceAt(item.from)?.color === globalThis.RPChessChessAI.config.playerColor);
      if (!candidate) throw new Error('No legal caravan move to save');
      return chess.move(candidate.from, candidate.uciTo || candidate.to, candidate.promotion || null);
    });
    assert(move.ok, 'Caravan must accept a legal move before switching devices');
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.currentCaravan?.moves?.length >= 1, RUN_KEY);
    const beforeReload = await page.evaluate(key => ({ fen:globalThis.RPChessClassicChess.snapshot().fen, moves:JSON.parse(localStorage.getItem(key)).currentCaravan.moves }), RUN_KEY);
    await resumeCaravan(page, '[data-classic-screen]:not([hidden])');
    assert.equal((await page.evaluate(() => globalThis.RPChessBattle.battlePlan)).fen, plan.fen);
    assert.equal((await page.evaluate(() => globalThis.RPChessClassicChess.snapshot().fen)), beforeReload.fen);
    assert.deepStrictEqual((await page.evaluate(key => JSON.parse(localStorage.getItem(key)).currentCaravan.moves, RUN_KEY)), beforeReload.moves);

    await page.evaluate((color) => globalThis.RPChessBattle.finishBattle({over:true,type:'checkmate',winner:color}), plan.playerColor);
    await page.locator('[data-caravan-rewards]').waitFor();
    assert.equal(await page.locator('[data-caravan-reward]').count(), 3);
    for (const card of await page.locator('[data-caravan-reward]').all()) {
      assert.equal(await card.locator('img').count(), 1, 'each reward card needs one icon');
      assert(!(await card.innerText()).includes('Забрать'), 'reward selection needs no redundant Claim label');
    }
    await resumeCaravan(page, '[data-caravan-rewards]');
    const offer = await page.locator('[data-caravan-reward]').first().getAttribute('data-caravan-reward');
    await page.locator('[data-caravan-reward]').first().click();
    await page.locator('[data-battle-aftermath]:not([hidden])').waitFor();
    const claimed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.equal(claimed.currentCaravan.phase, 'aftermath');
    assert.equal(claimed.currentCaravan.claimedReward.id, offer);
    await resumeCaravan(page, '[data-battle-aftermath]:not([hidden])');
    assert.equal(await page.locator('[data-caravan-rewards]').count(), 0, 'claimed reward must not reappear');
    await page.locator('[data-battle-continue]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    const continued = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.equal(continued.currentCaravan, null);
    assert.equal(continued.activeTravelChoice, null);
    const portraits = await page.evaluate(async (runKey) => {
      const { showCaravanRewards } = await import('./js/caravan-reward-ui.mjs');
      const { RECRUIT_LIBRARY } = await import('./js/settlement-core.mjs');
      const { PIECE_GLYPHS } = await import('./js/roster-data.mjs');
      const run = JSON.parse(localStorage.getItem(runKey));
      const healed = run.roster.find(hero => !hero.isRunKing);
      const recruit = RECRUIT_LIBRARY.find(hero => !run.roster.some(member => member.id === hero.id));
      const offers = [
        { id:'preview:healing',kind:'healing',heroId:healed.id },
        { id:'preview:hero',kind:'hero',heroId:recruit.id },
        { id:'preview:gold',kind:'gold',amount:60 }
      ];
      showCaravanRewards({ ...run,currentCaravan:{ offers } }, () => true);
      const read = id => {
        const card = document.querySelector(`[data-caravan-reward="${id}"]`);
        return { glyph:card.querySelector('.caravan-reward-card__glyph')?.textContent,
          hidden:card.querySelector('.caravan-reward-card__glyph')?.getAttribute('aria-hidden'),
          imageCount:card.querySelectorAll('img').length,
          portrait:card.querySelector('.caravan-reward-card__portrait')?.contains(card.querySelector('img')) };
      };
      const result = { healing:read('preview:healing'),hero:read('preview:hero'),gold:read('preview:gold'),
        healingExpected:PIECE_GLYPHS[healed.pieceType],heroExpected:PIECE_GLYPHS[recruit.pieceType] };
      document.querySelector('[data-caravan-rewards]').remove();
      return result;
    }, RUN_KEY);
    for (const [kind,expected] of [['healing',portraits.healingExpected],['hero',portraits.heroExpected]]) {
      assert.equal(portraits[kind].glyph,expected,`${kind} shows its hero's piece glyph`);
      assert.equal(portraits[kind].hidden,'true');
      assert.equal(portraits[kind].imageCount,1);
      assert.equal(portraits[kind].portrait,true);
    }
    assert.equal(portraits.gold.glyph,undefined,'resource rewards have no piece glyph');
    assert.deepEqual(errors, []);

    const mobile = await browser.newPage({ viewport:{width:844,height:390} });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await openCaravan(mobile);
    const layout = await mobile.evaluate(() => ({
      pageWidth:document.documentElement.scrollWidth,
      viewportWidth:document.documentElement.clientWidth,
      pageHeight:document.documentElement.scrollHeight,
      viewportHeight:document.documentElement.clientHeight,
      start:(() => {const r=document.querySelector('[data-battle-start]').getBoundingClientRect();return {top:r.top,bottom:r.bottom};})()
    }));
    assert(layout.pageWidth <= layout.viewportWidth + 1 && layout.pageHeight <= layout.viewportHeight + 1, `mobile preparation must fit the viewport: ${JSON.stringify(layout)}`);
    assert(layout.start.top >= 0 && layout.start.bottom <= layout.viewportHeight + 1, 'mobile Start button must be reachable');
    assert.deepEqual(mobileErrors, []);
    console.log('Caravan browser: route, free mercenaries, reload, Chess960, reward claim, aftermath and mobile PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
