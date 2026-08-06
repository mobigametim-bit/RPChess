'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

(async () => {
  const index = read('game/index.html');
  const isolated = read('game/vertical-slice.html');
  const css = read('game/css/chronicle-profile-cards.css');
  const source = read('game/js/chronicle-profile-cards.mjs');

  for (const html of [index, isolated]) {
    assert(html.includes('css/chronicle-profile-cards.css'));
    assert(html.includes('js/chronicle-profile-cards.mjs'));
  }

  assert(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))!important'));
  assert(css.includes('grid-template-rows:190px minmax(142px,1fr) auto!important'));
  assert(css.includes('padding:18px 38px 28px!important'));
  assert(css.includes("font:700 clamp(23px,1.8vw,28px)/1.15 Georgia"));
  assert(css.includes('@media(max-width:1120px)'));
  assert(css.includes('grid-template-columns:1fr}.rpprofile--approved-cards .rpprofile__approved-button{white-space:nowrap!important}'));
  assert(css.includes('ui_panel_frame.png'));
  assert(css.includes('.rpprofile__approved-visual--empty'));
  assert(css.includes('.rpprofile__approved-actions'));
  assert(css.includes('white-space:normal!important'));
  assert(css.includes('overflow-wrap:anywhere'));
  assert(css.includes('@media(max-width:760px)'));
  assert(css.includes('@media(max-width:480px)'));

  assert(source.includes("newChronicle: 'Новая хроника'"));
  assert(source.includes("'Продолжить'"));
  assert(source.includes("'Создать'"));
  assert(source.includes("'Переименовать'"));
  assert(source.includes("'Начать заново'"));
  assert(source.includes("'Удалить'"));
  assert(source.includes('humanChronicleStatus(originalStatus?.textContent, language)'));
  assert(source.includes('card.replaceChildren(visual, content, approvedActions)'));
  assert(source.includes('commanderPortrait(card)'));
  assert(source.includes("generated_assets/logo_main.png"));
  assert(source.includes('MutationObserver'));
  assert(source.includes("if (heading && heading.textContent !== titleCopy)"));

  const module = await import(pathToFileURL(path.join(root, 'game/js/chronicle-profile-cards.mjs')).href);
  assert.strictEqual(module.romanChronicleNumber(0), 'I');
  assert.strictEqual(module.romanChronicleNumber(1), 'II');
  assert.strictEqual(module.romanChronicleNumber(2), 'III');
  assert.strictEqual(module.compactLabel('ru', 'subtitle'), 'Три независимые истории. Продолжите существующий поход или начните новый.');
  assert.strictEqual(module.compactLabel('ru', 'newChronicle'), 'Новая хроника');
  assert.strictEqual(module.compactLabel('en', 'create'), 'Create');
  assert.strictEqual(module.humanChronicleStatus('Акт 1 · draft', 'ru'), 'Акт 1 · Формирование отряда');
  assert.strictEqual(module.humanChronicleStatus('Act 2 · battle', 'en'), 'Act 2 · Battle');
  assert.strictEqual(module.humanChronicleStatus('', 'ru'), 'Поход сохранён');

  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, value)
  };
  assert.deepStrictEqual(module.readChronicleNames(storage), {});
  assert.strictEqual(module.writeChronicleNames({ 'profile-1': 'Стальная клятва' }, storage), true);
  assert.deepStrictEqual(module.readChronicleNames(storage), { 'profile-1': 'Стальная клятва' });

  console.log('Chronicle profile cards: compact approved composition and persistence passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
