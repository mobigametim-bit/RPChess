const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const root = path.resolve(__dirname, '..');

(async () => {
  const codex = await import(pathToFileURL(path.join(root, 'game/js/register-02-codex.mjs')).href);
  const extension = await import(pathToFileURL(path.join(root, 'game/js/vertical-slice-presenter-register-02.mjs')).href);

  test('Register 02 codex exposes all visual identities without inventing routes', () => {
    assert.strictEqual(Object.keys(codex.HERO_PROFILES).length, 36);
    assert.strictEqual(Object.keys(codex.POLITICAL_PROFILES).length, 18);
    assert.strictEqual(Object.values(codex.HERO_PROFILES).filter((item) => item.factionId === 'iron_marches').length, 6);
    assert.strictEqual(Object.values(codex.POLITICAL_PROFILES).filter((item) => item.factionId === 'sky_khanate').length, 3);
    assert.strictEqual(codex.heroProfile('hero.tomas_gate').pieceType, 'king');
    assert.strictEqual(codex.politicalProfile('politics.empress_nahla_p').name, 'Императрица Нахла');
  });

  test('hero panel uses the approved portrait-stars-active-passive hierarchy', () => {
    const markup = codex.heroPanelMarkup({
      heroId: 'hero.aldric_wall',
      type: 'r',
      square: 'a1',
      stars: 3,
      relicIds: ['relic.echo_shield'],
      status: { id: 'ward', visible: true, sourceId: 'relic.echo_shield' }
    });
    assert.ok(markup.includes('assets/heroes/aldric_wall/portrait.png'));
    assert.ok(markup.includes('assets/heroes/aldric_wall/ability_icon.png'));
    assert.ok(markup.includes('assets/relics/echo_shield.png'));
    assert.ok(markup.includes('★★★'));
    assert.ok(markup.includes('Активная способность'));
    assert.ok(markup.includes('Перехват'));
    assert.ok(markup.includes('Пассивная реликвия'));
    assert.ok(markup.includes('Щит эха'));
    assert.ok(markup.includes('Защита от первого взятия'));
    assert.strictEqual(markup.includes('Состояние'), false);
    assert.strictEqual(markup.includes('На поле:'), false);
    assert.strictEqual(markup.includes('Звёзды'), false);
    assert.ok(markup.indexOf('Активная способность') < markup.indexOf('Пассивные эффекты'));
  });

  test('legacy codex data still renders separate hero and political catalogs with faction filtering', () => {
    const heroes = codex.codexMarkup('heroes', 'iron_marches');
    const politics = codex.codexMarkup('politics', 'iron_marches');
    assert.ok(heroes.includes('Герои · 36'));
    assert.ok(heroes.includes('Альдрик Стена'));
    assert.strictEqual(heroes.includes('Серафима Лира'), false);
    assert.ok(politics.includes('Политика · 18'));
    assert.ok(politics.includes('Маршал Варн'));
    assert.strictEqual(politics.includes('Понтифик Элия'), false);
  });

  test('runtime extension helpers still select actual hero records for gameplay projections', () => {
    const scenarioSnapshot = {
      playerSide: 'w',
      scenario: {
        pieces: [{ heroId: 'hero.aldric_wall', side: 'w', square: 'a1' }],
        reserve: [{ heroId: 'hero.mara_chain', side: 'w', entryId: 'reserve:mara' }]
      }
    };
    assert.strictEqual(extension.scenarioHeroRecord(scenarioSnapshot, 'a1', null).heroId, 'hero.aldric_wall');
    assert.strictEqual(extension.scenarioHeroRecord(scenarioSnapshot, null, 'reserve:mara').heroId, 'hero.mara_chain');
    const deploymentSnapshot = { deployment: { units: [{ id: 'aldric', metadata: { heroId: 'hero.aldric_wall' } }] } };
    assert.strictEqual(extension.deploymentHeroRecord(deploymentSnapshot, 'aldric').metadata.heroId, 'hero.aldric_wall');
    assert.strictEqual(extension.badgeSource({ heroId: 'hero.aldric_wall' }), 'assets/heroes/aldric_wall/piece_badge.png');
  });

  test('browser entries map Register 02 to the redesigned codex and retire prototype mutation enhancer', () => {
    for (const relative of ['game/index.html', 'game/vertical-slice.html']) {
      const html = fs.readFileSync(path.join(root, relative), 'utf8');
      assert.ok(html.includes('register-02-codex-v2.mjs'));
      assert.strictEqual(html.includes('js/register-02-runtime-enhancer.mjs'), false);
    }
    const redesigned = fs.readFileSync(path.join(root, 'game/js/register-02-codex-v2.mjs'), 'utf8');
    assert.ok(redesigned.includes('rpu-codex__layout'));
    assert.ok(redesigned.includes('rpu-person-detail'));
    assert.ok(redesigned.includes('politicalAssets(profile.id)'));
    assert.strictEqual(redesigned.includes('MutationObserver'), false);
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
  console.log(`\nRegister 02 presenter extension: ${tests.length - failures}/${tests.length} passed.`);
  if (failures) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
