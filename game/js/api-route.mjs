/* Adaptive Tournament/Profile transport. Only chooses an endpoint BEFORE a request:
 * never retry a POST automatically (move/join/auth may have committed upstream).
 * Same Cloudflare data, tokens, rated matches and global queue on both paths.
 */
const GATEWAY='https://rpchess-ru-api-gateway.netlify.app';
const SETTING='rpchess.tournament.api-route.v1';
const SERVICES=Object.freeze({tournament:'/tournament',profile:'/profile'});
const CHOICES=['auto','direct','proxy'];
let selected=null;
export function routePreference(){
 try {
  const forced=new URLSearchParams(globalThis.location?.search||'').get('rpchess_api_route');
  if(CHOICES.includes(forced))return forced;
  const stored=globalThis.localStorage?.getItem(SETTING);
  return CHOICES.includes(stored)?stored:'auto';
 }catch{return 'auto';}
}
export function setRoutePreference(value){
 if(!CHOICES.includes(value))return false;
 try{globalThis.localStorage?.setItem(SETTING,value);selected=null;return true;}catch{return false;}
}
const production=()=>{
 const url=globalThis.location;
 if(url?.hostname==='mobigametim-bit.github.io'&&/^\/RPChess(?:\/|$)/.test(url?.pathname||''))return true;
 if(new URLSearchParams(url?.search||'').has('vk_app_id'))return true;
 try{return /(^|\.)vk\.(com|ru)$/i.test(new URL(globalThis.document?.referrer||url.href).hostname);}
 catch{return false;}
};
function timedFetch(url,{timeout=2800,fetcher=fetch}={}){
 const abort=new AbortController();
 const timer=setTimeout(()=>abort.abort(),timeout);
 return fetcher(url,{method:'GET',cache:'no-store',signal:abort.signal})
  .finally(()=>clearTimeout(timer));
}
export async function chooseRoute({preference='auto',enabled=true,fetcher=fetch,gateway=GATEWAY,
 profile='https://rpchess-profile-preview.mobigametim.workers.dev'}={}){
 if(!enabled)return 'direct';
 if(preference==='direct'||preference==='proxy')return preference;
 // Country endpoint is free of credentials; it is NOT used for authentication.
 try{
  const res=await timedFetch(gateway+'/geo',{fetcher,timeout:2400});
  if(res.ok){
   const result=await res.json();
   if(result?.country==='RU')return 'proxy';
   if(/^[A-Z]{2}$/.test(result?.country||''))return 'direct';
  }
 }catch{}
 // Unknown country: only probe a read-only health endpoint. Avoid repeating
 // non-idempotent POSTs on ambiguous network failure.
 try{
  const r=await timedFetch(profile+'/health',{fetcher,timeout:2800});
  if(r.ok)return 'direct';
 }catch{}
 return 'proxy';
}
export function chooseOnce(){
 if(!selected){
  const requested=routePreference();
  const enabled=production()||
   new URLSearchParams(globalThis.location?.search||'').has('rpchess_api_route');
  selected=chooseRoute({preference:requested,enabled});
 }
 return selected;
}
export async function apiBase(service,directUrl){
 const route=await chooseOnce();
 if(route!=='proxy'||!SERVICES[service])return directUrl;
 return GATEWAY+SERVICES[service];
}
export async function apiHealthHint(){
 return chooseOnce();
}
export {GATEWAY};
