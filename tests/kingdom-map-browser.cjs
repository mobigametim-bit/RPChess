const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const key='rpchess.reboot.v1.run';
const output=process.env.RPCHESS_KINGDOM_SCREENSHOT_DIR||'test-results/kingdom-map';
const read=page=>page.evaluate(storage=>JSON.parse(localStorage.getItem(storage)||'null'),key);
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  fs.mkdirSync(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await startNewRun(page,{playerName:'Kingdom Explorer',legacyTravel:false});
  // Force a real Battle followed by Skirmish to catch the original bug:
  // their engine encounter IDs differ from the route ID kept by the map.
  await page.evaluate(async storage=>{
    const {randomEncounter}=await import('./js/kingdom-map-core.mjs');
    const run=JSON.parse(localStorage.getItem(storage));
    let found=false;
    for(let i=0;i<1200;i++){
      const probe={...run,id:'kingdom-e2e-chain-'+i};
      if(randomEncounter(probe,{x:1,y:0},500).type==='battle'&&
         randomEncounter(probe,{x:0,y:1},500).type==='skirmish'){
        run.id=probe.id;found=true;break;
      }
    }
    if(!found)throw new Error('No deterministic battle/skirmish map fixture found');
    localStorage.setItem(storage,JSON.stringify(run));
  },key);
  await page.locator('[data-roster-travel]').click();
  await page.locator('[data-kingdom-map-screen]:not([hidden])').waitFor({timeout:20000});
  assert.equal(await page.locator('[data-travel-choice-screen]:not([hidden])').count(),0,
   'the old three-card choice is not the live Journey screen');
  assert.equal(await page.locator('[data-kingdom-cell]').count(),63);
  const before=await read(page);
  assert(before.kingdomMap&&before.kingdomMap.cells['0,0'].annexed);
  assert.deepEqual(before.kingdomMap.king,{x:0,y:0});
  assert.equal(await page.locator('[data-kingdom-cell="1,0"] .km-fog-mark').textContent(),'?');
  await page.screenshot({path:path.join(output,'kingdom-01-fog-start.png')});
  // Regression: the camera must not recenter on every click. Before the fix,
  // the clicked tile slid to the middle, making a different tile appear opened.
  const centers=async()=>page.evaluate(()=>{
    const center=selector=>{
      const r=document.querySelector(selector)?.getBoundingClientRect();
      return r?{x:(r.left+r.right)/2,y:(r.top+r.bottom)/2}:null;
    };
    return {castle:center('[data-kingdom-cell="0,0"]'),
      east:center('[data-kingdom-cell="1,0"]'),king:center('.km-king')};
  });
  const beforeCenters=await centers();
  const clicked=Date.now();
  await page.locator('[data-kingdom-cell="1,0"]').click();
  const moved=await read(page);
  const encounter=moved.kingdomMap.cells['1,0'].selectedEncounter;
  assert(encounter&&encounter.kingdomCell==='1,0','the selected coordinate gets exactly one saved route');
  assert(['battle','skirmish','caravan','event','settlement','puzzle'].includes(encounter.type));
  assert.deepEqual(moved.kingdomMap.king,{x:1,y:0});
  assert.equal(moved.kingdomMap.cells['1,0'].status,'revealed');
  assert.equal(moved.supplies,before.supplies,'moving and unveiling do not charge resources prematurely');
  assert.equal(await page.locator('[data-kingdom-cell="1,0"] .km-fog-mark').count(),0,
   'the fog opens before the encounter begins');
  const king=page.locator('.km-king--moving');
  assert.equal(await king.count(),1,'the king has an explicit motion animation');
  assert.equal(await king.evaluate(el=>getComputedStyle(el).animationName),'km-king-step');
  await page.waitForTimeout(550);
  const afterCenters=await centers();
  const near=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y)<4;
  assert(near(afterCenters.castle,beforeCenters.castle),
    'the castle must remain at the same screen position after moving one tile');
  assert(near(afterCenters.east,beforeCenters.east),
    'the clicked tile must remain at the same screen position');
  assert(near(afterCenters.king,afterCenters.east),
    'the king must visibly land on the exact clicked tile, not remain at the center');
  assert.equal(await page.locator('[data-kingdom-cell="1,0"].km-cell--here').count(),1,
    'the actual selected tile must be marked as the king position');
  assert.equal(await page.locator('[data-travel-choice]').count(),0,'no three-card popup appears');
  await page.waitForTimeout(1100);
  assert.equal((await read(page)).activeTravelChoice,null,'no encounter before the 2-second reveal');
  await page.screenshot({path:path.join(output,'kingdom-02-revealed.png')});
  await page.waitForFunction(k=>{
   const r=JSON.parse(localStorage.getItem(k)||'null');
   return r?.activeTravelChoice?.kingdomCell==='1,0'&&r?.kingdomMap?.cells?.['1,0']?.status==='in_progress';
  },key,{timeout:15000});
  const elapsed=Date.now()-clicked;
  assert(elapsed>=2300,'the user gets ~450ms king animation and two seconds of reveal before entering');
  const started=await read(page);
  assert.equal(started.activeTravelChoice.id,encounter.id);
  assert.equal(started.supplies,before.supplies-1,'the encounter takes supplies exactly once');
  assert.equal(started.kingdomMap.cells['1,0'].selectedEncounter.id,encounter.id);
  assert.equal(await page.locator('[data-kingdom-map-screen]:not([hidden])').count(),0,
   'the player is routed into an existing encounter owner');
  assert.deepEqual(errors,[],'map bootstrap/transition must not emit JavaScript errors');
  // A saved return from a failed fight must rewind the king and preserve the
  // original encounter. Emulate the existing owner result without replacing it.
  const kind=encounter.type;
  assert.equal(kind,'battle','first visit exercises real Battle encounter IDs');
  {
   await page.evaluate(async ({runKey,type,choice})=>{
    const {hashString}=await import('./js/race-assets.mjs');
    const run=JSON.parse(localStorage.getItem(runKey));
    const realEngineId=type+'-'+hashString(choice.seed).toString(36)+'-'+choice.stars;
    assertReceipt(realEngineId!==choice.id,'engine ID must differ from map route ID');
    run.lastBattle={encounterId:realEngineId,result:'stalemate',winner:null,
      playerColor:choice.playerColor||'w',encounterStars:choice.stars};
    run.activeTravelChoice=null;
    localStorage.setItem(runKey,JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:travel-open',{detail:{source:'battle-aftermath'}}));
    function assertReceipt(ok,message){if(!ok)throw new Error(message)}
   },{runKey:key,type:kind,choice:encounter});
   await page.locator('[data-kingdom-map-screen]:not([hidden])').waitFor({timeout:15000});
   const lost=await read(page);
   assert.equal(lost.kingdomMap.cells['1,0'].status,'failed');
   assert.equal(lost.kingdomMap.pendingCell,null,
    'completed real Battle must release the pending map cell');
   assert.deepEqual(lost.kingdomMap.king,{x:0,y:0});
   assert.equal(lost.kingdomMap.cells['1,0'].selectedEncounter.id,encounter.id,
    'failed visit keeps its original encounter for a paid retry');
   // This second unknown tile is the user's regression: it was ignored
   // forever when the map failed to recognize the engine's encounterId.
   await page.locator('[data-kingdom-cell="0,1"]').click();
   const second=await read(page);
   assert.deepEqual(second.kingdomMap.king,{x:0,y:1},
     'the king must be able to make a second Journey step after Battle');
   assert.equal(second.kingdomMap.pendingCell,'0,1');
   assert.equal(second.kingdomMap.cells['0,1'].status,'revealed');
   assert.equal(second.kingdomMap.cells['0,1'].selectedEncounter.type,'skirmish');
   const skirmish=second.kingdomMap.cells['0,1'].selectedEncounter;
   await page.waitForFunction(storage=>{
     const run=JSON.parse(localStorage.getItem(storage));
     return run?.activeTravelChoice?.kingdomCell==='0,1';
   },key,{timeout:12000});
   await page.evaluate(async ({storage,choice})=>{
     const {hashString}=await import('./js/race-assets.mjs');
     const run=JSON.parse(localStorage.getItem(storage));
     run.lastSkirmish={encounterId:'skirmish-'+hashString(choice.seed).toString(36)+'-'+choice.stars,
       result:'checkmate',winner:choice.playerColor,playerColor:choice.playerColor,encounterStars:choice.stars};
     run.activeTravelChoice=null;
     localStorage.setItem(storage,JSON.stringify(run));
     dispatchEvent(new CustomEvent('rpchess:travel-open',{detail:{source:'skirmish-aftermath'}}));
   },{storage:key,choice:skirmish});
   await page.locator('[data-kingdom-map-screen]:not([hidden])').waitFor({timeout:15000});
   const won=await read(page);
   assert.equal(won.kingdomMap.pendingCell,null,
     'successful real Skirmish must also release pendingCell');
   assert.equal(won.kingdomMap.cells['0,1'].status,'completed');
   assert.deepEqual(won.kingdomMap.king,{x:0,y:1});
   await page.locator('[data-kingdom-cell="0,2"]').click();
   assert.deepEqual((await read(page)).kingdomMap.king,{x:0,y:2},
     'the king must be able to make a third step after Skirmish victory');
  }
  // Walk-only fixture: all eight neighbors are already completed. Check real
  // pointer hit-testing AND the visual center for every direction (no timers,
  // supply charges or new encounters), returning to the castle each time.
  const walking=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
  await walking.goto(url,{waitUntil:'domcontentloaded'});
  await startNewRun(walking,{playerName:'Kingdom Walk Test',legacyTravel:false});
  await walking.locator('[data-roster-travel]').click();
  await walking.locator('[data-kingdom-map-screen]:not([hidden])').waitFor({timeout:20000});
  await walking.evaluate(storage=>{
    const run=JSON.parse(localStorage.getItem(storage));
    for(const dx of [-1,0,1])for(const dy of [-1,0,1]){
      if(dx===0&&dy===0)continue;
      run.kingdomMap.cells[dx+','+dy]={status:'completed',annexed:false};
    }
    localStorage.setItem(storage,JSON.stringify(run));
    globalThis.RPChessKingdomMap.open();
  },key);
  const visual=async(selector)=>walking.locator(selector).evaluate(el=>{
    const r=el.getBoundingClientRect();return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};
  });
  const castleAnchor=await visual('[data-kingdom-cell="0,0"]');
  for(const [dx,dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){
    const id=dx+','+dy,cell='[data-kingdom-cell="'+id+'"]';
    const target=await visual(cell);
    await walking.locator(cell).click({position:{x:20,y:20}});
    assert.deepEqual((await read(walking)).kingdomMap.king,{x:dx,y:dy},
      'the map must move to the specific clicked coordinate '+id);
    assert.equal(await walking.locator(cell+'.km-cell--here').count(),1,
      'king marker must be on the clicked world tile '+id);
    const actual=await visual('.km-king');
    assert(Math.hypot(actual.x-target.x,actual.y-target.y)<4,
      'king must visually occupy clicked '+id+': '+JSON.stringify({actual,target}));
    const anchored=await visual('[data-kingdom-cell="0,0"]');
    assert(Math.hypot(anchored.x-castleAnchor.x,anchored.y-castleAnchor.y)<4,
      'camera must not jump on one-cell steps '+id);
    await walking.locator('[data-kingdom-cell="0,0"]').click();
    assert.deepEqual((await read(walking)).kingdomMap.king,{x:0,y:0});
  }
  assert.equal((await read(walking)).supplies,10,
    'free movement through completed tiles must not spend Supplies');
  await walking.close();
  console.log('KINGDOM MAP PASS — multi-step Battle draw -> Skirmish win -> third tile, native engine IDs unlock map, 8-direction stable camera');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
