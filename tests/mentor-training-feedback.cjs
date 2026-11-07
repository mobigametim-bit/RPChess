const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const base=path.resolve(__dirname,'..');
function imp(p){return import(pathToFileURL(path.join(base,p)).href);}
(async()=>{
 const {ClassicChessEngine}=await imp('game/js/classic-chess-engine.mjs');
 const {rebuildTraining}=await imp('game/js/mentor-training-history.mjs');
 const {validateMentorInput,promptForMentor,safeExplanation,localMentorFallback,describeMentorFact}=await imp('game/js/mentor-training-feedback-core.mjs');
 const {THINKING,PRAISE,thinkingText,praiseText,fallbackText}=await imp('game/js/mentor-training-copy.mjs');
 const {classifyStrongMove,gradeReviewAttempt}=await imp('game/js/finished-game-review.mjs');
 const {buildMentorPayload,requestMentorText,buildMentorV2Payload,requestMentorV2Text}=await imp('game/js/mentor-training-feedback-client.mjs');
 const {tacticalEvidence,MAX_PV}=await imp('game/js/mentor-training-tactics.mjs');
 const {evaluateStaticExchange}=await imp('game/js/mentor-training-exchange.mjs');
 const {POS,TACTIC,quickThreatProbe,verifyImmediateThreat}=await imp('game/js/mentor-training-threat.mjs');
 const {PRIORITY,GUIDES,lessonFromVerified,mentorLessonCopy,validateLessonGuess}=await imp('game/js/mentor-training-teaching.mjs');
 const {handleMentorApi,validOrigin,MAX_ATTEMPTS_PER_MODEL}=await imp('mentor-api/src/index.mjs');
 const {validatedV2Facts,promptForMentorV2,safeMentorAdvice,composeMentorV2Explanation,localMentorV2Fallback}=await imp('game/js/mentor-training-feedback-v2.mjs');

 // CC0 public chess reference corpus: do not mistake Lichess's setup move
 // for the learner's solution. Do not convert theme tags into inferred errors.
 const lichess=JSON.parse(fs.readFileSync(path.join(base,'tests/fixtures/mentor-reference-puzzles.json'),'utf8'));
 const referenceGames=JSON.parse(fs.readFileSync(path.join(base,'tests/fixtures/mentor-reference-games.json'),'utf8'));
 assert.equal(lichess.license,'CC0-1.0');
 assert(lichess.puzzles.length>=40,'enough distinct reference positions for stage-1 baselining');
 assert(referenceGames.games.length>=5,'real game provenance and separate positional cases');
 const corpusThemes=new Set();
 for(const item of lichess.puzzles){
  const initial=new ClassicChessEngine(item.fenBeforeSetup);
  const originalColor=initial.turn();
  const apply=(engine,uci)=>{
   const result=engine.move(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null);
   assert(result.ok,'reference '+item.id+': illegal published move '+uci);
   return result;
  };
  assert(item.line.length>=2,'reference '+item.id+' includes a setup move and a solution');
  apply(initial,item.line[0]); // Lichess puzzles start only AFTER this opponent move
  assert.notEqual(initial.turn(),originalColor,'reference '+item.id+' alternates sides');
  const puzzleFen=initial.fen(),sol=item.line.slice(1);
  assert(sol.length<=MAX_PV,'reference '+item.id+' within the mentor PV limit');
  const playing=new ClassicChessEngine(puzzleFen);
  for(const move of sol)apply(playing,move);
  const evidence=tacticalEvidence(puzzleFen,sol,originalColor);
  assert.deepEqual(evidence.line,sol,'reference '+item.id+': replay exactly the published legal line');
  assert(evidence.events.every(ev=>ev.ply>=1&&ev.ply<=sol.length),
   'reference '+item.id+': no invented events outside the line');
  const lessonFromLine=lessonFromVerified({
   afterFen:puzzleFen,afterLine:sol,tactics:evidence.events,player:originalColor
  });
  assert.equal(lessonFromLine.from,sol[0].slice(0,2),'reference '+item.id+': point to solution-side piece');
  assert(validateLessonGuess(lessonFromLine,sol[0].slice(0,2)),
   'reference '+item.id+': correct piece can be selected on post-setup board');
  assert(item.puzzleUrl.endsWith(item.id)&&item.gameUrl.startsWith('https://lichess.org/'));
  for(const theme of item.themes)corpusThemes.add(theme);
 }
 assert(corpusThemes.size>=35,'corpus covers rare attacks, defense, endgames, and quiet moves');
 for(const gameFixture of referenceGames.games){
  assert(gameFixture.gameUrl.startsWith('https://lichess.org/'));
  assert(gameFixture.sanMoves.trim().split(/\s+/).length>=60,
   'full historical game trace, not just one tactical puzzle');
  assert(Math.abs(gameFixture.analysisReference.annotatedPlies-gameFixture.numberOfPlies)<=1,
   'historical analysis may omit the final move of a finished game');
  const setup=new ClassicChessEngine(gameFixture.sourcePosition);
  const first=gameFixture.sourceLine[0],response=setup.move(first.slice(0,2),first.slice(2,4),first.slice(4)||null);
  assert(response.ok,'source game setup move is legal '+gameFixture.puzzleId);
  for(const uci of gameFixture.sourceLine.slice(1)){
   const played=setup.move(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null);
   assert(played.ok,'source game puzzle continuation legal '+gameFixture.puzzleId+': '+uci);
  }
 }

 assert.equal(MAX_ATTEMPTS_PER_MODEL,4,'initial request plus 3 retries');
 const {handleMentorBenchmark,benchRequestConfig}=await imp('mentor-api/src/benchmark.mjs');
 const beforeFen=rebuildTraining(['f2f3','e7e5'],2).fen();
 const chess=new ClassicChessEngine(beforeFen);
 assert(chess.move('g2','g4').ok);
 const afterFen=chess.fen();
 const body={version:1,language:'ru',beforeFen,afterFen,uci:'g2g4',grade:'blunder',
  before:{cp:90,depth:11,bestMove:'b1c3',pv:['b1c3','b8c6']},
  after:{cp:200,depth:10,pv:['d8h4']}};
 // Stage 5: optional correction is judged from the pre-error position.
 const strongAlternative={beforeFen,beforeCp:50,bestMove:'b1c3'};
 let alternativeEvaluations=0;
 const alternate=await gradeReviewAttempt(strongAlternative,'d2d4',{
  engine:{evaluate:async fen=>{
   alternativeEvaluations++;
   assert.equal(new ClassicChessEngine(fen).turn(),'b');
   return {cp:-35,depth:12,bestMove:'b8c6'};
  }},tolerance:70
 });
 assert.equal(alternate.accepted,true,'a good alternative need not match engine UCI');
 assert.equal(alternate.loss,15);
 assert.equal(alternativeEvaluations,1);
 const badCorrection=await gradeReviewAttempt(strongAlternative,'g2g4',{
  engine:{evaluate:async()=>({cp:250,depth:12,bestMove:'d8h4'})},tolerance:70
 });
 assert.equal(badCorrection.accepted,false);
 assert.equal(badCorrection.loss,300);
 const exactBest=await gradeReviewAttempt(strongAlternative,'b1c3',{
  engine:{evaluate:async()=>{throw Error('best move should bypass new evaluation');}}
 });
 assert.equal(exactBest.accepted,true);
 const shallow=await gradeReviewAttempt(strongAlternative,'d2d4',{
  engine:{evaluate:async()=>({cp:-20,depth:2})}
 });
 assert.equal(shallow.unavailable,true);
 const illegal=await gradeReviewAttempt(strongAlternative,'e2e5',{
  engine:{evaluate:async()=>{throw Error('illegal move should not reach review');}}
 });
 assert.equal(illegal.invalid,true);
 const facts=validateMentorInput(body);

 // Stage 6 opt-in v2 contract; old deployed v1 payload is also tested below.
 const v2Fast={cp:1200,mate:1,depth:12,bestMove:'d8h4',pv:['d8h4']};
 const v2Deep={cp:1200,mate:1,depth:18,bestMove:'d8h4',pv:['d8h4'],
  secondMove:'a7a6',secondCp:80,secondDepth:17};
 const preparedV2=buildMentorV2Payload({
  beforeFen,afterFen,uci:'g2g4',grade:'blunder',language:'ru',
  before:{cp:90,depth:12,bestMove:'b1c3'},after:v2Fast,
  continuation:v2Deep,verifiedThreat:{kind:'mate_sequence',uci:'d8h4',basis:'legal_checkmate'}
 });
 assert.equal(preparedV2.payload.version,2);
 assert.equal(preparedV2.verified.version,2);
 assert.equal(preparedV2.verified.motive,'mate_sequence');
 assert.equal(preparedV2.verified.lesson.from,'d8');
 assert.equal(preparedV2.verified.factId,'mate_sequence:d8h4');
 assert.equal(preparedV2.verified.verifiedFact,'Соперник может поставить мат следующим ходом.');
 assert(!promptForMentorV2(preparedV2.verified).user.includes('b1c3'),
  'best alternative and exact board position never sent to model');
 assert(!promptForMentorV2(preparedV2.verified).user.includes(beforeFen),
  'v2 LLM receives facts and pedagogy, not raw FEN');
 const goodAdvice='Перед ходом проверяй самый сильный ответ соперника. Что ещё ты мог упустить?';
 assert.equal(composeMentorV2Explanation(goodAdvice,preparedV2.verified),
  preparedV2.verified.verifiedFact+' '+goodAdvice);

 const genericChecks='Перед ходом проверь шахи, взятия и угрозы соперника. Какой ответ кажется самым опасным?';
 assert.equal(safeMentorAdvice(genericChecks,preparedV2.verified),genericChecks,
  'general advice may mention checks and captures without claiming one occurred');
 assert.equal(safeMentorAdvice('Соперник сможет поставить шах твоему королю. Проверь нападения.',
  preparedV2.verified),null,
  'a specific imagined chess event must still be rejected');
 const oneAttemptReq=new Request('https://rpchess-mentor-api-v2-preview.mobigametim.workers.dev/v2/explain',{
  method:'POST',headers:{Origin:'https://rpchess-mentor-training-preview.mobigametim.workers.dev',
  'Content-Type':'application/json','X-Mentor-Diagnostic':'one',
  'X-Mentor-Session':'123456789012345678901234'},
  body:JSON.stringify(preparedV2.payload)
 });
 let singleModelCalls=0;
 const singleAnswer=await handleMentorApi(oneAttemptReq,{
  GONKA_API_KEY:'test-key',MENTOR_GLOBAL_LIMIT:{limit:async()=>({success:true})},
  MENTOR_ACTOR_LIMIT:{limit:async()=>({success:true})}
 },async()=>{singleModelCalls++;return new Response('{}',{status:503})},async()=>{},2);
 assert.equal(singleAnswer.status,503);
 assert.equal(singleModelCalls,1,'opt-in diagnostic cannot call secondary models or retry');
 assert.equal((await singleAnswer.json()).attempts.length,1);

 for(const invented of [
  'Сыграй b1c3 и сразу выиграешь материал. Какой ещё ход помогает?',
  'Забери ферзя на a3, затем добей короля. Что дальше?',
  'Соперник сможет выиграть ладью. Передвинь коня.'
 ])assert.equal(safeMentorAdvice(invented,preparedV2.verified),null,
  'v2 must reject unverified squares, moves, exchanges and tactical claims');
 assert.throws(()=>validatedV2Facts({...preparedV2.payload,grade:'mistake'}),/invalid_grade/);
 assert.throws(()=>validatedV2Facts({...preparedV2.payload,verifiedThreat:{
  kind:'fork',uci:'d8h4',basis:'legal_checkmate'}}),/mismatched_tactic/);
 assert.throws(()=>validatedV2Facts({...preparedV2.payload,continuation:{
  ...preparedV2.payload.continuation,pv:['a7a6'],bestMove:'a7a6'}}),/unverified_tactic/);
 const v2Origin='https://rpchess-mentor-training-preview.mobigametim.workers.dev';
 const v2Req=(payload,origin=v2Origin)=>new Request('https://rpchess-mentor-api-v2-preview.mobigametim.workers.dev/v2/explain',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Mentor-Session':'123456789012345678901234'},
  body:JSON.stringify(payload)
 });
 let v2Calls=0;
 const v2Env={GONKA_API_KEY:'test-key',
  MENTOR_GLOBAL_LIMIT:{limit:async()=>({success:true})},
  MENTOR_ACTOR_LIMIT:{limit:async()=>({success:true})}};
 const v2Fetcher=async(url,opts)=>{
  v2Calls++;
  const upstream=JSON.parse(opts.body);
  assert.equal(upstream.model,'deepseek-ai/DeepSeek-V4-Flash-0731');
  assert.equal(upstream.response_format.json_schema.schema.required[0],'advice');
  assert(!JSON.stringify(upstream).includes(beforeFen),'no raw FEN in LLM prompt');
  assert(!JSON.stringify(upstream).includes('b1c3'),'no best engine alternative in LLM prompt');
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({advice:goodAdvice})}}]}),{status:200});
 };
 const v2Response=await handleMentorApi(v2Req(preparedV2.payload),v2Env,v2Fetcher,async()=>{},2);
 assert.equal(v2Response.status,200);
 const v2Answer=await v2Response.json();
 assert.equal(v2Answer.contractVersion,2);
 assert.equal(v2Answer.verifiedFact,preparedV2.verified.verifiedFact);
 assert.equal(v2Answer.explanation,preparedV2.verified.verifiedFact+' '+goodAdvice);
 assert.equal(v2Calls,1);
 // Mock a paid provider's 200 with untrusted advice. It must never be misdiagnosed
 // as a network failure, nor silently run eleven additional paid attempts.
 let unsafeCalls=0;
 const unsafeAdvice=await handleMentorApi(v2Req(preparedV2.payload),v2Env,async()=>{
  unsafeCalls++;
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{
   content:JSON.stringify({advice:'Сыграй конём на a3, затем забери ладью.'})}}]}),{status:200});
 },async()=>{},2);
 assert.equal(unsafeAdvice.status,503);
 const unsafeResult=await unsafeAdvice.json();
 assert.equal(unsafeCalls,1,'v2 is limited to one DeepSeek provider call');
 assert.equal(unsafeResult.attempts.length,1);
 assert.equal(unsafeResult.reason,'broker_unsafe_advice','preserve validation failure reason');
 assert.equal(unsafeResult.attempts[0].validation,'piece_or_motif','no raw model response in diagnostics');
 const exhaustedThink=await handleMentorApi(v2Req(preparedV2.payload),v2Env,async()=>
  new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:''}}]}),{status:200}),async()=>{},2);
 assert.equal((await exhaustedThink.json()).reason,'broker_thinking_exhausted');

 const v2Browser=await requestMentorV2Text({payload:preparedV2.payload,verified:preparedV2.verified,
  fetcher:async()=>new Response(JSON.stringify(v2Answer),{status:200})});
 assert.equal(v2Browser.source,'deepseek');
 const forged=await requestMentorV2Text({payload:preparedV2.payload,verified:preparedV2.verified,
  fetcher:async()=>new Response(JSON.stringify({
   ...v2Answer,verifiedFact:'Вилка на a3.',explanation:'Вилка на a3. '+goodAdvice
  }),{status:200})});
 assert.equal(forged.source,'fallback','browser enforces the exact verified fact independently');
 assert.equal(forged.explanation,localMentorV2Fallback(preparedV2.verified));
 assert.equal((await handleMentorApi(v2Req({...preparedV2.payload,grade:'mistake'}),v2Env,v2Fetcher,async()=>{},2)).status,422);
 assert.equal((await handleMentorApi(v2Req(preparedV2.payload,'https://attacker.example'),v2Env,v2Fetcher,async()=>{},2)).status,403);
 assert.equal((await handleMentorApi(new Request('https://rpchess-mentor-api-v2-preview.mobigametim.workers.dev/v1/explain'),
  v2Env,v2Fetcher,async()=>{},2)).status,404);
 const v2Health=await handleMentorApi(new Request('https://rpchess-mentor-api-v2-preview.mobigametim.workers.dev/health'),
  v2Env,v2Fetcher,async()=>{},2);
 assert.equal((await v2Health.json()).contractVersion,2);
 assert.equal(v2Calls,1,'all negative cases are rejected before any paid call');

 assert.equal(facts.motive,'checkmate');
 assert.equal(facts.loss,290);
 const lesson=lessonFromVerified(facts);
 assert.equal(lesson.kind,'mate_sequence');
 assert.equal(lesson.from,'d8');
 assert.equal(lesson.to,'h4');
 assert.equal(lesson.ply,1);
 assert(validateLessonGuess(lesson,'d8'));
 assert(!validateLessonGuess(lesson,'e8'));
 assert(mentorLessonCopy(lesson,'ru').answer.includes('d8–h4'));
 assert(mentorLessonCopy(lesson,'en').question.includes('piece'));
 assert.equal(Object.keys(GUIDES).length,18,'full grounded tactical lesson catalog');
 assert.deepEqual(Object.keys(PRIORITY).sort(),Object.keys(GUIDES).sort());
 assert.equal(THINKING.ru.length,20,'20 waiting phrases in Russian');
 assert.equal(THINKING.en.length,20,'20 waiting phrases in English');
 for(const mark of ['good','excellent']){
  assert.equal(PRAISE.ru[mark].length,10,'10 local praise phrases for each mark');
  assert.equal(PRAISE.en[mark].length,10,'localized praise exists');
  assert(praiseText('ru',mark,'sample').length>10);
 }
 assert.equal(thinkingText('ru','seed'),thinkingText('ru','seed'),'phrase choice is deterministic');
 assert(fallbackText('ru','blunder').includes('Зевок'),'generic grade fallback exists');
 assert.equal(classifyStrongMove({
  uci:'g1f3',beforeFen:new ClassicChessEngine().fen()
 },{
  cp:110,secondCp:-140,bestMove:'g1f3',depth:14,secondDepth:13
 },0),'excellent','use same strict positive classification as completed reviews');
 const forkDetail={...facts,motive:'fork',tactics:[{kind:'fork',ply:3,piece:'n',targets:['q','r']}]};
 const concrete=describeMentorFact(forkDetail,'ru');
 assert(concrete.includes('Через два хода')&&concrete.includes('ферзя и ладью'),
  'explanation gives the timeline and named targets');
 assert(!concrete.includes('рассчитанной линии'));
 assert(JSON.parse(promptForMentor(forkDetail).user).verifiedFact.includes('ферзя и ладью'));
 assert(!safeExplanation('В рассчитанной линии возможна вилка.',forkDetail),
  'vague AI phrases are rejected');
 

 // Replayed line is evidence only: actual mating move, not speculative intent.

 // Stage 3 groundwork: legal capture/recapture tree, no guessed material loss.
 const undefended=evaluateStaticExchange('r3k3/8/8/8/8/8/4K3/R7 b - - 0 1','a8a1');
 assert.equal(undefended.scoreCp,500,'unprotected rook is won');
 assert.equal(undefended.exact,true);
 assert.deepEqual(undefended.line,['a8a1']);
 const guarded=evaluateStaticExchange('r3k3/8/8/8/8/8/1Q2K3/R7 b - - 0 1','a8a1');
 assert.equal(guarded.scoreCp,0,'defended rook can be recaptured by the queen');
 assert.deepEqual(guarded.line,['a8a1','b2a1'],'defending queen can immediately recapture');
 const badQueen=evaluateStaticExchange('q3k3/8/8/8/8/8/P7/R3K3 b - - 0 1','a8a2');
 assert.equal(badQueen.scoreCp,-800,'a queen losing to rook recapture makes pawn capture unsound');
 assert.deepEqual(badQueen.line,['a8a2','a1a2']);
 const pinned=evaluateStaticExchange('2q1r2k/8/8/8/8/8/2P1R3/4K3 b - - 0 1','c8c2');
 assert.equal(pinned.scoreCp,100,'white rook pinned on e2 cannot illegally recapture c2');
 assert(pinned.exact);
 const ep=evaluateStaticExchange('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1','e5d6');
 assert.equal(ep.scoreCp,100,'en passant captured pawn is on d5 not d6');
 const promoted=evaluateStaticExchange('r3k3/1P6/8/8/8/8/8/4K3 w - - 0 1','b7a8q');
 assert.equal(promoted.scoreCp,1300,'capturing rook and promoting includes pawn conversion');
 assert.equal(evaluateStaticExchange(new ClassicChessEngine().fen(),'e2e4'),null,
  'non-captures have no exchange verdict');
 assert.equal(evaluateStaticExchange(new ClassicChessEngine().fen(),'e2e5'),null,
  'illegal moves cannot produce exchange claims');
 const boundedExchange=evaluateStaticExchange('r3k3/8/8/8/8/8/1Q2K3/R7 b - - 0 1','a8a1',{maxPlies:1});
 assert.equal(boundedExchange.exact,false,'truncated capture tree cannot be trusted as proven');
 assert(boundedExchange.nodes<=1,'node budget respected');


 // Stage 4: a legal PV is never, by itself, permission to pause the rival.
 const fastMate={depth:10,cp:1200,bestMove:'d8h4',pv:['d8h4']};
 const deepMate={...fastMate,depth:17,secondMove:'a7a6',secondCp:190};
 assert.equal(quickThreatProbe({afterFen,after:fastMate,player:'w'}).status,'candidate');
 const provenMate=verifyImmediateThreat({afterFen,after:fastMate,deep:deepMate,player:'w'});
 assert.equal(provenMate.status,TACTIC,'checkmate in the actual immediate reply is verified');
 assert.equal(provenMate.evidence.kind,'mate_sequence');
 assert.equal(provenMate.evidence.firstMove,'d8h4');
 assert.equal(provenMate.evidence.secondMove,'a7a6','MultiPV alternative is preserved for ambiguity auditing');
 assert.equal(verifyImmediateThreat({afterFen,after:fastMate,
  deep:{...deepMate,secondMove:'e8e7',secondDepth:15,secondCp:1190},player:'w'}).status,POS,
 'two nearly equal replies from different pieces cannot become a single-answer quiz');
 assert.equal(verifyImmediateThreat({afterFen,after:fastMate,
  deep:{...deepMate,bestMove:'a7a6',pv:['a7a6']},player:'w'}).status,POS,
 'deep search disagreement is not an invitation to guess the attacking piece');
 assert.equal(verifyImmediateThreat({afterFen,after:fastMate,
  deep:{...deepMate,depth:4},player:'w'}).status,POS,
 'shallow deep search cannot certify an immediate threat');
 assert.equal(verifyImmediateThreat({afterFen,after:fastMate,
  deep:{...deepMate,cp:0},player:'w'}).status,POS,
 'large evaluation disagreement must fall back to positional comment');
 const emptyQuick=quickThreatProbe({afterFen:new ClassicChessEngine().fen(),
  after:{cp:10,depth:12,bestMove:'e2e4',pv:['e2e4']},player:'b'});
 assert.equal(emptyQuick.status,POS,'ordinary quiet reply cannot trigger a forced quiz');
 const noDefenseFen='r3k3/8/8/8/8/8/4K3/R7 b - - 0 1';
 const defendedFen='r3k3/8/8/8/8/8/1Q2K3/R7 b - - 0 1';
 const quickCapture={depth:10,cp:330,bestMove:'a8a1',pv:['a8a1']};
 const deepCapture={...quickCapture,depth:16,cp:320,secondCp:160,secondMove:'a8a4'};
 assert.equal(verifyImmediateThreat({afterFen:noDefenseFen,after:quickCapture,
  deep:deepCapture,player:'w'}).status,TACTIC,
 'profitable and fully inspected immediate capture is a teachable threat');
 assert.equal(quickThreatProbe({afterFen:defendedFen,after:quickCapture,player:'w'}).status,POS,
 'a rook protected by a queen cannot be called unprotected simply because it is attacked');
 const badQueenFen='q3k3/8/8/8/8/8/P7/R3K3 b - - 0 1';
 assert.equal(quickThreatProbe({afterFen:badQueenFen,
  after:{depth:10,cp:180,bestMove:'a8a2',pv:['a8a2']},player:'w'}).status,POS,
 'a material-losing capture is not a verified opportunity even when it appears in a PV');
 const checkForkFen='4k3/8/8/8/1n6/8/8/Q3K3 b - - 0 1';
 const checkingFork={depth:10,cp:330,bestMove:'b4c2',pv:['b4c2']};
 assert.equal(verifyImmediateThreat({afterFen:checkForkFen,after:checkingFork,
  deep:{...checkingFork,depth:15,cp:360},player:'w'}).status,TACTIC,
 'legally verified checking fork of king and queen is a tactical exercise');
 const unverifiedSkewer='4k2r/8/8/8/8/8/8/5RK1 b - - 0 1';
 assert.equal(quickThreatProbe({afterFen:unverifiedSkewer,
  after:{depth:10,cp:300,bestMove:'h8h1',pv:['h8h1']},player:'w'}).status,POS,
 'skewer-shaped geometry in one PV alone must not pause play without verified material');

 const mate=tacticalEvidence(afterFen,['d8h4'],'w');
 assert.deepEqual(mate.line,['d8h4']);
 assert(mate.events.some(e=>e.kind==='mate_sequence'));
 const fork=tacticalEvidence('4k3/8/8/8/1n6/8/8/Q3K3 b - - 0 1',['b4c2'],'w');
 assert(fork.events.some(e=>e.kind==='fork'),'the knight move forks king and queen');
 const pin=tacticalEvidence('k6r/8/8/8/8/8/4B3/4K3 b - - 0 1',['h8e8'],'w');
 assert(pin.events.some(e=>e.kind==='pin'),'rook newly pins bishop to king');
 const material=tacticalEvidence('r3k3/8/8/8/8/8/8/R3K3 b - - 0 1',['a8a1'],'w');
 assert(material.events.some(e=>e.kind==='material_loss'&&e.net===5));
 assert(material.events.some(e=>e.kind==='undefended_capture'),
  'an unprotected rook is distinguished from a defended exchange');
 const skewer=tacticalEvidence('4k2r/8/8/8/8/8/8/5RK1 b - - 0 1',['h8h1'],'w');
 assert(skewer.events.some(e=>e.kind==='skewer_pattern'&&e.targetSquares.includes('g1')),
  'rook / king / rook alignment is a visible skewer pattern');
 const opened=tacticalEvidence('4r1k1/8/4n3/8/8/8/4Q3/7K b - - 0 1',['e6f4'],'w');
 assert(opened.events.some(e=>e.kind==='discovered_attack'&&e.targetSquares.includes('e2')),
  'moving knight uncovers rook attack on queen');
 const promo=tacticalEvidence('4k3/P7/8/8/8/8/8/7K w - - 0 1',['a7a8q'],'b');
 assert(promo.events.some(e=>e.kind==='promotion'),'actual pawn promotion detected');
 const passed=tacticalEvidence('4k3/8/8/8/8/p7/8/7K b - - 0 1',['a3a2'],'w');
 assert(passed.events.some(e=>e.kind==='advanced_passed_pawn'),
  'advanced passer with no opposing pawn ahead recognized');
 // Avoid inventing tactics for a position where Stockfish did not prove them.
 const quiet=tacticalEvidence('4k3/8/8/8/8/8/8/4K3 b - - 0 1',['e8d8'],'w');
 assert(!quiet.events.some(e=>['fork','pin','skewer_pattern','material_loss'].includes(e.kind)));
 const noLesson=lessonFromVerified({...facts,afterFen:'4k3/8/8/8/8/8/8/4K3 b - - 0 1',
  afterLine:['e8d8'],tactics:quiet.events});
 assert.equal(noLesson.kind,'positional','no unproven tactics or clickable solution');
 // No tactical claim from an invalid move or a guessed continuation.
 assert.equal(tacticalEvidence(afterFen,['d8g7','d8h4'],'w').line.length,0);
 const opening=['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6','d2d3','f8c5',
  'b1c3','d7d6','c1g5','h7h6','g5h4','c8e6','d1d2','a7a6',
  'a2a3','b7b5','c4b3','a8b8','h2h3'];
 const deepGame=new ClassicChessEngine();
 const firstMove=deepGame.move('e2','e4');
 assert(firstMove.ok);
 const longPayload={
  version:1,language:'ru',beforeFen:new ClassicChessEngine().fen(),
  afterFen:firstMove.fen,uci:'e2e4',grade:'blunder',
  before:{cp:150,depth:12,bestMove:'d2d4'},
  after:{cp:180,depth:10,pv:['e7e5']},
  continuation:{depth:24,pv:opening.slice(1)}
 };
 assert.equal(longPayload.continuation.pv.length,MAX_PV);
 const detailed=validateMentorInput(longPayload);
 assert.equal(detailed.afterLine.length,20,'20 legal half-moves accepted from Stockfish PV');
 assert.equal(JSON.parse(promptForMentor(detailed).user).opponentContinuation.length,20,
  'DeepSeek receives up to 20 verified half-moves, not only the first three');
 assert(!promptForMentor(detailed).user.includes('d2d4'),'correct move remains hidden');
 assert.throws(()=>validateMentorInput({
  ...longPayload,continuation:{depth:24,pv:['e7e5','a8a1']}
 }),/refutation/,'malformed PV must not produce a tactical claim');
 const bounded=buildMentorPayload({...longPayload,continuation:{
  depth:24,pv:[...opening.slice(1),'e2e5']
 }});
 assert.equal(bounded.payload.continuation.pv.length,20,'client caps PV at 20 plies');

 assert(!promptForMentor(facts).user.includes('b1c3'),'model prompt must not reveal the engine solution');
 assert(localMentorFallback(facts).includes('мат'));
 assert(!safeExplanation('Сыграй b1c3, и всё будет хорошо.',facts));
 assert(!safeExplanation('Конь идёт на a6 и атакует вашего коня на b5. Затем последует размен на a3.',facts),
  'model must not invent concrete squares, threats or an exchange');
 assert(!safeExplanation('После размена фигур соперник получает инициативу. Поищи защиту.',facts),
  'unverified exchange narratives are rejected even without board squares');
 assert(!safeExplanation('<script>alert(1)</script>',facts));
 assert.throws(()=>validateMentorInput({...body,grade:'mistake'}),/grade/);
 assert.throws(()=>validateMentorInput({...body,afterFen:beforeFen}),/position/);
 assert.throws(()=>validateMentorInput({...body,uci:'g2g7'}),/position/);
 assert.throws(()=>validateMentorInput({...body,after:{...body.after,pv:['b8b5']}}),/refutation/);
 const built=buildMentorPayload({...body,language:'ru'});
 assert.equal(built.verified.motive,'checkmate');
 let calls=0;
 const fetcher=async(url,opts)=>{
  calls++;const sent=JSON.parse(opts.body);
  assert.equal(sent.model,'deepseek-ai/DeepSeek-V4-Flash-0731');
  assert.equal(sent.response_format.type,'json_schema','DeepSeek receives tested strict JSON');
  assert.equal(sent.reasoning_effort,'none','DeepSeek skips reasoning for short replies');
  assert.equal(sent.max_tokens,1000,'DeepSeek uses measured response budget');
  assert(!JSON.stringify(sent).includes('b1c3'),'upstream must not see best move');
  assert.match(url,/\/chat\/completions$/);
  assert.equal(opts.headers.Authorization,'Bearer test-key');
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({explanation:'Этот ход открыл дорогу к немедленному мату. Найди, какую угрозу упустил.'})}}]}),{status:200,headers:{'content-type':'application/json'}});
 };
 const good={GONKA_API_KEY:'test-key',GONKA_MODEL:'should-not-be-used',MENTOR_ACTOR_LIMIT:{limit:async()=>({success:true})},MENTOR_GLOBAL_LIMIT:{limit:async()=>({success:true})}};
 const origin='https://rpchess-mentor-training-preview.mobigametim.workers.dev';
 const req=(data,from=origin)=>new Request('https://rpchess-mentor-api-preview.mobigametim.workers.dev/v1/explain',{
  method:'POST',headers:{Origin:from,'Content-Type':'application/json','X-Mentor-Session':'123456789012345678901234'},body:JSON.stringify(data)
 });
 assert(validOrigin(origin));assert(!validOrigin('https://fake.example'));
 const res=await handleMentorApi(req(body),good,fetcher);
 assert.equal(res.status,200);
 const result=await res.json();
 assert.equal(result.source,'deepseek');assert.equal(result.grade,'blunder');
 assert.equal(calls,1);
 const client=await requestMentorText({payload:built.payload,verified:built.verified,fetcher:async()=>new Response(JSON.stringify(result),{status:200})});
 assert.equal(client.explanation,result.explanation);
 assert.equal(client.source,'deepseek');
 assert.equal(client.model,'deepseek-ai/DeepSeek-V4-Flash-0731');
 const unverified=await requestMentorText({payload:built.payload,verified:built.verified,fetcher:async()=>new Response(JSON.stringify({
  ...result,explanation:'Конь пойдёт на a6, нападая на другую фигуру. После размена на a3 вы потеряете слона.'
 }),{status:200})});
 assert.equal(unverified.source,'fallback','browser rejects unsafe old-Worker text without redeployment');
 assert.equal(unverified.reason,'unverified_explanation');
 const fallback=await requestMentorText({payload:built.payload,verified:built.verified,fetcher:async()=>new Response('{}',{status:503})});
 assert.equal(fallback.explanation,localMentorFallback(facts));
 assert.equal(fallback.source,'fallback');
 assert.equal(fallback.retryable,true);
 assert.equal((await handleMentorApi(req(body,'https://fake.example'),good,fetcher)).status,403);
 assert.equal((await handleMentorApi(req({...body,grade:'mistake'}),good,fetcher)).status,422);
 assert.equal((await handleMentorApi(req(body),{...good,GONKA_API_KEY:''},fetcher)).status,503);
 assert.equal((await handleMentorApi(req(body),{...good,MENTOR_GLOBAL_LIMIT:{limit:async()=>({success:false})}},fetcher)).status,429);
 assert.equal((await handleMentorApi(req(body),{GONKA_API_KEY:'test-key'},fetcher)).status,503);
 // Three consecutive attempts use the SAME Gonka Base URL and correct model ids.
 const models=[
  'deepseek-ai/DeepSeek-V4-Flash-0731',
  'MiniMaxAI/MiniMax-M2.7',
  'zai-org/GLM-5.3-Flash'
 ];
 const overLimit='Этот ход оставляет короля под серьёзной угрозой, и соперник может немедленно воспользоваться этим. Проверь, какие поля оказались без защиты, и найди, где потеряна возможность отразить атаку.';
 assert(overLimit.length>130&&overLimit.length<=500,'sample answer must fit the new limit');
 const longAnswer=overLimit+' Помни, что найденное продолжение — только один возможный вариант.';
 assert(longAnswer.length<=500);
 assert(safeExplanation(longAnswer,facts),'500-character answers with 2–5 sentences are now accepted');
 const tooLong='Первое предложение. '+'Дополнительное предложение. '.repeat(30);
 assert(tooLong.length>500);
 assert.equal(safeExplanation(tooLong,facts),null,'over 500 characters must be rejected');
 assert(promptForMentor(facts).system.includes('500 символов'));
 assert(promptForMentor({...facts,language:'en'}).system.includes('500 characters'));
 let requested=[];
 const noDelay=async()=>{};
 const failuresFor=(model,reason)=>Array.from({length:4},(_,i)=>({model,attempt:i+1,reason}));
 // A transient invalid payload must be retried on DeepSeek itself three
 // times BEFORE MiniMax is contacted; a valid fourth attempt stops.
 let repeated=0;
 const recovery=await handleMentorApi(req(body),good,async(url,opts)=>{
  const m=JSON.parse(opts.body);
  requested.push(m.model);
  assert.equal(m.model,models[0],'retry does not skip directly to MiniMax');
  repeated++;
  if(repeated===1)return new Response('{}',{status:503});
  if(repeated===2)return new Response(JSON.stringify({
   choices:[{message:{content:'not JSON'}}]
  }),{status:200});
  if(repeated===3)return new Response('{}',{status:429});
  return new Response(JSON.stringify({choices:[{message:{
   content:JSON.stringify({explanation:longAnswer})
  }}]}),{status:200});
 },noDelay);
 assert.equal(recovery.status,200);
 const recoveredSame=await recovery.json();
 assert.equal(recoveredSame.source,'deepseek');
 assert.equal(recoveredSame.modelAttempt,4);
 assert.equal(recoveredSame.attempts,4);
 assert.deepEqual(requested,[models[0],models[0],models[0],models[0]]);
 assert.deepEqual(recoveredSame.failures,[
  {model:models[0],attempt:1,reason:'broker_unavailable'},
  {model:models[0],attempt:2,reason:'broker_invalid'},
  {model:models[0],attempt:3,reason:'broker_busy'}
 ],'record failure reason per retry for debugging');
 requested=[];
 const fallbackFetcher=async(url,opts)=>{
  assert(url.includes('/functions/v1/gonka/chat/completions'));
  const m=JSON.parse(opts.body);
  requested.push(m.model);
  assert.equal(m.max_tokens,m.model===models[0]?1000:900,'tested model token budgets');
  if(m.model===models[1]){
   assert.equal(m.response_format.type,'json_object','MiniMax must not use schema');
   assert.equal(m.reasoning_effort,undefined,'MiniMax thinking cannot be disabled');
  }
  if(m.model===models[0])return new Response('{}',{status:503});
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({explanation:longAnswer})}}]}),{status:200});
 };
 const recovered=await handleMentorApi(req(body),good,fallbackFetcher,noDelay);
 assert.equal(recovered.status,200,'second model recovers only after four failed primary attempts');
 const recoveredData=await recovered.json();
 assert.equal(recoveredData.source,'minimax');
 assert.equal(recoveredData.model,models[1]);
 assert.equal(recoveredData.attempts,5,'four DeepSeek attempts plus one MiniMax attempt');
 assert.equal(recoveredData.modelAttempt,1);
 assert.deepEqual(recoveredData.failures,failuresFor(models[0],'broker_unavailable'));
 assert.deepEqual(requested,[...Array(4).fill(models[0]),models[1]],'model order is stable');
 // MiniMax also gets up to three retries before fallback to GLM.
 requested=[];
 let miniCount=0;
 const miniRecovery=await handleMentorApi(req(body),good,async(url,opts)=>{
  const {model}=JSON.parse(opts.body);
  requested.push(model);
  if(model===models[0])return new Response('{}',{status:503});
  miniCount++;
  if(miniCount<=2)return new Response(JSON.stringify({choices:[{
   message:{content:'{"explanation":"truncated"'}
  }]}),{status:200});
  return new Response(JSON.stringify({choices:[{
   message:{content:JSON.stringify({explanation:longAnswer})}
  }]}),{status:200});
 },noDelay);
 assert.equal(miniRecovery.status,200);
 assert.equal((await miniRecovery.json()).modelAttempt,3);
 assert.deepEqual(requested,[...Array(4).fill(models[0]),...Array(3).fill(models[1])],
  'one successful MiniMax retry must prevent a GLM call');
 requested=[];
 const thirdFetcher=async(url,opts)=>{
  const m=JSON.parse(opts.body);
  requested.push(m.model);
  if(m.model===models[2]){
   assert.equal(m.response_format.type,'json_object');
   assert.equal(m.reasoning_effort,'none','GLM uses measured low-latency mode');
   assert.equal(m.max_tokens,1200);
  }
  if(m.model===models[0])return new Response('{}',{status:429});
  if(m.model===models[1])return new Response('{}',{status:502});
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({explanation:longAnswer})}}]}),{status:200});
 };
 const third=await handleMentorApi(req(body),good,thirdFetcher,noDelay);
 assert.equal(third.status,200);
 const thirdData=await third.json();
 assert.equal(thirdData.source,'glm');
 assert.equal(thirdData.attempts,9);
 assert.equal(thirdData.modelAttempt,1);
 assert.deepEqual(requested,[...Array(4).fill(models[0]),...Array(4).fill(models[1]),models[2]],
  'GLM is only attempted after four failures of each preceding model');
 requested=[];
 const badModel=async(url,opts)=>{
  requested.push(JSON.parse(opts.body).model);
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({explanation:'Сыграй b1c3, это решит проблему.'})}}]}),{status:200});
 };
 const safe=await handleMentorApi(req(body),good,badModel,noDelay);
 assert.equal(safe.status,503);
 const fail=await safe.json();
 assert.equal(fail.error,'model_chain_failed');
 assert.equal(fail.attempts.length,12,'all three models must get initial plus 3 retries');
 assert.deepEqual(requested,[...Array(4).fill(models[0]),...Array(4).fill(models[1]),...Array(4).fill(models[2])]);
 assert.equal(fail.attempts[11].attempt,4);
 requested=[];
 const exhausted=await handleMentorApi(req(body),good,async(url,opts)=>{
  requested.push(JSON.parse(opts.body).model);
  return new Response('{}',{status:401});
 },noDelay);
 assert.equal(exhausted.status,503,'invalid API key cannot be fixed by swapping models');
 assert.equal((await exhausted.json()).reason,'broker_auth_or_balance');
 assert.deepEqual(requested,[models[0]],'credential failures must never retry or switch models');
 const health=await handleMentorApi(new Request('https://rpchess-mentor-api-preview.mobigametim.workers.dev/health'),{},fetcher);
 assert.equal(health.status,200);const healthData=await health.json();
 assert.equal(healthData.configured,false);
 assert.equal(healthData.model,'deepseek-ai/DeepSeek-V4-Flash-0731');
 // Regress Cloudflare module-handler calling convention: the third argument
 // supplied by Workers is ExecutionContext, not our injectable fetcher.
 const actualFetch=globalThis.fetch;
 try{
  globalThis.fetch=fetcher;
  const production=await (await imp('mentor-api/src/index.mjs')).default.fetch(req(body),good,{waitUntil(){}});
  assert.equal(production.status,200,'Cloudflare fetch(request,env,ctx) must work');
 }finally{globalThis.fetch=actualFetch;}
 assert.equal(calls,2,'broker requested only for two valid, authorized inference tests');

 // The benchmark is inaccessible without an ephemeral secret; one authorized
 // request sends only one model and never uses the production fallback chain.
 const secret='a'.repeat(64);
 let benchmarkCalls=0;
 const benchBody={model:'deepseek-ai/DeepSeek-V4-Flash-0731',variant:'fast',payload:body};
 const makeBench=token=>new Request('https://rpchess-mentor-api-preview.mobigametim.workers.dev/_internal/benchmark',{
  method:'POST',headers:{'content-type':'application/json',
   'X-Mentor-Benchmark-Token':token},
  body:JSON.stringify(benchBody)
 });
 const benchmarkEnv={...good,MENTOR_BENCHMARK_TOKEN:secret};
 const mockBench=async(url,opts)=>{
  benchmarkCalls++;
  assert.equal(JSON.parse(opts.body).reasoning_effort,'none');
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',
   message:{content:JSON.stringify({explanation:longAnswer})}}],
   usage:{prompt_tokens:120,completion_tokens:90}}),{status:200});
 };
 assert.equal((await handleMentorBenchmark(makeBench('invalid'),benchmarkEnv,mockBench)).status,404);
 assert.equal((await handleMentorBenchmark(makeBench(secret),good,mockBench)).status,404);
 assert.equal(benchmarkCalls,0,'unauthorized attempts never spend tokens');
 const benchmarkResp=await handleMentorBenchmark(makeBench(secret),benchmarkEnv,mockBench);
 assert.equal(benchmarkResp.status,200);
 const benchmarkData=await benchmarkResp.json();
 assert.equal(benchmarkData.ok,true,'one requested model returns valid chess explanation');
 assert.equal(benchmarkData.model,benchBody.model);
 assert.equal(benchmarkCalls,1,'no automatic fallthrough for benchmark');
 assert.equal(benchRequestConfig('zai-org/GLM-5.3-Flash','fast',promptForMentor(facts)).reasoning_effort,'none');
 assert.equal(benchRequestConfig('MiniMaxAI/MiniMax-M2.7','fast',promptForMentor(facts)).reasoning_effort,undefined);
 console.log('Mentor DeepSeek contract, API CORS, budgets, fallback & client: PASS');
})().catch(err=>{console.error(err.stack||err);process.exitCode=1;});
