const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { createRunSelectionHost, normalizeSelectionCommand } = require('../src/runtime/run-selection-host.cjs');

if (typeof global.CustomEvent !== 'function') {
  global.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type);
      this.detail = options.detail;
    }
  };
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const projectRoot = path.resolve(__dirname, '..');

(async () => {
  const clientModule = await import(pathToFileURL(path.resolve(__dirname, '../game/js/run-selection-client.mjs')).href);
  const presenterModule = await import(pathToFileURL(path.resolve(__dirname, '../game/js/run-selection-presenter.mjs')).href);

  test('host and browser normalize the same closed command vocabulary', () => {
    assert.deepStrictEqual(normalizeSelectionCommand({ type: 'SelectKing', kingId: 'king.oathkeeper' }), { type: 'SelectKing', kingId: 'king.oathkeeper' });
    assert.deepStrictEqual(clientModule.normalizeRunSelectionCommand({ type: 'ToggleHero', heroId: 'hero.aldric_wall' }), { type: 'ToggleHero', heroId: 'hero.aldric_wall' });
    assert.throws(() => normalizeSelectionCommand({ type: 'Unknown' }), /unsupported/);
    assert.throws(() => clientModule.normalizeRunSelectionCommand({ type: 'SelectDoctrine' }), /requires doctrineId/);
  });

  test('local selection host reaches a deterministic runtime only after lock', async () => {
    const host = createRunSelectionHost({ projectRoot, seed: 14001, language: 'ru' });
    let snapshot = host.getSnapshot();
    assert.strictEqual(snapshot.status, 'selecting');
    snapshot = (await host.dispatch({ type: 'SelectKing', kingId: 'king.oathkeeper' })).snapshot;
    snapshot = (await host.dispatch({ type: 'SelectDoctrine', doctrineId: 'doctrine.fortress' })).snapshot;
    snapshot = (await host.dispatch({ type: 'ToggleHero', heroId: 'hero.aldric_wall' })).snapshot;
    assert.strictEqual(snapshot.selection.canLock, true);
    snapshot = (await host.dispatch({ type: 'LockSelection' })).snapshot;
    assert.strictEqual(snapshot.status, 'ready');
    assert.strictEqual(snapshot.runtime.format, 'rpchess-presenter-snapshot');
    assert.strictEqual(host.getVerticalSlice().selection.kingId, 'king.oathkeeper');
    await assert.rejects(host.dispatch({ type: 'ToggleHero', heroId: 'hero.mara_chain' }), /already launched/);
  });

  test('browser client emits ready and serializes pending commands', async () => {
    const host = createRunSelectionHost({ projectRoot, seed: 14002, language: 'en' });
    const client = new clientModule.RunSelectionClient({ transport: clientModule.createRunSelectionTransport(host), snapshot: host.getSnapshot() });
    let ready = null;
    client.addEventListener('ready', (event) => { ready = event.detail; });
    await client.dispatch({ type: 'SelectKing', kingId: 'king.oathkeeper' });
    await client.dispatch({ type: 'SelectDoctrine', doctrineId: 'doctrine.fortress' });
    await client.dispatch({ type: 'ToggleHero', heroId: 'hero.aldric_wall' });
    const snapshot = await client.dispatch({ type: 'LockSelection' });
    assert.strictEqual(snapshot.status, 'ready');
    assert.deepStrictEqual(ready, snapshot.runtime);
    assert.strictEqual(client.pending, false);
  });

  test('selection markup uses Register 01 region, king and doctrine art safely', () => {
    const snapshot = createRunSelectionHost({ projectRoot, seed: 14003, language: 'ru' }).getSnapshot();
    const markup = presenterModule.selectionMarkup(snapshot);
    assert.ok(markup.includes('aria-labelledby="rprs-kings"'));
    assert.ok(markup.includes('data-lock-selection'));
    assert.ok(markup.includes('assets/regions/iron_marches/map_banner.jpg'));
    assert.ok(markup.includes('assets/regions/iron_marches/crest.png'));
    assert.ok(markup.includes('assets/kings/oathkeeper/portrait.png'));
    assert.ok(markup.includes('assets/doctrines/fortress/emblem.png'));
    const escaped = presenterModule.kingCard({ id: 'king.bad', label: '<script>alert(1)</script>', selected: false, assets: {} });
    assert.strictEqual(escaped.includes('<script>'), false);
    assert.ok(escaped.includes('&lt;script&gt;'));
    const disabled = presenterModule.doctrineCard({ id: 'doctrine.bad', label: 'Bad', selected: false, compatible: false, assets: {} });
    assert.ok(disabled.includes('disabled'));
  });

  test('selection styles include production focus ring, font and reduced motion', () => {
    const css = fs.readFileSync(path.resolve(projectRoot, 'game/css/run-selection.css'), 'utf8');
    assert.ok(css.includes("../assets/ui/focus_ring.png"));
    assert.ok(css.includes("../fonts/BrahmsGotischCyr.otf"));
    assert.ok(css.includes('prefers-reduced-motion'));
  });

  test('snapshot validator rejects ready state without runtime handoff', () => {
    const snapshot = createRunSelectionHost({ projectRoot, seed: 14004 }).getSnapshot();
    assert.strictEqual(clientModule.validateRunSelectionSnapshot(snapshot).status, 'selecting');
    assert.throws(() => clientModule.validateRunSelectionSnapshot({ ...snapshot, status: 'ready', runtime: null }), /missing runtime/);
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
  console.log(`\nRun selection browser: ${tests.length - failures}/${tests.length} passed.`);
  if (failures) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
