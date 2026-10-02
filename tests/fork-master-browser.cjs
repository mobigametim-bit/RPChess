const assert=require('assert');
const path=require('path');
const fs=require('fs');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const id='tactics.fork_master',key='rpchess.reboot.v1.run';
const colorsFen='7k/8/8/1r6/3N2p1/5q2/8/K7 w - - 0 1';
const futureFen='8/8/1r3k2/8/8/2N5/8/K7 w - - 0 1';
const screenshots=path.resolve(__dirname,'../test-results/fork-master');fs.mkdirSync(screenshots,{recursive:true});
async function load(page,fen,arena=false){
  await page.evaluate(({fen,arena})=>{
    if(arena)window.RPChessArena.engine.reset(fen);
    else window.RPChessClassicChess.loadFen(fen,{mode:'hotseat',playerColor:'w'});
  },{fen,arena});
}
async function verifyBoard(page,selector,label,arena=false){
  await load(page,colorsFen,arena);await page.locator(selector+' [data-square="d4"]').click();
  await page.waitForFunction(selector=>document.querySelector(selector+' [data-square="f3"]')?.dataset.forkTarget==='red',selector);
  const targets=await page.locator(selector).evaluate(board=>Object.fromEntries([...board.querySelectorAll('[data-fork-target]')].map(c=>[c.dataset.square,c.dataset.forkTarget])));
  assert.deepStrictEqual(targets,{b5:'green',f3:'red'});
  const visual=await page.locator(selector+' [data-square="f3"]').evaluate(c=>{
    const s=getComputedStyle(c.querySelector('.classic-fork-silhouette'));
    return {mask:s.maskImage,color:s.backgroundColor,animation:s.animationName,pointer:s.pointerEvents,glyph:!!c.querySelector('.classic-piece-marker'),source:new URL(c.querySelector('.classic-piece').getAttribute('src'),document.baseURI).href};
  });assert(visual.mask.includes(visual.source),JSON.stringify(visual));assert.strictEqual(visual.color,'rgb(255, 69, 69)');assert.strictEqual(visual.animation,'classic-fork-pulse');assert(visual.glyph&&visual.pointer==='none');
  await page.evaluate(()=>document.documentElement.dataset.reducedMotion='1');
  assert.strictEqual(await page.locator(selector+' .classic-fork-silhouette').first().evaluate(c=>getComputedStyle(c).animationName),'none');
  await page.evaluate(()=>delete document.documentElement.dataset.reducedMotion);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.strictEqual(await page.locator(selector+' .classic-fork-silhouette').first().evaluate(c=>getComputedStyle(c).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator(selector+' .classic-fork-silhouette').evaluateAll(nodes=>nodes.forEach(n=>n.getAnimations().forEach(a=>{a.pause();a.currentTime=800;})));
  await page.screenshot({path:path.join(screenshots,label+'-targets.png')});
  await page.locator(selector+' [data-square="d4"]').click();
  assert.strictEqual(await page.locator(selector+' .classic-fork-silhouette').count(),0);
  await load(page,futureFen,arena);await page.locator(selector+' [data-square="c3"]').click();
  await page.waitForFunction(selector=>document.querySelector(selector+' [data-square="d5"]')?.dataset.forkMove==='1',selector);
  const fork=await page.locator(selector+' [data-square="d5"]').evaluate(c=>{
    const s=getComputedStyle(c,'::before');return {image:s.backgroundImage,border:s.borderWidth,radius:s.borderRadius,pointer:s.pointerEvents,width:s.width,height:s.height};
  });assert(fork.image.includes('image/svg+xml'));assert.strictEqual(fork.border,'0px');assert.strictEqual(fork.radius,'0px');assert.strictEqual(fork.pointer,'none');assert.strictEqual(fork.width,fork.height);
  const normal=await page.locator(selector+' [data-square="b1"]').evaluate(c=>({fork:c.dataset.forkMove,background:getComputedStyle(c,'::before').backgroundImage}));
  assert(!normal.fork&&normal.background==='none','ordinary destination keeps normal circle');
  assert.strictEqual(await page.locator(selector+' .classic-fork-silhouette').count(),0,'future marker never previews victims');
  await page.screenshot({path:path.join(screenshots,label+'-arrows.png')});
  await page.locator(selector+' [data-square="d5"]').click();
  await page.waitForFunction(arena=>(arena?window.RPChessArena.engine.pieceAt('d5'):window.RPChessClassicChess.snapshot().board[35])?.type==='n',arena);
  assert.strictEqual(await page.locator(selector+' [data-fork-move]').count(),0,'move clears selection markers');
  assert(await page.locator(selector+' [data-square="f6"]').evaluate(c=>c.classList.contains('classic-square--check')),'checking fork keeps red check aura');
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    for(const type of ['battle','skirmish','caravan']){
      const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url,{waitUntil:'networkidle'});await startNewRun(page);
      await page.evaluate(async({type,id})=>{
        const {createTravelChoices}=await import('./js/travel-choice-core.mjs'),{readRun,writeRun}=await import('./js/run-persistence.mjs');
        const run=readRun();writeRun({...run,artifacts:{[id]:2},currentTravelChoices:createTravelChoices({runId:run.id,types:[type],step:1}).map(c=>({...c,playerColor:'w',enemyColor:'b'})),activeTravelChoice:null});
        dispatchEvent(new CustomEvent('rpchess:run-updated'));
      },{type,id});
      if(type==='caravan')await page.evaluate(async()=>{const i=await import('./js/i18n.mjs');i.setLanguage('en');});
      await page.locator('[data-roster-travel]').click();await page.locator(`[data-travel-type="${type}"]`).first().click();
      await page.locator(type==='skirmish'?'[data-skirmish-start]':'[data-battle-start]').click();
      await page.setViewportSize({width:667,height:375});const card=page.locator(`[data-artifact-choice="${id}"]`);await card.waitFor();
      assert((await card.innerText()).includes(type==='caravan'?'Fork Master':'Мастер вилок'));
      if(type==='caravan')assert(!/[А-Яа-яЁё]/.test(await card.innerText()),'English artifact card must not leak Russian');
      await page.evaluate(async()=>{const i=await import('./js/i18n.mjs');i.setLanguage('en');});
      // Current modal copy uses the selected locale on creation; core dictionary
      // still must supply complete English copy without Russian fallback.
      assert.strictEqual(await page.evaluate(async()=>{const i=await import('./js/i18n.mjs');return i.t('artifacts.forkMaster.name');}),'Fork Master');
      await page.evaluate(async()=>{const i=await import('./js/i18n.mjs');i.setLanguage('ru');});
      const panel=await page.locator('.artifact-choice-panel').boundingBox();assert(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=668&&panel.y+panel.height<=376);
      await card.click();await page.locator('[data-classic-screen]:not([hidden])').waitFor();
      assert.strictEqual(await page.evaluate(({key,id})=>JSON.parse(localStorage.getItem(key)).artifacts[id],{key,id}),1);
      await page.reload({waitUntil:'networkidle'});await page.locator('[data-continue-run]').click();await page.locator('[data-classic-screen]:not([hidden])').waitFor();
      assert.strictEqual(await page.locator('[data-artifact-choice-modal]').count(),0);
      assert.strictEqual(await page.evaluate(({key,id})=>JSON.parse(localStorage.getItem(key)).artifacts[id],{key,id}),1);
      await verifyBoard(page,'[data-chess-board]',type);
      await page.setViewportSize({width:1440,height:900});await load(page,colorsFen);await page.locator('[data-chess-board] [data-square="d4"]').click();
      await page.screenshot({path:path.join(screenshots,type+'-desktop.png')});
      assert.deepStrictEqual(errors,[]);console.log(`${type}: pulse masks/colors, fork replaces circle, click, check, mobile/RU/EN, reduced motion and resume: PASS`);await page.close();
    }
    const page=await browser.newPage({viewport:{width:667,height:375}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url,{waitUntil:'networkidle'});
    await page.evaluate(async id=>{
      const {ARTIFACTS,combatArtifactOffer}=await import('./js/artifact-core.mjs'),a=await import('./js/arena-core.mjs');let matchId;
      for(let i=0;i<60;i++)if(combatArtifactOffer(ARTIFACTS,'fork-'+i).some(x=>x.id===id)){matchId='fork-'+i;break;}
      let state=a.emptyArena();state.events=[{id:'reward',kind:'win',foe:a.OPPONENTS[0].id,amount:30,at:1}];state=a.newMatch(state,a.OPPONENTS[0].id,matchId,'w');localStorage.setItem(a.ARENA_KEY,JSON.stringify(state));window.RPChessArena.enter();
    },id);
    assert.strictEqual(await page.locator('[data-arena-action="artifact"]').count(),4);await page.locator(`[data-artifact="${id}"]`).click();
    assert.strictEqual(await page.evaluate(async()=>{const a=await import('./js/arena-core.mjs');return a.arenaSummary(window.RPChessArena.state).balance;}),23);
    await page.reload({waitUntil:'networkidle'});await page.locator('[data-arena-open]').click();assert.strictEqual(await page.evaluate(()=>window.RPChessArena.state.match.artifactId),id);
    await verifyBoard(page,'[data-arena-board]','arena',true);assert.deepStrictEqual(errors,[]);console.log('Arena: random offer, purchase/resume and real fork markers/silhouettes: PASS');await page.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
