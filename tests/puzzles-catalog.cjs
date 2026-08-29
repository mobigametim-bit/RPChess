const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const core=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-core.mjs')).href);
  const {PUZZLE_CATALOG}=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-catalog.mjs')).href);
  const {ClassicChessEngine}=await import(pathToFileURL(path.join(game,'js/classic-chess-engine.mjs')).href);
  const representative=['mate1','mate2','mate3','material'].map(type=>PUZZLE_CATALOG.find(p=>p.type===type));
  assert(representative.every(Boolean),'catalog smoke must cover mate1/mate2/mate3/material');
  for(const puzzle of representative){
    assert(core.isNormalizedPuzzle(puzzle),`${puzzle.id} normalized`);
    const engine=new ClassicChessEngine(puzzle.fen);
    assert.strictEqual(engine.turn(),puzzle.side,`${puzzle.id} side-to-move`);
    for(const uci of puzzle.solution){
      const parts=core.uciParts(uci),result=engine.move(parts.from,parts.to,parts.promotion);
      assert(result.ok,`${puzzle.id}: ${uci} must be legal`);
    }
    if(puzzle.type.startsWith('mate'))assert.strictEqual(engine.status().type,'checkmate',`${puzzle.id} must end in mate`);
  }
  const mate1=representative.find(p=>p.type==='mate1'),mateEngine=new ClassicChessEngine(mate1.fen);
  const legalMates=mateEngine.legalMoves().filter(move=>{const test=new ClassicChessEngine(mate1.fen),result=test.move(move.from,move.to,move.promotion);return result.ok&&result.status.type==='checkmate'&&result.status.winner===mate1.side;});
  assert(legalMates.length>=1,'mate1 must accept any legal mating move');
  console.log('Puzzles representative engine replay + mate-in-1 alternative contract: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
