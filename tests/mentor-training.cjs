const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const {TRAINING_MENTORS,rebuildTraining,extendTraining,trainingMoveQuality}=await import(pathToFileURL(path.resolve(__dirname,'../game/js/mentor-training-history.mjs')).href);
 assert.equal(TRAINING_MENTORS.length,12);
 assert.deepEqual(TRAINING_MENTORS.map(x=>x.elo),[400,600,800,1000,1200,1400,1600,1800,2000,2200,2400,2600]);
 const record=['f2f3','e7e5','g2g4','d8h4'].map(uci=>({uci}));
 assert.equal(rebuildTraining(record,4).status().type,'checkmate');
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