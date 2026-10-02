const assert=require('assert');
(async()=>{
  const {ClassicChessEngine}=await import('../game/js/classic-chess-engine.mjs');
  const {forkMasterHints}=await import('../game/js/fork-master-core.mjs');
  const artifacts=await import('../game/js/artifact-core.mjs');
  const runStore=await import('../game/js/run-persistence.mjs');
  const {compactRun,expandRun}=await import('../game/js/cloud-save.mjs');
  const arena=await import('../game/js/arena-core.mjs');
  const hint=(fen,from,color='w',blockedSquares=[])=>forkMasterHints(new ClassicChessEngine(fen,{blockedSquares}).snapshot(),from,color);
  const colors=hint('7k/8/8/1r6/3N2p1/5q2/8/K7 w - - 0 1','d4');
  assert.deepStrictEqual([...colors.targets].sort(),[['b5','green'],['f3','red']]);
  assert.strictEqual(hint('7k/8/8/8/3N2p1/5q2/8/K7 w - - 0 1','d4').targets.size,0);
  const rookFen='7k/8/4p3/3n4/8/8/3R1p2/K7 w - - 0 1';
  assert.deepStrictEqual([...hint(rookFen,'d2').targets].sort(),[['d5','red'],['f2','green']]);
  assert.strictEqual(hint(rookFen,'d2','w',['d3']).targets.size,0,'obstacle stops rook attack');
  assert.strictEqual(hint('7k/8/4p3/3n4/8/8/3RPp2/K7 w - - 0 1','d2').targets.size,0,'ally stops rook attack');
  assert(!hint('7k/8/3p4/3p4/8/8/3R1p2/K7 w - - 0 1','d2').targets.has('d6'),'enemy stops rook attack');
  const pin='3k4/8/3n4/1b6/3N4/5r2/8/K2R4 w - - 0 1';
  assert.strictEqual(hint(pin,'d4').targets.get('b5'),'green','defender becomes pinned after capture');
  assert.strictEqual(hint(pin,'d4','w',['d7']).targets.get('b5'),'red','blocked pin frees defender');
  assert.strictEqual(hint('7k/8/3p4/8/3R1b2/8/K7/3r4 w - - 0 1','d4').targets.get('d6'),'red','moving attacker opens recapture ray');
  assert.strictEqual(hint('8/8/2k5/1p6/3N4/5r2/8/K7 w - - 0 1','d4').targets.get('b5'),'red','enemy king can legally recapture');
  assert.strictEqual(hint('8/8/2k5/1p6/B2N4/5r2/8/K7 w - - 0 1','d4').targets.get('b5'),'green','king cannot recapture onto protected square');
  for(const [fen,from,color,targets] of [
    ['7k/8/8/1r1n4/2P5/8/8/K7 w - - 0 1','c4','w',['b5','d5']],
    ['7k/8/8/2p5/1R1N4/8/8/K7 b - - 0 1','c5','b',['b4','d4']],
    ['7k/8/3r3q/8/5B2/8/8/K7 w - - 0 1','f4','w',['d6','h6']],
    ['7k/8/8/2n1n3/3K4/8/8/8 w - - 0 1','d4','w',['c5','e5']],
    ['7k/8/4p3/3n4/8/8/3Q1p2/K7 w - - 0 1','d2','w',['d5','f2']]
  ])assert.deepStrictEqual([...hint(fen,from,color).targets.keys()].sort(),targets);
  const pinnedAttacker=hint('3r3k/8/8/8/8/1p3p2/3N4/3K4 w - - 0 1','d2');
  assert.strictEqual(pinnedAttacker.targets.size,0);assert.strictEqual(pinnedAttacker.destinations.size,0);
  const next='8/8/1r3k2/8/8/2N5/8/K7 w - - 0 1';
  assert(hint(next,'c3').destinations.has('d5'),'king plus rook is a future fork');
  const rotated=new ClassicChessEngine(next);
  rotated.state.board=rotated.state.board.reverse().map(p=>p?{...p,color:p.color==='w'?'b':'w'}:null);rotated.state.turn='b';
  assert(forkMasterHints(rotated.snapshot(),'f6','b').destinations.has('e4'),'black side has rotated fork destination');
  const current=hint('8/8/1r3k2/3N4/8/8/8/K7 w - - 0 1','d5');
  assert.strictEqual(current.targets.get('f6'),'check');assert(current.targets.has('b6'));
  assert(hint('8/8/1r3k2/3p4/8/2N5/8/K7 w - - 0 1','c3').destinations.has('d5'),'capturing move can create fork');
  assert(hint('7k/2n1r3/8/3pP3/8/8/8/K7 w - d6 0 1','e5').destinations.has('d6'),'en passant fork');
  assert(hint('4r3/P7/7k/b7/8/8/8/7K w - - 0 1','a7').destinations.has('a8'),'promotion fork');
  const engine=new ClassicChessEngine(next),snapshot=engine.snapshot(),before=JSON.stringify(snapshot),history=JSON.stringify(engine.state.history),moves=engine.legalMoves();
  for(let i=0;i<5;i++)forkMasterHints(snapshot,'c3','w');
  assert.strictEqual(JSON.stringify(snapshot),before);assert.strictEqual(JSON.stringify(engine.state.history),history);assert.deepStrictEqual(engine.legalMoves(),moves);
  assert.strictEqual(forkMasterHints({...snapshot,status:{over:true}},'c3','w').destinations.size,0);
  assert.strictEqual(forkMasterHints({...snapshot,turn:'b'},'c3','w').destinations.size,0);
  assert.strictEqual(forkMasterHints(snapshot,null,'w').targets.size,0);
  const id='tactics.fork_master',a=artifacts.artifactById(id);assert.strictEqual(a.pricePerCharge,15);
  for(const combatType of ['battle','skirmish','caravan']){
    const run={...runStore.createRun({id:'fork-save',now:1}),artifacts:{[id]:2,'vision.piercing':1}};
    const chosen=artifacts.applyCombatArtifactChoice(run,{combatType,encounterId:'fork-test',artifactId:id});
    assert(chosen.success&&runStore.isValidRun(chosen.run));assert.strictEqual(chosen.run.artifacts[id],1);
    assert.deepStrictEqual(artifacts.applyCombatArtifactChoice(chosen.run,{combatType,encounterId:'fork-test',artifactId:id}).run,chosen.run);
    const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
    runStore.writeRun(chosen.run,storage,2);const loaded=runStore.readRun(storage),cloud=expandRun(compactRun(loaded));
    assert.deepStrictEqual(cloud.artifacts,chosen.run.artifacts);assert.deepStrictEqual(cloud.combatArtifactChoice,chosen.run.combatArtifactChoice);
  }
  const shop=artifacts.applyArtifactPurchase({...runStore.createRun({id:'fork-shop',now:1}),gold:30,currentSettlement:{artifactOffer:{id,charges:2,price:30,sold:false}}});
  assert(shop.success&&shop.spent===30&&shop.run.artifacts[id]===2);assert(!artifacts.applyArtifactPurchase(shop.run).success);
  let state=arena.emptyArena();state.events=[{id:'reward',kind:'win',foe:arena.OPPONENTS[0].id,amount:30,at:1}];state=arena.newMatch(state,arena.OPPONENTS[0].id,'fork-match','b');
  state=arena.chooseArtifact(state,id);assert.strictEqual(arena.arenaSummary(state).balance,23);assert.strictEqual(arena.normalizeArena(state).match.artifactId,id);
  assert.strictEqual(arena.arenaSummary(arena.chooseArtifact(state,id)).balance,23);
  assert(runStore.isValidRun(runStore.createRun({id:'old',now:1})));assert.strictEqual(runStore.RUN_SCHEMA_VERSION,1);
  const reached=new Set();for(let i=0;i<60;i++)artifacts.combatArtifactOffer(artifacts.ARTIFACTS,'fork-'+i).forEach(a=>reached.add(a.id));assert.strictEqual(reached.size,5);
  console.log('Fork Master: all pieces, legal recaptures/pins/king, future forks/capture/EP/promotion, no mutation, local/cloud saves and economy: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
