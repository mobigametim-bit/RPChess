const assert=require('assert');
(async()=>{
  const {ARTIFACTS,piercingVisionTargets,combatArtifactOffer,applyCombatArtifactChoice}=await import('../game/js/artifact-core.mjs');
  const {ClassicChessEngine}=await import('../game/js/classic-chess-engine.mjs');
  const {createRun,isValidRun}=await import('../game/js/run-persistence.mjs');
  const arena=await import('../game/js/arena-core.mjs');
  const snapshot=new ClassicChessEngine('7k/8/3p4/3p4/3p4/3P4/3R1p2/3K4 w - - 0 1',{blockedSquares:['d7','d1']}).snapshot();
  const before=JSON.stringify(snapshot);
  assert.deepStrictEqual([...piercingVisionTargets(snapshot,'d2','w')],[['f2',1],['d4',1],['d5',2],['d6',3]]);
  assert.strictEqual(JSON.stringify(snapshot),before);
  const bishopBoard=Array(64).fill(null);bishopBoard[27]={type:'b',color:'b'};bishopBoard[36]={type:'p',color:'b'};bishopBoard[45]={type:'r',color:'w'};bishopBoard[54]={type:'r',color:'w'};bishopBoard[28]={type:'r',color:'w'};
  assert.deepStrictEqual([...piercingVisionTargets({board:bishopBoard},'d4','b')],[['f6',1],['g7',2]],'bishop must cross allies and ignore orthogonal targets');
  // A fourth target retains orange; direction counters reset independently.
  const board=Array(64).fill(null);board[27]={type:'q',color:'w'};
  for(const i of [28,29,30,31,18,9,0])board[i]={type:'p',color:'b'};
  board[36]={type:'n',color:'w'};board[45]={type:'r',color:'b'};
  const q=piercingVisionTargets({board},'d4','w');
  assert.deepStrictEqual(['e4','f4','g4','h4','c3','b2','a1','f6'].map(s=>q.get(s)),[1,2,3,3,1,2,3,1]);
  for(const [type,color,origin,targets] of [['p','w',27,[34,36]],['p','b',27,[18,20]],['n','w',27,[10,12,17,21,33,37,42,44]],['k','b',27,[18,19,20,26,28,34,35,36]]]){
    const b=Array(64).fill(null);b[origin]={type,color};for(const i of targets)b[i]={type:'r',color:color==='w'?'b':'w'};
    assert.strictEqual(piercingVisionTargets({board:b},'d4',color).size,targets.length);
    assert([...piercingVisionTargets({board:b},'d4',color).values()].every(n=>n===1));
    assert.strictEqual(piercingVisionTargets({board:b},'d4',color==='w'?'b':'w').size,0);
  }
  assert.strictEqual(piercingVisionTargets({...snapshot,status:{over:true}},'d2','w').size,0);
  assert.strictEqual(piercingVisionTargets(snapshot,null,'w').size,0);
  const reached=new Set();
  for(let i=0;i<30;i++){
    const offer=combatArtifactOffer(ARTIFACTS,'match-'+i);
    assert.strictEqual(offer.length,3);assert.strictEqual(new Set(offer.map(a=>a.id)).size,3);
    assert.deepStrictEqual(offer,combatArtifactOffer(ARTIFACTS,'match-'+i));offer.forEach(a=>reached.add(a.id));
  }
  assert.strictEqual(reached.size,4);
  for(const combatType of ['battle','skirmish','caravan']){
    const run={...createRun({id:'vision-test',now:1}),artifacts:{'vision.piercing':2}};
    const chosen=applyCombatArtifactChoice(run,{combatType,encounterId:'test',artifactId:'vision.piercing'});
    assert(chosen.success&&isValidRun(chosen.run));assert.strictEqual(chosen.run.artifacts['vision.piercing'],1);
    assert.deepStrictEqual(applyCombatArtifactChoice(chosen.run,{combatType,encounterId:'test',artifactId:'vision.piercing'}).run,chosen.run);
  }
  let state=arena.emptyArena();state.events=[{id:'reward',kind:'win',foe:arena.OPPONENTS[0].id,amount:30,at:1}];
  state=arena.newMatch(state,arena.OPPONENTS[0].id,'vision-match','b');state=arena.chooseArtifact(state,'vision.piercing');
  assert.strictEqual(state.match.artifactId,'vision.piercing');assert.strictEqual(arena.arenaSummary(state).balance,16);
  assert.strictEqual(arena.normalizeArena(state).match.artifactId,'vision.piercing');
  assert.strictEqual(arena.arenaSummary(arena.chooseArtifact(state,'vision.piercing')).balance,16);
  assert(isValidRun(createRun({id:'old-save',now:1})));
  console.log('Piercing Vision lines, both pawn colors, blockers, offers and save/economy regression: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
