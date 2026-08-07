'use strict';

const assert = require('assert');
const eventSource = require('../content/events/iron_marches_production.json');
const { validateProductionEventLibrary } = require('../src/content/production-events.cjs');
const {
  createProductionEventSelectorState,
  selectorAssignment
} = require('../src/campaign/production-event-selector.cjs');
const { createProductionEventMaterializationCallbacks } = require('../src/campaign/production-event-b9-adapter.cjs');
const { generateProductionActGraph } = require('../src/campaign/production-map.cjs');
const {
  createProductionCampaignState,
  migrateProductionCampaignState,
  availableRoutes,
  travelTo,
  completeNode,
  reopenBranch
} = require('../src/campaign/production-map-state.cjs');

const library = validateProductionEventLibrary(eventSource);
const productionIds = new Set(library.events.map((event) => event.id));
const callbacks = createProductionEventMaterializationCallbacks(library);

function pools() {
  return {
    encounters: Array.from({ length: 20 }, (_unused, index) => `encounter.${index + 1}`),
    events: [...productionIds],
    bosses: ['boss.iron_regent'],
    services: ['service.iron'],
    shop: ['shop.iron'],
    hospital: ['hospital.iron'],
    forge: ['forge.iron'],
    camp: ['camp.iron']
  };
}

function stateFor(seed) {
  const graph = generateProductionActGraph({ rootSeed: seed, regionId: 'region.iron_marches' });
  return createProductionCampaignState(graph, {
    supplies: 20,
    contentPools: pools(),
    ...callbacks
  });
}

const emptySelector = createProductionEventSelectorState(library, { seed: 7 });
assert.strictEqual(emptySelector.format, 'rpchess-production-event-selector');
assert.strictEqual(emptySelector.schemaVersion, 2);

let siblingFixture = null;
let reopenFixture = null;
for (let seed = 1; seed <= 5000 && (!siblingFixture || !reopenFixture); seed += 1) {
  const state = stateFor(seed);
  const routes = availableRoutes(state);
  const eventRoutes = routes.filter((route) => state.graph.nodesById[route.to].type === 'event');
  if (!siblingFixture && eventRoutes.length >= 2) siblingFixture = { seed, state, eventRoutes };
  if (!reopenFixture) {
    const reopenableEvent = eventRoutes.find((route) => state.graph.edgesById[route.edgeId].reopenable);
    const alternative = routes.find((route) => route.to !== reopenableEvent?.to);
    if (reopenableEvent && alternative) reopenFixture = { seed, state, reopenableEvent, alternative };
  }
}

assert.ok(siblingFixture, 'a deterministic seed must expose two sibling event nodes');
const siblingEntries = siblingFixture.eventRoutes.map((route) => siblingFixture.state.materializedContentByNode[route.to]);
assert.strictEqual(new Set(siblingEntries.map((entry) => entry.contentId)).size, siblingEntries.length, 'sibling production events must be distinct');
for (const entry of siblingEntries) {
  assert.ok(productionIds.has(entry.contentId));
  assert.strictEqual(entry.contentVersion, 1);
  assert.ok(entry.details.variantId);
  assert.ok(entry.details.snapshot);
  assert.ok(Array.isArray(entry.details.snapshot.choiceProbabilities));
  assert.ok(selectorAssignment(siblingFixture.state.selectorState, entry.nodeId));
}

const reloadState = siblingFixture.state;
const reloaded = migrateProductionCampaignState(JSON.parse(JSON.stringify(reloadState)));
const travelTarget = availableRoutes(reloadState)[0].to;
const direct = travelTo(reloadState, travelTarget, callbacks);
const afterReload = travelTo(reloaded, travelTarget, callbacks);
assert.deepStrictEqual(afterReload.materializedContentByNode, direct.materializedContentByNode, 'reload must preserve future production event materialization');
assert.deepStrictEqual(afterReload.selectorState, direct.selectorState, 'reload must preserve selector state and future reservations');

assert.ok(reopenFixture, 'a deterministic seed must expose an authored reopenable event branch');
const originalContent = reopenFixture.state.materializedContentByNode[reopenFixture.reopenableEvent.to];
let branched = travelTo(reopenFixture.state, reopenFixture.alternative.to, callbacks);
assert.ok(branched.closedNodeIds.includes(reopenFixture.reopenableEvent.to));
assert.strictEqual(selectorAssignment(branched.selectorState, reopenFixture.reopenableEvent.to).status, 'available');
branched = reopenBranch(branched, reopenFixture.reopenableEvent.to, callbacks);
assert.strictEqual(selectorAssignment(branched.selectorState, reopenFixture.reopenableEvent.to).status, 'reserved');
assert.deepStrictEqual(branched.materializedContentByNode[reopenFixture.reopenableEvent.to], originalContent, 'rare reopening must restore the exact original event materialization');
assert.ok(availableRoutes(branched).some((route) => route.rare && route.to === reopenFixture.reopenableEvent.to));

let completion = stateFor(siblingFixture.seed);
const completedEventNodeId = availableRoutes(completion).find((route) => completion.graph.nodesById[route.to].type === 'event').to;
const completedEventId = completion.materializedContentByNode[completedEventNodeId].contentId;
completion = completeNode(completion, completedEventNodeId, callbacks);
assert.strictEqual(selectorAssignment(completion.selectorState, completedEventNodeId).status, 'completed');
assert.ok(completion.selectorState.completedEventIds.includes(completedEventId));

console.log(`B9 production event integration: sibling reservations, snapshots, reload, branch available/reopen and completion passed (seeds ${siblingFixture.seed}/${reopenFixture.seed}).`);
