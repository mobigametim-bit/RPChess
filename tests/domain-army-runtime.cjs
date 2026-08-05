const assert = require('assert');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { createBrowserProfileStore } = require('../src/browser/profile-persistence.cjs');
const {
  DEFAULT_BROWSER_SELECTION,
  createBrowserIronMarchesRuntimeHost,
  createBrowserRunSelectionHost
} = require('../src/browser/iron-marches-browser-host.cjs');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');
const {
  createRuntimeArmy,
  validateRuntimeArmy
} = require('../src/runtime/army-roster.cjs');
const {
  LEGACY_RUNTIME_SCHEMA_VERSION,
  RUNTIME_SCHEMA_VERSION,
  validateVerticalSliceSnapshot,
  replayVerticalSlice
} = require('../src/runtime/vertical-slice.cjs');

const bundle = buildBrowserProductionBundle();
const validation = (defaultArmy) => ({
  contentRegistry: bundle.registry,
  combatProfiles: bundle.combatProfiles,
  defaultArmy,
  requireArmy: true
});

const selectedArmy = createRuntimeArmy({
  regionId: DEFAULT_BROWSER_SELECTION.regionId,
  kingId: DEFAULT_BROWSER_SELECTION.kingId,
  doctrineId: DEFAULT_BROWSER_SELECTION.doctrineId,
  heroIds: ['hero.aldric_wall']
}, bundle.registry, bundle.combatProfiles);

const runtime = createBrowserIronMarchesRuntimeHost({
  seed: 18001,
  resume: false,
  saveStore: null,
  selection: {
    regionId: DEFAULT_BROWSER_SELECTION.regionId,
    kingId: DEFAULT_BROWSER_SELECTION.kingId,
    doctrineId: DEFAULT_BROWSER_SELECTION.doctrineId,
    heroIds: ['hero.aldric_wall']
  }
});
const state = runtime.getState();
assert.strictEqual(state.schemaVersion, RUNTIME_SCHEMA_VERSION);
assert.strictEqual(state.army.format, 'rpchess-runtime-army');
assert.deepStrictEqual(state.army.heroIds, ['hero.aldric_wall']);
assert.deepStrictEqual(runtime.army, state.army);

const legacy = JSON.parse(JSON.stringify(state));
legacy.schemaVersion = LEGACY_RUNTIME_SCHEMA_VERSION;
delete legacy.army;
const migrated = validateVerticalSliceSnapshot(legacy, validation(selectedArmy));
assert.strictEqual(migrated.schemaVersion, RUNTIME_SCHEMA_VERSION);
assert.deepStrictEqual(migrated.army.heroIds, ['hero.aldric_wall']);
assert.deepStrictEqual(replayVerticalSlice(legacy, [], validation(selectedArmy)), migrated);
assert.throws(() => validateVerticalSliceSnapshot(legacy, {
  contentRegistry: bundle.registry,
  combatProfiles: bundle.combatProfiles,
  requireArmy: true
}), /requires an army/);

const tamperedRelics = JSON.parse(JSON.stringify(state));
tamperedRelics.army.relicIds.push('relic.nonexistent');
assert.throws(() => validateVerticalSliceSnapshot(tamperedRelics, validation(selectedArmy)), /relic bindings changed/);

const removedHeroRegistry = {
  get(kind, id) {
    if (kind === 'hero' && id === 'hero.aldric_wall') return null;
    return bundle.registry.get(kind, id);
  }
};
assert.throws(() => validateRuntimeArmy(state.army, removedHeroRegistry, bundle.combatProfiles), /missing hero/);

const brokenProfiles = JSON.parse(JSON.stringify(bundle.combatProfiles));
brokenProfiles.heroes['hero.aldric_wall'].relicIds = ['relic.deleted_from_registry'];
assert.throws(() => createRuntimeArmy({
  regionId: DEFAULT_BROWSER_SELECTION.regionId,
  kingId: DEFAULT_BROWSER_SELECTION.kingId,
  doctrineId: DEFAULT_BROWSER_SELECTION.doctrineId,
  heroIds: ['hero.aldric_wall']
}, bundle.registry, brokenProfiles), /missing relic/);

const storage = new MemoryKeyValueStorage();
const store = createBrowserProfileStore({ storage, deviceId: 'domain-army-migration', clock: (() => {
  let value = 1000;
  return () => (value += 1000);
})() });
const oldDefaultState = createBrowserIronMarchesRuntimeHost({
  seed: 18002,
  profileId: 'profile-3',
  resume: false,
  saveStore: null
}).getState();
const oldSave = JSON.parse(JSON.stringify(oldDefaultState));
oldSave.schemaVersion = LEGACY_RUNTIME_SCHEMA_VERSION;
delete oldSave.army;
const oldEnvelope = store.save('profile-3', oldSave);
assert.strictEqual(oldEnvelope.revision, 1);

const resumed = createBrowserRunSelectionHost({
  seed: 99999,
  profileId: 'profile-3',
  storage,
  deviceId: 'domain-army-migration'
});
assert.strictEqual(resumed.getSnapshot().status, 'ready');
assert.strictEqual(resumed.getRuntimeHost().resumed, true);
assert.strictEqual(resumed.getRuntimeHost().getState().schemaVersion, RUNTIME_SCHEMA_VERSION);
assert.deepStrictEqual(resumed.getRuntimeHost().getState().army.heroIds, DEFAULT_BROWSER_SELECTION.heroIds);
assert.strictEqual(resumed.getProfile().revision, 2);
const persisted = store.load('profile-3');
assert.strictEqual(persisted.payload.schemaVersion, RUNTIME_SCHEMA_VERSION);
assert.deepStrictEqual(persisted.payload.army.heroIds, DEFAULT_BROWSER_SELECTION.heroIds);

console.log('Domain army runtime and migration: 1/1 passed.');
