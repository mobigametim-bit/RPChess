const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const base=path.resolve(__dirname,'..');
function imp(p){return import(pathToFileURL(path.join(base,p)).href);}
(async()=>{
 const {ClassicChessEngine}=await imp('game/js/classic-chess-engine.mjs');
 const {rebuildTraining}=await imp('game/js/mentor-training-history.mjs');
 const {validateMentorInput,promptForMentor,safeExplanation,localMentorFallback}=await imp('game/js/mentor-training-feedback-core.mjs');
 const {buildMentorPayload,requestMentorText}=await imp('game/js/mentor-training-feedback-client.mjs');
 const {handleMentorApi,validOrigin}=await imp('mentor-api/src/index.mjs');
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
  assert(!JSON.stringify(sent).includes('b1c3'),'upstream must not see best move');
  assert.match(url,/\/chat\/completions$/);
  assert.equal(opts.headers.Authorization,'Bearer test-key');
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({explanation:'Этот ход открыл дорогу к немедленному мату. Найди, какую угрозу упустил.'})}}]}),{status:200,headers:{'content-type':'application/json'}});
 };
 const good={GONKA_API_KEY:'test-key',MENTOR_ACTOR_LIMIT:{limit:async()=>({success:true})},MENTOR_GLOBAL_LIMIT:{limit:async()=>({success:true})}};
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
 assert.equal(client,result.explanation);
 const fallback=await requestMentorText({payload:built.payload,verified:built.verified,fetcher:async()=>new Response('{}',{status:503})});
 assert.equal(fallback,localMentorFallback(facts));
 assert.equal((await handleMentorApi(req(body,'https://fake.example'),good,fetcher)).status,403);
 assert.equal((await handleMentorApi(req({...body,grade:'mistake'}),good,fetcher)).status,422);
 assert.equal((await handleMentorApi(req(body),{...good,GONKA_API_KEY:''},fetcher)).status,503);
 assert.equal((await handleMentorApi(req(body),{...good,MENTOR_GLOBAL_LIMIT:{limit:async()=>({success:false})}},fetcher)).status,429);
 assert.equal((await handleMentorApi(req(body),{GONKA_API_KEY:'test-key'},fetcher)).status,503);
 const badModel=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({explanation:'Сыграй b1c3, это решит проблему.'})}}]}),{status:200});
 const safe=await handleMentorApi(req(body),good,badModel);
 assert.equal(safe.status,200);
 assert.equal((await safe.json()).source,'verified_fallback');
 const health=await handleMentorApi(new Request('https://rpchess-mentor-api-preview.mobigametim.workers.dev/health'),{},fetcher);
 assert.equal(health.status,200);assert.equal((await health.json()).configured,false);
 assert.equal(calls,1,'never call broker for forbidden requests');
 console.log('Mentor DeepSeek contract, API CORS, budgets, fallback & client: PASS');
})().catch(err=>{console.error(err.stack||err);process.exitCode=1;});
