const assert = require('assert');
const {
  stableStringify,
  sha256
} = require('../src/save/checksum.cjs');
const {
  createSaveEnvelope,
  verifySaveEnvelope,
  serializeSaveEnvelope,
  parseSaveEnvelope
} = require('../src/save/envelope.cjs');
const { SaveMigrationRegistry } = require('../src/save/migrations.cjs');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { AtomicProfileStore } = require('../src/save/profile-store.cjs');
const { resolveSaveConflict } = require('../src/save/conflicts.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function makeClock(start = 1000) {
  let value = start;
  return () => value++;
}

function makeStore(options = {}) {
  return new AtomicProfileStore({
    storage: options.storage || new MemoryKeyValueStorage(),
    deviceId: options.deviceId || 'test-device',
    clock: options.clock || makeClock(),
    schemaVersion: options.schemaVersion || 1,
    migrations: options.migrations || null
  });
}

test('canonical serialization is key-order independent and rejects unsafe values', () => {
  assert.strictEqual(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }));
  assert.strictEqual(sha256({ b: 2, a: 1 }), sha256({ a: 1, b: 2 }));
  assert.throws(() => stableStringify({ bad: Infinity }), /non-finite/);
  const circular = {}; circular.self = circular;
  assert.throws(() => stableStringify(circular), /circular/);
});

test('save envelope detects payload or metadata tampering', () => {
  const envelope = createSaveEnvelope({
    profileId: 'profile-1', revision: 1, savedAt: 100, deviceId: 'device-a', payload: { gold: 12 }
  });
  assert.strictEqual(verifySaveEnvelope(envelope).ok, true);
  assert.strictEqual(parseSaveEnvelope(serializeSaveEnvelope(envelope)).ok, true);
  assert.strictEqual(verifySaveEnvelope({ ...envelope, payload: { gold: 999 } }).reason, 'checksum_mismatch');
  assert.strictEqual(verifySaveEnvelope({ ...envelope, revision: 2 }).reason, 'checksum_mismatch');
});

test('three profile slots save independently with monotonic revisions and backups', () => {
  const storage = new MemoryKeyValueStorage();
  const store = makeStore({ storage });
  const first = store.save(1, { hero: 'aldric', gold: 5 });
  const second = store.save(1, { hero: 'aldric', gold: 8 });
  const other = store.save(2, { hero: 'lyra', gold: 3 });
  assert.strictEqual(first.revision, 1);
  assert.strictEqual(second.revision, 2);
  assert.strictEqual(second.parentChecksum, first.checksum);
  assert.strictEqual(other.revision, 1);
  assert.deepStrictEqual(store.load(1).payload, { gold: 8, hero: 'aldric' });
  assert.deepStrictEqual(store.load(2).payload, { gold: 3, hero: 'lyra' });
  const listed = store.listProfiles();
  assert.deepStrictEqual(listed.map((slot) => slot.status), ['available', 'available', 'empty']);
  assert.strictEqual(storage.getItem(store.keys(1).backup), serializeSaveEnvelope(first));
});

test('corrupt current save recovers from the last valid backup', () => {
  const storage = new MemoryKeyValueStorage();
  const store = makeStore({ storage });
  const first = store.save(1, { step: 1 });
  store.save(1, { step: 2 });
  storage.setItem(store.keys(1).current, '{broken');
  const loaded = store.load(1);
  assert.strictEqual(loaded.status, 'recovered');
  assert.strictEqual(loaded.recoveredFrom, 'backup');
  assert.deepStrictEqual(loaded.payload, { step: 1 });
  assert.strictEqual(loaded.envelope.checksum, first.checksum);
  assert.strictEqual(parseSaveEnvelope(storage.getItem(store.keys(1).current)).ok, true);
});

test('interrupted commit leaves a valid pending save that is recovered next load', () => {
  class FailingStorage extends MemoryKeyValueStorage {
    constructor() { super(); this.failCurrent = false; }
    setItem(key, value) {
      if (this.failCurrent && String(key).endsWith('.current')) {
        this.failCurrent = false;
        throw new Error('simulated current write failure');
      }
      super.setItem(key, value);
    }
  }
  const storage = new FailingStorage();
  const store = makeStore({ storage });
  const first = store.save(1, { step: 1 });
  storage.failCurrent = true;
  assert.throws(() => store.save(1, { step: 2 }), /simulated current write failure/);
  assert.strictEqual(parseSaveEnvelope(storage.getItem(store.keys(1).current)).envelope.checksum, first.checksum);
  assert.strictEqual(parseSaveEnvelope(storage.getItem(store.keys(1).pending)).ok, true);
  const loaded = store.load(1);
  assert.strictEqual(loaded.status, 'recovered');
  assert.strictEqual(loaded.recoveredFrom, 'pending');
  assert.deepStrictEqual(loaded.payload, { step: 2 });
  assert.strictEqual(storage.getItem(store.keys(1).pending), null);
});

test('sequential migration creates a new revision linked to the old checksum', () => {
  const migrations = new SaveMigrationRegistry(2).register(1, (payload) => ({
    ...payload,
    resources: { gold: payload.gold || 0 },
    gold: undefined
  }));
  const storage = new MemoryKeyValueStorage();
  const old = createSaveEnvelope({
    schemaVersion: 1,
    profileId: 'profile-1',
    revision: 4,
    savedAt: 100,
    deviceId: 'old-device',
    payload: { gold: 17, hero: 'mara' }
  });
  storage.setItem('rpchess.save.profile-1.current', serializeSaveEnvelope(old));
  const store = makeStore({ storage, schemaVersion: 2, migrations, deviceId: 'new-device', clock: () => 200 });
  const loaded = store.load(1);
  assert.strictEqual(loaded.status, 'migrated');
  assert.strictEqual(loaded.envelope.schemaVersion, 2);
  assert.strictEqual(loaded.envelope.revision, 5);
  assert.strictEqual(loaded.envelope.parentChecksum, old.checksum);
  assert.deepStrictEqual(loaded.payload, { hero: 'mara', resources: { gold: 17 } });
});

test('future schema is preserved but never silently loaded or overwritten', () => {
  const storage = new MemoryKeyValueStorage();
  const future = createSaveEnvelope({
    schemaVersion: 3,
    profileId: 'profile-1', revision: 8, savedAt: 100, deviceId: 'future', payload: { future: true }
  });
  storage.setItem('rpchess.save.profile-1.current', serializeSaveEnvelope(future));
  const store = makeStore({ storage, schemaVersion: 1 });
  assert.strictEqual(store.load(1).status, 'future_schema');
  assert.throws(() => store.save(1, { overwrite: true }), /future_schema/);
  assert.strictEqual(parseSaveEnvelope(storage.getItem(store.keys(1).current)).envelope.checksum, future.checksum);
});

test('cloud conflict resolver auto-selects only proven descendants', () => {
  const base = createSaveEnvelope({
    profileId: 'profile-1', revision: 1, savedAt: 100, deviceId: 'pc', payload: { step: 1 }
  });
  const local = createSaveEnvelope({
    profileId: 'profile-1', revision: 2, savedAt: 110, deviceId: 'pc', parentChecksum: base.checksum, payload: { step: 2 }
  });
  const cloud = createSaveEnvelope({
    profileId: 'profile-1', revision: 2, savedAt: 120, deviceId: 'deck', parentChecksum: base.checksum, payload: { step: 3 }
  });
  assert.strictEqual(resolveSaveConflict(local, base).state, 'local_descends_from_cloud');
  assert.strictEqual(resolveSaveConflict(base, local).state, 'cloud_descends_from_local');
  const divergent = resolveSaveConflict(local, cloud);
  assert.strictEqual(divergent.state, 'diverged');
  assert.strictEqual(divergent.winner, null);
  assert.strictEqual(divergent.requiresUserChoice, true);
  assert.strictEqual(divergent.suggested, 'cloud');
});

test('deleting a profile removes current, pending and backup without touching others', () => {
  const store = makeStore();
  store.save(1, { a: 1 });
  store.save(1, { a: 2 });
  store.save(2, { b: 1 });
  store.delete(1);
  assert.strictEqual(store.load(1).status, 'empty');
  assert.deepStrictEqual(store.load(2).payload, { b: 1 });
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
  }
}
console.log(`\nAtomic save foundation: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
