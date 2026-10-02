const assert=require('assert');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const fen='7k/8/3p4/3p4/3p4/3P4/3R1p2/3K4 w - - 0 1';
const key='rpchess.reboot.v1.run';
async function glow(page,selector){
  await page.locator(selector+' [data-square="d2"]').click();
  await page.waitForFunction(selector=>document.querySelector(selector+' [data-square="d6"]')?.dataset.visionDepth==='3',selector);
  const result=await page.locator(selector).evaluate(board=>Object.fromEntries([...board.querySelectorAll('[data-vision-depth]')].map(c=>[c.dataset.square,c.dataset.visionDepth])));
  assert.deepStrictEqual(result,{d6:'3',d5:'2',d4:'1',f2:'1'});
  const css=await page.locator(selector+' [data-square="d6"]').evaluate(c=>({mask:getComputedStyle(c,'::after').maskImage,color:getComputedStyle(c,'::after').backgroundColor,pointer:getComputedStyle(c,'::after').pointerEvents}));
  assert(css.mask.includes('aura_red.png')&&css.color==='rgb(255, 144, 38)');assert.strictEqual(css.pointer,'none');
  await page.screenshot({path:'/tmp/rpchess-vision-'+(selector.includes('arena')?'arena':'journey')+'.png'});
  await page.locator(selector+' [data-square="d2"]').click();
  await page.waitForFunction(selector=>!document.querySelector(selector+' [data-vision-depth]'),selector);
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    for(const type of ['battle','skirmish','caravan']){
      const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url,{waitUntil:'networkidle'});assert.strictEqual(await page.locator('[data-new-game]').innerText(),'Новое Путешествие');
      await startNewRun(page);
      await page.evaluate(async({type,key})=>{
        const {createTravelChoices}=await import('./js/travel-choice-core.mjs');
        const {readRun,writeRun}=await import('./js/run-persistence.mjs');
        const run=readRun();writeRun({...run,artifacts:{'vision.piercing':2},currentTravelChoices:createTravelChoices({runId:run.id,types:[type],step:1}).map(c=>({...c,playerColor:'w',enemyColor:'b'})),activeTravelChoice:null});
        dispatchEvent(new CustomEvent('rpchess:run-updated'));
      },{type,key});
      await page.locator('[data-roster-travel]').click();await page.locator(`[data-travel-type="${type}"]`).first().click();
      await page.locator(type==='skirmish'?'[data-skirmish-start]':'[data-battle-start]').click();
      await page.setViewportSize({width:667,height:375});
      await page.locator('[data-artifact-choice="vision.piercing"]').waitFor();
      const panel=await page.locator('.artifact-choice-panel').boundingBox();assert(panel.x>=0&&panel.x+panel.width<=668&&panel.y>=0&&panel.y+panel.height<=376);
      await page.locator('[data-artifact-choice="vision.piercing"]').click();
      await page.locator('[data-classic-screen]:not([hidden])').waitFor();
      const chosen=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.strictEqual(chosen.artifacts['vision.piercing'],1);
      // Reload actual match first, then use a diagnostic position for line/color checks.
      await page.reload({waitUntil:'networkidle'});await page.locator('[data-continue-run]').click();await page.locator('[data-classic-screen]:not([hidden])').waitFor();
      assert.strictEqual(await page.locator('[data-artifact-choice-modal]').count(),0);assert.strictEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).artifacts['vision.piercing'],key),1);
      await page.setViewportSize({width:1440,height:900});
      await page.evaluate(fen=>window.RPChessClassicChess.loadFen(fen,{mode:'hotseat',playerColor:'w',blockedSquares:['d7']}),fen);
      await glow(page,'[data-chess-board]');
      // A checked enemy king keeps the red aura even when it is a vision target.
      await page.evaluate(()=>window.RPChessClassicChess.loadFen('3k4/8/8/8/8/8/3R4/3K4 b - - 0 1',{mode:'hotseat',playerColor:'w'}));
      const checked=await page.locator('[data-chess-board] [data-square="d8"]').evaluate(async cell=>{
        const {renderThreatOverlay}=await import('./js/artifact-combat-ui.mjs');const {artifactById}=await import('./js/artifact-core.mjs');
        renderThreatOverlay(document.querySelector('[data-chess-board]'),window.RPChessClassicChess.snapshot(),artifactById('vision.piercing'),'w','d2');
        return {check:cell.classList.contains('classic-square--check'),depth:cell.dataset.visionDepth,filter:getComputedStyle(cell,'::after').filter};
      });assert(checked.check&&!checked.depth&&checked.filter==='none');
      assert.deepStrictEqual(errors,[]);console.log(`${type}: selection, transparent blockers, colors, check priority, mobile choice and reload: PASS`);await page.close();
    }
    const page=await browser.newPage({viewport:{width:667,height:375}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url,{waitUntil:'networkidle'});
    await page.evaluate(async()=>{
      const {ARTIFACTS,combatArtifactOffer}=await import('./js/artifact-core.mjs');const a=await import('./js/arena-core.mjs');
      let id;for(let i=0;i<50;i++)if(combatArtifactOffer(ARTIFACTS,'vision-'+i).some(a=>a.id==='vision.piercing')){id='vision-'+i;break;}
      let state=a.emptyArena();state.events=[{id:'test-reward',kind:'win',foe:a.OPPONENTS[0].id,amount:30,at:1}];state=a.newMatch(state,a.OPPONENTS[0].id,id,'w');
      localStorage.setItem(a.ARENA_KEY,JSON.stringify(state));window.RPChessArena.enter();
    });
    assert.strictEqual(await page.locator('[data-arena-action="artifact"]').count(),4);
    await page.locator('[data-artifact="vision.piercing"]').click();assert.strictEqual(await page.evaluate(()=>window.RPChessArena.state.match.artifactId),'vision.piercing');
    await page.reload({waitUntil:'networkidle'});await page.locator('[data-arena-open]').click();assert.strictEqual(await page.evaluate(()=>window.RPChessArena.state.match.artifactId),'vision.piercing');
    await page.setViewportSize({width:1440,height:900});await page.evaluate(fen=>window.RPChessArena.engine.reset(fen),fen);
    // Click uses the real Arena renderer and selected-square state.
    await glow(page,'[data-arena-board]');assert.deepStrictEqual(errors,[]);console.log('Arena: three random cards, purchase, resume and real board overlay: PASS');await page.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
