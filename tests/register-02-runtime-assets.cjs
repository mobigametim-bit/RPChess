const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

(async () => {
  const assets = await import(pathToFileURL(path.resolve(__dirname, '../game/js/register-02-assets.mjs')).href);
  const presenter = await import(pathToFileURL(path.resolve(__dirname, '../game/js/run-selection-presenter.mjs')).href);

  test('Register 02 browser catalog contains exactly 126 unique canonical paths', () => {
    const paths = assets.allRegister02Paths();
    assert.strictEqual(paths.length, 126);
    assert.strictEqual(new Set(paths).size, 126);
    assert.ok(paths.every((value) => value.startsWith('assets/')));
  });

  test('all 36 hero art families resolve portrait, badge and ability icon', () => {
    assert.strictEqual(assets.HERO_SLUGS.length, 36);
    assert.strictEqual(Object.keys(assets.HERO_ASSETS).length, 36);
    const aldric = assets.heroAssets('hero.aldric_wall');
    assert.deepStrictEqual(
      [aldric.portrait, aldric.pieceBadge, aldric.abilityIcon],
      [
        'assets/heroes/aldric_wall/portrait.png',
        'assets/heroes/aldric_wall/piece_badge.png',
        'assets/heroes/aldric_wall/ability_icon.png'
      ]
    );
    assert.ok(Object.values(assets.HERO_ASSETS).every((entry) => entry.status === 'REVIEW'));
  });

  test('all 18 political portraits resolve without invented political mechanics', () => {
    assert.strictEqual(assets.POLITICAL_FILENAMES.length, 18);
    assert.strictEqual(Object.keys(assets.POLITICAL_ASSETS).length, 18);
    assert.strictEqual(
      assets.politicalAssets('politics.empress_nahla_p').portrait,
      'assets/politics/empress_nahla_p.png'
    );
    assert.ok(Object.values(assets.POLITICAL_ASSETS).every((entry) => entry.status === 'REVIEW'));
  });

  test('production Iron Marches hero records use the canonical Register 02 paths', () => {
    const pack = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../content/packs/iron_marches_vertical_slice.json'), 'utf8'));
    assert.strictEqual(pack.content.heroes.length, 6);
    for (const hero of pack.content.heroes) {
      const expected = assets.heroAssets(hero.id);
      assert.ok(expected, hero.id);
      assert.strictEqual(hero.assets.portrait, expected.portrait);
      assert.strictEqual(hero.assets.pieceBadge, expected.pieceBadge);
      assert.strictEqual(hero.assets.abilityIcon, expected.abilityIcon);
    }
  });

  test('hero selection cards display portrait, piece badge and ability icon', () => {
    const html = presenter.heroCard({
      id: 'hero.aldric_wall',
      label: 'Альдрик Стена',
      pieceType: 'rook',
      selected: false,
      assets: { portrait: 'assets/heroes/aldric_wall/portrait.png' }
    });
    assert.ok(html.includes('assets/heroes/aldric_wall/portrait.png'));
    assert.ok(html.includes('assets/heroes/aldric_wall/piece_badge.png'));
    assert.ok(html.includes('assets/heroes/aldric_wall/ability_icon.png'));
    assert.ok(html.includes('rprs__hero-icons'));
  });

  let failures = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(error.stack || error);
    }
  }
  console.log(`\nRegister 02 runtime assets: ${tests.length - failures}/${tests.length} passed.`);
  if (failures) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
