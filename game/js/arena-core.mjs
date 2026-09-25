import { RACE_TAGS, PIECE_TYPES, racePiecePath } from './race-assets.mjs';
import { ARTIFACTS } from './artifact-core.mjs';

const ARENA_KEY = 'rpchess.reboot.v1.arena';
const SHARD_ICON = 'assets/arena/mirror_shard.png';
const PIECE_CODE = Object.freeze({ pawn:'p', knight:'n', bishop:'b', rook:'r', queen:'q', king:'k' });
const OPPONENTS = Object.freeze(PIECE_TYPES.flatMap((type, typeIndex) => RACE_TAGS.map((race, raceIndex) => {
  const index = typeIndex * RACE_TAGS.length + raceIndex;
  return Object.freeze({ id:`${type}:${race}`, index, section:Math.floor(index / 7), race, type, elo:Math.round((400 + 2200 * index / 83) / 10) * 10, art:racePiecePath(race,type,'b') });
})));
const OPPONENT_BY_ID = new Map(OPPONENTS.map(foe => [foe.id,foe]));
const LEGACY_SQUAD_PRICES = Object.freeze(Object.fromEntries(RACE_TAGS.slice(1).map((race,index) => [race,60 + index * 20])));
const SQUAD_PRICES = Object.freeze(Object.fromEntries(RACE_TAGS.slice(1).map((race,index) => [race,120 + index * 40])));
const ARTIFACT_PRICES = Object.freeze({ 'threat.defense':8, 'threat.attack':8, 'threat.great':14 });
function emptyArena(){ return { version:1, events:[], squad:'humans', match:null, updatedAt:0 }; }
function safeInt(n){ return Number.isSafeInteger(n) && n >= 0 ? n : 0; }
function validEvent(event){
  if(!event || typeof event.id!=='string' || !/^[\w:.\-]{1,100}$/.test(event.id) || !['win','loss','draw','ad','squad','artifact'].includes(event.kind) || !Number.isSafeInteger(event.at) || event.at<0) return false;
  if(['win','loss','draw'].includes(event.kind)) return OPPONENT_BY_ID.has(event.foe) && safeInt(event.amount)===event.amount && event.amount<=500;
  if(event.kind==='ad') return OPPONENT_BY_ID.has(event.foe) && safeInt(event.amount)===event.amount && event.amount<=500;
  if(event.kind==='squad') return SQUAD_PRICES[event.race]!==undefined && (event.amount===SQUAD_PRICES[event.race] || event.amount===LEGACY_SQUAD_PRICES[event.race]);
  return Boolean(ARTIFACTS.find(a=>a.id===event.artifact)) && event.amount===ARTIFACT_PRICES[event.artifact];
}
function normalizeArena(raw){
  if(!raw || raw.version!==1) return emptyArena();
  const seen = new Set();
  const events = (Array.isArray(raw.events)?raw.events:[]).filter(event=>{
    if(!validEvent(event)||seen.has(event.id))return false;
    seen.add(event.id);return true;
  }).sort((a,b)=>a.at-b.at || a.id.localeCompare(b.id));
  const match=raw.match && typeof raw.match.id==='string' && /^[\w:.\-]{1,100}$/.test(raw.match.id) && OPPONENT_BY_ID.has(raw.match.foe) && RACE_TAGS.includes(raw.match.squad) && ['offer','playing','result'].includes(raw.match.phase) && Array.isArray(raw.match.moves) && raw.match.moves.length<=1000 && raw.match.moves.every(move=>/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) ? {
    id:raw.match.id,foe:raw.match.foe,squad:raw.match.squad,playerColor:raw.match.playerColor==='b'?'b':'w',phase:raw.match.phase,moves:raw.match.moves.slice(),artifactId:ARTIFACT_PRICES[raw.match.artifactId]!==undefined?raw.match.artifactId:null,
    outcome:['win','loss','draw'].includes(raw.match.outcome)?raw.match.outcome:null, reward:safeInt(raw.match.reward), at:safeInt(raw.match.at)
  }:null;
  return { version:1, events, squad:RACE_TAGS.includes(raw.squad)?raw.squad:'humans', match, updatedAt:safeInt(raw.updatedAt) };
}
function arenaSummary(state){
  const stats=Object.fromEntries(OPPONENTS.map(foe=>[foe.id,{wins:0,losses:0,draws:0}]));
  const owned=new Set(['humans']);let balance=0,highest=0;
  const accepted=new Set(),bonuses=[];
  for(const event of normalizeArena(state).events){
    if(event.kind==='squad'){
      if(owned.has(event.race)||balance<event.amount)continue;
      owned.add(event.race);balance-=event.amount;
    } else if(event.kind==='artifact'){
      if(balance<event.amount)continue;
      balance-=event.amount;
    } else if(event.kind==='win'){
      stats[event.foe].wins++;
      highest=Math.max(highest,Math.min(83,OPPONENT_BY_ID.get(event.foe).index+1));
      balance+=event.amount;
    } else if(event.kind==='loss')stats[event.foe].losses++;
    else if(event.kind==='draw')stats[event.foe].draws++;
    else if(event.kind==='ad')bonuses.push(event);
    accepted.add(event.id);
  }
  for(const bonus of bonuses)if(accepted.has(`${bonus.id.slice(0,-3)}:win`))balance+=bonus.amount;
  return {balance,owned,highest,stats,accepted};
}
function addEvent(state,event){
  const normalized=normalizeArena(state);
  if(!validEvent(event)||normalized.events.some(item=>item.id===event.id))return normalized;
  return {...normalized,events:[...normalized.events,event],updatedAt:Date.now()};
}
function mergeArena(local,remote){
  const a=normalizeArena(local),b=normalizeArena(remote),byId=new Map();
  for(const event of [...b.events,...a.events]) byId.set(event.id,event);
  const latest=a.updatedAt>=b.updatedAt?a:b;
  const merged=normalizeArena({...latest,events:[...byId.values()],updatedAt:Math.max(a.updatedAt,b.updatedAt)});
  if(merged.match?.artifactId && !arenaSummary(merged).accepted.has(`${merged.match.id}:artifact`))merged.match.artifactId=null;
  return merged;
}
function rewardFor(foe,first){ return (first?30:10)+Math.floor(foe.index/7)*(first?5:2); }
function newMatch(state,foeId,id,playerColor=Math.random()<.5?'w':'b'){
  const summary=arenaSummary(state),foe=OPPONENT_BY_ID.get(foeId);
  if(!foe||foe.index>summary.highest||state.match||!summary.owned.has(state.squad)||!id)return state;
  return {...normalizeArena(state),match:{id,foe:foeId,squad:state.squad,playerColor:playerColor==='b'?'b':'w',phase:'offer',moves:[],artifactId:null,outcome:null,reward:0,at:Date.now()},updatedAt:Date.now()};
}
function chooseArtifact(state,artifactId){
  if(state.match?.phase!=='offer')return state;
  const receipt=normalizeArena(state).events.find(event=>event.id===`${state.match.id}:artifact`);
  if(receipt)return {...state,match:{...state.match,phase:'playing',artifactId:arenaSummary(state).accepted.has(receipt.id)?receipt.artifact:null},updatedAt:Date.now()};
  const price=artifactId==null?0:ARTIFACT_PRICES[artifactId];
  if(price===undefined||arenaSummary(state).balance<price)return state;
  let next=state;
  if(price)next=addEvent(next,{id:`${state.match.id}:artifact`,kind:'artifact',artifact:artifactId,amount:price,at:Date.now()});
  return {...next,match:{...state.match,phase:'playing',artifactId:artifactId||null},updatedAt:Date.now()};
}
function finishMatch(state,outcome){
  if(!state.match||!['playing','result'].includes(state.match.phase)||!['win','loss','draw'].includes(outcome)||state.match.phase==='result')return state;
  const foe=OPPONENT_BY_ID.get(state.match.foe),summary=arenaSummary(state);
  const amount=outcome==='win'?rewardFor(foe,summary.stats[foe.id].wins===0):0;
  const next=addEvent(state,{id:`${state.match.id}:${outcome}`,kind:outcome,foe:foe.id,amount,at:Date.now()});
  return {...next,match:{...next.match,phase:'result',outcome,reward:amount},updatedAt:Date.now()};
}
function claimDouble(state){
  const match=state.match;
  if(match?.phase!=='result'||match.outcome!=='win')return state;
  return addEvent(state,{id:`${match.id}:ad`,kind:'ad',foe:match.foe,amount:match.reward,at:Date.now()});
}
function purchaseSquad(state,race,transactionId=globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)){
  const price=SQUAD_PRICES[race];if(!price||arenaSummary(state).owned.has(race)||arenaSummary(state).balance<price)return state;
  return addEvent(state,{id:`squad:${race}:${transactionId}`,kind:'squad',race,amount:price,at:Date.now()});
}
export { ARENA_KEY,SHARD_ICON,PIECE_CODE,OPPONENTS,OPPONENT_BY_ID,SQUAD_PRICES,ARTIFACT_PRICES,emptyArena,normalizeArena,arenaSummary,addEvent,mergeArena,rewardFor,newMatch,chooseArtifact,finishMatch,claimDouble,purchaseSquad };
