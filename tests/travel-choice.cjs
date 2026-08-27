const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

(async () => {
  const game = path.resolve(__dirname, '..', 'game');
  const travel = await import(pathToFileURL(path.join(game, 'js/travel-choice-core.mjs')).href);
  const persistence = await import(pathToFileURL(path.join(game, 'js/run-persistence.mjs')).href);
  const skirmish = await import(pathToFileURL(path.join(game, 'js/skirmish-core.mjs')).href);
  const battle = await import(pathToFileURL(path.join(game, 'js/battle-core.mjs')).href);

  assert.deepStrictEqual(travel.PLAYABLE_TRAVEL_TYPES, ['skirmish', 'battle', 'settlement']);
  assert.strictEqual(travel.TRAVEL_CHOICE_COUNT, 3);
  for (const type of travel.TRAVEL_ENCOUNTER_TYPES) {
    assert(Array.isArray(travel.FLAVOR_POOLS[type]), `${type} flavor pool must exist`);
    assert(travel.FLAVOR_POOLS[type].length >= 10, `${type} must have at least ten flavor lines`);
    assert.strictEqual(new Set(travel.FLAVOR_POOLS[type]).size, travel.FLAVOR_POOLS[type].length, `${type} flavor lines must be unique`);
  }

  const first = travel.createTravelChoices({ runId: 'travel-test-run', step: 1 });
  const repeat = travel.createTravelChoices({ runId: 'travel-test-run', step: 1 });
  assert.deepStrictEqual(first, repeat, 'same run + step must reproduce the exact same three paths');
  assert.strictEqual(first.length, 3);
  assert.strictEqual(new Set(first.map((choice) => choice.id)).size, 3, 'path IDs must be unique');
  assert(first.some((choice) => choice.type === 'skirmish'), 'fork must contain a Skirmish path');
  assert(first.some((choice) => choice.type === 'battle'), 'fork must contain a Battle path');
  assert(first.filter((choice) => choice.type === 'settlement').length <= 1, 'Settlement can occupy at most one card');
  assert(first.every((choice) => travel.isTravelChoice(choice)));
  assert(first.every((choice) => choice.stars >= 1 && choice.stars <= 5));

  for (const type of travel.PLAYABLE_TRAVEL_TYPES) {
    const sameType = first.filter((choice) => choice.type === type);
    assert.strictEqual(new Set(sameType.map((choice) => choice.flavor)).size, sameType.length, 'duplicate encounter types in one fork must not repeat flavor text');
  }

  const settlementFork = travel.createTravelChoices({ runId: 'settlement-test', step: 1 });
  assert.strictEqual(settlementFork.filter((choice) => choice.type === 'settlement').length, 1, 'known deterministic fork must expose Settlement for acceptance coverage');

  const later = travel.createTravelChoices({ runId: 'travel-test-run', step: 5 });
  assert.notDeepStrictEqual(later, first, 'later journey step must create a different deterministic fork');
  assert(Math.max(...later.map((choice) => choice.stars)) >= Math.max(...first.map((choice) => choice.stars)), 'threat should not regress as journey depth grows');

  const run = persistence.createRun({ id: 'travel-run', now: 1000 });
  assert.strictEqual(run.journeyStep, 0);
  assert.strictEqual(run.currentTravelChoices, null);
  assert.strictEqual(run.activeTravelChoice, null);
  assert.strictEqual(run.currentSettlement, null);

  const storage = memoryStorage();
  const offered = persistence.writeRun({ ...run, currentTravelChoices: first }, storage, 1100);
  assert.deepStrictEqual(persistence.readRun(storage).currentTravelChoices, first, 'offered paths must survive persistence/reload unchanged');

  const combatChoice = first.find((choice) => choice.type === 'skirmish');
  const chosen = { ...combatChoice, combatCountAtSelection: 0 };
  persistence.writeRun({ ...offered, journeyStep: chosen.step, currentTravelChoices: null, activeTravelChoice: chosen }, storage, 1200);
  const reloaded = persistence.readRun(storage);
  assert.deepStrictEqual(reloaded.activeTravelChoice, chosen, 'chosen route must survive reload and remain irreversible');
  assert.strictEqual(reloaded.journeyStep, 1);

  const oldStorage = memoryStorage();
  const legacy = { ...run };
  delete legacy.journeyStep;
  delete legacy.currentTravelChoices;
  delete legacy.activeTravelChoice;
  delete legacy.currentSettlement;
  oldStorage.setItem(persistence.RUN_STORAGE_KEY, JSON.stringify(legacy));
  const hydrated = persistence.readRun(oldStorage);
  assert.strictEqual(hydrated.journeyStep, 0, 'pre-Travel saves must hydrate at journey step zero');
  assert.strictEqual(hydrated.currentTravelChoices, null);
  assert.strictEqual(hydrated.activeTravelChoice, null);
  assert.strictEqual(hydrated.currentSettlement, null);

  const skirmishChoice = first.find((choice) => choice.type === 'skirmish');
  globalThis.RPChessTravelEncounterOverride = skirmishChoice;
  const routedSkirmish = skirmish.createEncounter({ seed: 'fallback-skirmish', stars: 5 });
  assert.strictEqual(routedSkirmish.seed, skirmishChoice.seed, 'Skirmish must consume the chosen route seed');
  assert.strictEqual(routedSkirmish.stars, skirmishChoice.stars, 'Skirmish must consume the chosen route threat');
  assert.strictEqual(globalThis.RPChessTravelEncounterOverride, undefined, 'Skirmish override must be one-shot');

  const battleChoice = first.find((choice) => choice.type === 'battle');
  globalThis.RPChessTravelEncounterOverride = battleChoice;
  const routedBattle = battle.createBattleEncounter({ seed: 'fallback-battle', stars: 1 });
  assert.strictEqual(routedBattle.seed, battleChoice.seed, 'Battle must consume the chosen route seed');
  assert.strictEqual(routedBattle.stars, battleChoice.stars, 'Battle must consume the chosen route threat');
  assert.strictEqual(globalThis.RPChessTravelEncounterOverride, undefined, 'Battle override must be one-shot');

  console.log('Travel Choice deterministic combat/safe offers, flavor variation, persistence and encounter routing contract: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
