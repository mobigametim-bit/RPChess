const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';

async function checkSymbols(page,selector,count=32){
  const board=page.locator(selector);
  await page.waitForFunction(({selector,count})=>document.querySelectorAll(selector+' .rpchess-piece-symbol').length===count,{selector,count});
  const visual=await board.evaluate(node=>{
    const white=node.querySelector('.rpchess-piece-symbol--w');
    const black=node.querySelector('.rpchess-piece-symbol--b');
    const image=node.querySelector('.classic-piece,.puzzle-piece');
    return {
      glyphs:node.querySelectorAll('.rpchess-piece-symbol').length,
      white:white?.textContent,
      black:black?.textContent,
      whiteDisplay:getComputedStyle(white).display,
      blackDisplay:getComputedStyle(black).display,
      imageOpacity:getComputedStyle(image).opacity,
      glyphPointerEvents:getComputedStyle(white).pointerEvents
    };
  });
  assert.equal(visual.glyphs,count);
  assert('♙♔♕♖♗♘'.includes(visual.white),'White must use Unicode chess outline');
  assert('♟♚♛♜♝♞'.includes(visual.black),'Black must use Unicode filled chess glyph');
  assert.equal(visual.whiteDisplay,'flex');assert.equal(visual.blackDisplay,'flex');
  assert.equal(visual.imageOpacity,'0');assert.equal(visual.glyphPointerEvents,'none');
}
async function drag(page,from,to){
  const a=await page.locator('[data-chess-board] [data-square="'+from+'"]').boundingBox();
  const b=await page.locator('[data-chess-board] [data-square="'+to+'"]').boundingBox();
  const x=a.x+a.width/2,y=a.y+a.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x+14,y,{steps:7});
  const ghost=page.locator('.rpchess-piece-drag-ghost');
  await ghost.waitFor({timeout:3000});
  assert.equal(await ghost.evaluate(n=>n.tagName),'SPAN','Glyph mode must not show fantasy image drag ghost');
  assert.equal(await ghost.textContent(),'♙');
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});
  await page.mouse.up();
  await page.waitForFunction(()=>window.RPChessClassicChess?.engine?.pieceAt('e4')?.type==='p');
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url,{waitUntil:'networkidle'});
    assert.notEqual(await page.locator('html').getAttribute('data-simple-pieces'),'1','Detailed art default');
    await page.locator('[data-reboot-foundation] [data-settings]').first().click();
    const toggle=page.locator('input[data-simple-pieces]');
    assert.equal(await toggle.isChecked(),false);
    await toggle.check();
    assert.equal(await page.locator('html').getAttribute('data-simple-pieces'),'1');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('rpchess.reboot.v1.settings')).simplePieces),true);
    await page.locator('[data-settings-modal] [data-close-modal]').click();
    await page.evaluate(()=>dispatchEvent(new CustomEvent('rpchess:new-game')));
    await page.locator('[data-game-setup-modal]:not([hidden])').waitFor();
    await page.locator('[data-game-mode-select]').selectOption('local');
    await page.locator('[data-start-game]').click();
    await checkSymbols(page,'[data-chess-board]');
    await page.locator('[data-classic-screen] [data-settings]').click();
    await toggle.uncheck();
    assert.equal(await page.locator('[data-chess-board] .rpchess-piece-symbol').first().evaluate(n=>getComputedStyle(n).display),'none','Should return to detailed art without board reset');
    assert.equal(await page.locator('[data-chess-board] .classic-piece').first().evaluate(n=>getComputedStyle(n).opacity),'1');
    await toggle.check();await page.locator('[data-settings-modal] [data-close-modal]').click();
    await drag(page,'e2','e4');
    // Real pawn promotion, including the choice dialog.
    await page.evaluate(()=>RPChessClassicChess.loadFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1',{mode:'local'}));
    await page.locator('[data-chess-board] [data-square="a7"]').click();
    await page.locator('[data-chess-board] [data-square="a8"]').click();
    await page.locator('[data-promotion-modal]:not([hidden])').waitFor();
    assert.equal(await page.locator('[data-promotion-modal] .rpchess-promotion-symbol').count(),4);
    assert.equal(await page.locator('[data-promotion-modal] img').first().evaluate(n=>getComputedStyle(n).display),'none');
    await page.locator('[data-promotion="q"]').click();
    await page.waitForFunction(()=>window.RPChessClassicChess?.engine?.pieceAt('a8')?.type==='q');
    assert.equal(await page.locator('[data-chess-board] [data-square="a8"] .rpchess-piece-symbol').textContent(),'♕');
    await page.reload({waitUntil:'networkidle'});
    assert.equal(await page.locator('html').getAttribute('data-simple-pieces'),'1','Mode survives reload');
    await page.locator('[data-arena-open]').click();
    await page.locator('[data-arena-foes] button').first().click();
    await page.locator('[data-arena-action="fight"]').click();
    await page.locator('[data-artifact="none"]').click();
    await checkSymbols(page,'[data-arena-board]');
    await page.setViewportSize({width:390,height:844});
    await checkSymbols(page,'[data-arena-board]');
    assert.deepEqual(errors,[],'No runtime exceptions in chess or Arena');

    const puzzle=await browser.newPage({viewport:{width:667,height:375}});
    const puzzleErrors=[];puzzle.on('pageerror',e=>puzzleErrors.push(e.message));
    await puzzle.goto(url,{waitUntil:'networkidle'});
    await puzzle.evaluate(()=>localStorage.setItem('rpchess.reboot.v1.settings',JSON.stringify({language:'ru',simplePieces:true,reducedMotion:false,music:20,sfx:80})));
    await puzzle.reload({waitUntil:'networkidle'});
    await startNewRun(puzzle);
    await puzzle.evaluate(async()=>{
      const {createTravelChoices}=await import('./js/travel-choice-core.mjs');
      const {readRun,writeRun}=await import('./js/run-persistence.mjs');
      const run=readRun();
      writeRun({...run,currentTravelChoices:createTravelChoices({runId:run.id,types:['puzzle'],step:1}),activeTravelChoice:null});
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
    });
    await puzzle.locator('[data-roster-travel]').click();
    await puzzle.locator('[data-puzzle-screen]:not([hidden])').waitFor();
    await puzzle.waitForFunction(()=>document.querySelectorAll('[data-puzzle-board] .rpchess-piece-symbol').length>2);
    const n=await puzzle.locator('[data-puzzle-board] .rpchess-piece-symbol').count();
    await checkSymbols(puzzle,'[data-puzzle-board]',n);
    assert.deepEqual(puzzleErrors,[]);
    console.log('Simplified glyphs: settings live/reload, classic, promotion, mouse drag, Arena portrait, puzzle: PASS');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
