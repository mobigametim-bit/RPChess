import assert from 'node:assert/strict';

const base = 'https://rpchess-ru-api-gateway.netlify.app';
const origin = 'https://mobigametim-bit.github.io';
async function request(path, options={}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(base+path,{cache:'no-store',signal:controller.signal,...options});
  } finally { clearTimeout(timeout); }
}
for (const path of ['/geo','/profile/health','/tournament/health']) {
  const res = await request(path);
  const text = await res.text();
  assert.equal(res.status,200,path+' HTTP status: '+res.status+' '+text.slice(0,240));
  let data;try{data=JSON.parse(text);}catch{throw Error(path+' is not JSON: '+text.slice(0,240));}
  if(path==='/geo') assert.ok(data.country===null||/^[A-Z]{2}$/.test(data.country),'invalid country');
  else assert.equal(data.ok,true,path+' upstream is not healthy: '+text.slice(0,240));
  console.log(path,'HTTP',res.status,JSON.stringify(data).slice(0,160));
}
for(const service of ['profile','tournament']) {
  const path='/'+service+'/v1/session';
  const res=await request(path,{
    method:'OPTIONS',
    headers:{
      Origin:origin,
      'Access-Control-Request-Method':'POST',
      'Access-Control-Request-Headers':'Authorization, Content-Type'
    }
  });
  const allowOrigin=res.headers.get('access-control-allow-origin');
  assert.equal(res.status,204,path+' preflight status '+res.status);
  assert.equal(allowOrigin,origin,path+' wrong allow-origin');
  const allow=(res.headers.get('access-control-allow-headers')||'').toLowerCase();
  assert.ok(allow.includes('authorization')&&allow.includes('content-type'),path+' missing auth/content-type preflight');
  console.log(path,'OPTIONS',res.status,'CORS OK');
}

// Wait for the Netlify Git-based production deployment: GitHub Actions can
// reach this step before the Netlify build has finished.
async function waitForPreview(path,attempts=30){
 for(let i=0;i<attempts;i++){
  try{
   const res=await request(path);
   if(res.status===200){
    const body=await res.json();
    if(body.ok===true){console.log(path,'HTTP 200',JSON.stringify(body).slice(0,150));return;}
   }
  }catch{}
  if(i!==attempts-1)await new Promise(resolve=>setTimeout(resolve,12000));
 }
 throw Error(path+' was not healthy after Netlify build');
}
await waitForPreview('/preview-api/profile/health');
await waitForPreview('/preview-api/tournament/health');
const playable=await request('/play/index.html');
const page=await playable.text();
assert.equal(playable.status,200,'playable page HTTP status '+playable.status);
assert.ok(page.includes('data-tournament-open')&&page.includes('rpchess-gateway'),
 'playable game HTML not deployed or wrong version');
const module=await request('/play/js/api-route.mjs');
const source=await module.text();
assert.equal(module.status,200);
assert.ok(source.includes("'/preview-api'"),'new adaptive API client missing from playable preview');
console.log('/play/index.html','HTTP 200; new API route module HTTP 200');
// Verify authorized POST forwarding with real *unrated guest* sessions and a
// private room. Avoid the shared public queue so no live player is disrupted.
async function tournamentPost(path,body,token=''){
 const res=await request('/preview-api/tournament'+path,{
   method:'POST',headers:{'Content-Type':'application/json',
     ...(token?{Authorization:'Bearer '+token}:{})},
   body:JSON.stringify(body)
 });
 const data=await res.json().catch(()=>({}));
 assert.equal(res.status,200,path+' status '+res.status+': '+JSON.stringify(data).slice(0,240));
 return data;
}
const stamp=Date.now().toString(36);
const owner=await tournamentPost('/v1/session',{nick:'gateway-qa-a-'+stamp,power:700,launch:''});
const joiner=await tournamentPost('/v1/session',{nick:'gateway-qa-b-'+stamp,power:700,launch:''});
assert.ok(owner.token?.length>40&&joiner.token?.length>40&&owner.token!==joiner.token);
assert.equal(owner.kind,'guest');assert.equal(joiner.kind,'guest');
const room=await tournamentPost('/v1/room/create',{squad:'humans',power:700},owner.token);
assert.ok(/^[A-Z0-9]{6}$/.test(room.code),'valid private invitation');
const matched=await tournamentPost('/v1/room/join',{code:room.code,squad:'humans',power:700},joiner.token);
assert.equal(matched.status,'matched');assert.ok(matched.matchId);
const id=encodeURIComponent(matched.matchId);
const a=await tournamentPost('/v1/match/'+id+'/snapshot',{},owner.token);
const b=await tournamentPost('/v1/match/'+id+'/snapshot',{},joiner.token);
assert.equal(a.matchId,b.matchId);
assert.notEqual(a.playerColor,b.playerColor);
const white=a.playerColor==='w'?owner.token:joiner.token;
const black=a.playerColor==='b'?owner.token:joiner.token;
const move1=await tournamentPost('/v1/match/'+id+'/move',{from:'e2',to:'e4'},white);
assert.equal(move1.moves.length,1);
const move2=await tournamentPost('/v1/match/'+id+'/move',{from:'e7',to:'e5'},black);
assert.equal(move2.moves.length,2);
const resumed=await tournamentPost('/v1/match/'+id+'/snapshot',{},white);
assert.equal(resumed.moves.length,2,'moves restored from server');
const resigned=await tournamentPost('/v1/match/'+id+'/resign',{},white);
assert.equal(resigned.status,'finished');
assert.equal(resigned.rated,false,'test guests must never change Power');
console.log('Netlify Edge relay: 2 signed guest sessions, private matchmaking, 2 moves, reconnect and resign PASS');

console.log('Gateway, preflight, and playable preview reachability passed. Two real players still need manual acceptance.');
