/* Local-only ranked verification against wrangler dev with disposable test keys.
 * No production VK account or Cloudflare record is used. */
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
const BASE=process.env.RPCHESS_TOURNAMENT_API||'http://127.0.0.1:8789';
const SECRET='rpchess-local-vk-secret-for-ci-only-do-not-deploy';
async function request(path,token=null,body={}){
 const r=await fetch(BASE+path,{method:'POST',headers:{
  Origin:'https://mobigametim-bit.github.io','Content-Type':'application/json',
  ...(token?{Authorization:'Bearer '+token}:{})
 },body:JSON.stringify(body)});
 const data=await r.json().catch(()=>null);
 return {status:r.status,data};
}
async function ok(path,token,body={}){
 const r=await request(path,token,body);
 assert.equal(r.status,200,JSON.stringify({path,r}));
 return r.data;
}
function launch(id,offset=0){
 const params=new URLSearchParams({vk_app_id:'54754579',vk_ts:String(Math.floor(Date.now()/1000)+offset),vk_user_id:String(id)});
 const sig=createHmac('sha256',SECRET).update(params.toString()).digest('base64url');
 return params.toString()+'&sign='+sig;
}
async function auth(id,power=500){
 const session=await ok('/v1/session',null,{nick:'QA-'+id,power,launch:launch(id)});
 assert.equal(session.kind,'vk');
 assert.equal(session.ranked,true);
 return session.token;
}
const a=await auth(234567810,3500),b=await auth(234567811,100);
const pa=await ok('/v1/profile',a),pb=await ok('/v1/profile',b);
assert.equal(pa.power,500,'Claimed 3500 is never trusted as ranked Power');
assert.equal(pb.power,500,'Claimed 100 is never trusted as ranked Power');
assert.equal(pa.ratedGames,0);
const fresh=await ok('/v1/session',null,{previous:a,nick:'spoof',power:3500});
assert.equal(fresh.ranked,true);
assert.equal((await ok('/v1/profile',fresh.token)).power,500,'Session renewal cannot spoof Power');
const stale=await ok('/v1/session',null,{nick:'stale',launch:launch(234567812,-90000),power:3500});
assert.equal(stale.ranked,false,'Expired signed launch cannot create ranked identity');
const tampered=await ok('/v1/session',null,{nick:'bad',launch:launch(234567813).replace('234567813','234567812')});
assert.equal(tampered.ranked,false,'Modified signed user id is rejected');
const guest=await ok('/v1/session',null,{nick:'guest',power:3500,launch:''});
assert.equal(guest.ranked,false);
assert.equal((await request('/v1/account/settle',a,{receiptId:'x'})).status,404,'Direct user access to account settlement is impossible');
let white,brown;
async function pair(ta,tb){
 const first=await ok('/v1/queue/join',ta,{squad:'humans',power:3500,newSearch:true});
 assert.equal(first.status,'waiting');
 const second=await ok('/v1/queue/join',tb,{squad:'orcs',power:100,newSearch:true});
 assert.equal(second.status,'matched');
 const snapA=await ok('/v1/match/'+second.matchId+'/snapshot',ta);
 const snapB=await ok('/v1/match/'+second.matchId+'/snapshot',tb);
 assert.equal(snapA.playerColor==='w',snapB.playerColor==='b');
 const tokenWhite=snapA.playerColor==='w'?ta:tb;
 const tokenBlack=snapA.playerColor==='b'?ta:tb;
 return {id:second.matchId,white:tokenWhite,black:tokenBlack,a:snapA,b:snapB};
}
for(let round=1;round<=3;round++){
 const game=await pair(a,b);
 assert.equal(game.a.rated,round<=2,'Only first two same-pair meetings in 24h can be rated');
 assert.equal(game.a.players.find(x=>x.color===game.a.playerColor).power,
  (await ok('/v1/profile',a)).power,'Match starts from server-verified rating');
 assert.equal((await request('/v1/match/'+game.id+'/init',game.white)).status,403);
 const ended=await ok('/v1/match/'+game.id+'/resign',game.white);
 assert.equal(ended.result.winner,'b');
 const winner=await ok('/v1/match/'+game.id+'/snapshot',game.black);
 if(round<=2){
  assert(ended.rating&&winner.rating,'Each verified side has a server receipt');
  const sum=ended.rating.delta+winner.rating.delta;
  if(round===1)assert.equal(sum,0,'Equal 500 vs 500: +16/-16');
  assert.equal(ended.rating.delta,round===1?-16:ended.rating.delta);
  assert.equal(winner.rating.delta,round===1?16:winner.rating.delta);
  assert.deepEqual((await ok('/v1/match/'+game.id+'/snapshot',game.white)).rating,ended.rating,
   'Re-reading a completed result cannot change settled rating');
  const ratingA=await ok('/v1/profile',a);
  const ratingB=await ok('/v1/profile',b);
  assert.equal(ratingA.ratedGames,round);
  assert.equal(ratingB.ratedGames,round);
  assert.equal(ratingA.power,game.a.playerColor==='w'?ended.rating.after:winner.rating.after);
  assert.equal(ratingB.power,game.b.playerColor==='w'?ended.rating.after:winner.rating.after);
 }else{
  assert.equal(ended.rating,null,'Third repeat encounter must not mint Elo');
  assert.equal(winner.rating,null);
  assert.equal((await ok('/v1/profile',a)).ratedGames,2);
  assert.equal((await ok('/v1/profile',b)).ratedGames,2);
 }
}
// Clear the previous casual match pointers before starting a new room.
await ok('/v1/queue/cancel',a);
await ok('/v1/queue/cancel',b);
const room=await ok('/v1/room/create',a,{squad:'humans'});
const invited=await ok('/v1/room/join',b,{code:room.code,squad:'orcs'});
const invitedSnapshot=await ok('/v1/match/'+invited.matchId+'/snapshot',a);
assert.equal(invitedSnapshot.rated,false,'Even two VK players in a private invitation remain casual');
await ok('/v1/match/'+invited.matchId+'/resign',a);
assert.equal((await ok('/v1/profile',a)).ratedGames,2);
console.log('RANKED LOCAL PASS: VK HMAC+freshness, no client Power claims, account ledger, once-only Elo, pair anti-farming, casual invites');
