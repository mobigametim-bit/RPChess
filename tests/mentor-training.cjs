const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const {TRAINING_MENTORS,rebuildTraining,extendTraining,trainingMoveQuality,trainingMoveQualityWinChance,mentorCpWinProbability,mentorScoreWinProbability}=await import(pathToFileURL(path.resolve(__dirname,'../game/js/mentor-training-history.mjs')).href);
 assert.equal(TRAINING_MENTORS.length,12);
 assert.deepEqual(TRAINING_MENTORS.map(x=>x.elo),[400,600,800,1000,1200,1400,1600,1800,2000,2200,2400,2600]);
 const {prepareFinishedReview,parseInfo}=await import(pathToFileURL(path.resolve(__dirname,'../game/js/finished-game-review.mjs')).href);
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
  moves:winning.moves.map(item=>item.uci),playerColor:'w',allColors:true});
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

 // Stage-2 win-chance calculation, intentionally opt-in until the Mentor API
 // Worker and client agree on grading. The old 422-proof contract remains live.
 const before=(cp,bestMove='g1f3',extra={})=>({cp,depth:12,bestMove,...extra});
 const after=(cp,extra={})=>({cp,depth:11,...extra});
 const chance=trainingMoveQualityWinChance;
 assert.equal(mentorCpWinProbability(0),0.5);
 assert(mentorCpWinProbability(100)>0.5);
 assert(mentorCpWinProbability(-100)<0.5);
 assert.equal(mentorCpWinProbability(5000),mentorCpWinProbability(1000),'extreme cp values bounded');
 assert.equal(mentorScoreWinProbability({cp:1200,mate:-3}),0,'negative mate overrides cp proxy');
 assert.equal(mentorScoreWinProbability({cp:-1200,mate:2}),1,'positive mate overrides cp proxy');
 assert.equal(mentorScoreWinProbability({cp:-1200,mate:0}),0,'mate 0 is checkmated side to move');
 const grading=(b,a,uci='g2g4')=>chance(b,a,uci);
 assert.equal(grading(before(100),after(80)).kind,'inaccuracy',
  '180cp loss in a competitive game is not automatically a mistake');
 assert.equal(grading(before(100),after(170)).kind,'mistake',
  '270cp loss is not automatically a blunder');
 assert.equal(grading(before(150),after(200)).kind,'blunder',
  'large probability loss in a contested position is a blunder');
 assert.equal(grading(before(800),after(-500)).kind,null,
  '300cp drop when still strongly winning need not interrupt play');
 assert.equal(grading(before(0),after(120)).kind,'inaccuracy');
 assert.equal(grading(before(0),after(800)).kind,'blunder');
 assert.equal(grading(before(150),after(200)).loss,350,
  'legacy centipawn display remains available');
 assert.equal(grading(before(150),after(200),'g1f3').kind,null,
  'engine best move never marked as a mistake at shallow search instability');
 assert.equal(grading(before(100,'g1f3',{depth:3}),after(800)),null);
 assert.equal(grading(before(100),after(800,{depth:2})),null);
 assert.equal(grading(before(100),after(NaN)),null);
 assert.equal(grading(before(0),after(1200,{mate:1})).kind,'blunder',
  'creating an immediate opponent mate from an equal position is a blunder');
 assert.equal(grading(before(-800),after(1200,{mate:2})).kind,'mistake',
  'forced mate in an already largely lost position gets reduced severity');
 assert.equal(grading(before(-1100),after(1200,{mate:1})).kind,'inaccuracy',
  'forced mate in a hopeless position should not receive a fresh catastrophic alert');
 assert.equal(grading(before(1200,'g1f3',{mate:2}),after(-1200,{mate:-4})).kind,null,
  'continuing a forced mate for the player is not a blunder');
 assert.equal(grading(before(1200,'g1f3',{mate:2}),after(-800)).kind,'mistake',
  'losing a forced mate while retaining a large advantage is still a mistake');
 assert.equal(parseInfo('info depth 14 multipv 1 score mate -3 pv d8h4').mate,-3,
  'UCI mate distance survives instead of collapsing into a centipawn sentinel');
 assert.equal(parseInfo('info depth 14 multipv 1 score mate -3 pv d8h4').cp,-1200,
  'existing full-game review retains its previous score proxy');
 assert.equal(parseInfo('info depth 12 score cp 42 pv g1f3').mate,null,
  'normal UCI centipawn evaluation does not become a false mate');

 // Replaying the entire actual move path preserves repetition and the fifty-move counter.
 const repeat=['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8'];
 assert.equal(rebuildTraining(repeat,repeat.length).status().type,'draw_threefold');
 const promotion=rebuildTraining(['a2a4','h7h5','a4a5','h5h4','a5a6','h4h3','a6b7','h3g2']);
 assert(promotion.legalMoves('b7').some(m=>m.promotion));
 console.log('Mentor training line, branch and move quality: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});