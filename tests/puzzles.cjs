const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const core=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-core.mjs')).href);
  const catalogModule=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-catalog.mjs')).href);
  const {ClassicChessEngine}=await import(pathToFileURL(path.join(game,'js/classic-chess-engine.mjs')).href);
  const catalog=catalogModule.PUZZLE_CATALOG;
  assert(catalog.length>=12,'playable preview must have a real CC0 seed task for every star level');
  assert(catalog.every(core.isNormalizedPuzzle),'all bundled puzzles must satisfy normalized contract');
  assert.deepStrictEqual([...new Set(catalog.map(p=>p.difficulty))].sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1));
  assert.strictEqual(catalogModule.PUZZLE_SOURCE.license,'CC0');
  const expectedStars=[[1,1],[8,1],[9,2],[16,2],[17,3],[40,5],[48,6],[80,10],[88,11],[89,12],[999,12]];
  for(const [week,stars] of expectedStars)assert.strictEqual(core.puzzleStarsForWeek(week),stars,`week ${week}`);
  assert.strictEqual(core.puzzleBaseGold(1),12);assert.strictEqual(core.puzzleBaseGold(12),45);
  assert.strictEqual(core.puzzleGoldReward(5,0),24);assert.strictEqual(core.puzzleGoldReward(5,1),17);assert.strictEqual(core.puzzleGoldReward(5,2),10);assert.strictEqual(core.puzzleGoldReward(5,3),0);
  assert.strictEqual(core.objectiveLabel({type:'material',targetPiece:'queen'}),'ВЫИГРАЙТЕ ФЕРЗЯ');
  assert.strictEqual(core.objectiveLabel({type:'mate3'}),'МАТ В 3');
  for(const puzzle of catalog){
    const engine=new ClassicChessEngine(puzzle.fen);assert.strictEqual(engine.turn(),puzzle.side,`${puzzle.id} side-to-move`);
    for(const uci of puzzle.solution){const parts=core.uciParts(uci);const result=engine.move(parts.from,parts.to,parts.promotion);assert(result.ok,`${puzzle.id}: ${uci} must be legal`);}
    if(puzzle.type.startsWith('mate'))assert.strictEqual(engine.status().type,'checkmate',`${puzzle.id} must end in mate`);
  }
  const mate1=catalog.find(p=>p.type==='mate1');
  const mateEngine=new ClassicChessEngine(mate1.fen);
  const legalMates=mateEngine.legalMoves().filter(move=>{const test=new ClassicChessEngine(mate1.fen);const result=test.move(move.from,move.to,move.promotion);return result.ok&&result.status.type==='checkmate'&&result.status.winner===mate1.side;});
  assert(legalMates.length>=1,'mate1 must expose at least one legal mating move');
  for(let stars=1;stars<=12;stars++){
    const args={runId:'stable',routeId:`route-${stars}`,stars,week:(stars-1)*8+1};
    const a=core.selectPuzzle(catalog,args),b=core.selectPuzzle(catalog,args);
    assert.strictEqual(a.id,b.id,'selection must be deterministic');
    assert.strictEqual(a.difficulty,stars,'selection should stay in current star pool when available');
  }
  console.log('Puzzles top-half contracts: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
