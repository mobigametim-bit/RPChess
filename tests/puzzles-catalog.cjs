const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const core=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-core.mjs')).href);
  const {PUZZLE_CATALOG,PUZZLE_SOURCE}=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-catalog.mjs')).href);
  assert(PUZZLE_CATALOG.length>=12,'playable preview must cover all 12 star levels');
  assert(PUZZLE_CATALOG.every(core.isNormalizedPuzzle),'every bundled puzzle must satisfy normalized runtime schema');
  assert.strictEqual(PUZZLE_SOURCE.license,'CC0');
  assert(PUZZLE_SOURCE.name.includes('Lichess Open Database Puzzles'));
  assert.strictEqual(new Set(PUZZLE_CATALOG.map(p=>p.id)).size,PUZZLE_CATALOG.length,'puzzle ids must be unique');
  assert.strictEqual(new Set(PUZZLE_CATALOG.map(p=>p.sourceId)).size,PUZZLE_CATALOG.length,'source ids must be unique');
  assert.deepStrictEqual([...new Set(PUZZLE_CATALOG.map(p=>p.difficulty))].sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1));
  for(const type of ['mate1','mate2','mate3','material'])assert(PUZZLE_CATALOG.some(p=>p.type===type),`catalog must cover ${type}`);
  const expectedSolutionLength={mate1:1,mate2:3,mate3:5};
  for(const puzzle of PUZZLE_CATALOG){
    assert.strictEqual(puzzle.reward,core.puzzleBaseGold(puzzle.difficulty),`${puzzle.id} reward must follow star formula`);
    assert(['w','b'].includes(puzzle.side),`${puzzle.id} side must be explicit`);
    if(puzzle.type in expectedSolutionLength)assert.strictEqual(puzzle.solution.length,expectedSolutionLength[puzzle.type],`${puzzle.id} mate line length`);
    if(puzzle.type==='material'){
      assert(['queen','rook','bishop','knight'].includes(puzzle.targetPiece),`${puzzle.id} material target must be explicit`);
      assert(Number.isFinite(puzzle.materialGain)&&puzzle.materialGain>0,`${puzzle.id} material gain must be positive`);
    }else{
      assert.strictEqual(puzzle.targetPiece,null,`${puzzle.id} mate targetPiece must stay null`);
    }
  }
  console.log(`Puzzles catalog schema/source/type/star/reward integrity: PASS (${PUZZLE_CATALOG.length} seed puzzles)`);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
