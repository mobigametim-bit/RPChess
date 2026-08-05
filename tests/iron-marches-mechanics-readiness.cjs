const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { auditIronMarchesMechanics } = require('../scripts/audit-iron-marches-mechanics.cjs');

(async () => {
  const summary = auditIronMarchesMechanics();
  assert.strictEqual(summary.abilityCount, 6);
  assert.strictEqual(summary.relicEffectCount, 6);
  assert.strictEqual(summary.totalCount, 12);
  assert.strictEqual(summary.counts.PARTIAL, 1);
  assert.strictEqual(summary.counts.DECLARATIVE, 9);
  assert.strictEqual(summary.counts.IMPLEMENTED, 2);
  assert.strictEqual(summary.counts.BLOCKED_BY_DESIGN, 0);

  const readiness = await import(pathToFileURL(path.resolve(__dirname, '../game/js/iron-marches-mechanics-readiness.mjs')).href);
  assert.deepStrictEqual(Object.keys(readiness.HERO_MECHANICS).sort(), [
    'hero.aldric_wall',
    'hero.brother_orell',
    'hero.lady_sorn',
    'hero.mara_chain',
    'hero.tomas_gate',
    'hero.vael_hammer'
  ]);
  assert.strictEqual(readiness.heroMechanicReadiness('hero.aldric_wall').status, 'DECLARATIVE');
  assert.strictEqual(readiness.relicMechanicReadiness('relic.echo_shield').status, 'IMPLEMENTED');
  assert.strictEqual(readiness.relicMechanicReadiness('relic.circle_warding').status, 'IMPLEMENTED');
  assert.strictEqual(readiness.relicMechanicReadiness('relic.twin_command').status, 'PARTIAL');
  assert.strictEqual(readiness.readinessLabel('DECLARATIVE'), 'Пока недоступно');
  assert.strictEqual(readiness.heroMechanicsSummary('hero.aldric_wall', ['relic.echo_shield']).relics[0].status, 'IMPLEMENTED');

  const enhancer = await import(pathToFileURL(path.resolve(__dirname, '../game/js/iron-marches-mechanics-readiness-enhancer.mjs')).href);
  const markup = enhancer.heroReadinessMarkup('hero.aldric_wall');
  assert.ok(markup.includes('Перехват'));
  assert.ok(markup.includes('Пока недоступно'));
  assert.ok(markup.includes('Защита от первого взятия'));
  assert.ok(markup.includes('Работает'));
  assert.ok(markup.includes('aria-disabled="true"'));
  assert.strictEqual(enhancer.heroIdFromImageSource('assets/heroes/aldric_wall/portrait.png'), 'hero.aldric_wall');
  assert.strictEqual(enhancer.heroIdFromImageSource('assets/politics/marshal_varn.png'), null);
  assert.ok(enhancer.compactReadinessMarkup('hero.tomas_gate').includes('Способность: Пока недоступно'));

  const html = fs.readFileSync(path.resolve(__dirname, '../game/vertical-slice.html'), 'utf8');
  assert.ok(html.indexOf('register-02-runtime-enhancer.mjs') < html.indexOf('iron-marches-mechanics-readiness-enhancer.mjs'));
  assert.ok(html.includes('iron-marches-mechanics-readiness-enhancer.mjs'));

  console.log('Iron Marches mechanics readiness: 1/1 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
