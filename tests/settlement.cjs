const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const game = path.join(root, 'game');

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

(async () => {
  const settlement = await import(pathToFileURL(path.join(game, 'js/settlement-core.mjs')).href);
  const travel = await import(pathToFileURL(path.join(game, 'js/travel-choice-core.mjs')).href);
  const resources = await import(pathToFileURL(path.join(game, 'js/resources-core.mjs')).href);
  const persistence = await import(pathToFileURL(path.join(game, 'js/run-persistence.mjs')).href);

  assert.deepStrictEqual(settlement.HEAL_COSTS, { pawn: 10, knight: 18, bishop: 18, rook: 26, queen: 42 });
  assert.deepStrictEqual(settlement.RECRUIT_COSTS, { pawn: 24, knight: 42, bishop: 42, rook: 64, queen: 96 });
  assert.strictEqual(settlement.SETTLEMENT_SUPPLY_PRICE, 12);
  assert.strictEqual(settlement.SETTLEMENT_SUPPLY_STOCK, 4);
  assert.strictEqual(settlement.SETTLEMENT_OFFER_COUNT, 3);
  assert.strictEqual(settlement.RECRUIT_LIBRARY.length, 33, 'Settlement v1 must use the 33 non-King named heroes');
  assert(settlement.RECRUIT_LIBRARY.every((candidate) => candidate.pieceType !== 'king'));

  assert.deepStrictEqual(travel.PLAYABLE_TRAVEL_TYPES, ['skirmish', 'battle', 'settlement']);
  const fork = travel.createTravelChoices({ runId: 'settlement-test', step: 1 });
  assert.strictEqual(fork.length, 3);
  assert(fork.some((choice) => choice.type === 'skirmish'));
  assert(fork.some((choice) => choice.type === 'battle'));
  assert.strictEqual(fork.filter((choice) => choice.type === 'settlement').length, 1, 'deterministic test fork must contain one Settlement');
  assert(fork.filter((choice) => choice.type === 'settlement').length <= 1, 'Settlement can never occupy more than one route card');
  const choice = fork.find((item) => item.type === 'settlement');

  let run = persistence.createRun({ now: 1000, id: 'settlement-test' });
  const payment = resources.applyTravelSupplyCost(run);
  assert.strictEqual(payment.run.supplies, 9);
  run = {
    ...payment.run,
    journeyStep: choice.step,
    activeTravelChoice: { ...choice, supplyCostAtSelection: payment.requested, supplyPaid: payment.paid },
    currentTravelChoices: null
  };
  const stateA = settlement.createSettlementState(run, run.activeTravelChoice);
  const stateB = settlement.createSettlementState(run, run.activeTravelChoice);
  assert.deepStrictEqual(stateA, stateB, 'same settlement seed must reproduce the exact same three offers');
  assert.strictEqual(stateA.offers.length, 3);
  assert.strictEqual(new Set(stateA.offers).size, 3);
  assert.strictEqual(stateA.supplyStock, 4);
  const starterIds = new Set(run.roster.map((character) => character.id));
  assert(stateA.offers.every((id) => !starterIds.has(id)), 'existing roster characters must be excluded from offers');
  assert(stateA.offers.every((id) => settlement.recruitProfile(id)?.pieceType !== 'king'), 'King-type heroes must never be offered');

  run = { ...run, currentSettlement: stateA, gold: 500 };
  run.roster = run.roster.map((character) => character.id === 'hero.mara_chain' ? { ...character, status: 'wounded' } : character);
  const healed = settlement.applyHealing(run, 'hero.mara_chain');
  assert.strictEqual(healed.success, true);
  assert.strictEqual(healed.spent, 10);
  assert.strictEqual(healed.run.gold, 490);
  assert.strictEqual(healed.run.roster.find((character) => character.id === 'hero.mara_chain').status, 'healthy');
  assert.strictEqual(settlement.applyHealing(healed.run, 'hero.mara_chain').success, false, 'healing must be idempotent once the unit is healthy');
  assert.strictEqual(settlement.applyHealing(run, 'king.oathkeeper').success, false, 'run King is never healable in Settlement');

  const offeredId = stateA.offers[0];
  const offered = settlement.recruitProfile(offeredId);
  const expectedRecruitPrice = settlement.RECRUIT_COSTS[offered.pieceType];
  const recruited = settlement.applyRecruitment(healed.run, offeredId);
  assert.strictEqual(recruited.success, true);
  assert.strictEqual(recruited.spent, expectedRecruitPrice);
  assert.strictEqual(recruited.run.roster.length, 7);
  const added = recruited.run.roster.find((character) => character.id === offeredId);
  assert(added, 'recruited hero must be appended to roster');
  assert.strictEqual(added.status, 'healthy');
  assert.strictEqual(added.isRunKing, false);
  assert.strictEqual(added.commandCost, offered.commandCost);
  assert.strictEqual(settlement.applyRecruitment(recruited.run, offeredId).success, false, 'the same offer cannot be hired twice');

  const beforeSupplyGold = recruited.run.gold;
  const bought = settlement.applySupplyPurchase(recruited.run);
  assert.strictEqual(bought.success, true);
  assert.strictEqual(bought.spent, 12);
  assert.strictEqual(bought.run.gold, beforeSupplyGold - 12);
  assert.strictEqual(bought.run.supplies, 10, 'one purchased Supply must offset the one Supply spent entering Settlement');
  assert.strictEqual(bought.run.currentSettlement.supplyStock, 3);

  let sold = bought.run;
  for (let i = 0; i < 3; i += 1) sold = settlement.applySupplyPurchase(sold).run;
  assert.strictEqual(sold.currentSettlement.supplyStock, 0);
  assert.strictEqual(settlement.applySupplyPurchase(sold).success, false, 'local stock cannot go below zero');

  const storage = new MemoryStorage();
  const persisted = persistence.writeRun(bought.run, storage, 2000);
  const reloaded = persistence.readRun(storage);
  assert.deepStrictEqual(reloaded.currentSettlement, persisted.currentSettlement, 'offers and supply stock must survive reload unchanged');
  assert.strictEqual(reloaded.roster.some((character) => character.id === offeredId), true, 'recruited hero must survive reload');
  assert.strictEqual(reloaded.gold, persisted.gold);
  assert.strictEqual(reloaded.supplies, persisted.supplies);

  const suppliesBeforeExit = reloaded.supplies;
  const completed = settlement.completeSettlement(reloaded);
  assert.strictEqual(completed.activeTravelChoice, null);
  assert.strictEqual(completed.currentSettlement, null);
  assert.strictEqual(completed.supplies, suppliesBeforeExit, 'leaving Settlement must not charge another Supply');
  persistence.writeRun(completed, storage, 2100);
  assert.strictEqual(persistence.readRun(storage).currentSettlement, null);

  const legacy = persistence.createRun({ now: 3000, id: 'pre-settlement' });
  delete legacy.currentSettlement;
  storage.setItem(persistence.RUN_STORAGE_KEY, JSON.stringify(legacy));
  assert.strictEqual(persistence.readRun(storage).currentSettlement, null, 'pre-Settlement saves must hydrate safely');

  const appSource = fs.readFileSync(path.join(game, 'js/settlement-app.mjs'), 'utf8');
  const css = fs.readFileSync(path.join(game, 'css/settlement.css'), 'utf8');
  const travelSource = fs.readFileSync(path.join(game, 'js/travel-choice-app.mjs'), 'utf8');
  for (const token of ['ЗНАХАРКА', 'ТАВЕРНА', 'СНАБЖЕНИЕ', 'Продолжить путь', 'data-settlement-roster', 'data-settlement-buy-supply']) {
    assert(appSource.includes(token), `Settlement runtime contract missing: ${token}`);
  }
  assert(travelSource.includes("choice.type === 'settlement'"), 'Travel Choice must route Settlement cards');
  assert(travelSource.includes('БЕЗОПАСНОЕ МЕСТО'), 'Settlement route card must replace combat threat presentation');
  assert(!css.includes('ui_panel_frame.png') && !css.includes('ui_panel_wide.png'), 'Settlement UI must remain CSS-only and frameless');
  assert(css.includes('@media(max-width:760px)'), 'Settlement must define its mobile vertical layout');

  console.log('Settlement deterministic offers, healing, recruitment, supply stock, persistence and no-double-charge contract: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
