// Opt-in VK meta migration for GamePush: FREE legacy VK Bridge storage only.
// No paid GamePush backend, no unfinished run, no in-progress Arena match.
// Old rpchess_v1_cloud_* keys are never written or deleted.
import { platform, discoverVKHost, isVKLaunch } from './platform.mjs';
import { readCloudEnvelope, checksum, splitUtf8, encodeCloudPayload, decodeCloudPayload, normalizeManifest } from './cloud-save.mjs';
import { PLAYER_RATING_STORAGE_KEY, readPlayerRating, writePlayerRating } from './player-rating.mjs';
import { STARTING_POWER } from './power-elo.mjs';
import { CHRONICLE_STORAGE_KEY, CHRONICLE_SCHEMA_VERSION, CHRONICLE_HISTORY_LIMIT, normalizeChronicleRecord, readChronicle, writeChronicle } from './chronicle-core.mjs';
import { ARENA_KEY, normalizeArena, mergeArena } from './arena-core.mjs';

const META_MANIFEST_KEY = 'rpchess_gp_v2_manifest';
const META_PREFIX = 'rpchess_gp_v2_';
const LOCAL_SYNC_FINGERPRINT_KEY = 'rpchess.reboot.v2.meta-uploaded';
const LOCAL_MIGRATED_KEY = 'rpchess.reboot.v2.meta-migrated';
const LOCAL_LEGACY_FINGERPRINT = 'rpchess.reboot.v2.legacy-fingerprint';
const META_VERSION = 1;
const META_MAX_BYTES = 320000;
const META_CHUNK_BYTES = 3000;
const META_MAX_CHUNKS = 128;
const EVENTS = ['rpchess:power-updated','rpchess:chronicle-updated','rpchess:arena-updated'];
let bootPromise=null, syncTimer=null, syncTask=null, installed=false;
let baseline=null, status='idle';

function emit(state,reason='') {
  status=state;
  // Status only: never include personal profile or credentials in diagnostics.
  globalThis.RPChessGamePushMetaStatus=Object.freeze({status:state,reason});
  try { globalThis.dispatchEvent?.(new CustomEvent('rpchess:gamepush-meta', { detail:{status:state,reason} })); }
  catch {}
}

function parse(value) {
  if (value && typeof value==='object') return value;
  try { return typeof value==='string' ? JSON.parse(value) : null; } catch { return null; }
}

function ratingHasProgress(profile) {
  return Boolean(profile && (Number(profile.power)!==STARTING_POWER || (profile.receipts?.length||0)>0));
}

function normalizeRating(profile) {
  // The actual storage writer validates all receipt details and power bounds.
  const scratch=new Map();
  const store={
    getItem(key){return scratch.get(key)??null;},
    setItem(key,value){scratch.set(key,String(value));}
  };
  writePlayerRating(profile,store);
  return readPlayerRating(store);
}

function cleanArena(value) {
  // Arena history, unlocked squads, shards and artifact receipts survive,
  // but an unfinished match must never be restored after cutover.
  return {...normalizeArena(value),match:null};
}

function normalizeMeta(value) {
  if (!value || typeof value!=='object') return null;
  const records = Array.isArray(value?.chronicle?.history) ? value.chronicle.history : [];
  const byId=new Map();
  for (const item of records) {
    const entry=normalizeChronicleRecord(item);
    if (entry) byId.set(entry.runId,entry);
  }
  const history=[...byId.values()]
    .sort((a,b)=>a.completedAt-b.completedAt||a.runId.localeCompare(b.runId))
    .slice(-CHRONICLE_HISTORY_LIMIT);
  return {
    version:META_VERSION,
    migratedFromVK:value.migratedFromVK===true,
    sourceVKFingerprint:typeof value.sourceVKFingerprint==='string'?value.sourceVKFingerprint.slice(0,64):'',
    rating:normalizeRating(value.rating),
    chronicle:{schemaVersion:CHRONICLE_SCHEMA_VERSION,history},
    arena:cleanArena(value.arena)
  };
}

function extractLocalMeta() {
  const store=platform.storage.sync();
  const meta=normalizeMeta({
    migratedFromVK:store?.getItem(LOCAL_MIGRATED_KEY)==='1',
    sourceVKFingerprint:store?.getItem(LOCAL_LEGACY_FINGERPRINT)||'',
    rating:readPlayerRating(store),
    chronicle:readChronicle(store),
    arena:parse(store?.getItem(ARENA_KEY))
  });
  return meta;
}

function applyLocalMeta(meta) {
  const clean=normalizeMeta(meta);
  if (!clean) throw new Error('Invalid meta payload');
  const store=platform.storage.sync();
  if (!store) throw new Error('No local storage');
  writePlayerRating(clean.rating,store);
  writeChronicle(clean.chronicle,store);
  store.setItem(ARENA_KEY,JSON.stringify(clean.arena));
  if (clean.migratedFromVK) store.setItem(LOCAL_MIGRATED_KEY,'1');
  if (clean.sourceVKFingerprint) store.setItem(LOCAL_LEGACY_FINGERPRINT,clean.sourceVKFingerprint);
  // Neither RUN_STORAGE_KEY nor any current-combat key is touched.
  return clean;
}

function hasMetaProgress(meta) {
  return ratingHasProgress(meta?.rating)
    || (meta?.chronicle?.history?.length||0)>0
    || (meta?.arena?.events?.length||0)>0;
}

function mergeMeta(primary,secondary,{preferSecondaryRating=false}={}) {
  const a=normalizeMeta(primary),b=normalizeMeta(secondary);
  if (!a) return b;
  if (!b) return a;
  const records=new Map();
  for(const record of [...b.chronicle.history,...a.chronicle.history])
    records.set(record.runId,record);
  const history=[...records.values()]
    .sort((x,y)=>x.completedAt-y.completedAt||x.runId.localeCompare(y.runId))
    .slice(-CHRONICLE_HISTORY_LIMIT);
  const mergedArena=mergeArena(a.arena,b.arena);
  const rating=preferSecondaryRating && ratingHasProgress(b.rating)
    ? b.rating : ratingHasProgress(a.rating) ? a.rating : b.rating;
  return normalizeMeta({
    migratedFromVK:a.migratedFromVK||b.migratedFromVK,
    sourceVKFingerprint:a.sourceVKFingerprint||b.sourceVKFingerprint,
    rating,
    chronicle:{schemaVersion:CHRONICLE_SCHEMA_VERSION,history},
    arena:{...mergedArena,match:null}
  });
}

function fingerprint(meta) { return checksum(JSON.stringify(normalizeMeta(meta))); }
function oldMeta(envelope) {
  if (!envelope?.payload) return null;
  return normalizeMeta({
    rating:envelope.payload.rating,
    chronicle:envelope.payload.chronicle,
    arena:envelope.payload.arena,
    sourceVKFingerprint:envelope.fingerprint
  });
}
function cloudChunkKey(slot,index) { return META_PREFIX+slot+'_'+index; }

async function readNewMeta(reader=platform.storage.gamepushVKMetaStore) {
  if (!reader?.available) throw new Error('VK meta cloud unavailable');
  const raw=await reader.getItemStrict(META_MANIFEST_KEY);
  if (!raw) return null;
  const manifest=normalizeManifest(raw);
  if (!manifest || manifest.encoding!=='base64url') throw new Error('Invalid v2 manifest: no fallback overwrite');
  const keys=Array.from({length:manifest.chunks},(_,i)=>cloudChunkKey(manifest.slot,i));
  const found=await reader.getItemsStrict(keys);
  const chunks=keys.map(key=>found[key]);
  if (chunks.some(chunk=>typeof chunk!=='string'||!chunk.length)) throw new Error('Missing v2 meta chunk');
  const encoded=chunks.join('');
  if (checksum(encoded)!==manifest.checksum) throw new Error('V2 meta checksum mismatch');
  const decoded=decodeCloudPayload(encoded,'base64url');
  const parsed=parse(decoded);
  if (parsed?.schemaVersion!==META_VERSION || !parsed.meta) throw new Error('Invalid v2 meta envelope');
  const meta=normalizeMeta(parsed.meta);
  if (!meta) throw new Error('Invalid v2 meta data');
  return {manifest,meta,updatedAt:Number(parsed.updatedAt)||0};
}

async function writeNewMeta(meta,reader=platform.storage.gamepushVKMetaStore,existing=null) {
  if (!reader?.available || typeof reader.setItem!=='function') return false;
  const clean=normalizeMeta(meta);
  if (!clean) return false;
  const json=JSON.stringify({schemaVersion:META_VERSION,updatedAt:Date.now(),meta:clean});
  if (new TextEncoder().encode(json).length>META_MAX_BYTES)
    throw new Error('RPChess meta exceeds safe VK cloud budget; nothing was deleted');
  const encoded=encodeCloudPayload(json),chunks=splitUtf8(encoded,META_CHUNK_BYTES);
  if(chunks.length>META_MAX_CHUNKS) throw new Error('Too many VK meta chunks');
  const previous=existing||await readNewMeta(reader);
  const slot=previous?.manifest?.slot==='a'?'b':'a';
  for(let index=0;index<chunks.length;index++){
    if (!await reader.setItem(cloudChunkKey(slot,index),chunks[index])) return false;
  }
  const keys=chunks.map((_,i)=>cloudChunkKey(slot,i));
  const verified=await reader.getItemsStrict(keys);
  if(keys.some((key,i)=>verified[key]!==chunks[i])) return false;
  const manifest={
    schemaVersion:1,encoding:'base64url',slot,chunks:chunks.length,revision:(previous?.manifest?.revision||0)+1,
    updatedAt:Date.now(),checksum:checksum(encoded)
  };
  if(!await reader.setItem(META_MANIFEST_KEY,JSON.stringify(manifest))) return false;
  const check=await readNewMeta(reader);
  return Boolean(check?.manifest?.checksum===manifest.checksum && fingerprint(check.meta)===fingerprint(clean));
}

function scheduleMetaSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>{syncTimer=null;void syncMetaNow();},1100);
  syncTimer.unref?.();
}

function installAutosync() {
  if (installed) return;
  installed=true;
  for (const event of EVENTS) globalThis.addEventListener?.(event,scheduleMetaSync);
  platform.lifecycle.subscribe(()=>{
    if(syncTimer){clearTimeout(syncTimer);syncTimer=null;}
    void syncMetaNow();
  },{immediate:false});
}

async function syncMetaNow() {
  if (!baseline || !platform.storage.gamepushVKMetaStore.available) return false;
  if (syncTask) return syncTask;
  syncTask=(async()=>{
    try{
      const local=extractLocalMeta();
      const localHash=fingerprint(local);
      const uploaded=platform.storage.getItem(LOCAL_SYNC_FINGERPRINT_KEY);
      if (uploaded===localHash) return true;
      const remote=await readNewMeta();
      // If another device updated the remote while this one was playing,
      // retain the union of completed history and Arena receipts.
      const candidate=mergeMeta(remote?.meta||baseline,local,{
        preferSecondaryRating:uploaded!==null && uploaded!==localHash
      });
      const ok=await writeNewMeta(candidate,platform.storage.gamepushVKMetaStore,remote);
      if(!ok) throw new Error('VK v2 meta upload not verified');
      applyLocalMeta(candidate);
      baseline=candidate;
      platform.storage.setItem(LOCAL_SYNC_FINGERPRINT_KEY,fingerprint(candidate));
      emit('synced');
      return true;
    }catch(error){
      emit('sync-error',error?.message||'unknown');
      return false;
    }finally{syncTask=null;}
  })();
  return syncTask;
}

async function bootstrapGamePushMeta() {
  if (bootPromise) return bootPromise;
  if (!platform.gamepush.enabled || !isVKLaunch()) return {status:'not-vk'};
  bootPromise=(async()=>{
    try{
      emit('loading');
      await platform.gamepush.init();
      // Never import a VK account's cloud into an anonymous GP guest profile.
      if (!platform.gamepush.ready || !platform.gamepush.loggedIn
        || !/VK/i.test(platform.gamepush.platformType)) {
        emit('skipped','VK signed GamePush account not ready');
        return {status:'skipped'};
      }
      if (!await discoverVKHost() || !platform.storage.legacyVKMetaReader.available) {
        emit('skipped','VK Bridge unavailable');
        return {status:'skipped'};
      }
      const remote=await readNewMeta();
      const local=extractLocalMeta();
      let candidate=remote ? mergeMeta(remote.meta,local,{
        preferSecondaryRating: !platform.storage.getItem(LOCAL_SYNC_FINGERPRINT_KEY)&&hasMetaProgress(local)
      }) : local;
      if (!remote?.meta?.migratedFromVK){
        // Legacy read is never destructive. Corrupt/missing cloud retries on
        // the next launch, without marking the migration as complete.
        const legacy=await readCloudEnvelope(platform.storage.legacyVKMetaReader);
        if (legacy.error) throw new Error('Legacy VK cloud invalid: '+legacy.error);
        const legacyStats=oldMeta(legacy.envelope);
        // Existing GP progress wins rating conflicts. Combine only
        // idempotent Chronicle run IDs and Arena event receipts.
        candidate=mergeMeta(candidate,legacyStats);
        candidate={...candidate,migratedFromVK:true,
          sourceVKFingerprint:legacyStats?.sourceVKFingerprint||''};
      }
      // A bad upload must not clear legacy data or finalise the marker.
      const ok=await writeNewMeta(candidate,platform.storage.gamepushVKMetaStore,remote);
      if (!ok) throw new Error('New VK meta cloud write not verified');
      applyLocalMeta(candidate);
      platform.storage.setItem(LOCAL_SYNC_FINGERPRINT_KEY,fingerprint(candidate));
      baseline=candidate;
      installAutosync();
      emit('ready');
      return {status:'ready',migratedFromVK:candidate.migratedFromVK};
    }catch(error){
      emit('error',error?.message||'unknown');
      console.warn('[RPChess] GamePush VK meta migration paused; legacy data kept intact',error?.message);
      return {status:'error'};
    }
  })();
  return bootPromise;
}

export { META_MANIFEST_KEY, META_PREFIX, normalizeMeta, extractLocalMeta, applyLocalMeta, mergeMeta,
  oldMeta, fingerprint, readNewMeta, writeNewMeta, bootstrapGamePushMeta, syncMetaNow };
