/* Safe preflight/health check for the Yandex API-only proxy.
   All requests are read-only except an *unauthenticated* PUT, which MUST
   return 401 without touching player data. No bearer credentials printed. */
import assert from 'node:assert/strict';

const base='https://d5ds3hf0ei1mlkgjrnlm.d8epmcec.apigw.yandexcloud.net';
const trusted='https://mobigametim-bit.github.io';
const blocked='https://example.invalid';
const host=new URL(base).hostname;
assert(host.endsWith('.apigw.yandexcloud.net'));
async function fetchApi(path,options={}){
 const abort=new AbortController();
 const timeout=setTimeout(()=>abort.abort(),15000);
 try{
  return await fetch(base+path,{cache:'no-store',signal:abort.signal,...options});
 }finally{clearTimeout(timeout);}
}
async function jsonGet(path,expected){
 const r=await fetchApi(path);
 const j=await r.json().catch(()=>null);
 assert.equal(r.status,200,path+' HTTP '+r.status);
 assert.equal(j?.ok,true,path+' has no ok=true');
 if(expected)assert.equal(j?.service,expected,path+' wrong upstream');
 console.log('OK',path,r.status,expected||'gateway');
}
// Distinguish a live gateway/upstream failure from a game client bug, without
// tokens, production queue writes or Yandex Cloud logs. Do not print identities.
async function diagnostic(name,url,method='GET'){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 const start=Date.now();
 try{
  const headers=method==='OPTIONS'
   ?{'Origin':trusted,'Access-Control-Request-Method':'POST',
     'Access-Control-Request-Headers':'Authorization, Content-Type'}
   :{};
  const response=await fetch(url,{method,headers,cache:'no-store',signal:controller.signal});
  return {name,status:response.status,ms:Date.now()-start,
   origin:response.headers.get('access-control-allow-origin')===trusted,
   contentType:response.headers.get('content-type')||'none'};
 }catch(e){return {name,error:e?.name||'NetworkError',message:String(e?.message||e).slice(0,100),ms:Date.now()-start};}
 finally{clearTimeout(timeout);}
}
const comparisons=[
 ['yandex self ping',base+'/ping'],
 ['direct profile health','https://rpchess-profile-preview.mobigametim.workers.dev/health'],
 ['gateway profile health',base+'/profile/health'],
 ['gateway profile probe',base+'/probe/profile'],
 ['direct tournament health','https://rpchess-tournament-profile-preview.mobigametim.workers.dev/health'],
 ['gateway tournament health',base+'/tournament/health'],
 ['gateway tournament probe',base+'/probe/tournament'],
 ['direct profile preflight','https://rpchess-profile-preview.mobigametim.workers.dev/v1/session','OPTIONS'],
 ['gateway profile preflight',base+'/profile/v1/session','OPTIONS'],
 ['direct queue preflight','https://rpchess-tournament-profile-preview.mobigametim.workers.dev/v1/queue/join','OPTIONS'],
 ['gateway queue preflight',base+'/tournament/v1/queue/join','OPTIONS']
];
console.log('GATEWAY / DIRECT NETWORK COMPARISON START');
for(const row of await Promise.all(comparisons.map(x=>diagnostic(...x))))
 console.log('NETWORK COMPARE',JSON.stringify(row));
console.log('GATEWAY / DIRECT NETWORK COMPARISON END');
for(const item of [
 {path:'/profile/v1/session',method:'POST'},
 {path:'/profile/v1/profile',method:'PUT'},
 {path:'/tournament/v1/session',method:'POST'},
 {path:'/tournament/v1/queue/join',method:'POST'}
]){
 const r=await fetchApi(item.path,{method:'OPTIONS',headers:{
  'Origin':trusted,
  'Access-Control-Request-Method':item.method,
  'Access-Control-Request-Headers':'Authorization, Content-Type'
 }});
 const allow=r.headers.get('access-control-allow-origin');
 const allowedMethods=r.headers.get('access-control-allow-methods')||'';
 const allowedHeaders=r.headers.get('access-control-allow-headers')||'';
 console.log('PREFLIGHT',item.method,item.path,'HTTP',r.status,'allowed origin?',allow===trusted);
 assert.equal(r.status,204,'upstream OPTIONS was not proxied');
 assert.equal(allow,trusted,'wrong CORS origin');
 assert(allowedMethods.includes(item.method),'method not allowed by CORS');
 assert(/Authorization/i.test(allowedHeaders),'Authorization not allowed by CORS');
}
await jsonGet('/ping');
await jsonGet('/probe/profile','rpchess-profile-preview');
await jsonGet('/probe/tournament','tournament');
await jsonGet('/profile/health','rpchess-profile-preview');
await jsonGet('/tournament/health','tournament');
const forbidden=await fetchApi('/tournament/v1/session',{
 method:'OPTIONS',headers:{'Origin':blocked,
  'Access-Control-Request-Method':'POST',
  'Access-Control-Request-Headers':'Authorization,Content-Type'}});
console.log('UNTRUSTED ORIGIN OPTIONS HTTP',forbidden.status);
assert.equal(forbidden.status,403,'Untrusted Origin was not rejected by Worker');
const r=await fetchApi('/profile/v1/profile',{
 method:'PUT',headers:{'Origin':trusted,'Content-Type':'application/json'},
 body:JSON.stringify({revision:0,snapshot:{}})});
console.log('UNAUTHENTICATED PROFILE PUT HTTP',r.status);
assert.equal(r.status,401,'Profile PUT must reach upstream and require authorization');
console.log('YANDEX PROXY GET, CORS AND UPSTREAM AUTH SMOKE PASSED');
