const assert=require('assert');
(async()=>{
 const c=await import('../game/js/caravan-core.mjs'),p=await import('../game/js/run-persistence.mjs'),travel=await import('../game/js/travel-choice-core.mjs'),a=await import('../game/js/artifact-core.mjs');
 const {ClassicChessEngine}=await import('../game/js/classic-chess-engine.mjs');
 const {RECRUIT_LIBRARY}=await import('../game/js/settlement-core.mjs');
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 let run=p.createRun({id:'caravan-test'});const choice={...travel.createTravelChoices({runId:run.id,types:['caravan']})[0],combatCountAtSelection:0};
 run={...run,activeTravelChoice:choice,artifacts:{'threat.great':2}};
 const state=c.createCaravanState(run,choice);run.currentCaravan=state;assert(c.isCaravanState(state));assert.strictEqual(c.createCaravanState(run,choice),state);
 const plan=c.createCaravanPlan({roster:run.roster,selectedIds:state.selectedIds,encounter:state.encounter});
 assert.equal(plan.playerFormation.length,16);assert.equal(plan.enemyFormation.length,16);
 for(const piece of [...plan.playerFormation,...plan.enemyFormation])assert.deepEqual(new ClassicChessEngine(plan.fen).pieceAt(piece.square),{type:piece.type,color:piece.color});
 const chosen=a.applyCombatArtifactChoice(run,{combatType:'caravan',encounterId:choice.id,artifactId:'threat.great'});assert(chosen.success);assert.equal(chosen.run.artifacts['threat.great'],1);
 assert.equal(a.applyCombatArtifactChoice(chosen.run,{combatType:'caravan',encounterId:choice.id,artifactId:'threat.great'}).run.artifacts['threat.great'],1);
 run={...chosen.run,currentCaravan:{...state,plan,phase:'combat'}};
 p.writeRun(run,storage);run=p.readRun(storage);assert.deepEqual(run.currentCaravan.plan,plan);
 const win={over:true,type:'checkmate',winner:plan.playerColor};
 const wounded=plan.participants.find(id=>!run.roster.find(c=>c.id===id).isRunKing);
 const result=c.finishCaravan(run,{capturedIds:[wounded],status:win,plan});
 assert.equal(result.caravanCount,1);assert.equal(result.battleCount,0);assert.equal(result.gold,run.gold);assert.equal(result.currentCaravan.phase,'reward');
 assert.equal(result.roster.find(c=>c.id===wounded).status,'wounded');assert.equal(result.currentCaravan.offers.length,3);
 assert.strictEqual(c.finishCaravan(result,{capturedIds:[],status:win,plan}),result);
 p.writeRun(result,storage);assert.deepEqual(p.readRun(storage).currentCaravan.offers,result.currentCaravan.offers);
 assert(!c.claimCaravanReward(result,'made-up').success);
 const covered=new Set();
 for(let i=0;i<200;i++){
  const offers=c.caravanRewardOffers(result,{...state.encounter,seed:`reward-${i}`});
  assert.equal(new Set(offers.map(r=>r.kind)).size,3);
  assert.deepEqual(offers,c.caravanRewardOffers(result,{...state.encounter,seed:`reward-${i}`}));
  for(const reward of offers){
   covered.add(reward.kind);const offered={...result,currentCaravan:{...result.currentCaravan,offers}};
   const claimed=c.claimCaravanReward(offered,reward.id);assert(claimed.success);assert.equal(claimed.run.currentCaravan.phase,'aftermath');
   assert(!c.claimCaravanReward(claimed.run,reward.id).success);
   if(reward.kind==='gold')assert.equal(claimed.run.gold,result.gold+reward.amount);
   if(reward.kind==='supplies')assert.equal(claimed.run.supplies,result.supplies+reward.amount);
   if(reward.kind==='artifact')assert.equal(claimed.run.artifacts[reward.artifactId],(result.artifacts[reward.artifactId]||0)+reward.amount);
   if(reward.kind==='healing')assert.equal(claimed.run.roster.find(c=>c.id===reward.heroId).status,'healthy');
   if(reward.kind==='hero')assert.equal(claimed.run.roster.length,result.roster.length+1);
   p.writeRun(claimed.run,storage);assert(p.readRun(storage));
  }
 }
 assert.equal(covered.size,5);
 const allOwned={...run,roster:[run.roster.find(c=>c.isRunKing),...RECRUIT_LIBRARY]};
 assert.deepEqual(c.caravanRewardOffers(allOwned,state.encounter).map(r=>r.kind).sort(),['artifact','gold','supplies']);
 for(const status of [{over:true,type:'checkmate',winner:plan.enemyColor},{over:true,type:'stalemate',winner:null}]){
  const result=c.finishCaravan(run,{capturedIds:[],status,plan});assert.equal(result.currentCaravan.phase,'aftermath');assert.equal(result.currentCaravan.offers.length,0);
 }
 const solo={...plan,participants:[run.roster.find(c=>c.isRunKing).id]};assert(!c.finishCaravan(run,{capturedIds:[],status:win,plan:solo}).ended);
 console.log('Caravan: formation, artifacts, persistence, all rewards, repeat claims and outcomes PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
