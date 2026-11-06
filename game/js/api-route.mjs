/* RPChess transport selector. Yandex is strictly an API gateway:
 * game JS, art and saves remain at their existing hosts/workers.
 * Choose once BEFORE the first API mutation. Never replay a POST/PUT on error.
 */
const YANDEX='https://d5ds3hf0ei1mlkgjrnlm.d8epmcec.apigw.yandexcloud.net';
const DIRECT=Object.freeze({
 profile:'https://rpchess-profile-preview.mobigametim.workers.dev',
 tournament:'https://rpchess-tournament-profile-preview.mobigametim.workers.dev'
});
const PREF_KEY='rpchess.yandex-api-route.v1';
const MODES=['auto','direct','yandex'];
let routePromise=null;
function browserEnabled() {
 try {
  const location=globalThis.location;
  if(!location)return false;
  const force=new URLSearchParams(location.search).get('rpchess_api_route');
  if(MODES.includes(force))return true;
  if(location.hostname==='mobigametim-bit.github.io'&&/^\/RPChess(?:\/|$)/.test(location.pathname))return true;
  // VK Mini App hosts are app-specific and HTTPS.
  if(/^app54754579(?:-[a-z0-9]+)?\.pages\.vk-apps\.(ru|com)$/i.test(location.hostname))return true;
  if(new URLSearchParams(location.search).has('vk_app_id'))return true;
  return false;
 }catch{return false;}
}
export function routePreference(){
 try {
  const forced=new URLSearchParams(globalThis.location?.search||'').get('rpchess_api_route');
  if(MODES.includes(forced))return forced;
  const stored=globalThis.localStorage?.getItem(PREF_KEY);
  return MODES.includes(stored)?stored:'auto';
 }catch{return 'auto';}
}
export function setRoutePreference(mode){
 if(!MODES.includes(mode))return false;
 try{globalThis.localStorage?.setItem(PREF_KEY,mode);routePromise=null;return true;}
 catch{return false;}
}
async function responsive(fetcher,url,timeoutMs){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetcher(url+'/health',{method:'GET',cache:'no-store',signal:controller.signal});
  if(!response?.ok)return false;
  const data=await response.json();
  return data?.ok===true;
 }catch{return false;}finally{clearTimeout(timer);}
}
export async function chooseRoute({preference='auto',enabled=true,
  fetcher=globalThis.fetch,timeoutMs=2600,direct=DIRECT}={}){
 if(!enabled)return 'direct';
 if(preference==='direct'||preference==='yandex')return preference;
 // Test both Workers. A profile-only health check would falsely prefer direct
 // when Tournament is blocked by a particular ISP.
 const ok=await Promise.all(
  ['profile','tournament'].map(service=>responsive(fetcher,direct[service],timeoutMs))
 );
 return ok.every(Boolean)?'direct':'yandex';
}
export function chosenRoute(){
 if(!routePromise)routePromise=chooseRoute({
  preference:routePreference(),enabled:browserEnabled()
 });
 return routePromise;
}
export async function apiBase(service,directUrl){
 // Never change legacy Tournament, v4-specific previews or other services.
 // Those use DIFFERENT Cloudflare workers and must keep their own identity.
 if(!Object.prototype.hasOwnProperty.call(DIRECT,service)||directUrl!==DIRECT[service])
  return directUrl;
 return await chosenRoute()==='yandex'?YANDEX+'/'+service:directUrl;
}
export {YANDEX,DIRECT};
