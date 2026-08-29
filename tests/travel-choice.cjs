const fs=require('fs'),path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
function memoryStorage(){const d=new Map();return{getItem:k=>d.has(k)?d.get(k):null,setItem:(k,v)=>d.set(k,String(v)),removeItem:k=>d.delete(k)}}
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const travelAppSource=fs.readFileSync(path.join(game,'js/travel-choice-app.mjs'),'utf8');
  assert(!travelAppSource.includes("document.addEventListener('click'"),'Travel must not intercept combat aftermath clicks globally; combat scenes route directly to Travel');
  assert(travelAppSource.includes('recoverAftermathRoute'),'Travel aftermath CTA must have an explicit stale-route recovery path');
  assert(travelAppSource.includes("source==='skirmish-aftermath'")&&travelAppSource.includes("source==='battle-aftermath'"),'Travel recovery must distinguish Skirmish and Battle aftermath sources');
  const travel=await import(pathToFileURL(path.join(game,'js/travel-choice-core.mjs')).href);
  const difficulty=await import(pathToFileURL(path.join(game,'js/encounter-difficulty.mjs')).href);
  const persistence=await import(pathToFileURL(path.join(game,'js/run-persistence.mjs')).href);
  const skirmish=await import(pathToFileURL(path.join(game,'js/skirmish-core.mjs')).href);
  const battle=await import(pathToFileURL(path.join(game,'js/battle-core.mjs')).href);
  assert.deepStrictEqual(travel.PLAYABLE_TRAVEL_TYPES,['skirmish','battle','settlement','event']);
  assert.strictEqual(travel.TRAVEL_CHOICE_COUNT,3);
  assert.strictEqual(difficulty.MAX_ENCOUNTER_STARS,12);
  assert.strictEqual(difficulty.difficultyForStars(1).elo,400);
  assert.strictEqual(difficulty.difficultyForStars(12).elo,2600);
  for(const type of travel.PLAYABLE_TRAVEL_TYPES){assert(Array.isArray(travel.FLAVOR_POOLS[type]));assert(travel.FLAVOR_POOLS[type].length>=10);}

  const first=travel.createTravelChoices({runId:'travel-test-run',step:1}),repeat=travel.createTravelChoices({runId:'travel-test-run',step:1});
  assert.deepStrictEqual(first,repeat);assert.strictEqual(first.length,3);assert.strictEqual(new Set(first.map(c=>c.id)).size,3);assert(first.every(travel.isTravelChoice));
  const duplicateFound=Array.from({length:100},(_,i)=>travel.createTravelChoices({runId:`dupe-${i}`,step:1})).some(f=>new Set(f.map(c=>c.type)).size<3);assert(duplicateFound,'independent pool must allow duplicate types in one fork');
  const counts={skirmish:0,battle:0,settlement:0,event:0};for(let i=0;i<4000;i++)for(const c of travel.createTravelChoices({runId:`distribution-${i}`,step:1}))counts[c.type]++;for(const [type,count] of Object.entries(counts)){const ratio=count/12000;assert(ratio>.22&&ratio<.28,`${type} ratio ${ratio} must stay near 25%`);}
  const late=Array.from({length:100},(_,i)=>travel.createTravelChoices({runId:`late-${i}`,step:30})).flat().filter(c=>c.type==='skirmish'||c.type==='battle');assert(late.some(c=>c.stars===12),'late journey must be able to offer 12-star combat');assert(late.every(c=>c.stars>=1&&c.stars<=12));assert(late.every(c=>['w','b'].includes(c.playerColor)&&c.enemyRaceTag),'combat cards must carry side and race context');assert(late.some(c=>c.playerColor==='b'),'travel must be able to put the player on Black');

  const run=persistence.createRun({id:'travel-run',now:1000}),storage=memoryStorage();persistence.writeRun({...run,currentTravelChoices:first},storage,1100);assert.deepStrictEqual(persistence.readRun(storage).currentTravelChoices,first);
  const persistedEvent={...first[0],id:'persist.event',type:'event',label:'СОБЫТИЕ',stars:1,threatLabel:'ОЧЕНЬ НИЗКАЯ',flavor:'Неожиданная встреча у дороги.',mechanicalHint:'',seed:'persist-event'};
  const eventFork=[persistedEvent,first[1],first[2]];persistence.writeRun({...run,currentTravelChoices:eventFork},storage,1150);const persistedEventFork=persistence.readRun(storage);assert(persistedEventFork,'Travel fork containing Event must remain readable');assert.strictEqual(persistedEventFork.currentTravelChoices[0].type,'event');assert.strictEqual(persistedEventFork.currentTravelChoices[0].mechanicalHint,'','Event intentionally supports an empty mechanical hint');
  const persistedTwelve={...first[0],id:'persist.12',type:'skirmish',label:'СТЫЧКА',stars:12,threatLabel:'ЛЕГЕНДАРНАЯ',mechanicalHint:'Нестандартный состав противника.',seed:'persist-12',playerColor:'b',enemyRaceTag:'orcs'};
  const highStarFork=[persistedTwelve,first[1],first[2]];persistence.writeRun({...run,currentTravelChoices:highStarFork},storage,1200);const persistedFork=persistence.readRun(storage);assert(persistedFork,'12-star Travel fork must remain readable after persistence');assert.strictEqual(persistedFork.currentTravelChoices[0].stars,12);
  const activeTwelve={...persistedTwelve,combatCountAtSelection:0,supplyCostAtSelection:1,supplyPaid:1};
  persistence.writeRun({...run,currentTravelChoices:null,activeTravelChoice:activeTwelve},storage,1300);const persistedActive=persistence.readRun(storage);assert(persistedActive,'12-star active Travel combat must remain readable after persistence');assert.strictEqual(persistedActive.activeTravelChoice.stars,12);assert.strictEqual(persistedActive.activeTravelChoice.combatCountAtSelection,0);
  const staleCompleted={...run,updatedAt:1400,skirmishCount:1,currentTravelChoices:null,activeTravelChoice:activeTwelve};storage.setItem(persistence.RUN_STORAGE_KEY,JSON.stringify(staleCompleted));const recovered=persistence.readRun(storage);assert(recovered,'completed-combat stale save must remain readable');assert.strictEqual(recovered.activeTravelChoice,null,'readRun must self-heal an already-completed direct combat route instead of blocking Travel');assert.strictEqual(recovered.skirmishCount,1);
  const manualSkirmish={id:'manual.s',step:1,type:'skirmish',label:'СТЫЧКА',stars:12,threatLabel:'ЛЕГЕНДАРНАЯ',flavor:'Путь.',mechanicalHint:'Нестандартный состав противника.',seed:'manual-s',playerColor:'b',enemyRaceTag:'orcs'};globalThis.RPChessTravelEncounterOverride=manualSkirmish;const rs=skirmish.createEncounter({seed:'fallback',stars:5});assert.strictEqual(rs.seed,'manual-s');assert.strictEqual(rs.stars,12);assert.strictEqual(rs.aiElo,2600);assert.strictEqual(rs.playerColor,'b');assert.strictEqual(rs.enemyRaceTag,'orcs');
  const manualBattle={...manualSkirmish,id:'manual.b',type:'battle',label:'БИТВА',seed:'manual-b'};globalThis.RPChessTravelEncounterOverride=manualBattle;const rb=battle.createBattleEncounter({seed:'fallback',stars:1});assert.strictEqual(rb.seed,'manual-b');assert.strictEqual(rb.stars,12);assert.strictEqual(rb.aiElo,2600);assert.strictEqual(rb.playerColor,'b');
  console.log('Travel Choice Event-fork persistence, direct aftermath recovery, stale-save healing, 12-star persistence and race/side context: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});