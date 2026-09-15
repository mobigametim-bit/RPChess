const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
  clear() { this.map.clear(); }
}

(async () => {
  const listeners = new Map();
  const cloud = new Map();
  const parent = {
    postMessage(message) {
      const { handler, params = {} } = message || {};
      if (!params.request_id) return;
      let response = { request_id:params.request_id };
      if (handler === 'VKWebAppStorageSet') {
        cloud.set(String(params.key), String(params.value));
        response.result = true;
      } else if (handler === 'VKWebAppStorageGet') {
        response.keys = (params.keys || []).map((key) => ({ key:String(key), value:cloud.get(String(key)) || '' }));
      } else {
        response.result = true;
      }
      queueMicrotask(() => {
        const event = { type:'message', source:parent, data:{ data:response } };
        for (const listener of listeners.get('message') || []) listener(event);
      });
    }
  };

  globalThis.location = { search:'?vk_app_id=54754579' };
  globalThis.parent = parent;
  globalThis.document = {
    referrer:'',
    hidden:false,
    visibilityState:'visible',
    addEventListener() {}
  };
  globalThis.addEventListener = (name, listener) => {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(listener);
  };
  globalThis.removeEventListener = (name, listener) => listeners.get(name)?.delete(listener);
  globalThis.localStorage = new MemoryStorage();

  const root = path.resolve(__dirname, '..');
  const persistence = await import(pathToFileURL(path.join(root, 'game/js/run-persistence.mjs')).href);
  const cloudSave = await import(pathToFileURL(path.join(root, 'game/js/cloud-save.mjs')).href);

  let run = persistence.createRun({ now:100, playerName:'Cloud Tester' });
  run = persistence.writeRun({ ...run, gold:321, supplies:7, journeyStep:4 }, null, 200);

  const first = cloudSave.prepareLocalEnvelope({ now:1000 });
  assert.strictEqual(first.revision, 1, 'first local cloud snapshot must start revision 1');
  assert.strictEqual(first.hasProgress, true, 'active run must count as cloud progress');
  assert.strictEqual(first.payload.run.gold, 321);
  assert(first.payload.run.roster.every((entry) => entry.id && entry.status), 'known roster entries must compact to identity/status');
  assert(first.payload.run.roster.every((entry) => !entry.description), 'known roster entries must not duplicate static copy in cloud payload');

  const sample = 'абв🙂'.repeat(1500);
  const chunks = cloudSave.splitUtf8(sample, 257);
  assert.strictEqual(chunks.join(''), sample, 'UTF-8 chunking must be lossless');
  for (const chunk of chunks) assert(Buffer.byteLength(chunk, 'utf8') <= 257, 'each cloud chunk must honor byte budget');

  assert.strictEqual(await cloudSave.writeCloudEnvelope(first), true, 'first cloud write must succeed');
  const firstManifest = JSON.parse(cloud.get(cloudSave.CLOUD_SAVE_MANIFEST_KEY));
  assert.strictEqual(firstManifest.slot, 'a', 'first atomic cloud write must use slot a');
  const remoteFirst = await cloudSave.readCloudEnvelope();
  assert.strictEqual(remoteFirst.error, null);
  assert.strictEqual(remoteFirst.envelope.payload.run.gold, 321);

  run = persistence.writeRun({ ...run, gold:654, journeyStep:5 }, null, 1200);
  const second = cloudSave.prepareLocalEnvelope({ now:1300 });
  assert.strictEqual(second.revision, 2, 'changed local state must increment cloud revision');
  assert.strictEqual(await cloudSave.writeCloudEnvelope(second, firstManifest), true, 'second cloud write must succeed');
  const secondManifest = JSON.parse(cloud.get(cloudSave.CLOUD_SAVE_MANIFEST_KEY));
  assert.strictEqual(secondManifest.slot, 'b', 'second atomic cloud write must alternate slots');

  const oldDevice = globalThis.localStorage;
  globalThis.localStorage = new MemoryStorage();
  const remoteSecond = await cloudSave.readCloudEnvelope();
  assert(remoteSecond.envelope, 'cloud envelope must be readable on another local device');
  assert.strictEqual(cloudSave.restoreLocalEnvelope(remoteSecond.envelope), true);
  const restored = persistence.readRun();
  assert(restored, 'restored cloud run must satisfy normal run validation');
  assert.strictEqual(restored.gold, 654);
  assert.strictEqual(restored.journeyStep, 5);
  assert(restored.roster[0].description, 'cloud restore must rehydrate current static character copy');

  const localEnvelope = { ...second, payload:{ ...second.payload, run:{ ...second.payload.run, id:'run-local' } } };
  localEnvelope.fingerprint = cloudSave.payloadFingerprint(localEnvelope.payload);
  const cloudEnvelope = { ...second, payload:{ ...second.payload, run:{ ...second.payload.run, id:'run-cloud' } } };
  cloudEnvelope.fingerprint = cloudSave.payloadFingerprint(cloudEnvelope.payload);
  assert.strictEqual(cloudSave.compareEnvelopes(localEnvelope, cloudEnvelope), 'conflict', 'different active run ids must never be silently overwritten');

  globalThis.localStorage = oldDevice;
  console.log('VK CloudSave v1 compact payload, UTF-8 chunking, atomic slots, restore and conflict gate: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
