const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { auditIronMarchesMechanics } = require('../scripts/audit-iron-marches-mechanics.cjs');

(async () => {
  const summary = auditIronMarchesMechanics();
  assert.strictEqual(summary.abilityCount, 6);
  assert.strictEqual(summary.relicEffectCount, 6);
  assert.strictEqual(summary.totalCount, 12);
  assert.strictEqual(summary.counts.PARTIAL, 1);
  assert.strictEqual(summary.counts.DECLARATIVE, 11);
  assert.strictEqual(summary.counts.IMPLEMENTED, 0);
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
  assert.strictEqual(readiness.relicMechanicReadiness('relic.echo_shield').status, 'PARTIAL');
  assert.strictEqual(readiness.readinessLabel('DECLARATIVE'), 'Пока недоступно');
  assert.strictEqual(readiness.heroMechanicsSummary('hero.aldric_wall', ['relic.echo_shield']).relics[0].status, 'PARTIAL');

  const presenter = await import(pathToFileURL(path.resolve(__dirname, '../game/js/vertical-slice-presenter-register-02.mjs')).href);
  const markup = presenter.heroMechanicsMarkup({
    heroId: 'hero.aldric_wall',
    relicIds: ['relic.echo_shield']
  });
  assert.ok(markup.includes('Перехват'));
  assert.ok(markup.includes('Пока недоступно'));
  assert.ok(markup.includes('Эхо-щит'));
  assert.ok(markup.includes('Частично подключено'));
  assert.ok(markup.includes('aria-disabled="true"'));

  const armyMarkup = presenter.armyPanelMarkup({
    status: 'campaign',
    army: {
      kingId: 'king.oathkeeper',
      kingName: 'Хранитель Клятвы',
      doctrineId: 'doctrine.fortress',
      doctrineName: 'Крепость',
      heroCount: 1,
      relicCount: 1,
      heroes: [{
        heroId: 'hero.aldric_wall',
        name: 'Альдрик Стена',
        relicIds: ['relic.echo_shield']
      }]
    }
  });
  assert.ok(armyMarkup.includes('Пока недоступно'));
  assert.ok(armyMarkup.includes('1 реликв.'));

  console.log('Iron Marches mechanics readiness: 1/1 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
