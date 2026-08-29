const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const core=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-core.mjs')).href);
  const {PUZZLE_CATALOG}=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-catalog.mjs')).href);
  const {ClassicChessEngine}=await import(pathToFileURL(path.join(game,'js/classic-chess-engine.mjs')).href);
  const puzzle=PUZZLE_CATALOG.find(p=>p.type==='material');
  assert(puzzle,'catalog smoke must cover material');
  assert(core.isNormalizedPuzzle(puzzle),`${puzzle.id} normalized`);
  const engine=new ClassicChessEngine(puzzle.fen);
  assert.strictEqual(engine.turn(),puzzle.side,`${puzzle.id} side-to-move`);
  for(const uci of puzzle.solution){
    const parts=core.uciParts(uci),result=engine.move(parts.from,parts.to,parts.promotion);
    assert(result.ok,`${puzzle.id}: ${uci} must be legal`);
  }
  console.log(`Puzzles material representative replay: PASS (${puzzle.id})`);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
