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

  test('hero panel binds runtime stars, relics and statuses to imported art', () => {
    const markup = codex.heroPanelMarkup({
      heroId: 'hero.aldric_wall',
      type: 'r',
      square: 'a1',
      stars: 3,
      relicIds: ['relic.echo_shield'],
      status: { warded: true }
    });
    assert.ok(markup.includes('assets/heroes/aldric_wall/portrait.png'));
    assert.ok(markup.includes('assets/heroes/aldric_wall/piece_badge.png'));
    assert.ok(markup.includes('assets/heroes/aldric_wall/ability_icon.png'));
    assert.ok(markup.includes('★★★'));
    assert.ok(markup.includes('Эхо-щит'));
    assert.ok(markup.includes('warded'));
    assert.ok(markup.includes('На поле: a1'));
  });

  test('codex renders separate hero and political catalogs with faction filtering', () => {
    const heroes = codex.codexMarkup('heroes', 'iron_marches');
    const politics = codex.codexMarkup('politics', 'iron_marches');
    assert.ok(heroes.includes('Герои · 36'));
    assert.ok(heroes.includes('Альдрик Стена'));
    assert.strictEqual(heroes.includes('Серафима Лира'), false);
    assert.ok(politics.includes('Политика · 18'));
    assert.ok(politics.includes('Маршал Варн'));
    assert.strictEqual(politics.includes('Понтифик Элия'), false);
  });

  test('runtime extension selects actual hero records for field, reserve and deployment panels', () => {
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

  test('browser entry loads the non-invasive Register 02 enhancer after the production app', () => {
    const html = fs.readFileSync(path.join(root, 'game/vertical-slice.html'), 'utf8');
    const enhancer = fs.readFileSync(path.join(root, 'game/js/register-02-runtime-enhancer.mjs'), 'utf8');
    assert.ok(html.indexOf('js/vertical-slice-app.mjs') < html.indexOf('js/register-02-runtime-enhancer.mjs'));
    assert.ok(enhancer.includes('Object.setPrototypeOf'));
    assert.ok(enhancer.includes('VerticalSlicePresenter.prototype'));
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
