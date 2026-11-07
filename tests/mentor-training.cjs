const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const {TRAINING_MENTORS,rebuildTraining,extendTraining,trainingMoveQuality}=await import(pathToFileURL(path.resolve(__dirname,'../game/js/mentor-training-history.mjs')).href);
 assert.equal(TRAINING_MENTORS.length,12);
 assert.deepEqual(TRAINING_MENTORS.map(x=>x.elo),[400,600,800,1000,1200,1400,1600,1800,2000,2200,2400,2600]);
 const {prepareFinishedReview}=await import(pathToFileURL(path.resolve(__dirname,'../game/js/finished-game-review.mjs')).href);
 const record=['f2f3','e7e5','g2g4','d8h4'].map(uci=>({uci}));
 assert.equal(rebuildTraining(record,4).status().type,'checkmate');
 assert.equal(rebuildTraining(record,4).status().winner,'b','mentor recognises a loss when AI checkmates');
 const checkMoves=['e2e4','e7e5','f2f4','e5f4','g1f3','d8h4'];
 assert.equal(rebuildTraining(checkMoves).status().checked,true,'check must highlight the white king before the game ends');
 assert.equal(rebuildTraining(checkMoves).status().over,false);
 const mateSetup=['e2e4','e7e5','d1h5','b8c6','f1c4','g8f6'];
 assert.equal(rebuildTraining(mateSetup).status().over,false);
 const winning=extendTraining(mateSetup.map(uci=>({uci})),mateSetup.length,'h5f7');
 assert.equal(winning.ok,true);
 assert.equal(winning.status.type,'checkmate','scholars mate must close immediately after final move');
 assert.equal(winning.status.winner,'w');
 assert.equal(rebuildTraining(winning.moves,winning.cursor).status().checked,true,'checked king remains highlighted at mate');
 const reviewTurns=prepareFinishedReview({mode:'mentor',finished:true,
  moves:winning.moves,playerColor:'w',allColors:true});
 assert.equal(reviewTurns.length,winning.moves.length,'shared finished-game analysis accepts a completed mentor game');
 assert.equal(reviewTurns.at(-1).uci,'h5f7');
 assert.throws(()=>prepareFinishedReview({mode:'mentor',finished:true,
  moves:mateSetup,playerColor:'w',allColors:true}),/finished chess game/,
 'cannot analyse an unfinished mentor training session');

 const correction=extendTraining(record,2,'b1c3');
 assert(correction.ok&&correction.branched);
 assert.deepEqual(correction.moves.map(x=>x.uci),['f2f3','e7e5','b1c3']);
 assert.equal(rebuildTraining(correction.moves,3).fen(),correction.fen);
 assert.equal(rebuildTraining(record,2).turn(),'w');
 assert.equal(extendTraining(record,2,'g2g4').branched,false);
 assert.equal(extendTraining(record,2,'b1b5').ok,false);
 assert.throws(()=>rebuildTraining([{uci:'e2e5'}],1),/Illegal/);
 assert.equal(trainingMoveQuality({cp:100,depth:8,bestMove:'g1f3'},{cp:80,depth:8},'g2g4').kind,'mistake');
 assert.equal(trainingMoveQuality({cp:100,depth:8,bestMove:'g1f3'},{cp:170,depth:8},'g2g4').kind,'blunder');
 assert.equal(trainingMoveQuality({cp:100,depth:8,bestMove:'g1f3'},{cp:0,depth:8},'g1f3').kind,null);
 assert.equal(trainingMoveQuality({cp:100,depth:2,bestMove:'g1f3'},{cp:800,depth:8},'g2g4'),null);
 // Replaying the entire actual move path preserves repetition and the fifty-move counter.
 const repeat=['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8'];
 assert.equal(rebuildTraining(repeat,repeat.length).status().type,'draw_threefold');
 const promotion=rebuildTraining(['a2a4','h7h5','a4a5','h5h4','a5a6','h4h3','a6b7','h3g2']);
 assert(promotion.legalMoves('b7').some(m=>m.promotion));
 console.log('Mentor training line, branch and move quality: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});