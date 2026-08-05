const assert = require('assert');
const path = require('path');
const { buildProductionContentBundle } = require('../src/content/production-bundle.cjs');
const {
  selectionCatalog,
  createRunSelection,
  selectRunKing,
  selectRunDoctrine,
  toggleRunHero,
  lockRunSelection,
  runSelectionSnapshot,
  restoreRunSelection,
  runSelectionPresenter
} = require('../src/runtime/run-selection.cjs');
const {
  createDefaultIronMarchesSelection,
  createIronMarchesRunSetup
} = require('../src/runtime/iron-marches-run-setup.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const projectRoot = path.resolve(__dirname, '..');
const bundle = buildProductionContentBundle({ projectRoot });

test('selection catalog exposes only Iron Marches heroes for the selected region', () => {
  const catalog = selectionCatalog(bundle.registry, 'region.iron_marches');
  assert.strictEqual(catalog.region.id, 'region.iron_marches');
  assert.strictEqual(catalog.kings.length, 1);
  assert.strictEqual(catalog.doctrines.length, 1);
  assert.strictEqual(catalog.heroes.length, 6);
  assert.ok(catalog.heroes.every((hero) => hero.id.startsWith('hero.')));
});

test('king, doctrine and heroes are selected through immutable deterministic revisions', () => {
  let state = createRunSelection({
    contentRegistry: bundle.registry,
    selectionId: 'selection_test',
    regionId: 'region.iron_marches',
    heroLimit: 3,
    minimumHeroes: 1
  });
  state = selectRunKing(state, 'king.oathkeeper', bundle.registry);
  state = selectRunDoctrine(state, 'doctrine.fortress', bundle.registry);
  state = toggleRunHero(state, 'hero.aldric_wall', bundle.registry);
  state = toggleRunHero(state, 'hero.mara_chain', bundle.registry);
  assert.strictEqual(state.revision, 4);
  assert.deepStrictEqual(state.heroIds, ['hero.aldric_wall', 'hero.mara_chain']);
  assert.deepStrictEqual(state.history.map((entry) => entry.type), ['SelectKing', 'SelectDoctrine', 'AddHero', 'AddHero']);
  const removed = toggleRunHero(state, 'hero.mara_chain', bundle.registry);
  assert.deepStrictEqual(removed.heroIds, ['hero.aldric_wall']);
  assert.deepStrictEqual(state.heroIds, ['hero.aldric_wall', 'hero.mara_chain']);
});

test('selection cannot exceed its roster limit or lock without required choices', () => {
  let state = createRunSelection({ contentRegistry: bundle.registry, regionId: 'region.iron_marches', heroLimit: 1 });
  assert.throws(() => lockRunSelection(state, bundle.registry), (error) => error.details.includes('king selection is required'));
  state = selectRunKing(state, 'king.oathkeeper', bundle.registry);
  state = selectRunDoctrine(state, 'doctrine.fortress', bundle.registry);
  state = toggleRunHero(state, 'hero.aldric_wall', bundle.registry);
  assert.throws(() => toggleRunHero(state, 'hero.mara_chain', bundle.registry), /exceed limit 1/);
  const locked = lockRunSelection(state, bundle.registry);
  assert.strictEqual(locked.status, 'locked');
  assert.throws(() => toggleRunHero(locked, 'hero.aldric_wall', bundle.registry), /already locked/);
});

test('selecting a new king clears an incompatible doctrine instead of preserving an invalid pair', () => {
  const records = {
    region: { 'region.test': { id: 'region.test', nameKey: 'region.test.name', boardThemeId: 'neutral', factionId: 'faction.test' } },
    king: {
      'king.one': { id: 'king.one', nameKey: 'king.one.name', doctrineIds: ['doctrine.alpha'], assets: {} },
      'king.two': { id: 'king.two', nameKey: 'king.two.name', doctrineIds: ['doctrine.beta'], assets: {} }
    },
    doctrine: {
      'doctrine.alpha': { id: 'doctrine.alpha', nameKey: 'doctrine.alpha.name', assets: {} },
      'doctrine.beta': { id: 'doctrine.beta', nameKey: 'doctrine.beta.name', assets: {} }
    },
    hero: { 'hero.test': { id: 'hero.test', nameKey: 'hero.test.name', regionId: 'region.test', pieceType: 'rook', abilityId: 'ability.test', assets: {} } }
  };
  const registry = {
    get: (kind, id) => records[kind]?.[id] || null,
    list: (kind) => Object.values(records[kind] || {})
  };
  let state = createRunSelection({ contentRegistry: registry, regionId: 'region.test' });
  state = selectRunKing(state, 'king.one', registry);
  state = selectRunDoctrine(state, 'doctrine.alpha', registry);
  state = selectRunKing(state, 'king.two', registry);
  assert.strictEqual(state.kingId, 'king.two');
  assert.strictEqual(state.doctrineId, null);
  assert.throws(() => selectRunDoctrine(state, 'doctrine.alpha', registry), (error) => error.details.includes('king.two does not permit doctrine.alpha'));
});

test('locked selection survives snapshot restore with all invariants and history', () => {
  const locked = lockRunSelection(createDefaultIronMarchesSelection(bundle), bundle.registry);
  const snapshot = runSelectionSnapshot(locked);
  const restored = restoreRunSelection(snapshot, bundle.registry);
  assert.deepStrictEqual(restored, locked);
  assert.strictEqual(restored.status, 'locked');
  assert.strictEqual(restored.heroIds.length, 6);
});

test('selection presenter localizes content and exposes compatibility without hidden gameplay mutation', () => {
  const selecting = createDefaultIronMarchesSelection(bundle, { heroIds: ['hero.aldric_wall'] });
  const presenter = runSelectionPresenter(selecting, bundle.registry, bundle.localization.ru);
  assert.strictEqual(presenter.format, 'rpchess-run-selection-presenter');
  assert.strictEqual(presenter.selectedKing.label, 'Хранитель Клятвы');
  assert.strictEqual(presenter.selectedDoctrine.label, 'Крепость');
  assert.strictEqual(presenter.heroes.filter((hero) => hero.selected).length, 1);
  assert.strictEqual(presenter.doctrines[0].compatible, true);
  assert.strictEqual(presenter.canLock, true);
});

test('locked setup is passed into deterministic Iron Marches bootstrap before runtime creation', () => {
  const first = createIronMarchesRunSetup({ projectRoot, seed: 12001, language: 'ru' });
  const second = createIronMarchesRunSetup({ projectRoot, seed: 12001, language: 'ru' });
  assert.strictEqual(first.selection.status, 'locked');
  assert.ok(first.verticalSlice);
  assert.deepStrictEqual(second.selection, first.selection);
  assert.deepStrictEqual(second.verticalSlice.state, first.verticalSlice.state);
  assert.deepStrictEqual(first.verticalSlice.selection.heroIds, first.selection.heroIds);

  const unlocked = createIronMarchesRunSetup({ projectRoot, seed: 12001, lock: false });
  assert.strictEqual(unlocked.selection.status, 'selecting');
  assert.strictEqual(unlocked.verticalSlice, null);
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
console.log(`\nRun selection: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
