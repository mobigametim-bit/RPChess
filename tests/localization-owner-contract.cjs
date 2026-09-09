const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const root = path.resolve(__dirname, '..');
  const game = path.join(root, 'game');
  const read = (relative) => fs.readFileSync(path.join(game, relative), 'utf8');
  const placeholders = (value) => [...String(value).matchAll(/\{[a-zA-Z0-9_]+\}/g)].map((match) => match[0]).sort();
  const cyrillic = /[А-Яа-яЁё]/u;

  const i18n = read('js/i18n.mjs');
  for (const forbidden of ['MutationObserver', 'localizeLegacyDocument', 'createTreeWalker', 'textSources', 'attributeSources', 'applyingLegacyLocalization']) {
    assert(!i18n.includes(forbidden), `i18n runtime must not restore whole-document legacy localization machinery: ${forbidden}`);
  }
  assert(/export function refreshLocalization\(root = globalThis\.document\) \{ localizeDocument\(root\); \}/.test(i18n), 'language refresh must be limited to semantic data-i18n DOM');
  assert(i18n.includes('export function translateLegacy'), 'explicit authored/content translation helper must remain available');

  const registries = [
    ['classic-ui.mjs', 'CLASSIC_UI_MESSAGES'],
    ['runtime-ui.mjs', 'RUNTIME_UI_MESSAGES']
  ];
  for (const [file, exportName] of registries) {
    const module = await import(`${pathToFileURL(path.join(game, 'localization', file)).href}?owner-contract=1`);
    const messages = module[exportName];
    assert(messages?.ru && messages?.en, `${file} must expose RU and EN registries`);
    const ruKeys = Object.keys(messages.ru).sort();
    const enKeys = Object.keys(messages.en).sort();
    assert.deepStrictEqual(enKeys, ruKeys, `${file} RU/EN keys must match exactly`);
    assert(ruKeys.length > 0, `${file} must contain owner messages`);
    for (const key of ruKeys) {
      assert(String(messages.ru[key]).trim(), `${file} ru.${key} must not be empty`);
      assert(String(messages.en[key]).trim(), `${file} en.${key} must not be empty`);
      assert.deepStrictEqual(placeholders(messages.en[key]), placeholders(messages.ru[key]), `${file} ${key} must preserve placeholders`);
      assert.strictEqual(cyrillic.test(String(messages.en[key])), false, `${file} en.${key} must not leak Cyrillic`);
    }
  }

  const classic = read('js/classic-chess-app.mjs');
  assert(classic.includes("from '../localization/classic-ui.mjs'") && classic.includes('classicT(currentLanguage()'), 'Classic must render through its semantic owner registry');
  assert(classic.includes('subscribe(() => { renderStaticCopy(); render(); });'), 'Classic must rerender dynamic UI on language change');
  for (const literal of ['Локальная партия · два игрока', 'Ходов пока нет', 'Компьютер думает…']) assert(!classic.includes(literal), `Classic must not restore dynamic RU literal: ${literal}`);

  const endless = read('js/endless-run-app.mjs');
  assert(endless.includes("from '../localization/runtime-ui.mjs'") && endless.includes('runtimeT(currentLanguage()'), 'Endless must render through runtime owner messages');
  assert(endless.includes('translateLegacy(summary.kingName)') && endless.includes('translateLegacy(summary.endReasonLabel)'), 'Endless authored summary content must translate explicitly');
  assert(endless.includes('subscribe(() =>'), 'Endless must rerender on language change');

  const power = read('js/player-rating-runtime.mjs');
  assert(power.includes('runtimeT(currentLanguage()') && power.includes("t('power.label')") && power.includes("t('power.threat'"), 'Power result labels must be owner-localized at render time');
  assert(power.includes('subscribe(() => queueMicrotask(() => renderPowerResults()))'), 'Power result must repaint on language change');

  const ux = read('js/ux-consistency.mjs');
  assert(ux.includes('runtimeT(currentLanguage()') && ux.includes('syncResourceAria()'), 'shared resource/board UX must localize generated aria at render time');
  assert(ux.includes("'rpchess:language-changed'") && ux.includes("t('ux.board.ranks')") && ux.includes("t('ux.board.files')"), 'shared UX must refresh generated board labels on language change');

  const redesign = read('js/ui-redesign-final.mjs');
  assert(redesign.includes('translateLegacy(piece.name)') && redesign.includes('subscribe(()=>queueMicrotask(schedule))'), 'shared formation titles must translate explicitly and refresh on language change');

  console.log('Owner-localized runtime / no whole-document localization observer contract: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});