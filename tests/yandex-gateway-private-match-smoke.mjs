/* Optional real guest match through Yandex API Gateway.
  - Mutates only temporary unrated guest test state
  - Does NOT join public matchmaking, award rating, or upload any profile
  - MUST be run only after the safe CORS smoke passes
*/
import assert from 'node:assert/strict';
const base='https://d5ds3hf0ei1mlkgjrnlm.d8epmcec.apigw.yandexcloud.net/tournament';
const origin='https://mobigametim-bit.github.io';
async function post(path,body,token=''){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const r=await fetch(base+path,{method:'POST',signal:controller.signal,cache:'no-store',headers:{
    Origin:origin,'Content-Type':'application/json',
    ...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>null);
  assert.equal(r.status,200,path+' HTTP '+r.status+' '+data?.error);
  return data;
 }finally{clearTimeout(timer);}
}
const suffix=Date.now().toString(36);
const a=await post('/v1/session',{nick:'yc-qa-a-'+suffix,power:750,launch:''});
const b=await post('/v1/session',{nick:'yc-qa-b-'+suffix,power:750,launch:''});
assert.equal(a.kind,'guest');assert.equal(b.kind,'guest');
assert(a.token?.length>40&&b.token?.length>40&&a.token!==b.token);
const room=await post('/v1/room/create',{squad:'humans',power:750},a.token);
assert(/^[A-Z0-9]{6}$/.test(room.code));
const joined=await post('/v1/room/join',{code:room.code,squad:'humans',power:750},b.token);
assert.equal(joined.status,'matched');assert(joined.matchId);
const path='/v1/match/'+encodeURIComponent(joined.matchId);
const wa=await post(path+'/snapshot',{},a.token), wb=await post(path+'/snapshot',{},b.token);
assert.equal(wa.matchId,wb.matchId);assert.notEqual(wa.playerColor,wb.playerColor);
const white=wa.playerColor==='w'?a.token:b.token;
const black=wa.playerColor==='b'?a.token:b.token;
assert.equal((await post(path+'/move',{from:'e2',to:'e4'},white)).moves.length,1);
assert.equal((await post(path+'/move',{from:'e7',to:'e5'},black)).moves.length,2);
assert.equal((await post(path+'/snapshot',{},white)).moves.length,2);
const end=await post(path+'/resign',{},white);
assert.equal(end.rated,false);
console.log('YANDEX UNRATED GUEST PRIVATE MATCH, MOVES, RECONNECT AND RESIGN PASSED');
