'use strict';

const assert = require('assert');
const path = require('path');
const {
  loadProductionEventLibrary,
  createProductionEventState
} = require('../src/content/production-events.cjs');
const { createProductionEventSession, restoreProductionEventSession } = require('../src/runtime/production-event-session.cjs');
const { createProductionEventSelectorState, completeProductionEventReservation } = require('../src/campaign/production-event-selector.cjs');
const {
  createNarrativeState,
  applyFacts,
  buildIronMarchesFinale,
  deriveRegionalLines
} = require('../src/runtime/production-narrative.cjs');

const library = loadProductionEventLibrary(path.resolve(__dirname, '../content/events/iron_marches_production.json'));
const expectedIds = [
  'event.empty_armory', 'event.cracked_bell', 'event.duel_masons',
  'event.disputed_standard', 'event.furnace_oath', 'event.prisoners_pass', 'event.miners_on_strike'
].sort();
assert.deepStrictEqual(library.events.map((event) => event.id).sort(), expectedIds);
assert.deepStrictEqual(
  library.events.reduce((counts, event) => ({ ...counts, [event.class]: (counts[event.class] || 0) + 1 }), {}),
  { small: 3, standard: 3, key: 1 }
);

const forbiddenOutcomeKeys = new Set(['army', 'roster', 'objectives', 'environment', 'elite', 'boss', 'bossPhase', 'enemyComposition']);
for (const event of library.events) {
  const state = createProductionEventState(library, event.id, { seed: 700 + expectedIds.indexOf(event.id), gold: 100, supplies: 10, flags: [], roster: [] });
  assert.ok(state.choices.length >= 1, `${event.id} must have at least one available default choice`);
  for (const variant of event.variants) {
    assert.ok(variant.stages.length >= 1, `${event.id}/${variant.id} has no stages`);
    for (const stage of variant.stages) {
      assert.ok(stage.choices.length >= 1, `${event.id}/${variant.id}/${stage.id} has no choices`);
      for (const choice of stage.choices) {
        const total = choice.outcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
        assert.strictEqual(total, 100, `${event.id}/${choice.id} probabilities must total 100`);
        assert.ok(choice.modifiers.length <= 3, `${event.id}/${choice.id} exceeds modifier cap`);
        assert.ok(choice.modifiers.filter((modifier) => modifier.delta > 0).length <= 2, `${event.id}/${choice.id} exceeds positive modifier cap`);
        assert.ok(choice.modifiers.filter((modifier) => modifier.delta < 0).length <= 1, `${event.id}/${choice.id} exceeds negative modifier cap`);
        for (const outcome of choice.outcomes) {
          for (const key of Object.keys(outcome)) assert.strictEqual(forbiddenOutcomeKeys.has(key), false, `${event.id}/${choice.id}/${outcome.id} illegally changes ${key}`);
          if (outcome.combat) assert.strictEqual(outcome.combat.rewardMode || 'event_only', 'event_only', `${event.id}/${choice.id} event combat must not use the standard reward trio`);
        }
      }
    }
  }
}

const poorMiners = createProductionEventState(library, 'event.miners_on_strike', { seed: 9042, gold: 0, supplies: 10, flags: [] });
assert.strictEqual(poorMiners.choices.some((choice) => choice.id === 'accept'), false, 'unaffordable authored choice must be hidden');
assert.ok(poorMiners.choices.length >= 1);

const favorableFurnace = createProductionEventState(library, 'event.furnace_oath', { seed: 8, gold: 100, supplies: 10, flags: ['story.iron_marches.strike_compromise'] });
const crisisFurnace = createProductionEventState(library, 'event.furnace_oath', { seed: 8, gold: 100, supplies: 10, flags: ['story.strike_broken'] });
const standaloneFurnace = createProductionEventState(library, 'event.furnace_oath', { seed: 8, gold: 100, supplies: 10, flags: [] });
assert.strictEqual(favorableFurnace.variantId, 'linked_favorable');
assert.strictEqual(crisisFurnace.variantId, 'linked_crisis');
assert.strictEqual(standaloneFurnace.variantId, 'standalone');

const favorablePrisoners = createProductionEventState(library, 'event.prisoners_pass', { seed: 9, gold: 100, supplies: 10, flags: ['obligation.iron_marches.standard_ratified'] });
const crisisPrisoners = createProductionEventState(library, 'event.prisoners_pass', { seed: 9, gold: 100, supplies: 10, flags: ['politics.iron_marches.garrison_divided'] });
const standalonePrisoners = createProductionEventState(library, 'event.prisoners_pass', { seed: 9, gold: 100, supplies: 10, flags: [] });
assert.strictEqual(favorablePrisoners.variantId, 'linked_favorable');
assert.strictEqual(crisisPrisoners.variantId, 'linked_crisis');
assert.strictEqual(standalonePrisoners.variantId, 'standalone');

const sessionA = createProductionEventSession({ library, eventId: 'event.miners_on_strike', context: { seed: 9042, gold: 100, supplies: 10 } });
const snapshotBefore = JSON.parse(JSON.stringify(sessionA.snapshot()));
const restoredA = restoreProductionEventSession({ library, snapshot: snapshotBefore });
assert.deepStrictEqual(restoredA.snapshot(), snapshotBefore, 'reload must preserve exact production event stage and RNG state');
const choiceId = sessionA.view().choices.find((choice) => choice.id === 'mediate').id;
assert.deepStrictEqual(sessionA.choose(choiceId), restoredA.choose(choiceId), 'reload must not reroll event outcome');

let selector = createProductionEventSelectorState(library, {
  seed: 44,
  assignments: [
    { nodeId: 'honor-start', eventId: 'event.disputed_standard', phase: 'mid', status: 'reserved' },
    { nodeId: 'bread-start', eventId: 'event.miners_on_strike', phase: 'mid', status: 'reserved' }
  ]
});
selector = completeProductionEventReservation(library, selector, 'honor-start');
selector = completeProductionEventReservation(library, selector, 'bread-start');
assert.deepStrictEqual(selector.activeChainIds.sort(), ['chain.iron_marches.honor_of_the_marches', 'chain.iron_marches.iron_and_bread'].sort());

const unfinishedNarrative = createNarrativeState();
const unfinishedFinale = buildIronMarchesFinale(unfinishedNarrative, { gold: 0 });
assert.ok(unfinishedFinale.choices.some((choice) => choice.available), 'unfinished lines must still leave a political outcome');
assert.deepStrictEqual(deriveRegionalLines(unfinishedNarrative), { iron_and_bread: 'unstarted', honor_of_the_marches: 'unstarted' });

const favorableNarrative = applyFacts(createNarrativeState(), [
  'story.iron_marches.strike_compromise',
  'politics.iron_marches.workers_support_crown',
  'obligation.iron_marches.standard_ratified',
  'politics.iron_marches.garrison_united'
], [], { source: 'closure-test', eventClass: 'key' });
const favorableFinale = buildIronMarchesFinale(favorableNarrative, { gold: 100 });
assert.ok(favorableFinale.choices.some((choice) => choice.id === 'workers_compact'));
assert.ok(favorableFinale.choices.some((choice) => choice.id === 'oath_compact'));

const crisisNarrative = applyFacts(createNarrativeState(), [
  'story.strike_broken',
  'politics.iron_marches.workers_hostile',
  'politics.iron_marches.garrison_divided'
], [], { source: 'closure-test', eventClass: 'key' });
assert.deepStrictEqual(deriveRegionalLines(crisisNarrative), { iron_and_bread: 'crisis', honor_of_the_marches: 'crisis' });
assert.ok(buildIronMarchesFinale(crisisNarrative, { gold: 0 }).choices.some((choice) => choice.available));

console.log('B12-B13 production closure: seven events, variants, hidden choices, modifier limits, event battles, no reroll, chains and political finale states passed.');
