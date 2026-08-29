const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const core=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-core.mjs')).href);
  const {PUZZLE_CATALOG}=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-catalog.mjs')).href);
  const {ClassicChessEngine}=await import(pathToFileURL(path.join(game,'js/classic-chess-engine.mjs')).href);
  const puzzle=PUZZLE_CATALOG[4];
  assert(core.isNormalizedPuzzle(puzzle),`${puzzle.id} normalized`);
  const engine=new ClassicChessEngine(puzzle.fen);
  assert.strictEqual(engine.turn(),puzzle.side,`${puzzle.id} side-to-move`);
  for(const uci of puzzle.solution){const p=core.uciParts(uci),r=engine.move(p.from,p.to,p.promotion);assert(r.ok,`${puzzle.id}: ${uci} legal`);}
  console.log('Puzzle seed 0000D: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
