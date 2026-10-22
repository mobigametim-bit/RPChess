/* End-to-end staging smoke: two independent guest sessions, no rewards.
   Uses the deployed Cloudflare Durable Objects, not a local fake transport. */
import assert from 'node:assert/strict';

const base=(process.env.RPCHESS_TOURNAMENT_API||'').replace(/\/$/,'');
assert(base.startsWith('https://'),'RPCHESS_TOURNAMENT_API must be HTTPS');

async function api(path,{token,body}={}){
 const options={method:body===undefined?'GET':'POST',
   headers:{Origin:'https://mobigametim-bit.github.io',...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})}};
 if(body!==undefined)options.body=JSON.stringify(body);
 const response=await fetch(base+path,options);
 const payload=await response.json().catch(()=>null);
 return {status:response.status,data:payload};
}
async function pass(path,options,expected=200){
 const r=await api(path,options);
 assert.equal(r.status,expected,JSON.stringify({path,expected,received:r}));
 return r.data;
}
const health=await pass('/health');
assert.equal(health.ok,true);
async function guest(name,power=900){
 const data=await pass('/v1/session',{body:{nick:name,power,launch:''}});
 assert.equal(data.kind,'guest');assert(data.token?.length>40);
 return data.token;
}
const white=await guest('QA-a'),black=await guest('QA-b');
assert.notEqual(white,black);
const outsider=await guest('QA-c');
const room=await pass('/v1/room/create',{token:white,body:{squad:'humans',power:930}});
assert(/^[A-Z0-9]{6}$/.test(room.code));
const joined=await pass('/v1/room/join',{token:black,body:{code:room.code,squad:'orcs',power:920}});
assert.equal(joined.status,'matched');
assert(/^[a-f0-9-]{36}$/.test(joined.matchId));
const ownerResult=await pass('/v1/room/status',{token:white,body:{code:room.code}});
assert.equal(ownerResult.matchId,joined.matchId);
const id=joined.matchId;
const prefix='/v1/match/'+encodeURIComponent(id);
const pa=await pass(prefix+'/snapshot',{token:white,body:{}});
const pb=await pass(prefix+'/snapshot',{token:black,body:{}});
assert.equal(pa.status,'playing');assert.equal(pa.turn,'w');assert(pa.remaining.w<=600000&&pa.remaining.w>=595000,'White clock starts counting as soon as the match begins');
assert.equal(pa.remaining.b,600000);
assert.equal(pa.moves.length,0);
assert.notEqual(pa.playerColor,pb.playerColor);
assert.equal(pa.matchId,pb.matchId);
const wtoken=pa.playerColor==='w'?white:black;
const btoken=pa.playerColor==='b'?white:black;
assert.equal((await api(prefix+'/move',{token:btoken,body:{from:'e7',to:'e5'}})).status,409,'Black cannot move first');
assert.equal((await api(prefix+'/move',{token:outsider,body:{from:'e2',to:'e4'}})).status,403,'Outsider cannot make moves');
assert.equal((await api(prefix+'/init',{token:outsider,body:{}})).status,403,'Public endpoint must not initialize matches');
const move1=await pass(prefix+'/move',{token:wtoken,body:{from:'e2',to:'e4'}});
assert.equal(move1.moves.length,1);assert.equal(move1.turn,'b');
assert(move1.remaining.w<=600000&&move1.remaining.w>=595000,'White clock is authoritative');
const move2=await pass(prefix+'/move',{token:btoken,body:{from:'e7',to:'e5'}});
assert.equal(move2.moves.length,2);assert.equal(move2.turn,'w');
const restored=await pass(prefix+'/snapshot',{token:wtoken,body:{}});
assert.equal(restored.moves.length,2,'Reconnect restores authoritative move history');
const ended=await pass(prefix+'/resign',{token:wtoken,body:{}});
assert.equal(ended.result.kind,'resign');assert.equal(ended.result.winner,'b');
assert.equal((await pass(prefix+'/snapshot',{token:btoken,body:{}})).result.kind,'resign');
const q1=await guest('QA-queue-one',600),q2=await guest('QA-queue-two',650);
const first=await pass('/v1/queue/join',{token:q1,body:{squad:'humans',power:600,newSearch:true}});
assert.equal(first.status,'waiting');
const found=await pass('/v1/queue/join',{token:q2,body:{squad:'humans',power:650,newSearch:true}});
assert.equal(found.status,'matched');
const polled=await pass('/v1/queue/status',{token:q1,body:{}});
assert.equal(polled.matchId,found.matchId,'Queue owner discovers match by polling');
console.log('TOURNAMENT LIVE SMOKE PASS: health, two signed guests, private room, turns, anti-forgery, reconnect, resign, queue');
