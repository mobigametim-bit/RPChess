const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const core=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-core.mjs')).href);
  const {PUZZLE_CATALOG,PUZZLE_SOURCE,PUZZLE_CATALOG_META}=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-catalog.mjs')).href);
  assert(PUZZLE_CATALOG.length>=12,'playable preview must cover all 12 star levels');
  assert(PUZZLE_CATALOG.every(core.isNormalizedPuzzle),'every bundled puzzle must satisfy normalized runtime schema');
  // Materialized production catalog must preserve EVERY original normalized
  // row, including field values and order (selection is seeded by array index).
  // A checked-in small seed catalog remains valid for source-only tests.
  if(PUZZLE_CATALOG_META){
    const fs=require('node:fs'),zlib=require('node:zlib');
    const {decodeRow,EXPECTED_COUNT}=require('../scripts/materialize-puzzle-catalog.cjs');
    const rows=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(game,'js/puzzles/catalog-data/puzzle-catalog-11498.json.gz'))).toString('utf8'));
    assert.strictEqual(PUZZLE_CATALOG.length,EXPECTED_COUNT);
    assert.deepStrictEqual(PUZZLE_CATALOG,rows.map(decodeRow),'compact materialization must exactly preserve all normalized rows and order');
    assert(PUZZLE_CATALOG.every(p=>Object.isFrozen(p)&&Object.isFrozen(p.solution)&&Object.isFrozen(p.themes)),'catalog immutability preserved');
  }
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
