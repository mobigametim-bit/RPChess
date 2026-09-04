const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
  key(index) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

(async () => {
  const root = path.resolve(__dirname, '..');
  const settingsKey = 'rpchess.reboot.v1.settings';
  const storage = new MemoryStorage();
  globalThis.localStorage = storage;
  globalThis.document = { documentElement: { lang: '' } };

  const registryUrl = pathToFileURL(path.join(root, 'game/localization/ui.mjs')).href;
  const i18nUrl = pathToFileURL(path.join(root, 'game/js/i18n.mjs')).href;
  const { LANGUAGES, UI_MESSAGES } = await import(registryUrl);

  assert.deepStrictEqual(
    LANGUAGES.map(({ code, label }) => [code, label]),
    [['ru', 'Русский'], ['en', 'English']],
    'language registry must preserve canonical codes and self-labels'
  );
  const referenceKeys = Object.keys(UI_MESSAGES.ru).sort();
  for (const language of LANGUAGES) {
    assert.deepStrictEqual(Object.keys(UI_MESSAGES[language.code]).sort(), referenceKeys, `${language.code} keys must match RU`);
    for (const key of referenceKeys) assert(String(UI_MESSAGES[language.code][key]).trim(), `${language.code}.${key} must not be empty`);
  }

  const i18n = await import(`${i18nUrl}?contract=default`);
  assert.strictEqual(i18n.currentLanguage(), 'ru', 'RU must be the default without browser-language detection');
  assert.strictEqual(globalThis.document.documentElement.lang, 'ru', 'document language must reflect the active locale');
  assert.strictEqual(i18n.t('menu.newGame'), 'Новая игра');
  assert.strictEqual(i18n.t('language.current', { language: 'Русский' }), 'Выбран: Русский', 't() must interpolate named parameters');
  assert.strictEqual(i18n.t('unknown.key'), '[missing:unknown.key]', 'missing keys must remain observable');
  assert.strictEqual(i18n.has('menu.newGame', 'en'), true);
  assert.strictEqual(i18n.has('unknown.key', 'en'), false);

  storage.setItem(settingsKey, JSON.stringify({ music: 33, sfx: 80, reducedMotion: false }));
  const notifications = [];
  const unsubscribe = i18n.subscribe((language) => notifications.push(language));
  assert.strictEqual(i18n.setLanguage('en'), 'en');
  assert.strictEqual(i18n.currentLanguage(), 'en');
  assert.strictEqual(globalThis.document.documentElement.lang, 'en');
  assert.strictEqual(i18n.t('menu.newGame'), 'New Game');
  assert.deepStrictEqual(JSON.parse(storage.getItem(settingsKey)), {
    music: 33,
    sfx: 80,
    reducedMotion: false,
    language: 'en'
  }, 'language persistence must merge with existing settings');
  assert.deepStrictEqual(notifications, ['en']);

  const reloaded = await import(`${i18nUrl}?contract=persisted`);
  assert.strictEqual(reloaded.currentLanguage(), 'en', 'persisted language must survive module reload');
  unsubscribe();
  assert.strictEqual(i18n.setLanguage('unsupported'), 'ru', 'invalid language codes must fall back to RU');
  assert.deepStrictEqual(notifications, ['en'], 'unsubscribe() must stop notifications');

  delete globalThis.document;
  delete globalThis.localStorage;
  console.log(`Localization foundation API, RU/EN parity and merged persistence (${referenceKeys.length} keys): PASS`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
