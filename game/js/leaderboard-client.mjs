import { bestChronicleRun, readChronicle } from './chronicle-core.mjs';
import {normalizeCommanderId} from './commander-portraits.mjs';

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
const VK_APP_ID='54754579';
let signedLaunch='';
let launchPending=null;

// Rebuild the signed VK parameter set without inventing an identity; the
// Worker alone decides whether the supplied signature is authentic.
function signedLaunchQuery(data){
  let p;
  try{
    if(typeof data==='string')p=new URLSearchParams(data.replace(/^\?/,''));
    else if(data&&typeof data==='object')p=new URLSearchParams(Object.entries(data)
      .filter(([key,value])=>(key.startsWith('vk_')||key==='sign')&&value!==undefined&&value!==null)
      .map(([key,value])=>[key,String(value)]));
    else return '';
    if(p.get('vk_app_id')!==VK_APP_ID||!/^[1-9]\d*$/.test(p.get('vk_user_id')||'')||!p.get('sign'))return '';
    const query=new URLSearchParams([...p].filter(([key])=>key.startsWith('vk_')||key==='sign'));
    return '?'+query.toString();
  }catch{return ''}
}
async function vkLaunch(){
  const fromUrl=signedLaunchQuery(globalThis.location?.search||'');
  if(fromUrl)return fromUrl;
  if(signedLaunch)return signedLaunch;
  if(launchPending)return launchPending;
  // Mobile VK may open its internal WebView without propagating launch search
  // parameters. VK Bridge supplies the complete *signed* launch object.
  const host=globalThis.RPChessPlatform;
  if(!host?.launch?.isVK?.()||typeof host?.bridge?.request!=='function')return '';
  launchPending=(async()=>{
    try{
      const result=await host.bridge.request('VKWebAppGetLaunchParams',{}, {timeoutMs:4500});
      signedLaunch=signedLaunchQuery(result);
      if(!signedLaunch)console.warn('[RPChess] VK Bridge returned no signed launch parameters');
      return signedLaunch;
    }catch(error){
      console.warn('[RPChess] signed VK launch unavailable from bridge',String(error?.message||error));
      return '';
    }finally{launchPending=null}
  })();
  return launchPending;
}
function normalize(data){
  if(!data||!Array.isArray(data.top))throw new Error('Invalid leaderboard response');
  const top=data.top.slice(0,10).filter(row=>Number.isSafeInteger(row.rank)&&row.rank>0&&
    typeof row.name==='string'&&Number.isSafeInteger(row.glory)&&row.glory>=0)
    .map(row=>({rank:row.rank,name:row.name.slice(0,24),glory:row.glory,commanderId:normalizeCommanderId(row.commanderId)}));
  const me=data.me&&Number.isSafeInteger(data.me.rank)&&data.me.rank>0&&
    Number.isSafeInteger(data.me.glory)&&data.me.glory>=0
    ?{rank:data.me.rank,name:String(data.me.name||'').slice(0,24),glory:data.me.glory,commanderId:normalizeCommanderId(data.me.commanderId)}:null;
  return {top,me,status:'ready',viewerAuthenticated:Boolean(data.viewerAuthenticated||me)};
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
  if(!force&&Date.now()-cachedAt<(board.status==='offline'?5000:CACHE_MS))return board;
  if(pending)return pending;
  pending=(async()=>{
    try{
      const launch=await vkLaunch();
      if(!launch)return changed(await request('/v1/leaderboard'));
      try{
        return changed(await request('/v1/leaderboard/view',{launch}));
      }catch(error){
        // VK mobile may reject an authenticated POST even when public reads
        // work (WebView transport, preflight or stale signed launch). Keep the
        // public top ten visible; only personal position requires VK auth.
        console.warn('[RPChess] personal leaderboard lookup unavailable; retrying public top ten',error);
        return changed(await request('/v1/leaderboard'));
      }
    }catch(error){
      console.warn('[RPChess] leaderboard read failed',error);
      return changed({top:[],me:null,status:'offline'});
    }finally{pending=null}
  })();
  return pending;
}
async function submitBestChronicle(){
  const best=bestChronicleRun(readChronicle());
  if(!apiRoot()||!best)return {status:'unavailable'};
  const launch=await vkLaunch();
  if(!launch)return {status:'unavailable'};
  const key=best.runId+':'+best.glory+':'+best.week+':'+best.power+':'+best.commanderId;
  if(lastUpload===key)return {status:'already-submitted'};
  if(uploading)return uploading;
  uploading=(async()=>{try{
    const next=await request('/v1/leaderboard/submit',{launch,record:{
      runId:best.runId,playerName:best.playerName,commanderId:best.commanderId,
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
export {currentLeaderboard,loadLeaderboard,submitBestChronicle,signedLaunchQuery};
