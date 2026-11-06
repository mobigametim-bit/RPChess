// Unified RPChess ID + D1 snapshot sync. Opt-in only (?rpchess_profile=1).
// VK signature is verified by OUR server; no login/registration UI.
// GamePush is optional. Yandex is deliberately not integrated in this phase.
import { platform, discoverVKHost } from './platform.mjs';
import { apiBase } from './api-route.mjs';
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
let bootPromise=null,sessionReady=false,provider='',token='',revision=0,lastFingerprint='',syncing=null,timer=null,installed=false;
let status='disabled',profileId='';
let migration=Object.freeze({status:'not-checked',legacyV1:'unknown',previousGP:'unknown',source:'none',serverMigrated:false,chronicle:0,arenaEvents:0,hasRatingProgress:false});
function setMigration(next) {
  migration=Object.freeze({...migration,...next});
  globalThis.RPChessProfileMigration=migration;
}

function enabled() { return platform.profileEnabled===true; }
function root() {
  if(globalThis.location?.hostname==='rpchess-tournament-v4-preview.mobigametim.workers.dev')
    return 'https://rpchess-profile-v4-preview.mobigametim.workers.dev';
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
  globalThis.RPChessProfileStatus=Object.freeze({status:next,reason,provider,profileId,migration:migration.status});
  try {globalThis.dispatchEvent?.(new CustomEvent('rpchess:profile-status',{detail:{status:next,reason,provider}}));}catch{}
}
async function request(path,{method='GET',data=null,auth=true}={}) {
  const base=await apiBase('profile',root());
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
    // Never accept a cached VK bearer alone when the current launch identity
    // is unknown: a different VK account on this browser could inherit the
    // previous player's profile. Only freshly signed VK params may log in.
    throw Error('Fresh VK signed launch parameters unavailable');
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
function summaryOfMeta(payload) {
  // Deliberately omit identity, run content, receipt IDs and access tokens.
  const power=Number(payload?.rating?.power);
  return Object.freeze({
    power:Number.isFinite(power)?power:null,
    chronicle:Math.max(0,payload?.chronicle?.history?.length||0),
    arenaEvents:Math.max(0,payload?.arena?.events?.length||0),
    powerReceipts:Math.max(0,payload?.rating?.receipts?.length||0),
    hasActiveRun:Boolean(payload?.run)
  });
}
function profileRestoreMatches(remote,local) {
  if(!remote||!local)return false;
  if(Number(remote.rating?.power)!==Number(local.rating?.power))return false;
  const containsAll=(remoteItems,localItems,key)=>{
    const have=new Set((localItems||[]).map(item=>item?.[key]).filter(Boolean));
    return (remoteItems||[]).every(item=>item?.[key]&&have.has(item[key]));
  };
  return containsAll(remote.chronicle?.history,local.chronicle?.history,'runId')
    && containsAll(remote.arena?.events,local.arena?.events,'id')
    // Current on-device cloud snapshots intentionally compact Power history
    // to its most recent 128 receipts. Do not treat that as data loss.
    && containsAll((remote.rating?.receipts||[]).slice(-128),local.rating?.receipts,'id');
}
function recordReconcile(data) {
  // Accessible only to this game's iframe. Never include account IDs or tokens.
  globalThis.RPChessProfileReconcile=Object.freeze(data);
}
function restoreProfile(profile) {
  const payload=profile?.snapshot;
  if(!payloadHasProgress(payload))return false;
  const ok=restoreLocalEnvelope({payload,revision:Math.max(0,profile.revision),updatedAt:profile.updatedAt});
  if(!ok)return false;
  const local=localPayload();
  const matched=profileRestoreMatches(payload,local);
  if(matched)setLocalMeta(profile.revision,payload);
  return matched;
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
function hasCompletedMeta(meta) {
  return Boolean(meta && (
    (Number(meta.rating?.power) > 0 && Number(meta.rating.power) !== 500)
    || (meta.rating?.receipts?.length||0)>0
    || (meta.chronicle?.history?.length||0)>0
    || (meta.arena?.events?.length||0)>0
  ));
}
function needsLegacyEnrichment(profile,meta) {
  if(!profile?.migratedVK)return true;
  const stored=profile.snapshot||{};
  if(Number(stored.rating?.power)===500 && Number(meta.rating?.power)!==500)return true;
  const missing=(items,oldItems,key)=> {
    const saved=new Set((items||[]).map(row=>row?.[key]).filter(Boolean));
    return (oldItems||[]).some(row=>row?.[key]&&!saved.has(row[key]));
  };
  return ((stored.chronicle?.history?.length||0)<20 &&
      missing(stored.chronicle?.history,meta.chronicle?.history,'runId'))
    || missing(stored.arena?.events,meta.arena?.events,'id')
    || ((stored.rating?.receipts?.length||0)<2048 &&
      missing(stored.rating?.receipts,meta.rating?.receipts,'id'));
}
function publicMetaSummary(meta) {
  return {
    chronicle:Math.max(0,meta?.chronicle?.history?.length||0),
    arenaEvents:Math.max(0,meta?.arena?.events?.length||0),
    hasRatingProgress: Boolean(Number(meta?.rating?.power)>0 &&
      Number(meta.rating.power)!==500 || (meta?.rating?.receipts?.length||0)>0)
  };
}
async function importOldVKIfPresent(profile) {
  if(provider!=='vk') {
    setMigration({status:'not-vk'});
    return profile;
  }
  setMigration({status:'searching',serverMigrated:Boolean(profile.migratedVK),
    ...publicMetaSummary(profile.snapshot)});
  const reader=platform.storage.legacyVKProfileReader;
  if(!reader?.available) {
    setMigration({status:'bridge-unavailable'});
    return profile;
  }
  const legacy=await readCloudEnvelope(reader);
  if(legacy.error) {
    setMigration({status:'corrupt-v1',legacyV1:'invalid'});
    throw Error('Legacy VK cloud backup invalid: '+legacy.error);
  }
  let source=legacyVKMeta(legacy.envelope);
  const foundV1=hasCompletedMeta(source);
  setMigration({legacyV1:legacy.manifest ? (foundV1?'found':'no-completed-stats') : 'missing'});
  let v2=null;
  const prior=platform.storage.previousGamePushMetaReader;
  if(prior?.available) {
    try {
      const module=await import('./gamepush-meta-sync.mjs');
      const oldGP=await module.readNewMeta(prior);
      v2=oldGP?.meta||null;
      setMigration({previousGP:oldGP ? (hasCompletedMeta(v2)?'found':'no-completed-stats') : 'missing'});
      if(hasCompletedMeta(v2)) {
        source=hasCompletedMeta(source) ? module.mergeMeta(v2,source) : v2;
        setMigration({source:foundV1?'both':'gp-v2'});
      }
    } catch (error) {
      // Inconsistent GP test data must not prevent recovery from an intact v1.
      setMigration({previousGP:'unreadable'});
      if(!foundV1) {
        setMigration({status:'corrupt-gp-v2'});
        throw Error('Prior GamePush backup invalid: '+String(error?.message||'unreadable'));
      }
    }
  }
  if(foundV1 && !hasCompletedMeta(v2))setMigration({source:'vk-v1'});
  if(!hasCompletedMeta(source)) {
    setMigration({status:profile.migratedVK ? 'previously-imported-no-source' : 'no-legacy-stats',
      source:'none'});
    return profile; // Never mark as successfully migrated when nothing was found.
  }
  const stats={rating:source.rating,chronicle:source.chronicle,
    arena:source.arena?{...source.arena,match:null}:null};
  if(!needsLegacyEnrichment(profile,stats)) {
    setMigration({status:'already-imported',serverMigrated:true,
      ...publicMetaSummary(profile.snapshot)});
    return profile;
  }
  setMigration({status:profile.migratedVK?'recovering':'uploading',
    ...publicMetaSummary(stats)});
  const done=await request('/v1/vk-import',{method:'POST',data:{meta:stats}});
  if(!done?.profile)throw Error('Legacy VK migration was not verified by server');
  setMigration({status:done.recovered?'recovered':done.alreadyImported?'already-imported':'imported',
    serverMigrated:Boolean(done.profile.migratedVK),
    ...publicMetaSummary(done.profile.snapshot)});
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
  globalThis.addEventListener?.('online',()=>scheduleSave({immediate:true}));
  platform.lifecycle.subscribe(({active})=>{if(!active)scheduleSave({immediate:true});},{immediate:false});
}
async function syncNow() {
  if(!sessionReady||!token||status==='conflict')return false;
  if(syncing)return syncing;
  syncing=Promise.resolve().then(async()=>{
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
    }
  }).finally(()=>{syncing=null;});
  return syncing;
}
async function boot() {
  if(!enabled())return {status:'disabled'};
  try{
    state('loading');
    provider=platform.launch.isVK()||await discoverVKHost()?'vk':'web';
    // A first-time Web visitor may have played offline before the server
    // issued an ID. Preserve the isolated pending save when it becomes online.
    const orphanWeb=provider==='web'&&!readToken('web')?localPayload():null;
    const session=await openSession(provider);
    token=session.token;
    if(!/^[A-Za-z0-9_-]{43}$/.test(token||''))throw Error('Invalid session credential');
    profileId=session.profile?.id||'';
    if(!profileId||session.profile?.provider!==provider)throw Error('Profile belongs to another platform');
    if(!platform.setProfileStorageIdentity(provider,profileId))throw Error('Invalid RPChess profile identity');
    writeToken(provider,token);
    let remote=await importOldVKIfPresent(session.profile);
    if(orphanWeb&&payloadHasProgress(orphanWeb)&&!payloadHasProgress(remote.snapshot)) {
      // The fresh account is empty; migrate only the player's own pending
      // Web sandbox. Never transplant a prior VK account's local data.
      restoreLocalEnvelope({payload:orphanWeb,revision:0,updatedAt:Date.now()});
    }
    const local=localPayload(),localHash=payloadFingerprint(local);
    const marker=getLocalMeta();
    const remoteData=remote?.snapshot||{schemaVersion:1};
    const remoteHash=payloadFingerprint(remoteData);
    // If the server has a newer revision AND this device contains offline
    // edits since its last synced revision, don't choose a winner silently.
    const remoteStats=summaryOfMeta(remoteData);
    const localBeforeStats=summaryOfMeta(local);
    const note=(decision,restored=false)=>recordReconcile({
      decision, restored, revision:remote.revision,
      remote:remoteStats, localBefore:localBeforeStats,
      localAfter:summaryOfMeta(localPayload()),
      readbackMatches:profileRestoreMatches(remoteData,localPayload())
    });
    if(remote.revision>0 && marker.revision!==null && remote.revision!==marker.revision
      && marker.fingerprint && localHash!==marker.fingerprint && localHash!==remoteHash) {
      revision=remote.revision;
      note('conflict-newer-server');
      state('conflict','Remote profile changed while this device was offline');
      return {status:'conflict',profileId};
    }
    const localMissingAchievements=
      (remoteStats.chronicle>localBeforeStats.chronicle)
      || (remoteStats.arenaEvents>localBeforeStats.arenaEvents)
      || (remoteStats.powerReceipts>localBeforeStats.powerReceipts)
      || (remoteStats.power!==null && remoteStats.power!==500 &&
          (localBeforeStats.power===null||localBeforeStats.power===500));
    // A locally changed but incomplete profile must not silently replace
    // completed server history. Preserve local run separately on conflict.
    const localDiverged=marker.revision===remote.revision &&
      marker.fingerprint && localHash!==marker.fingerprint;
    if(remote.revision>0 && localDiverged && localMissingAchievements &&
       payloadHasProgress(local)) {
      revision=remote.revision;
      note('conflict-incomplete-local');
      state('conflict','Local save differs and lacks completed server achievements');
      return {status:'conflict',profileId};
    }
    let restored=false;
    if(remote.revision>0 && (marker.revision!==remote.revision ||
      localHash===marker.fingerprint || localMissingAchievements)){
      restored=restoreProfile(remote);
      note(restored?'restored':'restore-readback-failed',restored);
      if(!restored){
        state('offline','D1 profile could not be restored to the current local account');
        return {status:'offline',profileId};
      }
      lastFingerprint=payloadFingerprint(localPayload());
    }else{
      note(remote.revision>0?'local-kept':'new-profile');
      lastFingerprint=marker.fingerprint||'';
    }
    revision=remote.revision||0;
    // Do not advance the local last-synced marker until the server has
    // acknowledged a save (or until an authentic server snapshot was restored).
    sessionReady=true;
    install();
    state('ready');
    if(lastFingerprint!==payloadFingerprint(localPayload()))scheduleSave({immediate:true});
    return {status:'ready',profileId,provider,restored:remote.revision>0};
  }catch(error){
    if(['uploading','recovering','searching'].includes(migration.status))setMigration({status:'error'});
    state('offline',String(error.message||error).slice(0,160));
    // A cloud failure must never destroy old VK or local progress.
    return {status:'offline'};
  }
}
async function bootstrapProfile() {
  if(!bootPromise)bootPromise=boot();
  return bootPromise;
}
function statusInfo() {return Object.freeze({status,provider,profileId,revision,enabled:enabled(),migration:migration.status});}
// Profile API owns leaderboard writes and re-derives candidate Glory from the
// server-stored D1 snapshot. Browser-supplied arbitrary scores are never sent.
async function unifiedLeaderboard({refresh=false}={}) {
  if(refresh&&sessionReady&&token){
    // The menu can open before the autosave debounce fires. Flush the actual
    // Journey/Chronicle snapshot first, then let the server derive best Glory.
    if(!await syncNow())return request('/v1/leaderboard');
    return request('/v1/leaderboard/refresh',{method:'POST',data:{}});
  }
  return request('/v1/leaderboard',{auth:sessionReady});
}
// The existing Tournament client sends this credential ONLY to our staging
// Tournament Worker. Never log it, include it in URLs, or expose it in UI.
function tournamentCredential() { return sessionReady&&status==='ready'?token:''; }
export {bootstrapProfile,syncNow,statusInfo,signedParams,legacyVKMeta,hasCompletedMeta,needsLegacyEnrichment,profileRestoreMatches,summaryOfMeta,unifiedLeaderboard,tournamentCredential};
