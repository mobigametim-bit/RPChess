const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
const importer=require('../scripts/import-lichess-puzzles.cjs');
(async()=>{
  assert.deepStrictEqual(importer.parseCsvLine('A,"B,C","D""E"'),['A','B,C','D"E']);
  const header=['PuzzleId','FEN','Moves','Rating','RatingDeviation','Popularity','NbPlays','Themes','GameUrl','OpeningTags','DailyDate'];
  const row=importer.rowFromHeader(header,'fools,"rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq e6 0 2","g2g4 d8h4",700,60,100,999,"mate mateIn1 oneMove",https://lichess.org/test,,2026-01-01');
  assert.strictEqual(row.PuzzleId,'fools');assert.strictEqual(row.DailyDate,'2026-01-01');
  assert.strictEqual(importer.typeFromThemes(new Set(['mate','mateIn1'])),'mate1');assert.strictEqual(importer.typeFromThemes(new Set(['fork','advantage'])),'material');assert.strictEqual(importer.typeFromThemes(new Set(['mate','fork'])),null,'generic mate theme without mateIn1/2/3 must not leak into material');
  assert.deepStrictEqual(importer.allocateStarTotals(2000).reduce((a,b)=>a+b,0),2000);assert.strictEqual(Object.values(importer.allocateMix(167,{mate1:70,material:30})).reduce((a,b)=>a+b,0),167);
  const game=path.resolve(__dirname,'..','game'),engineModule=await import(pathToFileURL(path.join(game,'js/classic-chess-engine.mjs')).href),core=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-core.mjs')).href);
  const normalized=await importer.normalizeLichessRow(row,{ClassicChessEngine:engineModule.ClassicChessEngine,puzzleBaseGold:core.puzzleBaseGold,difficultyTable:core.DIFFICULTY_TABLE});
  assert(normalized,'valid high-quality Lichess-like row must normalize');assert.strictEqual(normalized.sourceId,'fools');assert.strictEqual(normalized.type,'mate1');assert.strictEqual(normalized.side,'b');assert.deepStrictEqual(normalized.solution,['d8h4']);assert.strictEqual(normalized.difficulty,1);assert.strictEqual(normalized.reward,12);const engine=new engineModule.ClassicChessEngine(normalized.fen),result=engine.move('d8','h4');assert(result.ok&&result.status.type==='checkmate');
  const lowPopularity={...row,Popularity:'79'};assert.strictEqual(await importer.normalizeLichessRow(lowPopularity,{ClassicChessEngine:engineModule.ClassicChessEngine,puzzleBaseGold:core.puzzleBaseGold,difficultyTable:core.DIFFICULTY_TABLE}),null);
  const highDeviation={...row,RatingDeviation:'101'};assert.strictEqual(await importer.normalizeLichessRow(highDeviation,{ClassicChessEngine:engineModule.ClassicChessEngine,puzzleBaseGold:core.puzzleBaseGold,difficultyTable:core.DIFFICULTY_TABLE}),null);
  const serialized=importer.serializeCatalog([normalized]);assert(serialized.includes('Lichess Open Database Puzzles'));assert(serialized.includes("license:'CC0'"));assert(serialized.includes('puzzle.fools'));
  console.log('Lichess streaming importer CSV/quality/normalization/checkmate contracts: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});