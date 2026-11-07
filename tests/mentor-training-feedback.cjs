const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const base=path.resolve(__dirname,'..');
function imp(p){return import(pathToFileURL(path.join(base,p)).href);}
(async()=>{
 const {ClassicChessEngine}=await imp('game/js/classic-chess-engine.mjs');
 const {rebuildTraining}=await imp('game/js/mentor-training-history.mjs');
 const {validateMentorInput,promptForMentor,safeExplanation,localMentorFallback,describeMentorFact}=await imp('game/js/mentor-training-feedback-core.mjs');
 const {THINKING,PRAISE,thinkingText,praiseText,fallbackText}=await imp('game/js/mentor-training-copy.mjs');
 const {classifyStrongMove}=await imp('game/js/finished-game-review.mjs');
 const {buildMentorPayload,requestMentorText}=await imp('game/js/mentor-training-feedback-client.mjs');
 const {tacticalEvidence,MAX_PV}=await imp('game/js/mentor-training-tactics.mjs');
 const {handleMentorApi,validOrigin,MAX_ATTEMPTS_PER_MODEL}=await imp('mentor-api/src/index.mjs');
 assert.equal(MAX_ATTEMPTS_PER_MODEL,4,'initial request plus 3 retries');
 const {handleMentorBenchmark,benchRequestConfig}=await imp('mentor-api/src/benchmark.mjs');
 const beforeFen=rebuildTraining(['f2f3','e7e5'],2).fen();
 const chess=new ClassicChessEngine(beforeFen);
 assert(chess.move('g2','g4').ok);
 const afterFen=chess.fen();
 const body={version:1,language:'ru',beforeFen,afterFen,uci:'g2g4',grade:'blunder',
  before:{cp:90,depth:11,bestMove:'b1c3',pv:['b1c3','b8c6']},
  after:{cp:200,depth:10,pv:['d8h4']}};
 const facts=validateMentorInput(body);
 assert.equal(facts.motive,'checkmate');
 assert.equal(facts.loss,290);
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
 const mate=tacticalEvidence(afterFen,['d8h4'],'w');
 assert.deepEqual(mate.line,['d8h4']);
 assert(mate.events.some(e=>e.kind==='mate_sequence'));
 const fork=tacticalEvidence('4k3/8/8/8/1n6/8/8/Q3K3 b - - 0 1',['b4c2'],'w');
 assert(fork.events.some(e=>e.kind==='fork'),'the knight move forks king and queen');
 const pin=tacticalEvidence('k6r/8/8/8/8/8/4B3/4K3 b - - 0 1',['h8e8'],'w');
 assert(pin.events.some(e=>e.kind==='pin'),'rook newly pins bishop to king');
 const material=tacticalEvidence('r3k3/8/8/8/8/8/8/R3K3 b - - 0 1',['a8a1'],'w');
 assert(material.events.some(e=>e.kind==='material_loss'&&e.net===5));
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
