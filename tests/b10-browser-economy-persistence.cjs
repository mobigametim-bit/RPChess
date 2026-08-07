'use strict';

const assert = require('assert');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { generateProductionActGraph } = require('../src/campaign/production-map.cjs');
const { createBrowserRunSelectionHost } = require('../src/browser/iron-marches-browser-host-b9.cjs');

function seedWithOpeningShop() {
  for (let seed = 1; seed <= 500; seed += 1) {
    const graph = generateProductionActGraph({ rootSeed: seed, regionId: 'region.iron_marches' });
    const targets = (graph.outgoing[graph.startNodeId] || []).map((edgeId) => graph.nodesById[graph.edgesById[edgeId].to]);
    if (targets.some((node) => node.type === 'shop')) return seed;
  }
  throw new Error('no opening shop found in deterministic seed window');
}

async function startRun(storage, seed) {
  const host = createBrowserRunSelectionHost({
    seed, profileId: 'profile-1', storage, deviceId: 'b10-persistence-test', stageB: true,
    availableHeroIds: ['hero.aldric_wall', 'hero.mara_chain', 'hero.vael_hammer']
  });
  await host.dispatch({ type:'SelectKing', kingId:'king.oathkeeper' });
  await host.dispatch({ type:'SelectDoctrine', doctrineId:'doctrine.fortress' });
  await host.dispatch({ type:'ToggleHero', heroId:'hero.aldric_wall' });
  await host.dispatch({ type:'LockSelection' });
  const runtime = host.getRuntimeHost();
  let snapshot = runtime.getSnapshot();
  await runtime.dispatch({ type:'ChooseDraftHero', heroId:snapshot.stageB.draft.heroOffers[0].id });
  snapshot = runtime.getSnapshot();
  await runtime.dispatch({ type:'ChooseDraftRegular', regularId:snapshot.stageB.draft.regularOffers[0].id });
  await runtime.dispatch({ type:'ConfirmDraft' });
  return host;
}

(async () => {
  const seed = seedWithOpeningShop();
  const storage = new MemoryKeyValueStorage();
  const selection = await startRun(storage, seed);
  const runtime = selection.getRuntimeHost();
  let snapshot = runtime.getSnapshot();
  const shopRoute = snapshot.campaign.routes.find((route) => route.type === 'shop');
  assert.ok(shopRoute);
  await runtime.dispatch({ type:'Travel', targetNodeId:shopRoute.to });
  snapshot = runtime.getSnapshot();
  assert.strictEqual(snapshot.status, 'service');
  assert.strictEqual(snapshot.stageB.service.type, 'shop');
  assert.strictEqual(snapshot.resources.gold, 80);
  assert.strictEqual(snapshot.resources.supplies, 9);
  const supplyOffer = snapshot.stageB.service.offers.find((offer) => offer.id === 'shop.supplies');
  assert.ok(supplyOffer);
  await runtime.dispatch({ type:'UseService', offerId:supplyOffer.id });
  snapshot = runtime.getSnapshot();
  assert.strictEqual(snapshot.status, 'service');
  assert.strictEqual(snapshot.resources.gold, 50);
  assert.strictEqual(snapshot.resources.supplies, 11);
  assert.strictEqual(snapshot.stageB.service.usedOfferIds.includes('shop.supplies'), true);
  assert.strictEqual(snapshot.economy.ledger.at(-1).type, 'service_purchase');

  const resumedSelection = createBrowserRunSelectionHost({
    profileId:'profile-1', storage, deviceId:'b10-persistence-test', stageB:true,
    availableHeroIds:['hero.aldric_wall', 'hero.mara_chain', 'hero.vael_hammer']
  });
  assert.strictEqual(resumedSelection.getSnapshot().status, 'ready');
  const resumed = resumedSelection.getRuntimeHost();
  assert.strictEqual(resumed.resumed, true);
  const restored = resumed.getSnapshot();
  assert.strictEqual(restored.status, 'service');
  assert.strictEqual(restored.resources.gold, 50);
  assert.strictEqual(restored.resources.supplies, 11);
  assert.strictEqual(restored.stageB.service.usedOfferIds.includes('shop.supplies'), true);
  assert.strictEqual(restored.economy.ledger.at(-1).type, 'service_purchase');
  assert.deepStrictEqual(restored.stageB.service.offers, snapshot.stageB.service.offers);
  console.log(`B10 browser persistence: atomic shop purchase, materialized offers and reload passed on seed ${seed}.`);
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
