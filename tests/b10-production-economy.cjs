'use strict';

const assert = require('assert');
const {
  START_SUPPLIES, START_GOLD, INTER_ACT_SUPPLY_TO_GOLD,
  GOLD_REWARD_VALUES, SUPPLY_REWARD, HOSPITAL_PRICES, FORGE_PRICES,
  productionizeStageB, productionRewardOffers, chooseProductionReward,
  productionServiceState, useProductionService, validateProductionPrices, interActConversion
} = require('../src/runtime/production-economy.cjs');
const stageBBase = require('../src/runtime/stage-b-act.cjs');

assert.strictEqual(START_SUPPLIES, 10);
assert.strictEqual(START_GOLD, 80);
assert.strictEqual(INTER_ACT_SUPPLY_TO_GOLD, 5);
assert.deepStrictEqual(GOLD_REWARD_VALUES, [30, 50, 70]);
assert.strictEqual(SUPPLY_REWARD, 3);
assert.deepStrictEqual(HOSPITAL_PRICES, { oneLight: 25, allLight: 50, heroHeavy: 60, emergency: 90 });
assert.deepStrictEqual(FORGE_PRICES, { commonUpgrade: 50, rareUpgrade: 80, remove: 30, reforge: 60 });
assert.strictEqual(validateProductionPrices().ok, true);

let stageB = productionizeStageB(stageBBase.createStageBActState({
  seed: 9042,
  skipDraft: true,
  army: { kingId: 'king.oathkeeper', doctrineId: 'doctrine.fortress', heroes: [] }
}));
assert.strictEqual(stageB.draft.crownBonus.supplies, 0);
assert.deepStrictEqual(stageB.economy.ledger, []);

const rewardsA = productionRewardOffers(stageB, { nodeId: 'battle-1', sideObjectiveCompleted: true, sideObjectiveReward: 'gold' });
const rewardsB = productionRewardOffers(stageB, { nodeId: 'battle-1', sideObjectiveCompleted: true, sideObjectiveReward: 'gold', armyStrength: 999, gold: 0 });
assert.deepStrictEqual(rewardsA.pendingRewardOffers, rewardsB.pendingRewardOffers, 'reward generation must not adapt to army/resources');
assert.strictEqual(rewardsA.pendingRewardOffers.length, 3);
assert.strictEqual(rewardsA.pendingRewardOffers.find((offer) => offer.type === 'supplies').payload.supplies, 3);
assert.ok([30, 50, 70].includes(rewardsA.pendingRewardOffers.find((offer) => offer.type === 'gold').payload.gold));
assert.strictEqual(rewardsA.pendingRewardOffers.every((offer) => offer.bonus.type === 'gold' && offer.bonus.amount === 10), true);
const goldOffer = rewardsA.pendingRewardOffers.find((offer) => offer.type === 'gold');
stageB = chooseProductionReward(rewardsA, goldOffer.id, { nodeId: 'battle-1' });
assert.strictEqual(stageB.status, 'campaign');
assert.strictEqual(stageB.pendingRewardOffers.length, 0);
assert.strictEqual(stageB.economy.goldEarned, goldOffer.payload.gold + 10);
assert.strictEqual(stageB.economy.ledger.at(-1).type, 'reward_selected');

let shop = productionServiceState(stageB, 'shop', { nodeId: 'shop-node' });
assert.strictEqual(shop.service.offers.length, 4);
assert.strictEqual(shop.service.offers.find((offer) => offer.id === 'shop.supplies').cost, 30);
shop = useProductionService(shop, 'shop.supplies', { gold: 200 });
assert.strictEqual(shop.status, 'service', 'shop stays open for multiple purchases');
assert.strictEqual(shop.lastServiceTransaction.supplyDelta, 2);
assert.throws(() => useProductionService(shop, 'shop.supplies', { gold: 200 }), /already used/);
shop = useProductionService(shop, 'shop.relic', { gold: 170 });
assert.strictEqual(shop.relicInventory.length, 1);

let injured = productionizeStageB({
  ...stageB,
  status: 'campaign',
  roster: stageB.roster.map((entry, index) => index === 1 ? { ...entry, injury: 'light', available: false, skipBattles: 1 } : entry)
});
let hospital = productionServiceState(injured, 'hospital', { nodeId: 'hospital-node' });
hospital = useProductionService(hospital, 'hospital.light_one', { gold: 100, targetRosterId: hospital.roster[1].id });
assert.strictEqual(hospital.roster[1].injury, null);
assert.strictEqual(hospital.status, 'service');

let forge = productionServiceState(stageB, 'forge', { nodeId: 'forge-node' });
forge = useProductionService(forge, 'forge.upgrade_common', { gold: 100, targetRelicId: 'relic.test' });
assert.strictEqual(forge.relicUpgrades['relic.test'], 1);

let camp = productionServiceState(stageB, 'camp', { nodeId: 'camp-node' });
camp = useProductionService(camp, 'camp.supplies', { gold: 0 });
assert.strictEqual(camp.status, 'campaign');
assert.strictEqual(camp.service, null);
assert.strictEqual(camp.lastServiceTransaction.supplyDelta, 1);

assert.deepStrictEqual(interActConversion({ gold: 135 }, { supplies: 4 }), {
  convertedSupplies: 4,
  convertedGold: 20,
  nextGold: 155,
  nextSupplies: 10,
  formula: '4 × 5 = 20'
});

console.log('B10 production economy: start resources, rewards, fixed prices, shop, hospital, forge, camp and inter-act conversion passed.');
