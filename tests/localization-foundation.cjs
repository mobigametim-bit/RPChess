const assert = require('assert');
const fs = require('fs');
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

  const eventLocalizationDir = path.join(root, 'game/localization/events');
  const eventDictionaryFiles = fs.readdirSync(eventLocalizationDir)
    .filter((file) => /^en-(?:v3|v4c|v5)-\d+\.mjs$/.test(file))
    .sort();
  assert.strictEqual(eventDictionaryFiles.filter((file) => file.startsWith('en-v3-')).length, 10, 'Events v3 must ship exactly 10 English dictionary chunks');
  assert.strictEqual(eventDictionaryFiles.filter((file) => file.startsWith('en-v4c-')).length, 25, 'Events v4c must ship exactly 25 English dictionary chunks');
  assert.strictEqual(eventDictionaryFiles.filter((file) => file.startsWith('en-v5-')).length, 11, 'Events v5 must ship exactly 11 English dictionary chunks');

  const placeholders = (value) => [...String(value).matchAll(/\{[a-zA-Z0-9_]+\}/g)].map((match) => match[0]).sort();
  const cyrillic = /[А-Яа-яЁё]/u;
  let v5HeroLineCount = 0;
  for (const file of eventDictionaryFiles) {
    const module = await import(pathToFileURL(path.join(eventLocalizationDir, file)).href);
    const dictionary = Object.values(module).find((value) => value && typeof value === 'object' && !Array.isArray(value));
    assert(dictionary, `${file} must export an event translation dictionary`);
    const entries = Object.entries(dictionary);
    assert(entries.length > 0, `${file} must not be empty`);
    if (file.startsWith('en-v5-')) v5HeroLineCount += entries.length;
    for (const [source, translation] of entries) {
      assert(String(translation).trim(), `${file} translation must not be empty: ${source}`);
      assert.strictEqual(cyrillic.test(String(translation)), false, `${file} English translation must not contain Cyrillic: ${source}`);
      assert.deepStrictEqual(placeholders(translation), placeholders(source), `${file} must preserve placeholders: ${source}`);
    }
  }
  assert.strictEqual(v5HeroLineCount, 537, 'Events v5 must cover all 537 hero-specific lines');

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
  assert.strictEqual(i18n.translateLegacy('Дорога просит цену'), 'The Road Demands a Price', 'Events v3 E100 must be available through the runtime translator');
  assert.strictEqual(i18n.translateLegacy('Пятнадцатый спутник'), 'The Fifteenth Companion', 'Events v4c E500 must be available through the runtime translator');
  assert.strictEqual(
    i18n.translateLegacy('Я знаю каждого, кого вижу. Проблема в том, что счёт всё равно говорит, будто здесь есть ещё кто-то'),
    'I know everyone I can see. The problem is that the count still says someone else is here',
    'Events v5 final hero line must be available through the runtime translator'
  );
  assert.strictEqual(
    i18n.translateLegacy('{pawnName} пересчитывает людей ещё раз и замолкает. «Я знаю каждого, кого вижу. Проблема в том, что счёт всё равно говорит, будто здесь есть ещё кто-то».'),
    '{pawnName} counts everyone again and falls silent. “I know everyone I can see. The problem is the count still says someone else is here.”',
    'event presentation translation must preserve hero placeholders'
  );
  assert.strictEqual(
    i18n.translateLegacy('Аббатиса Селена снимает перчатку и касается символа кончиками пальцев. «Здесь просили не силы. Здесь просили свидетеля».'),
    'Abbess Celene removes a glove and touches the symbol with their fingertips. “They did not ask for strength here. They asked for a witness.”',
    'rendered v3 hero reactions must translate after hero-name interpolation'
  );
  assert.strictEqual(
    i18n.translateLegacy('«Я знаю каждого, кого вижу. Проблема в том, что счёт всё равно говорит, будто здесь есть ещё кто-то»'),
    '“I know everyone I can see. The problem is that the count still says someone else is here”',
    'rendered v5 hero lines must translate inside presentation quotes'
  );
  assert.strictEqual(
    i18n.translateLegacy('🔒 Аббатиса Селена — РАНЕН'),
    '🔒 Abbess Celene — WOUNDED',
    'rendered named-hero status labels must translate the hero name and state together'
  );
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
  assert.strictEqual(i18n.setLanguage('unsupported'), 'ru', 'invalid language codes must fall back RU');
  assert.deepStrictEqual(notifications, ['en'], 'unsubscribe() must stop notifications');

  delete globalThis.document;
  delete globalThis.localStorage;
  console.log(`Localization foundation API, RU/EN parity, event dictionaries and merged persistence (${referenceKeys.length} UI keys, ${v5HeroLineCount} v5 hero lines): PASS`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
