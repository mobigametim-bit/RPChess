const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const core=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-core.mjs')).href);
  const {PUZZLE_CATALOG}=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-catalog.mjs')).href);
  const {ClassicChessEngine}=await import(pathToFileURL(path.join(game,'js/classic-chess-engine.mjs')).href);
  for(const puzzle of PUZZLE_CATALOG.slice(0,6)){
    assert(core.isNormalizedPuzzle(puzzle),`${puzzle.id} normalized`);
    const engine=new ClassicChessEngine(puzzle.fen);assert.strictEqual(engine.turn(),puzzle.side,`${puzzle.id} side-to-move`);
    for(const uci of puzzle.solution){const parts=core.uciParts(uci);const result=engine.move(parts.from,parts.to,parts.promotion);assert(result.ok,`${puzzle.id}: ${uci} must be legal`);}
    if(puzzle.type.startsWith('mate'))assert.strictEqual(engine.status().type,'checkmate',`${puzzle.id} must end in mate`);
  }
  const mate1=PUZZLE_CATALOG.find(p=>p.type==='mate1');
  const mateEngine=new ClassicChessEngine(mate1.fen);
  const legalMates=mateEngine.legalMoves().filter(move=>{const test=new ClassicChessEngine(mate1.fen);const result=test.move(move.from,move.to,move.promotion);return result.ok&&result.status.type==='checkmate'&&result.status.winner===mate1.side;});
  assert(legalMates.length>=1,'mate1 must expose at least one legal mating move');
  console.log('Puzzles catalog ★1-★6 and mate-in-1 alternatives: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
