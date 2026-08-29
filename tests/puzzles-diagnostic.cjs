const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const core=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-core.mjs')).href);
  const catalogModule=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-catalog.mjs')).href);
  const {ClassicChessEngine}=await import(pathToFileURL(path.join(game,'js/classic-chess-engine.mjs')).href);
  const puzzle=catalogModule.PUZZLE_CATALOG[5];
  assert.strictEqual(puzzle.id,'puzzle.000hf');
  assert(core.isNormalizedPuzzle(puzzle),`${puzzle.id} normalized`);
  const engine=new ClassicChessEngine(puzzle.fen);
  assert.strictEqual(engine.turn(),puzzle.side,`${puzzle.id} side-to-move`);
  for(const uci of puzzle.solution){
    const parts=core.uciParts(uci);
    const result=engine.move(parts.from,parts.to,parts.promotion);
    assert(result.ok,`${puzzle.id}: ${uci} must be legal`);
  }
  assert.strictEqual(engine.status().type,'checkmate',`${puzzle.id} must end in mate`);
  console.log('Puzzle 000hf strict validation: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
