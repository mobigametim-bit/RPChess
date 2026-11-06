import assert from 'node:assert/strict';

const base='https://rpchess-ru-api-gateway.netlify.app';
const origin='https://mobigametim-bit.github.io';
async function request(path,options={}){
 const abort=new AbortController();
 const timer=setTimeout(()=>abort.abort(),12000);
 try{return await fetch(base+path,{cache:'no-store',signal:abort.signal,...options});}
 finally{clearTimeout(timer);}
}
async function liveOk(path){
 const response=await request(path);
 assert.equal(response.status,200,path+' status '+response.status);
 const data=await response.json();
 if(path==='/geo')assert.ok(data.country===null||/^[A-Z]{2}$/.test(data.country));
 else assert.equal(data.ok,true,path+' unavailable');
 console.log(path,'200',JSON.stringify(data));
}
async function waitGatewayUpdated(){
 // Netlify build and GitHub Actions start independently. Wait for new
 // diagnostics to replace previous /play page before testing route removal.
 for(let attempt=0;attempt<30;attempt++){
  try{
   const res=await request('/');
   if(res.status===200&&(await res.text()).includes('Проверка соединения RPChess')){
    const gone=await request('/play/index.html');
    if(gone.status===404)return;
   }
  }catch{}
  if(attempt<29)await new Promise(resolve=>setTimeout(resolve,8000));
 }
 throw Error('New API-only gateway deploy is not live, or /play still exists');
}
await waitGatewayUpdated();
await liveOk('/geo');await liveOk('/profile/health');await liveOk('/tournament/health');
for(const endpoint of ['/play/','/play/index.html','/play/js/tournament-app.mjs','/preview-api/profile/health','/preview-api/tournament/health']){
 const res=await request(endpoint);
 assert.equal(res.status,404,'Obsolete route '+endpoint+' must be removed, got '+res.status);
 console.log(endpoint,'404 removed');
}
for(const method of ['POST','PUT']){
 const route=method==='POST'?'/v1/session':'/v1/profile';
 const res=await request('/profile'+route,{
  method:'OPTIONS',
  headers:{Origin:origin,'Access-Control-Request-Method':method,
   'Access-Control-Request-Headers':'Content-Type,Authorization'}
 });
 assert.equal(res.status,204,'Profile '+method+' preflight '+res.status);
 assert.equal(res.headers.get('access-control-allow-origin'),origin);
 console.log('profile',method,'preflight 204');
}
const preflight=await request('/tournament/v1/session',{
 method:'OPTIONS',
 headers:{Origin:origin,'Access-Control-Request-Method':'POST',
  'Access-Control-Request-Headers':'Content-Type,Authorization'}
});
assert.equal(preflight.status,204,'Tournament POST preflight');
assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
console.log('tournament POST preflight 204');

async function post(path,body,token=''){
 const response=await request('/tournament'+path,{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json',
    ...(token?{Authorization:'Bearer '+token}:{})},
  body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 assert.equal(response.status,200,path+' HTTP '+response.status+': '+JSON.stringify(data).slice(0,140));
 return data;
}
// Two isolated unrated guest players; avoid touching public queue / Elo.
// No bearer tokens or other sensitive values are printed.
const a=await post('/v1/session',{nick:'gw-smoke-a',power:700,launch:''});
const b=await post('/v1/session',{nick:'gw-smoke-b',power:710,launch:''});
assert.ok(a.token?.length>40&&b.token?.length>40&&a.token!==b.token);
assert.equal(a.kind,'guest');assert.equal(b.kind,'guest');
const room=await post('/v1/room/create',{squad:'humans',power:700},a.token);
assert.ok(/^[A-Z0-9]{6}$/.test(room.code),'private room code');
const joined=await post('/v1/room/join',{code:room.code,squad:'humans',power:710},b.token);
assert.equal(joined.status,'matched');
const id=encodeURIComponent(joined.matchId);
const s1=await post('/v1/match/'+id+'/snapshot',{},a.token);
const s2=await post('/v1/match/'+id+'/snapshot',{},b.token);
assert.equal(s1.matchId,s2.matchId);
assert.notEqual(s1.playerColor,s2.playerColor);
const w=s1.playerColor==='w'?a.token:b.token;
const black=s1.playerColor==='b'?a.token:b.token;
assert.equal((await post('/v1/match/'+id+'/move',{from:'e2',to:'e4'},w)).moves.length,1);
assert.equal((await post('/v1/match/'+id+'/move',{from:'e7',to:'e5'},black)).moves.length,2);
assert.equal((await post('/v1/match/'+id+'/snapshot',{},w)).moves.length,2,'reconnect');
const done=await post('/v1/match/'+id+'/resign',{},w);
assert.equal(done.rated,false,'guest match must remain unrated');
console.log('CDN Tournament: guest pairing, moves, snapshot and resign PASS');

const denied=await request('/profile/v1/profile',{
 method:'PUT',headers:{Origin:origin,'Content-Type':'application/json'},
 body:JSON.stringify({revision:0,snapshot:{}})});
assert.equal(denied.status,401,'Profile PUT should reach Worker and reject anonymous request');
console.log('CDN profile PUT forwarded to auth validator (401 anonymous)');
console.log('API-ONLY GATEWAY LIVE SMOKE PASS');
