const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';

async function checkSymbols(page,selector,count=32){
  const board=page.locator(selector);
  await page.waitForFunction(({selector,count})=>document.querySelectorAll(selector+' .rpchess-piece-symbol').length===count,{selector,count});
  await page.waitForFunction(({selector})=>[...document.querySelectorAll(selector+' .rpchess-fantasy-piece')].every(img=>img.complete&&img.naturalWidth>0),{selector});
  const visual=await board.evaluate(node=>{
    const white=node.querySelector('.rpchess-piece-symbol--w');
    const black=node.querySelector('.rpchess-piece-symbol--b');
    const image=node.querySelector('.classic-piece,.puzzle-piece');
    return {
      glyphs:node.querySelectorAll('.rpchess-piece-symbol').length,
      white:white?.querySelector('.rpchess-fantasy-piece')?.getAttribute('src'),
      black:black?.querySelector('.rpchess-fantasy-piece')?.getAttribute('src'),
      whiteLoaded:white?.querySelector('.rpchess-fantasy-piece')?.naturalWidth>0,
      blackLoaded:black?.querySelector('.rpchess-fantasy-piece')?.naturalWidth>0,
      whiteColor:getComputedStyle(white).color,
      blackColor:getComputedStyle(black).color,
      whiteDisplay:getComputedStyle(white).display,
      blackDisplay:getComputedStyle(black).display,
      imageOpacity:getComputedStyle(image).opacity,
      glyphPointerEvents:getComputedStyle(white).pointerEvents
    };
  });
  assert.equal(visual.glyphs,count);
  assert.match(visual.white,/^assets\/pieces\/fantasy\/w[PNBRQK]\.svg$/,'White must use the official Fantasy SVG file');
  assert.match(visual.black,/^assets\/pieces\/fantasy\/b[PNBRQK]\.svg$/,'Black must use the official Fantasy SVG file');
  assert.equal(visual.whiteLoaded,true,'White SVG must load');
  assert.equal(visual.blackLoaded,true,'Black SVG must load');
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
  assert.equal(await ghost.evaluate(n=>n.tagName),'IMG','Fantasy drag preview must be the matching SVG image');
  assert.equal(await ghost.getAttribute('src'),'assets/pieces/fantasy/wP.svg');
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
    // Pin all twelve MIT-licensed Fantasy SVGs; no race-specific simplified art.
    const assets=await page.evaluate(async()=>{
      const roles=['P','N','B','R','Q','K'];
      return await Promise.all(['w','b'].flatMap(side=>roles.map(role=>side+role)).map(async name=>{
        const response=await fetch('./assets/pieces/fantasy/'+name+'.svg');
        return {name,ok:response.ok,svg:(await response.text()).trimStart().startsWith('<svg')};
      }));
    });
    assert.equal(assets.length,12);
    assert(assets.every(asset=>asset.ok&&asset.svg),'Fantasy assets must be present and valid SVG');
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
    const classicSwitch=page.locator('[data-classic-screen] .classic-panel--moves [data-board-view-switch]');
    assert.equal(await classicSwitch.count(),1,'Shared Battle/Skirmish/Caravan board journal has one in-game switch');
    assert.equal(await classicSwitch.isChecked(),true);
    const beforeSwitchFen=await page.evaluate(()=>RPChessClassicChess.engine.fen());
    const kingIcons=page.locator('[data-classic-screen] .rpchess-board-view-toggle__king');
    assert.equal(await kingIcons.count(),2);
    assert.match(await kingIcons.nth(0).getAttribute('src'),/\/humans\/pieces\/board\/white\/king\.png$/);
    assert.equal(await kingIcons.nth(1).getAttribute('src'),'assets/pieces/fantasy/wK.svg');
    await classicSwitch.uncheck();
    assert.equal(await page.locator('html').getAttribute('data-simple-pieces'),'0');
    assert.equal(await page.locator('[data-chess-board] .classic-piece').first().evaluate(n=>getComputedStyle(n).opacity),'1');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('rpchess.reboot.v1.settings')).simplePieces),false);
    await classicSwitch.check();
    assert.equal(await page.evaluate(()=>RPChessClassicChess.engine.fen()),beforeSwitchFen,'Changing art must not reset the board');
    await checkSymbols(page,'[data-chess-board]');
    await page.locator('[data-classic-screen] [data-settings]').click();
    await toggle.uncheck();
    assert.equal(await page.locator('[data-chess-board] .rpchess-piece-symbol').first().evaluate(n=>getComputedStyle(n).display),'none','Should return to detailed art without board reset');
    assert.equal(await page.locator('[data-chess-board] .classic-piece').first().evaluate(n=>getComputedStyle(n).opacity),'1');
    await toggle.check();await page.locator('[data-settings-modal] [data-close-modal]').click();
    // Existing animation must now move the visible Fantasy SVG, not an invisible PNG.
    await page.evaluate(() => {
      window.__fantasyFlyers = [];
      const original = Element.prototype.animate;
      Element.prototype.animate = function(keyframes, options) {
        if (this.classList.contains('classic-piece-flyer') || this.classList.contains('classic-captured-ghost')) {
          const destination = document.querySelector('[data-chess-board] [data-square="e4"] .rpchess-piece-symbol');
          window.__fantasyFlyers.push({
            role: this.className, src: this.getAttribute('src'),
            opacity: getComputedStyle(this).opacity, duration: options?.duration,
            destinationHidden: destination ? getComputedStyle(destination).visibility === 'hidden' : null
          });
        }
        return original.call(this, keyframes, options);
      };
    });
    await drag(page,'e2','e4');
    assert(await page.evaluate(() => __fantasyFlyers.some(f =>
      f.role === 'classic-piece-flyer' && f.src === 'assets/pieces/fantasy/wP.svg' &&
      f.duration === 230 && f.opacity === '1' && f.destinationHidden)),
      'Fantasy pawn must fly visibly for the usual 230 ms; the landing image must not flash');
    await page.waitForFunction(() => !RPChessChessAI.snapshot().animating);

    // A capture uses the actual black Fantasy figure as its disappearing ghost.
    await page.evaluate(() => RPChessClassicChess.loadFen('4k3/8/8/8/4p3/3P4/8/4K3 w - - 0 1', { mode:'local' }));
    await page.locator('[data-chess-board] [data-square="d3"]').click();
    await page.locator('[data-chess-board] [data-square="e4"]').click();
    assert(await page.evaluate(() => __fantasyFlyers.some(f =>
      f.role === 'classic-captured-ghost' && f.src === 'assets/pieces/fantasy/bP.svg' &&
      f.duration === 190 && f.opacity === '1')),
      'A captured Fantasy piece must fade using its own SVG');
    await page.waitForFunction(() => !RPChessChessAI.snapshot().animating);

    // Real pawn promotion, including the choice dialog.
    await page.evaluate(()=>RPChessClassicChess.loadFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1',{mode:'local'}));
    await page.locator('[data-chess-board] [data-square="a7"]').click();
    await page.locator('[data-chess-board] [data-square="a8"]').click();
    await page.locator('[data-promotion-modal]:not([hidden])').waitFor();
    assert.equal(await page.locator('[data-promotion-modal] .rpchess-promotion-symbol').count(),4);
    assert.equal(await page.locator('[data-promotion-modal] .rpchess-fantasy-piece').count(),4);
    assert.equal(await page.locator('[data-promotion-modal] img').first().evaluate(n=>getComputedStyle(n).display),'none');
    await page.locator('[data-promotion="q"]').click();
    await page.waitForFunction(()=>window.RPChessClassicChess?.engine?.pieceAt('a8')?.type==='q');
    assert(await page.evaluate(() => __fantasyFlyers.some(f =>
      f.role === 'classic-piece-flyer' && f.src === 'assets/pieces/fantasy/wP.svg')),
      'Promotion must animate the moving pawn before displaying the promoted piece');
    await page.waitForFunction(() => !RPChessChessAI.snapshot().animating);
    assert.equal(await page.locator('[data-chess-board] [data-square="a8"] .rpchess-fantasy-piece').getAttribute('src'),'assets/pieces/fantasy/wQ.svg');
    await page.reload({waitUntil:'networkidle'});
    assert.equal(await page.locator('html').getAttribute('data-simple-pieces'),'1','Mode survives reload');
    await page.locator('[data-arena-open]').click();
    assert.equal(await page.locator('[data-arena-foes] button:not([disabled])').count(),1,'Only the first opponent is open before a win');
    assert.equal(await page.locator('[data-arena-squads] button:not([disabled])').count(),1,'Other squads require honor-shard purchases');
    await page.locator('[data-arena-foes] button').first().click();
    await page.locator('[data-arena-action="fight"]').click();
    await page.locator('[data-artifact="none"]').click();
    await checkSymbols(page,'[data-arena-board]');
    const arenaSwitch=page.locator('[data-arena-screen] .arena-battle-journal [data-board-view-switch]');
    assert.equal(await arenaSwitch.count(),1);
    assert.equal(await arenaSwitch.isChecked(),true);
    const arenaFen=await page.evaluate(()=>RPChessArena.engine.fen());
    await arenaSwitch.uncheck();
    assert.equal(await page.locator('html').getAttribute('data-simple-pieces'),'0');
    await arenaSwitch.check();
    assert.equal(await page.evaluate(()=>RPChessArena.engine.fen()),arenaFen);
    await checkSymbols(page,'[data-arena-board]');
    // Arena may give the player either color; await the actual local turn.
    await page.waitForFunction(() => window.RPChessArena?.engine &&
      RPChessArena.engine.turn() === RPChessArena.state.match?.playerColor &&
      !document.querySelector('[data-arena-board] [data-square]')?.disabled,
      null, { timeout:45000 });
    const arenaMove = await page.evaluate(() => {
      const engine = RPChessArena.engine;
      const move = engine.legalMoves().find(m => !m.castle && !m.promotion);
      return { from:move.from, to:move.uciTo || move.to };
    });
    await page.evaluate(to => {
      window.__arenaFlyers = [];
      const original = Element.prototype.animate;
      Element.prototype.animate = function(keyframes, options) {
        if (this.classList.contains('classic-piece-flyer')) {
          const marker = document.querySelector('[data-arena-board] [data-square="' + to + '"] .rpchess-piece-symbol');
          window.__arenaFlyers.push({
            src:this.getAttribute('src'), duration:options?.duration,
            opacity:getComputedStyle(this).opacity,
            destinationHidden:marker ? getComputedStyle(marker).visibility === 'hidden' : null
          });
        }
        return original.call(this, keyframes, options);
      };
    }, arenaMove.to);
    await page.locator('[data-arena-board] [data-square="' + arenaMove.from + '"]').click();
    await page.locator('[data-arena-board] [data-square="' + arenaMove.to + '"]').click();
    assert(await page.evaluate(() => __arenaFlyers.some(f =>
      /^assets\/pieces\/fantasy\/[wb][PNBRQK]\.svg$/.test(f.src) &&
      f.duration === 290 && f.opacity === '1' && f.destinationHidden)),
      'Arena Fantasy figures must use the same visible 290ms animation as the detailed art');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await arenaSwitch.isVisible(),true,'In-game switch remains visible in phone portrait');
    await checkSymbols(page,'[data-arena-board]');
    assert.deepEqual(errors,[],'No runtime exceptions in chess or Arena');

    const puzzle=await browser.newPage({viewport:{width:667,height:375}});
    const puzzleErrors=[];puzzle.on('pageerror',e=>puzzleErrors.push(e.message));
    await puzzle.goto(url,{waitUntil:'networkidle'});
    await puzzle.evaluate(()=>localStorage.setItem('rpchess.reboot.v1.settings',JSON.stringify({language:'ru',simplePieces:true,reducedMotion:false,music:20,sfx:80})));
    await puzzle.reload({waitUntil:'networkidle'});
    await startNewRun(puzzle);
    // Reuse the working Training acceptance fixture: open a concrete puzzle
    // route from the roster instead of generating random travel choices.
    await puzzle.evaluate(()=>{
      const key='rpchess.reboot.v1.run',run=JSON.parse(localStorage.getItem(key));
      const choice={
        id:'manual.puzzle.simplified-glyphs',step:1,type:'puzzle',label:'ЗАДАЧА',
        stars:1,threatLabel:'СЛОЖНОСТЬ ★1',
        flavor:'Тренировочная позиция для проверки шахматных символов.',
        mechanicalHint:'Найдите точный ход.',seed:'manual-puzzle-simplified-glyphs',
        supplyCostAtSelection:1,supplyPaid:1
      };
      localStorage.setItem(key,JSON.stringify({
        ...run,id:'simplified-glyphs-browser-run',supplies:9,journeyStep:1,
        currentTravelChoices:null,activeTravelChoice:choice,
        currentPuzzle:null,lastPuzzle:null,puzzleHistory:[]
      }));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
    });
    await puzzle.locator('[data-roster-travel]').click();
    await puzzle.locator('[data-puzzle-screen]:not([hidden])').waitFor();
    await puzzle.waitForFunction(()=>document.querySelectorAll('[data-puzzle-board] .rpchess-piece-symbol').length>2);
    const n=await puzzle.locator('[data-puzzle-board] .rpchess-piece-symbol').count();
    await checkSymbols(puzzle,'[data-puzzle-board]',n);
    const puzzleSwitch=puzzle.locator('[data-puzzle-screen] .puzzle-layout > .puzzle-panel:first-child [data-board-view-switch]');
    assert.equal(await puzzleSwitch.count(),1,'Training has its own left-panel switch');
    assert.equal(await puzzleSwitch.isChecked(),true);
    await puzzleSwitch.uncheck();
    assert.equal(await puzzle.locator('html').getAttribute('data-simple-pieces'),'0');
    await puzzleSwitch.check();
    await checkSymbols(puzzle,'[data-puzzle-board]',n);
    assert.deepEqual(puzzleErrors,[]);
    console.log('Fantasy chess pieces: SVG motion/captures/promotion, live toggles (shared combats, Arena, Training), settings sync/reload, drag and portrait: PASS');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
