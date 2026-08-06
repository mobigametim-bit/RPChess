'use strict';

const assert = require('assert');
const path = require('path');
const {
  loadProductionEventLibrary,
  createProductionEventState,
  resolveProductionEventChoice,
  selectProductionParticipant
} = require('../src/content/production-events.cjs');
const { buildProductionContentBundle } = require('../src/content/production-bundle.cjs');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');
const {
  createProductionEventSession,
  restoreProductionEventSession
} = require('../src/runtime/production-event-session.cjs');

const projectRoot = path.resolve(__dirname, '..');
const library = loadProductionEventLibrary(path.join(projectRoot, 'content/events/iron_marches_production.json'));

assert.strictEqual(library.events.length, 7);
assert.strictEqual(library.metaPersistence, false);
assert.deepStrictEqual(
  library.events.reduce((counts, event) => ({ ...counts, [event.class]: (counts[event.class] || 0) + 1 }), {}),
  { small: 3, standard: 3, key: 1 }
);

const bundle = buildProductionContentBundle({ projectRoot });
assert.strictEqual(bundle.productionEvents.events.length, 7);
assert.strictEqual(bundle.registry.get('event', 'event.empty_armory').choices.length, 2);
assert.strictEqual(bundle.registry.get('event', 'event.cracked_bell').choices.length, 2);
assert.strictEqual(bundle.registry.get('event', 'event.duel_masons').choices.length, 2);
assert.strictEqual(bundle.registry.get('event', 'event.disputed_standard').choices.length, 3);
assert.strictEqual(bundle.registry.get('event', 'event.furnace_oath').choices.length, 3);
assert.strictEqual(bundle.registry.get('event', 'event.prisoners_pass').choices.length, 3);
assert.strictEqual(bundle.registry.get('event', 'event.miners_on_strike').choices.length, 4);
assert.strictEqual(bundle.registry.get('event', 'event.miners_on_strike').status, 'approved');
assert.strictEqual(bundle.localization.ru[bundle.registry.get('event', 'event.empty_armory').bodyKey].includes('арсенала'), true);
assert.strictEqual(bundle.localization.en[bundle.registry.get('event', 'event.miners_on_strike').titleKey], "The Miners' Strike");
assert.strictEqual(bundle.registry.get('event', 'event.empty_armory').sceneArt, 'assets/events/register-04/empty_armory.png');

const browserBundle = buildBrowserProductionBundle();
assert.strictEqual(browserBundle.registry.list('event').length, 7);
assert.deepStrictEqual(
  browserBundle.registry.list('event').map((event) => event.id).sort(),
  library.events.map((event) => event.id).sort()
);
assert.strictEqual(browserBundle.sourceRegistry.list('event').length, 12);
assert.strictEqual(browserBundle.summary.event, 7);

const linkedFurnace = createProductionEventState(library, 'event.furnace_oath', {
  seed: 10,
  flags: ['story.iron_marches.strike_compromise'],
  gold: 100,
  supplies: 10
});
assert.strictEqual(linkedFurnace.variantId, 'linked_favorable');
const crisisFurnace = createProductionEventState(library, 'event.furnace_oath', {
  seed: 10,
  flags: ['story.strike_broken'],
  gold: 100,
  supplies: 10
});
assert.strictEqual(crisisFurnace.variantId, 'linked_crisis');

const roster = [
  { id: 'regular-1', kind: 'regular', type: 'p', available: true },
  { id: 'regular-2', kind: 'regular', type: 'r', available: true },
  { id: 'hero-1', kind: 'hero', type: 'b', available: true }
];
const participantRule = library.eventsById['event.empty_armory'].variants[0].stages[0].choices[0].participant;
const participant = selectProductionParticipant(participantRule, {
  seed: 42,
  roster,
  participatedRosterIds: ['regular-1', 'hero-1']
}, 'empty-armory');
assert.strictEqual(participant.id, 'regular-2');

const miners = createProductionEventState(library, 'event.miners_on_strike', {
  seed: 9042,
  gold: 100,
  supplies: 10,
  doctrineId: 'doctrine.fortress',
  heroIds: ['hero.lady_sorn']
});
assert.strictEqual(miners.choices.length, 4);
const negotiatedA = resolveProductionEventChoice(library, miners, 'mediate', {
  seed: 9042,
  gold: 100,
  supplies: 10,
  doctrineId: 'doctrine.fortress',
  heroIds: ['hero.lady_sorn']
});
const negotiatedB = resolveProductionEventChoice(library, miners, 'mediate', {
  seed: 9042,
  gold: 100,
  supplies: 10,
  doctrineId: 'doctrine.fortress',
  heroIds: ['hero.lady_sorn']
});
assert.deepStrictEqual(negotiatedA, negotiatedB);
assert.strictEqual(negotiatedA.status, 'active');
assert.strictEqual(negotiatedA.stageId, 'terms');
assert.strictEqual(negotiatedA.resolution.appliedModifiers.length, 2);
assert.deepStrictEqual(negotiatedA.resolution.outcome.probability, 85);

const terms = resolveProductionEventChoice(library, negotiatedA, 'open_ledgers', {
  seed: 9042,
  gold: 100,
  supplies: 10
});
assert.strictEqual(terms.stageId, 'settlement');
const settled = resolveProductionEventChoice(library, terms, 'right_to_stop', {
  seed: 9042,
  gold: 100,
  supplies: 10
});
assert.strictEqual(settled.status, 'resolved');
assert.strictEqual(settled.resolution.outcome.addFlags.includes('law.iron_marches.workers_right_to_stop'), true);
assert.strictEqual(settled.history.length, 3);

const session = createProductionEventSession({
  library,
  eventId: 'event.miners_on_strike',
  language: 'ru',
  context: {
    seed: 9042,
    gold: 100,
    supplies: 10,
    doctrineId: 'doctrine.fortress',
    heroIds: ['hero.lady_sorn']
  }
});
assert.strictEqual(session.view().choices.find((choice) => choice.id === 'mediate').probabilities[0].probability, 85);
assert.strictEqual(session.choose('mediate').stageId, 'terms');
assert.strictEqual(session.view().resources.supplies, 12);
assert.strictEqual(session.view().knownFlags.includes('story.iron_marches.strike_compromise'), true);
const restored = restoreProductionEventSession({ library, snapshot: session.snapshot() });
assert.strictEqual(restored.view().stageId, 'terms');
assert.strictEqual(restored.choose('open_ledgers').stageId, 'settlement');
const sessionResolved = restored.choose('safety_first');
assert.strictEqual(sessionResolved.status, 'resolved');
assert.strictEqual(sessionResolved.resources.gold, 80);
assert.strictEqual(sessionResolved.knownFlags.includes('control.iron_marches.mine_shared'), true);

const combatSession = createProductionEventSession({
  library,
  eventId: 'event.miners_on_strike',
  context: { seed: 500, gold: 100, supplies: 10 }
});
const combatPending = combatSession.choose('guards');
assert.strictEqual(combatPending.status, 'combat_pending');
assert.strictEqual(combatPending.pendingCombat.encounterId, 'encounter.iron_broken_formation');
assert.strictEqual(combatPending.choices.length, 0);
const combatVictory = combatSession.completeCombat('victory');
assert.strictEqual(combatVictory.status, 'active');
assert.strictEqual(combatVictory.stageId, 'terms');
assert.strictEqual(combatVictory.resolution.combatResult, 'victory');

const prisonerEvent = library.eventsById['event.prisoners_pass'];
const favorablePrisoners = prisonerEvent.variants.find((variant) => variant.id === 'linked_favorable');
const releaseCombat = favorablePrisoners.stages[0].choices.find((choice) => choice.id === 'release').outcomes[0].combat;
assert.strictEqual(releaseCombat.encounterId, 'encounter.iron_escort_through_check');
assert.strictEqual(releaseCombat.rewardMode, 'event_only');
const strikeCombat = library.eventsById['event.miners_on_strike'].variants[0].stages[0].choices.find((choice) => choice.id === 'guards').outcomes[0].combat;
assert.strictEqual(strikeCombat.dangerOffset, 1);

const emptyRuntimeEvent = {
  eventId: 'event.empty_armory',
  choices: bundle.registry.get('event', 'event.empty_armory').choices
};
const resolvedCompatibility = bundle.eventChoiceResolver({
  event: emptyRuntimeEvent,
  choice: emptyRuntimeEvent.choices[0],
  context: { seed: 9042, resources: { gold: 0, supplies: 10 }, flags: [] }
});
assert.strictEqual(Number.isInteger(resolvedCompatibility.resourceDelta.supplies), true);
assert.strictEqual(resolvedCompatibility.chronicleKeys.length > 0, true);

console.log('Iron Marches production events: seven authored events, chains, deterministic checks, sessions and combat hooks passed.');
