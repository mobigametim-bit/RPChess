const assert=require('assert'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
function memoryStorage(){const data=new Map();return{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}}
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const rating=await import(pathToFileURL(path.join(game,'js/player-rating.mjs')).href);
  const persistence=await import(pathToFileURL(path.join(game,'js/run-persistence.mjs')).href);
  const travelSource=fs.readFileSync(path.join(game,'js/travel-choice-app.mjs'),'utf8');
  const settleToken='globalThis.RPChessPower?.settle?.(activeRun)';
  const clearToken='activeRun=writeRun({...activeRun,activeTravelChoice:null})';
  assert(travelSource.includes(settleToken),'Travel lifecycle must explicitly settle Power before clearing a completed combat route');
  assert(travelSource.indexOf(settleToken)<travelSource.indexOf(clearToken),'Power settlement must happen before activeTravelChoice cleanup');
  const baseChoice={id:'route-1',type:'skirmish',step:1,stars:2,seed:'seed',flavor:'test',mechanicalHint:'test',combatCountAtSelection:0};
  assert.strictEqual(persistence.recoverCompletedCombatChoice({...baseChoice,difficultyModel:'power-v1'},1,0)?.id,'route-1','completed power-v1 route must survive hydration until Elo settlement');
  assert.strictEqual(persistence.recoverCompletedCombatChoice(baseChoice,1,0),null,'legacy completed route should still auto-recover');
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
  const counts={1:0,2:0,3:0,4:0};for(let i=0;i<10000;i++){const stars=rating.adaptiveEncounterStars(500,`seed-${i}`);assert(stars>=1&&stars<=4);counts[stars]++;}const total=10000;assert(counts[1]/total>.37&&counts[1]/total<.43);assert(counts[2]/total>.27&&counts[2]/total<.33);assert(counts[3]/total>.17&&counts[3]/total<.23);assert(counts[4]/total>.07&&counts[4]/total<.13);
  for(let i=0;i<1000;i++){const stars=rating.adaptiveEncounterStars(2500,`high-${i}`);assert(stars>=11&&stars<=12,'adaptive encounters may never be easier than current Threat');}
  assert.strictEqual(rating.opponentEloForStars(1),400);assert.strictEqual(rating.opponentEloForStars(12),2600);
  console.log('Power 500, 12-star Threat mapping, Elo K=32, +0..3 weighted difficulty, idempotent receipts and rated-route persistence through settlement: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});