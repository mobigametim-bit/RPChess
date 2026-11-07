/* API-only Worker for Mentor Training. NO game saves, D1, VK or Tournament code.
 * Exposes only /health and /v1/explain. Broker key must be a Cloudflare secret.
 * Rate limits are approximate by Cloudflare PoP; never pretend they're a strict billing cap.
 */
import { validateMentorInput, promptForMentor, safeExplanation, localMentorFallback } from '../../game/js/mentor-training-feedback-core.mjs';
import {handleMentorBenchmark,benchRequestConfig} from './benchmark.mjs';
import {validatedV2Facts,promptForMentorV2,safeMentorAdvice,composeMentorV2Explanation} from '../../game/js/mentor-training-feedback-v2.mjs';

const DEFAULT_BROKER_BASE='https://hskyauefqcgbvgvxkluj.supabase.co/functions/v1/gonka';
// Bounded sequential failover, always preferring the requested DeepSeek model.
// Up to three RETRIES after the initial call, then the next model. Rate limiting occurs first.
const MODELS=Object.freeze([
 {id:'deepseek-ai/DeepSeek-V4-Flash-0731',source:'deepseek',timeout:15000,variant:'optimized'},
 {id:'MiniMaxAI/MiniMax-M2.7',source:'minimax',timeout:18000,variant:'balanced'},
 {id:'zai-org/GLM-5.3-Flash',source:'glm',timeout:20000,variant:'optimized'}
]);
const MAX_ATTEMPTS_PER_MODEL=4; // Initial + 3 automatic retries per model, 12 max total.
const RETRY_DELAYS_MS=[250,500,1000];
const waitForRetry=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const TRUSTED=new Set([
 'https://rpchess-mentor-training-preview.mobigametim.workers.dev',
 'https://rpchess-profile-game-preview.mobigametim.workers.dev',
 'https://mobigametim-bit.github.io',
 'http://127.0.0.1:4173','http://localhost:4173'
]);
function validOrigin(origin){
 if(!origin||typeof origin!=='string')return false;
 if(TRUSTED.has(origin))return true;
 try{
  const u=new URL(origin);
  return u.protocol==='https:' && u.pathname==='/' &&
   /^(?:(?:stage|prod)-)?app54754579(?:-[a-z0-9]+)?\.pages\.vk-apps\.(?:ru|com)$/i.test(u.hostname);
 }catch{return false;}
}
function cors(origin){
 return {
  'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, X-Mentor-Session',
  'Access-Control-Max-Age':'600','Vary':'Origin'
 };
}
function reply(body,status,origin){
 return new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
   ...(origin&&validOrigin(origin)?cors(origin):{})}
 });
}
async function handleMentorApi(request,env,fetcher=fetch,sleep=waitForRetry,contractVersion=1){
 const isV2=contractVersion===2;
 const url=new URL(request.url),origin=request.headers.get('Origin')||'';
 if(url.pathname==='/health'&&request.method==='GET')
  return reply({ok:true,configured:Boolean(env.GONKA_API_KEY),modelConfigured:true,
   model:MODELS[0].id,fallbackModels:MODELS.slice(1).map(m=>m.id),
   contractVersion:isV2?2:1,
   attemptsPerModel:MAX_ATTEMPTS_PER_MODEL,maxProviderCalls:MODELS.length*MAX_ATTEMPTS_PER_MODEL},200,origin);
 if(url.pathname!==(isV2?'/v2/explain':'/v1/explain'))return reply({error:'not_found'},404,origin);
 if(!validOrigin(origin))return reply({error:'forbidden_origin'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
 if(request.method!=='POST')return reply({error:'method_not_allowed'},405,origin);
 // Never run a paid upstream request when no rate-limiting binding is installed.
 if(!env.MENTOR_GLOBAL_LIMIT?.limit||!env.MENTOR_ACTOR_LIMIT?.limit)
  return reply({error:'limit_unconfigured'},503,origin);
 if(!env.GONKA_API_KEY)return reply({error:'broker_unconfigured'},503,origin);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))
  return reply({error:'content_type'},415,origin);
 if(Number(request.headers.get('Content-Length')||0)>4096)return reply({error:'too_large'},413,origin);
 let json;
 try{
  const raw=await request.text();
  if(raw.length>4096)throw Error('oversized');
  json=JSON.parse(raw);
 }catch{return reply({error:'invalid_json'},400,origin);}
 let data;
 try{data=isV2?validatedV2Facts(json):validateMentorInput(json);}
 catch{return reply({error:'invalid_analysis'},422,origin);}
 // A visitor ID is client-generated, not authentication; global budget protects
 // against unlimited visitor-ID rotation. Limit binding is approximate per PoP.
 const visitor=request.headers.get('X-Mentor-Session')||'';
 const actor=/^[a-f0-9-]{20,60}$/i.test(visitor)?visitor:'anonymous';
 try{
  const [global,personal]=await Promise.all([
   env.MENTOR_GLOBAL_LIMIT.limit({key:'mentor:all'}),
   env.MENTOR_ACTOR_LIMIT.limit({key:'mentor:'+actor})
  ]);
  if(!global.success||!personal.success)return reply({error:'rate_limited'},429,origin);
 }catch{return reply({error:'limit_unavailable'},503,origin);}
 const settings=isV2?promptForMentorV2(data):promptForMentor(data);
 const base=String(env.GONKA_BASE_URL||DEFAULT_BROKER_BASE).replace(/\/+$/,'');
 let endpoint;
 try{endpoint=new URL(base+'/chat/completions');}
 catch{return reply({error:'broker_config'},503,origin);}
 if(endpoint.protocol!=='https:'||
    (endpoint.origin!=='https://hskyauefqcgbvgvxkluj.supabase.co'&&
     endpoint.origin!=='https://gonka-api.org'))
  return reply({error:'broker_config'},503,origin);
 const attempts=[];
 let stoppedForCredentials=false;
 for(const selected of MODELS){
  for(let tryNo=1;tryNo<=MAX_ATTEMPTS_PER_MODEL;tryNo++){
   // Stop paid retries if the caller has already left the page.
   if(request.signal?.aborted)
    return reply({error:'client_cancelled'},499,origin);
   const controller=new AbortController();
   const onClientAbort=()=>controller.abort();
   request.signal?.addEventListener('abort',onClientAbort,{once:true});
   const timer=setTimeout(()=>controller.abort(),selected.timeout);
   let problem='broker_network',fatal=false;
   try{
    const response=await fetcher(endpoint.toString(),{
     method:'POST',signal:controller.signal,
     headers:{Authorization:'Bearer '+env.GONKA_API_KEY,'Content-Type':'application/json'},
     // Same shape used by the successful real-Gonka benchmark.
     body:JSON.stringify((()=>{
      const config=benchRequestConfig(selected.id,selected.variant,settings);
      // The deployed v1 schema remains untouched. The isolated v2 schema
      // accepts only general teaching advice; all concrete facts are code.
      if(isV2&&config.response_format?.type==='json_schema')
       config.response_format={type:'json_schema',json_schema:{
        name:'mentor_general_advice',strict:true,
        schema:{type:'object',properties:{advice:{type:'string'}},
         required:['advice'],additionalProperties:false}
       }};
      return config;
     })())
    });
    if(!response.ok){
     // Auth/payment problems cannot be fixed by repeating a billable request.
     fatal=[401,402,403].includes(response.status);
     problem=fatal?'broker_auth_or_balance':response.status===429?'broker_busy':
      response.status>=400&&response.status<500?'broker_http_'+response.status:'broker_unavailable';
    }else{
     let payload;
     try{
      const raw=await response.text();
      if(raw.length<=5000)payload=JSON.parse(raw);
     }catch{}
     const content=payload?.choices?.[0]?.message?.content;
     if(typeof content==='string'&&content.length<=5000){
      let parsed;
      try{parsed=JSON.parse(content);}catch{}
      const advice=isV2?safeMentorAdvice(parsed?.advice,data):null;
      const output=isV2?composeMentorV2Explanation(advice,data):
       safeExplanation(parsed?.explanation,data);
      if(output){
       return reply({explanation:output,grade:data.grade,
        ...(isV2?{contractVersion:2,factId:data.factId,
         verifiedFact:data.verifiedFact,advice}:{}),
        source:selected.source,model:selected.id,
        attempts:attempts.length+1,modelAttempt:tryNo,failures:attempts},200,origin);
      }
     }
     problem='broker_invalid';
    }
   }catch{
    problem=controller.signal.aborted?'broker_timeout':'broker_network';
   }finally{
    clearTimeout(timer);
    request.signal?.removeEventListener('abort',onClientAbort);
   }
   if(request.signal?.aborted)
    return reply({error:'client_cancelled'},499,origin);
   // No raw provider text, FEN, tokens, secrets or user prompt in diagnostics.
   attempts.push({model:selected.id,attempt:tryNo,reason:problem});
   if(fatal){
    stoppedForCredentials=true;
    break;
   }
   if(tryNo<MAX_ATTEMPTS_PER_MODEL)
    await sleep(RETRY_DELAYS_MS[tryNo-1]);
  }
  if(stoppedForCredentials)break;
 }
 // The browser displays its localized, grade-specific fallback and offers a manual retry.
 // Unlike a 200 response, a 503 must never be cached as successful AI feedback.
 return reply({error:'model_chain_failed',
  attempts,reason:attempts[attempts.length-1]?.reason||'broker_unavailable'},503,origin);
}
/* Cloudflare's third fetch argument is ExecutionContext, not a fetch function.
 * Adapt explicitly so the mockable helper never mistakes ctx for fetcher. */
export default {fetch(request,env){
 // Isolated temporary benchmark only exists when one-time secret is set.
 if(new URL(request.url).pathname==='/_internal/benchmark')
  return handleMentorBenchmark(request,env,globalThis.fetch);
 return handleMentorApi(request,env,globalThis.fetch);
}};
export {handleMentorApi,validOrigin,reply,MAX_ATTEMPTS_PER_MODEL};
