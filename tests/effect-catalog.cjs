const assert = require('assert');
const path = require('path');
const { buildProductionContentBundle, productionContentReport } = require('../src/content/production-bundle.cjs');
const {
  validateEffectCatalog,
  mergeEffectCatalogs,
  validateEventEffectReferences,
  createCatalogEventChoiceResolver
} = require('../src/content/effect-catalog.cjs');
const { createAuthoredEventState } = require('../src/runtime/authored-event.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const projectRoot = path.resolve(__dirname, '..');
const bundle = () => buildProductionContentBundle({ projectRoot });

test('production bundle validates every authored event effect against the closed catalog', () => {
  const compiled = bundle();
  assert.strictEqual(validateEventEffectReferences(compiled.registry, compiled.eventEffectCatalog), true);
  const report = productionContentReport(compiled);
  assert.strictEqual(report.effectCatalogs, 1);
  assert.ok(report.eventEffectCount >= 40);
  assert.strictEqual(typeof compiled.eventChoiceResolver, 'function');
});

test('catalog resolver deterministically aggregates immediate costs, flags and Chronicle hooks', () => {
  const compiled = bundle();
  const content = compiled.registry.get('event', 'event.silent_foundry');
  const event = createAuthoredEventState(content, { nodeId: 'foundry' });
  const workers = compiled.eventChoiceResolver({ event, choice: event.choices.find((choice) => choice.id === 'workers') });
  assert.deepStrictEqual(workers.resourceDelta, { gold: 0, supplies: -1, meta: 0 });
  assert.ok(workers.addFlags.includes('reputation.iron_marches.workers_supported'));
  assert.ok(workers.chronicleKeys.includes('chronicle.silent_foundry.workers'));

  const mediate = compiled.eventChoiceResolver({ event, choice: event.choices.find((choice) => choice.id === 'mediate') });
  assert.deepStrictEqual(mediate.resourceDelta, { gold: -1, supplies: 2, meta: 0 });
  assert.ok(mediate.addFlags.includes('story.foundry_mediated'));
  assert.ok(mediate.chronicleKeys.includes('chronicle.silent_foundry.mediated'));
});

test('unknown effect references fail build with the exact event and choice location', () => {
  const compiled = bundle();
  const effects = { ...compiled.eventEffectCatalog.effects };
  delete effects['effect.supplies_trade'];
  const incomplete = { schemaVersion: 1, catalogId: 'incomplete', effects };
  assert.throws(() => validateEventEffectReferences(compiled.registry, incomplete), (error) =>
    error.details.some((detail) => detail === 'event.silent_foundry.mediate: effect.supplies_trade')
  );
});

test('effect definitions reject unsupported resources and empty behavior', () => {
  assert.throws(() => validateEffectCatalog({
    schemaVersion: 1,
    catalogId: 'bad_resource',
    effects: { 'effect.bad': { resourceDelta: { health: 1 } } }
  }), /unsupported key health/);
  assert.throws(() => validateEffectCatalog({
    schemaVersion: 1,
    catalogId: 'empty_behavior',
    effects: { 'effect.empty': {} }
  }), /no declared behavior/);
});

test('catalog merging rejects duplicate effect ownership', () => {
  const first = { schemaVersion: 1, catalogId: 'first', effects: { 'effect.one': { addFlags: ['flag.one'] } } };
  const second = { schemaVersion: 1, catalogId: 'second', effects: { 'effect.one': { addFlags: ['flag.two'] } } };
  assert.throws(() => mergeEffectCatalogs([first, second]), /duplicate effect definition/);
});

test('resolver rejects undeclared effects at execution as a second safety boundary', () => {
  const catalog = validateEffectCatalog({ schemaVersion: 1, catalogId: 'single', effects: { 'effect.one': { addFlags: ['flag.one'] } } });
  const resolver = createCatalogEventChoiceResolver(catalog);
  assert.throws(() => resolver({
    event: { eventId: 'event.test' },
    choice: { id: 'bad', effectIds: ['effect.missing'] }
  }), /unknown event effect/);
});

let failures = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL ${name}`); console.error(error.stack || error); }
}
console.log(`\nEffect catalog: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
