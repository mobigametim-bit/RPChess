import {validateMentorInput,localMentorFallback} from './mentor-training-feedback-core.mjs';

const MENTOR_API='https://rpchess-mentor-api-preview.mobigametim.workers.dev';
const TIMEOUT_MS=11500;
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
async function requestMentorText({payload,verified,signal,fallbackText=null,fetcher=globalThis.fetch}){
 const fallback=typeof fallbackText==='string'&&fallbackText.length?fallbackText:localMentorFallback(verified);
 const controller=new AbortController();
 const onAbort=()=>controller.abort();
 signal?.addEventListener('abort',onAbort,{once:true});
 const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
 try{
  if(signal?.aborted)return fallback;
  const response=await fetcher(MENTOR_API+'/v1/explain',{
   method:'POST',mode:'cors',cache:'no-store',signal:controller.signal,
   headers:{'Content-Type':'application/json','X-Mentor-Session':mentorSession()},
   body:JSON.stringify(payload)
  });
  if(!response.ok)return fallback;
  const json=await response.json();
  if(!json||json.grade!==verified.grade||typeof json.explanation!=='string'||
   json.explanation.length>260||json.explanation.length<12)return fallback;
  if(json.source==='verified_fallback')return fallback;
  return json.explanation;
 }catch{return fallback;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
}
export {MENTOR_API,buildMentorPayload,requestMentorText};
