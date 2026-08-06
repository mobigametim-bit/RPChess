const assert = require('assert');
const path = require('path');
const {
  mergeLocalization,
  buildProductionContentBundle,
  productionContentReport
} = require('../src/content/production-bundle.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const projectRoot = path.resolve(__dirname, '..');

function bundle() {
  return buildProductionContentBundle({ projectRoot });
}

test('canonical production bundle validates board themes, cross references and RU/EN localization', () => {
  const compiled = bundle();
  assert.strictEqual(compiled.format, 'rpchess-production-content-bundle');
  assert.deepStrictEqual(compiled.summary, {
    region: 1,
    king: 1,
    doctrine: 1,
    hero: 6,
    relic: 6,
    event: 12,
    encounter: 6,
    boss: 1
  });
  assert.strictEqual(compiled.packs[0].packId, 'iron_marches_vertical_slice_production_events');
  assert.strictEqual(compiled.productionEvents.events.length, 7);
  assert.strictEqual(compiled.boardThemeManifest.themes.some((theme) => theme.id === 'iron_marches'), true);
  assert.strictEqual(compiled.localization.ru['boss.iron_regent.name'], 'Железный Регент');
  assert.strictEqual(compiled.localization.en['boss.iron_regent.name'], 'The Iron Regent');
  assert.strictEqual(Object.keys(compiled.combatProfiles.heroes).length, 6);
});

test('vertical slice uses the exact registered king, doctrine, heroes and boss paths', () => {
  const compiled = bundle();
  const king = compiled.registry.get('king', 'king.oathkeeper');
  const doctrine = compiled.registry.get('doctrine', 'doctrine.fortress');
  const boss = compiled.registry.get('boss', 'boss.iron_regent');
  assert.ok(king);
  assert.deepStrictEqual(king.doctrineIds, ['doctrine.fortress']);
  assert.strictEqual(king.assets.commandIcon, 'assets/kings/oathkeeper/command_icon.png');
  assert.strictEqual(doctrine.assets.nodes.length, 5);
  assert.strictEqual(compiled.registry.list('hero').every((hero) => hero.regionId === 'region.iron_marches'), true);
  assert.strictEqual(compiled.registry.get('hero', 'hero.aldric_wall').pieceType, 'rook');
  assert.strictEqual(boss.assets.arena, 'assets/bosses/iron_regent/arena.jpg');
  assert.strictEqual(boss.phases.length, 2);
});

test('combat profiles bind authored relics and declare Tomas Gate rook override explicitly', () => {
  const compiled = bundle();
  const profiles = compiled.combatProfiles;
  assert.strictEqual(profiles.regionId, 'region.iron_marches');
  assert.deepStrictEqual(profiles.heroes['hero.aldric_wall'].relicIds, ['relic.echo_shield']);
  assert.strictEqual(profiles.heroes['hero.tomas_gate'].contentPieceType, 'king');
  assert.strictEqual(profiles.heroes['hero.tomas_gate'].battlePieceType, 'rook');
  assert.strictEqual(profiles.heroes['hero.tomas_gate'].overrideReason, 'escort_scenario_uses_rook_profile');
  assert.deepStrictEqual(profiles.heroes['hero.tomas_gate'].relicIds, ['relic.twin_command']);
});

test('all twelve registered Iron Marches events expose localized authored choices', () => {
  const compiled = bundle();
  const events = compiled.registry.list('event');
  assert.strictEqual(events.length, 12);
  for (const event of events) {
    assert.strictEqual(event.scope, 'iron_marches');
    assert.ok(event.choices.length >= 2 && event.choices.length <= 4);
    assert.ok(event.sceneArt.startsWith('assets/'));
    for (const choice of event.choices) {
      assert.ok(compiled.localization.ru[choice.textKey].length >= 12);
      assert.ok(compiled.localization.en[choice.textKey].length >= 10);
      assert.ok(choice.effectIds.length >= 1);
    }
  }
  assert.deepStrictEqual(
    ['event.empty_armory', 'event.cracked_bell', 'event.duel_masons'].map((id) => compiled.registry.get('event', id).choices.length),
    [2, 2, 2]
  );
  assert.strictEqual(compiled.registry.get('event', 'event.miners_on_strike').choices.length, 4);
});

test('encounters reference modular Iron Marches cells and never a whole board, frame or underlay', () => {
  const compiled = bundle();
  const theme = compiled.boardThemeManifest.themes.find((entry) => entry.id === 'iron_marches');
  assert.strictEqual(theme.light, 'assets/regions/iron_marches/tile_light.png');
  assert.strictEqual(theme.dark, 'assets/regions/iron_marches/tile_dark.png');
  for (const encounter of compiled.registry.list('encounter')) {
    assert.strictEqual(encounter.board.themeId, 'iron_marches');
    assert.strictEqual(encounter.board.width, 8);
    assert.strictEqual(encounter.board.height, 8);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(encounter.board, 'boardImage'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(encounter.board, 'frame'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(encounter.board, 'underlay'), false);
  }
  assert.strictEqual(compiled.assetPaths.some((asset) => /board(_skin|_frame)|underlay|complete_board/.test(asset)), false);
});

test('production report marks the seven authored events approved', () => {
  const report = productionContentReport(bundle());
  assert.strictEqual(report.ok, true);
  assert.strictEqual(report.statuses.draft, 27);
  assert.strictEqual(report.statuses.review, 0);
  assert.strictEqual(report.statuses.approved, 7);
  assert.ok(report.assetCount >= 50);
  assert.strictEqual(report.combatProfileCount, 6);
  assert.strictEqual(report.productionEventCount, 7);
  assert.strictEqual(report.languageCounts.ru, report.languageCounts.en);
});

test('localization merger rejects duplicate keys instead of silently overriding text', () => {
  assert.throws(() => mergeLocalization(projectRoot, {
    ru: ['content/localization/ru/iron_marches_vertical_slice.json', 'content/localization/ru/iron_marches_vertical_slice.json'],
    en: ['content/localization/en/iron_marches_vertical_slice.json']
  }), /duplicate ru localization key/);
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
  }
}
console.log(`\nProduction content bundle: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;