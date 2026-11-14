const assert=require('assert'),{chromium}=require('playwright'),{startNewRun}=require('./browser-test-helpers.cjs');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173',RUN_KEY='rpchess.reboot.v1.run';
const mate1Route={id:'manual.puzzle.mate1',step:1,type:'puzzle',label:'ЗАДАЧА',stars:1,threatLabel:'СЛОЖНОСТЬ ★1',flavor:'На дороге обнаружена позиция, требующая точного решения.',mechanicalHint:'Шахматная задача с конкретной целью.',seed:'manual-puzzle-mate1',supplyCostAtSelection:1,supplyPaid:1};
const mate2Route={id:'manual.puzzle.resume',step:17,type:'puzzle',label:'ЗАДАЧА',stars:3,threatLabel:'СЛОЖНОСТЬ ★3',flavor:'Древний механизм ждёт точного решения.',mechanicalHint:'Шахматная задача с конкретной целью.',seed:'manual-puzzle-resume',supplyCostAtSelection:1,supplyPaid:1};

async function fresh(page,runId,{legacyTravel=true}={}){
  await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate(k=>localStorage.removeItem(k),RUN_KEY);
  await page.reload({waitUntil:'networkidle'});
  await startNewRun(page,{legacyTravel});
  await page.evaluate(({k,runId})=>{const r=JSON.parse(localStorage.getItem(k));r.id=runId;r.currentTravelChoices=null;r.activeTravelChoice=null;r.currentPuzzle=null;r.lastPuzzle=null;r.puzzleHistory=[];localStorage.setItem(k,JSON.stringify(r));dispatchEvent(new CustomEvent('rpchess:run-updated'));},{k:RUN_KEY,runId});
}

async function seedPuzzleRoute(page,route,currentPuzzle=null){
  await page.evaluate(({k,route,currentPuzzle})=>{const r=JSON.parse(localStorage.getItem(k));r.supplies=9;r.journeyStep=route.step;r.currentTravelChoices=null;r.activeTravelChoice=route;r.currentPuzzle=currentPuzzle;if(currentPuzzle?.puzzleId)r.puzzleHistory=[...new Set([...(r.puzzleHistory||[]),currentPuzzle.puzzleId])];localStorage.setItem(k,JSON.stringify(r));dispatchEvent(new CustomEvent('rpchess:run-updated'));},{k:RUN_KEY,route,currentPuzzle});
}

async function selectedPuzzleMoves(page){
  return page.evaluate(async k=>{
    const run=JSON.parse(localStorage.getItem(k)),state=run?.currentPuzzle;
    const [{loadPuzzleStar},{ClassicChessEngine}]=await Promise.all([import('./js/puzzles/puzzle-catalog-loader.mjs'),import('./js/classic-chess-engine.mjs')]);
    const puzzle=(await loadPuzzleStar(state.stars)).find(item=>item.id===state?.puzzleId);
    if(!puzzle)throw new Error(`Selected Puzzle fixture missing: ${state?.puzzleId||'none'}`);
    const correctUci=String(puzzle.solution?.[0]||'').toLowerCase();
    if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(correctUci))throw new Error(`Selected Puzzle solution invalid: ${correctUci}`);
    const engine=new ClassicChessEngine(state.currentFen);
    const wrong=engine.legalMoves().find(move=>{
      if(move.promotion)return false;
      const uci=`${move.from}${move.to}${move.promotion||''}`.toLowerCase();
      if(uci===correctUci)return false;
      const probe=new ClassicChessEngine(state.currentFen),result=probe.move(move.from,move.to,move.promotion||null);
      return result.ok&&!(result.status.type==='checkmate'&&result.status.winner===puzzle.side);
    });
    if(!wrong)throw new Error(`Selected Puzzle has no non-mating legal wrong move: ${puzzle.id}`);
    return{id:puzzle.id,type:puzzle.type,solution:puzzle.solution,correct:{from:correctUci.slice(0,2),to:correctUci.slice(2,4),promotion:correctUci.slice(4,5)||null},wrong:{from:wrong.from,to:wrong.to}};
  },RUN_KEY);
}

async function clickMove(page,from,to,promotion=null){
  await page.locator(`[data-puzzle-board] [data-square="${from}"]`).click();
  await page.locator(`[data-puzzle-board] [data-square="${to}"]`).click();
  if(promotion){
    const labels={q:'Ферзь',r:'Ладья',b:'Слон',n:'Конь'},panel=page.locator('[data-puzzle-promotion]:not([hidden])');
    await panel.waitFor();
    await panel.getByRole('button',{name:labels[promotion]||promotion.toUpperCase()}).click();
  }
}

(async()=>{const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));
  await fresh(page,'puzzles-browser-mate1');await seedPuzzleRoute(page,mate1Route);await page.locator('[data-roster-travel]').click();
  const screen=page.locator('[data-puzzle-screen]:not([hidden])');await screen.waitFor();await page.waitForFunction(()=>document.body.classList.contains('compact-puzzle-active'));

  // Desktop regression: compact-puzzle-active has a historical nested grid at
  // widths >=901px. Check the real desktop screenshot size, not only phones.
  for(const viewport of [{width:1919,height:907},{width:1440,height:900},{width:1280,height:720},{width:1024,height:768}]){
    await page.setViewportSize(viewport);
    const geo=await page.evaluate(()=>{
      const box=selector=>{
        const node=document.querySelector(selector),rect=node?.getBoundingClientRect();
        return rect?{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,
          width:rect.width,height:rect.height}:null;
      };
      return {board:box('[data-puzzle-board]'),panel:box('.puzzle-layout>.puzzle-panel:first-child'),
        settings:box('[data-puzzle-settings]'),layout:getComputedStyle(document.querySelector('.puzzle-layout')).display,
        screen:box('[data-puzzle-screen]'),viewport:[innerWidth,innerHeight]};
    });
    const {board,panel,settings,viewport:[width,height]}=geo;
    assert(geo.layout==='contents',`Training compact desktop must flatten legacy nested grid: ${JSON.stringify(geo)}`);
    assert(board&&panel&&settings&&Math.abs(board.width-board.height)<=2&&board.height<=height+1,
      `Training board must remain square and fit viewport ${width}x${height}: ${JSON.stringify(geo)}`);
    assert(Math.abs((board.left+board.right)/2-width/2)<=2 &&
      Math.abs((board.top+board.bottom)/2-height/2)<=2,
      `Training board must center on FULL desktop viewport ${width}x${height}: ${JSON.stringify(geo)}`);
    assert(panel.right<=board.left-4&&settings.right<=board.left-4&&panel.left>=-1,
      `Training information and settings must not overlap board ${width}x${height}: ${JSON.stringify(geo)}`);
  }
  await page.setViewportSize({width:1440,height:900});
  assert.strictEqual(await page.locator('[data-puzzle-roster]').count(),0,'obsolete Puzzle Roster shortcut must be absent from the runtime DOM');
  assert((await page.locator('[data-puzzle-objective]').innerText()).trim().length>3,'all curated puzzle types must render a localized objective');
  assert.strictEqual((await page.locator('[data-puzzle-stars]').innerText()).replace(/\s/g,''),'★');
  assert(!(await screen.innerText()).includes('Lichess Open Database · CC0'),'accepted Puzzle gameplay UI must keep source attribution out of the visible gameplay panel');
  // Playwright isVisible() treats clipped 1px semantic live regions as visible.
  // Check the intended accessible visually-hidden CSS rather than display visibility.
  const statusStyle=await page.locator('[data-puzzle-status]').evaluate(node=>{
    const css=getComputedStyle(node);
    return {position:css.position,overflow:css.overflow,clipPath:css.clipPath,whiteSpace:css.whiteSpace,ariaLive:node.getAttribute('aria-live')};
  });
  assert(statusStyle.position==='absolute'&&statusStyle.overflow==='hidden'&&statusStyle.clipPath==='inset(50%)'&&statusStyle.whiteSpace==='nowrap'&&statusStyle.ariaLive==='polite',
    'compact Puzzle status must remain an accessible live region clipped from visual layout: '+JSON.stringify(statusStyle));
  assert.strictEqual(await page.locator('[data-puzzle-board] [data-square]').count(),64);
  const pieceSources=await page.locator('[data-puzzle-board] img.puzzle-piece').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')));assert(pieceSources.length>0);assert(pieceSources.every(src=>src&&src.includes('assets/races/humans/pieces/board/')),'Puzzle board must use readable color-specific chess pieces');assert(pieceSources.every(src=>!src.includes('/assets/heroes/')),'Puzzle board must not use named hero portraits');
  assert.strictEqual(await page.locator('[data-puzzle-board] .puzzle-piece-marker').count(),pieceSources.length,'every occupied Puzzle square must expose a technical chess glyph');assert.strictEqual(await page.locator('[data-puzzle-board] .puzzle-coordinate--file').count(),8,'Puzzle board must show all eight file coordinates');assert.strictEqual(await page.locator('[data-puzzle-board] .puzzle-coordinate--rank').count(),8,'Puzzle board must show all eight rank coordinates');
  const opened=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),RUN_KEY),moves=await selectedPuzzleMoves(page);assert(['mate1','mate2','mate3','mate4','mate5Plus','material','bestLine'].includes(moves.type),'★1 acceptance must load a valid curated goal');assert.strictEqual(opened.currentPuzzle.puzzleId,moves.id);assert(Array.isArray(opened.puzzleHistory)&&opened.puzzleHistory.includes(opened.currentPuzzle.puzzleId),'opened Puzzle must be recorded in persistent no-repeat history');
  const themePresentation=await page.evaluate(async key=>{
    const run=JSON.parse(localStorage.getItem(key));
    const [{loadPuzzleStar},{featuredPuzzleTheme}]=await Promise.all([
      import('./js/puzzles/puzzle-catalog-loader.mjs'),import('./js/puzzles/puzzle-theme-catalog.mjs')
    ]);
    const row=(await loadPuzzleStar(run.currentPuzzle.stars)).find(p=>p.id===run.currentPuzzle.puzzleId);
    const featured=featuredPuzzleTheme(row,'ru');
    const screen=document.querySelector('[data-puzzle-screen]');
    return {theme:featured?.key||'',label:featured?.label.toLocaleUpperCase('ru')||'',
      kicker:screen.querySelector('[data-puzzle-kicker]')?.textContent||'',dataset:screen.dataset.puzzleTheme||''};
  },RUN_KEY);
  assert.strictEqual(themePresentation.dataset,themePresentation.theme,
    'Puzzle screen must expose its genuine source theme, not an inferred motif');
  if(themePresentation.theme)assert(themePresentation.kicker.includes(themePresentation.label),
    'Puzzle headline must present the localized Lichess theme beside the existing objective');
  const firstPuzzleId=opened.currentPuzzle.puzzleId;
  const beforeWrong=opened.currentPuzzle;await clickMove(page,moves.wrong.from,moves.wrong.to);await page.waitForFunction(k=>{const run=JSON.parse(localStorage.getItem(k));return run?.currentPuzzle?.errors===1;},RUN_KEY);const afterWrong=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).currentPuzzle,RUN_KEY);assert.strictEqual(afterWrong.errors,1);assert.strictEqual(afterWrong.currentFen,beforeWrong.currentFen,'wrong move must not advance the persisted position');assert.strictEqual(afterWrong.solutionIndex,0);
  const dragFrom=await page.locator(`[data-puzzle-board] [data-square="${moves.correct.from}"]`).boundingBox();
  const dragTo=await page.locator(`[data-puzzle-board] [data-square="${moves.correct.to}"]`).boundingBox();
  await page.mouse.move(dragFrom.x+dragFrom.width/2,dragFrom.y+dragFrom.height/2);
  await page.mouse.down();
  await page.mouse.move(dragTo.x+dragTo.width/2,dragTo.y+dragTo.height/2,{steps:8});
  await page.mouse.up();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.currentPuzzle?.solutionIndex>=1,RUN_KEY);
  assert.strictEqual(await page.locator('.rpchess-piece-drag-ghost').count(),0,'drag preview must be removed after drop');
  if(moves.correct.promotion){
    const names={q:'Ферзь',r:'Ладья',b:'Слон',n:'Конь'};
    await page.locator('[data-puzzle-promotion]:not([hidden])').getByRole('button',{name:names[moves.correct.promotion]}).click();
  }
  // New bestLine/mate4/mate5+ positions may require multiple correct replies:
  // play each authored player move after the engine has executed its opponent UCI.
  for(let index=2;index<moves.solution.length;index+=2){
    await page.waitForFunction(({key,index})=>{const state=JSON.parse(localStorage.getItem(key))?.currentPuzzle;return state?.solutionIndex>=index||state?.resolved;},{key:RUN_KEY,index});
    const move=moves.solution[index];await clickMove(page,move.slice(0,2),move.slice(2,4),move.slice(4)||null);
  }
  await page.locator('[data-puzzle-outcome]:not([hidden])').waitFor();
  await page.setViewportSize({width:844,height:390});
  const solvedFit=await page.evaluate(()=>{
    const gold=document.querySelector('[data-puzzle-outcome-gold]')?.getBoundingClientRect(),
      button=document.querySelector('[data-puzzle-continue]')?.getBoundingClientRect();
    return {gold:{top:gold.top,bottom:gold.bottom,right:gold.right},button:{top:button.top,bottom:button.bottom,left:button.left},viewHeight:innerHeight};
  });
  assert(solvedFit.gold.bottom+1<=solvedFit.button.top,
    `Training Gold must sit wholly above Continue on mobile: ${JSON.stringify(solvedFit)}`);
  await page.locator('[data-game-loading]').waitFor({state:'hidden',timeout:25000});
  await page.evaluate(()=>document.fonts.ready);
  if(process.env.RPCHESS_MOBILE_POLISH_SCREENSHOT_DIR){
    const fs=require('node:fs'),dir=process.env.RPCHESS_MOBILE_POLISH_SCREENSHOT_DIR;
    fs.mkdirSync(dir,{recursive:true});
    await page.screenshot({path:require('node:path').join(dir,'03-training-reward-mobile.png')});
  }
  await page.setViewportSize({width:1440,height:900});
  assert.strictEqual((await page.locator('[data-puzzle-outcome-title]').innerText()).trim(),'РЕШЕНО');assert((await page.locator('[data-puzzle-outcome-gold]').innerText()).includes('+8'),'★1 with one error must visibly show the 8 Gold reward amount');
  const solved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),RUN_KEY);assert.strictEqual(solved.currentPuzzle.result,'solved');assert.strictEqual(solved.currentPuzzle.errors,1);assert.strictEqual(solved.currentPuzzle.goldReward,8);assert.strictEqual(solved.currentPuzzle.rewardSettled,true);assert.strictEqual(solved.gold,88);assert.strictEqual(solved.lastPuzzle.goldReward,8);
  const settledSnapshot=JSON.stringify({gold:solved.gold,currentPuzzle:solved.currentPuzzle,lastPuzzle:solved.lastPuzzle,puzzleHistory:solved.puzzleHistory});await page.reload({waitUntil:'networkidle'});await page.locator('[data-continue-run]').click();await page.locator('[data-journey-choice-modal]:not([hidden]) [data-journey-continue]').click();await page.locator('[data-roster-screen]:not([hidden])').waitFor();await page.locator('[data-roster-travel]').click();await page.locator('[data-puzzle-outcome]:not([hidden])').waitFor();assert.strictEqual(await page.locator('[data-puzzle-roster]').count(),0,'obsolete Puzzle Roster shortcut must remain absent after reload');const settledReload=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),RUN_KEY);assert.strictEqual(JSON.stringify({gold:settledReload.gold,currentPuzzle:settledReload.currentPuzzle,lastPuzzle:settledReload.lastPuzzle,puzzleHistory:settledReload.puzzleHistory}),settledSnapshot,'reload after solved Puzzle must not duplicate Gold or lose history');await page.locator('[data-puzzle-continue]').click();await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();const continued=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),RUN_KEY);assert.strictEqual(continued.currentPuzzle,null);assert.strictEqual(continued.activeTravelChoice,null);assert(Array.isArray(continued.currentTravelChoices)&&continued.currentTravelChoices.length===3);
  await page.evaluate(({k,route})=>{const r=JSON.parse(localStorage.getItem(k));r.currentTravelChoices=null;r.activeTravelChoice={...route,id:'manual.puzzle.mate1.second',seed:'manual-puzzle-mate1-second'};r.currentPuzzle=null;localStorage.setItem(k,JSON.stringify(r));dispatchEvent(new CustomEvent('rpchess:puzzle-open',{detail:{choice:r.activeTravelChoice}}));},{k:RUN_KEY,route:mate1Route});await page.locator('[data-puzzle-screen]:not([hidden])').waitFor();const secondPuzzle=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),RUN_KEY);assert.notStrictEqual(secondPuzzle.currentPuzzle.puzzleId,firstPuzzleId,'successive Puzzle routes must not repeat a task before catalog exhaustion');assert.strictEqual(new Set(secondPuzzle.puzzleHistory).size,2);

  // Regression: history must retain newly curated shard IDs and other-star IDs,
  // even though neither belongs to the original embedded 11,498 catalog.
  const previousShardId=await page.evaluate(async k=>{
    const {loadPuzzleStar}=await import('./js/puzzles/puzzle-catalog-loader.mjs');
    const [first,third]=await Promise.all([loadPuzzleStar(1),loadPuzzleStar(3)]);
    const shard=first.find(p=>p.id==='puzzle.04Vkq');
    const other=third.find(p=>p.id==='puzzle.001Wz');
    if(!shard||!other)throw new Error('Lichess expanded-shard regression fixtures unavailable');
    const r=JSON.parse(localStorage.getItem(k));
    const prior=[...new Set([...(r.puzzleHistory||[]),shard.id,other.id])];
    r.puzzleHistory=prior;
    r.currentPuzzle=null;
    r.currentTravelChoices=null;
    r.activeTravelChoice={...r.activeTravelChoice,id:'manual.puzzle.shards.history',seed:'puzzle-shards-history'};
    localStorage.setItem(k,JSON.stringify(r));
    dispatchEvent(new CustomEvent('rpchess:puzzle-open',{detail:{choice:r.activeTravelChoice}}));
    return {newId:shard.id,oldOtherStarId:other.id,prior};
  },RUN_KEY);
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.currentPuzzle?.routeId==='manual.puzzle.shards.history',RUN_KEY);
  const shardHistory=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),RUN_KEY);
  assert(shardHistory.puzzleHistory.includes(previousShardId.newId)&&shardHistory.puzzleHistory.includes(previousShardId.oldOtherStarId),'new shard and cross-star puzzle IDs must survive next route selection');
  assert.notStrictEqual(shardHistory.currentPuzzle.puzzleId,previousShardId.newId,'a previously seen expanded puzzle cannot repeat before its star pool is exhausted');

  const resume=await browser.newPage({viewport:{width:1440,height:900}}),resumeErrors=[];resume.on('pageerror',e=>resumeErrors.push(String(e.stack||e)));await fresh(resume,'puzzles-browser-resume');
  const pendingReply={routeId:mate2Route.id,puzzleId:'puzzle.001Wz',stars:3,week:17,currentFen:'3R2k1/5ppp/r1p5/p1n1rP2/8/2P2N1P/2P3P1/6K1 b - - 2 22',solutionIndex:1,errors:0,resolved:false,result:null,goldReward:0,rewardSettled:false};await seedPuzzleRoute(resume,mate2Route,pendingReply);await resume.reload({waitUntil:'networkidle'});await resume.locator('[data-continue-run]').click();await resume.locator('[data-journey-choice-modal]:not([hidden]) [data-journey-continue]').click();await resume.locator('[data-roster-screen]:not([hidden])').waitFor();await resume.locator('[data-roster-travel]').click();await resume.locator('[data-puzzle-screen]:not([hidden])').waitFor();assert.strictEqual(await resume.locator('[data-puzzle-roster]').count(),0,'obsolete Puzzle Roster shortcut must stay absent in resumed Puzzle');await resume.waitForFunction(k=>{const run=JSON.parse(localStorage.getItem(k));return run?.currentPuzzle?.solutionIndex===2;},RUN_KEY);const resumed=await resume.evaluate(k=>JSON.parse(localStorage.getItem(k)).currentPuzzle,RUN_KEY);assert.strictEqual(resumed.solutionIndex,2,'reload on opponent turn must auto-play exactly one persisted forced reply');assert.strictEqual(resumed.currentFen,'3Rr1k1/5ppp/r1p5/p1n2P2/8/2P2N1P/2P3P1/6K1 w - - 3 23');await clickMove(resume,'d8','e8');await resume.locator('[data-puzzle-outcome]:not([hidden])').waitFor();const resumedSolved=await resume.evaluate(k=>JSON.parse(localStorage.getItem(k)),RUN_KEY);assert.strictEqual(resumedSolved.currentPuzzle.result,'solved');assert.strictEqual(resumedSolved.currentPuzzle.goldReward,18);assert.strictEqual(resumedSolved.currentPuzzle.rewardSettled,true);

  const mobile=await browser.newPage({viewport:{width:844,height:390}}),mobileErrors=[];mobile.on('pageerror',e=>mobileErrors.push(String(e.stack||e)));await fresh(mobile,'puzzles-browser-mobile');await seedPuzzleRoute(mobile,mate1Route);await mobile.locator('[data-roster-travel]').click();await mobile.locator('[data-puzzle-screen]:not([hidden])').waitFor();assert.strictEqual(await mobile.locator('[data-puzzle-roster]').count(),0,'obsolete Puzzle Roster shortcut must stay absent on landscape mobile');assert.strictEqual(await mobile.locator('[data-puzzle-board] [data-square]').count(),64);assert.strictEqual(await mobile.locator('[data-puzzle-board] .puzzle-coordinate--file').count(),8);assert.strictEqual(await mobile.locator('[data-puzzle-board] .puzzle-coordinate--rank').count(),8);const layout=await mobile.evaluate(()=>{const rect=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null},board=document.querySelector('[data-puzzle-board]'),panel=document.querySelector('.puzzle-layout>.puzzle-panel:first-child'),screen=document.querySelector('[data-puzzle-screen]');return{sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight,screen:rect(screen),board:rect(board),panel:rect(panel),panelScrollHeight:panel?.scrollHeight||0,panelClientHeight:panel?.clientHeight||0,panelOverflowY:panel?getComputedStyle(panel).overflowY:''};});assert(layout.sw<=layout.cw+1,`Puzzle landscape-mobile must not overflow horizontally: ${layout.sw}/${layout.cw}`);assert(layout.sh<=layout.ch+1,`Puzzle landscape-mobile must not page-scroll: ${layout.sh}/${layout.ch}`);const inside=box=>box&&box.left>=-1&&box.right<=layout.cw+1&&box.top>=-1&&box.bottom<=layout.ch+1;assert(inside(layout.screen)&&inside(layout.board)&&inside(layout.panel),`Puzzle screen, board and information frame must stay inside the viewport: ${JSON.stringify(layout)}`);assert(Math.abs(layout.board.width-layout.board.height)<=2,`Puzzle board must remain square: ${JSON.stringify(layout)}`);assert(Math.abs((layout.board.left+layout.board.right)/2-layout.cw/2)<=2,
    `Training board must be centered against the full horizontal viewport: ${JSON.stringify(layout.board)}`);
  assert(layout.panel.right<=layout.board.left-4,'Training task panel must not overlap the centered board');
  assert(layout.board.height<=layout.ch+1 && layout.board.height>=Math.min(layout.ch,layout.cw-320)-2,
    'Training board must use available vertical room without sacrificing readable side panels');if(layout.panelScrollHeight>layout.panelClientHeight+1)assert(['auto','scroll'].includes(layout.panelOverflowY),'overflowing Puzzle copy must scroll inside the information frame');

  // Long translated objectives must remain readable even on the shortest landscape phones.
  for (const size of [{width:844,height:390},{width:667,height:300}]) {
    await mobile.setViewportSize(size);
    const geometry=await mobile.evaluate(()=>{
      const board=document.querySelector('[data-puzzle-board]')?.getBoundingClientRect();
      const panel=document.querySelector('.puzzle-layout>.puzzle-panel:first-child')?.getBoundingClientRect();
      const top=document.querySelector('.puzzle-topbar')?.getBoundingClientRect();
      return {x:board?(board.left+board.right)/2-innerWidth/2:999,
        sideGap:board&&panel?board.left-panel.right:-999,
        topGap:board&&top?board.left-top.right:-999};
    });
    assert(Math.abs(geometry.x)<=2&&geometry.sideGap>=4&&geometry.topGap>=4,
      `Training must preserve centered board, usable left frame and settings at ${size.width}x${size.height}: ${JSON.stringify(geometry)}`);
    const fit=await mobile.evaluate(async()=>{
      await document.fonts.ready;
      const label=document.querySelector('[data-puzzle-compact-objective-label]');
      const stars=document.querySelector('[data-puzzle-compact-stars]');
      const previous=label.textContent,results=[];
      for(const title of ['ЛУЧШЕЕ ПРОДОЛЖЕНИЕ','ВЫИГРАЙТЕ ♛','BEST CONTINUATION']){
        label.textContent=title;
        const rect=label.getBoundingClientRect(),starRect=stars.getBoundingClientRect(),css=getComputedStyle(label);
        results.push({title,whiteSpace:css.whiteSpace,fontSize:parseFloat(css.fontSize),
          scrollWidth:label.scrollWidth,clientWidth:label.clientWidth,
          scrollHeight:label.scrollHeight,clientHeight:label.clientHeight,
          overlapsStars:rect.right>starRect.left+1});
      }
      label.textContent=previous;
      return results;
    });
    for(const result of fit)assert(result.whiteSpace!=='nowrap'&&result.fontSize>=14&&result.scrollWidth<=result.clientWidth+2&&result.scrollHeight<=result.clientHeight+2&&!result.overlapsStars,
      `Puzzle objective must fit at ${size.width}×${size.height}: ${JSON.stringify(result)}`);
  }

  // Regression for a real CC0 Puzzle ending in f7f8q. The final move is
  // promoted while drag and native click can both dispatch the target square.
  const promotionPage=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
  const promotionErrors=[];promotionPage.on('pageerror',e=>promotionErrors.push(String(e.stack||e)));
  await fresh(promotionPage,'puzzles-browser-promotion');
  const queenRoute={...mate1Route,id:'manual.puzzle.promotion',seed:'manual-promotion',stars:1};
  const queenState=await promotionPage.evaluate(async route=>{
    const [{loadPuzzleStar},{ClassicChessEngine},{createPuzzleState}]=await Promise.all([
      import('./js/puzzles/puzzle-catalog-loader.mjs'),
      import('./js/classic-chess-engine.mjs'),
      import('./js/puzzles/puzzle-core.mjs')
    ]);
    const puzzle=(await loadPuzzleStar(1)).find(item=>item.id==='puzzle.07A4W');
    if(!puzzle||puzzle.solution.at(-1)!=='f7f8q')
      throw new Error('Confirmed CC0 promotion Puzzle fixture not found');
    const engine=new ClassicChessEngine(puzzle.fen);
    for(const uci of puzzle.solution.slice(0,-1)){
      const moved=engine.move(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null);
      if(!moved.ok)throw new Error('Illegal forced Puzzle move: '+uci);
    }
    return {...createPuzzleState({puzzle,routeId:route.id,stars:1,week:1}),
      solutionIndex:puzzle.solution.length-1,currentFen:engine.fen()};
  },queenRoute);
  await seedPuzzleRoute(promotionPage,queenRoute,queenState);
  await promotionPage.locator('[data-roster-travel]').click();
  await promotionPage.locator('[data-puzzle-screen]:not([hidden])').waitFor();
  await promotionPage.locator('[data-puzzle-board] [data-square="f7"]').click();
  const targetQueen=promotionPage.locator('[data-puzzle-board] [data-square="f8"]');
  await targetQueen.evaluate(node=>{node.click();node.click();});
  const promotionPanel=promotionPage.locator('[data-puzzle-promotion]:not([hidden])');
  await promotionPanel.waitFor();
  assert.equal(await promotionPanel.getByRole('button',{name:'Ферзь'}).count(),1,
    'duplicate click opens only one actionable queen choice');
  await promotionPanel.getByRole('button',{name:'Ферзь'}).click();
  await promotionPage.waitForFunction(key=>{
    const r=JSON.parse(localStorage.getItem(key));
    return r?.currentPuzzle?.resolved===true&&r.currentPuzzle.result==='solved';
  },RUN_KEY,{timeout:12000});
  assert.equal(await promotionPage.locator('[data-puzzle-promotion]:not([hidden])').count(),0,
    'one queen click closes promotion overlay after completing the task');
  assert.deepStrictEqual(promotionErrors,[]);
  await promotionPage.close();

  // Compare exactly the existing Puzzle screen with the weekly task UI.
  // The original header contains Settings only; every rectangle must keep
  // its original position at both desktop and landscape phone sizes.
  async function puzzleGeometry(p){
    await p.evaluate(()=>document.fonts.ready);
    return p.evaluate(()=>{
      const rect=selector=>{
        const node=document.querySelector(selector),r=node?.getBoundingClientRect();
        return r?{left:r.left,top:r.top,width:r.width,height:r.height}:null;
      };
      return{
        buttons:Array.from(document.querySelectorAll('.puzzle-topbar__actions>button'))
          .filter(button=>getComputedStyle(button).display!=='none').map(button=>button.textContent.trim()),
        board:rect('[data-puzzle-board]'),
        heading:rect('.puzzle-heading'),
        panel:rect('.puzzle-layout>.puzzle-panel:first-child'),
        settings:rect('[data-puzzle-settings]')
      };
    });
  }
  function assertSamePuzzleLayout(ordinary,weekly,viewport){
    assert.deepStrictEqual(weekly.buttons,ordinary.buttons,
      `${viewport}: weekly Puzzle must show precisely the original buttons`);
    for(const key of ['board','panel','settings']){
      assert(ordinary[key]&&weekly[key],`${viewport}: missing ${key} geometry`);
      for(const axis of ['left','top','width','height']){
        // Two different chess puzzles may have different instruction lengths.
        // The card's top/width, board and Settings must still remain identical.
        const tolerance=key==='panel'&&axis==='height'?32:3;
        assert(Math.abs(ordinary[key][axis]-weekly[key][axis])<=tolerance,
          `${viewport}: ${key}.${axis} differs from ordinary Puzzle: ${ordinary[key][axis]} / ${weekly[key][axis]}`);
      }
    }
  }
  await page.setViewportSize({width:1280,height:720});
  const ordinaryDesktop=await puzzleGeometry(page);
  await mobile.setViewportSize({width:844,height:390});
  const ordinaryMobile=await puzzleGeometry(mobile);

  // Weekly Puzzle at an owned completed road site: leave = forfeit, solve =
  // full shards with no gold, three wrong moves = zero and no second claim.
  const weeklyPage=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
  const weeklyErrors=[];weeklyPage.on('pageerror',e=>weeklyErrors.push(String(e.stack||e)));
  await fresh(weeklyPage,'puzzles-browser-weekly',{legacyTravel:false});
  await weeklyPage.locator('[data-roster-travel]').click();
  await weeklyPage.locator('[data-kingdom-map-screen]:not([hidden])').waitFor();
  async function seedWeekly(week){
    await weeklyPage.evaluate(async ({key,week})=>{
      const r=JSON.parse(localStorage.getItem(key));
      const {createTravelChoices}=await import('./js/travel-choice-core.mjs');
      const id='1,0',route={...createTravelChoices({runId:r.id,step:1,types:['puzzle'],playerPower:500})[0],
        id:'weekly-test-original',stars:1};
      r.activeTravelChoice=null;r.currentPuzzle=null;
      r.kingdomMap.cells[id]={...r.kingdomMap.cells[id],explored:true,annexed:true,
        status:'completed',completedOnce:true,selectedEncounter:route,
        production:{id:'production:'+id+':'+week+':shards',week,kind:'shards',amount:1}};
      r.kingdomMap.day=week*7;r.kingdomMap.processedThroughWeek=week;
      localStorage.setItem(key,JSON.stringify(r));
      globalThis.RPChessKingdomMap.open({detail:{source:'weekly-test'}});
    },{key:RUN_KEY,week});
    await weeklyPage.locator('[data-kingdom-collect="1,0"]').waitFor({state:'visible'});
    await weeklyPage.locator('[data-kingdom-collect="1,0"]').click();
    await weeklyPage.locator('[data-puzzle-screen]:not([hidden])').waitFor();
    const r=await weeklyPage.evaluate(key=>JSON.parse(localStorage.getItem(key)),RUN_KEY);
    assert.equal(r.currentPuzzle.weekly.week,week);
    assert.equal(r.currentPuzzle.goldReward,0);
    assert.equal(await weeklyPage.locator('.puzzle-topbar__actions > button').count(),1,
      'weekly Puzzle uses the exact original single Settings button');
    return r.currentPuzzle;
  }
  const balance=async()=>weeklyPage.evaluate(async()=>{
    const {ARENA_KEY,normalizeArena,arenaSummary}=await import('./js/arena-core.mjs');
    return arenaSummary(normalizeArena(JSON.parse(localStorage.getItem(ARENA_KEY)||'null'))).balance;
  });
  const initialBalance=await balance();
  const initialGold=(await weeklyPage.evaluate(key=>JSON.parse(localStorage.getItem(key)),RUN_KEY)).gold;
  const readWeeklyPower=()=>weeklyPage.evaluate(async()=>{
    const {readPlayerRating}=await import('./js/player-rating.mjs');
    return readPlayerRating().power;
  });
  const initialPower=await readWeeklyPower();
  const firstWeekly=await seedWeekly(1);
  const weeklyDesktop=await puzzleGeometry(weeklyPage);
  assertSamePuzzleLayout(ordinaryDesktop,weeklyDesktop,'1280x720');
  await weeklyPage.setViewportSize({width:844,height:390});
  const weeklyMobile=await puzzleGeometry(weeklyPage);
  assertSamePuzzleLayout(ordinaryMobile,weeklyMobile,'844x390');
  await weeklyPage.setViewportSize({width:1280,height:720});
  // A real exit (page unload / back to the map) forfeits the week, without
  // injecting a noncanonical "Leave task" button into the header.
  await weeklyPage.evaluate(()=>{
    dispatchEvent(new Event('pagehide'));
    globalThis.RPChessKingdomMap.open({detail:{source:'weekly-test-left-scene'}});
  });
  await weeklyPage.locator('[data-kingdom-map-screen]:not([hidden])').waitFor();
  assert.equal(await balance(),initialBalance,'exiting a weekly task forfeits the full reward');
  assert.equal(await readWeeklyPower(),initialPower,'abandonment must not raise weekly Puzzle Power');
  const exitRun=await weeklyPage.evaluate(key=>JSON.parse(localStorage.getItem(key)),RUN_KEY);
  assert(exitRun.kingdomMap.productionClaims.includes(firstWeekly.weekly.productionId),
    'abandoned weekly payout has a persistent spent receipt');
  const secondWeekly=await seedWeekly(2);
  assert.notEqual(secondWeekly.puzzleId,firstWeekly.puzzleId,'next week must use a new task at the same star level');
  const weeklyMoves=await selectedPuzzleMoves(weeklyPage);
  await clickMove(weeklyPage,weeklyMoves.wrong.from,weeklyMoves.wrong.to);
  assert((await weeklyPage.locator('[data-puzzle-current-reward]').innerText()).includes('1'),
    'weekly current-reward line preserves its full amount after an incorrect move');
  for(let n=0;n<6;n++){
    const snapshot=await weeklyPage.evaluate(key=>JSON.parse(localStorage.getItem(key))?.currentPuzzle,RUN_KEY);
    if(snapshot.resolved)break;
    const uci=weeklyMoves.solution[snapshot.solutionIndex];
    if(!uci)throw new Error('Weekly solution exhausted before success');
    await clickMove(weeklyPage,uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null);
    await weeklyPage.waitForFunction(({key,index})=>{
      const p=JSON.parse(localStorage.getItem(key))?.currentPuzzle;
      return p?.resolved||p?.solutionIndex>index;
    },{key:RUN_KEY,index:snapshot.solutionIndex},{timeout:12000});
  }
  await weeklyPage.locator('[data-puzzle-outcome]:not([hidden])').waitFor();
  await weeklyPage.waitForFunction(async expected=>{
    const {readPlayerRating}=await import('./js/player-rating.mjs');
    return readPlayerRating().power===expected;
  },initialPower+1,{timeout:12000});
  assert.strictEqual(await readWeeklyPower(),initialPower+1,
    'revisited one-star Puzzle grants exactly +1 Power, not the Elo-based +4');
  const powerReceipt=weeklyPage.locator('[data-puzzle-outcome] [data-power-result]:not([hidden])');
  await powerReceipt.waitFor({state:'visible'});
  assert((await powerReceipt.innerText()).includes('+1'),
    'weekly Puzzle result displays the +1 Power receipt');
  const shardReward=weeklyPage.locator('[data-puzzle-outcome-gold]');
  assert.equal((await shardReward.innerText()).trim(),'+1',
    'weekly payout result must show only +N, not written-out Honor shards');
  assert.equal(await shardReward.locator('img').getAttribute('src'),'assets/arena/mirror_shard.png',
    'weekly payout uses the canonical Honor shard icon');
  assert(await shardReward.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0),
    'Honor shard reward icon must load');
  assert.equal(await weeklyPage.locator('[data-puzzle-outcome-text]').isVisible(),false,
    'weekly results omit the misleading accuracy-based reward copy');
  assert.equal(await balance(),initialBalance+1,'successful weekly task adds exactly the full Honor shard payout');
  assert.equal((await weeklyPage.evaluate(key=>JSON.parse(localStorage.getItem(key)),RUN_KEY)).gold,initialGold,
    'weekly payout must never add normal Puzzle gold');
  await weeklyPage.locator('[data-puzzle-continue]').click();
  await weeklyPage.locator('[data-kingdom-map-screen]:not([hidden])').waitFor();
  assert.equal(await weeklyPage.locator('[data-kingdom-collect="1,0"]').count(),0,
    'already claimed weekly reward cannot be collected twice');
  await seedWeekly(3);
  const thirdMoves=await selectedPuzzleMoves(weeklyPage);
  for(let i=0;i<3;i++)await clickMove(weeklyPage,thirdMoves.wrong.from,thirdMoves.wrong.to);
  await weeklyPage.locator('[data-puzzle-outcome]:not([hidden])').waitFor();
  assert.equal(await balance(),initialBalance+1,'three wrong moves forfeit shards without reducing prior payout');
  assert.equal(await readWeeklyPower(),initialPower+1,'failed weekly Puzzle cannot add Power');
  assert.equal(await weeklyPage.locator('[data-puzzle-outcome] [data-power-result]:visible').count(),0,
    'failed weekly Puzzle must not leak the previous Power result');
  await weeklyPage.locator('[data-puzzle-continue]').click();
  await weeklyPage.locator('[data-kingdom-map-screen]:not([hidden])').waitFor();
  assert.deepStrictEqual(weeklyErrors,[]);
  await weeklyPage.close();

    assert.deepStrictEqual(errors,[]);assert.deepStrictEqual(resumeErrors,[]);assert.deepStrictEqual(mobileErrors,[]);console.log('Puzzles identity flow, catalog-derived move acceptance, accepted hidden source attribution, canonical wrong-move/resume state, removed obsolete Roster shortcut, compact hidden status, no-repeat history, reward/idempotency, reload resume and landscape-mobile one-screen acceptance: PASS');
}finally{await browser.close();}})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
