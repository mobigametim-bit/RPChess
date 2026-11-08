const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const key='rpchess.reboot.v1.run';
const output=process.env.RPCHESS_KINGDOM_SCREENSHOT_DIR||'test-results/kingdom-map';
const read=page=>page.evaluate(storage=>JSON.parse(localStorage.getItem(storage)||'null'),key);
// Check the actual computed URL AND successful bitmap decoding. The earlier
// pathname-only test passed even when CSS requested /css/assets/... (404).
async function assertTileImage(page,cellId,relativePath){
 const result=await page.locator('[data-kingdom-cell="'+cellId+'"]').evaluate(async (element,path)=>{
  const expected=new URL(path,document.baseURI).href;
  const css=getComputedStyle(element).backgroundImage;
  const decoded=await new Promise(resolve=>{
   const img=new Image();
   img.onload=()=>resolve(img.naturalWidth>0&&img.naturalHeight>0);
   img.onerror=()=>resolve(false);
   img.src=expected;
  });
  return {expected,css,decoded};
 },relativePath);
 assert(result.css.includes(result.expected),
  'cell '+cellId+' must use the real asset URL, not a /css/assets/ relative path: '+result.css);
 assert(result.decoded,'terrain image must load and decode: '+result.expected);
}

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  fs.mkdirSync(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await startNewRun(page,{playerName:'Kingdom Explorer',legacyTravel:false});
  // Force consecutive real Battles to catch the original bug:
  // their engine encounter IDs differ from the route ID kept by the map.
  await page.evaluate(async storage=>{
    const {randomEncounter}=await import('./js/kingdom-map-core.mjs');
    const run=JSON.parse(localStorage.getItem(storage));
    let found=false;
    for(let i=0;i<1200;i++){
      const probe={...run,id:'kingdom-e2e-chain-'+i};
      if(randomEncounter(probe,{x:1,y:0},500).type==='battle'&&
         randomEncounter(probe,{x:0,y:1},500).type==='battle'){
        run.id=probe.id;found=true;break;
      }
    }
    if(!found)throw new Error('No deterministic two-Battle map fixture found');
    localStorage.setItem(storage,JSON.stringify(run));
  },key);
  await page.locator('[data-roster-travel]').click();
  await page.locator('[data-kingdom-map-screen]:not([hidden])').waitFor({timeout:20000});
  assert.equal(await page.locator('[data-travel-choice-screen]:not([hidden])').count(),0,
   'the old three-card choice is not the live Journey screen');
  assert.equal(await page.locator('[data-kingdom-cell]').count(),77,
    '1366x768 target viewport requires 11x7 fixed-size grid for full-bleed coverage');
  const before=await read(page);
  assert(before.kingdomMap&&before.kingdomMap.cells['0,0'].annexed);
  assert.deepEqual(before.kingdomMap.king,{x:0,y:0});
  assert.equal(await page.locator('[data-kingdom-cell="1,0"] .km-fog-mark').textContent(),'?');
  const castleSprite=page.locator('[data-kingdom-cell="0,0"] img.km-object');
  assert.equal(await castleSprite.getAttribute('src'),
    'assets/kingdom-map/humans/humans_castle_128.svg');
  await page.waitForFunction(()=>{
    const sprite=document.querySelector('[data-kingdom-cell="0,0"] img.km-object');
    return sprite?.complete&&sprite.naturalWidth===128&&sprite.naturalHeight===128;
  },null,{timeout:15000});
  // Accepted 142px/73%/92px map geometry and 25% floating inspector.
  const dimensions=await page.evaluate(()=>{
   const frame=document.querySelector('.km-map-frame').getBoundingClientRect();
   const world=document.querySelector('.km-world').getBoundingClientRect();
   const cell=document.querySelector('[data-kingdom-cell="0,0"]').getBoundingClientRect();
   const king=document.querySelector('.km-king');
   const object=document.querySelector('[data-kingdom-cell="0,0"] img.km-object');
   const artwork=object.getBoundingClientRect();
   const inspector=document.querySelector('.km-inspector').getBoundingClientRect();
   return {frame:{width:frame.width,height:frame.height,left:frame.left,right:frame.right,top:frame.top,bottom:frame.bottom},
    world:{width:world.width,height:world.height,left:world.left,right:world.right,top:world.top,bottom:world.bottom},
    tile:{width:cell.width,height:cell.height,left:cell.left,right:cell.right,top:cell.top,bottom:cell.bottom},
    king:{width:parseFloat(getComputedStyle(king).width),height:parseFloat(getComputedStyle(king).height)},
    object:{width:artwork.width,height:artwork.height,left:artwork.left,right:artwork.right,
      top:artwork.top,bottom:artwork.bottom,fit:getComputedStyle(object).objectFit},
    cellOverflow:getComputedStyle(document.querySelector('[data-kingdom-cell="0,0"]')).overflow,
    inspector:{width:inspector.width,left:inspector.left,right:inspector.right}};
  });
  assert(dimensions.world.left<=dimensions.frame.left&&dimensions.world.right>=dimensions.frame.right&&
    dimensions.world.top<=dimensions.frame.top&&dimensions.world.bottom>=dimensions.frame.bottom,
    'enlarged cells must fill the map frame with no empty gutters');
  assert(Math.abs(dimensions.tile.width-142)<1&&Math.abs(dimensions.tile.height-142)<1,
    'user-selected 142px cells remain perfectly square');
  assert(Math.abs(dimensions.king.width-92)<1&&Math.abs(dimensions.king.height-92)<1,
    'king keeps a fixed 92px size');
  assert(Math.abs(dimensions.object.width-142*.73)<1&&Math.abs(dimensions.object.height-142*.73)<1,
    'SVG art displays at exactly 73% of the tile');
  assert(dimensions.object.fit==='contain'&&dimensions.cellOverflow==='visible',
    'SVG is contained without object clipping or unwanted stretching');
  assert(dimensions.object.left>=dimensions.tile.left&&dimensions.object.right<=dimensions.tile.right&&
    dimensions.object.top>=dimensions.tile.top&&dimensions.object.bottom<=dimensions.tile.bottom,
    'full SVG artwork fits inside its own square');
  assert(Math.abs(dimensions.inspector.width-dimensions.frame.width*.25)<3&&
    dimensions.inspector.left>dimensions.frame.left&&dimensions.inspector.right<dimensions.frame.right,
    'inspector floats over the map and occupies 25% of its width');
  await assertTileImage(page,'0,0','assets/races/humans/board/white.png');
  assert.equal(await page.locator('[data-kingdom-glory]').textContent(),'0',
    'current Glory uses the Chronicle formula, not an invented currency');
  assert.equal(await page.locator('[data-kingdom-gold]').textContent(),String(before.gold),
    'the gold header matches the current run');
  assert.equal(await page.locator('[data-kingdom-supplies]').textContent(),String(before.supplies),
    'the supplies header matches the current run');
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
  const race=encounter.raceTag&&encounter.raceTag!=='mixed'?encounter.raceTag:'humans';
  const encounterSprite=page.locator('[data-kingdom-cell="1,0"] img.km-object');
  assert.equal(await encounterSprite.getAttribute('src'),
    `assets/kingdom-map/${race}/${race}_battle_128.svg`);
  await assertTileImage(page,'1,0','assets/races/'+race+'/board/black.png');
  await page.waitForFunction(()=>{
    const sprite=document.querySelector('[data-kingdom-cell="1,0"] img.km-object');
    return sprite?.complete&&sprite.naturalWidth===128;
  },null,{timeout:15000});
  assert.equal(moved.supplies,before.supplies,'moving and unveiling do not charge resources prematurely');
  assert.equal(await page.locator('[data-kingdom-cell="1,0"] .km-fog-mark').count(),0,
   'the fog opens before the encounter begins');
  // Reveal precedes movement. The route card is visible while the king still
  // stands on the previous cell; its literary flavor lives only in the flyout.
  const opening=page.locator('[data-kingdom-cell="1,0"].km-cell--opening');
  assert.equal(await opening.count(),1,'fog begins revealing before king motion');
  assert.equal(await page.locator('.km-king--moving').count(),0,'king stays still while fog is lifted');
  assert.equal(await page.locator('[data-kingdom-route-card]').count(),1,
    'an unresolved cell shows a full Travel-style card on the right');
  const routeCard=page.locator('[data-kingdom-route-card]');
  assert.equal(await routeCard.getAttribute('data-kingdom-route-status'),'revealed');
  assert.equal(await routeCard.locator('.km-route-card__stars').count(),1,'route card shows real difficulty stars');
  assert.equal(await routeCard.locator('.km-route-resource').count(),2,
    'Battle route card displays supply cost and gold reward');
  assert.equal(await routeCard.locator('.travel-choice-card__flavor,.km-route-card__flavor').count(),0,
    'literary flavor must not be duplicated in the information card');
  const still=await centers();
  assert(Math.hypot(still.king.x-beforeCenters.king.x,still.king.y-beforeCenters.king.y)<4,
    'opening cell must not move the king yet');
  await page.locator('.km-king--moving').waitFor({timeout:2500});
  const king=page.locator('.km-king--moving');
  assert.equal(await king.evaluate(el=>getComputedStyle(el).animationName),'km-king-step');
  await page.waitForTimeout(540);
  await page.locator('[data-kingdom-cell="1,0"] .km-flavor-flyout').waitFor({timeout:2000});
  const story=await page.locator('[data-kingdom-cell="1,0"] .km-flavor-flyout').textContent();
  assert(story?.trim().length>0,'the original route narrative flies out of the entered tile');
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
  assert.equal((await read(page)).activeTravelChoice,null,
    'no encounter starts before reveal, movement and narrative flight finish');
  await page.screenshot({path:path.join(output,'kingdom-02-revealed.png')});
  await page.waitForFunction(k=>{
   const r=JSON.parse(localStorage.getItem(k)||'null');
   return r?.activeTravelChoice?.kingdomCell==='1,0'&&r?.kingdomMap?.cells?.['1,0']?.status==='in_progress';
  },key,{timeout:15000});
  const elapsed=Date.now()-clicked;
  assert(elapsed>=3850,'encounter waits for reveal, king movement and readable narrative');
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
   assert.equal(await page.locator('[data-kingdom-route-card]').count(),1,
     'after retreat the unfinished route card must stay selected');
   assert.equal(await page.locator('[data-kingdom-route-card]').getAttribute('data-kingdom-route-status'),
     'failed','failed route retains its full card until it is beaten');
   // Failed routes retain their previously generated encounter until a retry.
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
   assert.equal(second.kingdomMap.cells['0,1'].selectedEncounter.type,'battle');
   const secondBattle=second.kingdomMap.cells['0,1'].selectedEncounter;
   await page.waitForFunction(storage=>{
     const run=JSON.parse(localStorage.getItem(storage));
     return run?.activeTravelChoice?.kingdomCell==='0,1';
   },key,{timeout:12000});
   await page.evaluate(async ({storage,choice})=>{
     const {hashString}=await import('./js/race-assets.mjs');
     const run=JSON.parse(localStorage.getItem(storage));
     run.lastBattle={encounterId:'battle-'+hashString(choice.seed).toString(36)+'-'+choice.stars,
       result:'checkmate',winner:choice.playerColor,playerColor:choice.playerColor,encounterStars:choice.stars};
     run.activeTravelChoice=null;
     localStorage.setItem(storage,JSON.stringify(run));
     dispatchEvent(new CustomEvent('rpchess:travel-open',{detail:{source:'battle-aftermath'}}));
   },{storage:key,choice:secondBattle});
   await page.locator('[data-kingdom-map-screen]:not([hidden])').waitFor({timeout:15000});
   const won=await read(page);
   assert.equal(won.kingdomMap.pendingCell,null,
     'successful real second Battle must also release pendingCell');
   assert.equal(won.kingdomMap.cells['0,1'].status,'completed');
   assert.deepEqual(won.kingdomMap.king,{x:0,y:1});
   await page.locator('[data-kingdom-cell="0,2"]').click();
   assert.deepEqual((await read(page)).kingdomMap.king,{x:0,y:2},
     'the king must be able to make a third step after another Battle victory');
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
    await walking.locator(cell).click({position:{x:20,y:20}});
    assert.deepEqual((await read(walking)).kingdomMap.king,{x:dx,y:dy},
      'the map must move to the specific clicked coordinate '+id);
    assert.equal(await walking.locator(cell+'.km-cell--here').count(),1,
      'king marker must be on the clicked world tile '+id);
    const actual=await visual('.km-king'),target=await visual(cell);
    assert(Math.hypot(actual.x-target.x,actual.y-target.y)<4,
      'king must visually occupy clicked '+id+': '+JSON.stringify({actual,target}));
    const anchored=await visual('[data-kingdom-cell="0,0"]');
    if(dy===0)assert(Math.hypot(anchored.x-castleAnchor.x,anchored.y-castleAnchor.y)<4,
      'horizontal one-step moves retain camera slack '+id);
    // The enlarged map pans one row vertically to keep adjacent targets visible.
    await walking.locator('[data-kingdom-cell="0,0"]').click();
    assert.deepEqual((await read(walking)).kingdomMap.king,{x:0,y:0});
  }
  // Mixed/unknown race cells retain neutral background tiles.
  await walking.evaluate(storage=>{
    const run=JSON.parse(localStorage.getItem(storage));
    run.kingdomMap.cells['1,0']={status:'completed',annexed:false,
      selectedEncounter:{id:'kingdom.neutral-fixture',type:'event',raceTag:'mixed',stars:1}};
    run.kingdomMap.cells['-1,0']={status:'completed',annexed:false,
      selectedEncounter:{id:'kingdom.elven-fixture',type:'event',raceTag:'elves',stars:1}};
    run.kingdomMap.cells['1,1']={status:'completed',annexed:false,
      selectedEncounter:{id:'kingdom.orc-fixture',type:'battle',raceTag:'orcs',stars:1}};
    localStorage.setItem(storage,JSON.stringify(run));
    globalThis.RPChessKingdomMap.open();
  },key);
  for(const [id,expected] of [['1,0','assets/boards/neutral/tile_dark.png'],
    ['-1,0','assets/races/elves/board/black.png'],
    ['1,1','assets/races/orcs/board/white.png']]){
    await assertTileImage(walking,id,expected);
  }
  assert.equal((await read(walking)).supplies,10,
    'free movement through completed tiles must not spend Supplies');
  await walking.close();
  console.log('KINGDOM MAP PASS — race sprites load, Battle draw -> Battle win -> third tile, eight-direction camera');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
