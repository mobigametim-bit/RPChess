const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_BROWSER_SELECTION,
  createBrowserIronMarchesRuntimeHost,
  createBrowserRunSelectionHost
} = require('../src/browser/iron-marches-browser-host.cjs');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');
const { createEncounterScenario, createBossFromTemplates } = require('../src/content/scenario-templates.cjs');
const { createRuntimeArmy, projectArmyBattleOptions } = require('../src/runtime/army-roster.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const root = path.resolve(__dirname, '..');

function projectedArmy(bundle, heroIds) {
  return createRuntimeArmy({
    regionId: DEFAULT_BROWSER_SELECTION.regionId,
    kingId: DEFAULT_BROWSER_SELECTION.kingId,
    doctrineId: DEFAULT_BROWSER_SELECTION.doctrineId,
    heroIds
  }, bundle.registry, bundle.combatProfiles);
}

function projectedHeroIds(battle) {
  return [
    ...Object.values(battle.identities.metadata).map((metadata) => metadata.heroId).filter(Boolean),
    ...battle.reserve.map((entry) => entry.metadata.heroId).filter(Boolean)
  ];
}

test('browser production bundle validates embedded content without filesystem reads', () => {
  const bundle = buildBrowserProductionBundle();
  assert.strictEqual(bundle.format, 'rpchess-browser-production-content');
  assert.strictEqual(bundle.registry.get('region', 'region.iron_marches').boardThemeId, 'iron_marches');
  assert.strictEqual(bundle.registry.get('king', 'king.oathkeeper').assets.portrait, 'assets/kings/oathkeeper/portrait.png');
  assert.ok(bundle.scenarioTemplates.encounters['encounter.iron_crossfire_files']);
  assert.ok(bundle.scenarioTemplates.bosses['boss.iron_regent']);
  assert.ok(bundle.assetPaths.includes('assets/doctrines/fortress/emblem.png'));
  assert.strictEqual(bundle.combatProfiles.heroes['hero.tomas_gate'].contentPieceType, 'king');
  assert.strictEqual(bundle.combatProfiles.heroes['hero.tomas_gate'].battlePieceType, 'rook');
  assert.ok(bundle.combatProfiles.heroes['hero.tomas_gate'].overrideReason);
});

test('same browser runtime inputs produce byte-equivalent initial snapshots', () => {
  const first = createBrowserIronMarchesRuntimeHost({ seed: 16001, language: 'ru' });
  const second = createBrowserIronMarchesRuntimeHost({ seed: 16001, language: 'ru' });
  assert.deepStrictEqual(second.selection, first.selection);
  assert.deepStrictEqual(second.army, first.army);
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
  assert.deepStrictEqual(host.getRuntimeHost().selection.heroIds, ['hero.aldric_wall']);
  assert.deepStrictEqual(host.getRuntimeHost().selection.relicIds, ['relic.echo_shield']);
  assert.deepStrictEqual(host.getRuntimeHost().getState().army.heroIds, ['hero.aldric_wall']);
});

test('selected heroes replace compatible authored roles and keep their own relics exactly once', () => {
  const bundle = buildBrowserProductionBundle();
  const army = projectedArmy(bundle, ['hero.tomas_gate', 'hero.mara_chain']);
  const created = createEncounterScenario(bundle.scenarioTemplates, 'encounter.iron_crossfire_files', {
    seed: 16021,
    playerSide: 'w',
    battleProjector: (options) => projectArmyBattleOptions(options, army)
  });
  const battle = created.scenario.battle;
  const role = battle.identities.metadata.aldric_wall;
  assert.strictEqual(role.heroId, 'hero.tomas_gate');
  assert.deepStrictEqual(role.relicIds, ['relic.twin_command']);
  assert.strictEqual(role.combatPieceType, 'rook');
  assert.strictEqual(role.combatProfileOverride, 'escort_scenario_uses_rook_profile');
  assert.strictEqual(battle.identities.metadata.oathkeeper.kingId, 'king.oathkeeper');
  assert.deepStrictEqual(projectedHeroIds(battle).sort(), ['hero.mara_chain', 'hero.tomas_gate']);
  assert.strictEqual(new Set(projectedHeroIds(battle)).size, projectedHeroIds(battle).length);
  assert.strictEqual(projectedHeroIds(battle).includes('hero.aldric_wall'), false);
});

test('missing matching hero keeps scenario geometry as an anonymous ordinary piece', () => {
  const bundle = buildBrowserProductionBundle();
  const army = projectedArmy(bundle, ['hero.tomas_gate', 'hero.mara_chain']);
  const created = createEncounterScenario(bundle.scenarioTemplates, 'encounter.iron_blocked_diagonal', {
    seed: 16022,
    playerSide: 'w',
    battleProjector: (options) => projectArmyBattleOptions(options, army)
  });
  const battle = created.scenario.battle;
  const role = battle.identities.metadata.orell_bishop;
  assert.strictEqual(role.heroId, undefined);
  assert.strictEqual(role.anonymous, true);
  assert.strictEqual(role.armySource, 'scenario_role');
  assert.deepStrictEqual(projectedHeroIds(battle).sort(), ['hero.mara_chain', 'hero.tomas_gate']);
});

test('both boss phases project the same selected army without leaking Lady Sorn', () => {
  const bundle = buildBrowserProductionBundle();
  const army = projectedArmy(bundle, ['hero.aldric_wall']);
  const created = createBossFromTemplates(bundle.scenarioTemplates, 'boss.iron_regent', {
    seed: 16023,
    playerSide: 'w',
    battleProjector: (options) => projectArmyBattleOptions(options, army)
  });
  const battles = [created.state.scenario.battle, created.battleForPhase(1)];
  for (const battle of battles) {
    assert.strictEqual(battle.identities.metadata.lady_sorn.heroId, undefined);
    assert.strictEqual(battle.identities.metadata.lady_sorn.anonymous, true);
    assert.deepStrictEqual(projectedHeroIds(battle), ['hero.aldric_wall']);
    assert.strictEqual(new Set(projectedHeroIds(battle)).size, 1);
  }
});

test('browser runtime accepts presenter commands through the same narrow boundary', async () => {
  const host = createBrowserIronMarchesRuntimeHost({ seed: 16003, language: 'en' });
  const initial = host.getSnapshot();
  const route = initial.campaign.routes.find((item) => item.affordable);
  assert.ok(route);
  const result = await host.dispatch({ type: 'Travel', targetNodeId: route.to });
  assert.ok(['campaign', 'deployment', 'event', 'scenario', 'boss', 'reward'].includes(result.snapshot.status));
  assert.strictEqual(result.snapshot.transcriptLength, 1);
  assert.deepStrictEqual(host.getState().army.heroIds, DEFAULT_BROWSER_SELECTION.heroIds);
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
