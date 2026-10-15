import { bestChronicleRun, readChronicle } from './chronicle-core.mjs';

const CACHE_MS=30_000;
let board={top:[],me:null,status:'unavailable'};
let cachedAt=0;
let pending=null;
let lastUpload='';
let uploading=null;
function apiRoot(){
  const explicit=globalThis.RPChessLeaderboardAPI || globalThis.document?.querySelector?.('meta[name="rpchess-leaderboard-api"]')?.content || '';
  const url=String(explicit).trim().replace(/\/+$/,'');
  return /^https:\/\//.test(url) ? url : '';
}
function vkLaunch(){
  const p=new URLSearchParams(globalThis.location?.search||'');
  return p.has('sign')&&p.has('vk_app_id')&&p.has('vk_user_id')?
    '?'+p.toString():'';
}
function normalize(data){
  if(!data||!Array.isArray(data.top))throw new Error('Invalid leaderboard response');
  const top=data.top.slice(0,10).filter(row=>Number.isSafeInteger(row.rank)&&row.rank>0&&
    typeof row.name==='string'&&Number.isSafeInteger(row.glory)&&row.glory>=0)
    .map(row=>({rank:row.rank,name:row.name.slice(0,24),glory:row.glory}));
  const me=data.me&&Number.isSafeInteger(data.me.rank)&&data.me.rank>0&&
    Number.isSafeInteger(data.me.glory)&&data.me.glory>=0
    ?{rank:data.me.rank,name:String(data.me.name||'').slice(0,24),glory:data.me.glory}:null;
  return {top,me,status:'ready'};
}
async function request(path,body=null){
  const root=apiRoot();
  if(!root)throw new Error('No leaderboard API configured');
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),8500);
  try{
    const response=await fetch(root+path,{
      method:body?'POST':'GET',
      ...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),
      signal:ac.signal,
      cache:'no-store'
    });
    if(!response.ok)throw new Error('Leaderboard API HTTP '+response.status);
    return normalize(await response.json());
  }finally{clearTimeout(timer);}
}
function changed(next){
  board=next;cachedAt=Date.now();
  if(typeof globalThis.dispatchEvent==='function'&&typeof CustomEvent!=='undefined')
    globalThis.dispatchEvent(new CustomEvent('rpchess:leaderboard-updated',{detail:{status:next.status}}));
  return next;
}
function currentLeaderboard(){return board;}
async function loadLeaderboard({force=false}={}){
  if(!apiRoot())return changed({top:[],me:null,status:'unavailable'});
  if(!force&&Date.now()-cachedAt<CACHE_MS)return board;
  if(pending)return pending;
  pending=(async()=>{
    try{
      const launch=vkLaunch();
      return changed(await request(launch?'/v1/leaderboard/view':'/v1/leaderboard',launch?{launch}:null));
    }catch(error){
      console.warn('[RPChess] leaderboard read failed',error);
      return changed({top:[],me:null,status:'offline'});
    }finally{pending=null}
  })();
  return pending;
}
async function submitBestChronicle(){
  const launch=vkLaunch(),best=bestChronicleRun(readChronicle());
  if(!apiRoot()||!launch||!best)return {status:'unavailable'};
  const key=best.runId+':'+best.glory+':'+best.week+':'+best.power;
  if(lastUpload===key)return {status:'already-submitted'};
  if(uploading)return uploading;
  uploading=(async()=>{try{
    const next=await request('/v1/leaderboard/submit',{launch,record:{
      runId:best.runId,playerName:best.playerName,
      glory:best.glory,week:best.week,power:best.power
    }});
    lastUpload=key;
    changed(next);
    return {status:'submitted'};
  }catch(error){
    console.warn('[RPChess] leaderboard submit failed',error);
    return {status:'error'};
  }finally{uploading=null;}})();
  return uploading;
}
export {currentLeaderboard,loadLeaderboard,submitBestChronicle};
