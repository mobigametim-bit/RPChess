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
    await page.locator('[data-artifact-choice-modal]').waitFor();
    await page.locator('[data-artifact-choice="none"]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    try {
      await page.waitForFunction(type=>Boolean(globalThis.RPChessClassicChess?.engine&&(type==='battle'?globalThis.RPChessBattle?.battlePlan:globalThis.RPChessSkirmish?.battlePlan)),type,{timeout:12000});
    } catch (error) {
      const debug=await page.evaluate(()=>({
        chess:!!globalThis.RPChessClassicChess, battle:!!globalThis.RPChessBattle,
        skirmish:!!globalThis.RPChessSkirmish,
        battlePlan:!!globalThis.RPChessBattle?.battlePlan,
        skirmishPlan:!!globalThis.RPChessSkirmish?.battlePlan,
        screen:!document.querySelector('[data-classic-screen]')?.hidden,
        boardCells:document.querySelectorAll('[data-chess-board] [data-square]').length
      }));
      throw new Error(type+' chess owner unavailable: '+JSON.stringify({debug,errors,cause:error.message}));
    }
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
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    try {
      await page.waitForFunction(type=>Boolean(globalThis.RPChessClassicChess?.engine&&(type==='battle'?globalThis.RPChessBattle?.battlePlan:globalThis.RPChessSkirmish?.battlePlan)),type,{timeout:12000});
    } catch (error) {
      const debug=await page.evaluate(()=>({
        chess:!!globalThis.RPChessClassicChess, battle:!!globalThis.RPChessBattle,
        skirmish:!!globalThis.RPChessSkirmish,
        battlePlan:!!globalThis.RPChessBattle?.battlePlan,
        skirmishPlan:!!globalThis.RPChessSkirmish?.battlePlan,
        screen:!document.querySelector('[data-classic-screen]')?.hidden,
        boardCells:document.querySelectorAll('[data-chess-board] [data-square]').length
      }));
      throw new Error(type+' chess owner unavailable: '+JSON.stringify({debug,errors,cause:error.message}));
    }
    const after = await page.evaluate(key => ({
      run:JSON.parse(localStorage.getItem(key)),
      fen:globalThis.RPChessClassicChess.snapshot().fen,
      moves:globalThis.RPChessClassicChess.moveLog.length,
      rosterHidden:document.querySelector('[data-roster-screen]').hidden,
      rosterVisible:getComputedStyle(document.querySelector('[data-roster-screen]')).display !== 'none',
      artifactModal:Boolean(document.querySelector('[data-artifact-choice-modal]'))
    }), runKey);
    assert.strictEqual(after.fen, before.fen, `${type} must resume the exact board position`);
    assert.strictEqual(after.moves, before.run.currentCombat.moves.length);
    assert.strictEqual(after.rosterHidden, true, `${type} resume must hide the roster scene`);
    assert.strictEqual(after.rosterVisible, false, `${type} resume must not paint the roster over the board`);
    assert.strictEqual(after.run.supplies, before.run.supplies, `${type} reload must not charge travel again`);
    assert.strictEqual(after.run.gold, before.run.gold, `${type} reload must not charge mercenaries again`);
    assert.strictEqual(after.artifactModal, false, `${type} reload must not offer an artifact again`);
    assert.deepStrictEqual(after.run.currentCombat, before.run.currentCombat);
    const namedSprites = await page.evaluate(type => {
      const owner = type === 'battle' ? globalThis.RPChessBattle : globalThis.RPChessSkirmish;
      const plan = owner.battlePlan;
      const heroes = plan.playerFormation.filter(p => String(p.id || '').startsWith('hero.'));
      const squares = [...document.querySelectorAll('[data-chess-board] [data-square]')];
      return { owner:globalThis.RPChessClassicChess.combatOwner,
        heroes:heroes.map(hero=>{
          const current = squares.find(cell=>cell.dataset.personalizedId===hero.id);
          const img=current?.querySelector('.classic-piece');
          return {id:hero.id,square:current?.dataset.square,src:img?.getAttribute('src')||''};
        }) };
    }, type);
    assert.equal(namedSprites.owner,type,'Only the active combat owner may paint this shared chess board');
    assert(namedSprites.heroes.length>=2 && namedSprites.heroes.every(p=>p.src.includes('/heroes/')&&p.square),
      `${type} must restore named hero sprites, not generic pieces: `+JSON.stringify(namedSprites));

    if (type === 'battle') {
      // Reach an actual named pawn promotion by restoring a legal position
      // one move before it, then committing the final move in the live UI.
      const moves=[['a2','a4'],['b7','b5'],['a4','b5'],['a7','a6'],
        ['b5','b6'],['h7','h6'],['b6','b7'],['h6','h5']]
        .map(([from,to])=>({from,to,promotion:null}));
      const inserted=await page.evaluate(({key,moves})=>{
        const run=JSON.parse(localStorage.getItem(key));
        const mara=globalThis.RPChessBattle.battlePlan.playerFormation.find(p=>p.square==='a2');
        if(mara?.id!=='hero.mara_chain')return {error:'Expected named starter pawn on a2',mara};
        run.currentCombat.moves=moves;
        localStorage.setItem(key,JSON.stringify(run));
        return {ok:true};
      }, {key:runKey,moves});
      assert(inserted.ok,JSON.stringify(inserted));
      await page.reload({waitUntil:'networkidle'});
      await page.locator('[data-continue-run]').click();
      await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    try {
      await page.waitForFunction(type=>Boolean(globalThis.RPChessClassicChess?.engine&&(type==='battle'?globalThis.RPChessBattle?.battlePlan:globalThis.RPChessSkirmish?.battlePlan)),type,{timeout:12000});
    } catch (error) {
      const debug=await page.evaluate(()=>({
        chess:!!globalThis.RPChessClassicChess, battle:!!globalThis.RPChessBattle,
        skirmish:!!globalThis.RPChessSkirmish,
        battlePlan:!!globalThis.RPChessBattle?.battlePlan,
        skirmishPlan:!!globalThis.RPChessSkirmish?.battlePlan,
        screen:!document.querySelector('[data-classic-screen]')?.hidden,
        boardCells:document.querySelectorAll('[data-chess-board] [data-square]').length
      }));
      throw new Error(type+' chess owner unavailable: '+JSON.stringify({debug,errors,cause:error.message}));
    }
      const advanced=await page.evaluate(()=>{
        const chess=globalThis.RPChessClassicChess;
        const before=chess.engine.pieceAt('b7');
        const result=chess.move('b7','a8','q');
        return {before,ok:result.ok,after:chess.engine.pieceAt('a8'),sprite:document.querySelector('[data-chess-board] [data-square="a8"] .classic-piece')?.getAttribute('src')};
      });
      assert(advanced.ok&&advanced.before?.type==='p'&&advanced.after?.type==='q',
        'Named pawn promotion must be a legal real chess move: '+JSON.stringify(advanced));
      assert.equal(advanced.sprite,'assets/heroes/mara_chain/pieces/white/queen.webp',
        'Named pawn must change its sprite to her individual queen immediately on promotion');
      await page.waitForFunction(key=>
        JSON.parse(localStorage.getItem(key)).currentCombat?.moves.length>=9,runKey,{timeout:8000});
      await page.reload({waitUntil:'networkidle'});
      await page.locator('[data-continue-run]').click();
      await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    try {
      await page.waitForFunction(type=>Boolean(globalThis.RPChessClassicChess?.engine&&(type==='battle'?globalThis.RPChessBattle?.battlePlan:globalThis.RPChessSkirmish?.battlePlan)),type,{timeout:12000});
    } catch (error) {
      const debug=await page.evaluate(()=>({
        chess:!!globalThis.RPChessClassicChess, battle:!!globalThis.RPChessBattle,
        skirmish:!!globalThis.RPChessSkirmish,
        battlePlan:!!globalThis.RPChessBattle?.battlePlan,
        skirmishPlan:!!globalThis.RPChessSkirmish?.battlePlan,
        screen:!document.querySelector('[data-classic-screen]')?.hidden,
        boardCells:document.querySelectorAll('[data-chess-board] [data-square]').length
      }));
      throw new Error(type+' chess owner unavailable: '+JSON.stringify({debug,errors,cause:error.message}));
    }
      const reloaded=await page.evaluate(()=>({
        piece:globalThis.RPChessClassicChess.engine.pieceAt('a8'),
        sprite:document.querySelector('[data-chess-board] [data-square="a8"] .classic-piece')?.getAttribute('src')
      }));
      assert.equal(reloaded.piece?.type,'q');
      assert.equal(reloaded.sprite,'assets/heroes/mara_chain/pieces/white/queen.webp',
        'Named promoted queen must retain her art after a full page reload and combat resume');
    }

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
