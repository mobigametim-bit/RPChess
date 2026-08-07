'use strict';

const assert = require('assert');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { createBrowserRunSelectionHost } = require('../src/browser/iron-marches-browser-host-b9.cjs');

async function launch() {
  const host = createBrowserRunSelectionHost({
    seed: 12026,
    profileId: 'b10-b13-browser',
    storage: new MemoryKeyValueStorage(),
    deviceId: 'b10-b13-browser-test',
    stageB: true,
    availableHeroIds: ['hero.aldric_wall', 'hero.mara_chain', 'hero.vael_hammer']
  });
  await host.dispatch({ type: 'SelectKing', kingId: 'king.oathkeeper' });
  await host.dispatch({ type: 'SelectDoctrine', doctrineId: 'doctrine.fortress' });
  await host.dispatch({ type: 'ToggleHero', heroId: 'hero.aldric_wall' });
  await host.dispatch({ type: 'LockSelection' });
  const runtime = host.getRuntimeHost();
  let snapshot = runtime.getSnapshot();
  await runtime.dispatch({ type: 'ChooseDraftHero', heroId: snapshot.stageB.draft.heroOffers[0].id });
  snapshot = runtime.getSnapshot();
  await runtime.dispatch({ type: 'ChooseDraftRegular', regularId: snapshot.stageB.draft.regularOffers[0].id });
  await runtime.dispatch({ type: 'ConfirmDraft' });
  return runtime;
}

(async () => {
  const runtime = await launch();
  const snapshot = runtime.getSnapshot();
  const state = runtime.getState();
  assert.strictEqual(snapshot.status, 'campaign');
  assert.strictEqual(snapshot.economy.gold, 80);
  assert.strictEqual(snapshot.economy.supplies, 10);
  assert.deepStrictEqual(snapshot.economy.ledger, []);
  assert.deepStrictEqual(snapshot.narrative.facts, []);
  assert.deepStrictEqual(snapshot.narrative.regionalLines, { iron_and_bread: 'unstarted', honor_of_the_marches: 'unstarted' });
  assert.strictEqual(state.campaign.supplies, 10);
  assert.strictEqual(state.resources.gold, 80);
  assert.strictEqual(state.stageB.draft.crownBonus.supplies, 0);
  assert.strictEqual(snapshot.campaign.nodes.some((node) => node.visibility === 'hidden'), false);
  assert.ok(snapshot.campaign.routes.length >= 1);
  console.log('B10-B13 browser contract: 10 supplies, 80 gold, economy/narrative surfaces and B9 visibility passed.');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
