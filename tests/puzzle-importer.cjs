const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
const importer=require('../scripts/import-lichess-puzzles.cjs');
(async()=>{
  assert.deepStrictEqual(importer.parseCsvLine('A,"B,C","D""E"'),['A','B,C','D"E']);
  const header=['PuzzleId','FEN','Moves','Rating','RatingDeviation','Popularity','NbPlays','Themes','GameUrl','OpeningTags','DailyDate'];
  const row=importer.rowFromHeader(header,'fools,"rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq e6 0 2","g2g4 d8h4",700,60,100,999,"mate mateIn1 oneMove",https://lichess.org/test,,2026-01-01');
  assert.strictEqual(row.PuzzleId,'fools');assert.strictEqual(row.DailyDate,'2026-01-01');
  assert.strictEqual(importer.typeFromThemes(new Set(['mate','mateIn1'])),'mate1');assert.strictEqual(importer.typeFromThemes(new Set(['fork','advantage'])),'material');assert.strictEqual(importer.typeFromThemes(new Set(['mate','fork'])),null,'generic mate theme without mateIn1/2/3 must not leak into material');
  assert.strictEqual(importer.isMateType('mate1'),true);assert.strictEqual(importer.isMateType('mate2'),true);assert.strictEqual(importer.isMateType('mate3'),true);assert.strictEqual(importer.isMateType('material'),false,'material must never be treated as a mate type');
  assert.deepStrictEqual(importer.allocateStarTotals(2000).reduce((a,b)=>a+b,0),2000);assert.strictEqual(Object.values(importer.allocateMix(167,{mate1:70,material:30})).reduce((a,b)=>a+b,0),167);
  const game=path.resolve(__dirname,'..','game'),engineModule=await import(pathToFileURL(path.join(game,'js/classic-chess-engine.mjs')).href),core=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-core.mjs')).href);
  const normalized=await importer.normalizeLichessRow(row,{ClassicChessEngine:engineModule.ClassicChessEngine,puzzleBaseGold:core.puzzleBaseGold,difficultyTable:core.DIFFICULTY_TABLE});
  assert(normalized,'valid high-quality Lichess-like row must normalize');assert.strictEqual(normalized.sourceId,'fools');assert.strictEqual(normalized.type,'mate1');assert.strictEqual(normalized.side,'b');assert.deepStrictEqual(normalized.solution,['d8h4']);assert.strictEqual(normalized.difficulty,1);assert.strictEqual(normalized.reward,12);const engine=new engineModule.ClassicChessEngine(normalized.fen),result=engine.move('d8','h4');assert(result.ok&&result.status.type==='checkmate');
  // Extended Lichess goals reuse the exact forced-line chess engine, not
  // the old material-target guess or an unverified motif label.
  assert.strictEqual(importer.typeFromThemesExtended(new Set(['mate','mateIn4'])),'mate4');
  assert.strictEqual(importer.typeFromThemesExtended(new Set(['mate','mateIn5'])),'mate5Plus');
  assert.strictEqual(importer.typeFromThemesExtended(new Set(['fork','advantage'])),'bestLine');
  assert.strictEqual(importer.typeFromThemesExtended(new Set(['mate','fork'])),null,'unqualified mate must not be mislabeled');
  const fullOpts={ClassicChessEngine:engineModule.ClassicChessEngine,puzzleBaseGold:core.puzzleBaseGold,difficultyTable:core.DIFFICULTY_TABLE};
  const mate4Row={...row,PuzzleId:'mate4-fixture',Themes:'mate mateIn4 long',
    Moves:'g2g4 a7a6 a2a3 a6a5 b2b3 h7h6 c2c3 d8h4'};
  const mate4=await importer.normalizeExtendedLichessRow(mate4Row,fullOpts);
  assert(mate4&&core.isNormalizedPuzzle(mate4)&&mate4.type==='mate4');
  assert.strictEqual(mate4.solution.length,7);
  const mate5Row={...row,PuzzleId:'mate5-fixture',Themes:'mate mateIn5 veryLong',
    Moves:'g2g4 a7a6 a2a3 a6a5 b2b3 h7h6 c2c3 h6h5 d2d3 d8h4'};
  const mate5=await importer.normalizeExtendedLichessRow(mate5Row,fullOpts);
  assert(mate5&&core.isNormalizedPuzzle(mate5)&&mate5.type==='mate5Plus');
  assert.strictEqual(mate5.solution.length,9);
  const baseLine={...row,PuzzleId:'line-fixture',FEN:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    Moves:'e2e4 e7e5 g1f3',Themes:'advantage fork opening'};
  const best=await importer.normalizeExtendedLichessRow(baseLine,fullOpts);
  assert(best&&core.isNormalizedPuzzle(best)&&best.type==='bestLine');
  assert.deepStrictEqual(best.solution,['e7e5','g1f3']);
  assert.strictEqual(best.targetPiece,null);
  assert.strictEqual(await importer.normalizeExtendedLichessRow({...baseLine,Popularity:'79'},fullOpts),null,
    'extended goals retain existing popularity quality threshold');
  const lowPopularity={...row,Popularity:'79'};assert.strictEqual(await importer.normalizeLichessRow(lowPopularity,{ClassicChessEngine:engineModule.ClassicChessEngine,puzzleBaseGold:core.puzzleBaseGold,difficultyTable:core.DIFFICULTY_TABLE}),null);
  const highDeviation={...row,RatingDeviation:'101'};assert.strictEqual(await importer.normalizeLichessRow(highDeviation,{ClassicChessEngine:engineModule.ClassicChessEngine,puzzleBaseGold:core.puzzleBaseGold,difficultyTable:core.DIFFICULTY_TABLE}),null);
  const serialized=importer.serializeCatalog([normalized]);assert(serialized.includes('Lichess Open Database Puzzles'));assert(serialized.includes("license:'CC0'"));assert(serialized.includes('puzzle.fools'));
  console.log('Lichess streaming importer CSV/quality/normalization/checkmate contracts: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
