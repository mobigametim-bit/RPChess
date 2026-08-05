const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { createBrowserProfileStore, inspectBrowserProfile } = require('../src/browser/profile-persistence.cjs');
const { createBrowserRunSelectionHost } = require('../src/browser/iron-marches-browser-host.cjs');

async function launch(host) {
  await host.dispatch({ type: 'SelectKing', kingId: 'king.oathkeeper' });
  await host.dispatch({ type: 'SelectDoctrine', doctrineId: 'doctrine.fortress' });
  await host.dispatch({ type: 'ToggleHero', heroId: 'hero.aldric_wall' });
  return host.dispatch({ type: 'LockSelection' });
}

(async () => {
  const storage = new MemoryKeyValueStorage();
  const clockValues = [1000, 2000, 3000, 4000, 5000, 6000];
  const clock = () => clockValues.shift() || 7000;
  const first = createBrowserRunSelectionHost({ seed: 17001, profileId: 'profile-1', storage, clock, deviceId: 'browser-test' });
  assert.strictEqual(first.getSnapshot().status, 'selecting');
  await launch(first);
  assert.strictEqual(first.getSnapshot().status, 'ready');
  assert.strictEqual(first.getProfile().revision, 1);
  const runtime = first.getRuntimeHost();
  const initialRuntimeSnapshot = runtime.getSnapshot();
  const route = initialRuntimeSnapshot.campaign.routes.find((candidate) => candidate.affordable);
  assert.ok(route);
  await runtime.dispatch({ type: 'Travel', targetNodeId: route.to });
  assert.strictEqual(runtime.getLastSaveEnvelope().revision, 2);
  const savedSnapshot = runtime.getSnapshot();

  const resumed = createBrowserRunSelectionHost({ seed: 99999, profileId: 'profile-1', storage, clock, deviceId: 'browser-test' });
  assert.strictEqual(resumed.getSnapshot().status, 'ready');
  assert.strictEqual(resumed.getRuntimeHost().resumed, true);
  assert.deepStrictEqual(resumed.getRuntimeHost().getSnapshot(), savedSnapshot);
  assert.strictEqual(resumed.getProfile().revision, 2);

  const secondProfile = createBrowserRunSelectionHost({ seed: 17002, profileId: 'profile-2', storage, clock, deviceId: 'browser-test' });
  assert.strictEqual(secondProfile.getSnapshot().status, 'selecting');
  assert.strictEqual(secondProfile.getProfile().revision, 0);

  const store = createBrowserProfileStore({ storage, clock, deviceId: 'browser-test' });
  const keys = store.keys('profile-1');
  storage.setItem(keys.current, '{broken-json');
  const recovered = createBrowserRunSelectionHost({ profileId: 'profile-1', storage, clock, deviceId: 'browser-test' });
  assert.strictEqual(recovered.getSnapshot().status, 'ready');
  assert.strictEqual(recovered.getProfile().recoveredFrom, 'backup');
  assert.strictEqual(inspectBrowserProfile(store, 'profile-1', recovered.bundle.registry).state !== null, true);

  const fresh = createBrowserRunSelectionHost({ seed: 17003, profileId: 'profile-1', storage, clock, deviceId: 'browser-test', forceNew: true });
  assert.strictEqual(fresh.getSnapshot().status, 'selecting');
  assert.strictEqual(fresh.getProfile().revision, 0);
  assert.strictEqual(store.load('profile-2').status, 'empty');

  const app = fs.readFileSync(path.resolve(__dirname, '../game/js/vertical-slice-app.mjs'), 'utf8');
  assert.ok(app.includes("params.get('new') === '1'"));
  assert.ok(app.includes("initial.status === 'ready'"));
  assert.ok(app.includes('resolveLocalStorage'));
  console.log('Browser profile persistence: 1/1 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
