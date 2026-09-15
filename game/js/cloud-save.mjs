import { platform } from './platform.mjs';
import { createStarterRoster } from './roster-data.mjs';
import { recruitProfile } from './settlement-core.mjs';
import { RUN_STORAGE_KEY, readRun } from './run-persistence.mjs';
import {
  PLAYER_RATING_STORAGE_KEY,
  PLAYER_RATING_SCHEMA_VERSION,
  STARTING_POWER,
  readPlayerRating
} from './player-rating.mjs';
import {
  CHRONICLE_STORAGE_KEY,
  CHRONICLE_SCHEMA_VERSION,
  readChronicle
} from './chronicle-core.mjs';

const CLOUD_SAVE_SCHEMA_VERSION = 1;
const CLOUD_SAVE_MANIFEST_KEY = 'rpchess_v1_cloud_manifest';
const CLOUD_SAVE_LOCAL_META_KEY = 'rpchess.reboot.v1.cloud-meta';
const TUTORIAL_STORAGE_KEY = 'rpchess.reboot.v1.tutorial';
const AD_RECEIPTS_STORAGE_KEY = 'rpchess.reboot.v1.ad-receipts';
const CLOUD_RATING_RECEIPT_LIMIT = 128;
// VK historically documents a 4096-byte value limit. Keep payload chunks comfortably below it;
// the real-App-ID capability spike still validates current behavior before moderation freeze.
const CLOUD_CHUNK_BYTES = 3000;
const CLOUD_MAX_CHUNKS = 128;
const CLOUD_SYNC_DEBOUNCE_MS = 750;

const starterById = new Map(createStarterRoster().map((character) => [character.id, character]));

function nowMs() { return Date.now(); }
function safeJsonParse(value, fallback = null) {
  if (typeof value !== 'string' || !value) return fallback;
  try { return JSON.parse(value); }
  catch { return fallback; }
}
function localStore() { return platform.storage.local; }
function localRaw(key) { return localStore()?.getItem(key) ?? null; }
function writeLocalRaw(key, value) {
  const storage = localStore();
  if (!storage) return;
  if (value == null) storage.removeItem(key);
  else storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
}

function templateForCharacter(id) {
  return starterById.get(id) || recruitProfile(id) || null;
}

function compactCharacter(character) {
  const template = templateForCharacter(character?.id);
  if (template) return { id:template.id, status:character?.status || 'healthy' };
  return character && typeof character === 'object' ? { ...character } : null;
}

function expandCharacter(character) {
  if (!character || typeof character !== 'object' || !character.id) return null;
  const template = templateForCharacter(character.id);
  if (!template) return { ...character };
  return {
    ...template,
    status:character.status || 'healthy',
    isRunKing:Boolean(template.isRunKing)
  };
}

function compactRun(run) {
  if (!run || typeof run !== 'object') return null;
  return {
    ...run,
    roster:Array.isArray(run.roster) ? run.roster.map(compactCharacter).filter(Boolean) : []
  };
}

function expandRun(run) {
  if (!run || typeof run !== 'object') return null;
  return {
    ...run,
    roster:Array.isArray(run.roster) ? run.roster.map(expandCharacter).filter(Boolean) : []
  };
}

function compactRating(profile) {
  const receipts = Array.isArray(profile?.receipts) ? profile.receipts.slice(-CLOUD_RATING_RECEIPT_LIMIT) : [];
  return {
    schemaVersion:PLAYER_RATING_SCHEMA_VERSION,
    power:Number.isFinite(Number(profile?.power)) ? Math.max(0, Math.round(Number(profile.power))) : STARTING_POWER,
    receipts
  };
}

function localPayload() {
  const run = readRun();
  const rating = readPlayerRating();
  const chronicle = readChronicle();
  const tutorial = safeJsonParse(localRaw(TUTORIAL_STORAGE_KEY));
  const adReceipts = safeJsonParse(localRaw(AD_RECEIPTS_STORAGE_KEY));
  return {
    run:compactRun(run),
    rating:compactRating(rating),
    chronicle:{ schemaVersion:CHRONICLE_SCHEMA_VERSION, history:Array.isArray(chronicle?.history) ? chronicle.history : [] },
    tutorial,
    adReceipts
  };
}

function payloadHasProgress(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.run) return true;
  if (Number(payload.rating?.power) !== STARTING_POWER || (payload.rating?.receipts?.length || 0) > 0) return true;
  if ((payload.chronicle?.history?.length || 0) > 0) return true;
  return Boolean(payload.tutorial || payload.adReceipts);
}

function checksum(input) {
  let hash = 2166136261;
  for (const char of String(input)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function utf8Bytes(input) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(input)).length;
  return unescape(encodeURIComponent(String(input))).length;
}

function splitUtf8(input, maxBytes = CLOUD_CHUNK_BYTES) {
  const source = String(input);
  if (!source) return [''];
  const chunks = [];
  let chunk = '';
  let bytes = 0;
  for (const char of source) {
    const charBytes = utf8Bytes(char);
    if (chunk && bytes + charBytes > maxBytes) {
      chunks.push(chunk);
      chunk = '';
      bytes = 0;
    }
    if (charBytes > maxBytes) throw new Error('Cloud save contains a character larger than the chunk budget');
    chunk += char;
    bytes += charBytes;
  }
  if (chunk || !chunks.length) chunks.push(chunk);
  return chunks;
}

function payloadFingerprint(payload) {
  return checksum(JSON.stringify(payload));
}

function readLocalMeta() {
  const parsed = safeJsonParse(localRaw(CLOUD_SAVE_LOCAL_META_KEY), {});
  return {
    schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
    revision:Number.isInteger(parsed?.revision) && parsed.revision >= 0 ? parsed.revision : 0,
    updatedAt:Number.isFinite(Number(parsed?.updatedAt)) ? Number(parsed.updatedAt) : 0,
    fingerprint:typeof parsed?.fingerprint === 'string' ? parsed.fingerprint : ''
  };
}

function writeLocalMeta(meta) {
  writeLocalRaw(CLOUD_SAVE_LOCAL_META_KEY, {
    schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
    revision:Math.max(0, Math.floor(Number(meta?.revision) || 0)),
    updatedAt:Math.max(0, Math.floor(Number(meta?.updatedAt) || 0)),
    fingerprint:String(meta?.fingerprint || '')
  });
}

function prepareLocalEnvelope({ now = nowMs(), bumpOnChange = true } = {}) {
  const payload = localPayload();
  const fingerprint = payloadFingerprint(payload);
  const previous = readLocalMeta();
  const changed = fingerprint !== previous.fingerprint;
  const revision = changed && bumpOnChange ? previous.revision + 1 : previous.revision;
  const updatedAt = changed && bumpOnChange ? Number(now) : previous.updatedAt;
  const meta = { schemaVersion:CLOUD_SAVE_SCHEMA_VERSION, revision, updatedAt, fingerprint };
  if (changed && bumpOnChange) writeLocalMeta(meta);
  return {
    schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
    revision,
    updatedAt,
    fingerprint,
    payload,
    hasProgress:payloadHasProgress(payload)
  };
}

function normalizeManifest(value) {
  const parsed = typeof value === 'string' ? safeJsonParse(value) : value;
  if (!parsed || parsed.schemaVersion !== CLOUD_SAVE_SCHEMA_VERSION) return null;
  if (!['a','b'].includes(parsed.slot)) return null;
  if (!Number.isInteger(parsed.chunks) || parsed.chunks < 1 || parsed.chunks > CLOUD_MAX_CHUNKS) return null;
  if (!Number.isInteger(parsed.revision) || parsed.revision < 0) return null;
  if (typeof parsed.checksum !== 'string' || !parsed.checksum) return null;
  return {
    schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
    slot:parsed.slot,
    chunks:parsed.chunks,
    revision:parsed.revision,
    updatedAt:Math.max(0, Math.floor(Number(parsed.updatedAt) || 0)),
    checksum:parsed.checksum
  };
}

function chunkKey(slot, index) {
  return `rpchess_v1_cloud_${slot}_${index}`;
}

async function readCloudManifest() {
  if (!platform.storage.cloud.available) return null;
  return normalizeManifest(await platform.storage.cloud.getItem(CLOUD_SAVE_MANIFEST_KEY));
}

async function readCloudEnvelope() {
  const manifest = await readCloudManifest();
  if (!manifest) return { manifest:null, envelope:null, error:null };
  const keys = Array.from({ length:manifest.chunks }, (_, index) => chunkKey(manifest.slot, index));
  const values = await platform.storage.cloud.getItems(keys);
  const chunks = keys.map((key) => values[key]);
  if (chunks.some((value) => typeof value !== 'string')) return { manifest, envelope:null, error:'missing-chunk' };
  const serialized = chunks.join('');
  if (checksum(serialized) !== manifest.checksum) return { manifest, envelope:null, error:'checksum' };
  const parsed = safeJsonParse(serialized);
  if (!parsed || parsed.schemaVersion !== CLOUD_SAVE_SCHEMA_VERSION || parsed.revision !== manifest.revision || !parsed.payload) {
    return { manifest, envelope:null, error:'invalid-envelope' };
  }
  const fingerprint = payloadFingerprint(parsed.payload);
  return {
    manifest,
    envelope:{
      schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
      revision:parsed.revision,
      updatedAt:Math.max(0, Math.floor(Number(parsed.updatedAt) || 0)),
      fingerprint,
      payload:parsed.payload,
      hasProgress:payloadHasProgress(parsed.payload)
    },
    error:null
  };
}

async function writeCloudEnvelope(envelope, currentManifest = null) {
  if (!platform.storage.cloud.available || !envelope?.payload) return false;
  const serialized = JSON.stringify({
    schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
    revision:Math.max(0, Math.floor(Number(envelope.revision) || 0)),
    updatedAt:Math.max(0, Math.floor(Number(envelope.updatedAt) || 0)),
    payload:envelope.payload
  });
  const chunks = splitUtf8(serialized);
  if (chunks.length > CLOUD_MAX_CHUNKS) throw new Error('Cloud save exceeds the RPChess chunk budget');
  const previous = currentManifest || await readCloudManifest();
  const slot = previous?.slot === 'a' ? 'b' : 'a';
  for (let index = 0; index < chunks.length; index += 1) {
    const ok = await platform.storage.cloud.setItem(chunkKey(slot, index), chunks[index]);
    if (!ok) return false;
  }
  const manifest = {
    schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
    slot,
    chunks:chunks.length,
    revision:Math.max(0, Math.floor(Number(envelope.revision) || 0)),
    updatedAt:Math.max(0, Math.floor(Number(envelope.updatedAt) || 0)),
    checksum:checksum(serialized)
  };
  return platform.storage.cloud.setItem(CLOUD_SAVE_MANIFEST_KEY, JSON.stringify(manifest));
}

function restoreLocalEnvelope(envelope) {
  if (!envelope?.payload) return false;
  const { payload } = envelope;
  if (payload.run) writeLocalRaw(RUN_STORAGE_KEY, expandRun(payload.run));
  else writeLocalRaw(RUN_STORAGE_KEY, null);
  writeLocalRaw(PLAYER_RATING_STORAGE_KEY, payload.rating || { schemaVersion:PLAYER_RATING_SCHEMA_VERSION, power:STARTING_POWER, receipts:[] });
  writeLocalRaw(CHRONICLE_STORAGE_KEY, payload.chronicle || { schemaVersion:CHRONICLE_SCHEMA_VERSION, history:[] });
  writeLocalRaw(TUTORIAL_STORAGE_KEY, payload.tutorial ?? null);
  writeLocalRaw(AD_RECEIPTS_STORAGE_KEY, payload.adReceipts ?? null);
  const fingerprint = payloadFingerprint(payload);
  writeLocalMeta({ revision:envelope.revision, updatedAt:envelope.updatedAt, fingerprint });
  return true;
}

function activeRunId(envelope) {
  return envelope?.payload?.run?.id || null;
}

function compareEnvelopes(local, cloud) {
  if (!local && !cloud) return 'empty';
  if (!cloud) return local?.hasProgress ? 'local' : 'empty';
  if (!local || !local.hasProgress) return cloud.hasProgress ? 'cloud' : 'empty';
  if (!cloud.hasProgress) return 'local';
  const localRun = activeRunId(local);
  const cloudRun = activeRunId(cloud);
  if (localRun && cloudRun && localRun !== cloudRun) return 'conflict';
  if (local.revision !== cloud.revision) return local.revision > cloud.revision ? 'local' : 'cloud';
  if (local.fingerprint === cloud.fingerprint) return 'same';
  if (local.updatedAt !== cloud.updatedAt) return local.updatedAt > cloud.updatedAt ? 'local' : 'cloud';
  return 'conflict';
}

let bootstrapResult = null;
let conflictState = null;
let lastUploadedFingerprint = '';
let syncTimer = null;
let syncInFlight = null;
let autosyncInstalled = false;

function emitCloudEvent(name, detail) {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof CustomEvent === 'undefined') return;
  globalThis.dispatchEvent(new CustomEvent(name, { detail }));
}

function beginConflict(local, cloud, manifest, reason = 'diverged') {
  conflictState = { local, cloud, manifest, reason };
  emitCloudEvent('rpchess:cloud-conflict', { local, cloud, reason });
  return conflictState;
}

async function syncCloudNow() {
  if (!platform.storage.cloud.available || conflictState) return false;
  if (syncInFlight) return syncInFlight;
  const envelope = prepareLocalEnvelope();
  if (!envelope.hasProgress || envelope.fingerprint === lastUploadedFingerprint) return true;
  syncInFlight = (async () => {
    try {
      const remoteState = await readCloudEnvelope();
      if (remoteState.error) {
        console.warn(`[RPChess] cloud save sync paused on invalid remote state: ${remoteState.error}`);
        return false;
      }
      const remote = remoteState.envelope;
      if (remote?.hasProgress) {
        if (lastUploadedFingerprint && remote.fingerprint !== lastUploadedFingerprint) {
          beginConflict(envelope, remote, remoteState.manifest, 'concurrent-device-change');
          return false;
        }
        if (!lastUploadedFingerprint) {
          const decision = compareEnvelopes(envelope, remote);
          if (decision === 'same') {
            lastUploadedFingerprint = envelope.fingerprint;
            return true;
          }
          beginConflict(envelope, remote, remoteState.manifest, 'unknown-remote-baseline');
          return false;
        }
      }
      const ok = await writeCloudEnvelope(envelope, remoteState.manifest);
      if (ok) lastUploadedFingerprint = envelope.fingerprint;
      return ok;
    } catch (error) {
      console.warn('[RPChess] cloud save sync failed', error);
      return false;
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

function scheduleCloudSync() {
  if (!platform.storage.cloud.available || conflictState) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncCloudNow();
  }, CLOUD_SYNC_DEBOUNCE_MS);
}

function installCloudAutosync() {
  if (autosyncInstalled || !platform.storage.cloud.available) return;
  autosyncInstalled = true;
  for (const name of [
    'rpchess:run-updated',
    'rpchess:power-updated',
    'rpchess:chronicle-updated',
    'rpchess:tutorial-updated',
    'rpchess:ad-receipts-updated'
  ]) globalThis.addEventListener?.(name, scheduleCloudSync);
  platform.lifecycle.subscribe(({ active }) => {
    if (!active) {
      if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
      void syncCloudNow();
    }
  }, { immediate:false });
}

async function bootstrapCloudSave() {
  if (bootstrapResult) return bootstrapResult;
  if (!platform.storage.cloud.available) {
    bootstrapResult = Object.freeze({ status:'web', conflict:null });
    return bootstrapResult;
  }
  const local = prepareLocalEnvelope();
  let cloudState;
  try { cloudState = await readCloudEnvelope(); }
  catch (error) {
    console.warn('[RPChess] cloud save bootstrap read failed', error);
    installCloudAutosync();
    bootstrapResult = Object.freeze({ status:'cloud-unavailable', conflict:null });
    return bootstrapResult;
  }
  const cloud = cloudState.envelope;
  if (cloudState.error && !cloud) {
    console.warn(`[RPChess] cloud save ignored corrupt remote state: ${cloudState.error}`);
  }
  const decision = compareEnvelopes(local, cloud);
  if (decision === 'conflict') {
    const conflict = beginConflict(local, cloud, cloudState.manifest, 'bootstrap-divergence');
    bootstrapResult = Object.freeze({ status:'conflict', conflict });
    return bootstrapResult;
  }
  if (decision === 'cloud' && cloud) {
    restoreLocalEnvelope(cloud);
    lastUploadedFingerprint = cloud.fingerprint;
  } else if (decision === 'local' && local.hasProgress) {
    const ok = await writeCloudEnvelope(local, cloudState.manifest);
    if (ok) lastUploadedFingerprint = local.fingerprint;
  } else if (decision === 'same') {
    lastUploadedFingerprint = local.fingerprint;
  }
  installCloudAutosync();
  bootstrapResult = Object.freeze({ status:decision, conflict:null });
  return bootstrapResult;
}

function authoritativeEnvelope(chosen, other) {
  const revision = Math.max(Number(chosen?.revision) || 0, Number(other?.revision) || 0) + 1;
  const updatedAt = nowMs();
  const payload = chosen.payload;
  return {
    schemaVersion:CLOUD_SAVE_SCHEMA_VERSION,
    revision,
    updatedAt,
    fingerprint:payloadFingerprint(payload),
    payload,
    hasProgress:payloadHasProgress(payload)
  };
}

async function resolveCloudConflict(choice) {
  if (!conflictState || !['local','cloud'].includes(choice)) return false;
  const current = conflictState;
  const chosen = choice === 'cloud' ? current.cloud : current.local;
  const other = choice === 'cloud' ? current.local : current.cloud;
  if (!chosen?.payload) return false;
  const authoritative = authoritativeEnvelope(chosen, other);
  let ok = false;
  try { ok = await writeCloudEnvelope(authoritative, current.manifest); }
  catch { ok = false; }
  if (!ok) return false;
  restoreLocalEnvelope(authoritative);
  lastUploadedFingerprint = authoritative.fingerprint;
  conflictState = null;
  bootstrapResult = Object.freeze({ status:`resolved-${choice}`, conflict:null });
  installCloudAutosync();
  emitCloudEvent('rpchess:cloud-conflict-resolved', { choice, revision:authoritative.revision });
  emitCloudEvent('rpchess:run-updated', { source:'cloud-conflict-resolved' });
  return true;
}

function cloudSaveStatus() {
  return Object.freeze({
    available:platform.storage.cloud.available,
    conflict:Boolean(conflictState),
    lastUploadedFingerprint
  });
}

export {
  CLOUD_SAVE_SCHEMA_VERSION,
  CLOUD_SAVE_MANIFEST_KEY,
  CLOUD_SAVE_LOCAL_META_KEY,
  TUTORIAL_STORAGE_KEY,
  AD_RECEIPTS_STORAGE_KEY,
  CLOUD_RATING_RECEIPT_LIMIT,
  CLOUD_CHUNK_BYTES,
  compactRun,
  expandRun,
  localPayload,
  payloadHasProgress,
  checksum,
  splitUtf8,
  payloadFingerprint,
  prepareLocalEnvelope,
  normalizeManifest,
  readCloudEnvelope,
  writeCloudEnvelope,
  restoreLocalEnvelope,
  compareEnvelopes,
  authoritativeEnvelope,
  bootstrapCloudSave,
  resolveCloudConflict,
  scheduleCloudSync,
  syncCloudNow,
  cloudSaveStatus
};
