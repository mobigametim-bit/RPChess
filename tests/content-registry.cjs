const assert = require('assert');
const {
  ContentRegistry,
  normalizePackCollections,
  canonicalAssetPath
} = require('../src/content/index.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const boardThemeManifest = {
  schemaVersion: 1,
  themes: [{
    id: 'neutral',
    light: 'assets/boards/neutral/tile_light.png',
    dark: 'assets/boards/neutral/tile_dark.png'
  }]
};

function samplePack() {
  return {
    schemaVersion: 1,
    packId: 'vertical_slice',
    content: {
      regions: [{
        id: 'region.iron_marches', nameKey: 'region.iron_marches.name', factionId: 'faction.iron_marches', boardThemeId: 'neutral'
      }],
      doctrines: [{
        id: 'doctrine.fortress', nameKey: 'doctrine.fortress.name',
        assets: {
          emblem: 'assets/doctrines/fortress/emblem.png',
          nodes: [1, 2, 3, 4, 5].map((n) => `assets/doctrines/fortress/node_0${n}.png`)
        }
      }],
      kings: [{
        id: 'king.oathkeeper', nameKey: 'king.oathkeeper.name', doctrineIds: ['doctrine.fortress'],
        assets: {
          portrait: 'assets/kings/oathkeeper/portrait.png',
          piece: 'assets/kings/oathkeeper/piece.png',
          commandIcon: 'assets/kings/oathkeeper/command_icon.png',
          passiveIcon: 'assets/kings/oathkeeper/passive_icon.png'
        }
      }],
      heroes: [{
        id: 'hero.aldric_wall', nameKey: 'hero.aldric_wall.name', regionId: 'region.iron_marches', pieceType: 'rook', abilityId: 'ability.interpose',
        assets: {
          portrait: 'assets/heroes/aldric_wall/portrait.png',
          pieceBadge: 'assets/heroes/aldric_wall/piece_badge.png',
          abilityIcon: 'assets/heroes/aldric_wall/ability_icon.png'
        }
      }],
      relics: [{
        id: 'relic.echo_shield', nameKey: 'relic.echo_shield.name', compatibility: ['rook', 'king'], effectId: 'effect.ward_first_capture',
        icon: 'assets/relics/echo_shield.png'
      }],
      events: [{
        id: 'event.silent_foundry', nameKey: 'event.silent_foundry.name', titleKey: 'event.silent_foundry.title', bodyKey: 'event.silent_foundry.body', scope: 'iron_marches',
        sceneArt: 'assets/regions/iron_marches/event_foundry.jpg',
        choices: [
          { id: 'workers', textKey: 'event.silent_foundry.choice.workers', effectIds: ['effect.reputation_workers'] },
          { id: 'crown', textKey: 'event.silent_foundry.choice.crown', effectIds: ['effect.reputation_crown'] },
          { id: 'mediate', textKey: 'event.silent_foundry.choice.mediate', effectIds: ['effect.supplies_trade'] }
        ]
      }],
      encounters: [{
        id: 'encounter.iron_crossfire', nameKey: 'encounter.iron_crossfire.name', regionId: 'region.iron_marches',
        board: { themeId: 'neutral', width: 8, height: 8 },
        objectiveKeys: ['encounter.iron_crossfire.objective']
      }],
      bosses: [{
        id: 'boss.iron_regent', nameKey: 'boss.iron_regent.name', regionId: 'region.iron_marches',
        phases: [
          { id: 'seals', titleKey: 'boss.iron_regent.phase.seals', objectiveKey: 'boss.iron_regent.objective.seals' },
          { id: 'mate', titleKey: 'boss.iron_regent.phase.mate', objectiveKey: 'boss.iron_regent.objective.mate' }
        ],
        assets: {
          portrait: 'assets/bosses/iron_regent/portrait.png',
          piece: 'assets/bosses/iron_regent/piece.png',
          arena: 'assets/bosses/iron_regent/arena.jpg',
          phaseTransition: 'assets/bosses/iron_regent/phase_transition.png',
          phaseSigils: ['assets/bosses/iron_regent/phase_01.png', 'assets/bosses/iron_regent/phase_02.png']
        }
      }]
    }
  };
}

function completeLocalization() {
  const dictionary = new Proxy({}, { get: (_target, key) => typeof key === 'string' ? key : undefined });
  return { ru: dictionary, en: dictionary };
}

test('canonical collection names normalize heroes and bosses for the internal registry', () => {
  const pack = normalizePackCollections(samplePack());
  assert.strictEqual(pack.content.heros.length, 1);
  assert.strictEqual(pack.content.bosss.length, 1);
  assert.strictEqual(pack.content.heroes.length, 1);
  assert.strictEqual(pack.content.bosses.length, 1);
});

test('complete vertical-slice pack validates references, localization and board theme', () => {
  const registry = new ContentRegistry({ boardThemeManifest });
  registry.addPack(samplePack()).finalize({ localization: completeLocalization() });
  assert.deepStrictEqual(registry.summary(), {
    region: 1, king: 1, doctrine: 1, hero: 1, relic: 1, event: 1, encounter: 1, boss: 1
  });
  assert.strictEqual(registry.get('hero', 'hero.aldric_wall').pieceType, 'rook');
  assert.strictEqual(registry.get('encounter', 'encounter.iron_crossfire').board.themeId, 'neutral');
  assert.strictEqual(registry.assetPaths().includes('assets/boards/neutral/tile_light.png'), false);
  assert.strictEqual(registry.assetPaths().includes('assets/heroes/aldric_wall/portrait.png'), true);
});

test('duplicate stable IDs are rejected across packs', () => {
  const registry = new ContentRegistry({ boardThemeManifest });
  registry.addPack(samplePack());
  const second = samplePack();
  second.packId = 'duplicate_pack';
  assert.throws(() => registry.addPack(second), /duplicate region id/);
});

test('missing cross-record references fail finalization with exact details', () => {
  const pack = samplePack();
  pack.content.heroes[0].regionId = 'region.missing';
  const registry = new ContentRegistry({ boardThemeManifest }).addPack(pack);
  assert.throws(() => registry.finalize(), (error) => error.details.some((detail) => detail.includes('region.missing')));
});

test('encounter board shapes are validated against the modular board planner', () => {
  const pack = samplePack();
  pack.content.encounters[0].board = { themeId: 'neutral', width: 5, height: 5, activeCells: ['a5', 'e5', 'c3', 'a1', 'e1'] };
  const registry = new ContentRegistry({ boardThemeManifest }).addPack(pack).finalize();
  assert.strictEqual(registry.get('encounter', 'encounter.iron_crossfire').board.activeCells.length, 5);

  const invalid = samplePack();
  invalid.content.encounters[0].board.activeCells = ['z99'];
  assert.throws(() => new ContentRegistry({ boardThemeManifest }).addPack(invalid), /invalid square|outside board/);
});

test('events expose two to four authored choices and unique choice IDs', () => {
  const twoChoices = samplePack();
  twoChoices.content.events[0].choices = twoChoices.content.events[0].choices.slice(0, 2);
  const registry = new ContentRegistry({ boardThemeManifest }).addPack(twoChoices).finalize({ localization: completeLocalization() });
  assert.strictEqual(registry.get('event', 'event.silent_foundry').choices.length, 2);

  const tooShort = samplePack();
  tooShort.content.events[0].choices = tooShort.content.events[0].choices.slice(0, 1);
  assert.throws(() => new ContentRegistry({ boardThemeManifest }).addPack(tooShort), /3 or 4 choices/);

  const duplicateChoice = samplePack();
  duplicateChoice.content.events[0].choices[1].id = duplicateChoice.content.events[0].choices[0].id;
  assert.throws(() => new ContentRegistry({ boardThemeManifest }).addPack(duplicateChoice), /duplicate id/);
});

test('missing RU or EN localization is reported before release approval', () => {
  const registry = new ContentRegistry({ boardThemeManifest }).addPack(samplePack());
  assert.throws(() => registry.finalize({ localization: { ru: {}, en: {} } }), (error) =>
    error.details.some((detail) => detail === 'missing ru localization: region.iron_marches.name')
      && error.details.some((detail) => detail === 'missing en localization: region.iron_marches.name')
  );
});

test('asset paths reject traversal, uppercase and non-canonical filenames', () => {
  assert.throws(() => canonicalAssetPath('../secret.png'), /must stay relative/);
  assert.throws(() => canonicalAssetPath('assets/Hero.png'), /lowercase canonical/);
  const pack = samplePack();
  pack.content.heroes[0].assets.portrait = '../portrait.png';
  assert.throws(() => new ContentRegistry({ boardThemeManifest }).addPack(pack), /must stay relative/);
});

test('registry becomes immutable to new packs after successful finalization', () => {
  const registry = new ContentRegistry({ boardThemeManifest }).addPack(samplePack()).finalize();
  const second = samplePack(); second.packId = 'late_pack';
  assert.throws(() => registry.addPack(second), /already finalized/);
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
console.log(`\nContent registry foundation: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;