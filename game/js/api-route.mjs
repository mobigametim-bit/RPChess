/* RPChess API transport. Profile and Tournament independently choose
 * direct Cloudflare or the Yandex HTTP proxy, but always reach the SAME
 * authoritative Workers. Never replay a POST/PUT after an ambiguous failure.
 */
const YANDEX='https://d5ds3hf0ei1mlkgjrnlm.d8epmcec.apigw.yandexcloud.net';
const DIRECT=Object.freeze({
 profile:'https://rpchess-profile-preview.mobigametim.workers.dev',
 tournament:'https://rpchess-tournament-profile-preview.mobigametim.workers.dev'
});
const PREF_KEY='rpchess.yandex-api-route.v1';
const MODES=['auto','direct','yandex'];
const routePromises=new Map();
function browserEnabled() {
 try {
  const location=globalThis.location;
  if(!location)return false;
  const force=new URLSearchParams(location.search).get('rpchess_api_route');
  if(MODES.includes(force))return true;
  if(location.hostname==='mobigametim-bit.github.io'&&/^\/RPChess(?:\/|$)/.test(location.pathname))return true;
  // Accepted staging host for manual Russian/overseas acceptance; it already
  // appears in both canonical Workers' CORS origin allowlists.
  if(location.hostname==='rpchess-profile-game-preview.mobigametim.workers.dev')return true;
  if(/^(?:(?:stage|prod)-)?app54754579(?:-[a-z0-9]+)?\.pages\.vk-apps\.(ru|com)$/i.test(location.hostname))return true;
  if(new URLSearchParams(location.search).has('vk_app_id'))return true;
  return false;
 }catch{return false;}
}
export function routePreference(service='profile'){
 try {
  const query=new URLSearchParams(globalThis.location?.search||'');
  const scoped=query.get('rpchess_'+service+'_route');
  if(MODES.includes(scoped))return scoped;
  const forced=query.get('rpchess_api_route');
  if(MODES.includes(forced))return forced;
  const stored=globalThis.localStorage?.getItem(PREF_KEY);
  return MODES.includes(stored)?stored:'auto';
 }catch{return 'auto';}
}
export function setRoutePreference(mode){
 if(!MODES.includes(mode))return false;
 try{globalThis.localStorage?.setItem(PREF_KEY,mode);routePromises.clear();return true;}
 catch{return false;}
}
// Both checks are safe GET requests. /v1/session intentionally answers with
// an auth/method error, proving real HTTP routing rather than a dummy /ping.
async function responsive(fetcher,base,timeoutMs){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const opts={method:'GET',cache:'no-store',signal:controller.signal};
  // Run safe checks concurrently so the fallback doesn't add another full
  // gateway round trip to the player's login or matchmaking startup.
  // Non-simple headers make browsers verify Authorization/Content-Type CORS
  // without creating sessions or mutating the public queue.
  const [health,route]=await Promise.all([
   fetcher(base+'/health',opts),
   fetcher(base+'/v1/session',{...opts,
    headers:{'Content-Type':'application/json','Authorization':'Bearer rpchess-route-probe'}})
  ]);
  if(!health?.ok||!(await health.json())?.ok)return false;
  // Exact known Workers: Profile responds 404, Tournament responds 405.
  // A 403 (forbidden origin), 502, 503 or redirect is never healthy.
  return [404,405].includes(route?.status);
 }catch{return false;}finally{clearTimeout(timer);}
}
export async function chooseRoute({service='profile',preference='auto',enabled=true,
  fetcher=globalThis.fetch,timeoutMs=3500,direct=DIRECT,yandex=YANDEX}={}){
 if(!Object.prototype.hasOwnProperty.call(direct,service))throw Error('Unknown game API: '+service);
 if(!enabled)return 'direct';
 if(preference==='direct'||preference==='yandex')return preference;
 if(await responsive(fetcher,direct[service],timeoutMs))return 'direct';
 // The Yandex dummy ping alone doesn't prove its HTTP integration works.
 // A transient upstream 502 must not be mistaken for a healthy fallback.
 if(await responsive(fetcher,yandex+'/'+service,timeoutMs))return 'yandex';
 throw Error(globalThis.document?.documentElement?.lang==='ru'
  ?(service==='profile'
    ?'Сервер профиля игры недоступен. Проверьте соединение и повторите попытку.'
    :'Сервер Турнира недоступен. Проверьте соединение и повторите попытку.')
  :'Game '+service+' API is unreachable via Cloudflare and Yandex');
}
export function chosenRoute(service='profile'){
 if(!Object.prototype.hasOwnProperty.call(DIRECT,service))return Promise.reject(Error('Unknown RPChess API: '+service));
 if(!routePromises.has(service)){
  const pending=chooseRoute({service,preference:routePreference(service),enabled:browserEnabled()});
  routePromises.set(service,pending);
  // A failed pre-mutation probe is retriable on the NEXT user action; a
  // successful decision is sticky so no ambiguous POST switches backends.
  pending.catch(()=>{if(routePromises.get(service)===pending)routePromises.delete(service);});
 }
 return routePromises.get(service);
}
// Only forget a transport decision after a confirmed network failure (not an
// authorization failure). An explicit subsequent player action can then test
// both routes again. Never replay an ambiguous POST automatically.
export function invalidateRoute(service){
 if(!Object.prototype.hasOwnProperty.call(DIRECT,service))return false;
 routePromises.delete(service);
 return true;
}
export async function apiBase(service,directUrl){
 // Other preview Workers are independent environments. Never redirect their
 // tokens, rating receipts or Durable Object traffic to this public backend.
 if(!Object.prototype.hasOwnProperty.call(DIRECT,service)||directUrl!==DIRECT[service])
  return directUrl;
 return await chosenRoute(service)==='yandex'?YANDEX+'/'+service:directUrl;
}
export {YANDEX,DIRECT};
