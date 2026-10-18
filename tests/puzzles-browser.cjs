const assert=require('assert'),{chromium}=require('playwright'),{startNewRun}=require('./browser-test-helpers.cjs');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173',RUN_KEY='rpchess.reboot.v1.run';
const mate1Route={id:'manual.puzzle.mate1',step:1,type:'puzzle',label:'ЗАДАЧА',stars:1,threatLabel:'СЛОЖНОСТЬ ★1',flavor:'На дороге обнаружена позиция, требующая точного решения.',mechanicalHint:'Шахматная задача с конкретной целью.',seed:'manual-puzzle-mate1',supplyCostAtSelection:1,supplyPaid:1};
const mate2Route={id:'manual.puzzle.resume',step:17,type:'puzzle',label:'ЗАДАЧА',stars:3,threatLabel:'СЛОЖНОСТЬ ★3',flavor:'Древний механизм ждёт точного решения.',mechanicalHint:'Шахматная задача с конкретной целью.',seed:'manual-puzzle-resume',supplyCostAtSelection:1,supplyPaid:1};

async function fresh(page,runId){
  await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate(k=>localStorage.removeItem(k),RUN_KEY);
  await page.reload({waitUntil:'networkidle'});
  await startNewRun(page);
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
  await page.locator('[data-puzzle-outcome]:not([hidden])').waitFor();assert.strictEqual((await page.locator('[data-puzzle-outcome-title]').innerText()).trim(),'РЕШЕНО');assert((await page.locator('[data-puzzle-outcome-gold]').innerText()).includes('+8'),'★1 with one error must visibly show the 8 Gold reward amount');
  const solved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),RUN_KEY);assert.strictEqual(solved.currentPuzzle.result,'solved');assert.strictEqual(solved.currentPuzzle.errors,1);assert.strictEqual(solved.currentPuzzle.goldReward,8);assert.strictEqual(solved.currentPuzzle.rewardSettled,true);assert.strictEqual(solved.gold,88);assert.strictEqual(solved.lastPuzzle.goldReward,8);
  const settledSnapshot=JSON.stringify({gold:solved.gold,currentPuzzle:solved.currentPuzzle,lastPuzzle:solved.lastPuzzle,puzzleHistory:solved.puzzleHistory});await page.reload({waitUntil:'networkidle'});await page.locator('[data-continue-run]').click();await page.locator('[data-roster-screen]:not([hidden])').waitFor();await page.locator('[data-roster-travel]').click();await page.locator('[data-puzzle-outcome]:not([hidden])').waitFor();assert.strictEqual(await page.locator('[data-puzzle-roster]').count(),0,'obsolete Puzzle Roster shortcut must remain absent after reload');const settledReload=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),RUN_KEY);assert.strictEqual(JSON.stringify({gold:settledReload.gold,currentPuzzle:settledReload.currentPuzzle,lastPuzzle:settledReload.lastPuzzle,puzzleHistory:settledReload.puzzleHistory}),settledSnapshot,'reload after solved Puzzle must not duplicate Gold or lose history');await page.locator('[data-puzzle-continue]').click();await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();const continued=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),RUN_KEY);assert.strictEqual(continued.currentPuzzle,null);assert.strictEqual(continued.activeTravelChoice,null);assert(Array.isArray(continued.currentTravelChoices)&&continued.currentTravelChoices.length===3);
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
  const pendingReply={routeId:mate2Route.id,puzzleId:'puzzle.001Wz',stars:3,week:17,currentFen:'3R2k1/5ppp/r1p5/p1n1rP2/8/2P2N1P/2P3P1/6K1 b - - 2 22',solutionIndex:1,errors:0,resolved:false,result:null,goldReward:0,rewardSettled:false};await seedPuzzleRoute(resume,mate2Route,pendingReply);await resume.reload({waitUntil:'networkidle'});await resume.locator('[data-continue-run]').click();await resume.locator('[data-roster-screen]:not([hidden])').waitFor();await resume.locator('[data-roster-travel]').click();await resume.locator('[data-puzzle-screen]:not([hidden])').waitFor();assert.strictEqual(await resume.locator('[data-puzzle-roster]').count(),0,'obsolete Puzzle Roster shortcut must stay absent in resumed Puzzle');await resume.waitForFunction(k=>{const run=JSON.parse(localStorage.getItem(k));return run?.currentPuzzle?.solutionIndex===2;},RUN_KEY);const resumed=await resume.evaluate(k=>JSON.parse(localStorage.getItem(k)).currentPuzzle,RUN_KEY);assert.strictEqual(resumed.solutionIndex,2,'reload on opponent turn must auto-play exactly one persisted forced reply');assert.strictEqual(resumed.currentFen,'3Rr1k1/5ppp/r1p5/p1n2P2/8/2P2N1P/2P3P1/6K1 w - - 3 23');await clickMove(resume,'d8','e8');await resume.locator('[data-puzzle-outcome]:not([hidden])').waitFor();const resumedSolved=await resume.evaluate(k=>JSON.parse(localStorage.getItem(k)),RUN_KEY);assert.strictEqual(resumedSolved.currentPuzzle.result,'solved');assert.strictEqual(resumedSolved.currentPuzzle.goldReward,18);assert.strictEqual(resumedSolved.currentPuzzle.rewardSettled,true);

  const mobile=await browser.newPage({viewport:{width:844,height:390}}),mobileErrors=[];mobile.on('pageerror',e=>mobileErrors.push(String(e.stack||e)));await fresh(mobile,'puzzles-browser-mobile');await seedPuzzleRoute(mobile,mate1Route);await mobile.locator('[data-roster-travel]').click();await mobile.locator('[data-puzzle-screen]:not([hidden])').waitFor();assert.strictEqual(await mobile.locator('[data-puzzle-roster]').count(),0,'obsolete Puzzle Roster shortcut must stay absent on landscape mobile');assert.strictEqual(await mobile.locator('[data-puzzle-board] [data-square]').count(),64);assert.strictEqual(await mobile.locator('[data-puzzle-board] .puzzle-coordinate--file').count(),8);assert.strictEqual(await mobile.locator('[data-puzzle-board] .puzzle-coordinate--rank').count(),8);const layout=await mobile.evaluate(()=>{const rect=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null},board=document.querySelector('[data-puzzle-board]'),panel=document.querySelector('.puzzle-layout>.puzzle-panel:first-child'),screen=document.querySelector('[data-puzzle-screen]');return{sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight,screen:rect(screen),board:rect(board),panel:rect(panel),panelScrollHeight:panel?.scrollHeight||0,panelClientHeight:panel?.clientHeight||0,panelOverflowY:panel?getComputedStyle(panel).overflowY:''};});assert(layout.sw<=layout.cw+1,`Puzzle landscape-mobile must not overflow horizontally: ${layout.sw}/${layout.cw}`);assert(layout.sh<=layout.ch+1,`Puzzle landscape-mobile must not page-scroll: ${layout.sh}/${layout.ch}`);const inside=box=>box&&box.left>=-1&&box.right<=layout.cw+1&&box.top>=-1&&box.bottom<=layout.ch+1;assert(inside(layout.screen)&&inside(layout.board)&&inside(layout.panel),'Puzzle screen, board and information frame must stay inside the viewport');assert(Math.abs(layout.board.width-layout.board.height)<=2,'Puzzle board must remain square');assert(Math.abs(layout.board.height-layout.ch)<=2&&Math.abs(layout.board.right-layout.cw)<=1,'Puzzle board must use full viewport height and touch the right edge');if(layout.panelScrollHeight>layout.panelClientHeight+1)assert(['auto','scroll'].includes(layout.panelOverflowY),'overflowing Puzzle copy must scroll inside the information frame');

  // Long translated objectives must remain readable even on the shortest landscape phones.
  for (const size of [{width:844,height:390},{width:667,height:300}]) {
    await mobile.setViewportSize(size);
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

  assert.deepStrictEqual(errors,[]);assert.deepStrictEqual(resumeErrors,[]);assert.deepStrictEqual(mobileErrors,[]);console.log('Puzzles identity flow, catalog-derived move acceptance, accepted hidden source attribution, canonical wrong-move/resume state, removed obsolete Roster shortcut, compact hidden status, no-repeat history, reward/idempotency, reload resume and landscape-mobile one-screen acceptance: PASS');
}finally{await browser.close();}})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
