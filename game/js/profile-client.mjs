// Unified RPChess ID + D1 snapshot sync. Opt-in only (?rpchess_profile=1).
// VK signature is verified by OUR server; no login/registration UI.
// GamePush is optional. Yandex is deliberately not integrated in this phase.
import { platform, discoverVKHost } from './platform.mjs';
import { localPayload, payloadFingerprint, payloadHasProgress, restoreLocalEnvelope, readCloudEnvelope } from './cloud-save.mjs';

const AUTH_PREFIX='rpchess.profile.auth.';
const SYNC_REV_KEY='rpchess.reboot.v1.profile-revision';
const SYNC_FINGERPRINT_KEY='rpchess.reboot.v1.profile-fingerprint';
const EVENTS=[
  'rpchess:run-updated','rpchess:run-persisted','rpchess:power-updated',
  'rpchess:chronicle-updated','rpchess:tutorial-updated','rpchess:ad-receipts-updated',
  'rpchess:arena-updated'
];
const MAX_TIMEOUT_MS=12000;
let ready=null,provider='',token='',revision=0,lastFingerprint='',syncing=null,timer=null,installed=false;
let status='disabled',profileId='';
function enabled() { return platform.profileEnabled===true; }
function root() {
  const fromPage=globalThis.document?.querySelector?.('meta[name="rpchess-profile-api"]')?.content||'';
  const value=String(globalThis.RPChessProfileAPI||fromPage).replace(/\/+$/,'');
  return /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(value)?value:'';
}
function localAuthKey(kind) { return AUTH_PREFIX+(kind==='vk'?'vk':'web')+'.v1'; }
function readToken(kind) {
  try {return globalThis.localStorage?.getItem(localAuthKey(kind))||'';}catch{return '';}
}
function writeToken(kind,value) {
  try {globalThis.localStorage?.setItem(localAuthKey(kind),value);}catch{}
}
function state(next,reason='') {
  status=next;
  globalThis.RPChessProfileStatus=Object.freeze({status:next,reason,provider,profileId});
  try {globalThis.dispatchEvent?.(new CustomEvent('rpchess:profile-status',{detail:{status:next,reason,provider}}));}catch{}
}
async function request(path,{method='GET',data=null,auth=true}={}) {
  const base=root();
  if(!base)throw Error('RPChess profile API endpoint not configured');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),MAX_TIMEOUT_MS);
  try{
    const res=await fetch(base+path,{
      method,cache:'no-store',signal:controller.signal,
      headers:{...(data?{'Content-Type':'application/json'}:{}),
        ...(auth&&token?{'Authorization':'Bearer '+token}:{})},
      ...(data?{body:JSON.stringify(data)}:{})
    });
    let body=null;try{body=await res.json();}catch{}
    if(!res.ok){
      const error=new Error('RPChess profile API '+res.status+': '+(body?.error||'unavailable'));
      error.status=res.status;error.details=body;throw error;
    }
    return body;
  }finally{clearTimeout(timeout);}
}
function signedParams(input) {
  let p;
  try {
    if(typeof input==='string')p=new URLSearchParams(input.replace(/^\?/,''));
    else if(input&&typeof input==='object')p=new URLSearchParams(Object.entries(input)
      .filter(([key,val])=>(key.startsWith('vk_')||key==='sign')&&val!=null)
      .map(([key,val])=>[key,String(val)]));
    else return '';
  }catch{return '';}
  if(p.get('vk_app_id')!=='54754579'||!/^[1-9]\d*$/.test(p.get('vk_user_id')||'')||!p.has('sign'))return '';
  return '?'+new URLSearchParams([...p].filter(([key])=>key.startsWith('vk_')||key==='sign')).toString();
}
async function signedVKLaunch() {
  const direct=signedParams(globalThis.location?.search||'');
  if(direct)return direct;
  try{
    const answer=await platform.bridge.request('VKWebAppGetLaunchParams',{}, {timeoutMs:4500});
    return signedParams(answer?.launchParams||answer?.launch_params||answer?.params||answer);
  }catch{return '';}
}
async function openSession(kind) {
  const saved=readToken(kind);
  if(kind==='vk'){
    const launch=await signedVKLaunch();
    if(launch) {
      const result=await request('/v1/session',{method:'POST',auth:false,data:{vkLaunch:launch}});
      if(result.profile?.provider!=='vk')throw Error('Expected a signed VK player');
      return result;
    }
    // Without fresh launch params, only a previously authenticated same-origin
    // VK token may recover the account. Never invent a VK ID.
    if(!saved)throw Error('VK signed launch parameters unavailable');
    const resumed=await request('/v1/session',{method:'POST',auth:false,data:{accessToken:saved}});
    if(resumed.profile?.provider!=='vk')throw Error('Stored token is not a VK player');
    return resumed;
  }
  // Guest Web: never silently replace an expired credential with a new identity.
  if(saved)return request('/v1/session',{method:'POST',auth:false,data:{accessToken:saved}});
  return request('/v1/session',{method:'POST',auth:false,data:{}});
}
function getLocalMeta() {
  const store=platform.storage.sync();
  const n=Number(store?.getItem(SYNC_REV_KEY));
  return {
    revision:Number.isSafeInteger(n)&&n>=0&&store?.getItem(SYNC_REV_KEY)!=null?n:null,
    fingerprint:store?.getItem(SYNC_FINGERPRINT_KEY)||''
  };
}
function setLocalMeta(remoteRevision,payload) {
  const store=platform.storage.sync();
  store?.setItem(SYNC_REV_KEY,String(remoteRevision));
  store?.setItem(SYNC_FINGERPRINT_KEY,payloadFingerprint(payload));
}
function restoreProfile(profile) {
  const payload=profile?.snapshot;
  if(!payloadHasProgress(payload))return false;
  const ok=restoreLocalEnvelope({payload,revision:Math.max(0,profile.revision),updatedAt:profile.updatedAt});
  if(ok)setLocalMeta(profile.revision,payload);
  return ok;
}
function legacyVKMeta(source) {
  const p=source?.payload;
  if(!p)return null;
  return {
    rating:p.rating,
    chronicle:p.chronicle,
    arena:p.arena?{...p.arena,match:null}:null
    // Do not include p.run, any active combat or an unfinished Arena match.
  };
}
async function importOldVKIfPresent(profile) {
  if(provider!=='vk'||profile.migratedVK)return profile;
  const reader=platform.storage.legacyVKProfileReader;
  if(!reader?.available)return profile;
  const legacy=await readCloudEnvelope(reader);
  if(legacy.error)throw Error('Legacy VK backup has a validation error: '+legacy.error);
  const meta=legacyVKMeta(legacy.envelope);
  if(!meta)return profile; // Nothing to migrate, do not falsely mark complete.
  const done=await request('/v1/vk-import',{method:'POST',data:{meta}});
  if(!done?.profile)throw Error('Legacy VK migration was not verified by server');
  return done.profile;
}
function scheduleSave({immediate=false}={}) {
  if(timer)clearTimeout(timer);
  timer=setTimeout(()=>{timer=null;void syncNow();},immediate?100:750);
  timer.unref?.();
}
function install() {
  if(installed)return;
  installed=true;
  for(const name of EVENTS)globalThis.addEventListener?.(name,()=>scheduleSave({immediate:name==='rpchess:run-persisted'}));
  platform.lifecycle.subscribe(({active})=>{if(!active)scheduleSave({immediate:true});},{immediate:false});
}
async function syncNow() {
  if(!ready||!token||status==='conflict'||status==='offline')return false;
  if(syncing)return syncing;
  syncing=(async()=>{
    const before=localPayload(),fingerprint=payloadFingerprint(before);
    if(lastFingerprint===fingerprint)return true;
    try{
      const result=await request('/v1/profile',{method:'PUT',data:{revision,snapshot:{...before,schemaVersion:1}}});
      if(result?.profile?.revision==null)throw Error('Missing profile revision');
      revision=result.profile.revision;
      lastFingerprint=fingerprint;
      setLocalMeta(revision,before);
      state('ready');
      // A write may race with a new move; persist that newer state next.
      if(payloadFingerprint(localPayload())!==fingerprint)scheduleSave();
      return true;
    }catch(error){
      if(error.status===409){
        // Never blindly overwrite the other device or discard local progress.
        state('conflict','Remote profile changed; local save has been kept');
        return false;
      }
      state('offline','Sync unavailable; progress is kept locally');
      return false;
    }finally{syncing=null;}
  })();
  return syncing;
}
async function boot() {
  if(!enabled())return {status:'disabled'};
  try{
    state('loading');
    provider=platform.launch.isVK()||await discoverVKHost()?'vk':'web';
    const session=await openSession(provider);
    token=session.token;
    if(!/^[A-Za-z0-9_-]{43}$/.test(token||''))throw Error('Invalid session credential');
    profileId=session.profile?.id||'';
    if(!profileId||session.profile?.provider!==provider)throw Error('Profile belongs to another platform');
    writeToken(provider,token);
    let remote=await importOldVKIfPresent(session.profile);
    const local=localPayload(),localHash=payloadFingerprint(local);
    const marker=getLocalMeta();
    const remoteData=remote?.snapshot||{schemaVersion:1};
    const remoteHash=payloadFingerprint(remoteData);
    // If the server has a newer revision AND this device contains offline
    // edits since its last synced revision, don't choose a winner silently.
    if(remote.revision>0 && marker.revision!==null && remote.revision!==marker.revision
      && marker.fingerprint && localHash!==marker.fingerprint && localHash!==remoteHash) {
      revision=remote.revision;
      state('conflict','Remote profile changed while this device was offline');
      return {status:'conflict',profileId};
    }
    if(remote.revision>0 && (marker.revision!==remote.revision || localHash===marker.fingerprint)){
      restoreProfile(remote);
      lastFingerprint=payloadFingerprint(localPayload());
    }else{
      lastFingerprint=marker.fingerprint||'';
    }
    revision=remote.revision||0;
    setLocalMeta(revision,remote.revision>0?localPayload():remoteData);
    ready=true;
    install();
    state('ready');
    if(lastFingerprint!==payloadFingerprint(localPayload()))scheduleSave({immediate:true});
    return {status:'ready',profileId,provider,restored:remote.revision>0};
  }catch(error){
    state('offline',String(error.message||error).slice(0,160));
    // A cloud failure must never destroy old VK or local progress.
    return {status:'offline'};
  }
}
async function bootstrapProfile() {
  if(!ready)ready=boot();
  return ready;
}
function statusInfo() {return Object.freeze({status,provider,profileId,revision,enabled:enabled()});}
export {bootstrapProfile,syncNow,statusInfo,signedParams,legacyVKMeta};
