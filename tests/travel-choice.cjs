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
  const startMap=mapCore.createKingdomMap(mapRun,500);
  assert(mapCore.validateKingdomMap(startMap));
  assert.strictEqual(mapCore.pointsAvailable(startMap),2,'starting 500 Power earns 2 irreversible points');
  assert.strictEqual(mapCore.castleLevel(500),2);
  assert.strictEqual(mapCore.castleLevel(2000),5);
  assert.deepStrictEqual([1,2,3,4,5,6,7,8,9,10,11,12].map(mapCore.romanForStars),
    ['I','II','II','II','III','III','IV','IV','IV','V','V','V']);
  assert(!mapCore.adjacent({x:0,y:0},{x:2,y:0}));
  for(const [x,y] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){
    const point={x,y},choice=mapCore.randomEncounter(mapRun,point,500);
    assert(travel.isTravelChoice(choice)&&choice.kingdomCell===mapCore.keyOf(x,y));
    assert.deepStrictEqual(choice,mapCore.randomEncounter(mapRun,point,500),
      'the map must not reroll the outcome for the same coordinate');
    assert(['skirmish','battle','event','settlement','puzzle','caravan'].includes(choice.type));
    if(choice.type==='puzzle')assert.strictEqual(choice.raceTag,null);
    const step=mapCore.enterCell(startMap,point,choice,1000);
    assert(step.ok&&step.kind==='discover');
    assert(!mapCore.enterCell(step.map,{x:x+1,y},choice).ok,'cannot move during a pending encounter');
    const started=mapCore.beginEncounter(step.map,mapCore.keyOf(x,y));
    assert(started.ok);
    const lost=mapCore.finishEncounter(started.map,mapCore.keyOf(x,y),{success:false});
    assert(lost.ok&&lost.retreated);
    assert.deepStrictEqual(lost.map.king,{x:0,y:0},'draw/defeat rolls the king back');
    assert.strictEqual(lost.map.cells[mapCore.keyOf(x,y)].status,'failed');
    assert.strictEqual(mapCore.canAnnex(lost.map,point),false);
    const repeat=mapCore.enterCell(lost.map,point);
    assert(repeat.ok&&repeat.kind==='retry'&&repeat.cell.selectedEncounter.id===choice.id,
      'a failed encounter is always the same encounter on retry');
  }
  const diag={x:1,y:1},diagonalChoice=mapCore.randomEncounter(mapRun,diag,500);
  const diagEntry=mapCore.enterCell(startMap,diag,diagonalChoice);
  const diagDone=mapCore.finishEncounter(mapCore.beginEncounter(diagEntry.map,'1,1').map,'1,1',{success:true});
  assert(diagDone.ok&&!mapCore.canAnnex(diagDone.map,diag),
    'a diagonal touch is not sufficient for annexation');
  const ortho={x:1,y:0},orthoChoice=mapCore.randomEncounter(mapRun,ortho,500);
  const orthoEntry=mapCore.enterCell(startMap,ortho,orthoChoice);
  const orthoDone=mapCore.finishEncounter(mapCore.beginEncounter(orthoEntry.map,'1,0').map,'1,0',{success:true});
  assert(orthoDone.ok&&mapCore.canAnnex(orthoDone.map,ortho));
  const joined=mapCore.annexCell(orthoDone.map,ortho);
  assert(joined.ok&&mapCore.pointsAvailable(joined.map)===1);
  assert(mapCore.borderEdges(joined.map,{x:0,y:0}).includes('w')&&
    !mapCore.borderEdges(joined.map,{x:0,y:0}).includes('e'),
    'castle external perimeter omits the shared border with owned eastern cell');
  assert(!mapCore.annexCell(joined.map,ortho).ok,'never spend twice on the same cell');
  assert(mapCore.canAnnex({...joined.map,king:{x:1,y:1},
    cells:{...joined.map.cells,'1,1':diagDone.map.cells['1,1']}},diag),
    'a previously completed diagonal cell becomes annexable when a cardinal neighbor is owned');
  const climbed=mapCore.updatePeak(joined.map,1100);
  assert.strictEqual(mapCore.pointsAvailable(climbed),4);
  assert.strictEqual(mapCore.pointsAvailable(mapCore.updatePeak(climbed,650)),4,
    'rating loss never revokes earned annexation points');
  // Battle bonus is unique to a won BATTLE, not a draw, and uses actual
  // opponent Elo (the same aiElo generated from encounter stars).
  const battlePoint={x:0,y:1},battleRoute={...mapCore.randomEncounter(mapRun,battlePoint,500),
    id:'kingdom.test-battle',type:'battle'};
  const battleEnter=mapCore.enterCell(startMap,battlePoint,battleRoute);
  const battleStart=mapCore.beginEncounter(battleEnter.map,'0,1');
  const battleWin=mapCore.finishEncounter(battleStart.map,'0,1',{success:true,opponentPower:630});
  assert.strictEqual(battleWin.map.battlePointsEarned,3);
  assert.strictEqual(battleWin.map.creditedBattleEncounterIds.length,1);
  assert(!mapCore.finishEncounter(battleWin.map,'0,1',{success:true,opponentPower:630}).ok);
  const persistedMap=persistence.writeRun({...mapRun,kingdomMap:joined.map},storage,1420);
  const roundTrip=persistence.readRun(storage);
  assert(roundTrip?.kingdomMap?.cells['1,0'].annexed,'new map must survive run storage');
  assert.strictEqual(roundTrip.schemaVersion,persistence.RUN_SCHEMA_VERSION,'old saves must remain compatible');
  const oldCopy={...mapRun,kingdomMap:undefined};
  persistence.writeRun(oldCopy,storage,1430);
  assert.strictEqual(persistence.readRun(storage).kingdomMap,null,'legacy saves load without a map');
  assert(travelAppSource.includes("import('./kingdom-map-app.mjs?"),'new Journey loads its own map scene');
  assert(travelAppSource.includes('startMapEncounter'),'new Journey routes directly to encounters');
  assert(fs.readFileSync(path.join(game,'css/kingdom-map.css'),'utf8').includes('km-king-step'),
    'king moves use a smooth, explicit CSS transition');

  // Keep the existing Journey regression responsible for the asset register:
  // no extra suite just to count files.
  const kingdomAssets=require('../scripts/kingdom-map-asset-runtime.cjs');
  const registered=kingdomAssets.assertKingdomMapAssetBudget(game);
  assert.strictEqual(registered.count,85);
  const {kingdomMapSprite}=await import(pathToFileURL(path.join(game,'js/kingdom-map-assets.mjs')).href);
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
  console.log('Kingdom map sprite register: PASS (85 standalone SVGs, 14 races, 6 classes, neutral puzzle)');
  console.log('Travel Choice keeps 6-type ~16.7% pool, owner-keyed RU/EN compact UI and player Threat..Threat+3 encounter contract: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
