import {validateMentorInput,localMentorFallback,safeExplanation} from './mentor-training-feedback-core.mjs?v=20261107-mentor-auto-pause-v3';
import {validatedV2Facts,composeMentorV2Explanation,localMentorV2Fallback} from './mentor-training-feedback-v2.mjs?v=20261107-mentor-stage6-v3';

const MENTOR_API='https://rpchess-mentor-api-preview.mobigametim.workers.dev';
const TIMEOUT_MS=230000; // Max four attempts/model: (15 + 18 + 20)*4s + retry delays + network overhead.
function mentorSession(){
 try{
  let id=sessionStorage.getItem('rpchess.mentor-session.v1');
  if(!/^[a-f0-9-]{20,60}$/i.test(id||'')){
   id=globalThis.crypto?.randomUUID?.()||'';
   if(id)sessionStorage.setItem('rpchess.mentor-session.v1',id);
  }
  return id;
 }catch{return '';}
}
function buildMentorPayload({beforeFen,afterFen,uci,grade,before,after,continuation,language}){
 const payload={
  version:1,language:language==='en'?'en':'ru',uci,grade,beforeFen,afterFen,
  before:{cp:before?.cp,depth:before?.depth,bestMove:before?.bestMove},
  after:{cp:after?.cp,depth:after?.depth,pv:Array.isArray(after?.pv)?after.pv.slice(0,4):[]},
  ...(continuation&&Array.isArray(continuation.pv)&&continuation.pv.length?{
   continuation:{depth:continuation.depth,pv:continuation.pv.slice(0,20)}
  }:{})
 };
 // Validate locally too, so the game never sends arbitrary positions to a paid API.
 let verified;
 try{verified=validateMentorInput(payload);}
 catch(error){
  // Deep search can produce an incomplete or invalid PV at timeout.
  // Never discard a valid short explanation just because the long PV failed.
  if(!payload.continuation)throw error;
  delete payload.continuation;
  verified=validateMentorInput(payload);
 }
 return {payload,verified};
}
function mentorFallback(fallback,reason='broker_unavailable',attempts=[]){
 return {explanation:fallback,source:'fallback',model:null,reason,attempts,retryable:true};
}
async function requestMentorText({payload,verified,signal,fallbackText=null,fetcher=globalThis.fetch}){
 const fallback=typeof fallbackText==='string'&&fallbackText.length?fallbackText:localMentorFallback(verified);
 const controller=new AbortController();
 const onAbort=()=>controller.abort();
 signal?.addEventListener('abort',onAbort,{once:true});
 const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
 try{
  if(signal?.aborted)return { ...mentorFallback(fallback,'aborted'),retryable:false };
  const response=await fetcher(MENTOR_API+'/v1/explain',{
   method:'POST',mode:'cors',cache:'no-store',signal:controller.signal,
   headers:{'Content-Type':'application/json','X-Mentor-Session':mentorSession()},
   body:JSON.stringify(payload)
  });
  let json;
  try{json=await response.json();}catch{return mentorFallback(fallback,'invalid_json');}
  if(!response.ok)
   return mentorFallback(fallback,json?.reason||json?.error||'broker_http_'+response.status,
    Array.isArray(json?.attempts)?json.attempts.slice(0,12):[]);
  if(!json||json.grade!==verified.grade||typeof json.explanation!=='string'||
    json.explanation.length>500||json.explanation.length<12)
   return mentorFallback(fallback,'invalid_response');
  const supported={deepseek:'deepseek-ai/DeepSeek-V4-Flash-0731',
   minimax:'MiniMaxAI/MiniMax-M2.7',glm:'zai-org/GLM-5.3-Flash'};
  if(!supported[json.source]||json.model&&json.model!==supported[json.source])
   return mentorFallback(fallback,'invalid_source');
  // Independently reject invented squares/exchanges even if the remote Worker
  // has not yet been redeployed with the stricter shared checker.
  const explanation=safeExplanation(json.explanation,verified);
  if(!explanation)return mentorFallback(localMentorFallback(verified),'unverified_explanation');
  return {explanation,source:json.source,
   model:supported[json.source],reason:null,attempts:json.attempts||1,
   modelAttempt:json.modelAttempt||1,
   failures:Array.isArray(json.failures)?json.failures.slice(0,11):[],retryable:false};
 }catch{
  return mentorFallback(fallback,controller.signal.aborted?'broker_timeout':'network_error');
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
}


/* Separate v2 endpoint: NEVER post a v2 grade to the live v1 validator.
 * No automatic downgrade to v1, which would return an incompatible answer.
 * DeepSeek only receives a verified fact and general pedagogy after the
 * learner has solved or explicitly revealed the threat.
 */
const MENTOR_API_V2='https://rpchess-mentor-api-v2-preview.mobigametim.workers.dev';
function scoreV2(score,needBest=false){
 return {
  cp:score?.cp,depth:score?.depth,
  ...(needBest?{bestMove:score?.bestMove}:{}),
  ...(Number.isInteger(score?.mate)?{mate:score.mate}:{})
 };
}
function buildMentorV2Payload({
 beforeFen,afterFen,uci,grade,before,after,continuation,language,verifiedThreat
}){
 const payload={
  version:2,language:language==='en'?'en':'ru',beforeFen,afterFen,uci,grade,
  before:scoreV2(before,true),
  after:{...scoreV2(after,true),pv:Array.isArray(after?.pv)?after.pv.slice(0,MAX_PV_V2):[]},
  continuation:{...scoreV2(continuation,true),
   pv:Array.isArray(continuation?.pv)?continuation.pv.slice(0,MAX_PV_V2):[],
   ...(typeof continuation?.secondMove==='string'&&
       Number.isInteger(continuation?.secondCp)&&
       Number.isInteger(continuation?.secondDepth)?{
     secondMove:continuation.secondMove,secondCp:continuation.secondCp,
     secondDepth:continuation.secondDepth
   }:{})},
  verifiedThreat:{kind:verifiedThreat?.kind,uci:verifiedThreat?.uci,basis:verifiedThreat?.basis}
 };
 const verified=validatedV2Facts(payload);
 return {payload,verified};
}
const MAX_PV_V2=20;
async function requestMentorV2Text({payload,verified,signal,fetcher=globalThis.fetch}){
 const fallback=localMentorV2Fallback(verified);
 const controller=new AbortController(),onAbort=()=>controller.abort();
 signal?.addEventListener('abort',onAbort,{once:true});
 const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
 try{
  if(signal?.aborted)return {...mentorFallback(fallback,'aborted'),retryable:false};
  const response=await fetcher(MENTOR_API_V2+'/v2/explain',{
   method:'POST',mode:'cors',cache:'no-store',signal:controller.signal,
   headers:{'Content-Type':'application/json','X-Mentor-Session':mentorSession()},
   body:JSON.stringify(payload)
  });
  let json;
  try{json=await response.json();}catch{return mentorFallback(fallback,'invalid_json');}
  if(!response.ok)return mentorFallback(fallback,json?.reason||json?.error||'broker_http_'+response.status,
    Array.isArray(json?.attempts)?json.attempts.slice(0,12):[]);
  if(json?.contractVersion!==2||json?.grade!==verified.grade||
     json?.verifiedFact!==verified.verifiedFact||json?.factId!==verified.factId)
    return mentorFallback(fallback,'invalid_fact_contract');
  const explanation=composeMentorV2Explanation(json.advice,verified);
  if(!explanation||json.explanation!==explanation)return mentorFallback(fallback,'unverified_explanation');
  const supported={deepseek:'deepseek-ai/DeepSeek-V4-Flash-0731',
   minimax:'MiniMaxAI/MiniMax-M2.7',glm:'zai-org/GLM-5.3-Flash'};
  if(!supported[json.source]||(json.model&&json.model!==supported[json.source]))
   return mentorFallback(fallback,'invalid_source');
  return {explanation,source:json.source,model:supported[json.source],
   reason:null,attempts:json.attempts||1,modelAttempt:json.modelAttempt||1,
   failures:Array.isArray(json.failures)?json.failures.slice(0,11):[],retryable:false};
 }catch{
  return mentorFallback(fallback,controller.signal.aborted?'broker_timeout':'network_error');
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
}

export {MENTOR_API,buildMentorPayload,requestMentorText,
 MENTOR_API_V2,buildMentorV2Payload,requestMentorV2Text};

