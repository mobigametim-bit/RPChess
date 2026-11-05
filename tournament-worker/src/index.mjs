/* RPChess Tournament transport: server-authoritative chess; no client claims of victories.
   Dedicated Worker (never the existing leaderboard service). */
import { DurableObject } from 'cloudflare:workers';
import { ClassicChessEngine } from '../../game/js/classic-chess-engine.mjs';
import { normalizePower, ratingDelta } from '../../game/js/power-elo.mjs';

const MINUTE=60000, CONTROL=10*MINUTE, MAX_MOVES=600, VK_LAUNCH_TTL=3600;
const ORIGINS=['https://mobigametim-bit.github.io','https://rpchess-portrait-ui-preview.mobigametim.workers.dev','https://rpchess-gamepush-preview.mobigametim.workers.dev'];
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});}
function problem(code,status=400){return json({error:code},status);}
const encode=value=>btoa(String.fromCharCode(...new TextEncoder().encode(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=value=>new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),ch=>ch.charCodeAt(0)));
async function sign(value,secret){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)));
 return btoa(String.fromCharCode(...mac)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function verify(token,secret){
 if(typeof token!=='string'||token.length>1500)return null;
 const parts=token.split('.');
 if(parts.length!==2||!parts[0]||!parts[1])return null;
 const actual=await sign(parts[0],secret);
 if(actual.length!==parts[1].length)return null;
 let mismatch=0;for(let i=0;i<actual.length;i++)mismatch|=actual.charCodeAt(i)^parts[1].charCodeAt(i);
 if(mismatch)return null;
 try{const p=JSON.parse(decode(parts[0]));return p.id&&p.exp>Date.now()?p:null;}catch{return null;}
}
async function vkIdentity(launch,secret){
 if(!secret||typeof launch!=='string'||launch.length>3000)return null;
 const p=new URLSearchParams(launch);
 const id=p.get('vk_user_id'),signature=p.get('sign'),ts=Number(p.get('vk_ts'));
 // VK signed launch data is short-lived. A valid prior server session may
 // persist across reloads, but stale launch parameters cannot mint a new one.
 if(!/^[1-9]\d*$/.test(id||'')||p.get('vk_app_id')!=='54754579'||!signature||
    !Number.isSafeInteger(ts)||Math.abs(Date.now()/1000-ts)>VK_LAUNCH_TTL)return null;
 const sorted=new URLSearchParams([...p.entries()].filter(([k])=>k.startsWith('vk_')).sort(([a],[b])=>a.localeCompare(b))).toString();
 const computed=await sign(sorted,secret);if(computed.length!==signature.length)return null;
 let diff=0;for(let i=0;i<computed.length;i++)diff|=computed.charCodeAt(i)^signature.charCodeAt(i);
 return diff?null:'vk:'+id;
}
function safePower(x){return Math.max(100,Math.min(3500,Math.round(Number(x)||500)));}
const COMMANDER_IDS=new Set(['oathkeeper','stone_crown','wanderer_queen','pilgrim','fox_prince','ash_regent','nameless_heir']);
function safeCommander(id){return COMMANDER_IDS.has(id)?id:'oathkeeper';}
function displayPower(value){return Number.isSafeInteger(value)?Math.min(1000000,Math.max(0,value)):500;}
function playerName(value){return String(value||'Воин').trim().slice(0,24)||'Воин';}
function safeRace(r){return ['humans','elves','orcs','undead','dark_elves','dwarves','demons','angels','dragonborn','beastfolk','constructs','animals','fae','goblins'].includes(r)?r:'humans';}
/* Result + score are authoritative inside this match Durable Object; the
 * same immutable receipt is exposed on reconnect. Shards remain disabled.
 */
function ratedResult(match,player){
 if(!match.result||match.ratingVersion!==1)return null;
 const opponent=match.players.find(p=>p.color!==player.color);
 if(!opponent)return null;
 const before=normalizePower(player.power),opponentElo=normalizePower(opponent.power);
 const result=match.result.winner==null?0.5:match.result.winner===player.color?1:0;
 const delta=ratingDelta(before,opponentElo,result);
 const after=Math.max(0,before+delta);
 return {id:'tournament:'+match.id+':'+player.color,before,after,delta:after-before,opponentElo,result};
}
async function parse(request){return await request.json().catch(()=>null);}
async function internal(stub,path,body){const res=await stub.fetch(new Request('https://tournament.internal'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));return res;}
function route(env,key){return env.MATCHES.get(env.MATCHES.idFromName(key));}
function account(env,id){return env.ACCOUNTS.get(env.ACCOUNTS.idFromName(id));}
async function accountCall(env,id,path,data={}){
 const result=await internal(account(env,id),path,data);
 if(!result.ok)throw Error('Tournament account ledger unavailable: '+result.status);
 return await result.json();
}
function isVerified(user,env){
 // Historic signed VK sessions stay ranked; new RPChess IDs are ranked only
 // after independent verification against the Profile Worker.
 return user?.kind==='vk'&&(
   (/^vk:[1-9]\d*$/.test(user.id||'')&&Boolean(env.VK_APP_SECRET))
   || (user.profileVerified===true&&/^rpchess:[0-9a-f-]{36}$/i.test(user.id||''))
 );
}
async function profileBinding(credential,env){
 if(typeof credential!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(credential))return null;
 const base=String(env.RPCHESS_PROFILE_API||'').replace(/\/+$/,'');
 const secure=/^https:\/\/[a-z0-9.-]+$/i.test(base);
 const localTest=env.ALLOW_LOCAL_PROFILE_API==='1'&&/^http:\/\/127\.0\.0\.1:\d+$/.test(base);
 if(!secure&&!localTest)throw Error('Profile API unavailable');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6500);
 try{
  // Cloudflare disallows ordinary same-account workers.dev subrequests in
  // some deployments; a named service binding is the trusted production path.
  const transport=env.PROFILE_SERVICE?.fetch
    ? req=>env.PROFILE_SERVICE.fetch(req)
    : req=>fetch(req);
  const res=await transport(new Request(base+'/v1/tournament-binding',{
   headers:{Authorization:'Bearer '+credential},signal:controller.signal,cache:'no-store'
  }));
  if(res.status===401)return null;
  if(!res.ok)throw Error('Profile identity service unavailable');
  const binding=await res.json();
  if(!/^[0-9a-f-]{36}$/i.test(binding?.id||''))return null;
  if(binding.provider==='web'&&binding.vkUserId==null)return binding;
  if(binding.provider==='vk'&&/^[1-9]\d*$/.test(binding.vkUserId||''))return binding;
  return null;
 }finally{clearTimeout(timeout);}
}

export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');const list=String(env.ALLOWED_ORIGINS||ORIGINS.join(',')).split(',').map(v=>v.trim());
  const allowed=!origin||list.includes(origin);
  const cors=allowed&&origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
  if(request.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers:{...cors,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}});
  if(!allowed)return problem('origin_forbidden',403);
  const url=new URL(request.url),path=url.pathname;
  if(path==='/health')return json({ok:true,service:'tournament',version:1},200,cors);
  if(!env.PVP_SESSION_SECRET)return json({error:'tournament_session_secret_required'},503,cors);
  if(request.method!=='POST')return json({error:'method_not_allowed'},405,cors);
  const body=await parse(request);
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'invalid_json'},400,cors);
  if(path==='/v1/session'){
   const vk=await vkIdentity(body.launch,env.VK_APP_SECRET);
   // Explicit profile credential is verified via our independent D1 Worker;
   // never accept a browser-supplied profile ID as authentication.
   let binding=null;
   if(Object.hasOwn(body,'profileCredential')){
    try{binding=await profileBinding(body.profileCredential,env);}
    catch{return json({error:'profile_service_unavailable'},503,cors);}
    if(!binding)return json({error:'profile_auth_required'},401,cors);
    if(vk && (binding.provider!=='vk'||vk!=='vk:'+binding.vkUserId))
      return json({error:'profile_vk_identity_mismatch'},403,cors);
   }
   const linked=binding?'rpchess:'+binding.id:null;
   let session=await verify(body.previous,env.PVP_SESSION_SECRET);
   const nickname=playerName(body.nick||'Гость');
   // A newly verified RPChess profile supersedes any previous guest/VK token.
   // Unlinked legacy sessions retain their historical behavior.
   if(linked && session?.id!==linked)session=null;
   if(!linked&&vk&&session?.id!==vk)session=null;
   if(!session)session={
    id:linked||vk||'guest:'+crypto.randomUUID(),name:binding?playerName(binding.name):nickname,
    commanderId:safeCommander(binding?.commanderId),displayPower:binding
      ?displayPower(binding.displayPower):displayPower(body.power),
    kind:binding?(binding.provider==='vk'?'vk':'guest'):(vk?'vk':'guest'),
    profileVerified:Boolean(binding&&binding.provider==='vk'),
    created:Date.now(),exp:Date.now()+30*86400000
   };
   session={...session,
    ...(binding?{name:playerName(binding.name),commanderId:safeCommander(binding.commanderId),
      displayPower:displayPower(binding.displayPower)}:{}),
    power:isVerified(session,env)
    ?(await accountCall(env,session.id,'/profile')).power:safePower(body.power)};
   const raw=encode(JSON.stringify(session));
   return json({token:raw+'.'+await sign(raw,env.PVP_SESSION_SECRET),kind:session.kind,name:session.name,ranked:isVerified(session,env)},200,cors);
  }
  const bearer=(request.headers.get('Authorization')||'').replace(/^Bearer /i,'');
  const user=await verify(bearer,env.PVP_SESSION_SECRET);
  if(!user)return json({error:'not_authenticated'},401,cors);
  const verified=isVerified(user,env);
  const profile=verified?await accountCall(env,user.id,'/profile'):null;
  const serverPower=profile?.power??safePower(user.power);
  if(path==='/v1/profile')return json({ranked:verified,power:serverPower,kind:verified?'vk':'guest',
    rpchessId:/^rpchess:[0-9a-f-]{36}$/i.test(user.id||'')?user.id.slice(8):null,
    ratedGames:profile?.ratedGames||0},200,cors);
  // All server-internal user fields override browser input, including Power.
  const requestData={...body,user:{id:user.id,name:playerName(user.name),
    commanderId:safeCommander(user.commanderId),displayPower:displayPower(user.displayPower),kind:verified?'vk':'guest',
    profileVerified:verified&&user.profileVerified===true,power:serverPower},now:Date.now()};
  if(path==='/v1/queue/join')requestData.power=serverPower;
  let stub,pathDo;
  if(path.startsWith('/v1/queue/')||path.startsWith('/v1/room/')){stub=env.LOBBY.get(env.LOBBY.idFromName('world'));pathDo=path;}
  else if(path.startsWith('/v1/match/')){
   const [,v,kind,id,...tail]=path.split('/');
   if(!/^[a-zA-Z0-9-]{8,80}$/.test(id||''))return json({error:'invalid_match_id'},400,cors);
   if(!['snapshot','move','draw','resign'].includes(tail[0]||'snapshot'))
    return json({error:'unsupported_match_action'},403,cors);
   // Match initialization is private to the matchmaking Durable Object.
   stub=route(env,id);pathDo='/'+(tail[0]||'snapshot');
  }else return json({error:'not_found'},404,cors);
  const response=await internal(stub,pathDo,requestData);
  const result=new Response(response.body,response);
  Object.entries(cors).forEach(([k,v])=>result.headers.set(k,v));
  return result;
 }
};

export class TournamentLobby extends DurableObject {
 async fetch(req){
  const body=await req.json(),path=new URL(req.url).pathname;
  const uid=body.user?.id,now=Date.now();
  if(!uid)return problem('missing_identity',401);
  let queue=await this.ctx.storage.get('queue')||[];
  let matches=await this.ctx.storage.get('matched')||{};
  let rooms=await this.ctx.storage.get('rooms')||{};
  // Only pair active seekers. A closed tab must not stay matchable for two
  // minutes: the opponent would enter an empty game and lose on the clock.
  queue=queue.filter(x=>(x.seenAt||x.at)+25000>now);
  for(const [code,room] of Object.entries(rooms))if(room.at+1200000<now)delete rooms[code];
  // Searching must continue while BOTH players wait. A new /queue/join is not
  // required for the power range to widen: each active /queue/status retries
  // matching against the current queue.
  const matchQueued=async (index)=>{
   if(index<0)return null;
   const seeker=queue[index];
   let partner=-1,best=Infinity;
   for(let i=0;i<queue.length;i++){
    if(i===index||queue[i].user.id===seeker.user.id)continue;
    const other=queue[i];
    // Prefer close Power first, then relax the range for a small player pool.
    // 160 initially, +125 per second, eventually spanning the full 100–3500
    // rating range. Use either seeker's or opponent's time already waiting.
    const waited=Math.max(0,now-Math.min(seeker.at,other.at));
    const width=Math.min(3500,160+Math.floor(waited/1000)*125);
    const distance=Math.min(
     Math.abs(other.power-(seeker.desired??seeker.power)),
     Math.abs(seeker.power-(other.desired??other.power))
    );
    if(distance<=width&&distance<best){best=distance;partner=i;}
   }
   if(partner<0)return null;
   const other=queue[partner];
   const made=await this.createMatch(seeker.user,other.user,seeker.race,other.race,now,true);
   matches[seeker.user.id]=made;matches[other.user.id]=made;
   queue=queue.filter(x=>x.user.id!==seeker.user.id&&x.user.id!==other.user.id);
   await Promise.all([this.ctx.storage.put('queue',queue),this.ctx.storage.put('matched',matches)]);
   return made;
  };
  if(path==='/v1/queue/status'){
   if(matches[uid])return json(matches[uid]);
   const index=queue.findIndex(x=>x.user.id===uid);
   if(index<0)return json({status:'not_queued'});
   queue[index].seenAt=now;
   const paired=await matchQueued(index);
   if(paired)return json(paired);
   await this.ctx.storage.put('queue',queue);
   return json({status:'waiting'});
  }
  if(path==='/v1/room/status'){
   const code=String(body.code||'').toUpperCase(),room=rooms[code];
   if(room?.owner.id!==uid&&!matches[uid])return problem('room_not_found',404);
   return json(matches[uid]||{status:'waiting',code});
  }
  if(path==='/v1/queue/cancel'||path==='/v1/room/cancel'){
   queue=queue.filter(x=>x.user.id!==uid);
   if(path==='/v1/room/cancel')for(const [code,room] of Object.entries(rooms))if(room.owner.id===uid)delete rooms[code];
   // Cancel must discard old match pointers too. Otherwise the next
   // queue/status poll may resurrect a previous game's result.
   delete matches[uid];
   await Promise.all([this.ctx.storage.put('queue',queue),this.ctx.storage.put('rooms',rooms),this.ctx.storage.put('matched',matches)]);
   return json({ok:true});
  }
  if(path==='/v1/room/create'){
   if(queue.some(x=>x.user.id===uid)||Object.values(rooms).some(x=>x.owner.id===uid))return problem('already_waiting',409);
   const code=crypto.randomUUID().replace(/-/g,'').slice(0,6).toUpperCase();
   rooms[code]={owner:body.user,race:safeRace(body.squad),at:now};
   delete matches[uid]; // a new invitation must not return an old result
   await Promise.all([this.ctx.storage.put('rooms',rooms),this.ctx.storage.put('matched',matches)]);
   return json({status:'waiting',code});
  }
  if(path==='/v1/room/join'){
   const code=String(body.code||'').toUpperCase(),room=rooms[code];
   if(!room||room.owner.id===uid)return problem('room_unavailable',404);
   if(matches[uid])return json(matches[uid]);
   delete rooms[code];
   const made=await this.createMatch(room.owner,body.user,room.race,safeRace(body.squad),now,false);
   matches[room.owner.id]=made;matches[uid]=made;
   await Promise.all([this.ctx.storage.put('matched',matches),this.ctx.storage.put('rooms',rooms)]);
   return json(made);
  }
  if(path==='/v1/queue/join'){
   if(matches[uid]&&!body.newSearch)return json(matches[uid]);
   if(body.newSearch){
    delete matches[uid];
    queue=queue.filter(x=>x.user.id!==uid);
    // Essential: previously we deleted matches[uid] in memory but only
    // persisted 'queue'. First poll returned the finished OLD match and
    // falsely displayed Victory/timeout seconds after pressing Find.
    await this.ctx.storage.put('matched',matches);
   }
   if(queue.some(x=>x.user.id===uid))return json({status:'waiting'});
   const power=safePower(body.user.power),shift=Math.min(150,Math.max(0,body.lossStreak||0)>=2?120:0);
   queue.push({user:body.user,race:safeRace(body.squad),power,desired:power-shift,at:now,seenAt:now});
   const paired=await matchQueued(queue.length-1);
   if(paired)return json(paired);
   await this.ctx.storage.put('queue',queue);
   return json({status:'waiting'});
  }
  return problem('not_found',404);
 }
 async createMatch(a,b,ra,rb,now,publicQueue=false){
  const id=crypto.randomUUID();
  const pair=Math.random()<.5?[a,b]:[b,a],races=pair[0].id===a.id?[ra,rb]:[rb,ra];
  // Invitations are always casual. Repeated VK pairings are also casual:
  // max 2 rated meetings per pair in a rolling 24 h to limit Elo farming.
  const pairKey='ratedPair:'+ [a.id,b.id].sort().join('|');
  const recent=publicQueue&&isVerified(a,this.env)&&isVerified(b,this.env)
   ?(await this.ctx.storage.get(pairKey)||[]).filter(time=>now-time<86400000):[];
  const rated=publicQueue&&isVerified(a,this.env)&&isVerified(b,this.env)&&recent.length<2;
  const init=await internal(this.env.MATCHES.get(this.env.MATCHES.idFromName(id)),'/init',{
   id,players:pair.map((p,i)=>({...p,race:races[i],color:i===0?'w':'b'})),now,rated
  });
  if(!init.ok)throw Error('Match initialization failed');
  if(rated)await this.ctx.storage.put(pairKey,[...recent,now]);
  return {status:'matched',matchId:id,rated};
 }
}

export class TournamentMatch extends DurableObject {
 async get(){return await this.ctx.storage.get('match')||null;}
 async put(value){
  // Store final per-color Elo receipts together with the immutable finished
  // match. Later updates to the Elo formula must never reprice past results.
  // Historic staging v1 records cannot create new trusted ranked credits.
  await this.ctx.storage.put('match',value);
  if(!value.result)await this.ctx.storage.setAlarm(Date.now()+Math.max(1000,value.remaining[value.turn]));
  if(value.result&&value.ratingVersion===2&&value.rated)await this.settle(value);

 }
 async settle(match){
  if(!match.rated||match.ratingVersion!==2||!match.result)return match;
  const receipts={...(match.ratings||{})};
  for(const player of match.players){
   if(receipts[player.color])continue;
   const rival=match.players.find(p=>p.color!==player.color);
   const score=match.result.winner==null?.5:match.result.winner===player.color?1:0;
   // Only this match Durable Object may send a settlement to an account DO.
   // Account DO owns atomic Power + an unbounded idempotency receipt key.
   receipts[player.color]=await accountCall(this.env,player.id,'/settle',{
    receiptId:'tournament:'+match.id+':'+player.color,opponentElo:rival.power,
    result:score,opponentId:rival.id
   });
  }
  match.ratings=receipts;
  await this.ctx.storage.put('match',match);
  return match;
 }
 reconstruct(match){
  const engine=new ClassicChessEngine();
  for(const mv of match.moves) {const result=engine.move(mv.from,mv.to,mv.promotion||null);if(!result.ok)throw Error('Corrupted match history');}
  return engine;
 }
 async advance(m,now){
  if(m.result)return m;
  const elapsed=Math.max(0,now-m.tick);
  m.remaining[m.turn]=Math.max(0,m.remaining[m.turn]-elapsed);
  m.tick=now;
  if(m.remaining[m.turn]<=0){m.result={kind:'timeout',winner:m.turn==='w'?'b':'w',at:now};await this.put(m);}
  return m;
 }
 snapshot(m,uid){
  const player=m.players.find(p=>p.id===uid);
  if(!player)return {error:'not_a_player'};
  const engine=this.reconstruct(m);
  return {status:m.result?'finished':'playing',matchId:m.id,playerColor:player.color,
    players:m.players.map(p=>({name:p.name,color:p.color,race:p.race,power:p.power,
      displayPower:displayPower(p.displayPower),commanderId:safeCommander(p.commanderId)})),
    fen:engine.fen(),moves:m.moves,turn:m.turn,remaining:m.remaining,
    serverTime:Date.now(),tick:m.tick,result:m.result,drawOffer:m.drawOffer||null,
    rated:Boolean(m.rated&&m.ratingVersion===2),
    rating:m.ratingVersion===2&&m.rated?m.ratings?.[player.color]||null:null};
 }
 async fetch(request){
  const path=new URL(request.url).pathname,body=await request.json(),now=Date.now();
  if(path==='/init'){
   if(await this.get())return problem('already_initialized',409);
   if(!/^[0-9a-f-]{36}$/.test(body.id||'')||
      !Array.isArray(body.players)||body.players.length!==2||body.players[0].id===body.players[1].id)
    return problem('invalid_players',400);
   const rated=Boolean(body.rated)&&body.players.every(p=>isVerified(p,this.env));
   const match={id:body.id,ratingVersion:2,rated,players:body.players,remaining:{w:CONTROL,b:CONTROL},tick:now,turn:'w',moves:[],drawOffer:null,result:null};
   await this.put(match);return json({ok:true});
  }
  let m=await this.get();if(!m)return problem('match_not_found',404);
  const uid=body.user?.id,player=m.players.find(p=>p.id===uid);
  if(!player)return problem('not_a_player',403);
  m=await this.advance(m,now);
  // Retry a partially committed cross-account settlement after a restart.
  // Each account applies each receipt only once, even if one side failed.
  if(m.result&&m.rated&&m.ratingVersion===2&&!m.ratings){
   try{m=await this.settle(m);}catch(error){console.error('Rating settlement retry',error);}
  }
  if(path==='/snapshot')return json(this.snapshot(m,uid));
  if(m.result)return json(this.snapshot(m,uid));
  if(path==='/move'){
   if(player.color!==m.turn)return problem('not_your_turn',409);
   if(m.moves.length>=MAX_MOVES)return problem('move_limit',409);
   const from=String(body.from||''),to=String(body.to||''),promotion=body.promotion||null;
   if(!/^[a-h][1-8]$/.test(from)||!/^[a-h][1-8]$/.test(to))return problem('invalid_square',400);
   const engine=this.reconstruct(m),applied=engine.move(from,to,promotion);
   if(!applied.ok)return problem(applied.reason,409);
   m.moves.push({from,to,promotion});
   m.turn=engine.turn();m.drawOffer=null;m.tick=now;
   if(applied.status.over)m.result={kind:applied.status.type,winner:applied.status.winner,at:now};
   await this.put(m);return json(this.snapshot(m,uid));
  }
  if(path==='/resign'){m.result={kind:'resign',winner:player.color==='w'?'b':'w',at:now};await this.put(m);return json(this.snapshot(m,uid));}
  if(path==='/draw'){
   if(m.drawOffer&&m.drawOffer!==player.color){m.result={kind:'agreement',winner:null,at:now};m.drawOffer=null;}else{m.drawOffer=player.color;}
   await this.put(m);return json(this.snapshot(m,uid));
  }
  return problem('not_found',404);
 }
 async alarm(){let m=await this.get();if(m)await this.advance(m,Date.now());}
}

// One SQLite-backed Durable Object per verified VK player. This class is
// never dispatched to from an HTTP client route; only Worker-internal stubs.
export class TournamentAccount extends DurableObject {
 async fetch(request){
  const path=new URL(request.url).pathname;
  const body=await request.json().catch(()=>({}));
  if(path==='/profile'){
   const profile=await this.ctx.storage.get('profile')||{power:500,ratedGames:0};
   return json({power:profile.power,ratedGames:profile.ratedGames});
  }
  if(path!=='/settle')return problem('not_found',404);
  const id=String(body.receiptId||''),opponent=String(body.opponentId||'');
  if(!/^tournament:[0-9a-f-]{36}:[wb]$/.test(id)||!/^vk:[1-9]\d*$/.test(opponent)||
    ![0,.5,1].includes(body.result)||!Number.isInteger(body.opponentElo))
   return problem('invalid_receipt',400);
  const receipt=await this.ctx.storage.transaction(async tx=>{
   const existing=await tx.get('receipt:'+id);
   if(existing)return existing;
   const profile=await tx.get('profile')||{power:500,ratedGames:0};
   const before=normalizePower(profile.power);
   const opponentElo=safePower(body.opponentElo);
   const delta=ratingDelta(before,opponentElo,body.result);
   const after=Math.max(0,before+delta);
   const record={id,before,after,delta:after-before,opponentElo,result:body.result};
   await tx.put('receipt:'+id,record);
   await tx.put('profile',{power:after,ratedGames:profile.ratedGames+1,updatedAt:Date.now()});
   return record;
  });
  return json(receipt);
 }
}
