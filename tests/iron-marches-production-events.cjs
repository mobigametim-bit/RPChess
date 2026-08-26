const assert = require('assert');
const path = require('path');
const {
  loadProductionEventLibrary,
  createProductionEventState,
  resolveProductionEventChoice,
  selectProductionParticipant
} = require('../src/content/production-events.cjs');
const {
  assertProductionEventPolicy,
  productionEventPolicyReport
} = require('../src/content/production-event-policy.cjs');
const { buildProductionContentBundle } = require('../src/content/production-bundle.cjs');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');
const {
  createProductionEventSession,
  restoreProductionEventSession
} = require('../src/runtime/production-event-session.cjs');
const {
  createProductionEventSelectorState,
  eventWeight,
  reserveProductionEvents,
  releaseProductionEventReservations,
  reopenProductionEventReservation,
  completeProductionEventReservation,
  canonicalChainId
} = require('../src/campaign/production-event-selector.cjs');

const projectRoot = path.resolve(__dirname, '..');
const library = loadProductionEventLibrary(path.join(projectRoot, 'content/events/iron_marches_production.json'));

assert.strictEqual(assertProductionEventPolicy(library), library);
const policyReport = productionEventPolicyReport(library);
assert.deepStrictEqual(policyReport, {
  ok: true,
  eventCount: 7,
  combatChoices: 3,
  probabilisticChoices: 9,
  permanentChoices: 0,
  chainCount: 2,
  metaPersistence: false
});
assert.strictEqual(library.events.length, 7);
assert.strictEqual(library.metaPersistence, false);
assert.deepStrictEqual(
  library.events.reduce((counts, event) => ({ ...counts, [event.class]: (counts[event.class] || 0) + 1 }), {}),
  { small: 3, standard: 3, key: 1 }
);

const bundle = buildProductionContentBundle({ projectRoot });
assert.strictEqual(bundle.productionEvents.events.length, 7);
assert.deepStrictEqual(bundle.eventPolicyReport, policyReport);
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
assert.deepStrictEqual(browserBundle.eventPolicyReport, policyReport);
assert.deepStrictEqual(
  browserBundle.registry.list('event').map((event) => event.id).sort(),
  library.events.map((event) => event.id).sort()
);
assert.strictEqual(browserBundle.sourceRegistry.list('event').length, 12);
assert.strictEqual(browserBundle.summary.event, 7);

console.log('DISPUTED_CHAIN_DEBUG', JSON.stringify(library.eventsById['event.disputed_standard'].chain));
console.log('PRISONERS_CHAIN_DEBUG', JSON.stringify(library.eventsById['event.prisoners_pass'].chain));

const selectorStart = createProductionEventSelectorState(library, { seed: 8123 });
assert.strictEqual(selectorStart.schemaVersion, 2);
const reservedBatch = reserveProductionEvents(library, selectorStart, [
  { nodeId: 'l2_n1', phase: 'early' },
  { nodeId: 'l2_n2', phase: 'early' }
]);
assert.strictEqual(reservedBatch.assignments.length, 2);
assert.notStrictEqual(reservedBatch.assignments[0].eventId, reservedBatch.assignments[1].eventId);
assert.strictEqual(reservedBatch.state.assignments.every((entry) => entry.status === 'reserved'), true);
const released = releaseProductionEventReservations(library, reservedBatch.state, ['l2_n2']);
assert.strictEqual(released.assignments.find((entry) => entry.nodeId === 'l2_n2').status, 'available');
const reopened = reopenProductionEventReservation(library, released, 'l2_n2');
assert.strictEqual(reopened.assignments.find((entry) => entry.nodeId === 'l2_n2').status, 'reserved');
const completedFirst = completeProductionEventReservation(library, reopened, 'l2_n1');
assert.strictEqual(completedFirst.completedEventIds.includes(reservedBatch.assignments[0].eventId), true);

const legacySelector = createProductionEventSelectorState(library, {
  seed: 91,
  assignments: [{ nodeId: 'legacy', eventId: 'event.empty_armory', phase: 'early', status: 'released' }],
  activeChainIds: ['chain.iron_marches.honor']
});
assert.strictEqual(legacySelector.assignments[0].status, 'available');
assert.strictEqual(legacySelector.activeChainIds[0], 'chain.iron_marches.honor_of_the_marches');
assert.strictEqual(canonicalChainId('chain.iron_marches.honor'), 'chain.iron_marches.honor_of_the_marches');

const strikeReserved = createProductionEventSelectorState(library, {
  seed: 44,
  assignments: [{ nodeId: 'strike_node', eventId: 'event.miners_on_strike', phase: 'mid', status: 'reserved' }]
});
const strikeCompleted = completeProductionEventReservation(library, strikeReserved, 'strike_node');
assert.strictEqual(strikeCompleted.activeChainIds.includes('chain.iron_marches.iron_and_bread'), true);
const furnace = library.eventsById['event.furnace_oath'];
assert.strictEqual(eventWeight(furnace, 'mid', new Set()), 3);
assert.strictEqual(eventWeight(furnace, 'mid', new Set(strikeCompleted.activeChainIds)), 6);

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
