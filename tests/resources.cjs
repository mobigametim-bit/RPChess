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
  const core = await import(pathToFileURL(path.join(game, 'js/resources-core.mjs')).href);
  const persistence = await import(pathToFileURL(path.join(game, 'js/run-persistence.mjs')).href);

  assert.strictEqual(core.STARTING_GOLD, 80, 'Resources v1 starts with 80 Gold');
  assert.strictEqual(core.STARTING_SUPPLIES, 10, 'Resources v1 starts with 10 Supplies');
  assert.strictEqual(core.TRAVEL_SUPPLY_COST, 1, 'every travel transition costs exactly one Supply');

  const run = persistence.createRun({ now: 1000, id: 'resources-test' });
  assert.strictEqual(run.gold, 80);
  assert.strictEqual(run.supplies, 10);
  assert.deepStrictEqual(run.resourceRewards, { skirmishCount: 0, battleCount: 0 });
  assert(persistence.isValidRun(run), 'new Resources run must pass run validation');

  const paid = core.applyTravelSupplyCost(run);
  assert.strictEqual(paid.requested, 1);
  assert.strictEqual(paid.paid, 1);
  assert.strictEqual(paid.shortage, false);
  assert.strictEqual(paid.run.supplies, 9, 'travel must atomically reduce Supplies by one');
  assert.strictEqual(paid.run.gold, 80, 'travel must not touch Gold');

  const empty = core.applyTravelSupplyCost({ ...run, supplies: 0 });
  assert.strictEqual(empty.paid, 0);
  assert.strictEqual(empty.shortage, true);
  assert.strictEqual(empty.run.supplies, 0, 'Resources stage must never create negative Supplies');

  const win = { over: true, type: 'checkmate', winner: 'w' };
  const blackWin = { over: true, type: 'checkmate', winner: 'b' };
  const draw = { over: true, type: 'stalemate', winner: null };
  const loss = { over: true, type: 'checkmate', winner: 'b' };
  assert.strictEqual(core.combatGoldReward({ encounterType: 'skirmish', stars: 1, status: win }), 16);
  assert.strictEqual(core.combatGoldReward({ encounterType: 'skirmish', stars: 5, status: win }), 32);
  assert.strictEqual(core.combatGoldReward({ encounterType: 'skirmish', stars: 5, status: draw }), 16);
  assert.strictEqual(core.combatGoldReward({ encounterType: 'battle', stars: 1, status: win }), 26);
  assert.strictEqual(core.combatGoldReward({ encounterType: 'battle', stars: 5, status: win }), 50);
  assert.strictEqual(core.combatGoldReward({ encounterType: 'battle', stars: 5, status: draw }), 25);
  assert.strictEqual(core.combatGoldReward({ encounterType: 'battle', stars: 5, status: loss }), 0, 'White-side loss must never grant Gold');
  assert.strictEqual(core.combatGoldReward({ encounterType: 'skirmish', stars: 12, status: win }), 60, '12-star Skirmish reward must use the full canonical difficulty range');
  assert.strictEqual(core.combatGoldReward({ encounterType: 'battle', stars: 12, status: win }), 92, '12-star Battle reward must use the full canonical difficulty range');
  assert.strictEqual(core.combatGoldReward({ encounterType: 'skirmish', stars: 12, status: blackWin, playerColor: 'b' }), 60, 'Black-side victory must receive the same deterministic reward');

  const rewarded = core.applyGoldReward(run, 32);
  assert.strictEqual(rewarded.gold, 112);
  assert.strictEqual(rewarded.supplies, 10);
  assert.strictEqual(core.applyGoldReward(run, -50).gold, 80, 'invalid negative reward must be ignored');

  const storage = new MemoryStorage();
  const legacy = persistence.createRun({ now: 2000, id: 'legacy-resources' });
  delete legacy.gold;
  delete legacy.supplies;
  delete legacy.resourceRewards;
  legacy.skirmishCount = 3;
  legacy.battleCount = 2;
  storage.setItem(persistence.RUN_STORAGE_KEY, JSON.stringify(legacy));
  const hydrated = persistence.readRun(storage);
  assert.strictEqual(hydrated.gold, 80, 'old Reboot saves must hydrate starting Gold');
  assert.strictEqual(hydrated.supplies, 10, 'old Reboot saves must hydrate starting Supplies');
  assert.deepStrictEqual(hydrated.resourceRewards, { skirmishCount: 3, battleCount: 2 }, 'old combats must not receive retroactive Gold rewards');

  const stored = persistence.writeRun({ ...hydrated, supplies: 4, gold: 137 }, storage, 2500);
  assert.strictEqual(stored.gold, 137);
  assert.strictEqual(stored.supplies, 4);
  assert.strictEqual(persistence.readRun(storage).gold, 137, 'Gold must round-trip through save persistence');
  assert.strictEqual(persistence.readRun(storage).supplies, 4, 'Supplies must round-trip through save persistence');

  const travelSource = fs.readFileSync(path.join(game, 'js/travel-choice-app.mjs'), 'utf8');
  const appSource = fs.readFileSync(path.join(game, 'js/resources-app.mjs'), 'utf8');
  const css = fs.readFileSync(path.join(game, 'css/resources.css'), 'utf8');
  assert(travelSource.includes('applyTravelSupplyCost'), 'Travel Choice must use the canonical Supply-cost function');
  assert(travelSource.includes('supplyPaid'), 'committed route must persist the exact Supply payment');
  assert(travelSource.includes('СТОИМОСТЬ ПУТИ'), 'route cards must disclose the travel cost before commitment');
  assert(appSource.includes('resourceRewards'), 'combat rewards must have one-time settlement bookkeeping');
  assert(appSource.includes("run.lastSkirmish?.playerColor || 'w'") && appSource.includes("run.lastBattle?.playerColor || 'w'"), 'reward settlement must use the actual side played in combat');
  assert(appSource.includes('dataset.resourceHud'), 'Resources HUD contract missing');
  assert(!css.includes('ui_panel_frame.png') && !css.includes('ui_panel_wide.png'), 'Resources UI must remain CSS-only and frameless');

  console.log('Resources persistence, 12-star/Black-side deterministic rewards, travel cost and frameless UX contract: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
