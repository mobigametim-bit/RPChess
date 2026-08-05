const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_BROWSER_SELECTION,
  createBrowserIronMarchesRuntimeHost,
  createBrowserRunSelectionHost
} = require('../src/browser/iron-marches-browser-host.cjs');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const root = path.resolve(__dirname, '..');

test('browser production bundle validates embedded content without filesystem reads', () => {
  const bundle = buildBrowserProductionBundle();
  assert.strictEqual(bundle.format, 'rpchess-browser-production-content');
  assert.strictEqual(bundle.registry.get('region', 'region.iron_marches').boardThemeId, 'iron_marches');
  assert.strictEqual(bundle.registry.get('king', 'king.oathkeeper').assets.portrait, 'assets/kings/oathkeeper/portrait.png');
  assert.ok(bundle.scenarioTemplates.encounters['encounter.iron_crossfire']);
  assert.ok(bundle.scenarioTemplates.bosses['boss.iron_regent']);
  assert.ok(bundle.assetPaths.includes('assets/doctrines/fortress/emblem.png'));
});

test('same browser runtime inputs produce byte-equivalent initial snapshots', () => {
  const first = createBrowserIronMarchesRuntimeHost({ seed: 16001, language: 'ru' });
  const second = createBrowserIronMarchesRuntimeHost({ seed: 16001, language: 'ru' });
  assert.deepStrictEqual(second.selection, first.selection);
  assert.deepStrictEqual(second.getState(), first.getState());
  assert.deepStrictEqual(second.getSnapshot(), first.getSnapshot());
  assert.strictEqual(first.getSnapshot().status, 'campaign');
});

test('selection host launches production runtime only after a valid lock', async () => {
  const host = createBrowserRunSelectionHost({ seed: 16002, language: 'ru' });
  assert.strictEqual(host.getSnapshot().status, 'selecting');
  await host.dispatch({ type: 'SelectKing', kingId: DEFAULT_BROWSER_SELECTION.kingId });
  await host.dispatch({ type: 'SelectDoctrine', doctrineId: DEFAULT_BROWSER_SELECTION.doctrineId });
  await host.dispatch({ type: 'ToggleHero', heroId: DEFAULT_BROWSER_SELECTION.heroIds[0] });
  const launched = await host.dispatch({ type: 'LockSelection' });
  assert.strictEqual(launched.snapshot.status, 'ready');
  assert.strictEqual(launched.snapshot.runtime.format, 'rpchess-presenter-snapshot');
  assert.strictEqual(launched.snapshot.runtime.status, 'campaign');
  assert.strictEqual(host.getRuntimeHost().selection.heroIds.length, 1);
});

test('browser runtime accepts presenter commands through the same narrow boundary', async () => {
  const host = createBrowserIronMarchesRuntimeHost({ seed: 16003, language: 'en' });
  const initial = host.getSnapshot();
  const route = initial.campaign.routes.find((item) => item.affordable);
  assert.ok(route);
  const result = await host.dispatch({ type: 'Travel', targetNodeId: route.to });
  assert.ok(['campaign', 'event', 'scenario', 'boss', 'reward'].includes(result.snapshot.status));
  assert.strictEqual(result.snapshot.transcriptLength, 1);
});

test('isolated browser entry references generated production bundle, not preview mock data', () => {
  const html = fs.readFileSync(path.join(root, 'game/vertical-slice.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'game/js/vertical-slice-app.mjs'), 'utf8');
  assert.ok(html.includes('js/generated/iron-marches-runtime.bundle.js'));
  assert.ok(html.includes('js/vertical-slice-app.mjs'));
  assert.ok(app.includes('createBrowserRunSelectionHost'));
  assert.ok(app.includes('createLocalRuntimeTransport'));
  assert.strictEqual(app.includes('makeSnapshot'), false);
});

(async () => {
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
  console.log(`\nBrowser production runtime: ${tests.length - failures}/${tests.length} passed.`);
  if (failures) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
