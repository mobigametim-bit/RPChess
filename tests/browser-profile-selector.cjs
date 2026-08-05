const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');
const {
  createBrowserProfileStore,
  listBrowserProfiles,
  saveBrowserProfile,
  deleteBrowserProfile
} = require('../src/browser/profile-persistence.cjs');
const { createBrowserIronMarchesRuntimeHost } = require('../src/browser/iron-marches-browser-host.cjs');

(async () => {
  const app = await import(pathToFileURL(path.resolve(__dirname, '../game/js/vertical-slice-app.mjs')).href);
  const noProfile = app.readLaunchOptions({ search: '?lang=en&seed=55' });
  assert.strictEqual(noProfile.profileExplicit, false);
  assert.strictEqual(noProfile.language, 'en');
  const explicit = app.readLaunchOptions({ search: '?profile=profile-3&new=1' });
  assert.strictEqual(explicit.profileExplicit, true);
  assert.strictEqual(explicit.profileId, 'profile-3');
  assert.strictEqual(explicit.forceNew, true);

  const storage = new MemoryKeyValueStorage();
  const store = createBrowserProfileStore({ storage, clock: () => 12345, deviceId: 'selector-test' });
  const bundle = buildBrowserProductionBundle();
  let profiles = listBrowserProfiles(store, bundle.registry);
  assert.strictEqual(profiles.length, 3);
  assert.ok(profiles.every((profile) => profile.available === false));

  const runtime = createBrowserIronMarchesRuntimeHost({ seed: 18001, profileId: 'profile-2', saveStore: store, resume: false });
  saveBrowserProfile(store, runtime.getState());
  profiles = listBrowserProfiles(store, bundle.registry);
  assert.strictEqual(profiles[1].available, true);
  assert.strictEqual(profiles[1].profileId, 'profile-2');
  assert.strictEqual(profiles[1].seed, 18001);
  assert.strictEqual(profiles[0].available, false);
  assert.strictEqual(profiles[2].available, false);

  const markup = app.profileSelectionMarkup(profiles, { language: 'ru', storageAvailable: true });
  assert.strictEqual((markup.match(/rpprofile__card/g) || []).length, 3);
  assert.ok(markup.includes('data-profile-action="continue"'));
  assert.ok(markup.includes('data-profile-action="new"'));
  assert.ok(markup.includes('data-profile-action="delete"'));
  assert.ok(markup.includes('data-profile-action="start"'));
  assert.strictEqual(markup.includes('<script>'), false);

  const unavailable = app.profileSelectionMarkup(profiles, { language: 'en', storageAvailable: false });
  assert.ok(unavailable.includes('Local storage is unavailable'));
  assert.ok(unavailable.includes('Storage unavailable'));

  assert.strictEqual(deleteBrowserProfile(store, 'profile-2'), true);
  assert.strictEqual(listBrowserProfiles(store, bundle.registry)[1].available, false);
  assert.strictEqual(app.escapeHtml('<script>'), '&lt;script&gt;');
  console.log('Browser profile selector: 1/1 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
