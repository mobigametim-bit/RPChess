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
  const failedAssets=[];
  page.on('console',msg=>{if(msg.type()==='error')failedAssets.push(msg.text());});
  page.on('requestfailed',req=>failedAssets.push(req.url()+': '+req.failure()?.errorText));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await startNewRun(page,{playerName:'Kingdom Explorer',legacyTravel:false});
  // Force consecutive real Battles to catch the original bug:
  // their engine encounter IDs differ from the route ID kept by the map.
  await page.evaluate(async storage=>{
    const {worldAt}=await import('./js/kingdom-world-core.mjs');
    const run=JSON.parse(localStorage.getItem(storage));
    let found=false;
    for(let i=0;i<35000;i++){
      const id='kingdom-e2e-chain-'+i;
      if(worldAt(id,1,0,{allowSkirmish:true}).type==='battle'&&
         worldAt(id,0,1,{allowSkirmish:true}).type==='battle'){
        run.id=id;found=true;break;
      }
    }
    if(!found)throw new Error('No deterministic two-Battle map fixture found');
    localStorage.setItem(storage,JSON.stringify(run));
  },key);
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
  assert.equal(await page.locator('[data-travel-choice-screen]:not([hidden])').count(),0,
   'the old three-card choice is not the live Journey screen');
  const expectedViewportCells=await page.evaluate(()=>{
    const f=document.querySelector('.km-map-frame').getBoundingClientRect();
    const odd=(px,min)=>{const n=Math.max(min,Math.ceil((px+2)/87));return n%2?n:n+1;};
    return odd(f.width,9)*odd(f.height,7);
  });
  assert.equal(await page.locator('[data-kingdom-cell]').count(),expectedViewportCells,
    'atlas 87px zoom selects an odd full-bleed grid for the viewport');
  const before=await read(page);
  assert(before.kingdomMap&&before.kingdomMap.cells['0,0'].annexed);
  // The new parchment map is visual only: the original tile view remains
  // available and selected runs never inherit a new save schema.
  const mapSkin=page.locator('[data-kingdom-skin-switch]');
  assert.equal(await mapSkin.getAttribute('aria-pressed'),'false',
    'classic board remains the default unless the user opts into parchment');
  await mapSkin.click();
  assert.equal(await mapSkin.getAttribute('aria-pressed'),'true');
  const atlas=page.locator('[data-kingdom-parchment]');
  assert.equal(await atlas.count(),1,'parchment must draw one continuous canvas behind clickable cells');
  // Exercise actual uploaded sprites in the bundled dist, not just the
  // procedural Canvas fallback that worked before the artist supplied art.
  const artProbe=await page.evaluate(async()=>{
    const files=[
      'parchment_base_variations/01_light_ochre_plain.svg',
      'forest_clusters/01_small_grove.svg',
      'mountain_clusters/01_single_summit.svg',
      'hills_rocks/01_three_hills.svg',
      'fog_of_war_shapes/01_broad_blot.svg'
    ];
    return Promise.all(files.map(async file=>{
      const src='assets/kingdom-parchment/'+file;
      const response=await fetch(src,{cache:'no-store'});
      if(!response.ok)return {file,status:response.status,decoded:false};
      const img=new Image();img.src=src;
      try{await img.decode();}catch{return {file,status:response.status,decoded:false};}
      return {file,status:response.status,decoded:img.naturalWidth===128&&img.naturalHeight===128};
    }));
  });
  for(const sprite of artProbe)assert.equal(sprite.status===200&&sprite.decoded,true,
    'artist SVG must be shipped and decoded at 128px: '+sprite.file);
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
    'all sixteen correct marsh SVGs are included');
  assert(manifest.groups.marsh_wasteland_optional.includes('01_pale_marsh.svg')&&
    !manifest.groups.marsh_wasteland_optional.includes('01_straight_line.svg'),
    'marsh sprites must not be mislabeled frame shapes');
  for(const [group,names] of Object.entries(manifest.groups)){
    assert.equal(names.length,16,'each valid sprite group has 16 SVGs: '+group);
    assert(names.every(name=>name.endsWith('.svg')),'sprite group must be SVG-only: '+group);
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
  assert.equal(await atlas.getAttribute('data-parchment-art'),'loaded',
    'the parchment renderer uses the uploaded SVGs rather than its fallback');
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
  assert(scoutedEvents.length>0,'scouting reveals actual encounters around the king');
  for(const [id] of scoutedEvents){
    assert.equal(await page.locator('[data-kingdom-cell="'+id+'"] img.km-object--site').count(),1,
      'scouted encounter '+id+' displays its genuine SVG before the king enters');
  }
  assert(terrain.pixels[3]>0&&terrain.pixels[7]>0,
    'procedurally painted terrain and fog must both have visible pixels');
  assert.deepEqual(await read(page),before,'skin toggle must not change the run, encounters or save state');
  await page.screenshot({path:path.join(output,'kingdom-parchment-experiment.png')});
  await mapSkin.click();
  assert.equal(await atlas.count(),0,'switching back must remove the optional canvas');
  assert.equal(await mapSkin.getAttribute('aria-pressed'),'false');
  assert.equal(await page.evaluate(()=>localStorage.getItem('rpchess.kingdom.visual.v1')),'classic',
    'the visual preference is independent from the Journey save');

  assert.deepEqual(before.kingdomMap.king,{x:0,y:0});
  assert.equal(before.kingdomMap.day,1,'new game begins on Day 1');
  assert.equal(before.kingdomMap.centralOwnedCells.length,6,
    'castle and five automatic lands exist without visiting their cells');
  assert.equal(await page.locator('[data-kingdom-annex]:visible').count(),0,
    'manual annex button disappears when territory is automatic');
  assert.equal(await page.locator('[data-kingdom-cell="4,3"] .km-object').count(),0,
    "unscouted cells have neither question marks nor encounter art");
  assert.equal(await page.locator(".km-fog-mark").count(),0,
    "classic map never draws mystery punctuation");
  const castleSprite=page.locator('[data-kingdom-cell="0,0"] img.km-object');
  assert.equal(await castleSprite.getAttribute('src'),
    'assets/kingdom-map/humans/humans_castle_128.svg');
  await page.waitForFunction(()=>{
    const sprite=document.querySelector('[data-kingdom-cell="0,0"] img.km-object');
    return sprite?.complete&&sprite.naturalWidth===128&&sprite.naturalHeight===128;
  },null,{timeout:15000});
  // Author's Atlas Lab zoom is 87 physical px/cell; contents retain 73%/92:142 proportions.
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
  assert(Math.abs(dimensions.tile.width-87)<1&&Math.abs(dimensions.tile.height-87)<1,
    'new Atlas preset renders 87px square cells initially');
  assert(Math.abs(dimensions.king.width-92*87/142)<1&&Math.abs(dimensions.king.height-92*87/142)<1,
    'the named king scales uniformly with the world');
  assert(Math.abs(dimensions.object.width-87*.73)<1&&Math.abs(dimensions.object.height-87*.73)<1,
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
  await page.waitForFunction(()=>globalThis.RPChessKingdomMap?.zoom>87);
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
  await page.waitForFunction(()=>globalThis.RPChessKingdomMap?.zoom===87);
  // updateZoom schedules a paint; wait for the actual replacement DOM as well.
  await page.waitForFunction(()=>document.querySelector('[data-kingdom-world]')?.dataset.mapZoom==='87');
  assert.equal(await page.evaluate(()=>localStorage.getItem('rpchess.kingdom.zoom.v1')),'87',
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
  assert.equal(await page.locator('[data-kingdom-points]').textContent(),'5/5',
    'the header shows five automatically held lands out of five Power-based capacity');
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
        snap.arrival={castle:center('[data-kingdom-cell="0,0"]'),
          east:center('[data-kingdom-cell="1,0"]'),king:center('.km-king')};
        snap.activeAtStory=JSON.parse(localStorage.getItem('rpchess.reboot.v1.run')||'null')?.activeTravelChoice||null;
      }
    }).observe(document.querySelector('[data-kingdom-world]'),{childList:true,subtree:true});
  });
  const clicked=Date.now();
  await page.locator('[data-kingdom-cell="1,0"]').click();
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
  assert.equal(moved.supplies,before.supplies,'moving and unveiling do not charge resources prematurely');
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
   assert.equal(await completedCard.locator('.km-route-card__cleared').count(),1);
   assert.equal(await completedCard.locator('.km-route-resource').count(),0,
     'a completed encounter does not advertise a fresh supply charge or repeat reward');
   assert.equal(await page.locator('.km-kingdom-overlay').count(),1,
     'organic territory and event roads work in the parchment skin');
   assert.equal(await page.locator('.km-kingdom-overlay').getAttribute('data-road-segments'),'1');
   assert(Number(await page.locator('.km-kingdom-overlay').getAttribute('data-border-segments'))>0,
     'wavy territory bounds are painted on the shared overlay');
   // Starting an encounter spends one Supply; on return the event tile reports
   // only the actual resource delta, not a fabricated repeat reward.
   const fx=completedTile.locator('.km-resource-burst');
   assert(await fx.count()>0,'the event emits a resource delta flyout on return');
   assert((await fx.allTextContents()).includes('-1'),
     'the first receipt shows the actual -1 Supply change');
   await completedTile.click();
   assert.equal(await page.locator('[data-kingdom-route-card]').count(),1,
     'clicking a cleared location again never reverts to the empty inspector');
   assert.equal(await page.locator('[data-kingdom-route-card]').getAttribute('data-kingdom-route-status'),
     'completed');
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
    run.kingdomMap.cells['1,1']={status:'completed',respawnReady:true,annexed:false,
      selectedEncounter:{id:'kingdom.orc-fixture',type:'battle',raceTag:'orcs',stars:1}};
    run.kingdomMap.cells['-1,1']={status:'completed',annexed:false,
      selectedEncounter:{id:'kingdom.undead-fixture',type:'skirmish',raceTag:'undead',stars:4}};
    run.kingdomMap.cells['0,-1']={status:'completed',annexed:false,
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
  assert.equal((await read(walking)).supplies,10,
    'free movement through completed tiles must not spend Supplies');
  await walking.close();
  console.log('KINGDOM MAP PASS — race sprites load, Battle draw -> Battle win -> third tile, eight-direction camera');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
