const assert=require('assert'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
function memoryStorage(){const data=new Map();return{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}}
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const rating=await import(pathToFileURL(path.join(game,'js/player-rating.mjs')).href);
  const travelSource=fs.readFileSync(path.join(game,'js/travel-choice-app.mjs'),'utf8');
  const settleToken='globalThis.RPChessPower?.settle?.(activeRun)';
  const clearToken='activeRun=writeRun({...activeRun,activeTravelChoice:null})';
  assert(travelSource.includes(settleToken),'Travel lifecycle must explicitly settle Power before clearing a completed combat route');
  assert(travelSource.indexOf(settleToken)<travelSource.indexOf(clearToken),'Power settlement must happen before activeTravelChoice cleanup');

  const storage=memoryStorage();
  const initial=rating.readPlayerRating(storage);assert.strictEqual(initial.power,500);assert.deepStrictEqual(initial.receipts,[]);
  for(const [power,stars] of [[0,1],[500,1],[599,1],[600,2],[799,2],[800,3],[2399,10],[2400,11],[2599,11],[2600,12],[4000,12]])assert.strictEqual(rating.threatStarsForPower(power),stars,`Power ${power}`);
  assert.strictEqual(rating.ratingDelta(500,400,1),12);assert.strictEqual(rating.ratingDelta(500,400,0),-20);
  assert.strictEqual(rating.ratingDelta(500,600,1),20);assert.strictEqual(rating.ratingDelta(500,600,0),-12);
  assert.strictEqual(rating.ratingDelta(500,800,1),27);assert.strictEqual(rating.ratingDelta(500,800,0),-5);
  assert.strictEqual(rating.ratingDelta(500,1000,1),30);assert.strictEqual(rating.ratingDelta(500,1000,0),-2);
  const win=rating.settlePlayerRating({receiptId:'rated-1',opponentElo:800,result:1,storage});assert.strictEqual(win.changed,true);assert.strictEqual(win.receipt.before,500);assert.strictEqual(win.receipt.after,527);assert.strictEqual(win.receipt.delta,27);
  const duplicate=rating.settlePlayerRating({receiptId:'rated-1',opponentElo:400,result:0,storage});assert.strictEqual(duplicate.changed,false);assert.deepStrictEqual(duplicate.receipt,win.receipt);assert.strictEqual(rating.readPlayerRating(storage).power,527,'same result receipt must never apply twice');
  const draw=rating.settlePlayerRating({receiptId:'rated-2',opponentElo:600,result:.5,storage});assert([0,1,2,3,4,5,6,7,8].includes(Math.abs(draw.receipt.delta)),'draw delta should use Elo expectation rather than fixed reward');
  assert.strictEqual(rating.combatResultScore({type:'checkmate',winner:'b'},'b'),1);assert.strictEqual(rating.combatResultScore({type:'checkmate',winner:'w'},'b'),0);assert.strictEqual(rating.combatResultScore({type:'stalemate',winner:null},'b'),.5);

  const skirmishRoute={id:'route.s1',type:'skirmish',difficultyModel:'power-v1',combatCountAtSelection:2};
  assert.strictEqual(rating.ratedOutcomeKind({activeTravelChoice:skirmishRoute,skirmishCount:2,lastSkirmish:{encounterId:'old'}}),null,'selecting a new Skirmish must not settle the previous result');
  assert.strictEqual(rating.ratedOutcomeKind({activeTravelChoice:skirmishRoute,skirmishCount:3,lastSkirmish:{encounterId:'new'},currentPuzzle:{resolved:true,routeId:'old-puzzle',puzzleId:'p1'}}),'skirmish','completed active Skirmish must win over stale puzzle state');
  const battleRoute={id:'route.b1',type:'battle',difficultyModel:'power-v1',combatCountAtSelection:4};
  assert.strictEqual(rating.ratedOutcomeKind({activeTravelChoice:battleRoute,battleCount:5,lastBattle:{encounterId:'b'}}),'battle');
  const puzzleRoute={id:'route.p1',type:'puzzle',difficultyModel:'power-v1'};
  assert.strictEqual(rating.ratedOutcomeKind({activeTravelChoice:puzzleRoute,currentPuzzle:{resolved:true,routeId:'route.p1',puzzleId:'p1'}}),'puzzle');
  assert.strictEqual(rating.ratedOutcomeKind({activeTravelChoice:puzzleRoute,currentPuzzle:{resolved:true,routeId:'route.old',puzzleId:'p1'}}),null,'stale resolved puzzle must not settle a new route');
  const eventRoute={id:'route.e1',type:'event',difficultyModel:'power-v1'};
  assert.strictEqual(rating.ratedOutcomeKind({activeTravelChoice:eventRoute,skirmishCount:7,currentEvent:{combat:{type:'skirmish',started:true,countAtStart:7}}}),null,'event combat must finish before Elo settlement');
  assert.strictEqual(rating.ratedOutcomeKind({activeTravelChoice:eventRoute,skirmishCount:8,currentEvent:{combat:{type:'skirmish',started:true,countAtStart:7}}}),'skirmish','completed Event→Skirmish must be rated');
  assert.strictEqual(rating.ratedOutcomeKind({activeTravelChoice:eventRoute,battleCount:3,currentEvent:{combat:{type:'battle',started:true,countAtStart:2}}}),'battle','completed Event→Battle must be rated');
  assert.strictEqual(rating.ratedOutcomeKind({activeTravelChoice:{...skirmishRoute,difficultyModel:'legacy'},skirmishCount:3}),null,'legacy encounters remain unrated');

  const counts={1:0,2:0,3:0,4:0};for(let i=0;i<10000;i++){const stars=rating.adaptiveEncounterStars(500,`seed-${i}`);assert(stars>=1&&stars<=4);counts[stars]++;}const total=10000;assert(counts[1]/total>.37&&counts[1]/total<.43);assert(counts[2]/total>.27&&counts[2]/total<.33);assert(counts[3]/total>.17&&counts[3]/total<.23);assert(counts[4]/total>.07&&counts[4]/total<.13);
  for(let i=0;i<1000;i++){const stars=rating.adaptiveEncounterStars(2500,`high-${i}`);assert(stars>=11&&stars<=12,'adaptive encounters may never be easier than current Threat');}
  assert.strictEqual(rating.opponentEloForStars(1),400);assert.strictEqual(rating.opponentEloForStars(12),2600);
  console.log('Power 500, Threat mapping, Elo K=32, adaptive difficulty, exact active-outcome gating and idempotent receipts: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});