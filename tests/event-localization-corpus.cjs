const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

(async () => {
  const root = path.resolve(__dirname, '..');
  globalThis.localStorage = new MemoryStorage();
  globalThis.document = { documentElement: { lang: '' } };

  const importFile = (relative) => import(pathToFileURL(path.join(root, relative)).href);
  const i18n = await importFile('game/js/i18n.mjs');
  const { applyEventContentV3 } = await importFile('game/js/events/event-content-v3.mjs');
  const { applyEventHeroChoicesV5 } = await importFile('game/js/events/event-hero-choices-v5.mjs');
  const { personalizePlayerNarrative, personalizePlayerTitle } = await importFile('game/js/player-identity-core.mjs');

  const sourceFiles = [
    ...Array.from({ length: 10 }, (_, i) => `game/js/events/event-data-${String(i + 1).padStart(2, '0')}.mjs`),
    ...Array.from({ length: 5 }, (_, i) => `game/js/events/event-data-v4-${String(i + 1).padStart(2, '0')}.mjs`),
    ...Array.from({ length: 25 }, (_, i) => `game/js/events/event-data-v4c-${String(i + 1).padStart(2, '0')}.mjs`)
  ];

  const catalog = [];
  for (const file of sourceFiles) {
    const module = await importFile(file);
    const events = Object.values(module).find((value) => Array.isArray(value));
    assert(events, `${file} must export an Event array`);
    catalog.push(...events);
  }

  assert.strictEqual(catalog.length, 500, 'active Event source corpus must contain exactly 500 events');
  assert.deepStrictEqual(
    catalog.map((event) => event.id),
    Array.from({ length: 500 }, (_, i) => `E${String(i + 1).padStart(3, '0')}`),
    'active Event source corpus must remain contiguous E001-E500'
  );

  i18n.setLanguage('en');
  const cyrillic = /[А-Яа-яЁё]/u;
  const placeholders = (value) => [...String(value).matchAll(/\{[a-zA-Z0-9_]+\}/g)].map((match) => match[0]).sort();
  let auditedStrings = 0;

  for (const sourceEvent of catalog) {
    const event = applyEventContentV3(applyEventHeroChoicesV5(sourceEvent));
    const visible = [
      ['title', event.title],
      ['race', String(event.race || 'Смешанное').toUpperCase()],
      ...((event.storyParagraphs || []).map((value, index) => [`story[${index}]`, value])),
      ['kingReaction', event.kingReaction]
    ];

    for (const choice of event.choices || []) {
      visible.push([`${choice.id}.action`, choice.action]);
      for (const warning of choice.warnings || []) visible.push([`${choice.id}.warning`, warning]);
      if (choice.heroReaction?.text) visible.push([`${choice.id}.heroReaction`, choice.heroReaction.text]);
      if (choice.heroLine) visible.push([`${choice.id}.heroLine`, choice.heroLine]);
      if (choice.requiredHeroName) visible.push([`${choice.id}.requiredHeroName`, choice.requiredHeroName]);
    }

    for (const [field, raw] of visible) {
      if (raw == null || raw === '') continue;
      const source = String(raw);
      const translated = i18n.translateLegacy(source);
      assert.strictEqual(cyrillic.test(translated), false, `${event.id} ${field} leaks Cyrillic in EN: ${source}`);
      assert.deepStrictEqual(placeholders(translated), placeholders(source), `${event.id} ${field} must preserve placeholders`);
      if (source.includes('Король')) {
        const personalized = field === 'title'
          ? personalizePlayerTitle(translated, 'Qw')
          : personalizePlayerNarrative(translated, 'Qw');
        assert.strictEqual(cyrillic.test(personalized), false, `${event.id} ${field} leaks Cyrillic after player personalization`);
      }
      auditedStrings += 1;
    }
  }

  const e147 = applyEventContentV3(applyEventHeroChoicesV5(catalog[146]));
  assert.strictEqual(i18n.translateLegacy(e147.title), 'The Pilgrim Who Walks Backward', 'acceptance Event E147 title must be English');
  assert(e147.storyParagraphs.every((line) => !cyrillic.test(i18n.translateLegacy(line))), 'acceptance Event E147 story must be fully English');
  assert(e147.choices.every((choice) => !cyrillic.test(i18n.translateLegacy(choice.action))), 'acceptance Event E147 choices must be fully English');

  const e291 = applyEventContentV3(applyEventHeroChoicesV5(catalog[290]));
  const e291Visible = [e291.title, ...(e291.storyParagraphs || []), e291.kingReaction, ...e291.choices.map((choice) => choice.action)].filter(Boolean);
  assert(e291Visible.every((line) => !cyrillic.test(i18n.translateLegacy(line))), 'acceptance Event E291 source copy must be fully English');
  const e291Personalized = personalizePlayerNarrative(i18n.translateLegacy(e291.storyParagraphs[1]), 'Qw');
  assert.strictEqual(cyrillic.test(e291Personalized), false, 'E291 must stay English after player-name personalization');
  assert(e291Personalized.includes('Qw'), 'E291 personalized English copy must retain the player name');

  delete globalThis.document;
  delete globalThis.localStorage;
  console.log(`Complete Event localization corpus: PASS (500 events, ${auditedStrings} visible authored strings)`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
