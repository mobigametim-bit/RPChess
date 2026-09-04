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
    .filter((file) => /^en-(?:v3|v4|v4c|v5)-\d+\.mjs$/.test(file))
    .sort();
  assert.strictEqual(eventDictionaryFiles.filter((file) => file.startsWith('en-v3-')).length, 10, 'Events v3 must ship exactly 10 English dictionary chunks');
  assert.strictEqual(eventDictionaryFiles.filter((file) => file.startsWith('en-v4-')).length, 5, 'Events v4 E101-E150 must ship exactly 5 English dictionary chunks');
  assert.strictEqual(eventDictionaryFiles.filter((file) => file.startsWith('en-v4c-')).length, 25, 'Events v4c must ship exactly 25 English dictionary chunks');
  assert.strictEqual(eventDictionaryFiles.filter((file) => file.startsWith('en-v5-')).length, 11, 'Events v5 must ship exactly 11 English dictionary chunks');

  const placeholders = (value) => [...String(value).matchAll(/\{[a-zA-Z0-9_]+\}/g)].map((match) => match[0]).sort();
  const cyrillic = /[А-Яа-яЁё]/u;
  const narrativeUrl = pathToFileURL(path.join(root, 'game/localization/event-narrative-en.mjs')).href;
  const { EVENT_NARRATIVE_EN_EXACT } = await import(narrativeUrl);
  assert.strictEqual(Object.keys(EVENT_NARRATIVE_EN_EXACT).length, 129, 'generated Event narrative must cover all 14 race voices plus the default voice');
  for (const [source, translation] of Object.entries(EVENT_NARRATIVE_EN_EXACT)) {
    assert(String(translation).trim(), `generated Event narrative translation must not be empty: ${source}`);
    assert.strictEqual(cyrillic.test(String(translation)), false, `generated Event narrative English translation must not contain Cyrillic: ${source}`);
  }

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
  assert.strictEqual(i18n.translateLegacy('Паломник, который идёт назад'), 'The Pilgrim Who Walks Backward', 'Events v4 E147 must be available through the runtime translator');
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
  assert.strictEqual(i18n.translateLegacy('♗ Слон'), '♗ Bishop', 'Event role labels must translate while preserving their piece glyph');
  assert.strictEqual(i18n.translateLegacy('СМЕШАННОЕ'), 'MIXED', 'uppercased Event race labels must translate after presentation casing');
  assert.deepStrictEqual(
    [
      i18n.translateLegacy('ЛУЧШАЯ ЛЕТОПИСЬ'),
      i18n.translateLegacy('ТЯЖЕЛО РАНЕН'),
      i18n.translateLegacy('СМЕШАННОЕ — ЗВЕРОЛЮДИ / ЛЮДИ'),
      i18n.translateLegacy('РИСК РАНЕНИЯ КОРОЛЯ')
    ],
    ['BEST CHRONICLE', 'SEVERELY WOUNDED', 'MIXED — BEASTFOLK / HUMANS', 'KING WOUND RISK'],
    'acceptance-test composed labels must remain fully localized instead of leaking partial Cyrillic'
  );
  assert.strictEqual(
    i18n.translateLegacy('КОРОЛЬ МОЖЕТ ПОГИБНУТЬ · РИСК РАНЕНИЯ'),
    'THE KING MAY DIE · WOUND RISK',
    'joined Event warnings must translate segment by segment'
  );
  assert.strictEqual(
    i18n.translateLegacy('Аббатиса Селена: тяжело ранен'),
    'Abbess Celene: severely wounded',
    'Event outcome notes must translate generated named-hero status copy'
  );
  assert.strictEqual(
    i18n.translateLegacy('Дорога здесь хранит следы слишком многих сапог: солдатских, купеческих и босых крестьянских. Над изгородями тянется дым, и всякий встречный сперва смотрит на оружие, а уже потом — в лицо.'),
    'The road here bears the tracks of too many boots: soldiers, merchants, and barefoot peasants. Smoke drifts above the hedges, and every passer-by looks at weapons before faces.',
    'generated Event atmosphere must be available through the runtime translator'
  );
  assert.strictEqual(
    i18n.translateLegacy('Из соседней палатки раздаётся хлопок, дым и радостное «Получилось!».'),
    'A bang, a cloud of smoke, and a delighted “It worked!” come from the next tent.',
    'late-race generated Event closing copy must be localized'
  );
  assert.strictEqual(i18n.translateLegacy('Небесный Каганат'), 'Sky Khanate', 'late-game recruit origins must be localized');
  assert.strictEqual(
    i18n.translateLegacy('Амбициозная претендентка, привыкшая превращать любой поход в проверку лидерства.'),
    'An ambitious claimant accustomed to turning every campaign into a test of leadership.',
    'late-game recruit biographies must be localized'
  );
  assert.strictEqual(
    i18n.translateLegacy('Хулан никогда не спорит за право идти первой — она просто оказывается там раньше остальных. Для неё власть начинается с темпа.'),
    'Khulan never argues for the right to go first — she simply gets there before everyone else. To her, authority begins with tempo.',
    'canonical hero notes must be localized'
  );
  assert.strictEqual(i18n.translateLegacy('ВСЕ 2 СЛОТА · ЛАДЬЯ ЗАНЯТЫ'), 'ALL 2 SLOTS · ROOK FULL', 'uppercased Battle slot composites must localize the role token');
  assert.strictEqual(i18n.translateLegacy('Мат — победа белых'), 'Checkmate — White wins', 'Classic Chess result composites must localize dynamically');
  assert.strictEqual(i18n.translateLegacy('Кто ты, воин?'), 'Who are you, warrior?', 'Player Identity copy must be localized');
  assert.strictEqual(i18n.translateLegacy('Бату Утёс — ТЯЖЕЛО РАНЕН'), 'Batu Cliff — SEVERELY WOUNDED', 'combat wound toasts must localize named heroes');
  assert.strictEqual(i18n.translateLegacy('+1 ПРИПАС'), '+1 SUPPLY', 'resource toasts must localize supply deltas');
  assert.strictEqual(i18n.translateLegacy('Стоимость Наёмников: 42 золота'), 'Mercenary cost: 42 gold', 'Mercenary cost accessibility copy must localize');
  assert.strictEqual(i18n.translateLegacy('Горизонтали доски'), 'Board ranks', 'board coordinate accessibility labels must localize');
  assert.strictEqual(i18n.translateLegacy('Ход соперника…'), 'Opponent’s move…', 'dynamic Puzzle status must localize');
  assert.strictEqual(i18n.translateLegacy('Задача решена'), 'Puzzle solved', 'Puzzle solved status must localize');
  assert.deepStrictEqual(
    [
      i18n.translateLegacy('Сила: примерно СМЕРТЕЛЬНАЯ'),
      i18n.translateLegacy('Тактика противника: Безжалостный'),
      i18n.translateLegacy('Тактика противника: Мастерский'),
      i18n.translateLegacy('Stockfish 18 lite · Мастерский · ≈2000 Elo'),
      i18n.translateLegacy('Перед вами элитная армия. Каждый неточный ход будет наказан. Враг уже занял поле и начинает первым. Ваш отряд принимает бой, удерживая оборону.')
    ],
    [
      'Strength: about DEADLY',
      'Enemy tactic: Ruthless',
      'Enemy tactic: Masterful',
      'Stockfish 18 lite · Master Level · ≈2000 Elo',
      'An elite army stands before you. Every inaccurate move will be punished. The enemy already controls the field and moves first. Your roster takes the fight on the defensive.'
    ],
    'nested and contextual combat metadata must localize without changing domain terminology'
  );
  assert.deepStrictEqual(
    [i18n.translateLegacy('МАТ В 3'), i18n.translateLegacy('ВЫИГРАЙТЕ ФЕРЗЯ'), i18n.translateLegacy('e4: пешка')],
    ['MATE IN 3', 'WIN THE QUEEN', 'e4: pawn'],
    'Puzzle objective and board accessibility copy must localize'
  );
  assert.deepStrictEqual(
    [
      i18n.translateLegacy(' выбирают ход.'),
      i18n.translateLegacy('+1 припас'),
      i18n.translateLegacy('♔ Король 1 / 1'),
      i18n.translateLegacy('ЗДОРОВЫ 5'),
      i18n.translateLegacy('УГРОЗА ★★★')
    ],
    [' are choosing a move.', '+1 supply', '♔ King 1 / 1', 'HEALTHY 5', 'THREAT ★★★'],
    'split Classic copy and compact runtime labels must localize'
  );

  // High-value corpus gate: validate the actual 500-event runtime catalog after v3/v5 overlays,
  // not just whichever dictionary chunks happen to exist.
  const { EVENT_IDS } = await import(pathToFileURL(path.join(root, 'game/js/events-data.mjs')).href);
  const { normalizedEvent } = await import(pathToFileURL(path.join(root, 'game/js/events-core.mjs')).href);
  const { applyEventContentV3 } = await import(pathToFileURL(path.join(root, 'game/js/events/event-content-v3.mjs')).href);
  const { personalizePlayerNarrative, personalizePlayerTitle } = await import(pathToFileURL(path.join(root, 'game/js/player-identity-core.mjs')).href);
  assert.strictEqual(EVENT_IDS.length, 500, 'active Event corpus must contain exactly E001-E500');
  let auditedEventStrings = 0;
  for (const id of EVENT_IDS) {
    const event = applyEventContentV3(normalizedEvent(id));
    assert(event, `${id} must resolve through the active Event runtime`);
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
      assert.strictEqual(cyrillic.test(translated), false, `${id} ${field} must not leak Cyrillic in EN: ${source}`);
      assert.deepStrictEqual(placeholders(translated), placeholders(source), `${id} ${field} must preserve placeholders`);
      if (source.includes('Король')) {
        const personalized = field === 'title'
          ? personalizePlayerTitle(translated, 'Qw')
          : personalizePlayerNarrative(translated, 'Qw');
        assert.strictEqual(cyrillic.test(personalized), false, `${id} ${field} must remain EN after player-name personalization`);
      }
      auditedEventStrings += 1;
    }
  }
  const eventAppSource = fs.readFileSync(path.join(root, 'game/js/events-app.mjs'), 'utf8');
  assert(
    eventAppSource.includes('presentEventText(event.title, { title: true })')
      && eventAppSource.includes('p.textContent=presentEventText(paragraph)')
      && eventAppSource.includes('presentEventText(displayedChoiceAction(choice))'),
    'Event runtime must translate authored source before player-name personalization for title, story and choices'
  );
  const personalizedE291 = personalizePlayerNarrative(
    i18n.translateLegacy('Барон немедленно соглашается — но только после того, как узнаёт, что Король проходит рядом. Он заявляет, что именно Король должен представлять «человеческую сторону».'),
    'Qw'
  );
  assert.strictEqual(cyrillic.test(personalizedE291), false, 'E291 must remain fully English after replacing the King with the player name');
  assert(personalizedE291.includes('Qw'), 'E291 personalized English copy must retain the player name');

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
  console.log(`Localization foundation API, RU/EN parity and complete Event corpus (${referenceKeys.length} UI keys, ${auditedEventStrings} active Event strings, ${v5HeroLineCount} v5 hero lines, ${Object.keys(EVENT_NARRATIVE_EN_EXACT).length} generated Event voice lines): PASS`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
