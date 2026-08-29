const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const core=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-core.mjs')).href);
  const {PUZZLE_CATALOG}=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-catalog.mjs')).href);
  const expectedStars=[[1,1],[8,1],[9,2],[16,2],[17,3],[40,5],[48,6],[80,10],[88,11],[89,12],[999,12]];
  for(const [week,stars] of expectedStars)assert.strictEqual(core.puzzleStarsForWeek(week),stars,`week ${week}`);
  assert.strictEqual(core.puzzleBaseGold(1),12);
  assert.strictEqual(core.puzzleBaseGold(12),45);
  assert.strictEqual(core.puzzleGoldReward(5,0),24);
  assert.strictEqual(core.puzzleGoldReward(5,1),17);
  assert.strictEqual(core.puzzleGoldReward(5,2),10);
  assert.strictEqual(core.puzzleGoldReward(5,3),0);
  assert.strictEqual(core.objectiveLabel({type:'material',targetPiece:'queen'}),'ВЫИГРАЙТЕ ФЕРЗЯ');
  assert.strictEqual(core.objectiveLabel({type:'mate3'}),'МАТ В 3');
  for(let stars=1;stars<=12;stars++){
    const args={runId:'stable',routeId:`route-${stars}`,stars,week:(stars-1)*8+1};
    const a=core.selectPuzzle(PUZZLE_CATALOG,args),b=core.selectPuzzle(PUZZLE_CATALOG,args);
    assert.strictEqual(a.id,b.id,'selection must be deterministic');
    assert.strictEqual(a.difficulty,stars,'selection should stay in current star pool when available');
  }
  console.log('Puzzles diagnostic difficulty/reward/selection: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
