/* Temporary authenticated benchmark endpoint.
 * One request -> at most ONE Gonka model call, never fail over.
 * No user positions or keys in logs. Explicitly disabled without a short-lived
 * secret provisioned in one GitHub Actions job and deleted after the test.
 */
import {validateMentorInput,promptForMentor,safeExplanation} from '../../game/js/mentor-training-feedback-core.mjs';
export const BENCH_MODELS=[
 'deepseek-ai/DeepSeek-V4-Flash-0731',
 'MiniMaxAI/MiniMax-M2.7',
 'zai-org/GLM-5.3-Flash'
];
const SCHEMA={type:'json_schema',json_schema:{name:'mentor_explanation',strict:true,
 schema:{type:'object',properties:{explanation:{type:'string'}},
 required:['explanation'],additionalProperties:false}}};
function json(data,status=200){return new Response(JSON.stringify(data),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});}
function validToken(given,expected){
 if(typeof given!=='string'||typeof expected!=='string'||given.length<32||expected.length<32||
  given.length!==expected.length)return false;
 let diff=0;
 for(let i=0;i<given.length;i++)diff|=given.charCodeAt(i)^expected.charCodeAt(i);
 return diff===0;
}
export function benchRequestConfig(model,variant,settings){
 const base={model,messages:[{role:'system',content:settings.system},
  {role:'user',content:settings.user}],temperature:0.2,max_tokens:900,
  stream:false,response_format:{type:'json_object'}};
 if(variant==='fast'){
  if(!model.startsWith('MiniMaxAI/'))base.reasoning_effort='none';
 }
 if(variant==='schema'){
  // GLM json_schema often incurs costly default thinking; prefer JSON mode.
  if(!model.startsWith('zai-org/'))base.response_format=SCHEMA;
  if(!model.startsWith('MiniMaxAI/'))base.reasoning_effort='none';
 }
 if(variant==='optimized'){
  base.max_tokens=model.startsWith('deepseek-ai/')?1000:1200;
  if(model.startsWith('deepseek-ai/')){base.response_format=SCHEMA;base.reasoning_effort='none';}
  if(model.startsWith('zai-org/'))base.reasoning_effort='none';
 }
 if(variant==='larger'){
  base.max_tokens=1600;
  if(!model.startsWith('MiniMaxAI/'))base.reasoning_effort='none';
 }
 return base;
}
function classifyInvalid(content,parsed,data,finish){
 if(!content)return finish==='length'?'thinking_exhausted':'empty_content';
 if(typeof content!=='string')return 'missing_content';
 if(content.length>5000)return 'oversize_content';
 if(!parsed)return 'invalid_json';
 if(typeof parsed.explanation!=='string')return 'missing_explanation';
 const x=parsed.explanation.trim();
 if(x.length>500)return 'too_long';
 if(x.length<12)return 'too_short';
 if(!/[.!?]$/.test(x))return 'unterminated';
 const sentences=(x.match(/[.!?](?=\s|$)/g)||[]).length;
 if(sentences<2||sentences>5)return 'sentence_count';
 if(!safeExplanation(x,data))return 'unsafe_or_vague';
 return 'ok';
}
export async function handleMentorBenchmark(request,env,fetcher=fetch){
 if(request.method!=='POST')return json({error:'method'},405);
 if(!env.MENTOR_BENCHMARK_TOKEN||
  !validToken(request.headers.get('X-Mentor-Benchmark-Token'),env.MENTOR_BENCHMARK_TOKEN))
  return json({error:'not_found'},404);
 if(!env.GONKA_API_KEY)return json({error:'broker_unconfigured'},503);
 if(Number(request.headers.get('content-length')||0)>4500)return json({error:'payload_too_big'},413);
 let body,data;
 try{
  const raw=await request.text();
  if(raw.length>4500)throw Error('big');
  body=JSON.parse(raw);
  if(!BENCH_MODELS.includes(body?.model)||!['baseline','fast','schema','optimized','larger'].includes(body?.variant))
   throw Error('invalid settings');
  data=validateMentorInput(body.payload);
 }catch{return json({error:'bad_request'},400);}
 // Guard against accidental burst / re-use of the benchmark secret.
 if(!env.MENTOR_GLOBAL_LIMIT?.limit)return json({error:'no_rate_guard'},503);
 try{
  const result=await env.MENTOR_GLOBAL_LIMIT.limit({key:'mentor:benchmark'});
  if(!result.success)return json({error:'benchmark_rate_limited'},429);
 }catch{return json({error:'no_rate_guard'},503);}
 const base=String(env.GONKA_BASE_URL||
  'https://hskyauefqcgbvgvxkluj.supabase.co/functions/v1/gonka').replace(/\/+$/,'');
 let endpoint;
 try{endpoint=new URL(base+'/chat/completions');}
 catch{return json({error:'invalid_broker'},503);}
 if(endpoint.origin!=='https://hskyauefqcgbvgvxkluj.supabase.co')
  return json({error:'invalid_broker'},503);
 const model=body.model,variant=body.variant,started=Date.now();
 const settings=promptForMentor(data);
 const controller=new AbortController();
 // Same time windows as the production chain in the baseline/fast variants.
 const timeout=variant==='optimized'?(model.startsWith('deepseek-ai/')?15000:model.startsWith('MiniMaxAI/')?18000:20000):model.startsWith('deepseek-ai/')?15000:10000;
 const timer=setTimeout(()=>controller.abort(),timeout);
 let output={model,variant,ok:false,reason:'unknown',httpStatus:null,
  elapsedMs:null,finishReason:null,completionTokens:null,
  promptTokens:null,reasoningChars:0,explanation:null};
 try{
  const response=await fetcher(endpoint.href,{
   method:'POST',signal:controller.signal,
   headers:{Authorization:'Bearer '+env.GONKA_API_KEY,'content-type':'application/json'},
   body:JSON.stringify(benchRequestConfig(model,variant,settings))
  });
  output.httpStatus=response.status;
  if(response.ok){
   let parsedBody;
   try{
    const raw=await response.text();
    if(raw.length<=12000)parsedBody=JSON.parse(raw);
   }catch{}
   const first=parsedBody?.choices?.[0];
   const content=first?.message?.content;
   output.finishReason=first?.finish_reason??null;
   output.completionTokens=parsedBody?.usage?.completion_tokens??null;
   output.promptTokens=parsedBody?.usage?.prompt_tokens??null;
   output.reasoningChars=first?.message?.reasoning?.length||0;
   let explanation=null;
   try{explanation=JSON.parse(content)?.explanation;}catch{}
   output.reason=classifyInvalid(content,typeof explanation==='string'?{explanation}:null,
    data,output.finishReason);
   if(output.reason==='ok'){
    output.ok=true;
    output.explanation=explanation;
   }
  }else{
   output.reason=[401,402,403].includes(response.status)?'auth_or_balance':
    response.status===429?'broker_429':response.status>=500?'broker_5xx':'broker_4xx';
  }
 }catch{
  output.reason=controller.signal.aborted?'timeout':'network_error';
 }finally{clearTimeout(timer);}
 output.elapsedMs=Date.now()-started;
 return json(output);
}
