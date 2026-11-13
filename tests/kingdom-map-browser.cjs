const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const key='rpchess.reboot.v1.run';
const output=process.env.RPCHESS_KINGDOM_SCREENSHOT_DIR||'test-results/kingdom-map';
const read=page=>page.evaluate(storage=>JSON.parse(localStorage.getItem(storage)||'null'),key);
async function dragKing(page,id){
 // Scene transitions intentionally show an opaque full-screen asset loader.
 // It must finish before any pointer input can reach the map or the king.
 await page.locator('[data-game-loading]').waitFor({state:'hidden',timeout:25000});
 // Position is written at movement start; the old sprite is still animating.
 // Wait for the actual drag affordance instead of pressing it mid-flight.
 await page.waitForFunction(()=>{
  const handle=document.querySelector('[data-kingdom-king-handle]');
  return handle&&!handle.disabled&&
   document.querySelector('[data-kingdom-world]')?.dataset.kingdomMotion==='idle';
 },null,{timeout:7000});
 await page.evaluate(()=>{
  window.__kingDragEvents=[];
  const h=document.querySelector('[data-kingdom-king-handle]');
  for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture']){
   h?.addEventListener(type,e=>window.__kingDragEvents.push({
    type,button:e.button,x:e.clientX,y:e.clientY
   }),true);
  }
 });
 const handle=await page.locator('[data-kingdom-king-handle]').boundingBox();
 const tile=await page.locator('[data-kingdom-cell="'+id+'"]').boundingBox();
 assert(handle&&tile,'king drag requires a visible start and target tile '+id);
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);
 await page.evaluate(({x,y})=>{
   const hit=document.elementFromPoint(x,y);
   const handle=document.querySelector('[data-kingdom-king-handle]');
   window.__kingStartHit={
     hit:hit?.outerHTML?.slice(0,300),
     nearest:hit?.closest('main,button,.km-world,.km-map-frame')?.outerHTML?.slice(0,180),
     isHandle:hit===handle||handle?.contains(hit),
     handlePointer:handle?getComputedStyle(handle).pointerEvents:'none',
     framePointer:getComputedStyle(document.querySelector('.km-map-frame')).pointerEvents,
     overlays:[...document.querySelectorAll('#app > main')].filter(m=>!m.hidden).map(m=>m.className)
   };
 },{x:handle.x+handle.width/2,y:handle.y+handle.height/2});
 await page.mouse.down();
 assert.equal(await page.locator('.km-king-drag-aura.is-active').count(),1,
  'the green reusable check aura follows the king during drag');
 await page.mouse.move(tile.x+tile.width/2,tile.y+tile.height/2,{steps:9});
 await page.mouse.up();
}

// The removed Classic skin must not leak chessboard tile textures into
// any Kingdom view, regardless of race, save, movement or zoom state.
async function assertTileImage(page,cellId){
 const css=await page.locator('[data-kingdom-cell="'+cellId+'"]').evaluate(element=>
   getComputedStyle(element).backgroundImage);
 assert.equal(css,'none','permanent parchment tile '+cellId+' must not show Classic artwork');
}

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  fs.mkdirSync(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  if(process.env.RPCHESS_PARCHMENT_QA_SCREENSHOT_DIR)
    await page.addInitScript(()=>performance.setResourceTimingBufferSize(3000));
  const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));
  const failedAssets=[];
  page.on('console',msg=>{if(msg.type()==='error')failedAssets.push(msg.text());});
  page.on('requestfailed',req=>failedAssets.push(req.url()+': '+req.failure()?.errorText));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await startNewRun(page,{playerName:'Kingdom Explorer',legacyTravel:false});
  // A regression fixture with two adjacent Battles is intentionally *manual*.
  // The real generator now forbids this cluster at spacing=1. Engine routing
  // must still survive old saves with neighboring combat encounters.
  // Arena shards are account currency; the Kingdom HUD must use its ledger.
  await page.evaluate(()=>{
    localStorage.setItem('rpchess.reboot.v1.arena',JSON.stringify({
      version:1,events:[{id:'hud-fixture:win',kind:'win',foe:'pawn:humans',amount:37,at:1}],
      squad:'humans',match:null,updatedAt:1
    }));
  });
  await page.locator('[data-roster-travel]').click();
  try{
    await page.locator('[data-kingdom-map-screen]:not([hidden])').waitFor({timeout:16000});
  }catch(error){
    const state=await page.evaluate(()=>({scriptCount:document.scripts.length,
      maps:document.querySelectorAll('[data-kingdom-map-screen]').length,
      active:document.querySelector('.roster-active')?.className||'none'}));
    throw new Error('Kingdom startup failed: '+JSON.stringify({errors,failedAssets,state})+
      ' | '+String(error));
  }
  // Explicitly preserve an older, valid saved map containing adjacent
  // encounters. This proves old saves remain playable without rerolling them.
  await page.evaluate(async storage=>{
    const {randomEncounter}=await import('./js/kingdom-map-core.mjs?v=20261109-atlas-lab-v7');
    const run=JSON.parse(localStorage.getItem(storage));
    const planned={type:'battle',biome:'plains',landmark:null,raceTag:'humans',
      paths:{road:false,river:false}};
    for(const [x,y] of [[1,0],[0,1]]){
      const id=x+','+y;
      run.kingdomMap.cells[id]={status:'revealed',explored:false,
        selectedEncounter:randomEncounter(run,{x,y},500,planned)};
    }
    localStorage.setItem(storage,JSON.stringify(run));
    globalThis.RPChessKingdomMap.open();
  },key);
  assert.equal(await page.locator('[data-travel-choice-screen]:not([hidden])').count(),0,
   'the old three-card choice is not the live Journey screen');
  const expectedViewportCells=await page.evaluate(()=>{
    const f=document.querySelector('.km-map-frame').getBoundingClientRect();
    const odd=(px,min)=>{const n=Math.max(min,Math.ceil((px+2)/117));return n%2?n:n+1;};
    return odd(f.width,9)*odd(f.height,7);
  });
  assert.equal(await page.locator('[data-kingdom-cell]').count(),expectedViewportCells,
    'atlas 117px zoom selects an odd full-bleed grid for the viewport');
  const before=await read(page);
  assert(before.kingdomMap&&before.kingdomMap.cells['0,0'].annexed);
  // The castle hire list uses shipped race chess-piece art and the real Gold icon.
  const recruitArt=await page.locator('.km-castle-recruit').evaluateAll(async rows=>Promise.all(rows.map(async row=>{
    const piece=row.querySelector('.km-castle-recruit__piece'),coin=row.querySelector('.km-castle-recruit__gold');
    const button=row.querySelector('[data-kingdom-castle-hire]');
    try{await Promise.all([piece.decode(),coin.decode()]);}catch{return false;}
    return Boolean(button&&piece.alt&&piece.naturalWidth&&coin.naturalWidth&&!button.textContent.includes('зол.'));
  })));
  assert.equal(recruitArt.length,5,'all five permanent Army roles have Castle hire buttons');
  assert.equal(await page.locator('.km-castle-recruit button .km-castle-recruit__piece').count(),5,
    'all recruit images must be inside their clickable tiles');
  assert.equal(await page.locator('.km-castle-recruit button .km-castle-recruit__count').count(),5,
    'each recruit button must show its live owned count');
  assert(recruitArt.every(Boolean),'Castle recruit art and Gold currency icons must decode');
  assert.deepEqual(await page.locator('[data-kingdom-army-count]').allTextContents(),
    ['×0','×0','×0','×0','×0'],
    'new runs show zero nameless Army units next to each Castle recruit portrait');
  await page.evaluate(storage=>{
    const run=JSON.parse(localStorage.getItem(storage));
    globalThis.__castleRecruitCountFixture=localStorage.getItem(storage);
    run.gold=999;
    run.army=[{raceTag:run.kingdomMap.castle.raceTag,pieceType:'knight',count:3}];
    localStorage.setItem(storage,JSON.stringify(run));
    globalThis.RPChessKingdomMap.open();
  },key);
  assert.equal(await page.locator('[data-kingdom-army-count="knight"]').innerText(),'×3',
    'Castle recruit count must reflect persisted Army, not named heroes');
  await page.locator('[data-kingdom-castle-hire="knight"]').click();
  assert.equal(await page.locator('[data-kingdom-army-count="knight"]').innerText(),'×4',
    'Castle portrait count must refresh immediately after a successful hire');
  await page.evaluate(storage=>{
    localStorage.setItem(storage,globalThis.__castleRecruitCountFixture);
    delete globalThis.__castleRecruitCountFixture;
    globalThis.RPChessKingdomMap.open();
  },key);
  // Resource affordability must be both semantic and visual, without a full map redraw.
  await page.evaluate(storage=>{
    const arenaKey='rpchess.reboot.v1.arena';
    globalThis.__castleEconomyFixture={run:localStorage.getItem(storage),arena:localStorage.getItem(arenaKey)};
    const run=JSON.parse(localStorage.getItem(storage));run.gold=0;
    run.kingdomMap.cells['1,1']={type:'empty',status:'completed',explored:true,annexed:false,selectedEncounter:null};
    localStorage.setItem(storage,JSON.stringify(run));globalThis.RPChessKingdomMap.open();
  },key);
  await page.locator('[data-kingdom-cell="1,1"]').evaluate(cell=>cell.click());
  const settlementButton=page.locator('[data-kingdom-build-settlement]');
  assert.equal(await settlementButton.isVisible(),true,'an eligible explored empty cell can host a Settlement');
  assert.equal(await settlementButton.isDisabled(),true,'insufficient Gold must block construction');
  assert.equal(await settlementButton.getAttribute('aria-disabled'),'true');
  await page.evaluate(storage=>{
    const run=JSON.parse(localStorage.getItem(storage));run.gold=1000;
    localStorage.setItem(storage,JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  },key);
  assert.equal(await settlementButton.isEnabled(),true,'affordable construction updates without redrawing the grid');
  await page.evaluate(()=>{
    localStorage.setItem('rpchess.reboot.v1.arena',JSON.stringify({version:1,events:[],squad:'humans',match:null,updatedAt:1}));
    dispatchEvent(new CustomEvent('rpchess:arena-updated'));
  });
  assert.equal(await settlementButton.isDisabled(),true,'missing Honor Shards must also block construction');
  const disabledOpacity=await settlementButton.evaluate(button=>Number(getComputedStyle(button).opacity));
  assert(disabledOpacity<.8,'unaffordable construction must be visibly dimmed');
  await page.evaluate(storage=>{
    const snapshot=globalThis.__castleEconomyFixture;
    localStorage.setItem(storage,snapshot.run);
    if(snapshot.arena===null)localStorage.removeItem('rpchess.reboot.v1.arena');
    else localStorage.setItem('rpchess.reboot.v1.arena',snapshot.arena);
    delete globalThis.__castleEconomyFixture;globalThis.RPChessKingdomMap.open();
  },key);
  // Classic was retired. Even an older persisted 'classic' preference must
  // open parchment; the actual Journey save and encounter data stay unchanged.
  await page.evaluate(()=>{
    localStorage.setItem('rpchess.kingdom.visual.v1','classic');
    globalThis.RPChessKingdomMap.open();
  });
  assert.equal(await page.locator('[data-kingdom-skin-switch]').count(),0,
    'there is no Classic/Parchment switch in the Kingdom interface');
  const atlas=page.locator('[data-kingdom-parchment]');
  assert.equal(await atlas.count(),1,'parchment must draw one continuous canvas behind clickable cells');
  const sandstone=await page.evaluate(async()=>{
    const {drawSandstoneRoad,SANDSTONE_WIDTH}=await import('./js/kingdom-road-paving.mjs');
    const canvas=document.createElement('canvas');canvas.width=210;canvas.height=90;
    const ctx=canvas.getContext('2d');
    const painted=drawSandstoneRoad(ctx,{x1:20,y1:42,x2:190,y2:42,bend:0,id:'browser-paving-sample'});
    const center=ctx.getImageData(100,42,1,1).data;
    const outside=ctx.getImageData(100,82,1,1).data;
    const hues=new Set();
    for(let x=45;x<=165;x+=3){
      const pixel=ctx.getImageData(x,42,1,1).data;
      if(pixel[3]>100)hues.add(pixel[0]+','+pixel[1]+','+pixel[2]);
    }
    return {painted,width:SANDSTONE_WIDTH,centerAlpha:center[3],outsideAlpha:outside[3],
      stoneColors:hues.size};
  });
  assert(sandstone.painted&&sandstone.width===16&&sandstone.centerAlpha>0&&
    sandstone.outsideAlpha===0&&sandstone.stoneColors>=3,
    'browser Canvas must draw 16px yellow-gold brick paving with visible variation');
  const roadPalette=await page.evaluate(async()=>{
    const {drawKingdomRoads}=await import('./js/kingdom-map-overlay.mjs');
    const canvas=document.createElement('canvas');
    canvas.width=710;canvas.height=426;
    const map={seed:'owned-gray-contrast',castle:{x:0,y:0},
      centralOwnedCells:['1,0'],outposts:[],completedRoads:[],
      cells:{'0,0':{annexed:true},'1,0':{annexed:true}},
      royalRoadsVersion:3,royalRoads:[
       {from:'0,0',to:'1,0',id:'owned-test',bend:0},
       {from:'1,0',to:'2,0',id:'border-test',bend:0}]};
    const ctx=canvas.getContext('2d');
    const count=drawKingdomRoads(ctx,{map,view:{x:1,y:0},columns:5,rows:3});
    const pixel=x=>[...ctx.getImageData(x,213,1,1).data];
    return {count,yellow:pixel(380),gray:pixel(478)};
  });
  assert.equal(roadPalette.count,2,'paved routes should be counted once, not once per color');
  assert(roadPalette.yellow[3]>0&&roadPalette.gray[3]>0&&
    roadPalette.yellow[0]-roadPalette.yellow[2]>35&&
    Math.abs(roadPalette.gray[0]-roadPalette.gray[2])<45,
    'brick road across border must be yellow inside and gray outside: '+
    JSON.stringify(roadPalette));

  // Five independent NPC limits use floor(owned lands EXCLUDING castle / 5),
  // with no actors before their destinations/roads exist.
  const npcPolicy=await page.evaluate(async()=>{
    const {createTravelers,territoryTravelerQuota,OWNED_ONLY}=await import(
      './js/kingdom-road-travelers.mjs?v=20261111-npc-floor-v1');
    const ids=Array.from({length:6},(_,i)=>i+',0');
    const castle={x:0,y:0},cells=Object.fromEntries(ids.map((id,i)=>
      [id,{status:'completed',explored:true,annexed:true,...(i===2?{
        selectedEncounter:{id:'event-a',type:'event'}}:i===5?{
        selectedEncounter:{id:'settlement-a',type:'settlement'}}:{})}]));
    cells['7,0']={status:'completed',explored:true,selectedEncounter:{
      id:'settlement-b',type:'settlement'}};
    const edges=Array.from({length:5},(_,i)=>({
      id:'royal:'+i,from:i+',0',to:i+1+',0',bend:0}));
    const map={seed:'walker-route-approval',castle,cells,
      centralOwnedCells:ids,royalRoadsVersion:3,royalRoads:edges,
      completedRoads:[{from:'5,0',to:'7,0',bend:.3,id:'travel-foreign'}],
      outposts:[],builtSettlements:[]};
    const byType=walkers=>Object.fromEntries(
      ['merchant','convoy','courier','patrol','builders'].map(type=>[
        type,walkers.filter(actor=>actor.type===type)]));
    const started=byType(createTravelers(map,{parchment:false}));
    const expanded={...map,centralOwnedCells:[...ids,...Array.from({length:6},(_,i)=>(i+6)+',0')]};
    const larger=byType(createTravelers(expanded,{parchment:false}));
    const missing={...map,cells:{...cells,'5,0':{status:'completed',explored:true,annexed:true},
      '7,0':{status:'completed',explored:true}},
      builtSettlements:[]};
    const noSettlements=byType(createTravelers(missing,{parchment:false}));
    const none={...map,royalRoads:[],completedRoads:[]};
    const noRoads=byType(createTravelers(none,{parchment:false}));
    return {
      quota:territoryTravelerQuota(map),
      largerQuota:territoryTravelerQuota(expanded),
      initial:Object.fromEntries(Object.entries(started).map(([k,v])=>[k,v.length])),
      larger:Object.fromEntries(Object.entries(larger).map(([k,v])=>[k,v.length])),
      missing:{merchant:noSettlements.merchant.length,builders:noSettlements.builders.length},
      none:{convoy:noRoads.convoy.length,patrol:noRoads.patrol.length},
      boundaries:Object.fromEntries([0,4,5,9,10,11].map(lands=>[lands,
        territoryTravelerQuota({castle,cells:{},centralOwnedCells:[
          '0,0',...Array.from({length:lands},(_,i)=>(i+1)+',0')
        ]})])),
      distinct:territoryTravelerQuota({...map,outposts:[{
        cells:['1,0','5,0','8,0','9,0','10,0','11,0','12,0']
      }]}),
      own:[...OWNED_ONLY],
      routes:{merchant:started.merchant[0]?.legs[0]?.to,
        builder:started.builders[0]?.legs[0]?.to,
        patrol:started.patrol[0]?.legs[0]?.to}
    };
  });
  assert.equal(npcPolicy.quota,1);
  assert.equal(npcPolicy.largerQuota,2);
  assert.deepEqual(npcPolicy.boundaries,{0:0,4:0,5:1,9:1,10:2,11:2},
    'NPC quotas increase only after each complete block of five owned lands');
  assert.equal(npcPolicy.distinct,1,
    'the HUD land count, not distinct Castle/outpost route cells, must determine NPC quota');
  for(const type of ['merchant','convoy','courier','patrol','builders']){
    assert.equal(npcPolicy.initial[type],1,'one eligible '+type+' for five lands');
    assert.equal(npcPolicy.larger[type],2,'at most two eligible '+type+' for eleven lands');
  }
  assert.deepEqual(npcPolicy.missing,{merchant:0,builders:0},
    'merchants and builders cannot appear without settlements');
  assert.deepEqual(npcPolicy.none,{convoy:0,patrol:0},
    'convoys and castle guards cannot appear without an owned road');
  assert.equal(npcPolicy.routes.builder,'5,0',
    'builders shuttle between the Castle and owned Settlement');
  assert(['2,0','5,0'].includes(npcPolicy.routes.patrol),
    'patrols shuttle from the Castle to a road encounter');
  assert(npcPolicy.own.includes('convoy')&&npcPolicy.own.includes('builders')&&
    npcPolicy.own.includes('patrol'),'local walkers cannot depart the kingdom');
  const npcAtlas=await page.evaluate(async()=>{
    const src='assets/kingdom-travelers/walkers_64.png';
    const response=await fetch(src,{cache:'no-store'});
    if(!response.ok)return {ok:false,status:response.status};
    const image=new Image();image.src=src;
    try{await image.decode();}catch{return {ok:false,status:response.status};}
    return {ok:image.naturalWidth===256&&image.naturalHeight===320,status:response.status};
  });
  assert(npcAtlas.ok,'the approved five-by-four 64px animation atlas must be shipped and decodable');
  const travelerLayer=page.locator('[data-kingdom-travelers]');
  assert.equal(await travelerLayer.count(),1,'decorative travelers occupy one noninteractive canvas');
  assert.equal(await travelerLayer.getAttribute('data-decorative-only'),'true');
  assert.equal(await travelerLayer.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  const topNav=await page.evaluate(()=>{
    return ['kingdom-roster','kingdom-settings','kingdom-menu'].map(role=>{
      const button=document.querySelector('[data-'+role+']');
      return {role,background:getComputedStyle(button).backgroundImage,
        label:button.textContent.trim(),
        pointer:getComputedStyle(button).pointerEvents};
    });
  });
  for(const [i,file] of ['hud-squad.png','main-menu-settings.png','hud-main-menu.png'].entries())
   assert(topNav[i].background.includes(file)&&topNav[i].label&&topNav[i].pointer!=='none',
    'Kingdom HUD icon must preserve action and label: '+JSON.stringify(topNav[i]));
  const npcStack=await page.evaluate(()=>{
    const z=selector=>{
      const el=document.querySelector(selector);
      return el?Number(getComputedStyle(el).zIndex):null;
    };
    return {road:z('.km-kingdom-overlay'),site:z('.km-object--site'),
      defender:z('.km-object--defender'),npc:z('.km-travelers-layer'),
      fog:z('.km-parchment-fog'),king:z('.km-king'),
      npcPointer:getComputedStyle(document.querySelector('.km-travelers-layer')).pointerEvents};
  });
  assert(npcStack.site!==null&&npcStack.defender!==null,
    'encounter fixture must expose both a road site and its defender');
  assert(npcStack.road<npcStack.site&&npcStack.site<npcStack.npc&&
    npcStack.defender<npcStack.npc&&npcStack.npc<npcStack.fog&&
    npcStack.fog<npcStack.king,
    'walkers must render above encounter site + defender but below fog and king: '+JSON.stringify(npcStack));
  assert.equal(npcStack.npcPointer,'none',
    'foreground decorative NPC canvas must not intercept map clicks');
  if(Number(await travelerLayer.getAttribute('data-walker-count'))>0){
    const atlasStatus=await page.evaluate(async()=>{
      const module=await import('./js/kingdom-traveler-renderer.mjs?v=20261110-npc-territory-v4');
      const result=await Promise.race([
        module.loadAtlas().then(img=>img?{loaded:true,w:img.naturalWidth,h:img.naturalHeight}:{loaded:false}),
        new Promise(resolve=>setTimeout(()=>resolve({timedOut:true}),7000))
      ]);
      const canvas=document.querySelector('[data-kingdom-travelers]');
      return {...result,status:canvas?.dataset.atlasStatus,count:canvas?.dataset.walkerCount,
        attached:canvas?.isConnected};
    });
    assert(atlasStatus.loaded&&atlasStatus.w===256&&atlasStatus.h===320,
      'NPC walking atlas must decode with its real 256x320 sprite sheet: '+JSON.stringify(atlasStatus));
  }
  const boundaryLayer=await page.evaluate(()=>{
    const terrain=document.querySelector('.km-parchment-canvas');
    const completedRoads=document.querySelector('.km-kingdom-overlay');
    return {count:Number(terrain?.dataset.borderSegments),terrainZ:Number(getComputedStyle(terrain).zIndex),
      playerRoadZ:Number(getComputedStyle(completedRoads).zIndex)};
  });
  assert(boundaryLayer.count>0&&boundaryLayer.terrainZ<boundaryLayer.playerRoadZ,
    'territory boundary is on the original natural-road terrain layer, below later event roads');
  // Exercise actual uploaded sprites in the bundled dist, not just the
  // procedural Canvas fallback that worked before the artist supplied art.
  const parchmentFormat='png'; // PNG-only runtime without SVG fallback.
  const artProbe=await page.evaluate(async format=>{
    const files=[
      'parchment_base_variations/01_light_ochre_plain.svg',
      'forest_clusters/01_small_grove.svg',
      'mountain_clusters/01_single_summit.svg',
      'hills_rocks/01_three_hills.svg',
      'fog_of_war_shapes/01_broad_blot.svg'
    ].map(name=>name.replace(/\.svg$/,'.'+format));
    return Promise.all(files.map(async file=>{
      const src='assets/kingdom-parchment/'+file;
      const response=await fetch(src,{cache:'no-store'});
      if(!response.ok)return {file,status:response.status,decoded:false};
      const img=new Image();img.src=src;
      try{await img.decode();}catch{return {file,status:response.status,decoded:false};}
      return {file,status:response.status,decoded:img.naturalWidth===128&&img.naturalHeight===128};
    }));
  },parchmentFormat);
  for(const sprite of artProbe)assert.equal(sprite.status===200&&sprite.decoded,true,
    'artist parchment '+parchmentFormat.toUpperCase()+' must decode at 128px: '+sprite.file);
  // The six artist-repaired road-event sprites must remain actual vectors
  // with the author's transparent margins, not raster images or opaque tiles.
  const correctedSprites=[
    'goblins/goblins_castle_128.svg',
    'fae/fae_event_128.svg',
    'fae/fae_skirmish_128.svg',
    'fae/fae_battle_128.svg',
    'animals/animals_castle_128.svg',
    'dragonborn/dragonborn_castle_128.svg'
  ];
  const correctedResults=await page.evaluate(async files=>Promise.all(files.map(async file=>{
    const src='assets/kingdom-map/'+file;
    const response=await fetch(src,{cache:'no-store'});
    const markup=response.ok?await response.text():'';
    const img=new Image();img.src=src;
    try{await img.decode();}catch{return {file,ok:false,reason:'SVG decode failed'};}
    const canvas=document.createElement('canvas');
    canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(img,0,0,128,128);
    const pixels=ctx.getImageData(0,0,128,128).data;
    let visible=0;
    for(let i=3;i<pixels.length;i+=4)if(pixels[i]>40)visible++;
    const cornerAlpha=pixels[3];
    return {file,ok:response.ok&&
      (response.headers.get('content-type')||'').includes('image/svg+xml')&&
      markup.includes('<path')&&markup.includes('id="corrected-alpha"')&&
      !markup.includes('<image')&&img.naturalWidth===128&&img.naturalHeight===128&&
      cornerAlpha===0&&visible>150,
      visible,cornerAlpha,bytes:markup.length};
  })),correctedSprites);
  for(const sprite of correctedResults)
    assert(sprite.ok,'Corrected vector sprite must decode with real alpha: '+JSON.stringify(sprite));
  const manifest=await page.evaluate(async()=>{
    const response=await fetch('assets/kingdom-parchment/extra-manifest.json');
    if(!response.ok)throw Error('Parchment manifest missing: '+response.status);
    return response.json();
  });
  assert.equal(manifest.version,1);
  for(const old of ['road_segments','river_segments','territory_border_accents_optional'])
    assert.equal(old in manifest.groups,false,'retired road/river/border art stays out of build');
  assert.equal(Object.keys(manifest.groups).length,7,
    'the atlas contains five core groups, one marsh group and one landmark group');
  assert.equal(manifest.groups.marsh_wasteland_optional?.length,16,
    'all sixteen correct marsh PNGs are included');
  assert(manifest.groups.marsh_wasteland_optional.includes('01_pale_marsh.'+parchmentFormat)&&
    !manifest.groups.marsh_wasteland_optional.includes('01_straight_line.'+parchmentFormat),
    'marsh sprites must not be mislabeled frame shapes');
  for(const [group,names] of Object.entries(manifest.groups)){
    assert.equal(names.length,16,'each valid sprite group has 16 assets: '+group);
    assert(names.every(name=>name.endsWith('.'+parchmentFormat)),
      'sprite group must match the SVG/PNG build: '+group);
  }
  const expectedCore=['fog_of_war_shapes','forest_clusters','hills_rocks',
    'mountain_clusters','parchment_base_variations'];
  for(const key of expectedCore)assert(key in manifest.groups,'core sprite group missing: '+key);
  for(const group of Object.keys(manifest.groups).filter(key=>!expectedCore.includes(key))){
    const first=manifest.groups[group][0];
    const decoded=await page.evaluate(async path=>{
      const img=new Image();img.src=path;
      try{await img.decode();return img.naturalWidth===128&&img.naturalHeight===128}
      catch{return false}
    },'assets/kingdom-parchment/'+group+'/'+first);
    assert.equal(decoded,true,'new optional sprite group must decode: '+group);
  }
  await page.waitForFunction(()=>
    document.querySelector('[data-kingdom-parchment]')?.dataset.parchmentArt==='loaded',
    null,{timeout:15000});
  await page.waitForFunction(()=>document.querySelector('[data-kingdom-parchment]')?.dataset.parchmentTexture==='loaded');
  const tileAsset=await page.evaluate(async()=>{
   const response=await fetch('assets/kingdom-parchment/parchment_tile_256.webp');
   const bytes=await response.arrayBuffer();
   const image=await createImageBitmap(new Blob([bytes],{type:'image/webp'}));
   return {ok:response.ok,size:bytes.byteLength,w:image.width,h:image.height};
  });
  assert(tileAsset.ok&&tileAsset.w===256&&tileAsset.h===256&&tileAsset.size<5000,
    'real compressed user parchment WebP is repeated in the renderer, without paper noise');
  assert.equal(await atlas.getAttribute('data-parchment-art'),'loaded',
    'the parchment renderer uses the authored artwork rather than its fallback');
  // Procedural world-space roads and rivers are independent of the retired
  // road_segments/river_segments assets: exercise both Canvas stroke types.
  const lineArt=await page.evaluate(async()=>{
    const {drawWaterRoads}=await import('./js/kingdom-parchment-app.mjs');
    const canvas=document.createElement('canvas');
    canvas.width=11*142;canvas.height=7*142;
    const ctx=canvas.getContext('2d'),paintedStrokes=new Set();
    const stroke=ctx.stroke.bind(ctx);
    ctx.stroke=(...args)=>{paintedStrokes.add(ctx.strokeStyle);return stroke(...args);};
    drawWaterRoads(ctx,'kingdom-test-seed',-5,-3,11,7);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let painted=0;for(let k=3;k<pixels.length;k+=32)if(pixels[k]>0)painted++;
    return {river:paintedStrokes.has('#849a9e'),road:paintedStrokes.has('#b6a17c'),painted};
  });
  assert(lineArt.river&&lineArt.road&&lineArt.painted>10,
    'real procedural Canvas strokes must render roads and rivers without retired SVGs');
  assert.equal(await page.locator('[data-kingdom-cell]').count(),expectedViewportCells,
    'changing artwork cannot change the atlas-scaled logical grid');
  const terrain=await atlas.evaluate(canvas=>{
    const world=document.querySelector('.km-world');
    const ctx=canvas.getContext('2d');
    const center=ctx.getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data;
    const corner=ctx.getImageData(20,20,1,1).data;
    return {w:canvas.width,h:canvas.height,pixels:[...center,...corner],
      bg:getComputedStyle(document.querySelector('[data-kingdom-cell="0,0"]')).backgroundImage,
      fogCells:document.querySelectorAll('.km-cell--fog').length,
      questionMarks:document.querySelectorAll('.km-fog-mark').length,
      worldWidth:world.getBoundingClientRect().width};
  });
  assert(terrain.w>=terrain.worldWidth&&terrain.h>=7*142,
    'procedural landscape covers the visible infinite-world viewport');
  assert.equal(terrain.bg,'none','parchment mode hides individual racial chessboard textures');
  assert(terrain.fogCells>0,'unscouted cells remain covered by fog');
  assert.equal(terrain.questionMarks,0,'fog never shows question-mark markers');
  const scoutedEvents=Object.entries(before.kingdomMap.cells).filter(([,cell])=>cell.selectedEncounter);
  assert(scoutedEvents.length>0,'world stores deterministic future encounters');
  for(const [id,cell] of scoutedEvents){
    if(cell.explored||before.kingdomMap.centralOwnedCells.includes(id)||
      (before.kingdomMap.outposts||[]).some(p=>p.cells.includes(id)))continue;
    assert.equal(await page.locator('[data-kingdom-cell="'+id+'"] img.km-object--site').count(),0,
      'unexplored site '+id+' is concealed, even if assigned in save');
    assert.equal(await page.locator('[data-kingdom-cell="'+id+'"] .km-object--defender').count(),0,
      'unexplored defender cannot leak through fog');
  }
  assert.equal(await page.locator('.km-parchment-fog').count(),1,
    'the upper fog canvas covers the parchment and site art');
  const territoryFog=await page.evaluate(()=>{
    const canvas=document.querySelector('.km-parchment-fog');
    const ctx=canvas.getContext('2d');
    const columns=Math.round(document.querySelector('.km-world').clientWidth/142);
    const cellPx=canvas.width/columns;
    const cells=[...document.querySelectorAll('[data-kingdom-cell]')];
    function alpha(id){
      const i=cells.findIndex(cell=>cell.dataset.kingdomCell===id);
      if(i<0)throw Error('Missing visible test cell '+id);
      return ctx.getImageData(Math.floor((i%columns+.5)*cellPx),
        Math.floor((Math.floor(i/columns)+.5)*cellPx),1,1).data[3];
    }
    return {owned:alpha('1,0'),unowned:alpha('4,3')};
  });
  assert.equal(territoryFog.owned,0,
    'owned but unvisited territory is fully clear of parchment fog');
  assert(territoryFog.unowned>0,
    'unowned and unvisited territory remains hidden by parchment fog');
  assert(before.kingdomMap.centralOwnedCells.includes('1,0'),
    'the eastern start tile belongs to the kingdom without a king visit');
  assert.notEqual(await page.locator('[data-kingdom-cell="1,0"]').getAttribute('aria-label'),'Неизведанная территория',
    'owned territory reveals its encounter even before the king visits');
  assert.equal(await page.locator('[data-kingdom-cell="1,0"] .km-object--site').count(),1,
    'owned territory immediately reveals its encounter SVG');
  assert(terrain.pixels[3]>0&&terrain.pixels[7]>0,
    'procedurally painted terrain and fog must both have visible pixels');
  assert.deepEqual(await read(page),before,'retired Classic preference must not modify the Journey save');
  await page.screenshot({path:path.join(output,'kingdom-parchment-experiment.png')});
  // Issue #191: record actual playable PNG map states at default/min/max zoom
  // without creating another permanent browser suite.
  if(process.env.RPCHESS_PARCHMENT_QA_SCREENSHOT_DIR){
    const qaDir=process.env.RPCHESS_PARCHMENT_QA_SCREENSHOT_DIR;
    fs.mkdirSync(qaDir,{recursive:true});
    const format='png'; // Production and Preview always use PNG.
    const sample=await page.evaluate(async extension=>{
      const target='assets/kingdom-parchment/forest_clusters/01_small_grove.'+extension;
      const response=await fetch(target,{cache:'no-store'});
      return {status:response.status,mime:response.headers.get('content-type')||'',
        bytes:(await response.arrayBuffer()).byteLength,target};
    },format);
    assert.equal(sample.status,200,'the raster/vector artwork must be served');
    assert(sample.mime.includes(format==='png'?'image/png':'image/svg+xml'),
      'sample artwork must have the expected MIME: '+JSON.stringify(sample));
    const capture=async(name,expected)=>{
      await page.waitForFunction(expected=>globalThis.RPChessKingdomMap?.zoom===expected&&
        document.querySelector('[data-kingdom-world]')?.dataset.mapZoom===String(expected),
        expected,{timeout:15000});
      await page.waitForTimeout(250); // let deferred canvas images complete before the screenshot
      await page.screenshot({path:path.join(qaDir,name+'.png'),fullPage:false});
    };
    await capture('desktop-1366x768-default',117);
    const zoomTo=async(kind,count)=>{
      await page.evaluate(({kind,count})=>{
        const control=document.querySelector('[data-kingdom-zoom-'+kind+']');
        for(let n=0;n<count;n++)control.click();
      },{kind,count});
    };
    await zoomTo('out',30);
    await capture('desktop-1366x768-min55',55);
    await zoomTo('in',30);
    await capture('desktop-1366x768-max220',220);
    await page.locator('[data-kingdom-zoom-reset]').click();
    await page.setViewportSize({width:844,height:390});
    await capture('phone-844x390-default',117);
    await zoomTo('out',30);
    await capture('phone-844x390-min55',55);
    await zoomTo('in',30);
    await capture('phone-844x390-max220',220);
    await page.locator('[data-kingdom-zoom-reset]').click();
    await page.setViewportSize({width:1366,height:768});
    await page.waitForFunction(()=>globalThis.RPChessKingdomMap?.zoom===117&&
      document.querySelector('[data-kingdom-world]')?.dataset.mapZoom==='117');
    // Headless Chromium CI benchmark: alternate adjacent zoom levels to
    // force real map redraws. Informational only, not a device-FPS guarantee.
    const frames=await page.evaluate(()=>new Promise(resolve=>{
      const plus=document.querySelector('[data-kingdom-zoom-in]');
      const minus=document.querySelector('[data-kingdom-zoom-out]');
      const samples=[];let last=null,n=0;
      const frame=now=>{
        if(last!==null)samples.push(now-last);
        last=now;
        if(n<120){
          (n%2===0?plus:minus).click();
          n++;requestAnimationFrame(frame);
        }else resolve(samples);
      };
      requestAnimationFrame(frame);
    }));
    await page.locator('[data-kingdom-zoom-reset]').click();
    const sorted=[...frames].sort((a,b)=>a-b),elapsed=frames.reduce((a,b)=>a+b,0);
    const resourceStats=await page.evaluate(()=>{
      const all=performance.getEntriesByType('resource').filter(x=>
        x.name.includes('/assets/kingdom-parchment/'));
      return {requests:all.length,meanDurationMs:all.length?
        all.reduce((n,x)=>n+x.duration,0)/all.length:0,
        maxDurationMs:Math.max(0,...all.map(x=>x.duration))};
    });
    const perf={format,sample,resourceStats,headlessCI:true,activeZoomFrames:frames.length,
      fps:elapsed?1000*frames.length/elapsed:0,
      medianFrameMs:sorted[Math.floor(sorted.length*.5)],
      p95FrameMs:sorted[Math.floor(sorted.length*.95)]};
    fs.writeFileSync(path.join(qaDir,'parchment-map-benchmark.json'),
      JSON.stringify(perf,null,2)+'\n');
    console.log('Parchment real game benchmark: '+JSON.stringify(perf));
    assert.equal(await page.evaluate(()=>globalThis.RPChessKingdomMap.zoom),117);
  }
  assert.equal(await atlas.count(),1,'parchment remains the only supported Kingdom map skin');

  assert.deepEqual(before.kingdomMap.king,{x:0,y:0});
  assert.equal(before.kingdomMap.day,1,'new game begins on Day 1');
  assert.equal(before.kingdomMap.centralOwnedCells.length,6,
    'castle and five automatic lands exist without visiting their cells');
  assert.equal(await page.locator('[data-kingdom-annex]:visible').count(),0,
    'manual annex button disappears when territory is automatic');
  assert.equal(await page.locator('[data-kingdom-cell="4,3"] .km-object').count(),0,
    "unscouted cells have neither question marks nor encounter art");
  assert.equal(await page.locator(".km-fog-mark").count(),0,
    "the permanent parchment map never draws mystery punctuation");
  const castleCard=page.locator('[data-kingdom-castle-card="humans"]');
  assert.equal(await castleCard.count(),1,'castle opens its own race-specific inspector card');
  assert((await castleCard.locator('.km-route-card__visual').evaluate(el=>
    el.style.getPropertyValue('--km-card-backdrop'))).includes('/backgrounds/humans/'),
    'human castle card uses a human-race scene rather than the generic campaign');
  const castleSprite=page.locator('[data-kingdom-cell="0,0"] img.km-object');
  assert.equal(await castleSprite.getAttribute('src'),
    'assets/kingdom-map/humans/humans_castle_128.svg');
  await page.waitForFunction(()=>{
    const sprite=document.querySelector('[data-kingdom-cell="0,0"] img.km-object');
    return sprite?.complete&&sprite.naturalWidth===128&&sprite.naturalHeight===128;
  },null,{timeout:15000});
  // Author's Atlas Lab visual preset (5) zoom is 117 physical px/cell; contents retain 73%/92:142 proportions.
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
    king:{width:king.getBoundingClientRect().width,height:king.getBoundingClientRect().height},
    object:{width:artwork.width,height:artwork.height,left:artwork.left,right:artwork.right,
      top:artwork.top,bottom:artwork.bottom,fit:getComputedStyle(object).objectFit},
    cellOverflow:getComputedStyle(document.querySelector('[data-kingdom-cell="0,0"]')).overflow,
    inspector:{width:inspector.width,left:inspector.left,right:inspector.right}};
  });
  assert(dimensions.world.left<=dimensions.frame.left&&dimensions.world.right>=dimensions.frame.right&&
    dimensions.world.top<=dimensions.frame.top&&dimensions.world.bottom>=dimensions.frame.bottom,
    'enlarged cells must fill the map frame with no empty gutters');
  assert(Math.abs(dimensions.tile.width-117)<1&&Math.abs(dimensions.tile.height-117)<1,
    'author preset (5) renders 117px square cells initially');
  assert(Math.abs(dimensions.king.width-92*117/142)<1&&Math.abs(dimensions.king.height-92*117/142)<1,
    'the named king scales uniformly with the world');
  assert(Math.abs(dimensions.object.width-117*.73)<1&&Math.abs(dimensions.object.height-117*.73)<1,
    'SVG art remains 73% of the scaled tile');
  assert(dimensions.object.fit==='contain'&&dimensions.cellOverflow==='visible',
    'SVG is contained without object clipping or unwanted stretching');
  assert(dimensions.object.left>=dimensions.tile.left&&dimensions.object.right<=dimensions.tile.right&&
    dimensions.object.top>=dimensions.tile.top&&dimensions.object.bottom<=dimensions.tile.bottom,
    'full SVG artwork fits inside its own square');
  assert(Math.abs(dimensions.inspector.width-dimensions.frame.width*.25)<3&&
    dimensions.inspector.left>dimensions.frame.left&&dimensions.inspector.right<dimensions.frame.right,
    'inspector floats over the map and occupies 25% of its width');
  // Zoom is only a visual preference: mouse wheel, touch pinch and reset
  // cannot advance a run, change an encounter or charge Supplies.
  const beforeZoomRun=await read(page);
  await page.locator('.km-map-frame').hover({position:{x:260,y:180}});
  await page.mouse.wheel(0,-250);
  await page.waitForFunction(()=>globalThis.RPChessKingdomMap?.zoom>117);
  const wheelZoom=await page.evaluate(()=>globalThis.RPChessKingdomMap.zoom);
  const wheelCell=await page.locator('[data-kingdom-cell="0,0"]').evaluate(el=>el.getBoundingClientRect().width);
  assert(Math.abs(wheelCell-wheelZoom)<1,'mouse wheel magnifies actual map geometry');
  await page.evaluate(()=>{
    const frame=document.querySelector('.km-map-frame');
    const emit=(kind,id,x,y)=>frame.dispatchEvent(new PointerEvent(kind,{bubbles:true,
      cancelable:true,pointerId:id,pointerType:'touch',clientX:x,clientY:y}));
    emit('pointerdown',71,260,260);emit('pointerdown',72,360,260);
    emit('pointermove',72,440,260);
    emit('pointerup',72,440,260);emit('pointerup',71,260,260);
  });
  await page.waitForFunction(previous=>globalThis.RPChessKingdomMap?.zoom>previous,wheelZoom);
  assert.equal((await read(page)).kingdomMap.pendingCell,null,
    'two-finger zoom must not accidentally start a Journey encounter');
  await page.locator('[data-kingdom-zoom-reset]').click();
  await page.waitForFunction(()=>globalThis.RPChessKingdomMap?.zoom===117);
  // updateZoom schedules a paint; wait for the actual replacement DOM as well.
  await page.waitForFunction(()=>document.querySelector('[data-kingdom-world]')?.dataset.mapZoom==='117');
  assert.equal(await page.evaluate(()=>localStorage.getItem('rpchess.kingdom.zoom.v2')),'117',
    'reset restores the author zoom and persists it');
  assert.deepEqual(await read(page),beforeZoomRun,'zoom must never edit the run or its saved cells');
  await assertTileImage(page,'0,0','assets/races/humans/board/white.png');
  assert.equal(await page.locator('[data-kingdom-glory]').textContent(),'0',
    'current Glory uses the Chronicle formula, not an invented currency');
  assert.equal(await page.locator('[data-kingdom-day]').textContent(),'День 1',
    'the left header contains only the new Day counter');
  assert.equal(await page.locator('.km-heading').innerText(),'День 1');
  assert.equal(await page.locator('[data-kingdom-shards]').textContent(),'37',
    'Honor shards reflect the persistent Arena ledger, not current run data');
  assert.equal(await page.locator('[data-kingdom-points]').textContent(),'6',
    'the header shows six distinct owned tiles: castle plus five automatic lands');
  const liveNpcCount=Number(await page.locator('[data-kingdom-travelers]').getAttribute('data-walker-count'));
  assert(Number.isInteger(liveNpcCount)&&liveNpcCount<=5,
    'Five annexed lands (plus the castle) may spawn at most five decorative NPCs, one per type');
  assert.equal(await page.locator('[data-kingdom-power]').textContent(),'500',
    'Power appears in the shared resource strip with its real rating');
  assert.equal(await page.locator('[data-kingdom-threat]').count(),0,
    'do not show the player Threat stars in the Kingdom header');
  assert.equal(await page.locator('.km-power-group').count(),0,
    'the old separate Power/Threat block has been removed');
  const portraitSize=await page.locator('[data-kingdom-portrait]').evaluate(img=>{
    const bounds=img.getBoundingClientRect();
    return {width:bounds.width,height:bounds.height,loaded:img.complete&&img.naturalWidth>0};
  });
  assert(portraitSize.loaded&&portraitSize.width>=70&&portraitSize.height>=70,
    'the named king portrait is enlarged to 72px and its image loads');
  for(const [kind,src] of [
    ['power','generated_assets/node_battle.png'],
    ['glory','assets/relics/banner_nine.png'],
    ['points','assets/relics/diplomat_seal.png'],
    ['shards','assets/arena/mirror_shard.png']
  ]){
    const icon=page.locator('.km-resource--'+kind+' img');
    assert.equal(await icon.getAttribute('src'),src);
    await page.waitForFunction(kind=>{
      const image=document.querySelector('.km-resource--'+kind+' img');
      return image?.complete&&image.naturalWidth>0;
    },kind,{timeout:15000});
  }
  const hudBounds=await page.evaluate(()=>{
    const rect=selector=>{
      const box=document.querySelector(selector).getBoundingClientRect();
      return {left:box.left,right:box.right,top:box.top,bottom:box.bottom};
    };
    return {header:rect('.km-header'),day:rect('.km-heading h1'),
      portrait:rect('.km-commander-meta'),resources:rect('.km-resource-group'),
      actions:rect('.km-actions')};
  });
  assert(hudBounds.day.right<hudBounds.portrait.left &&
    hudBounds.portrait.right<=hudBounds.resources.left+3 &&
    hudBounds.resources.right<=hudBounds.actions.left+3 &&
    hudBounds.actions.right<=hudBounds.header.right+1,
    'Day, commander, resources and action buttons must not overlap at 1366x768');
  const resourceMetrics=await page.locator('.km-resource-group').evaluate(group=>{
    const bounds=group.getBoundingClientRect();
    return {bounds:{left:bounds.left,right:bounds.right},items:[...group.querySelectorAll('.km-resource')].map(item=>{
      const icon=item.querySelector('img').getBoundingClientRect();
      const value=item.querySelector('strong');
      const box=item.getBoundingClientRect();
      return {left:box.left,right:box.right,iconSize:icon.width,
        valueFont:parseFloat(getComputedStyle(value).fontSize)};
    })};
  });
  assert.equal(resourceMetrics.items.length,6,'Power and five currencies all stay visible');
  for(const [index,item] of resourceMetrics.items.entries()){
    assert(item.iconSize>=43&&item.valueFont>=21,
      'resource '+index+' should display enlarged icon (44px) and value (22px)');
    assert(item.left>=resourceMetrics.bounds.left-1&&item.right<=resourceMetrics.bounds.right+1,
      'resource '+index+' must stay within its header area at 1366x768');
    if(index)assert(item.left>=resourceMetrics.items[index-1].right,
      'resource '+index+' must not overlap the preceding counter');
  }
  await page.evaluate(()=>globalThis.RPChessI18n.setLanguage('en'));
  assert.equal(await page.locator('[data-kingdom-day]').textContent(),'Day 1');
  assert.equal(await page.locator('.km-resource--shards').getAttribute('title'),'Honor shards');
  await page.evaluate(()=>globalThis.RPChessI18n.setLanguage('ru'));
  assert.equal(await page.locator('[data-kingdom-day]').textContent(),'День 1');
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
  // The king animation is short; observe it from the start instead of
  // attaching a locator after heavyweight SVG decoding has already finished.
  await page.evaluate(()=>{
    window.__kingMotion={seen:false,animationName:null,story:null,arrival:null,activeAtStory:null};
    const center=selector=>{
      const r=document.querySelector(selector)?.getBoundingClientRect();
      return r?{x:(r.left+r.right)/2,y:(r.top+r.bottom)/2}:null;
    };
    new MutationObserver(()=>{
      const snap=window.__kingMotion,king=document.querySelector('.km-king--moving');
      if(king&&!snap.seen){
        snap.seen=true;snap.animationName=getComputedStyle(king).animationName;
      }
      const story=document.querySelector('[data-kingdom-cell="1,0"] .km-flavor-flyout');
      if(story?.textContent?.trim()&&!snap.story){
        snap.story=story.textContent.trim();
        snap.storyFontPx=Number.parseFloat(getComputedStyle(story).fontSize);
        snap.arrival={castle:center('[data-kingdom-cell="0,0"]'),
          east:center('[data-kingdom-cell="1,0"]'),king:center('.km-king')};
        snap.activeAtStory=JSON.parse(localStorage.getItem('rpchess.reboot.v1.run')||'null')?.activeTravelChoice||null;
      }
    }).observe(document.querySelector('[data-kingdom-world]'),{childList:true,subtree:true});
  });
  const clicked=Date.now();
  await page.locator('[data-kingdom-cell="1,0"]').click();
  assert.deepEqual((await read(page)).kingdomMap.king,{x:0,y:0},
    'click selects the adjacent event for inspection, never moves the king');
  assert.equal(await page.locator('[data-kingdom-route-card]').count(),1,
    'selecting owned territory shows its already discovered route details');
  await dragKing(page,'1,0');
  assert.equal(await page.locator('[data-kingdom-route-card]').count(),1,
    'route details become available only after the king enters');
  const moved=await read(page);
  const encounter=moved.kingdomMap.cells['1,0'].selectedEncounter;
  assert(encounter&&encounter.kingdomCell==='1,0','the selected coordinate gets exactly one saved route');
  assert(['battle','skirmish','caravan','event','settlement','puzzle'].includes(encounter.type));
  assert.deepEqual(moved.kingdomMap.king,{x:1,y:0});
  assert.equal(moved.kingdomMap.cells['1,0'].status,'revealed');
  const race=encounter.enemyRaceTag||encounter.raceTag;
  const role=['pawn','knight','bishop','rook','queen','king'][Math.floor((encounter.stars-1)/2)];
  const expectedPiece=`assets/races/${race}/pieces/board/black/${role}.png`;
  const expectedSite=`assets/kingdom-map/${race}/${race}_battle_128.svg`;
  const site=page.locator('[data-kingdom-cell="1,0"] img.km-object--site');
  const defender=page.locator('[data-kingdom-cell="1,0"] img.km-object--defender');
  assert.equal(await site.getAttribute('src'),expectedSite,
    'Battle location SVG must stay visible on the map beneath the guardian');
  assert.equal(await defender.getAttribute('src'),expectedPiece,
    'enemy race/Threat figure guards the site as a separate foreground sprite');
  await assertTileImage(page,'1,0','assets/races/'+race+'/board/black.png');
  await page.waitForFunction(()=>{
    const cell=document.querySelector('[data-kingdom-cell="1,0"]');
    return [...cell.querySelectorAll('img.km-object')].length===2 &&
      [...cell.querySelectorAll('img.km-object')].every(img=>img.complete&&img.naturalWidth>0);
  },null,{timeout:15000});
  const layers=await page.locator('[data-kingdom-cell="1,0"]').evaluate(cell=>{
    const back=cell.querySelector('.km-object--site');
    const front=cell.querySelector('.km-object--defender');
    const a=back.getBoundingClientRect(),b=front.getBoundingClientRect();
    return {siteSize:a.width,defenderSize:b.width,
      siteDepth:Number(getComputedStyle(back).zIndex),
      defenderDepth:Number(getComputedStyle(front).zIndex),
      overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top};
  });
  assert(layers.siteSize>layers.defenderSize&&layers.defenderDepth>layers.siteDepth&&layers.overlap,
    'enemy guardian must be smaller, overlaid and visually in front of the site');
  const stepPrice=before.kingdomMap.centralOwnedCells.includes('1,0')?0:1;
  assert.equal(moved.supplies,before.supplies-stepPrice,
    'the arrival step charges exactly one Supply outside owned territory');
  assert(!fs.readFileSync(path.join(__dirname,'../game/css/kingdom-map.css'),'utf8').includes("content:'?'"),
    'fog reveal animation cannot reintroduce question marks');
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
  assert.equal(await routeCard.locator('.km-route-card__icon').getAttribute('src'),expectedSite,
    'the right card must preserve the original site SVG beneath the defender');
  assert.equal(await routeCard.locator('.km-route-card__defender').getAttribute('src'),expectedPiece,
    'the right card must also render the enemy guard on top of the site');
  assert.equal(await routeCard.locator('.km-route-card__stars').count(),1,'route card shows real difficulty stars');
  assert.equal(await routeCard.locator('.km-route-resource').count(),2,
    'Battle route card displays supply cost and gold reward');
  assert.equal(await routeCard.locator('.travel-choice-card__flavor,.km-route-card__flavor').count(),0,
    'literary flavor must not be duplicated in the information card');
  const still=await centers();
  assert(Math.hypot(still.king.x-beforeCenters.king.x,still.king.y-beforeCenters.king.y)<4,
    'opening cell must not move the king yet');
  await page.waitForFunction(()=>window.__kingMotion?.seen,{timeout:5000});
  assert.equal(await page.evaluate(()=>window.__kingMotion.animationName),'km-king-step',
    'the king must visibly animate into the chosen adjacent cell');
  // Capture the short narrative and landing position when they appear.
  // Dense vector terrain may keep the test busy until after the UI hides.
  await page.waitForFunction(()=>Boolean(window.__kingMotion?.story),{timeout:8000});
  const captured=await page.evaluate(()=>window.__kingMotion);
  assert(captured.story.length>0,'the original route narrative flies out of the entered tile');
   assert(Math.abs(captured.storyFontPx-2*Math.max(13,Math.min(17,1366*.012)))<1,
     'pre-encounter narrative font must be twice as large');
  const afterCenters=captured.arrival;
  const near=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y)<4;
  assert(near(afterCenters.castle,beforeCenters.castle),
    'the castle must remain at the same screen position after moving one tile');
  assert(near(afterCenters.east,beforeCenters.east),
    'the clicked tile must remain at the same screen position');
  assert(near(afterCenters.king,afterCenters.east),
    'the king must visibly land on the exact clicked tile');
  assert.equal(await page.locator('[data-kingdom-cell="1,0"].km-cell--here').count(),1);
  assert.equal(await page.locator('[data-travel-choice]').count(),0,'no three-card popup appears');
  assert.equal(captured.activeAtStory,null,'the narrative appears before combat starts');
  if(await page.locator('[data-kingdom-map-screen]:not([hidden])').count())
    await page.screenshot({path:path.join(output,'kingdom-02-revealed.png')});
  await page.waitForFunction(k=>{
   const r=JSON.parse(localStorage.getItem(k)||'null');
   return r?.activeTravelChoice?.kingdomCell==='1,0'&&r?.kingdomMap?.cells?.['1,0']?.status==='in_progress';
  },key,{timeout:15000});
  const elapsed=Date.now()-clicked;
  assert(elapsed>=3850,'encounter waits for reveal, king movement and readable narrative');
  const started=await read(page);
  assert.equal(started.activeTravelChoice.id,encounter.id);
  assert.equal(started.supplies,moved.supplies,'the encounter cannot bill an already paid step twice');
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
   // Scene visibility may precede the inspector's asynchronous final paint.
   // Wait for the settled single card; never accept a persistent duplicate.
   await page.waitForFunction(()=>document.querySelectorAll('[data-kingdom-route-card]').length===1,
     null,{timeout:7000});
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
   await dragKing(page,'0,1');
   const second=await read(page);
   assert.deepEqual(second.kingdomMap.king,{x:0,y:1},
     'the king must be able to make a second Journey step after Battle; '+
      JSON.stringify(await page.evaluate(()=>({
       events:window.__kingDragEvents||[],hit:window.__kingStartHit,
       handle:document.querySelector('[data-kingdom-king-handle]')?.getBoundingClientRect().toJSON(),
       target:document.querySelector('[data-kingdom-cell="0,1"]')?.getBoundingClientRect().toJSON(),
       scene:document.querySelector('[data-kingdom-map-screen]')?.hidden
      }))));
   assert(second.kingdomMap.day>=4,'new map cell and earlier failed completion each advance the calendar');
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
   assert.equal(won.kingdomMap.completedRoads.length,1,
     'first completed Battle creates exactly one historical road');
   assert.deepEqual({from:won.kingdomMap.completedRoads[0].from,
     to:won.kingdomMap.completedRoads[0].to},{from:'0,0',to:'0,1'});
   const completedTile=page.locator('[data-kingdom-cell="0,1"]');
   assert.equal(await completedTile.locator('.km-object--defender').count(),0,
     'the defeated racial guardian disappears; the site remains');
   assert.equal(await completedTile.locator('.km-object--site').count(),1);
   const completedCard=page.locator('[data-kingdom-route-card]');
   assert.equal(await completedCard.getAttribute('data-kingdom-route-status'),'completed',
     'finished events retain their original beautiful route card');
   assert.equal(await completedCard.locator('.km-route-card__icon').count(),1);
   assert.equal(await completedCard.locator('.km-route-card__defender').count(),0);
   assert.equal(await completedCard.locator('.km-route-card__cleared').count(),0,
     'cleared cards must not repeat the redundant location-completed explanation');
   assert(!/Место освоено|This location is cleared/i.test(await completedCard.innerText()),
     'completed card must omit the deprecated verbose cleared message');
   assert.equal(await completedCard.locator('.km-route-resource').count(),0,
     'a completed encounter does not advertise a fresh supply charge or repeat reward');
   assert.equal(await page.locator('.km-kingdom-overlay').count(),1,
     'organic territory and event roads work in the parchment skin');
   assert(Number(await page.locator('.km-kingdom-overlay').getAttribute('data-road-segments'))>=1,
      'royal roads connect the Castle and all eligible scouted owned events, not only completed events');
   const pavedLayer=await page.locator('[data-kingdom-parchment]').evaluate(canvas=>({
     layer:canvas.dataset.roadLayer,segments:Number(canvas.dataset.playerRoadSegments),
     z:Number(getComputedStyle(canvas).zIndex),
     overlayZ:Number(getComputedStyle(document.querySelector('.km-kingdom-overlay')).zIndex)
   }));
   assert(pavedLayer.layer==='terrain'&&pavedLayer.segments>=1&&
     pavedLayer.z<pavedLayer.overlayZ,
     'player roads and organic roads must share the terrain canvas and alpha');
   const composition=await page.evaluate(()=>{
     const overlay=document.querySelector('.km-kingdom-overlay');
     const site=document.querySelector('[data-kingdom-cell="0,1"] .km-object--site');
     return {overlay:Number(getComputedStyle(overlay).zIndex),
       site:Number(getComputedStyle(site).zIndex),
       cellIsolation:getComputedStyle(site.closest('.km-cell')).isolation};
   });
   assert(composition.site>composition.overlay&&composition.cellIsolation!=='isolate',
     'roads stay beneath event/castle art, even on the parchment map');
   assert.equal(await page.locator('[data-kingdom-hint]').textContent(),'',
     'no select-the-neighbor instruction appears in completed route cards');
   assert(Number(await page.locator('.km-kingdom-overlay').getAttribute('data-glowing-owned-cells'))>0,
     'visible owned land has a subtle blue glow, clipped by fog scouting');
  await page.locator('[data-kingdom-cell="0,0"]').hover({position:{x:12,y:12}});
  const hoverLayers=await page.evaluate(()=>{
    const castle=document.querySelector('[data-kingdom-cell="0,0"]');
    const art=castle.querySelector('.km-object--castle');
    const overlay=document.querySelector('.km-kingdom-overlay');
    return {filter:getComputedStyle(castle).filter,z:getComputedStyle(castle).zIndex,
      artZ:getComputedStyle(art).zIndex,roadZ:getComputedStyle(overlay).zIndex};
  });
  assert(hoverLayers.filter==='none'&&hoverLayers.z==='auto'&&
    Number(hoverLayers.artZ)>Number(hoverLayers.roadZ),
    'the hovered castle stays in front of roads, without a cell stacking context');
   // Starting an encounter spends one Supply; on return the event tile reports
   // only the actual resource delta, not a fabricated repeat reward.
   const fx=completedTile.locator('.km-resource-burst');
   assert.equal(await fx.count(),0,
     'a previously paid walking Supply cannot be presented again as an encounter reward');
   await completedTile.click({position:{x:17,y:17}});
   assert.equal(await page.locator('[data-kingdom-route-card]').count(),1,
     'clicking a cleared location again never reverts to the empty inspector');
   assert.equal(await page.locator('[data-kingdom-route-card]').getAttribute('data-kingdom-route-status'),
     'completed');
   await dragKing(page,'0,2');
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
    const prior=await read(walking);
    const cost=prior.kingdomMap.centralOwnedCells.includes(id)?0:1;
    await walking.locator(cell).click({position:{x:20,y:20}});
    assert.deepEqual((await read(walking)).kingdomMap.king,{x:0,y:0},
      'a click on a distant/adjacent site must inspect, not move the king');
    await dragKing(walking,id);
    // A drag commits coordinates before the visual travel animation finishes;
    // inspect the sprite only after the world marks the transition idle.
    await walking.waitForFunction(()=>{
      const world=document.querySelector('[data-kingdom-world]');
      const king=document.querySelector('.km-king'),rect=king?.getBoundingClientRect();
      return world?.dataset.kingdomMotion==='idle'&&rect&&rect.width>0&&rect.height>0;
    },null,{timeout:9000});
    assert.deepEqual((await read(walking)).kingdomMap.king,{x:dx,y:dy},
      'dragging the king must move to the selected coordinate '+id);
    assert.equal((await read(walking)).supplies,Math.max(0,prior.supplies-cost),
      'each non-owned step consumes one Supply; owned ground is free');
    assert.equal(await walking.locator(cell+'.km-cell--here').count(),1,
      'king marker must be on the clicked world tile '+id);
    const actual=await visual('.km-king'),target=await visual(cell);
    assert(Math.hypot(actual.x-target.x,actual.y-target.y)<4,
      'king must visually occupy clicked '+id+': '+JSON.stringify({actual,target}));
    const anchored=await visual('[data-kingdom-cell="0,0"]');
    if(dy===0)assert(Math.hypot(anchored.x-castleAnchor.x,anchored.y-castleAnchor.y)<4,
      'horizontal one-step moves retain camera slack '+id);
    // The enlarged map pans one row vertically to keep adjacent targets visible.
    await dragKing(walking,'0,0');
    assert.deepEqual((await read(walking)).kingdomMap.king,{x:0,y:0},
      'dragging back to castle from '+id+': '+
      JSON.stringify(await walking.evaluate(()=>({
        events:window.__kingDragEvents||[],
        handle:document.querySelector('[data-kingdom-king-handle]')?.getBoundingClientRect().toJSON(),
        target:document.querySelector('[data-kingdom-cell="0,0"]')?.getBoundingClientRect().toJSON()
      }))));
  }
  // Mixed/unknown race cells retain neutral background tiles.
  await walking.evaluate(storage=>{
    const run=JSON.parse(localStorage.getItem(storage));
    run.kingdomMap.cells['1,0']={status:'completed',explored:true,annexed:false,
      selectedEncounter:{id:'kingdom.neutral-fixture',type:'event',raceTag:'mixed',stars:1}};
    run.kingdomMap.cells['-1,0']={status:'completed',explored:true,annexed:false,
      selectedEncounter:{id:'kingdom.elven-fixture',type:'event',raceTag:'elves',stars:1}};
    run.kingdomMap.cells['1,1']={status:'completed',explored:true,respawnReady:true,annexed:false,
      selectedEncounter:{id:'kingdom.orc-fixture',type:'battle',raceTag:'orcs',stars:1}};
    run.kingdomMap.cells['-1,1']={status:'completed',explored:true,annexed:false,
      selectedEncounter:{id:'kingdom.undead-fixture',type:'skirmish',raceTag:'undead',stars:4}};
    run.kingdomMap.cells['0,-1']={status:'completed',explored:true,annexed:false,
      selectedEncounter:{id:'kingdom.elven-caravan-fixture',type:'caravan',raceTag:'elves',stars:12}};
    localStorage.setItem(storage,JSON.stringify(run));
    globalThis.RPChessKingdomMap.open();
  },key);
  for(const [id,expected] of [['1,0','assets/boards/neutral/tile_dark.png'],
    ['-1,0','assets/races/elves/board/black.png'],
    ['1,1','assets/races/orcs/board/white.png']]){
    await assertTileImage(walking,id,expected);
  }
  const mixedSprite=walking.locator('[data-kingdom-cell="1,0"] img.km-object');
  const mixedSrc=await mixedSprite.getAttribute('src');
  assert(/^assets\/kingdom-map\/([a-z_]+)\/\1_event_128\.svg$/.test(mixedSrc),
    'old saved mixed Event renders a race SVG instead of the book icon');
  await walking.waitForFunction(()=>{
    const img=document.querySelector('[data-kingdom-cell="1,0"] img.km-object');
    return img?.complete&&img.naturalWidth===128;
  },null,{timeout:15000});
  await walking.evaluate(()=>globalThis.RPChessKingdomMap.open());
  assert.strictEqual(await walking.locator('[data-kingdom-cell="1,0"] img.km-object').getAttribute('src'),mixedSrc,
    'legacy mixed event SVG is stable after rerender');
  assert.strictEqual((await read(walking)).kingdomMap.cells['1,0'].selectedEncounter.raceTag,'mixed',
    'cosmetic SVG must not modify narrative race or neutral tile');
  assert.equal(await walking.locator('[data-kingdom-cell="1,0"] .km-object--defender').count(),0,
    'mixed narrative event keeps only its event SVG, no combat guardian');
  const orcCell=walking.locator('[data-kingdom-cell="1,1"]');
  assert.equal(await orcCell.locator('.km-object--site').getAttribute('src'),
    'assets/kingdom-map/orcs/orcs_battle_128.svg','saved Battle retains its location SVG');
  assert.equal(await orcCell.locator('.km-object--defender').getAttribute('src'),
    'assets/races/orcs/pieces/board/black/pawn.png','a respawned Battle restores the orc pawn');
  for(const [point,type,race,role] of [
    ['-1,1','skirmish','undead','knight'],['0,-1','caravan','elves','king']
  ]){
    const cell=walking.locator('[data-kingdom-cell="'+point+'"]');
    assert.equal(await cell.locator('.km-object--site').getAttribute('src'),
      `assets/kingdom-map/${race}/${race}_${type}_128.svg`,
      type+' preserves its racial encounter site artwork');
    assert.equal(await cell.locator('.km-object--defender').count(),0,
      type+' must not show a defeated figure before an actual respawn');
    await walking.waitForFunction(id=>{
      const cell=document.querySelector('[data-kingdom-cell="'+id+'"]');
      return [...cell.querySelectorAll('img.km-object')].length===1 &&
        [...cell.querySelectorAll('img.km-object')].every(img=>img.complete&&img.naturalWidth>0);
    },point,{timeout:15000});
  }
  // Weekly economy browser contract: real hit target, one claim, no double credit.
  await walking.evaluate(async storage=>{
    const core=await import('./js/kingdom-map-core.mjs?v=20261109-kingdom-economy-v7');
    const run=JSON.parse(localStorage.getItem(storage));
    const owned=run.kingdomMap.centralOwnedCells.find(id=>id!=='0,0');
    window.__producerId=owned;
    run.kingdomMap.cells[owned]={status:'completed',explored:true,completedOnce:true,
      selectedEncounter:{id:'kingdom.production.fixture',type:'settlement',stars:1}};
    run.kingdomMap.day=1;run.kingdomMap.processedThroughWeek=0;
    run.kingdomMap.calendarActions=[];
    for(let n=0;n<6;n++)run.kingdomMap=core.advanceDay(run.kingdomMap,'browser-week:'+n);
    localStorage.setItem(storage,JSON.stringify(run));
    globalThis.RPChessKingdomMap.open();
  },key);
  const ownedProducer=await walking.evaluate(()=>window.__producerId);
  const collectButton=walking.locator('[data-kingdom-collect="'+ownedProducer+'"]');
  assert.equal(await collectButton.count(),1,'weekly icon floats separately above the settlement');
  assert.equal(await collectButton.getAttribute('data-production-kind'),'gold');
  const beforeClaim=(await read(walking)).gold;
  await collectButton.click();
  assert.strictEqual((await read(walking)).gold,beforeClaim+10);
  assert.equal(await walking.locator('[data-kingdom-collect="'+ownedProducer+'"]').count(),0);
  assert.equal((await read(walking)).kingdomMap.productionClaims.length,1);
  const afterClaim=(await read(walking)).gold;
  await walking.evaluate(()=>globalThis.RPChessKingdomMap.open());
  assert.strictEqual((await read(walking)).gold,afterClaim,
    'reopening the map never rewards an already-collected week');
  // Remote safe cell can become a paid outpost, using the very same Arena ledger.
  const firstOutpost=await walking.evaluate(async storage=>{
    const core=await import('./js/kingdom-map-core.mjs');
    const run=JSON.parse(localStorage.getItem(storage));
    if(!core.validateKingdomMap(run.kingdomMap))throw Error('Outpost QA map unexpectedly invalid');
    // The enemy-province layout varies with each new game's seed. Keep the
    // genuine no-building-on-enemy-land rule, not a fixed sometimes-hostile cell.
    const candidates=[];
    for(let x=-4;x<=4;x++)for(let y=-3;y<=3;y++)
      if(Math.abs(x)+Math.abs(y)>=3)candidates.push({x,y});
    candidates.sort((a,b)=>Math.abs(b.x)-Math.abs(a.x)||
      Math.abs(a.y)-Math.abs(b.y)||a.x-b.x||a.y-b.y);
    let id=null;
    for(const {x,y} of candidates){
      const candidate=x+','+y,original=run.kingdomMap.cells[candidate];
      run.kingdomMap.cells[candidate]={status:'completed',type:'empty',explored:true};
      if(core.canBuildOutpost(run.kingdomMap,{x,y})){id=candidate;break;}
      if(original)run.kingdomMap.cells[candidate]=original;
      else delete run.kingdomMap.cells[candidate];
    }
    if(!id)throw Error('No safe outpost cell within the map viewport');
    localStorage.setItem(storage,JSON.stringify(run));
    localStorage.setItem('rpchess.reboot.v1.arena',JSON.stringify({
      version:1,events:[{id:'kingdom:production:seed',kind:'kingdom-production',
        runId:'fixture',productionId:'fixture:seed',amount:100,at:1}],
      squad:'humans',match:null,updatedAt:1
    }));
    globalThis.dispatchEvent(new CustomEvent('rpchess:arena-updated'));
    globalThis.RPChessKingdomMap.open();
    return id;
  },key);
  // The 25% floating inspector overlaps edge cells; dispatch selection directly,
  // since pointer access to off-screen locations requires normal map panning.
  // A real king drag intentionally suppresses subsequent cell clicks for 500ms.
  // Wait out that input safety window rather than asserting a suppressed click.
  const outpostEligibility=await walking.evaluate(async({storage,id})=>{
    const {canBuildOutpost,isOwned}=await import('./js/kingdom-map-core.mjs');
    const map=JSON.parse(localStorage.getItem(storage)).kingdomMap;
    const [x,y]=id.split(',').map(Number);
    return {canBuild:canBuildOutpost(map,{x,y}),owned:isOwned(map,{x,y}),
      pending:map.pendingCell,cell:map.cells[id]};
  },{storage:key,id:firstOutpost});
  assert(outpostEligibility.canBuild,
    'outpost fixture must be safe and eligible before UI interaction: '+
    JSON.stringify(outpostEligibility));
  await walking.waitForTimeout(550);
  await walking.locator('[data-kingdom-cell="'+firstOutpost+'"]').dispatchEvent('click');
  assert.equal(await walking.locator('[data-kingdom-cell="'+firstOutpost+'"].km-cell--selected').count(),1,
    'safe outpost cell must be selected by an accepted post-drag click');
  const buildButton=walking.locator('[data-kingdom-outpost]');
  assert.equal(await buildButton.count(),1);
  assert(await buildButton.isVisible(),'safe explored unowned land enables the outpost button');
  assert.equal(await buildButton.locator('img.km-shard-inline').getAttribute('src'),
    'assets/arena/mirror_shard.png','outpost button uses Arena shard art');
  assert(!(await buildButton.textContent()).includes('Осколки чести'),
    'outpost price never spells out the currency name');
  assert.equal(await buildButton.isDisabled(),false,'shared shards are enough for construction');
  await buildButton.click();
  assert.equal((await read(walking)).kingdomMap.outposts.length,1);
  assert.equal((await read(walking)).kingdomMap.day,8,'outpost construction advances one day');
  const outpostIcon=walking.locator('[data-kingdom-cell="'+firstOutpost+'"] .km-object--outpost');
  assert.equal(await outpostIcon.count(),1);
  // Production strips parchment SVG masters; verify the actual outpost PNG
  // decodes even when the icon is outside the visible lazy-load viewport.
  const outpostArt=await outpostIcon.evaluate(async image=>{
    image.loading='eager';
    await image.decode();
    return {src:image.getAttribute('src'),width:image.naturalWidth,height:image.naturalHeight};
  });
  assert.deepStrictEqual(outpostArt,{
    src:'assets/kingdom-parchment/decor_minor_landmarks/04_watchtower.png',
    width:128,height:128
  },'completed outpost must load a real PNG after the conversion');
  if(process.env.RPCHESS_OUTPOST_SCREENSHOT_DIR){
    fs.mkdirSync(process.env.RPCHESS_OUTPOST_SCREENSHOT_DIR,{recursive:true});
    await walking.screenshot({
      path:path.join(process.env.RPCHESS_OUTPOST_SCREENSHOT_DIR,'outpost-built-1280x720.png'),
      fullPage:false
    });
  }
  assert.equal((await read(walking)).kingdomMap.outpostRoads.length,1,
    'building a remote outpost lays a single connected road without duplication');
  assert.equal(await walking.locator('[data-kingdom-outpost]:visible').count(),0,
    'built outpost cannot be bought again');
  const shardBalance=await walking.locator('[data-kingdom-shards]').textContent();
  assert.equal(shardBalance,'70','outpost price comes from the shared Arena ledger');
  // Unaffordable next outpost offers a real Arena redirect without touching the run.
  const secondOutpost=await walking.evaluate(async storage=>{
    const core=await import('./js/kingdom-map-core.mjs');
    const run=JSON.parse(localStorage.getItem(storage));
    const candidates=[];
    for(let x=-4;x<=4;x++)for(let y=-3;y<=3;y++)
      if(Math.abs(x)+Math.abs(y)>=3)candidates.push({x,y});
    candidates.sort((a,b)=>Math.abs(b.x)-Math.abs(a.x)||
      Math.abs(a.y)-Math.abs(b.y)||a.x-b.x||a.y-b.y);
    let id=null;
    for(const {x,y} of candidates){
      const candidate=x+','+y,old=run.kingdomMap.cells[candidate];
      run.kingdomMap.cells[candidate]={status:'completed',type:'empty',explored:true};
      if(core.canBuildOutpost(run.kingdomMap,{x,y})){id=candidate;break;}
      if(old)run.kingdomMap.cells[candidate]=old;
      else delete run.kingdomMap.cells[candidate];
    }
    if(!id)throw Error('No independent second outpost cell for Arena redirect QA');
    localStorage.setItem(storage,JSON.stringify(run));
    localStorage.setItem('rpchess.reboot.v1.arena',JSON.stringify({
      version:1,events:[],squad:'humans',match:null,updatedAt:2
    }));
    globalThis.dispatchEvent(new CustomEvent('rpchess:arena-updated'));
    globalThis.RPChessKingdomMap.open();
    return id;
  },key);
  // The next valid site must be outside the first outpost's owned footprint.
  // Recent pointer drags temporarily suppress cell clicks for 650ms; honor
  // that gameplay safety contract instead of racing an ignored test click.
  await walking.waitForTimeout(690);
  await walking.locator('[data-kingdom-cell="'+secondOutpost+'"]').dispatchEvent('click');
  await walking.locator('[data-kingdom-cell="'+secondOutpost+'"].km-cell--selected').waitFor({state:'attached'});
  const earnButton=walking.locator('[data-kingdom-earn-shards]');
  assert(await earnButton.isVisible(),'insufficient shards offer the Earn in Arena button');
  assert.equal(await earnButton.locator('img.km-shard-inline').getAttribute('src'),
    'assets/arena/mirror_shard.png');
  assert(await walking.locator('[data-kingdom-outpost]').isDisabled());
  const beforeArena=await read(walking);
  await earnButton.click();
  assert.equal(await walking.locator('[data-arena-screen]:not([hidden])').count(),1,
    'Earn button enters the existing Arena scene');
  assert.equal(await walking.locator('[data-kingdom-map-screen]:not([hidden])').count(),0,
    'Kingdom map must hide during Arena navigation');
  assert.deepEqual((await read(walking)).kingdomMap,beforeArena.kingdomMap,
    'switching to Arena does not alter the run map or advance days');
  // Walking over the three non-owned neighbors spent only their travel Supplies;
  // returning to the castle or crossing any owned tile remains free.
  const hudIsHidden=await walking.evaluate(()=>{
    const hud=document.querySelector('.resource-hud');
    return !hud||getComputedStyle(hud).display==='none';
  });
  assert(hudIsHidden,'Arena must hide the global run Gold/Supplies HUD');
  await walking.close();
  // A distant drag walks by the shortest eight-way route, then halts on the
  // first encountered road event; clicking a far tile is inspection only.
  const autopilot=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
  await autopilot.goto(url,{waitUntil:'domcontentloaded'});
  await startNewRun(autopilot,{playerName:'Kingdom Autopilot',legacyTravel:false});
  await autopilot.locator('[data-roster-travel]').click();
  await autopilot.locator('[data-kingdom-map-screen]:not([hidden])').waitFor();
  await autopilot.evaluate(async storage=>{
    const core=await import('./js/kingdom-map-core.mjs?v=20261109-kingdom-controls-v9');
    const run=JSON.parse(localStorage.getItem(storage));
    for(const x of [1,3])run.kingdomMap.cells[x+',0']={status:'completed',type:'empty',explored:true};
    const road=core.randomEncounter(run,{x:2,y:0},400,
      {type:'event',biome:'plains',landmark:null,raceTag:null,paths:{}});
    run.kingdomMap.cells['2,0']={status:'revealed',explored:false,selectedEncounter:road};
    localStorage.setItem(storage,JSON.stringify(run));
    globalThis.RPChessKingdomMap.open();
  },key);
  await autopilot.locator('[data-kingdom-cell="3,0"]').dispatchEvent('click');
  assert.deepEqual((await read(autopilot)).kingdomMap.king,{x:0,y:0},
    'clicking three squares away selects the card without moving');
  await dragKing(autopilot,'3,0');
  await autopilot.waitForFunction(storage=>{
    const m=JSON.parse(localStorage.getItem(storage))?.kingdomMap;
    return m?.pendingCell==='2,0'&&m.king.x===2&&m.king.y===0;
  },key,{timeout:5000});
  assert.notDeepEqual((await read(autopilot)).kingdomMap.king,{x:3,y:0},
    'autopilot must halt and open the first encountered road event');
  const firstCellBefore=await autopilot.locator('[data-kingdom-cell]').first().getAttribute('data-kingdom-cell');
  const frame=await autopilot.locator('.km-map-frame').boundingBox();
  await autopilot.mouse.move(frame.x+280,frame.y+190);
  await autopilot.mouse.down();
  await autopilot.mouse.move(frame.x+530,frame.y+190,{steps:8});
  await autopilot.mouse.up();
  const firstCellAfter=await autopilot.locator('[data-kingdom-cell]').first().getAttribute('data-kingdom-cell');
  assert.notEqual(firstCellAfter,firstCellBefore,
    'left-button dragging empty map space actively pans the world');
  assert.deepEqual((await read(autopilot)).kingdomMap.king,{x:2,y:0},
    'panning only changes the camera, not the saved king position');
  await autopilot.close();
  // Regression: if starvation kills the only non-king companion just before
  // a Skirmish, the combat may not start. Retreat without treating it as a
  // loss or leaving the pending cell locked.
  const starving=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
  await starving.goto(url,{waitUntil:'domcontentloaded'});
  await startNewRun(starving,{playerName:'Starving Skirmish',legacyTravel:false});
  await starving.locator('[data-roster-travel]').click();
  await starving.locator('[data-kingdom-map-screen]:not([hidden])').waitFor({timeout:16000});
  const fixture=await starving.evaluate(async storage=>{
    const core=await import('./js/kingdom-map-core.mjs?v=20261110-roadgrid-v3');
    const hunger=await import('./js/starvation-core.mjs');
    let run=JSON.parse(localStorage.getItem(storage));
    const companion=run.roster.find(c=>!c.isRunKing&&c.status==='healthy');
    if(!companion)throw new Error('starter roster lacks a healthy companion');
    run.roster=run.roster.map(c=>
      c.isRunKing||c.id===companion.id?c:{...c,status:'dead'});
    run.army=[];run.supplies=0;
    const generated=core.randomEncounter(run,{x:1,y:0},500,
      {type:'skirmish',biome:'plains',landmark:null,raceTag:null,paths:{}});
    let route;
    for(let i=0;i<32;i++){
      const candidate={...generated,id:'starvation-min-force-'+i};
      const victim=hunger.deterministicStarvationVictim(run,
        {...candidate,supplyCostAtSelection:1,supplyPaid:0});
      if(victim?.id===companion.id){route=candidate;break;}
    }
    if(!route)throw new Error('could not select a deterministic companion casualty');
    // Stage the exact pre-entry checkpoint. A randomly generated world might
    // already have a different pre-revealed route in the neighboring tile.
    const map={...run.kingdomMap,king:{x:1,y:0},pendingCell:'1,0',
      cells:{...run.kingdomMap.cells,
        '1,0':{status:'revealed',explored:true,annexed:true,
          selectedEncounter:route,lastEntryFrom:{x:0,y:0},
          stepSuppliesCharged:true,stepSuppliesRequested:1,stepSuppliesPaid:0}}};
    if(!core.validateKingdomMap(map))throw new Error('invalid starvation map fixture');
    run.kingdomMap=map;
    localStorage.setItem(storage,JSON.stringify(run));
    const accepted=globalThis.RPChessTravelChoice.startMapEncounter(route,map);
    if(!accepted){
      const persistence=await import('./js/run-persistence.mjs');
      const persisted=persistence.readRun();
      throw new Error('pre-battle starvation dispatch rejected: '+JSON.stringify({
        valid:Boolean(persisted),pending:persisted?.kingdomMap?.pendingCell,
        active:persisted?.activeTravelChoice?.id,route:route.id,
        status:persisted?.kingdomMap?.cells?.['1,0']?.status,
        inProgress:globalThis.RPChessTravelChoice.activeChoice?.id||null
      }));
    }
    return {companion:companion.id,cellId:'1,0',originalDay:map.day};
  },key);
  await starving.locator('[data-starvation-screen]:not([hidden])')
    .waitFor({timeout:16000});
  assert.equal(await starving.locator('[data-skirmish-screen]:not([hidden])').count(),0,
    'Skirmish must NOT open before starvation is acknowledged');
  await starving.locator('[data-starvation-continue]').click();
  await starving.locator('[data-kingdom-map-screen]:not([hidden])')
    .waitFor({timeout:16000});
  const recovered=await read(starving);
  assert.equal(recovered.activeTravelChoice,null,
    'unavailable combat route must be dropped after starvation');
  assert.equal(recovered.kingdomMap.pendingCell,null,
    'starved encounter must not leave the map locked');
  assert.equal(recovered.kingdomMap.cells[fixture.cellId].status,'revealed',
    'unavailable encounter remains on the map for a later attempt');
  assert.deepEqual(recovered.kingdomMap.king,{x:0,y:0},
    'the King retreats to the previous safe cell');
  assert.equal(recovered.kingdomMap.day,fixture.originalDay,
    'failed eligibility does not advance a fake combat day');
  assert.equal(recovered.roster.find(c=>c.id===fixture.companion).status,'dead');
  assert.equal(await starving.locator('[data-skirmish-screen]:not([hidden])').count(),0,
    'no invalid King-only Skirmish screen or combat checkpoint may open');
  assert.equal(recovered.currentCombat,null);
  await starving.close();

  // The user's original v6 terrain editor and kingdom simulator are intact.
  const labPage=await browser.newPage({viewport:{width:1440,height:900}});
  const atlasErrors=[];labPage.on('pageerror',e=>atlasErrors.push(String(e.stack||e)));
  await labPage.goto(new URL('atlas-lab.html',url.endsWith('/')?url:url+'/').href,
   {waitUntil:'domcontentloaded'});
  // Atlas Lab is a development-only editor that the canonical production
  // dist intentionally excludes. Keep its full regression in preview builds,
  // but do not fail the entire gameplay release gate for an absent dev page.
  const labPresent=await labPage.locator('#labVisualTab').count()===1;
  const labRequired=Boolean(process.env.RPCHESS_ATLAS_ECON_SCREENSHOT_DIR||
    process.env.RPCHESS_REQUIRE_ATLAS_LAB==='1');
  if(!labPresent){
    assert.equal(labRequired,false,'Atlas Lab is required in this preview build');
    console.log('Atlas Lab editor-only contract: SKIP (not shipped in production dist)');
  }else{
  await labPage.locator('#labSimTab').click();
  await labPage.locator('#simPreview').waitFor({state:'visible'});
  assert.equal(await labPage.locator('#sc-eventRadius').inputValue(),'1');
  assert.equal(await labPage.locator('#sc-eventNearbyMax').inputValue(),'3');
  await labPage.locator('#simPreview').click();
  await labPage.locator('#simReturn').waitFor({state:'visible'});
  const nearby=await labPage.evaluate(()=>{
   const sim=window.RPChessAtlasSimulation,fn=sim.admissionAccepted;
   let events=0,worst=0;
   for(let y=-10;y<=10;y++)for(let x=-10;x<=10;x++){
    if(!fn(x,y))continue;
    events++;let others=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)
     if((dx||dy)&&fn(x+dx,y+dy))others++;
    worst=Math.max(worst,others);
   }
   return {events,worst};
  });
  assert(nearby.events>0&&nearby.worst<=3,
    'R=1/N=3 respects the maximum number of other road events per encounter');
  // Compare the real game generator against Atlas Lab's LIVE worldAt() on
  // the same seed and coordinates, rather than testing two hardcoded fixtures.
  const currentVisual=await labPage.evaluate(()=>
    window.RPChessAtlasSimulation.exportConfig().visual);
  assert.equal(currentVisual.zoom,117,'Atlas Lab starts with the active game zoom');
  assert.deepStrictEqual([currentVisual.fogRadius,currentVisual.fogInner,
   currentVisual.fogInkOpacity,currentVisual.fogIrregularity,currentVisual.revealRadius],
   [1.1,.32,.2,.3,1.6],'Atlas Lab fog matches the active game visual preset');
  const atlasGameParity=await labPage.evaluate(async()=>{
   const game=await import('./js/kingdom-world-core.mjs?v=20261109-kingdom-feedback1');
   const atlas=window.RPChessAtlasSimulation;
   const cfg=atlas.exportConfig(),biomes=['forest','mountain','hills','plains','marsh','wasteland'];
   const bad=[];
   for(let y=-7;y<=7;y++)for(let x=-7;x<=7;x++){
    if(x===0&&y===0)continue; // castle belongs to the game UI, not world encounters
    const a=atlas.worldAt(x,y),g=game.worldAt(cfg.visual.seed,x,y);
    if(a.type!==g.type||a.biome!==biomes.indexOf(g.biome)||
       (a.race!=='mixed'?a.race:null)!==g.raceTag||
       a.road!==g.paths.road||a.river!==g.paths.river)
     bad.push({x,y,atlas:a,game:g});
   }
   return bad.slice(0,5);
  });
  assert.deepStrictEqual(atlasGameParity,[],
    'game world generation must agree with author Atlas Lab v6 for same seed');
  const countsBefore=await labPage.evaluate(()=>{
   const x=window.RPChessAtlasSimulation.getSample();
   return Object.values(x.groups).reduce((a,b)=>a+b,0);
  });
  await labPage.locator('#sc-eventNearbyMax').evaluate(el=>{
   el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  const countsAfter=await labPage.evaluate(()=>{
   const x=window.RPChessAtlasSimulation.getSample();
   return Object.values(x.groups).reduce((a,b)=>a+b,0);
  });
  assert(countsAfter<=countsBefore,'forbidding all neighbors cannot create more events');
  assert.equal(await labPage.locator('#simControls').count(),1);
  assert.equal(await labPage.locator('#controls').count(),1);
  // Reuse Atlas Lab's real browser QA to verify the editor's N-level preview.
  await labPage.locator('#labEconomyTab').click();
  await labPage.locator('#kmEconomyPreviewStars').fill('5');
  await labPage.locator('#kmEconomyPreviewStars').dispatchEvent('change');
  const productionPreview=await labPage.evaluate(()=>{
    const value=(type,kind)=>[...document.querySelectorAll('#kmEconomyProductionPreview tbody tr')]
      .find(row=>row.dataset.productionType===type&&row.dataset.productionKind===kind)
      ?.lastElementChild?.textContent;
    return {level:document.querySelector('#kmEconomyPreviewStars')?.value,
      settlement:value('settlement','gold'),caravanGold:value('caravan','gold'),
      caravanSupplies:value('caravan','supplies'),eventGold:value('event','gold'),
      eventSupplies:value('event','supplies'),puzzle:value('puzzle','shards'),
      recruits:value('skirmish','recruits'),respawn:value('battle','battle'),
      exported:window.RPChessAtlasEconomy.exportConfig()};
  });
  assert.deepStrictEqual({
    level:productionPreview.level,settlement:productionPreview.settlement,
    caravanGold:productionPreview.caravanGold,caravanSupplies:productionPreview.caravanSupplies,
    eventGold:productionPreview.eventGold,eventSupplies:productionPreview.eventSupplies,
    puzzle:productionPreview.puzzle,recruits:productionPreview.recruits,respawn:productionPreview.respawn
  },{level:'5',settlement:'50',caravanGold:'25',caravanSupplies:'25',
    eventGold:'10',eventSupplies:'10',puzzle:'5',recruits:'1',respawn:'1'},
    'Atlas Lab weekly calculator must show base×N resources and fixed non-resources');
  assert.equal(productionPreview.exported.economy.production.settlementGold,10,
    'preview N is UI-only and must not change exported base economy');
  if(process.env.RPCHESS_ATLAS_ECON_SCREENSHOT_DIR){
    fs.mkdirSync(process.env.RPCHESS_ATLAS_ECON_SCREENSHOT_DIR,{recursive:true});
    await labPage.screenshot({
      path:path.join(process.env.RPCHESS_ATLAS_ECON_SCREENSHOT_DIR,'atlas-economy-N5.png'),
      fullPage:true
    });
  }
  assert.deepStrictEqual(atlasErrors,[],'Atlas Lab economy and original simulator must not emit page errors');
  }
  await labPage.close();
  // Regression: revisiting a cleared Settlement used to hide the Kingdom
  // without opening Services, then persisted an active choice that blocked
  // "В путь" after a reload. Exercise both flows against the same saved run.
  const servicesPage=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
  const serviceErrors=[];
  servicesPage.on('pageerror',error=>serviceErrors.push(String(error.stack||error)));
  await servicesPage.goto(url,{waitUntil:'domcontentloaded'});
  await startNewRun(servicesPage,{playerName:'Settlement Revisit',legacyTravel:false});
  await servicesPage.locator('[data-roster-travel]').click();
  await servicesPage.locator('[data-kingdom-map-screen]:not([hidden])').waitFor({timeout:20000});
  await servicesPage.evaluate(async storage=>{
    const {randomEncounter}=await import('./js/kingdom-map-core.mjs?v=20261109-atlas-lab-v7');
    const run=JSON.parse(localStorage.getItem(storage)),id='1,0';
    const encounter=randomEncounter(run,{x:1,y:0},500,
      {type:'settlement',biome:'plains',landmark:null,raceTag:'humans',paths:{road:false,river:false}});
    run.kingdomMap.king={x:1,y:0};
    run.kingdomMap.pendingCell=null;
    run.kingdomMap.cells[id]={...run.kingdomMap.cells[id],status:'completed',explored:true,
      completedOnce:true,selectedEncounter:encounter};
    localStorage.setItem(storage,JSON.stringify(run));
    globalThis.RPChessKingdomMap.open();
  },key);
  const servicesButton=servicesPage.locator('[data-kingdom-services]');
  await servicesButton.waitFor({state:'visible'});
  assert.equal(await servicesPage.locator('[data-kingdom-services]').count(),1,
    'Exactly one Settlement entrance must exist (not a second text button)');
  assert.equal(await servicesPage.locator('.km-inspector-buttons [data-kingdom-services]').count(),0,
    'Old services button below the card must be removed');
  for(const [width,height] of [[1440,900],[1180,820],[844,390],
    [900,1440],[820,1180],[390,844]]){
    await servicesPage.setViewportSize({width,height});
    await servicesButton.waitFor({state:'visible',timeout:8000});
    await servicesPage.waitForTimeout(80); // allow responsive geometry to settle
    const entrance=await servicesButton.evaluate(button=>{
      const card=button.closest('.km-route-card--visitable-settlement');
      const details=button.closest('.km-route-card__details');
      const rect=button.getBoundingClientRect(),container=details?.getBoundingClientRect();
      const icon=button.querySelector('img');
      return {inCard:Boolean(card),width:rect.width,height:rect.height,
        x:rect.left,y:rect.top,right:rect.right,bottom:rect.bottom,
        details:container?.toJSON(),src:icon?.getAttribute('src'),
        loaded:Boolean(icon?.complete&&icon.naturalWidth===64&&icon.naturalHeight===64),
        aria:button.getAttribute('aria-label'),title:button.title,
        visible:getComputedStyle(button).display!=='none'};
    });
    assert(entrance.inCard&&entrance.visible&&entrance.loaded,
      'Settlement icon must render inside the completed card '+width+'x'+height);
    assert(entrance.src==='assets/ui/settlement_entrance_64x64.png',
      'Settlement must use uploaded image, not a text button');
    assert(entrance.width>=44&&entrance.height>=44&&entrance.aria&&entrance.title,
      'Settlement entrance must stay accessible and touchable '+width+'x'+height+': '+JSON.stringify(entrance));
    assert(entrance.x>=entrance.details.left+entrance.details.width*.52&&
      entrance.right<=entrance.details.right+1&&
      entrance.y>=entrance.details.top-1&&entrance.bottom<=entrance.details.bottom+1,
      'Settlement entrance should occupy top-right of the card '+width+'x'+height+
      ': '+JSON.stringify(entrance));
    if(process.env.RPCHESS_UI_SCREENSHOT_DIR){
      fs.mkdirSync(process.env.RPCHESS_UI_SCREENSHOT_DIR,{recursive:true});
      await servicesPage.screenshot({path:path.join(process.env.RPCHESS_UI_SCREENSHOT_DIR,
        'settlement-entrance-'+width+'x'+height+'.png'),fullPage:false});
    }
  }
  await servicesPage.setViewportSize({width:1280,height:720});
  const provisionsBefore=(await read(servicesPage)).supplies;
  await servicesButton.click();
  await servicesPage.locator('[data-settlement-screen]:not([hidden])').waitFor({timeout:15000});
  await servicesPage.locator('[data-settlement-recruits]').waitFor({state:'visible'});
  assert.equal((await read(servicesPage)).supplies,provisionsBefore,
    'A completed Settlement revisit must not charge Supplies');
  assert.equal((await read(servicesPage)).kingdomMap.pendingCell,null,
    'A cleared Settlement must not become a pending battle');
  // Reproduce the affected player's reload while the free revisit is active.
  await servicesPage.reload({waitUntil:'domcontentloaded'});
  await servicesPage.locator('[data-reboot-foundation]:not([hidden])').waitFor();
  await servicesPage.locator('[data-new-game]').click();
  await servicesPage.locator('[data-journey-continue]').click();
  await servicesPage.locator('[data-roster-screen]:not([hidden])').waitFor();
  await servicesPage.locator('[data-roster-travel]').click();
  await servicesPage.locator('[data-settlement-screen]:not([hidden])').waitFor({timeout:18000});
  assert.equal((await read(servicesPage)).supplies,provisionsBefore,
    'Resuming a cleared Settlement must not charge Supplies again');
  await servicesPage.locator('[data-settlement-continue]').click();
  await servicesPage.locator('[data-kingdom-map-screen]:not([hidden])').waitFor({timeout:18000});
  const finishedServices=await read(servicesPage);
  assert.equal(finishedServices.activeTravelChoice,null,
    'Settlement exit must clear the saved active choice');
  assert.equal(finishedServices.supplies,provisionsBefore,
    'Settlement exit must preserve provisions after reload');
  assert.equal(finishedServices.kingdomMap.cells['1,0'].status,'completed');
  assert.deepEqual(serviceErrors,[],'Settlement revisit must not throw browser errors');

  // Same real map fixture: a six-digit day must fit the fixed portrait
  // header on every mobile and desktop breakpoint without hiding digits.
  await servicesPage.evaluate(storage=>{
    const run=JSON.parse(localStorage.getItem(storage));
    run.kingdomMap.day=166166;
    localStorage.setItem(storage,JSON.stringify(run));
    globalThis.RPChessKingdomMap.open();
  },key);
  // Existing completed-Settlement fixture doubles as a responsive map check.
  for(const [width,height] of [[1440,900],[1180,820],[844,390],[900,1440],[820,1180],[390,844]]){
    await servicesPage.setViewportSize({width,height});
    // Viewport changes are asynchronous relative to resize listeners; sample
    // the heading only after its real browser reflow and adaptive fit settle.
    await servicesPage.waitForFunction(()=>{
      const day=document.querySelector('[data-kingdom-day]');
      return day&&day.textContent.includes('166166')&&
        day.scrollWidth<=day.clientWidth+1;
    },null,{timeout:7000});
    const ui=await servicesPage.locator('[data-kingdom-map-screen]').evaluate(root=>{
      const rect=selector=>root.querySelector(selector)?.getBoundingClientRect();
      const rootBox=root.getBoundingClientRect(),map=rect('.km-map-frame');
      const panel=rect('.km-inspector'),zoom=rect('.km-zoom-controls');
      const bar=root.querySelector('.km-resource-group');
      const nav=root.querySelector('.km-actions'),day=root.querySelector('.km-heading h1');
      const heading=root.querySelector('.km-heading'),header=root.querySelector('.km-header');
      const headingCSS=getComputedStyle(heading),headerCSS=getComputedStyle(header);
      const navIcons=[...nav.querySelectorAll('button')].map(el=>({
        image:getComputedStyle(el).backgroundImage,
        box:el.getBoundingClientRect().toJSON()
      }));
      const mirror=root.querySelector('[data-kingdom-heading-glory]');
      return {root:rootBox.toJSON(),map:map.toJSON(),panel:panel.toJSON(),zoom:zoom.toJSON(),
        title:day.getBoundingClientRect().toJSON(),dayText:day.textContent,
        dayFontPx:parseFloat(getComputedStyle(day).fontSize),
        dayScrollWidth:day.scrollWidth,dayClientWidth:day.clientWidth,
        nav:nav.getBoundingClientRect().toJSON(),
        heading:heading.getBoundingClientRect().toJSON(),
        header:header.getBoundingClientRect().toJSON(),
        headingCSS:{display:headingCSS.display,justify:headingCSS.justifyContent,
          width:headingCSS.width,gridArea:headingCSS.gridArea,margin:headingCSS.margin},
        headerCSS:{display:headerCSS.display,areas:headerCSS.gridTemplateAreas,
          cols:headerCSS.gridTemplateColumns},
        navIcons,mirror:mirror.getBoundingClientRect().toJSON(),
        mirrorDisplay:getComputedStyle(mirror).display,
        originalGloryDisplay:getComputedStyle(root.querySelector('.km-resource--glory')).display,
        originalGlory:root.querySelector('[data-kingdom-glory]').textContent,
        mirrorGlory:root.querySelector('[data-kingdom-heading-glory-value]').textContent,
        touch:navIcons.map(item=>item.box.height),
        resourceOverflow:bar.scrollWidth>bar.clientWidth,resourceScroll:getComputedStyle(bar).overflowX};
    });
    assert(ui.root.width<=width+2&&ui.root.height<=height+2,
      'Map must fit '+width+'x'+height+': '+JSON.stringify(ui));
    assert(ui.dayText==='День 166166'||ui.dayText==='Day 166166',
      'long day label must contain all six digits at '+width+'x'+height);
    assert(ui.title.right<=ui.heading.right-1,
      'long day label must fit its commandbar heading at '+width+'x'+height+
      ': '+JSON.stringify({title:ui.title,heading:ui.heading,font:ui.dayFontPx}));
    assert(ui.dayScrollWidth<=ui.dayClientWidth+1,
      'the Day text itself must be fully visible with no glyph clipping at '+width+'x'+height+
      ': '+JSON.stringify({scroll:ui.dayScrollWidth,client:ui.dayClientWidth,font:ui.dayFontPx}));

    assert(ui.map.height>160&&ui.map.width>220,'Map viewport unusable at '+width+'x'+height);
    assert(ui.panel.top>=ui.map.top-2&&ui.panel.bottom<=ui.map.bottom+2,
      'Inspector must fit map at '+width+'x'+height);
    assert(ui.zoom.top>=ui.map.top-2&&ui.zoom.bottom<=ui.map.bottom+2,
      'Zoom must fit map at '+width+'x'+height);
    if(process.env.RPCHESS_UI_SCREENSHOT_DIR){
      fs.mkdirSync(process.env.RPCHESS_UI_SCREENSHOT_DIR,{recursive:true});
      await servicesPage.screenshot({path:path.join(process.env.RPCHESS_UI_SCREENSHOT_DIR,
        'journey-'+width+'x'+height+'.png'),fullPage:false});
    }
    if(height>width){
      assert(Math.abs((ui.title.top+ui.title.bottom)/2-(ui.nav.top+ui.nav.bottom)/2)<12,
        'Portrait Journey: Day and PNG actions must share header row '+width+'x'+height+
        ': '+JSON.stringify(ui));
      assert(ui.navIcons.map(item=>item.image).every((value,i)=>value.includes(
        ['hud-squad.png','main-menu-settings.png','hud-main-menu.png'][i])),
        'Journey must use the original Squad, Settings and Castle menu PNGs');
      if(width<=599){
        assert(ui.mirrorDisplay!=='none'&&ui.originalGloryDisplay==='none'&&
          ui.mirrorGlory===ui.originalGlory&&
          ui.title.right<=ui.mirror.left+2&&ui.mirror.right<=ui.nav.left+2,
          'Phone portrait Glory must be left of nav icons beside Day N');
      }
    }
    if(width<=844)assert(ui.touch.every(h=>h>=39)&&
      (!ui.resourceOverflow||ui.resourceScroll==='auto'),
      'Phone map controls and resource strip must be reachable');
  }
  await servicesPage.setViewportSize({width:1280,height:720});
  await servicesPage.close();
  // A scouted undefeated Battle shows its persistent red province. Player
  // territory and count stay untouched; unfogged red ink must paint on paper.
  const enemy=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
  await enemy.goto(url,{waitUntil:'domcontentloaded'});
  await startNewRun(enemy,{playerName:'Province QA',legacyTravel:false});
  await enemy.locator('[data-roster-travel]').click();
  await enemy.locator('[data-kingdom-map-screen]:not([hidden])').waitFor({timeout:16000});
  const redStats=await enemy.evaluate(async storage=>{
    const core=await import('./js/kingdom-map-core.mjs?v=20261111-battle-province-v1');
    let run=JSON.parse(localStorage.getItem(storage));
    const origin={x:5,y:4},id='5,4';
    const choice=core.randomEncounter(run,origin,500,{
      type:'battle',biome:'plains',landmark:null,raceTag:'orcs',paths:{}});
    const second={x:6,y:4},secondId='6,4';
    const other=core.randomEncounter(run,second,600,{
      type:'battle',biome:'hills',landmark:null,raceTag:'goblins',paths:{}});
    let map={...run.kingdomMap,king:origin,pendingCell:null,
      cells:{...run.kingdomMap.cells,
        [id]:{status:'revealed',explored:true,selectedEncounter:choice},
        [secondId]:{status:'revealed',explored:true,selectedEncounter:other}}};
    map=core.reserveBattleTerritories(map);
    const province=map.battleTerritories.find(t=>t.id===id);
    if(!province||!province.cells.includes(id))throw Error('Battle red province missing origin');
    for(const territory of map.battleTerritories)
      for(const tile of territory.cells)if(!map.cells[tile])
        map.cells[tile]={status:'completed',type:'empty',explored:false};
    run.kingdomMap=map;
    localStorage.setItem(storage,JSON.stringify(run));
    globalThis.RPChessKingdomMap.open();
    const real=globalThis.RPChessKingdomMap.map;
    return {red:province.cells.length,owned:core.playerTerritoryCount(real),
      colors:[real.battleTerritories.find(p=>p.id===id)?.colorIndex,
        real.battleTerritories.find(p=>p.id===secondId)?.colorIndex],
      provinces:document.querySelector('[data-kingdom-parchment]')?.dataset.enemyProvinceCount,
      redBorders:document.querySelector('[data-kingdom-parchment]')?.dataset.enemyBorderSegments,
      counter:document.querySelector('[data-kingdom-points]')?.textContent,
      blueOverlap:province.cells.filter(tile=>core.isOwned(real,tile))};
  },key);
  assert(redStats.red>=2&&redStats.red<=13,'Battle province must have ELO/200 cells');
  assert(redStats.colors.every(Number.isInteger)&&new Set(redStats.colors).size===2,
    'neighboring Battles must render with distinct persistent colors');
  assert.equal(redStats.provinces,'2','both colored enemy borders render separately');
  assert.equal(redStats.counter,String(redStats.owned),
    'territory HUD counts the actual unique owned area, excluding enemy provinces');
  assert.deepEqual(redStats.blueOverlap,[],'blue and red provinces must not overlap');
  assert(Number(redStats.redBorders)>0,'colored Battle borders must draw on parchment');
  if(process.env.RPCHESS_UI_SCREENSHOT_DIR){
    fs.mkdirSync(process.env.RPCHESS_UI_SCREENSHOT_DIR,{recursive:true});
    await enemy.screenshot({path:path.join(process.env.RPCHESS_UI_SCREENSHOT_DIR,
      'battle-red-territory.png'),fullPage:false});
  }
  await enemy.close();
  // Reuse Kingdom Chromium coverage: this exercises actual saved weekly
  // production and the nine-icon sprite atlas, including its public asset URL.
  const productionPage=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
  await productionPage.goto(url,{waitUntil:'domcontentloaded'});
  await startNewRun(productionPage,{playerName:'Industry QA',legacyTravel:false});
  await productionPage.locator('[data-roster-travel]').click();
  await productionPage.locator('[data-kingdom-map-screen]:not([hidden])').waitFor({timeout:16000});
  const industryResult=await productionPage.evaluate(async()=>{
    const core=await import('./js/kingdom-map-core.mjs');
    const industry=await import('./js/kingdom-industry-core.mjs');
    const persistence=await import('./js/run-persistence.mjs');
    const run=persistence.readRun(localStorage);
    // The real save loader rejects tampered world seeds and regenerates a
    // kingdom. Keep the original valid seed and only add QA-owned visible land.
    const extra=[];
    for(let y=-2;y<=2;y++)for(let x=-3;x<=3;x++)extra.push(x+','+y);
    const mapStart={...run.kingdomMap,peakKingPower:600,
      centralOwnedCells:[...new Set([...(run.kingdomMap.centralOwnedCells||[]),...extra])]};
    let map=mapStart;
    const available=industry.candidateCells(map);
    if(available.length<2)throw Error('Production QA needs two eligible visible cells: '+JSON.stringify({
      seed:map.seed,candidates:available.length}));
    const originalSeed=map.seed;
    for(let day=map.day+1;day<=14;day++)map=core.advanceDay(map,'industry-qa-day:'+day);
    if(map.seed!==originalSeed)throw Error('Production may not change the saved world seed');
    if(map.industry.buildings.length!==2)throw Error('Day 14 must have exactly two industries');
    const ready=map.industry.buildings[0];
    const pending=industry.industryPending(map,ready.id);
    if(!pending)throw Error('A completed building must be collectible on week 2');
    const terrain=industry.candidateCells(map).find(c=>
      Math.abs(Number(c.id.split(',')[0]))<=3&&Math.abs(Number(c.id.split(',')[1]))<=2);
    if(!terrain)throw Error('Expected a nearby empty and owned terrain tile');
    map={...map,cells:{...map.cells,[terrain.id]:{
      status:'completed',type:'empty',explored:true,annexed:true,biome:terrain.biome}}};
    const persisted=persistence.writeRun({...run,kingdomMap:map},localStorage,Date.now());
    globalThis.RPChessKingdomMap.open();
    return {id:ready.id,kind:ready.kind,amount:pending.amount,
      resource:pending.kind,initialGold:persisted.gold,initialSupplies:persisted.supplies,
      creditedGold:persisted.kingdomMap.industry.creditedGold,
      creditedSupplies:persisted.kingdomMap.industry.creditedSupplies,
      empty:terrain.id};
  });
  const tile=productionPage.locator('[data-kingdom-cell="'+industryResult.id+'"]');
  await tile.locator('.km-object--industry').waitFor({state:'attached',timeout:10000});
  const industryVisual=await tile.evaluate(el=>{
    const sprite=el.querySelector('.km-object--industry'),css=getComputedStyle(sprite);
    const eventSprite=el.querySelector('.km-object--site');
    return {kind:el.dataset.kingdomIndustry,stage:el.dataset.kingdomIndustryStage,
      background:css.backgroundImage,badge:el.querySelector('.km-industry-level')?.textContent,
      opacity:Number(css.opacity),width:Number.parseFloat(css.width),
      expectedWidth:Number.parseFloat(getComputedStyle(document.querySelector('.kingdom-map-screen'))
        .getPropertyValue('--km-event-size-px'))*.469,
      eventSprite:!!eventSprite};
  });
  assert.equal(industryVisual.kind,industryResult.kind,'biome-specific production art must match site kind');
  assert.equal(industryVisual.stage,'complete','week two completes first production site');
  assert(industryVisual.background.includes('industry-atlas.png'),'production icon must load real atlas file');
  assert.equal(industryVisual.badge,'II','production level follows Castle II');
  assert.equal(industryVisual.opacity,.8,'industry and forest decorations share opacity');
  assert(Math.abs(industryVisual.width-industryVisual.expectedWidth)<1,
    'all producer icons are 30% smaller than prior preview');
  const icon=productionPage.locator('[data-kingdom-industry-collect="'+industryResult.id+'"]');
  await icon.waitFor({state:'visible',timeout:12000});
  assert.equal(await icon.locator('strong').textContent(),String(industryResult.amount),
    'floating icon displays the collectible weekly amount');
  // Reload before collecting: pending rewards must survive persistence.
  await productionPage.reload({waitUntil:'domcontentloaded'});
  await productionPage.locator('[data-reboot-foundation]:not([hidden])').waitFor();
  await productionPage.locator('[data-new-game]').click();
  await productionPage.locator('[data-journey-continue]').click();
  await productionPage.locator('[data-roster-screen]:not([hidden])').waitFor();
  await productionPage.locator('[data-roster-travel]').click();
  await productionPage.locator('[data-kingdom-map-screen]:not([hidden])').waitFor();
  const restored=productionPage.locator('[data-kingdom-industry-collect="'+industryResult.id+'"]');
  await restored.waitFor({state:'visible'});
  const beforePickup=await read(productionPage);
  assert.equal(beforePickup.gold,industryResult.initialGold,'reload does not auto-credit Gold');
  assert.equal(beforePickup.supplies,industryResult.initialSupplies,'reload does not auto-credit Supplies');
  await restored.click();
  await restored.waitFor({state:'detached'});
  const claimed=await read(productionPage);
  assert.equal(claimed.gold,beforePickup.gold+
    (industryResult.resource==='gold'?industryResult.amount:0),'click credits Gold exactly once');
  assert.equal(claimed.supplies,beforePickup.supplies+
    (industryResult.resource==='supplies'?industryResult.amount:0),'click credits Supplies exactly once');
  assert.equal(claimed.kingdomMap.industry.pending[industryResult.id],undefined,
    'collected industry receipt survives save');
  assert.equal(await productionPage.locator('[data-kingdom-industry-collect="'+industryResult.id+'"]').count(),0,
    'resource icon disappears after manual collection');
  if(industryResult.empty){
    await productionPage.locator('[data-kingdom-cell="'+industryResult.empty+'"]').dispatchEvent('click');
    const card=await productionPage.locator('[data-kingdom-inspector-title]').textContent();
    assert(['Лес','Горы','Холмы','Равнина','Болото','Пустоши'].includes(card),
      'empty terrain inspector should use its actual biome name, got '+card);
    assert.equal((await productionPage.locator('[data-kingdom-inspector-text]').textContent()).trim(),'',
      'no-event terrain has no redundant explanatory text');
  }
  const atlasResponse=await productionPage.request.get(new URL('assets/kingdom-production/industry-atlas.png',url).href);
  assert.equal(atlasResponse.status(),200,'production atlas is included in the deployed game');
  assert.equal((await atlasResponse.body()).subarray(0,8).toString('hex'),'89504e470d0a1a0a',
    'production atlas must be a genuine PNG');
  await productionPage.close();
  console.log('KINGDOM PRODUCTION PASS — manual icon collection, reload persistence, atlas, scale, biome and Castle II');
  console.log('KINGDOM MAP PASS — click-inspect, king drag, shortest routes, event stop, map pan, step supplies, red provinces');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
