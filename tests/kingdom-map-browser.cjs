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
  if(['battle','skirmish','caravan','puzzle'].includes(kind)){
   await page.evaluate(({runKey,type,choice})=>{
    const run=JSON.parse(localStorage.getItem(runKey));
    if(type==='puzzle'){
     run.lastPuzzle={routeId:choice.id,puzzleId:'puzzle.fixture',result:'failed'};
    }else{
     const result={encounterId:choice.id,result:'stalemate',winner:null,
      playerColor:choice.playerColor||'w',encounterStars:choice.stars};
     if(type==='battle')run.lastBattle=result;
     else if(type==='skirmish')run.lastSkirmish=result;
     else run.lastCaravan=result;
    }
    run.activeTravelChoice=null;
    localStorage.setItem(runKey,JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:travel-open',{detail:{
     source:type==='puzzle'?'puzzle-aftermath':type==='caravan'?'caravan-aftermath':type+'-aftermath'}}));
   },{runKey:key,type:kind,choice:encounter});
   await page.locator('[data-kingdom-map-screen]:not([hidden])').waitFor({timeout:15000});
   const lost=await read(page);
   assert.equal(lost.kingdomMap.cells['1,0'].status,'failed');
   assert.deepEqual(lost.kingdomMap.king,{x:0,y:0});
   await page.locator('[data-kingdom-cell="1,0"]').click();
   assert.equal((await read(page)).kingdomMap.cells['1,0'].selectedEncounter.id,encounter.id,
    'retry cannot reroll the saved encounter');
  }
  console.log('KINGDOM MAP PASS — 9x7 virtual view, fog reveal, animated king, single deterministic encounter, ~2s pause, one Supply, return/retry');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
