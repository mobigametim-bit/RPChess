// RPChess unified profiles — a NEW Worker, not Tournament or leaderboard.
// Only rpchess_profile_v1 and rpchess_profile_token_v1 in D1 may be accessed.
// All credentials are opaque random capabilities; a public RPChess ID never grants access.
// Client-supplied progress is UNVERIFIED, so it must not award rated PvP/leaderboard prizes.
import { verifiedVKId } from '../../leaderboard-worker/src/index.mjs';
import { readUnifiedBoard,refreshProfileBoard } from './unified-board.mjs';

const APP_ID='54754579';
const TOKEN_LIFETIME_MS=400*86400000;
const VK_LAUNCH_MAX_AGE=3600;
const MAX_BODY_BYTES=300000;
const MAX_SAVE_BYTES=260000;
const MAX_IMPORT_BYTES=190000;
const DEFAULT_ORIGINS=[
  'https://mobigametim-bit.github.io',
  'https://rpchess-gamepush-preview.mobigametim.workers.dev',
  'https://rpchess-profile-game-preview.mobigametim.workers.dev'
];

const now=()=>Date.now();
const encode=value=>btoa(String.fromCharCode(...value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const randomToken=()=>{const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return encode(bytes);};
const bytes=value=>new TextEncoder().encode(String(value));
async function hashToken(token) {
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(token)));
  return [...digest].map(b=>b.toString(16).padStart(2,'0')).join('');
}
const response=(data,status=200,headers={})=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}
});
function originAllowed(origin,extra='') {
  if(!origin)return true; // Non-browser probes still require a valid bearer token.
  const list=new Set([...DEFAULT_ORIGINS,...String(extra).split(',').map(s=>s.trim()).filter(Boolean)]);
  if(list.has(origin))return true;
  let parsed;
  try{parsed=new URL(origin);}catch{return false;}
  if(parsed.origin!==origin||parsed.protocol!=='https:')return false;
  // VK hosts only for this exact app; never wildcard all vk-apps projects.
  return /^(?:(?:stage|prod)-)?app54754579(?:-[a-z0-9]+)?\.pages\.vk-apps\.(?:ru|com)$/i.test(parsed.hostname);
}
async function parse(request,maxBytes=MAX_BODY_BYTES) {
  const size=Number(request.headers.get('content-length')||0);
  if(size>maxBytes)throw Object.assign(new Error('request_too_large'),{status:413});
  const raw=await request.text();
  if(bytes(raw).length>maxBytes)throw Object.assign(new Error('request_too_large'),{status:413});
  let data;
  try{data=JSON.parse(raw);}catch{throw Object.assign(new Error('invalid_json'),{status:400});}
  if(!data||typeof data!=='object'||Array.isArray(data))throw Object.assign(new Error('invalid_body'),{status:400});
  return data;
}
function shapeOfSnapshot(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||value.schemaVersion!==1)return false;
  if(value.run!=null&&(typeof value.run!=='object'||Array.isArray(value.run)))return false;
  if(value.chronicle!=null&&(!Array.isArray(value.chronicle?.history)||value.chronicle.history.length>20))return false;
  if(value.arena!=null&&(!Array.isArray(value.arena?.events)||value.arena.events.length>12000))return false;
  if(value.rating!=null&&(!Number.isFinite(value.rating?.power)||value.rating.power<0||value.rating.power>1000000))return false;
  return true;
}
function safeSnapshot(value,limit=MAX_SAVE_BYTES) {
  if(!shapeOfSnapshot(value))return null;
  const raw=JSON.stringify(value);
  return bytes(raw).length<=limit?raw:null;
}
function unpack(raw) {
  try{const p=JSON.parse(raw);return shapeOfSnapshot(p)?p:null;}catch{return null;}
}
function profileResult(row) {
  return {id:row.id,provider:row.provider,revision:row.revision,
    migratedVK:row.migrated_vk_v1===1,snapshot:unpack(row.snapshot_json)||{schemaVersion:1},
    updatedAt:row.updated_at};
}
async function verifiedVKLaunch(raw,secret) {
  if(!secret||typeof raw!=='string'||raw.length>3000)return null;
  const params=new URLSearchParams(raw.startsWith('?')?raw.slice(1):raw);
  if(params.get('vk_app_id')!==APP_ID)return null;
  const ts=Number(params.get('vk_ts'));
  if(!Number.isSafeInteger(ts)||Math.abs(now()/1000-ts)>VK_LAUNCH_MAX_AGE)return null;
  return await verifiedVKId(raw,secret);
}
async function readProfile(db,id) {
  return db.prepare('SELECT id,provider,vk_user_id,snapshot_json,revision,migrated_vk_v1,created_at,updated_at FROM rpchess_profile_v1 WHERE id=?').bind(id).first();
}
async function tokenOwner(db,token) {
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
  const digest=await hashToken(token);
  const hit=await db.prepare('SELECT profile_id FROM rpchess_profile_token_v1 WHERE token_hash=? AND expires_at>?').bind(digest,now()).first();
  if(!hit)return null;
  return readProfile(db,hit.profile_id);
}
async function mintToken(db,playerId) {
  const token=randomToken(),date=now();
  await db.prepare('INSERT INTO rpchess_profile_token_v1(token_hash,profile_id,expires_at,created_at) VALUES(?,?,?,?)')
    .bind(await hashToken(token),playerId,date+TOKEN_LIFETIME_MS,date).run();
  return token;
}
async function openSession(db,body,env) {
  let row=null,token='';
  if(Object.hasOwn(body,'vkLaunch')) {
    const vkId=await verifiedVKLaunch(body.vkLaunch,env.VK_APP_SECRET);
    if(!vkId)return {error:'vk_signature_required',status:401};
    const id=crypto.randomUUID(),date=now();
    await db.prepare('INSERT INTO rpchess_profile_v1(id,provider,vk_user_id,snapshot_json,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(vk_user_id) DO NOTHING')
      .bind(id,'vk',vkId,'{"schemaVersion":1}',date,date).run();
    row=await db.prepare('SELECT id,provider,vk_user_id,snapshot_json,revision,migrated_vk_v1,created_at,updated_at FROM rpchess_profile_v1 WHERE vk_user_id=?')
      .bind(vkId).first();
    token=await mintToken(db,row.id);
  } else if(Object.hasOwn(body,'accessToken')){
    row=await tokenOwner(db,body.accessToken);
    if(!row)return {error:'session_expired',status:401};
    token=body.accessToken;
    await db.prepare('UPDATE rpchess_profile_token_v1 SET expires_at=? WHERE token_hash=?')
      .bind(now()+TOKEN_LIFETIME_MS,await hashToken(token)).run();
  } else {
    const id=crypto.randomUUID(),date=now();
    await db.prepare('INSERT INTO rpchess_profile_v1(id,provider,snapshot_json,created_at,updated_at) VALUES(?,?,?,?,?)')
      .bind(id,'web','{"schemaVersion":1}',date,date).run();
    row=await readProfile(db,id);
    token=await mintToken(db,row.id);
  }
  return {token,profile:profileResult(row)};
}
async function withAuth(request,db) {
  const header=request.headers.get('Authorization')||'';
  const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(header);
  if(!match)return null;
  return await tokenOwner(db,match[1]);
}
function cleanLegacyMeta(data) {
  if(!data||typeof data!=='object'||Array.isArray(data))return null;
  const r=data.rating;
  if(!r||!Number.isSafeInteger(r.power)||r.power<0||r.power>1000000)return null;
  const history=data.chronicle?.history||[];
  const events=data.arena?.events||[];
  if(!Array.isArray(history)||history.length>20||!Array.isArray(events)||events.length>12000)return null;
  const safe={
    rating:{...r},
    chronicle:{schemaVersion:1,history},
    arena:{...data.arena,match:null}
  };
  return bytes(JSON.stringify(safe)).length<=MAX_IMPORT_BYTES?safe:null;
}
function mergeLegacy(snapshot,legacy) {
  const updated={...snapshot,schemaVersion:1};
  const activeRating=Number(snapshot?.rating?.power);
  const keepExistingPower=Number.isFinite(activeRating)&&activeRating!==500;
  const ratings=new Map();
  for(const receipt of [...(legacy.rating?.receipts||[]),...(snapshot?.rating?.receipts||[])])
    if(typeof receipt?.id==='string'&&receipt.id)ratings.set(receipt.id,receipt);
  updated.rating={
    ...legacy.rating,...(snapshot?.rating||{}),
    power:keepExistingPower?activeRating:legacy.rating.power,
    receipts:[...ratings.values()].slice(-2048)
  };
  const history=new Map();
  for(const row of [...(legacy.chronicle?.history||[]),...(snapshot?.chronicle?.history||[])])
    if(row&&typeof row.runId==='string')history.set(row.runId,row);
  updated.chronicle={schemaVersion:1,history:[...history.values()].slice(-20)};
  const eventMap=new Map();
  for(const event of [...(legacy.arena?.events||[]),...(snapshot?.arena?.events||[])])
    if(event&&typeof event.id==='string')eventMap.set(event.id,event);
  updated.arena={...legacy.arena,...(snapshot.arena||{}),events:[...eventMap.values()],match:snapshot.arena?.match||null};
  // IMPORTANT: never import the OLD unfinished run or unfinished Arena match.
  return updated;
}
async function save(db,row,body) {
  if(!Number.isSafeInteger(body.revision)||body.revision<0)return {error:'invalid_revision',status:422};
  const json=safeSnapshot(body.snapshot);
  if(!json)return {error:'invalid_snapshot',status:422};
  if(body.revision!==row.revision)return {error:'revision_conflict',status:409,profile:profileResult(row)};
  if(json===row.snapshot_json)return {profile:profileResult(row)};
  const at=now();
  const result=await db.prepare('UPDATE rpchess_profile_v1 SET snapshot_json=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?')
    .bind(json,at,row.id,row.revision).run();
  if(result.meta?.changes!==1)return {error:'revision_conflict',status:409,profile:profileResult(await readProfile(db,row.id))};
  return {profile:profileResult(await readProfile(db,row.id))};
}
async function importVK(db,row,body) {
  if(row.provider!=='vk')return {error:'vk_identity_required',status:403};
  // An early preview might have seen a valid but empty legacy snapshot and
  // already set the migrated marker. Allow a subsequent richer VK read to
  // enrich the SAME profile. Merging is receipt-idempotent and CAS-protected;
  // old active runs and old Arena matches are never imported.
  const legacy=cleanLegacyMeta(body.meta);
  if(!legacy)return {error:'invalid_legacy_meta',status:422};
  const merged=mergeLegacy(unpack(row.snapshot_json)||{schemaVersion:1},legacy);
  const json=safeSnapshot(merged);
  if(!json)return {error:'meta_limit_exceeded',status:422};
  if(row.migrated_vk_v1===1 && json===row.snapshot_json)
    return {profile:profileResult(row),alreadyImported:true};
  const at=now();
  const result=await db.prepare('UPDATE rpchess_profile_v1 SET snapshot_json=?,revision=revision+1,migrated_vk_v1=1,updated_at=? WHERE id=? AND revision=?')
    .bind(json,at,row.id,row.revision).run();
  if(result.meta?.changes!==1)return {error:'revision_conflict',status:409,profile:profileResult(await readProfile(db,row.id))};
  return {profile:profileResult(await readProfile(db,row.id)),alreadyImported:false,recovered:row.migrated_vk_v1===1};
}
async function handler(request,env) {
  const origin=request.headers.get('Origin');
  if(!originAllowed(origin,env.ALLOWED_ORIGINS))return response({error:'origin_forbidden'},403);
  const cors=origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{
    ...cors,'Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'
  }});
  const path=new URL(request.url).pathname;
  if(path==='/health'&&request.method==='GET')
    return response({ok:Boolean(env.DB),service:'rpchess-profile-preview',version:1},env.DB?200:503,cors);
  if(!env.DB)return response({error:'d1_not_configured'},503,cors);
  // Public cross-platform TOP-10; a valid bearer additionally reveals own rank.
  if(path==='/v1/leaderboard'&&request.method==='GET'){
    const tokenHeader=request.headers.get('Authorization');
    const player=tokenHeader?await withAuth(request,env.DB):null;
    if(tokenHeader&&!player)return response({error:'unauthorized'},401,cors);
    return response(await readUnifiedBoard(env.DB,player),200,cors);
  }
  if(path==='/v1/session'&&request.method==='POST'){
    const body=await parse(request,10000);
    const result=await openSession(env.DB,body,env);
    const {status=200,...data}=result;
    return response(data,status,cors);
  }
  if(!['/v1/profile','/v1/vk-import','/v1/leaderboard/refresh','/v1/tournament-binding'].includes(path))return response({error:'not_found'},404,cors);
  const row=await withAuth(request,env.DB);
  if(!row)return response({error:'unauthorized'},401,cors);
  // Tournament may redeem this bearer only server-side. It cannot bind an
  // arbitrary browser-provided ID, and public RPChess IDs are never credentials.
  if(path==='/v1/tournament-binding'&&request.method==='GET'){
    // Read a player's appearance from their authenticated D1 save; never
    // allow a Tournament client to declare another player's name or portrait.
    const data=unpack(row.snapshot_json)||{schemaVersion:1};
    const history=Array.isArray(data.chronicle?.history)?data.chronicle.history:[];
    const last=history.slice().sort((a,b)=>(b?.completedAt||0)-(a?.completedAt||0))[0];
    const appearance=data.run?.playerName?data.run:last||{};
    const name=String(appearance.playerName||'Воин').trim().slice(0,24)||'Воин';
    const commanders=['oathkeeper','stone_crown','wanderer_queen','pilgrim','fox_prince','ash_regent','nameless_heir'];
    const commanderId=commanders.includes(appearance.commanderId)?appearance.commanderId:'oathkeeper';
    const displayPower=Number.isSafeInteger(data.rating?.power)
      ?Math.min(1000000,Math.max(0,data.rating.power)):500;
    return response({id:row.id,provider:row.provider,
      vkUserId:row.provider==='vk'?row.vk_user_id:null,
      name,commanderId,displayPower},200,cors);
  }
  if(path==='/v1/leaderboard/refresh'&&request.method==='POST'){
    await refreshProfileBoard(env.DB,row);
    return response(await readUnifiedBoard(env.DB,row),200,cors);
  }
  if(path==='/v1/profile'&&request.method==='GET')return response({profile:profileResult(row)},200,cors);
  if(path==='/v1/profile'&&request.method==='PUT'){
    const body=await parse(request);
    const result=await save(env.DB,row,body);
    const {status=200,...data}=result;
    return response(data,status,cors);
  }
  if(path==='/v1/vk-import'&&request.method==='POST'){
    const body=await parse(request);
    const result=await importVK(env.DB,row,body);
    const {status=200,...data}=result;
    return response(data,status,cors);
  }
  return response({error:'method_not_allowed'},405,cors);
}
export default {async fetch(request,env) {
  try{return await handler(request,env);}
  catch(error) {
    if(Number.isInteger(error?.status))return response({error:error.message},error.status);
    // Do not log request bodies, tokens, signed VK launch values or identities.
    console.error('RPChess profile Worker failed:',String(error?.message||error).slice(0,120));
    return response({error:'server_unavailable'},503);
  }
}};
export {handler,hashToken,verifiedVKLaunch,originAllowed,cleanLegacyMeta,mergeLegacy,shapeOfSnapshot};
