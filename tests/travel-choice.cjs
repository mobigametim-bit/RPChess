const fs=require('fs'),path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
function memoryStorage(){const d=new Map();return{getItem:k=>d.has(k)?d.get(k):null,setItem:(k,v)=>d.set(k,String(v)),removeItem:k=>d.delete(k)}}
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const travelAppSource=fs.readFileSync(path.join(game,'js/travel-choice-app.mjs'),'utf8');
  const travelCss=fs.readFileSync(path.join(game,'css/travel-choice-compact.css'),'utf8');
  const uiSource=fs.readFileSync(path.join(game,'localization/ui.mjs'),'utf8');
  assert(!travelAppSource.includes("document.addEventListener('click'"),'Travel must not intercept combat aftermath clicks globally');
  assert(travelAppSource.includes('recoverAftermathRoute'));assert(travelAppSource.includes("source==='skirmish-aftermath'")&&travelAppSource.includes("source==='battle-aftermath'"));assert(travelAppSource.includes("rpchess:puzzle-open"),'Puzzle routes must dispatch into playable scene');
  assert(travelAppSource.includes('data-travel-power')&&travelAppSource.includes('data-travel-player-threat'),'Travel must show Power and Threat without redesigning route cards');
  assert(travelAppSource.includes("OWNER_STYLE_HREF='css/travel-choice-compact.css'"),'Travel owner must load its compact stylesheet explicitly');
  assert(travelAppSource.includes("import { subscribe, t, translateLegacy, currentLanguage } from './i18n.mjs'"),'Travel owner must render keyed UI and explicit translated content');
  for(const key of ['travel.ariaLabel','travel.week','travel.type.puzzle','travel.costStarvation','travel.rewardAria','travel.skirmishUnavailable','travel.continue'])assert(uiSource.includes(`'${key}'`),`localization registry missing Travel key: ${key}`);
  for(const key of ['travel.ariaLabel','travel.week','travel.costStarvation','travel.rewardAria','travel.skirmishUnavailable','travel.continue'])assert(travelAppSource.includes(`'${key}'`),`Travel owner must consume localization key: ${key}`);
  assert(travelAppSource.includes('t(`travel.type.${choice.type}`)')&&travelAppSource.includes('contentText(choice.flavor)'),'Travel route UI must use semantic type keys while flavor content is translated explicitly');
  assert(travelAppSource.includes('subscribe(()=>')&&travelAppSource.includes('renderChoices()'),'Travel language changes must rerender owner presentation without document mutation');
  for(const hardcoded of ['Припасов нет — при переходе сработает голод.','Недоступно: для стычки нужен хотя бы один здоровый герой кроме короля.','ЛЕЧЕНИЕ · НАЙМ · СНАБЖЕНИЕ'])assert(!travelAppSource.includes(hardcoded),`Travel runtime must not retain keyed RU UI copy: ${hardcoded}`);
  const buildSource=fs.readFileSync(path.join(game,'..','scripts/build.cjs'),'utf8');
  assert(buildSource.includes("'css/travel-choice-compact.css'"),'production build must package the Travel owner stylesheet');
  assert(fs.existsSync(path.join(game,'assets/kingdom-parchment/parchment_tile_256.webp')),
    'optimized user-provided parchment tile is a real packaged asset');
  const overlaySource=fs.readFileSync(path.join(game,'js/kingdom-map-overlay.mjs'),'utf8');
  assert(overlaySource.includes('ctx.globalAlpha*=VISUAL.roadOpacity'),
    'Royal-road paving opacity must match naturally generated roads');
  assert(overlaySource.includes("clipRoadSurface(inside)")&&
     overlaySource.includes("for(const [inside,tone] of [[false,'gray'],[true,'sandstone']]"),
    'paved roads switch from yellow to gray exactly at owned-cell boundaries');
  assert(overlaySource.includes('visibleTravelRoads(map)'),
    'historic roads remain an independent visible layer');
  const rendererSource=fs.readFileSync(path.join(game,'js/kingdom-traveler-renderer.mjs'),'utf8');
  assert(rendererSource.includes('if(!motion?.moving)continue'),
    'NPCs hide during stops and appear again only when a new leg begins');
  const pavingSource=fs.readFileSync(path.join(game,'js/kingdom-road-paving.mjs'),'utf8');
  assert(pavingSource.includes('const SANDSTONE_WIDTH=16')&&
    pavingSource.includes("base:'#e4bd54'")&&pavingSource.includes('const BRICK_LENGTH=22,BRICK_STEP=24,ROWS=3'),
    'author-approved 16px yellow brick paving uses three staggered running-bond courses');
  assert(overlaySource.includes('drawSandstoneRoad(ctx,{x1,y1,x2,y2,bend:offset,id:road.id||identity,'),
    'only player-built royal road overlay must use sandstone while natural dirt trails stay unchanged');
  assert(buildSource.includes("'js/kingdom-road-paving.mjs'"),
    'production bundle must copy the actual sandstone paving renderer');
  const menuPreviewSource=fs.readFileSync(path.join(game,'js/kingdom-menu-preview.mjs'),'utf8');
  assert(menuPreviewSource.includes('assets/kingdom-parchment/decor_minor_landmarks/04_watchtower.png')&&
    !menuPreviewSource.includes('assets/kingdom-parchment/decor_minor_landmarks/04_watchtower.svg'),
    'main-menu Kingdom preview must use the converted PNG instead of a stripped SVG');
  assert(overlaySource.includes('rgba(35,118,222,.1225)'),
    'blue territory fill alone is reduced by another 30 percent');
   for(const alpha of ['rgba(49,151,255,.29)','rgba(40,133,238,.16)'])
    assert(overlaySource.includes(alpha),'radial ownership halos must retain original definition: '+alpha);
   for(const alpha of ['rgba(28,115,249,.94)','rgba(37,139,254,.97)',
    'rgba(201,234,255,.96)'])
    assert(overlaySource.includes(alpha),'province halos stay fully bright: '+alpha);
  const parchmentSource=fs.readFileSync(path.join(game,'js/kingdom-parchment-app.mjs'),'utf8');
  assert(parchmentSource.includes("const PAPER_TILE_SRC='assets/kingdom-parchment/parchment_tile_256.webp'"),
    'author WebP tiles remain the parchment ground, not procedural paper');
  assert(parchmentSource.includes('canvas.dataset.parchmentTexture=drawTiledPaper(ctx,left,top,columns,rows,repaint)'),
    'tiled paper remains the first painted layer');
  const kingdomMapSource=fs.readFileSync(path.join(game,'js/kingdom-map-app.mjs'),'utf8');
  const menuPreviewSourceForLayers=fs.readFileSync(path.join(game,'js/kingdom-menu-preview.mjs'),'utf8');
  assert(!parchmentSource.includes('drawKingdomBoundary(ctx,{map,view,columns,rows})')&&
    !parchmentSource.includes('drawEnemyBattleTerritories(ctx,{map,view,columns,rows})')&&
    parchmentSource.includes('detailCanvas')&&parchmentSource.includes('drawWaterRoads(detailCtx,'),
    'territory borders must leave the parchment painter while natural and paved roads remain above');
  assert(kingdomMapSource.includes('detailCanvas:details')&&
    kingdomMapSource.includes('drawBorder:true,drawRoads:!parchment')&&
    menuPreviewSourceForLayers.includes('detailCanvas:details')&&
    menuPreviewSourceForLayers.includes('drawBorder:true,drawRoads:false'),
    'both live map and main-menu projection must share the three-surface political layering');
  for(const icon of ['build_outpost_128.png','build_settlement_128.png']){
    const file=path.join(game,'assets/ui',icon);
    assert(fs.existsSync(file)&&fs.readFileSync(file).subarray(0,8).toString('hex')==='89504e470d0a1a0a',
      'uploaded compact build icon is a real production PNG: '+icon);
    assert(buildSource.includes("'assets/ui/"+icon+"'"),
      'production build must ship compact build art: '+icon);
  }
  assert(buildSource.includes("'js/kingdom-map-overlay.mjs'"),
    'production build must include the organic border/road module or Journey cannot load');
  assert(travelAppSource.includes('data-travel-run-portrait')&&travelAppSource.includes('function renderPortrait()'),'Travel owner must render and refresh the run king portrait itself');
  assert(travelAppSource.includes('commanderPortrait(activeRun.commanderId)')&&travelAppSource.includes('commanderTitle(activeRun.commanderId,currentLanguage())'),
    'Travel commander portrait/title must resolve from persisted run commanderId, not stale roster.king.portrait');
  assert(!travelAppSource.includes('king?.portrait'),'Travel must not display stale selected commander portrait from roster');
  assert(travelAppSource.includes("rating.style.setProperty('--travel-commander-portrait'")&&travelAppSource.includes('new URL(source,document.baseURI).href'),
    'Travel must update visible CSS portrait from commanderId with correct base URI');
  assert(fs.readFileSync(path.join(game,'css/player-rating.css'),'utf8').includes('var(--travel-commander-portrait, none)'),
    'visible desktop portrait must not use unrelated King fallback');
  assert(travelCss.includes('.travel-choice-run-portrait{display:none}'),'Travel portrait must stay hidden outside the compact owner breakpoint');
  assert(travelCss.includes("grid-template-columns:40px minmax(112px,1fr) minmax(100px,1fr) minmax(176px,1.3fr)!important"),'tablet Travel controls must fit three actions');
  assert(travelCss.includes("grid-template-columns:34px minmax(96px,1fr) minmax(88px,1fr) minmax(172px,1.2fr)!important"),'phone Travel controls must fit three actions');
  assert(!fs.existsSync(path.join(game,'js/post-pages-ui-polish.mjs')),'retired post-pages presentation shim must stay deleted');
  assert(!fs.existsSync(path.join(game,'js/presentation-bootstrap.mjs')),'retired presentation bootstrap must stay deleted');
  assert(!fs.existsSync(path.join(game,'js/content/post-pages-ui-polish-constraints.mjs')),'superseded constraints compatibility module must stay deleted');
  assert(!fs.existsSync(path.join(game,'js/content/post-pages-ui-review2.mjs')),'superseded review2 compatibility module must stay deleted');
  const travel=await import(pathToFileURL(path.join(game,'js/travel-choice-core.mjs')).href),difficulty=await import(pathToFileURL(path.join(game,'js/encounter-difficulty.mjs')).href),rating=await import(pathToFileURL(path.join(game,'js/player-rating.mjs')).href),persistence=await import(pathToFileURL(path.join(game,'js/run-persistence.mjs')).href),skirmish=await import(pathToFileURL(path.join(game,'js/skirmish-core.mjs')).href),battle=await import(pathToFileURL(path.join(game,'js/battle-core.mjs')).href);
  assert.deepStrictEqual(travel.PLAYABLE_TRAVEL_TYPES,['skirmish','battle','settlement','event','puzzle','caravan']);assert.strictEqual(travel.TRAVEL_CHOICE_COUNT,3);assert.strictEqual(difficulty.MAX_ENCOUNTER_STARS,12);assert.strictEqual(difficulty.difficultyForStars(1).elo,400);assert.strictEqual(difficulty.difficultyForStars(12).elo,2600);
  for(const type of travel.PLAYABLE_TRAVEL_TYPES){assert(Array.isArray(travel.FLAVOR_POOLS[type]));assert(travel.FLAVOR_POOLS[type].length>=10);}
  const first=travel.createTravelChoices({runId:'travel-test-run',step:1,playerPower:500}),repeat=travel.createTravelChoices({runId:'travel-test-run',step:1,playerPower:500});assert.deepStrictEqual(first,repeat);assert.strictEqual(first.length,3);assert.strictEqual(new Set(first.map(c=>c.id)).size,3);assert(first.every(travel.isTravelChoice));assert(first.every(c=>c.difficultyModel==='power-v1'));
  const duplicateFound=Array.from({length:100},(_,i)=>travel.createTravelChoices({runId:`dupe-${i}`,step:1,playerPower:500})).some(f=>new Set(f.map(c=>c.type)).size<3);assert(duplicateFound,'independent pool must still allow duplicate types in one fork');
  const counts={skirmish:0,battle:0,settlement:0,event:0,puzzle:0,caravan:0};for(let i=0;i<5000;i++)for(const c of travel.createTravelChoices({runId:`distribution-${i}`,step:1,playerPower:500}))counts[c.type]++;for(const [type,count] of Object.entries(counts)){const ratio=count/15000;assert(ratio>.15&&ratio<.185,`${type} ratio ${ratio} must stay near 1/6`);}
  for(const power of [500,600,1000,1600,2400,2600]){const threat=rating.threatStarsForPower(power);for(const type of ['skirmish','battle','puzzle']){for(let i=0;i<100;i++){const choices=travel.createTravelChoices({runId:`adaptive-${power}-${type}-${i}`,step:37,types:[type],playerPower:power});assert(choices.every(c=>c.stars>=threat&&c.stars<=Math.min(12,threat+3)),`${type} must stay at Threat..Threat+3`);}}}
  const low=Array.from({length:300},(_,i)=>travel.createTravelChoices({runId:`low-${i}`,step:99,types:['puzzle'],playerPower:500})[0]);assert(low.every(c=>c.stars>=1&&c.stars<=4),'journey week must no longer raise Puzzle beyond player-adaptive range');assert(new Set(low.map(c=>c.stars)).size>1,'adaptive Puzzle must expose multiple +0..3 levels');
  const late=Array.from({length:100},(_,i)=>travel.createTravelChoices({runId:`late-${i}`,step:30,playerPower:2400})).flat().filter(c=>c.type==='skirmish'||c.type==='battle');assert(late.some(c=>c.stars===12));assert(late.every(c=>c.stars>=11&&c.stars<=12));assert(late.every(c=>['w','b'].includes(c.playerColor)&&c.enemyRaceTag));assert(late.some(c=>c.playerColor==='b'));
  const run=persistence.createRun({id:'travel-run',now:1000}),storage=memoryStorage();persistence.writeRun({...run,currentTravelChoices:first},storage,1100);assert.deepStrictEqual(persistence.readRun(storage).currentTravelChoices,first);
  const puzzleChoice={...travel.createTravelChoices({runId:'persist-puzzle',step:41,types:['puzzle'],playerPower:500})[0],supplyCostAtSelection:1,supplyPaid:1};persistence.writeRun({...run,journeyStep:41,currentTravelChoices:null,activeTravelChoice:puzzleChoice},storage,1120);const storedPuzzle=persistence.readRun(storage);assert(storedPuzzle&&storedPuzzle.activeTravelChoice.type==='puzzle');assert(storedPuzzle.activeTravelChoice.stars>=1&&storedPuzzle.activeTravelChoice.stars<=4);
  const persistedEvent={...first[0],id:'persist.event',type:'event',label:'СОБЫТИЕ',stars:1,threatLabel:'ОЧЕНЬ НИЗКАЯ',flavor:'Неожиданная встреча у дороги.',mechanicalHint:'',seed:'persist-event'};const eventFork=[persistedEvent,first[1],first[2]];persistence.writeRun({...run,currentTravelChoices:eventFork},storage,1150);const persistedEventFork=persistence.readRun(storage);assert(persistedEventFork);assert.strictEqual(persistedEventFork.currentTravelChoices[0].mechanicalHint,'');
  const persistedTwelve={...first[0],id:'persist.12',type:'skirmish',label:'СТЫЧКА',stars:12,threatLabel:'ЛЕГЕНДАРНАЯ',mechanicalHint:'Нестандартный состав противника.',seed:'persist-12',playerColor:'b',enemyRaceTag:'orcs'};const highStarFork=[persistedTwelve,first[1],first[2]];persistence.writeRun({...run,currentTravelChoices:highStarFork},storage,1200);const persistedFork=persistence.readRun(storage);assert(persistedFork);assert.strictEqual(persistedFork.currentTravelChoices[0].stars,12);
  const activeTwelve={...persistedTwelve,combatCountAtSelection:0,supplyCostAtSelection:1,supplyPaid:1};persistence.writeRun({...run,currentTravelChoices:null,activeTravelChoice:activeTwelve},storage,1300);const persistedActive=persistence.readRun(storage);assert(persistedActive);assert.strictEqual(persistedActive.activeTravelChoice.combatCountAtSelection,0);
  const staleCompleted={...run,updatedAt:1400,skirmishCount:1,currentTravelChoices:null,activeTravelChoice:activeTwelve};storage.setItem(persistence.RUN_STORAGE_KEY,JSON.stringify(staleCompleted));const recovered=persistence.readRun(storage);assert(recovered);assert.strictEqual(recovered.activeTravelChoice.id,activeTwelve.id,'completed power-v1 route must remain until Elo settlement');assert.strictEqual(recovered.skirmishCount,1);
  const legacyActive={...activeTwelve,difficultyModel:undefined};const legacyCompleted={...run,updatedAt:1410,skirmishCount:1,currentTravelChoices:null,activeTravelChoice:legacyActive};storage.setItem(persistence.RUN_STORAGE_KEY,JSON.stringify(legacyCompleted));const legacyRecovered=persistence.readRun(storage);assert(legacyRecovered);assert.strictEqual(legacyRecovered.activeTravelChoice,null,'legacy completed combat route still auto-recovers');
  const manualSkirmish={id:'manual.s',step:1,type:'skirmish',label:'СТЫЧКА',stars:12,threatLabel:'ЛЕГЕНДАРНАЯ',flavor:'Путь.',mechanicalHint:'Нестандартный состав противника.',seed:'manual-s',playerColor:'b',enemyRaceTag:'orcs'};globalThis.RPChessTravelEncounterOverride=manualSkirmish;const rs=skirmish.createEncounter({seed:'fallback',stars:5});assert.strictEqual(rs.seed,'manual-s');assert.strictEqual(rs.stars,12);assert.strictEqual(rs.aiElo,2600);assert.strictEqual(rs.playerColor,'b');
  const manualBattle={...manualSkirmish,id:'manual.b',type:'battle',label:'БИТВА',seed:'manual-b'};globalThis.RPChessTravelEncounterOverride=manualBattle;const rb=battle.createBattleEncounter({seed:'fallback',stars:1});assert.strictEqual(rb.seed,'manual-b');assert.strictEqual(rb.stars,12);assert.strictEqual(rb.aiElo,2600);

  // New Journey is a sparse infinite kingdom map. The legacy three-card
  // generator remains a compatibility API, but the map discovers ONE route.
  const mapCore=await import(pathToFileURL(path.join(game,'js/kingdom-map-core.mjs')).href);
  const roadGraph=await import(pathToFileURL(path.join(game,'js/kingdom-road-network.mjs')).href);
  const walkers=await import(pathToFileURL(path.join(game,'js/kingdom-road-travelers.mjs')).href);
  const roadSeed=mapCore.createKingdomMap({id:'road-graph-scouting'},400,'humans');
  const scoutedOwned={...roadSeed,cells:{...roadSeed.cells,
   '1,0':{status:'revealed',explored:false,annexed:true,selectedEncounter:{id:'road-event-a',type:'battle'}},
   '2,0':{status:'revealed',explored:false,annexed:true,selectedEncounter:{id:'road-event-b',type:'skirmish'}}}};
  const firstRoad=roadGraph.synchronizeRoyalRoads({...scoutedOwned,
    cells:{...scoutedOwned.cells,'2,0':undefined}});
  assert(firstRoad.royalRoads.some(e=>roadGraph.pairKey(e.from,e.to)==='0,0::1,0'),
    'a scouted owned event is connected to Castle before it is completed');
  const secondRoad=roadGraph.synchronizeRoyalRoads(scoutedOwned);
  const secondKeys=secondRoad.royalRoads.map(e=>roadGraph.pairKey(e.from,e.to));
  assert.deepStrictEqual(secondKeys,['0,0::1,0','1,0::2,0'],
    'one direct exit east from Castle, with the next event reusing the existing road');
  assert.equal(secondKeys.length,new Set(secondKeys).size,'no physical road segments are duplicated');
  assert(secondRoad.royalRoads.every(e=>{
    const a=e.from.split(',').map(Number),b=e.to.split(',').map(Number);
    return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])===1;
  }),'no diagonal road edges');
  assert.strictEqual(roadGraph.synchronizeRoyalRoads(secondRoad),secondRoad,
    'unchanged map remains idempotent after load');
  const oldSave=roadGraph.synchronizeRoyalRoads({...scoutedOwned,royalRoads:undefined,
    completedRoads:[{id:'legacy',from:'0,0',to:'2,0',bend:.9}]});
  assert.equal(oldSave.royalRoadsVersion,3,'old road saves migrate to current v3 network');
  assert(oldSave.completedRoads.length===1,'historic road receipts are retained');
  assert(oldSave.royalRoads.every(e=>e.bend===0),
    'old duplicate/diagonal drawing replaced by canonical cardinal grid');
  const expanded=roadGraph.synchronizeRoyalRoads({...secondRoad,cells:{...secondRoad.cells,
    '1,1':{status:'revealed',explored:false,annexed:true,
      selectedEncounter:{id:'road-event-c',type:'event'}}}});
  assert.equal(expanded.royalRoads.length,
    new Set(expanded.royalRoads.map(e=>roadGraph.pairKey(e.from,e.to))).size,
    'constructing an event on a crossing never doubles existing road segments');
  const reusedCell=expanded.royalRoads.find(e=>e.from!=='0,0'&&e.to!=='0,0').to;
  const onRoad=roadGraph.synchronizeRoyalRoads({...expanded,cells:{...expanded.cells,
    [reusedCell]:{...expanded.cells[reusedCell],status:'completed',
      selectedEncounter:{id:'new-settlement',type:'settlement'}}}});
  assert.equal(onRoad.royalRoads.length,
    new Set(onRoad.royalRoads.map(e=>roadGraph.pairKey(e.from,e.to))).size,
    'a settlement on an already-paved tile must use the existing connection');
  const sectors=[[0,-4],[0,4],[4,0],[-4,0]].map(([x,y])=>x+','+y);
  const allCells={...scoutedOwned.cells};
  for(const id of sectors)allCells[id]={status:'revealed',explored:false,annexed:true,
    selectedEncounter:{id:'sector-'+id,type:'battle'}};
  const fourRoad=roadGraph.synchronizeRoyalRoads({...scoutedOwned,cells:allCells});
  const castleExits=fourRoad.royalRoads.filter(e=>e.from==='0,0'||e.to==='0,0');
  assert(castleExits.length===4&&new Set(castleExits.map(e=>e.from==='0,0'?e.to:e.from)).size===4,
    'Castle has exactly one paved exit on each active cardinal side');
  assert.deepStrictEqual(new Set(castleExits.map(e=>e.from==='0,0'?e.to:e.from)),
    new Set(['0,-1','0,1','1,0','-1,0']));
  // The nearest discovered owned events within TWO king moves must share
  // a short, orthogonal paved connector without painting edges twice.
  const shortPair=new Map(),twoStep=roadGraph.linkNearbyOwnedEvents(
    {...secondRoad,centralOwnedCells:['0,0','1,0','2,0','2,1','2,2']},
    shortPair,['2,0','2,2']);
  assert.strictEqual(twoStep.size,2,'nearby owned events two moves apart form two paved tiles');
  assert(twoStep.has('2,0::2,1')&&twoStep.has('2,1::2,2'),
    'a two-transition road uses a shared cardinal corridor');
  roadGraph.linkNearbyOwnedEvents(secondRoad,twoStep,['2,0','2,2']);
  assert.strictEqual(twoStep.size,2,'re-requesting the same connector does not overlay paving');
  roadGraph.linkNearbyOwnedEvents(secondRoad,new Map(),['2,0','2,3']);
  const distant=new Map();
  roadGraph.linkNearbyOwnedEvents(secondRoad,distant,['2,0','2,3']);
  assert.equal(distant.size,0,'events farther than two king moves do not get a short connector');
  // Journey history is independent of owned land and must remain visible
  // outside the kingdom, in completion order, even with v3 royal roads.
  const outsideMap={...secondRoad,
    cells:{...secondRoad.cells,
      '3,0':{status:'completed',explored:true,annexed:false,selectedEncounter:{id:'outer-1',type:'event'}},
      '4,1':{status:'completed',explored:true,annexed:false,selectedEncounter:{id:'outer-2',type:'battle'}}},
    completedRoads:[
      {id:'journey:1',from:'0,0',to:'3,0',bend:.55},
      {id:'journey:2',from:'3,0',to:'4,1',bend:-.6}]};
  const journeyRoads=roadGraph.visibleTravelRoads(outsideMap);
  assert.equal(journeyRoads.length,2,'historic completed Journey roads are visible beyond owned territory');
  assert.deepStrictEqual(journeyRoads.map(r=>[r.from,r.to]),[['0,0','3,0'],['3,0','4,1']],
    'first completed encounter connects to Castle, subsequent one to previous event');
  assert(journeyRoads.every(r=>r.kind==='travel'&&r.bend!==0),
    'restored Journey roads retain curved geometry for gray stone paving');
  const allRoads=walkers.adjacencyOf([...roadGraph.visibleRoyalRoads(outsideMap),...journeyRoads]);
  assert(walkers.findRoute(allRoads,'0,0','4,1')?.length>=2,
    'free travelers may use the outside Journey road network');
  const duplicateInside=roadGraph.visibleTravelRoads({...secondRoad,completedRoads:[
    {id:'covered:1',from:'0,0',to:'1,0',bend:.4}]});
  assert.equal(duplicateInside.length,0,'a completed road does not duplicate covered owned paving');
  const dedup=roadGraph.visibleRoyalRoads({...secondRoad,outpostRoads:[
    {id:'old-reverse',from:'2,0',to:'0,0',bend:.5}]});
  assert.equal(dedup.length,secondRoad.royalRoads.length,
    'legacy roads must never be painted over the new canonical network');
  assert(!walkers.entirelyOwned({from:'0,0',to:'3,0',bend:0},new Set(['0,0','3,0'])),
    'patrols and builders cannot cross neutral territory');
  assert(walkers.entirelyOwned({from:'0,0',to:'1,0',bend:0},new Set(['0,0','1,0'])),
    'a fully owned road segment is available to patrols/builders');
  assert.equal(walkers.territoryTravelerQuota(fourRoad),0,
    'a territory below five central lands must have no decorative NPC quota');
  assert.equal(walkers.createTravelers(fourRoad,{parchment:true}).length,0,
    'roads alone never spawn walkers when the HUD holds fewer than five lands');
  const npcLands=['0,0','1,0','2,0','0,1','-1,0','0,-1'];
  const travelerMap={...fourRoad,centralOwnedCells:npcLands};
  const scheduledTravelers=walkers.createTravelers(travelerMap,{parchment:true});
  assert(scheduledTravelers.length>0&&scheduledTravelers.length<=5,
    'five central lands allow at most one actor of each kind with a valid route');
  assert(scheduledTravelers.every(a=>a.speed>=.10&&a.speed<=.23),
    'all five traveler types retain their 3x slower speed');
  assert(new Set(scheduledTravelers.map(a=>a.spawnDelay)).size===scheduledTravelers.length,
    'travelers start at staggered times');
  const firstTraveler=scheduledTravelers[0];
  assert(firstTraveler.legs.length>=2,
    'a traveler must have an outward route and return trip');
  assert(walkers.travelerPosition(travelerMap,firstTraveler,firstTraveler.spawnDelay),
    'traveler appears at its scheduled start');
  if(firstTraveler.spawnDelay>0)
    assert.strictEqual(walkers.travelerPosition(travelerMap,firstTraveler,firstTraveler.spawnDelay-.01),null);
  const firstLeg=firstTraveler.legs[0];
  const arrival=firstTraveler.spawnDelay+firstLeg.distance/firstTraveler.speed;
  const hold1=walkers.travelerMotion(travelerMap,firstTraveler,arrival+firstLeg.hold*.3);
  const hold2=walkers.travelerMotion(travelerMap,firstTraveler,arrival+firstLeg.hold*.7);
  assert(hold1&&!hold1.moving&&hold2&&!hold2.moving,
    'traveler is resting at an intermediate waypoint');
  assert.deepStrictEqual(hold1.position,hold2.position,'no walking during a pause');
  assert(scheduledTravelers.every(actor=>actor.legs.length>=2),
    'every eligible NPC has at least outbound and return legs');
  // Courier may cross the foreign frontier on a natural road; a merchant
  // must NOT appear merely because a trail crosses an unrelated road event.
  let trailId=null;
  for(let y=-10;y<=10&&!trailId;y++)for(let x=-10;x<=10;x++){
   const candidate=x+','+y;
   if(candidate!=='0,0'&&walkers.nearestNaturalRoad(secondRoad,candidate)!==null){
    trailId=candidate;break;
   }
  }
  assert(trailId,'fixture has a natural trail crossing an event square');
  const trailMap={...secondRoad,centralOwnedCells:npcLands,cells:{...secondRoad.cells,
   [trailId]:{status:'revealed',explored:true,annexed:true,
    selectedEncounter:{id:'road-trail-source',type:'event'}}},
   // Clear the royal network to isolate the natural-road behavior.
   royalRoadsVersion:3,royalRoads:[],completedRoads:[]};
  const roaming=walkers.createTravelers(trailMap,{parchment:true});
  assert(!roaming.some(actor=>actor.type==='merchant'),
    'merchants need a castle-to-settlement route, not arbitrary road scenery');
  const courier=roaming.find(actor=>actor.type==='courier');
  assert(courier?.kind==='natural',
    'a courier on a scouted natural highway may travel outside the kingdom');
  const destination=walkers.travelerPosition(trailMap,courier,
    courier.spawnDelay+courier.maxDistance/courier.speed);
  assert(destination&&!mapCore.isOwned(trailMap,{
    x:Math.floor(destination.x),y:Math.floor(destination.y)}),
    'a courier can continue along a natural highway across the foreign border');
  const outsideId=Math.floor(destination.x)+','+Math.floor(destination.y);
  const visibleOutside={...trailMap,cells:{...trailMap.cells,
   [outsideId]:{status:'completed',explored:true,annexed:false,type:'empty'}}};
  assert(walkers.visibleTraveler(visibleOutside,courier,destination),
    'the courier is visible on previously scouted foreign land');

  const mapRun=persistence.createRun({id:'kingdom-map-contract',now:1700000000000});
  for(const type of ['battle','skirmish']){
    const route={id:'kingdom.test.'+type,type,seed:'seed-'+type,stars:7};
    const engineId=type+'-'+travel.hashString(route.seed).toString(36)+'-7';
    assert(mapCore.matchesCombatReceipt(route,{encounterId:engineId}),
      'existing '+type+' results must match their genuine engine encounter ID');
    assert(mapCore.matchesCombatReceipt(route,{routeId:route.id,encounterId:engineId}),
      'new '+type+' receipts store the map route ID explicitly');
    assert(mapCore.matchesCombatReceipt(route,{encounterId:route.id}),
      'legacy synthetic route ID remains readable');
    assert(!mapCore.matchesCombatReceipt(route,{encounterId:engineId+'-other'}),
      'unrelated '+type+' results must not unlock a map cell');
  }
  const world=await import(pathToFileURL(path.join(game,'js/kingdom-world-core.mjs')).href);
  const worldConfig=await import(pathToFileURL(path.join(game,'js/kingdom-world-config.mjs')).href);
  assert.deepStrictEqual(worldConfig.DENSITY,[27,25,36,25,29,18],
    'author approved biome encounter density survives in the playable build');
  assert.strictEqual(worldConfig.DENSITY_MULTIPLIER,1.2,
    'new Atlas Lab config increases encounter frequency without rerolling saved cells');
  for(const name of ['stampOpacity','baseOpacity','roadOpacity','riverOpacity','marshOpacity','landmarkOpacity'])
    assert.strictEqual(worldConfig.VISUAL[name],1, name+' must paint map scenery fully opaque');
  assert.strictEqual(worldConfig.VISUAL.fogOpacity,0.98,'fog remains translucent on purpose');
  assert.strictEqual(worldConfig.VISUAL.fogRadius,1.1);
  assert.strictEqual(worldConfig.VISUAL.revealRadius,1.6);
  assert.strictEqual(worldConfig.VISUAL.fogInner,0.32);
  assert.strictEqual(worldConfig.VISUAL.fogInkOpacity,0.2);
  assert.strictEqual(worldConfig.VISUAL.fogIrregularity,0.3);
  assert.strictEqual(worldConfig.ATLAS_VIEW.seed,'rpchess-kingdom-2026');
  assert.strictEqual(worldConfig.ATLAS_VIEW.zoom,117);
  assert.strictEqual(worldConfig.SETTLEMENT_PROBABILITY_MULTIPLIER,1.2);
  const startingChances=[.12,.22,.11,.10,.28,.17];
  const raised=world.boostSettlementProbability(startingChances);
  assert(Math.abs(raised[3]-.12)<1e-12,'10% settlements should become 12%');
  assert(Math.abs(raised.reduce((a,b)=>a+b,0)-1)<1e-12,'chance sum must remain 1');
  assert(raised.every((v,i)=>i===3||Math.abs(v/startingChances[i]-(.88/.90))<1e-12),
    'five other event types must retain relative proportions');
  assert(Math.abs(world.boostSettlementProbability([.27,.23,.07,.06,.17,.20])[3]-.072)<1e-12,
    'the +20% bonus applies to each biome independently');
  for(const row of [...worldConfig.TYPE_WEIGHTS,...worldConfig.RACE_WEIGHTS])
    assert.strictEqual(row.reduce((sum,n)=>sum+n,0),100,
      'each approved biome encounter/race distribution adds up to 100 percent');
  const exposed=mapCore.revealAround(mapCore.createKingdomMap(mapRun,500),mapRun,500);
  assert.strictEqual(Object.keys(exposed.cells).length,25,
    'the king scouts its 5x5 neighborhood before selecting any encounter');
  assert(exposed.cells['1,0']?.status&&exposed.cells['-1,-1']?.status,
    'nearby terrain must be known without moving onto it');
  const known=exposed.cells['1,0'],worldIdentity=world.worldAt(exposed.seed,1,0);
  assert.strictEqual(Boolean(known.selectedEncounter),Boolean(worldIdentity.type),
    'world seed decides whether a cell is quiet before the fog clears');
  assert.deepStrictEqual(world.worldAt(mapRun.id,-7,4),world.worldAt(mapRun.id,-7,4),
    'negative-coordinate biome, landmark, type and race are stable');
  assert.strictEqual(mapCore.revealAround(exposed,mapRun,500),exposed,
    'reveal repeatedly must not reroll existing cells or reallocate the save');
  // Both empty land and eventual encounters exist in the same procedural world.
  const probes=Array.from({length:200},(_,x)=>world.worldAt(mapRun.id,x-100,4));
  assert(probes.some(item=>!item.type)&&probes.some(item=>item.type),
    'the map must contain both calm terrain and interesting encounters');
  const startMap=mapCore.createKingdomMap(mapRun,500);
  assert(mapCore.validateKingdomMap(startMap));
  assert.strictEqual(startMap.day,1,'the independent calendar begins on Day 1');
  // Atlas v6 config (4): radius=1, at most 3 OTHER sites in the 8 neighbors.
  const worldGen=await import(pathToFileURL(path.join(game,'js/kingdom-world-core.mjs')).href);
  const worldSettings=await import(pathToFileURL(path.join(game,'js/kingdom-world-config.mjs')).href);
  assert.strictEqual(worldSettings.ENCOUNTER_MIN_SPACING,1);
  assert.strictEqual(worldSettings.EVENT_NEARBY_MAX,3);
  assert.strictEqual(worldSettings.DENSITY_MULTIPLIER,1.2);
  const seed='rpchess-kingdom-2026',rawSites=[],acceptedSites=[];
  for(let y=-8;y<=8;y++)for(let x=-8;x<=8;x++){
    const raw=worldGen.worldAt(seed,x,y,{spacing:0});
    const chosen=worldGen.worldAt(seed,x,y);
    assert.deepStrictEqual(chosen,worldGen.worldAt(seed,x,y),
      'coordinate sampling must not depend on exploration or canvas order');
    if(raw.type)rawSites.push([x,y]);
    if(chosen.type)acceptedSites.push([x,y]);
  }
  assert(rawSites.length>acceptedSites.length&&acceptedSites.length>0,
    'bounded neighboring quotas keep fewer than the unfiltered candidate sites');
  for(const [x,y] of acceptedSites){
    const count=[-1,0,1].flatMap(dy=>[-1,0,1].map(dx=>[dx,dy]))
      .filter(([dx,dy])=>(dx||dy)&&worldGen.encounterPresent(seed,x+dx,y+dy)).length;
    assert(count<=3,'each event has at most three other encounters within one king move');
  }
  assert(!worldGen.encounterPresent(seed,0,0),'starting castle stays reserved');
  const geography=await import(pathToFileURL(path.join(game,'js/kingdom-geography.mjs')).href);
  for(let y=-14;y<=14;y++)for(let x=-14;x<=14;x++){
    const geometric=geography.nearestNaturalPaths(seed,x+.5,y+.5);
    const semantic=worldGen.naturalPathAt(seed,x+.5,y+.5,{generatorVersion:6});
    assert.equal(semantic.road,geometric.road,'world road must match rendered geometry');
    assert.equal(semantic.river,geometric.river,'world river must match rendered geometry');
    const landmark=worldGen.landmarkAt(seed,x,y,{generatorVersion:6});
    if(['06_wood_bridge','07_stone_bridge'].includes(landmark))
      assert(geometric.river,'semantic bridge must be placed next to visible water');
  }
  const legacyPath=worldGen.naturalPathAt(seed,5.5,6.5,{generatorVersion:5});
  assert(typeof legacyPath.road==='boolean'&&typeof legacyPath.river==='boolean',
    'v5 generated worlds retain their prior path rules');
  assert.equal(fs.existsSync(path.join(game,'atlas-lab.html')),true,
    'Atlas Lab v6 HTML must be shipped alongside its map preview');
  assert(fs.readFileSync(path.join(game,'atlas-lab.html'),'utf8').includes('Симулировать'),
    'balance panel includes the requested simulation action');
  const atlasHtml=fs.readFileSync(path.join(game,'atlas-lab.html'),'utf8');
  assert(atlasHtml.includes('RPChessAtlasSimulation')&&atlasHtml.includes('simSpacingRules'),
    'author Atlas Lab v6 must preserve its original simulator and new radius/neighbor settings');

  const route=mapCore.shortestKingRoute(startMap,{x:7,y:-4});
  assert.strictEqual(route.length,7,'diagonal king path has Chebyshev minimum length');
  assert.deepStrictEqual(route[0],{x:1,y:-1});
  assert.deepStrictEqual(route.at(-1),{x:7,y:-4});
  assert(route.every((point,i)=>mapCore.adjacent(i?route[i-1]:startMap.king,point)));
  assert.deepStrictEqual(mapCore.shortestKingRoute(startMap,{x:0,y:0}),[]);
  assert.deepStrictEqual(mapCore.shortestKingRoute(startMap,{x:401,y:0}),[],
    'overlong accidental drags do not launch unbounded autopilot');
  // Weekly production is a game-calendar event, never a real-time timer.
  const producerId=startMap.centralOwnedCells.find(id=>id!=='0,0');
  const productionMap={...startMap,cells:{...startMap.cells,
    [producerId]:{status:'completed',explored:true,completedOnce:true,
      selectedEncounter:{id:'kingdom.settlement.fixture',type:'settlement',stars:1}}}};
  let weekly=productionMap;
  for(let day=0;day<6;day++)weekly=mapCore.advanceDay(weekly,'economic-day:'+day);
  assert.strictEqual(weekly.day,7);
  assert.strictEqual(mapCore.weekForDay(weekly.day),1);
  const ready=weekly.cells[producerId].production;
  assert(ready&&ready.kind==='gold'&&ready.amount===10,
    'Day 7 queues one Gold reward for an owned completed Settlement');
  assert.strictEqual(mapCore.settleWeeklyProduction(weekly),weekly,
    'production is generated at most once per week');
  // N = route level for resource rewards; old level-I routes remain unchanged.
  const economy=await import(pathToFileURL(path.join(game,'js/kingdom-economy-config.mjs')).href);
  const fiveStarMap={...productionMap,cells:{...productionMap.cells,
    [producerId]:{...productionMap.cells[producerId],
      selectedEncounter:{...productionMap.cells[producerId].selectedEncounter,stars:5}}}};
  const fiveStarWeek=mapCore.settleWeeklyProduction({...fiveStarMap,day:7,processedThroughWeek:0});
  assert.strictEqual(fiveStarWeek.cells[producerId].production.amount,50,
    'level-V Settlement must produce 10×5 Gold per week');
  assert.deepStrictEqual([
    economy.weeklyResourceProduction('caravan','gold',5),
    economy.weeklyResourceProduction('caravan','supplies',5),
    economy.weeklyResourceProduction('event','gold',5),
    economy.weeklyResourceProduction('event','supplies',5),
    economy.weeklyResourceProduction('puzzle','shards',5)
  ],[25,25,10,10,5],'the five resource payouts must scale with route level');
  assert.deepStrictEqual([
    economy.weeklyResourceProduction('settlement','gold',12),
    economy.weeklyResourceProduction('settlement','gold',undefined),
    economy.weeklyResourceProduction('skirmish','recruits',12),
    economy.weeklyResourceProduction('battle','battle',12)
  ],[120,10,null,null],'cap at level XII, legacy level I and exclude non-resources');


  const collected=mapCore.collectProduction(weekly,producerId);
  assert(collected.ok&&collected.kind==='gold'&&collected.amount===10);
  assert(!mapCore.collectProduction(collected.map,producerId).ok,
    'the same reward cannot be claimed twice');
  assert.deepStrictEqual(mapCore.advanceDay(collected.map,'economic-day:5'),collected.map,
    'calendar replay never spawns the previous production again');
  let weekTwo=collected.map;
  for(let day=6;day<13;day++)weekTwo=mapCore.advanceDay(weekTwo,'economic-day:'+day);
  assert.strictEqual(weekTwo.day,14);
  assert(weekTwo.cells[producerId].production?.week===2,
    'after claiming, the next weekly reward can arrive on Day 14');
  // A still-uncollected reward remains one portion, not an unbounded backlog.
  let weekThree=weekly;
  for(let day=6;day<20;day++)weekThree=mapCore.advanceDay(weekThree,'skip-week:'+day);
  assert.strictEqual(weekThree.cells[producerId].production?.week,1,
    'uncollected rewards are capped at a single portion');
  const remote={x:25,y:25},remoteId='25,25';
  const remoteMap={...startMap,cells:{...startMap.cells,
    [remoteId]:{status:'completed',explored:true,type:'empty'}}};
  assert(mapCore.canBuildOutpost(remoteMap,remote));
  const outpost=mapCore.buildOutpost(remoteMap,remote,'kingdom:outpost:fixture');
  assert(outpost.ok&&outpost.map.day===2);
  assert.strictEqual(outpost.map.outposts.length,1);
  assert.strictEqual(outpost.map.outpostRoads.length,1,
    'remote outpost gains exactly one stable curving link to the existing network');
  assert.equal(outpost.map.outpostRoads[0].to,remoteId);
  assert.equal(mapCore.linkOutpostRoad(outpost.map,remoteId),outpost.map,
    'reloading an outpost cannot add duplicate road segments');
  assert(outpost.outpost.cells.length===3&&outpost.outpost.cells.includes(remoteId));
  assert(mapCore.isOwned(outpost.map,remoteId)&&!mapCore.isOwned(remoteMap,remoteId));
  assert.strictEqual(mapCore.territoryCapacity(outpost.map),mapCore.territoryCapacity(startMap),
    'remote outpost does not spend or inflate main-castle land capacity');
  assert(!mapCore.buildOutpost(outpost.map,remote,'kingdom:outpost:fixture').ok,
    'same outpost can never be paid for twice');
  assert.strictEqual(mapCore.migrateKingdomMap(outpost.map),outpost.map,
    'outpost and old save fields stay valid across hydration');

  assert.deepStrictEqual(startMap.completedRoads,[],'no roads before a cleared event');
  assert.strictEqual(startMap.lastCompletedRouteCell,null);
  assert.strictEqual(mapCore.territoryCapacity(startMap),5,
    '500 peak Power automatically grants five lands outside the castle');
  assert.strictEqual(startMap.centralOwnedCells.length,6);
  // New runs place the castle in an allowed home biome; old maps keep their seeds.
  const homeBiomes={humans:['plains'],elves:['forest'],orcs:['hills','wasteland'],
   undead:['marsh','wasteland'],dark_elves:['marsh','wasteland'],
   dwarves:['mountain','hills'],demons:['wasteland'],angels:['mountain'],
   dragonborn:['mountain'],beastfolk:['forest','hills'],
   constructs:['wasteland','hills'],animals:['plains','forest'],
   fae:['forest'],goblins:['marsh','hills']};
  for(const [race,allowed] of Object.entries(homeBiomes)){
   const created=mapCore.createKingdomMap({id:'race-biome-smoke-'+race},500,race);
   assert(allowed.includes(worldGen.biomeAt(created.seed,0,0)),
    'new '+race+' castle starts in a preferred biome');
   assert.strictEqual(created.castle.raceTag,race);
   assert.strictEqual(created.king.x,0);
  }
  assert.strictEqual(mapCore.pointsAvailable(startMap),0,
    'automatic annexation leaves no unused manual purchases');
  assert.strictEqual(mapCore.castleLevel(500),2);
  assert.strictEqual(mapCore.castleLevel(2000),5);
  assert.deepStrictEqual([1,2,3,4,5,6,7,8,9,10,11,12].map(mapCore.romanForStars),
    ['I','II','II','II','III','III','IV','IV','IV','V','V','V']);
  const owned=new Set(startMap.centralOwnedCells);
  assert(owned.has('0,0')&&owned.size===6);
  const connected=new Set(['0,0']),queue=['0,0'];
  for(let n=0;n<queue.length;n++){
    const [x,y]=queue[n].split(',').map(Number);
    for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){
      const id=(x+dx)+','+(y+dy);
      if(owned.has(id)&&!connected.has(id)){connected.add(id);queue.push(id);}
    }
  }
  assert.strictEqual(connected.size,owned.size,'all automatic lands connect to the castle orthogonally');
  assert(!mapCore.adjacent({x:0,y:0},{x:2,y:0}));
  for(const [x,y] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){
    const point={x,y},choice=mapCore.randomEncounter(mapRun,point,500);
    assert(travel.isTravelChoice(choice)&&choice.kingdomCell===mapCore.keyOf(x,y));
    assert.deepStrictEqual(choice,mapCore.randomEncounter(mapRun,point,500),
      'the same world coordinate retains the same route');
    assert(['skirmish','battle','event','settlement','puzzle','caravan'].includes(choice.type));
    if(choice.type==='puzzle')assert.strictEqual(choice.raceTag,null);
    const step=mapCore.enterCell(startMap,point,choice,1000);
    assert(step.ok&&step.kind==='discover');
    assert.strictEqual(step.map.day,2,'first exploration is exactly one day');
    assert(!mapCore.enterCell(step.map,{x:x+1,y},choice).ok,'cannot move during pending encounter');
    const started=mapCore.beginEncounter(step.map,mapCore.keyOf(x,y));
    assert(started.ok);
    const lost=mapCore.finishEncounter(started.map,mapCore.keyOf(x,y),{success:false});
    assert(lost.ok&&lost.retreated&&lost.map.day===3,
      'the unsuccessful encounter is a separate meaningful day');
    assert.deepStrictEqual(lost.map.king,{x:0,y:0},'draw/defeat retreats the king');
    assert.strictEqual(lost.map.cells[mapCore.keyOf(x,y)].status,'failed');
    assert(!mapCore.canAnnex(lost.map,point),'manual annexation is disabled');
    const repeat=mapCore.enterCell(lost.map,point);
    assert(repeat.ok&&repeat.kind==='retry'&&repeat.cell.selectedEncounter.id===choice.id);
    assert.strictEqual(repeat.map.day,3,'retrying a known cell does not repeat exploration day');
  }
  const climbed=mapCore.updatePeak(startMap,1100);
  assert.strictEqual(mapCore.territoryCapacity(climbed),11);
  assert.strictEqual(climbed.centralOwnedCells.length,12);
  assert.strictEqual(Object.keys(climbed.cells).length,1,
    'newly owned fog squares do not reveal unknown encounters or allocate fake cells');
  assert.strictEqual(mapCore.updatePeak(climbed,650),climbed,
    'loss of current rating never revokes previously owned land');
  assert(!mapCore.annexCell(startMap,{x:1,y:0}).ok,
    'the obsolete manual annex button cannot consume points');
  const legacy={...startMap,day:undefined,calendarActions:undefined,
    centralOwnedCells:undefined,legacyBonusLands:undefined,uniqueFirstConquests:undefined,
    battlePointsEarned:3,creditedBattleEncounterIds:['old-battle'],
    annexationPointsSpent:2,completedRoads:undefined,lastCompletedRouteCell:undefined,
    cells:{...startMap.cells,
      '9,9':{status:'completed',annexed:true}}};
  const migrated=mapCore.migrateKingdomMap(legacy,{journeyStep:4});
  assert.strictEqual(migrated.day,5,'migration preserves the previously displayed calendar floor');
  assert.deepStrictEqual(migrated.completedRoads,[],
    'legacy saves without completion order start fresh roads from the castle');
  assert.strictEqual(mapCore.territoryCapacity(migrated),8,
    'legacy battle bonus is applied once without discarding the old ledger');
  assert(mapCore.isOwned(migrated,'9,9'),'manual old territory survives the migration');
  assert.strictEqual(mapCore.migrateKingdomMap(migrated),migrated,
    'loading an already migrated kingdom does not add days or reallocate land');
  // New and existing saves: unseen Battle reserves a private red province
  // without seizing owned tiles, and converts ONLY that province on victory.
  const enemyBattleId='5,4',overlapId='5,5';
  const remoteBattle={id:'map.test-red-1',type:'battle',stars:5};
  const overlapBattle={id:'map.test-red-2',type:'battle',stars:6};
  const seeded={...startMap,cells:{...startMap.cells,
    [enemyBattleId]:{status:'revealed',explored:false,selectedEncounter:remoteBattle},
    [overlapId]:{status:'revealed',explored:false,selectedEncounter:overlapBattle}}};
  const reserved=mapCore.reserveBattleTerritories(seeded);
  assert.equal(reserved.battleTerritories.length,2);
  const colorA=reserved.battleTerritories.find(p=>p.id===enemyBattleId).colorIndex;
  const colorB=reserved.battleTerritories.find(p=>p.id===overlapId).colorIndex;
  assert(Number.isInteger(colorA)&&Number.isInteger(colorB)&&colorA!==colorB,
    'active Battles must keep different non-player territory colors');
  const redA=reserved.battleTerritories.find(p=>p.id===enemyBattleId).cells;
  const redB=reserved.battleTerritories.find(p=>p.id===overlapId).cells;
  assert.equal(redA.length,6,'Battle V owns six cells including its center');
  assert.equal(redB.length,7,'Battle VI owns seven cells including its center');
  assert(redA.includes(enemyBattleId));
  assert(redB.includes(overlapId),'each nearby Battle must keep its own center');
  assert(!redA.some(id=>startMap.centralOwnedCells.includes(id)),
    'reservation cannot steal a single pre-owned tile');
  assert(!redA.some(id=>redB.includes(id)),
    'neighboring Battle provinces never overlap');
  assert.deepStrictEqual(mapCore.reserveBattleTerritories(reserved).battleTerritories,
    reserved.battleTerritories,'red reservations must survive reload without reroll');
  // When a later scouting step discovers a Battle inside an older red
  // reservation, both centers survive and provinces remain disjoint.
  const singleBattle=mapCore.reserveBattleTerritories({...seeded,cells:{
    ...startMap.cells,[enemyBattleId]:seeded.cells[enemyBattleId]}});
  const delayedCenter=singleBattle.battleTerritories[0].cells[1];
  const delayed=mapCore.reserveBattleTerritories({...singleBattle,cells:{
    ...singleBattle.cells,[delayedCenter]:{status:'revealed',explored:false,
      selectedEncounter:{id:'map.test-delayed',type:'battle',stars:6}}}});
  const oldProvince=delayed.battleTerritories.find(p=>p.id===enemyBattleId);
  const lateProvince=delayed.battleTerritories.find(p=>p.id===delayedCenter);
  assert(oldProvince.cells.includes(enemyBattleId)&&lateProvince.cells.includes(delayedCenter),
    'late-discovered Battle must preserve both province centers');
  assert.equal(new Set([...oldProvince.cells,...lateProvince.cells]).size,
    oldProvince.cells.length+lateProvince.cells.length,
    'rebalanced red provinces must not overlap');
  assert.deepStrictEqual(mapCore.reserveBattleTerritories(delayed),delayed,
    'rebalanced red provinces must remain stable on save reload');
  const raisedRed=mapCore.updatePeak(reserved,2400);
  for(const enemyId of [...redA,...redB])assert(!raisedRed.centralOwnedCells.includes(enemyId),
    'Power growth cannot cross red territory');
  const scored={...reserved,king:{x:5,y:4},pendingCell:enemyBattleId,
    cells:{...reserved.cells,[enemyBattleId]:{...reserved.cells[enemyBattleId],
      status:'in_progress',lastEntryFrom:{x:0,y:0}}}};
  const conquered=mapCore.finishEncounter(scored,enemyBattleId,{success:true,opponentPower:1200});
  assert(conquered.ok);
  assert.equal(conquered.map.battleTerritories.length,1);
  assert.deepStrictEqual(conquered.map.battleTerritories[0].cells,redB,
    'conquest must retain the neighboring Battle province unchanged');
  assert.equal(conquered.map.battleTerritories[0].colorIndex,colorB,
    'remaining enemy color must not change after capture');
  assert.deepStrictEqual(new Set(conquered.map.battleConqueredCells),new Set(redA),
    'victory must transfer exactly the originally painted cells');
  assert(redA.every(id=>mapCore.isOwned(conquered.map,id)));
  assert.equal(conquered.map.centralOwnedCells.length,startMap.centralOwnedCells.length);
  assert.equal(conquered.map.uniqueFirstConquests[0].bonusLands,0);
  assert.equal(mapCore.playerTerritoryCount(conquered.map),
    new Set([...startMap.centralOwnedCells,...redA]).size,
    'HUD area counts all blue provinces without duplicates');
  const oldOwned={...seeded,centralOwnedCells:[...startMap.centralOwnedCells,enemyBattleId],
    cells:{...seeded.cells,[enemyBattleId]:{...seeded.cells[enemyBattleId],annexed:true}}};
  const oldReserved=mapCore.reserveBattleTerritories(oldOwned);
  assert(!oldReserved.battleTerritories[0].cells.includes(enemyBattleId),
    'legacy owned Battle centre never turns red');
  const savedTerritories=persistence.writeRun({...mapRun,kingdomMap:reserved},storage,1421);
  assert.deepStrictEqual(persistence.readRun(storage).kingdomMap.battleTerritories,
    reserved.battleTerritories,'Battle territories survive persistence');

  // Idempotent +1 day per new peaceful cell, even if its contents were already scouted.
  let walk=startMap;
  for(let x=1;x<=6;x++){
    const id=x+',0';
    walk={...walk,cells:{...walk.cells,[id]:{status:'completed',type:'empty',
      explored:false,annexed:mapCore.isOwned(walk,id)}}};
    const entered=mapCore.enterCell(walk,{x,y:0});
    assert(entered.ok&&entered.kind==='walk');walk=entered.map;
    assert.strictEqual(walk.day,x+1);
  }
  assert.strictEqual(walk.day,7,'the first in-game week reaches Day 7');
  const back=mapCore.enterCell(walk,{x:5,y:0});
  assert.strictEqual(back.map.day,7,'backtracking through explored land costs no days');
  const acted=mapCore.advanceDay(back.map,'significant:future-action');
  assert.strictEqual(acted.day,8);
  assert.strictEqual(mapCore.advanceDay(acted,'significant:future-action'),acted,
    'replayed action receipts never advance the calendar twice');
  // First Battle victory transfers its reserved province; only Skirmish and Caravan
  // still add their original power-based bonus to central territory.
  const battlePoint={x:0,y:1},battleRoute={...mapCore.randomEncounter(mapRun,battlePoint,500),
    id:'kingdom.test-battle',type:'battle'};
  const battleEnter=mapCore.enterCell(startMap,battlePoint,battleRoute);
  const battleStart=mapCore.beginEncounter(battleEnter.map,'0,1');
  const battleWin=mapCore.finishEncounter(battleStart.map,'0,1',{success:true,opponentPower:630});
  assert.strictEqual(battleWin.map.battlePointsEarned,0,'new Battle wins do not accrue legacy expansion credits');
  assert.strictEqual(battleWin.map.creditedBattleEncounterIds.length,1);
  assert.strictEqual(battleWin.map.uniqueFirstConquests[0].bonusLands,0);
  assert(mapCore.playerTerritoryCount(battleWin.map)>=mapCore.playerTerritoryCount(startMap));
  assert.equal(battleWin.map.battleTerritories.length,0,'defeated red province must disappear');
  assert.equal(battleWin.map.completedRoads.length,1);
  assert.deepStrictEqual({from:battleWin.map.completedRoads[0].from,
    to:battleWin.map.completedRoads[0].to},{from:'0,0',to:'0,1'},
    'first completed Battle links the castle to its actual coordinates');
  assert.notEqual(battleWin.map.completedRoads[0].bend,0,'road is a non-straight curve');
  assert.strictEqual(mapCore.linkCompletedRoad(battleWin.map,'0,1'),battleWin.map,
    'replaying the same completion cannot duplicate the road');
  const nextPoint={x:1,y:1},nextChoice=mapCore.randomEncounter(mapRun,nextPoint,500);
  const nextEntered=mapCore.enterCell(battleWin.map,nextPoint,nextChoice);
  assert(nextEntered.ok&&nextEntered.map.king.x===1);
  const nextFinished=mapCore.finishEncounter(
    mapCore.beginEncounter(nextEntered.map,'1,1').map,'1,1',{success:true,opponentPower:400});
  assert(nextFinished.ok&&nextFinished.map.completedRoads.length===2);
  assert.deepStrictEqual({from:nextFinished.map.completedRoads[1].from,
    to:nextFinished.map.completedRoads[1].to},{from:'0,1',to:'1,1'},
    'second completed event links directly to the last completed event');
  assert.strictEqual(mapCore.linkCompletedRoad(nextFinished.map,'1,1'),nextFinished.map,
    'reload or repeat victory does not reroll an existing road');
  assert.strictEqual(mapCore.territoryCapacity(battleWin.map),5);
  assert.strictEqual(battleWin.map.centralOwnedCells.length,startMap.centralOwnedCells.length,
    'Battle victory must not auto-grow the blue central region');
  assert.strictEqual(battleWin.map.day,3);
  assert(!mapCore.finishEncounter(battleWin.map,'0,1',{success:true,opponentPower:630}).ok,
    'the first victory receipt cannot be counted again');
  // The notification is separate from the actual respawn. Dismissing it
  // must leave the defender on site, while a second victory cannot grant land.
  const returning={...battleWin.map,cells:{...battleWin.map.cells,
    '0,1':{...battleWin.map.cells['0,1'],respawnReady:true,
      production:{id:'weekly:0,1:7:battle',week:1,kind:'battle',amount:1}}}};
  const ack=mapCore.acknowledgeReturn(returning,'0,1');
  assert(ack.ok&&ack.map.cells['0,1'].respawnReady===true);
  assert.equal(ack.map.cells['0,1'].production,null);
  assert(!mapCore.acknowledgeReturn(ack.map,'0,1').ok);
  const home=mapCore.enterCell(ack.map,{x:0,y:0});
  const respawnEntry=mapCore.enterCell(home.map,{x:0,y:1});
  assert(respawnEntry.ok&&respawnEntry.kind==='retry'&&respawnEntry.map.cells['0,1'].completedOnce===true);
  const rematch=mapCore.finishEncounter(
    mapCore.beginEncounter(respawnEntry.map,'0,1').map,'0,1',{success:true,opponentPower:15000});
  assert(rematch.ok&&!rematch.first,'returning defender is never a first conquest');
  assert.strictEqual(rematch.map.uniqueFirstConquests.length,battleWin.map.uniqueFirstConquests.length,
    'second win against same road object never expands kingdom');
  assert.strictEqual(mapCore.territoryCapacity(rematch.map),mapCore.territoryCapacity(battleWin.map));
  assert.strictEqual(rematch.map.completedRoads.length,battleWin.map.completedRoads.length);

  const caravanPoint={x:1,y:0},caravanRoute={...mapCore.randomEncounter(mapRun,caravanPoint,500),
    id:'kingdom.test-caravan',type:'caravan'};
  const caravanEnter=mapCore.enterCell(battleWin.map,caravanPoint,caravanRoute);
  // Use a separate starting map: battle winner's king currently occupies 0,1.
  const caravanStarting=mapCore.enterCell(startMap,caravanPoint,caravanRoute);
  const caravanBegin=mapCore.beginEncounter(caravanStarting.map,'1,0');
  const caravanWin=mapCore.finishEncounter(caravanBegin.map,'1,0',{success:true,opponentPower:850});
  assert(caravanWin.ok&&caravanWin.map.uniqueFirstConquests[0].type==='caravan');
  assert.deepStrictEqual({from:caravanWin.map.completedRoads[0].from,
    to:caravanWin.map.completedRoads[0].to},{from:'0,0',to:'1,0'},
    'a first Caravan completion builds its own initial castle road');
  assert.strictEqual(mapCore.territoryCapacity(caravanWin.map),7,'Caravan 850/300 grants two new lands');
  const skirmishPoint={x:0,y:-1},skirmishRoute={...mapCore.randomEncounter(mapRun,skirmishPoint,500),
    id:'kingdom.test-skirmish',type:'skirmish'};
  const skirmishStarting=mapCore.enterCell(startMap,skirmishPoint,skirmishRoute);
  const skirmishWin=mapCore.finishEncounter(
    mapCore.beginEncounter(skirmishStarting.map,'0,-1').map,'0,-1',
    {success:true,opponentPower:1040});
  assert(skirmishWin.ok,'Skirmish first victory completes');
  assert.strictEqual(skirmishWin.map.uniqueFirstConquests[0].type,'skirmish');
  assert.strictEqual(skirmishWin.map.uniqueFirstConquests[0].bonusLands,2,
    'Skirmish 1040/400 grants two lands with floor');
  assert.strictEqual(mapCore.territoryCapacity(skirmishWin.map),7);
  assert(!mapCore.finishEncounter(skirmishWin.map,'0,-1',{success:true,opponentPower:50000}).ok,
    'duplicate Skirmish completion is rejected');
  const persistedMap=persistence.writeRun({...mapRun,kingdomMap:climbed},storage,1420);
  const roundTrip=persistence.readRun(storage);
  assert(roundTrip?.kingdomMap?.centralOwnedCells.length===12,
    'new land and calendar survive run persistence');
  assert.strictEqual(roundTrip.kingdomMap.day,1);
  assert.strictEqual(roundTrip.schemaVersion,persistence.RUN_SCHEMA_VERSION);
  const oldCopy={...mapRun,kingdomMap:undefined};
  persistence.writeRun(oldCopy,storage,1430);
  assert.strictEqual(persistence.readRun(storage).kingdomMap,null,'legacy saves still load without a map');
  assert(travelAppSource.includes("import('./kingdom-map-app.mjs?"),'Journey loads its own map');
  assert(travelAppSource.includes('startMapEncounter'),'Journey routes directly to encounters');
  assert(fs.readFileSync(path.join(game,'css/kingdom-map.css'),'utf8').includes('km-king-step'),
    'king uses a smooth CSS step');
  // Keep the existing Journey regression responsible for the asset register:
  // no extra suite just to count files.
  const kingdomAssets=require('../scripts/kingdom-map-asset-runtime.cjs');
  const registered=kingdomAssets.assertKingdomMapAssetBudget(game);
  assert.strictEqual(registered.count,85);
  const parchment=await import(pathToFileURL(path.join(game,'js/kingdom-parchment-core.mjs')).href);
  assert.deepStrictEqual(Object.keys(parchment.GROUPS).sort(),[
    'fog_of_war_shapes','forest_clusters','hills_rocks','mountain_clusters',
    'parchment_base_variations'
  ],'the parchment atlas keeps exactly five core source-art groups');
  assert.strictEqual(Object.values(parchment.GROUPS).reduce((count,names)=>count+names.length,0),80,
    'road and river module assets are removed from the permanent catalog');
  for(const [kind,names] of Object.entries(parchment.GROUPS)){
    assert.strictEqual(names.length,16,kind+' has 16 separate sprites');
    for(let i=0;i<16;i++)assert.strictEqual(parchment.spritePath(kind,i),
      'assets/kingdom-parchment/'+kind+'/'+names[i]+'.png');
  }
  assert.strictEqual(parchment.pickSprite('saved-run','forest_clusters',-8,12),
    parchment.pickSprite('saved-run','forest_clusters',-8,12),
    'world sprite selection is stable for negative and positive coordinates');
  assert.strictEqual(parchment.chunkCoordinate(-1),-1,
    'negative world chunks use floor and do not mirror/repeat at origin');
  const parchmentRoot=path.join(game,'assets/kingdom-parchment');
  const firstSvg=path.join(parchmentRoot,'forest_clusters/01_small_grove.svg');
  for(const retired of ['road_segments','river_segments'])
    assert(!fs.existsSync(path.join(parchmentRoot,retired)),
      'discontinued modular '+retired+' must not be shipped');
  const extraGroups=fs.readdirSync(parchmentRoot,{withFileTypes:true})
    .filter(entry=>entry.isDirectory()&&!Object.keys(parchment.GROUPS).includes(entry.name));
  for(const entry of extraGroups){
    const files=fs.readdirSync(path.join(parchmentRoot,entry.name))
      .filter(name=>/\.(svg|png)$/i.test(name));
    assert.strictEqual(files.length,16,entry.name+' must contain exactly 16 new SVG/PNG sprites');
  }
  // Keep the artwork itself in the matching filename and remove frame art.
  const expectedMarsh=[
    '01_pale_marsh.svg','02_dark_marsh.svg','03_reeds.svg','04_hummocks.svg',
    '05_murky_pool.svg','06_bog.svg','07_dry_wasteland.svg',
    '08_cracked_earth.svg','09_dead_shrubs.svg','10_scorched_earth.svg',
    '11_ash_patch.svg','12_bare_stones.svg','13_marsh_edge.svg',
    '14_marsh_to_meadow.svg','15_wasteland_to_plain.svg','16_exposed_roots.svg'
  ];
  const marshDir=path.join(parchmentRoot,'marsh_wasteland_optional');
  assert.deepStrictEqual(fs.readdirSync(marshDir).filter(n=>n.endsWith('.svg')).sort(),expectedMarsh,
    'all 16 marsh artwork filenames must match their visual role');
  assert(!fs.existsSync(path.join(parchmentRoot,'territory_border_accents_optional')),
    'unused ornamental border assets must be deleted, not disguised as swamps');
  const landmarksDir=path.join(parchmentRoot,'decor_minor_landmarks');
  assert.strictEqual(fs.readdirSync(landmarksDir).filter(n=>n.endsWith('.svg')).length,16,
    'the 16 small landmarks remain available');
  assert.strictEqual(extraGroups.length,2,'only marsh and landmarks remain as optional groups');
  for(const dir of [marshDir,landmarksDir])
    assert.strictEqual(fs.readdirSync(dir).filter(n=>n.endsWith('.png')).length,0,
      'no duplicate PNG previews may be shipped in the SVG groups');
  // The experimental source archive is delivered independently of the app.
  // When installed, ensure the release contains the whole exact vector set.
  if(fs.existsSync(firstSvg)){
    for(const [kind,names] of Object.entries(parchment.GROUPS))
      for(const name of names){
        const file=path.join(parchmentRoot,kind,name+'.svg');
        assert(fs.existsSync(file),'parchment map missing art: '+file);
        const svg=fs.readFileSync(file,'utf8');
        assert(svg.includes('viewBox="0 0 128 128"')&&!/<(?:script|image|foreignObject)\b/i.test(svg),
          'parchment art must remain self-contained 128x128 SVG: '+name);
      }
  }
  assert(Math.abs(parchment.terrainAt('saved-run',5.13,-8.1).elevation-
    parchment.terrainAt('saved-run',5.130001,-8.1).elevation)<.00001,
    'continuous world terrain must not exhibit chunk boundary discontinuities');
  const {kingdomMapSprite,kingdomEncounterSprite}=await import(pathToFileURL(path.join(game,'js/kingdom-map-assets.mjs')).href);
  for(const race of kingdomAssets.KINGDOM_RACES)
    for(const kind of kingdomAssets.KINGDOM_TYPES)
      assert.strictEqual(kingdomMapSprite(kind,race),
        `assets/kingdom-map/${race}/${race}_${kind}_128.svg`);
  assert.strictEqual(kingdomMapSprite('puzzle','orcs'),
    'assets/kingdom-map/puzzle/puzzle_128.svg');
  const legacyMixedSvg=kingdomMapSprite('event','mixed','saved-mixed-event-id');
  assert(/^assets\/kingdom-map\/([a-z_]+)\/\1_event_128\.svg$/.test(legacyMixedSvg),
    'legacy mixed Events must display an existing race SVG, not the book icon');
  assert.strictEqual(kingdomMapSprite('event','mixed','saved-mixed-event-id'),legacyMixedSvg,
    'existing saved mixed Events keep the same SVG across rerenders');
  assert.strictEqual(kingdomMapSprite('unexpected','elves'),null);
  // Use the current Journey suite to assert named races and old-save hydration.
  const commanders=await import(pathToFileURL(path.join(game,'js/commander-portraits.mjs')).href);
  const settlement=await import(pathToFileURL(path.join(game,'js/settlement-core.mjs')).href);
  const raceAssets=await import(pathToFileURL(path.join(game,'js/race-assets.mjs')).href);
  const expectedRoles=['pawn','knight','bishop','rook','queen','king'];
  for(const type of ['battle','skirmish','caravan'])
    for(const race of raceAssets.RACE_TAGS)
      for(let stars=1;stars<=12;stars++){
        const role=expectedRoles[Math.floor((stars-1)/2)];
        assert.strictEqual(kingdomEncounterSprite({type,enemyRaceTag:race,stars}),
          raceAssets.racePiecePath(race,role,'b'),
          type+' / '+race+' / Threat '+stars+' must show the matching enemy-race figure');
      }
  assert.strictEqual(kingdomEncounterSprite({type:'battle',raceTag:'mixed',stars:12}),
    kingdomMapSprite('battle','mixed'),'unknown race must not be falsely represented by humans');
  assert.strictEqual(kingdomEncounterSprite({type:'event',raceTag:'mixed',seed:'fixed'}),
    kingdomMapSprite('event','mixed','fixed'),'mixed Events keep their deterministic cosmetic SVG');


  const mixedEvent=Array.from({length:512},(_,index)=>
    mapCore.randomEncounter(mapRun,{x:index+2,y:2},500))
    .find(choice=>choice.type==='event'&&choice.raceTag==='mixed');
  assert(mixedEvent,'the event catalog must produce mixed-race Kingdom events');
  assert(raceAssets.RACE_TAGS.includes(mixedEvent.visualRaceTag),
    'a mixed event keeps its narrative race but pins a valid cosmetic SVG race');
  const eventSvg=`assets/kingdom-map/${mixedEvent.visualRaceTag}/${mixedEvent.visualRaceTag}_event_128.svg`;
  assert.strictEqual(kingdomMapSprite('event',mixedEvent.raceTag,mixedEvent.visualRaceTag),eventSvg);
  assert.strictEqual(kingdomMapSprite('event',mixedEvent.raceTag,mixedEvent.seed),eventSvg,
    'old saved events without visualRaceTag recover the same per-cell art from the seed');
  const mixedMap={...startMap,cells:{...startMap.cells,
    [mixedEvent.kingdomCell]:{status:'completed',annexed:false,selectedEncounter:mixedEvent}}};
  persistence.writeRun({...mapRun,kingdomMap:mixedMap},storage,1510);
  const savedMixed=persistence.readRun(storage).kingdomMap.cells[mixedEvent.kingdomCell].selectedEncounter;
  assert.strictEqual(savedMixed.raceTag,'mixed','saving cosmetic art must not change event narrative');
  assert.strictEqual(savedMixed.visualRaceTag,mixedEvent.visualRaceTag,
    'selected visual race is stored with its cell for reloads');
  assert.strictEqual(commanders.COMMANDERS.length,7);
  for(const king of commanders.COMMANDERS)assert(raceAssets.RACE_TAGS.includes(king.raceTag),
    'commander must have an existing race: '+king.id);
  for(const hero of settlement.RECRUIT_LIBRARY)assert(raceAssets.RACE_TAGS.includes(hero.raceTag),
    'recruit must have an existing race: '+hero.id);
  for(const king of commanders.COMMANDERS){
    const a=persistence.createRun({id:'race-test-'+king.id,commanderId:king.id});
    assert.strictEqual(a.roster[0].raceTag,king.raceTag);
    assert.strictEqual(mapCore.createKingdomMap(a,500,king.raceTag).castle.raceTag,king.raceTag);
  }
  const oldNamed=persistence.createRun({id:'legacy-named-races',commanderId:'stone_crown'});
  const legacyRecruited={...settlement.recruitProfile('hero.roan_stag')};
  delete legacyRecruited.raceTag;
  const legacyRoster=oldNamed.roster.map(c=>{const x={...c};delete x.raceTag;return x});
  persistence.writeRun({...oldNamed,roster:[...legacyRoster,legacyRecruited]},storage,1500);
  const rehydrated=persistence.readRun(storage);
  assert.strictEqual(rehydrated.roster[0].raceTag,'dwarves','legacy commander gets canonical race');
  assert.strictEqual(rehydrated.roster.find(c=>c.id==='hero.roan_stag').raceTag,'beastfolk',
    'legacy recruited hero gets canonical race');
  // New kingdom settlement is an independent purchased service point; outside construction
  // must not annex land and must not let a weekly payout be claimed twice.
  let customMap=mapCore.createKingdomMap({id:'settlement-build-regression'},400,'humans');
  customMap.cells['20,20']={status:'completed',type:'empty',explored:true,annexed:false};
  assert(mapCore.canBuildSettlement(customMap,{x:20,y:20}),
    'explored vacant foreign cell can host a Settlement');
  const built=mapCore.buildSettlement(customMap,{x:20,y:20},'settlement-regression',
    {gold:160,shards:30,raceTag:'humans'});
  assert(built.ok&&!mapCore.isOwned(built.map,{x:20,y:20})&&
    !mapCore.canBuildSettlement(built.map,{x:20,y:20}),
    'the constructed Settlement must be permanent and must not annex land');
  const producing=mapCore.settleWeeklyProduction({...built.map,day:7,processedThroughWeek:0});
  const claimed=mapCore.collectProduction(producing,'20,20');
  assert(claimed.ok&&claimed.kind==='gold'&&
    !mapCore.collectProduction(claimed.map,'20,20').ok,
    'outside Settlement generates a single collectible weekly payout');

  console.log('Kingdom map sprite register: PASS (85 standalone SVGs, 14 races, 6 classes, neutral puzzle)');
  console.log('Travel Choice keeps 6-type ~16.7% pool, owner-keyed RU/EN compact UI and player Threat..Threat+3 encounter contract: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
