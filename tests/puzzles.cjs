const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const {PUZZLE_CATALOG}=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-catalog.mjs')).href);
  const {ClassicChessEngine}=await import(pathToFileURL(path.join(game,'js/classic-chess-engine.mjs')).href);
  const mate1=PUZZLE_CATALOG.find(p=>p.type==='mate1');
  const mateEngine=new ClassicChessEngine(mate1.fen);
  const legalMates=mateEngine.legalMoves().filter(move=>{const test=new ClassicChessEngine(mate1.fen);const result=test.move(move.from,move.to,move.promotion);return result.ok&&result.status.type==='checkmate'&&result.status.winner===mate1.side;});
  assert(legalMates.length>=1,'mate1 must expose at least one legal mating move');
  console.log(`Mate-in-1 alternative acceptance: PASS (${legalMates.map(m=>m.from+m.to+(m.promotion||'')).join(',')})`);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
