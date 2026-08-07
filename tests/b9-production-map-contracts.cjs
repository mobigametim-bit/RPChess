'use strict';

const assert = require('assert');
const {
  PHASE_WEIGHTS, SECRET_CONTENT_WEIGHTS,
  generateProductionActGraph, materializeLevel, secretContentType
} = require('../src/campaign/production-map.cjs');
const {
  createProductionCampaignState, availableRoutes, travelTo, reopenBranch,
  checkSecretAfterNode, decideSecret, completeNode
} = require('../src/campaign/production-map-state.cjs');

function pools(size = 80) {
  const list = (prefix) => Array.from({ length: size }, (_unused, index) => `${prefix}.${index + 1}`);
  return {
    encounters: list('encounter'), events: list('event'), bosses: ['boss.iron_regent'],
    services: list('service'), shop: list('shop'), hospital: list('hospital'), forge: list('forge'), camp: list('camp')
  };
}

// The Roadmap requires at least 10,000 deterministic seeds for distribution reporting.
const samples = 10000;
const phaseCounts = Object.fromEntries(['early', 'mid', 'late'].map((phase) => [phase, { battle: 0, event: 0, service: 0 }]));
const serviceCounts = { shop: 0, hospital: 0, forge: 0, camp: 0 };
let secretDiscoveries = 0;
for (let seed = 1; seed <= samples; seed += 1) {
  const graph = generateProductionActGraph({ rootSeed: seed });
  for (const node of graph.nodes) {
    if (['start', 'elite', 'boss'].includes(node.type) || (node.layer === 1 && node.index === 0)) continue;
    phaseCounts[node.phase][node.category] += 1;
    if (Object.prototype.hasOwnProperty.call(serviceCounts, node.type)) serviceCounts[node.type] += 1;
  }
  const sourceNodeId = Object.keys(graph.secretChecks).sort()[0];
  if (sourceNodeId) {
    let checked = createProductionCampaignState(graph, { supplies: 20, contentPools: pools() });
    checked = completeNode(checked, sourceNodeId, { rewardClaimed: false });
    checked = checkSecretAfterNode(checked, sourceNodeId);
    if (checked.secret.pendingDecision) secretDiscoveries += 1;
  }
}
for (const phase of ['early', 'mid', 'late']) {
  const total = Object.values(phaseCounts[phase]).reduce((sum, value) => sum + value, 0);
  for (const [category, expected] of Object.entries(PHASE_WEIGHTS[phase])) {
    const actual = phaseCounts[phase][category] / total * 100;
    assert.ok(Math.abs(actual - expected) < 2.5, `${phase}.${category}: ${actual.toFixed(2)}% differs from ${expected}%`);
  }
}
const serviceTotal = Object.values(serviceCounts).reduce((sum, value) => sum + value, 0);
for (const [service, value] of Object.entries(serviceCounts)) {
  const actual = value / serviceTotal * 100;
  assert.ok(Math.abs(actual - 25) < 2.5, `${service}: ${actual.toFixed(2)}% differs from 25%`);
}
const secretDiscoveryRate = secretDiscoveries / samples * 100;
assert.ok(Math.abs(secretDiscoveryRate - 10) < 1.5, `secret discovery rate ${secretDiscoveryRate.toFixed(2)}% differs from 10%`);

const secretCounts = Object.fromEntries(SECRET_CONTENT_WEIGHTS.map((entry) => [entry.value, 0]));
for (let seed = 1; seed <= samples; seed += 1) secretCounts[secretContentType(seed)] += 1;
for (const entry of SECRET_CONTENT_WEIGHTS) {
  const actual = secretCounts[entry.value] / samples * 100;
  assert.ok(Math.abs(actual - entry.weight) < 2.2, `secret.${entry.value}: ${actual.toFixed(2)}% differs from ${entry.weight}%`);
}

const graph = generateProductionActGraph({ rootSeed: 918273 });
let selectorCalls = 0;
function selectEvent({ node, selectorState, excludedEventIds }) {
  selectorCalls += 1;
  const revision = Number(selectorState?.revision || 0) + 1;
  const candidates = pools().events.filter((eventId) => !excludedEventIds.includes(eventId));
  return { eventId: candidates[node.contentSeed % candidates.length], selectorState: { revision, lastNodeId: node.id } };
}
let state = createProductionCampaignState(graph, { supplies: 30, contentPools: pools(), selectEvent });
const initialMaterialization = JSON.parse(JSON.stringify(state.materializedContentByNode));
const firstRoutes = availableRoutes(state);
assert.ok(firstRoutes.length >= 2);
const chosen = firstRoutes[0];
const closedTarget = firstRoutes.find((route) => route.to !== chosen.to && graph.edgesById[route.edgeId].reopenable)?.to;
assert.ok(closedTarget, 'the template must expose an authored rare-reopen position');
state = travelTo(state, chosen.to, { selectEvent });
assert.ok(state.closedNodeIds.includes(closedTarget));
assert.deepStrictEqual(state.materializedContentByNode[closedTarget], initialMaterialization[closedTarget]);

state = reopenBranch(state, closedTarget, { onBranchReopened: ({ state: selectorState }) => ({ selectorState }) });
const rare = availableRoutes(state).find((route) => route.rare && route.to === closedTarget);
assert.ok(rare, 'reopened branch must create a concrete route from the current node');
assert.strictEqual(rare.cost, 1);
const preserved = state.materializedContentByNode[closedTarget];
const beforeRareSupplies = state.supplies;
state = travelTo(state, closedTarget, { selectEvent });
assert.strictEqual(state.supplies, beforeRareSupplies - 1);
assert.strictEqual(state.rareRoute.status, 'used');
assert.deepStrictEqual(state.materializedContentByNode[closedTarget], preserved);
state = completeNode(state, closedTarget);
assert.throws(() => reopenBranch({ ...state, closedNodeIds: [...state.closedNodeIds, closedTarget] }, closedTarget), /completed nodes/);

// A closed branch is reopenable only where the selected macro-template explicitly allowed it.
let nonAuthoredState = createProductionCampaignState(graph, { supplies: 30, contentPools: pools() });
const nonAuthoredRoutes = availableRoutes(nonAuthoredState);
const nonAuthoredTarget = nonAuthoredRoutes.find((route) => !graph.edgesById[route.edgeId].reopenable)?.to;
const alternative = nonAuthoredRoutes.find((route) => route.to !== nonAuthoredTarget)?.to;
assert.ok(nonAuthoredTarget && alternative);
nonAuthoredState = travelTo(nonAuthoredState, alternative);
assert.strictEqual(nonAuthoredState.closedBranchRecordsByNode[nonAuthoredTarget].reopenable, false);
assert.throws(() => reopenBranch(nonAuthoredState, nonAuthoredTarget), /not an authored rare-reopen position/);

// Materialization is stable across action order, and selector state is stored with the campaign.
const levelFromChosenA = materializeLevel(graph, chosen.to, initialMaterialization, { contentPools: pools(), selectEvent, selectorState: { revision: 0 } });
const levelFromChosenB = materializeLevel(graph, chosen.to, initialMaterialization, { contentPools: pools(), selectEvent, selectorState: { revision: 0 }, army: { wounds: 99, gold: 0 } });
assert.deepStrictEqual(levelFromChosenA.materializedByNode, levelFromChosenB.materializedByNode);
assert.deepStrictEqual(levelFromChosenA.selectorState, levelFromChosenB.selectorState);

// Exact scenario/event IDs may not repeat on adjacent visited nodes of the same category.
for (let seed = 1; seed <= 250; seed += 1) {
  let routeState = createProductionCampaignState(generateProductionActGraph({ rootSeed: seed }), { supplies: 20, contentPools: pools(4) });
  let previous = null;
  while (routeState.currentNodeId !== routeState.graph.bossNodeId) {
    const routes = availableRoutes(routeState);
    const route = routes[seed % routes.length];
    routeState = travelTo(routeState, route.to);
    const node = routeState.graph.nodesById[routeState.currentNodeId];
    const content = routeState.materializedContentByNode[node.id];
    if (previous && previous.category === node.category && ['battle', 'event'].includes(node.category)) {
      assert.notStrictEqual(content.contentId, previous.contentId, `seed ${seed} repeated ${content.contentId} on adjacent nodes`);
    }
    previous = { category: node.category, contentId: content?.contentId || null };
  }
}

// Declining a discovered secret is permanent for the act.
let secretState = null;
for (let seed = 1; seed <= samples && !secretState; seed += 1) {
  const candidateGraph = generateProductionActGraph({ rootSeed: seed });
  let candidate = createProductionCampaignState(candidateGraph, { supplies: 20, contentPools: pools() });
  for (const nodeId of Object.keys(candidateGraph.secretChecks)) {
    if (!candidate.completedNodeIds.includes(nodeId)) candidate = completeNode(candidate, nodeId, { rewardClaimed: false });
    candidate = checkSecretAfterNode(candidate, nodeId);
    if (candidate.secret.pendingDecision) {
      secretState = candidate;
      break;
    }
  }
}
assert.ok(secretState);
const discoveredId = secretState.secret.discovered.id;
secretState = decideSecret(secretState, 'decline');
assert.strictEqual(secretState.secret.declined, true);
for (const nodeId of Object.keys(secretState.graph.secretChecks)) secretState = checkSecretAfterNode(secretState, nodeId);
assert.strictEqual(secretState.secret.discovered.id, discoveredId);
assert.strictEqual(secretState.secret.pendingDecision, null);

// Every route, including the boss route, costs exactly one supply and reaching the boss changes campaign status.
let bossState = createProductionCampaignState(generateProductionActGraph({ rootSeed: 24680 }), { supplies: 20, contentPools: pools() });
while (bossState.currentNodeId !== bossState.graph.bossNodeId) {
  const route = availableRoutes(bossState)[0];
  assert.ok(route, `no route from ${bossState.currentNodeId}`);
  assert.strictEqual(route.cost, 1);
  bossState = travelTo(bossState, route.to);
}
assert.strictEqual(bossState.status, 'boss_reached');
assert.strictEqual(bossState.supplies, 10);

console.log(JSON.stringify({ phaseCounts, serviceCounts, secretDiscoveries, secretDiscoveryRate, secretCounts, selectorCalls }, null, 2));
console.log('B9 production map contracts: 10,000-seed distributions, services, completed-node secret discovery/pool, authored rare routes, adjacent repeats, selector state and boss route passed.');
