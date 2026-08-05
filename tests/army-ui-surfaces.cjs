const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');
const {
  createBrowserProfileStore,
  listBrowserProfiles,
  saveBrowserProfile
} = require('../src/browser/profile-persistence.cjs');
const {
  DEFAULT_BROWSER_SELECTION,
  createBrowserIronMarchesRuntimeHost
} = require('../src/browser/iron-marches-browser-host.cjs');

(async () => {
  const app = await import(pathToFileURL(path.resolve(__dirname, '../game/js/vertical-slice-app.mjs')).href);
  const presenter = await import(pathToFileURL(path.resolve(__dirname, '../game/js/vertical-slice-presenter-register-02.mjs')).href);
  const bundle = buildBrowserProductionBundle();
  const storage = new MemoryKeyValueStorage();
  const store = createBrowserProfileStore({ storage, deviceId: 'army-ui-test', clock: () => 22222 });
  const runtime = createBrowserIronMarchesRuntimeHost({
    seed: 19101,
    language: 'ru',
    profileId: 'profile-2',
    saveStore: store,
    resume: false,
    selection: DEFAULT_BROWSER_SELECTION
  });
  saveBrowserProfile(store, runtime.getState());

  const profiles = listBrowserProfiles(store, {
    contentRegistry: bundle.registry,
    combatProfiles: bundle.combatProfiles
  });
  const profile = profiles[1];
  assert.strictEqual(profile.available, true);
  assert.deepStrictEqual(profile.army.heroIds, DEFAULT_BROWSER_SELECTION.heroIds);
  assert.strictEqual(profile.army.heroCount, DEFAULT_BROWSER_SELECTION.heroIds.length);
  assert.strictEqual(profile.army.relicCount, runtime.getState().army.relicIds.length);

  const markup = app.profileSelectionMarkup(profiles, {
    language: 'ru',
    storageAvailable: true,
    registry: bundle.registry,
    localization: bundle.localization.ru
  });
  assert.ok(markup.includes('assets/kings/oathkeeper/portrait.png'));
  assert.ok(markup.includes('assets/doctrines/fortress/emblem.png'));
  assert.ok(markup.includes('assets/heroes/aldric_wall/portrait.png'));
  assert.ok(markup.includes('Профиль 2'));
  assert.ok(markup.includes('Герои:'));
  assert.ok(markup.includes('Реликвии:'));

  const snapshot = runtime.getSnapshot();
  assert.ok(snapshot.army);
  assert.strictEqual(snapshot.army.kingId, DEFAULT_BROWSER_SELECTION.kingId);
  assert.strictEqual(snapshot.army.doctrineId, DEFAULT_BROWSER_SELECTION.doctrineId);
  assert.deepStrictEqual(snapshot.army.heroIds, DEFAULT_BROWSER_SELECTION.heroIds);
  assert.strictEqual(snapshot.army.heroCount, DEFAULT_BROWSER_SELECTION.heroIds.length);
  assert.strictEqual(snapshot.army.heroes[0].name.length > 0, true);

  const panel = presenter.armyPanelMarkup(snapshot);
  assert.ok(panel.includes('data-rp02-army-panel'));
  assert.ok(panel.includes('assets/kings/oathkeeper/portrait.png'));
  assert.ok(panel.includes('assets/doctrines/fortress/emblem.png'));
  assert.ok(panel.includes('assets/heroes/aldric_wall/portrait.png'));
  assert.ok(panel.includes('В составе похода'));

  const [firstHero, secondHero, thirdHero] = snapshot.army.heroIds;
  const tactical = {
    ...snapshot,
    status: 'scenario',
    scenario: {
      pieces: [{ heroId: firstHero, square: 'a1' }],
      reserve: [{ heroId: secondHero, entryId: 'reserve:second' }]
    }
  };
  assert.deepStrictEqual(presenter.heroArmyState(tactical, firstHero), { id: 'field', label: 'На поле: a1' });
  assert.deepStrictEqual(presenter.heroArmyState(tactical, secondHero), { id: 'reserve', label: 'В боевом резерве' });
  assert.deepStrictEqual(presenter.heroArmyState(tactical, thirdHero), { id: 'inactive', label: 'Не участвует в текущем бою' });

  const legacyMarkup = app.profileArmyMarkup({ available: true, army: null }, { language: 'ru' });
  assert.ok(legacyMarkup.includes('старого сохранения'));
  console.log('Army UI surfaces: 1/1 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
