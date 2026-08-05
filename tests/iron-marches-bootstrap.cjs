const assert = require('assert');
const path = require('path');
const {
  DEFAULT_SELECTION,
  boardThemeMap,
  productionContentPools,
  assertVerticalSliceSelection,
  createIronMarchesVerticalSlice,
  createIronMarchesRuntimeHost
} = require('../src/runtime/iron-marches-bootstrap.cjs');
const { createPresenterSnapshot } = require('../src/runtime/presenter-bridge.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const projectRoot = path.resolve(__dirname, '..');

test('production bootstrap compiles one deterministic Iron Marches act without test fixtures', () => {
  const first = createIronMarchesVerticalSlice({ projectRoot, seed: 9042, language: 'ru' });
  const second = createIronMarchesVerticalSlice({ projectRoot, seed: 9042, language: 'ru' });
  assert.strictEqual(first.format, 'rpchess-iron-marches-vertical-slice');
  assert.deepStrictEqual(second.state, first.state);
  assert.deepStrictEqual(second.snapshot, first.snapshot);
  assert.strictEqual(first.state.campaign.graph.regionId, 'region.iron_marches');
  assert.strictEqual(first.state.campaign.graph.nodes.length, 9);
  assert.strictEqual(first.snapshot.status, 'campaign');
});

test('bootstrap selection resolves the registered king, doctrine, heroes and relics', () => {
  const boot = createIronMarchesVerticalSlice({ projectRoot, seed: 9043 });
  assert.strictEqual(assertVerticalSliceSelection(boot.bundle, DEFAULT_SELECTION), true);
  assert.strictEqual(boot.selection.kingId, 'king.oathkeeper');
  assert.strictEqual(boot.selection.doctrineId, 'doctrine.fortress');
  assert.strictEqual(boot.selection.heroIds.length, 6);
  assert.strictEqual(boot.selection.relicIds.length, 6);
  assert.throws(
    () => assertVerticalSliceSelection(boot.bundle, { ...DEFAULT_SELECTION, kingId: 'king.missing' }),
    (error) => Array.isArray(error.details) && error.details.includes('missing selected king: king.missing')
  );
});

test('content pools and board themes are built only from compiled production data', () => {
  const boot = createIronMarchesVerticalSlice({ projectRoot, seed: 9044 });
  const pools = productionContentPools(boot.bundle);
  assert.strictEqual(pools.encounters.length, 6);
  assert.strictEqual(pools.events.length, 12);
  assert.deepStrictEqual(pools.bosses, ['boss.iron_regent']);
  const themes = boardThemeMap(boot.bundle.boardThemeManifest);
  assert.strictEqual(themes.iron_marches.light, 'assets/regions/iron_marches/tile_light.png');
  assert.strictEqual(themes.iron_marches.dark, 'assets/regions/iron_marches/tile_dark.png');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(themes.iron_marches, 'frame'), false);
});

test('production node resolver creates authored events, encounter scenarios and the multi-phase boss', () => {
  const boot = createIronMarchesVerticalSlice({ projectRoot, seed: 9045 });
  const runtime = boot.state;
  const eventContent = boot.bundle.registry.get('event', 'event.silent_foundry');
  const encounterContent = boot.bundle.registry.get('encounter', 'encounter.iron_crossfire_files');
  const bossContent = boot.bundle.registry.get('boss', 'boss.iron_regent');
  const event = boot.dependencies.nodeResolver({ runtime, node: { id: 'event_node', type: 'event' }, content: eventContent });
  const encounter = boot.dependencies.nodeResolver({ runtime, node: { id: 'battle_node', type: 'battle' }, content: encounterContent });
  const boss = boot.dependencies.nodeResolver({ runtime, node: { id: 'boss', type: 'boss' }, content: bossContent });
  assert.strictEqual(event.mode, 'event');
  assert.strictEqual(encounter.mode, 'scenario');
  assert.strictEqual(encounter.scenario.objectives[0].id, 'objective.capture_crossfire_rook');
  assert.strictEqual(encounter.scenario.battle.identities.metadata.aldric_wall.heroId, 'hero.aldric_wall');
  assert.strictEqual(boss.mode, 'boss');
  assert.strictEqual(boss.boss.phases.length, 2);
  assert.strictEqual(boss.reward.meta, 1);
});

test('production event resolver applies the closed effect catalog', () => {
  const boot = createIronMarchesVerticalSlice({ projectRoot, seed: 9046 });
  const content = boot.bundle.registry.get('event', 'event.silent_foundry');
  const event = require('../src/runtime/authored-event.cjs').createAuthoredEventState(content, { nodeId: 'event' });
  const result = boot.dependencies.eventChoiceResolver({ event, choice: event.choices.find((choice) => choice.id === 'mediate') });
  assert.deepStrictEqual(result.resourceDelta, { gold: -1, supplies: 2, meta: 0 });
  assert.ok(result.addFlags.includes('story.foundry_mediated'));
  assert.ok(result.chronicleKeys.includes('chronicle.silent_foundry.mediated'));
});

test('local runtime host exposes only snapshots and declared command dispatch', async () => {
  const host = createIronMarchesRuntimeHost({ projectRoot, seed: 9047, language: 'en' });
  const before = host.getSnapshot();
  assert.strictEqual(before.format, 'rpchess-presenter-snapshot');
  assert.ok(before.campaign.routes.length > 0);
  const route = before.campaign.routes[0];
  const result = await host.dispatch({ type: 'Travel', targetNodeId: route.to });
  assert.ok(['event', 'scenario', 'reward'].includes(result.snapshot.status));
  assert.strictEqual(host.getState().campaign.currentNodeId, route.to);
  assert.deepStrictEqual(host.getSnapshot(), createPresenterSnapshot(host.getState(), host.dependencies));
});

let failures = 0;
(async () => {
  for (const { name, fn } of tests) {
    try { await fn(); console.log(`PASS ${name}`); }
    catch (error) { failures += 1; console.error(`FAIL ${name}`); console.error(error.stack || error); }
  }
  console.log(`\nIron Marches bootstrap: ${tests.length - failures}/${tests.length} passed.`);
  if (failures) process.exitCode = 1;
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
