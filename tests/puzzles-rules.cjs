const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const core=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-core.mjs')).href);
  const catalogModule=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-catalog.mjs')).href);
  const catalog=catalogModule.PUZZLE_CATALOG;
  assert(catalog.length>=12,'playable catalog must have real CC0 tasks across all star levels');
  assert(catalog.every(core.isNormalizedPuzzle),'all bundled puzzles must satisfy normalized contract');
  assert.deepStrictEqual([...new Set(catalog.map(p=>p.difficulty))].sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1));
  assert.strictEqual(catalogModule.PUZZLE_SOURCE.license,'CC0');

  // Legacy helper remains stable for old saves, but live selection no longer consumes it.
  const expectedStars=[[1,1],[8,1],[9,2],[16,2],[17,3],[40,5],[48,6],[80,10],[88,11],[89,12],[999,12]];
  for(const [week,stars] of expectedStars)assert.strictEqual(core.puzzleStarsForWeek(week),stars,`week ${week}`);

  assert.strictEqual(core.puzzleBaseGold(1),12);assert.strictEqual(core.puzzleBaseGold(12),45);
  assert.strictEqual(core.puzzleGoldReward(5,0),24);assert.strictEqual(core.puzzleGoldReward(5,1),17);assert.strictEqual(core.puzzleGoldReward(5,2),10);assert.strictEqual(core.puzzleGoldReward(5,3),0);
  assert.strictEqual(core.objectiveLabel({type:'material',targetPiece:'queen'}),'ВЫИГРАЙТЕ ФЕРЗЯ');
  assert.strictEqual(core.objectiveLabel({type:'mate3'}),'МАТ В 3');

  const lowWeek=core.selectPuzzle(catalog,{runId:'week-independent',routeId:'same-route',stars:1,week:1});
  const highWeek=core.selectPuzzle(catalog,{runId:'week-independent',routeId:'same-route',stars:12,week:999});
  assert.strictEqual(lowWeek.id,highWeek.id,'travel week/card stars must not affect which puzzle is selected');

  const encountered=new Set();
  for(let index=0;index<64;index+=1){
    const args={runId:'any-difficulty',routeId:`route-${index}`,stars:1,week:1};
    const a=core.selectPuzzle(catalog,args),b=core.selectPuzzle(catalog,args);
    assert.strictEqual(a.id,b.id,'selection must remain deterministic for the same route/history');
    encountered.add(a.difficulty);
  }
  assert(encountered.size>1,'week 1 must be able to roll puzzles from multiple difficulty levels');

  const state=core.createPuzzleState({puzzle:highWeek,routeId:'same-route',stars:1,week:1});
  assert.strictEqual(state.stars,highWeek.difficulty,'reward/UI stars must follow the selected puzzle difficulty, not travel difficulty');

  // Use a compact real subset to verify no-repeat semantics without making regular builds quadratic in the 11.5k catalog size.
  const sample=catalog.slice(0,48),history=[];
  for(let index=0;index<sample.length;index++){
    const args={runId:'no-repeat',routeId:`route-${index}`,stars:1,week:1,excludedIds:history};
    const selected=core.selectPuzzle(sample,args);
    assert(!history.includes(selected.id),`Puzzle ${selected.id} repeated before sample exhaustion`);
    const repeat=core.selectPuzzle(sample,args);
    assert.strictEqual(repeat.id,selected.id,'history-aware selection must remain deterministic for same route/history');
    history.push(selected.id);
  }
  assert.strictEqual(new Set(history).size,sample.length,'selection must exhaust unseen tasks before any repeat');
  console.log('Puzzles reward / any-difficulty / deterministic no-repeat selection rules: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});