'use strict';

const assert = require('assert');
const {
  GENERATOR_VERSION, MACRO_TEMPLATES, PHASE_WEIGHTS, DANGER_RANGES,
  generateProductionActGraph, validateProductionActGraph, materializeLevel, generationAnalytics
} = require('../src/campaign/production-map.cjs');
const {
  createProductionCampaignState, migrateProductionCampaignState,
  availableRoutes, travelTo, travelRequirement, scoutingCost, scoutNode,
  completeNode, reopenBranch, checkSecretAfterNode, decideSecret, completeSecret
} = require('../src/campaign/production-map-state.cjs');

function pools(size = 40) {
  const list = (prefix) => Array.from({ length: size }, (_unused, index) => `${prefix}.${index + 1}`);
  return {
    encounters: list('encounter'),
    events: list('event'),
    bosses: ['boss.iron_regent'],
    services: list('service'),
    shop: list('shop'),
    hospital: list('hospital'),
    forge: list('forge'),
    camp: list('camp')
  };
}

assert.strictEqual(MACRO_TEMPLATES.length, 6);
assert.deepStrictEqual(PHASE_WEIGHTS.early, { battle: 60, event: 25, service: 15 });
assert.deepStrictEqual(PHASE_WEIGHTS.mid, { battle: 50, event: 30, service: 20 });
assert.deepStrictEqual(PHASE_WEIGHTS.late, { battle: 45, event: 35, service: 20 });

const generated = [];
let unsmoothedHeavyPairFound = false;
for (let seed = 1; seed <= 1000; seed += 1) {
  const graph = generateProductionActGraph({ rootSeed: seed, act: 1, regionId: 'region.iron_marches' });
  generated.push(graph);
  const report = validateProductionActGraph(graph);
  assert.strictEqual(report.ok, true, `seed ${seed}: ${report.errors.join('; ')}`);
  assert.strictEqual(graph.generatorVersion, GENERATOR_VERSION);
  assert.ok(graph.nodes.length >= 18 && graph.nodes.length <= 24);
  assert.ok(report.routeLengths.minimum >= 9 && report.routeLengths.maximum <= 11);
  assert.strictEqual(graph.edges.every((edge) => edge.cost === 1), true);
  assert.strictEqual(graph.nodes.every((node) => node.contentId === null && node.materialized === false), true);
  for (const node of graph.nodes) {
    if (node.type === 'start') continue;
    const range = node.type === 'elite' ? DANGER_RANGES.elite : node.type === 'boss' ? DANGER_RANGES.boss : DANGER_RANGES[node.phase];
    assert.ok(node.danger >= range[0] && node.danger <= range[1], `${node.id} danger ${node.danger} outside ${range.join('-')}`);
  }
  if (!unsmoothedHeavyPairFound) {
    unsmoothedHeavyPairFound = graph.edges.some((edge) => {
      const from = graph.nodesById[edge.from];
      const to = graph.nodesById[edge.to];
      if (!from || !to || !['battle', 'elite'].includes(from.type) || !['battle', 'elite'].includes(to.type)) return false;
      const fromMax = from.type === 'elite' ? DANGER_RANGES.elite[1] : DANGER_RANGES[from.phase][1];
      const toMax = to.type === 'elite' ? DANGER_RANGES.elite[1] : DANGER_RANGES[to.phase][1];
      return from.danger === fromMax && to.danger === toMax;
    });
  }
}
assert.strictEqual(unsmoothedHeavyPairFound, true, 'generator must permit consecutive maximum-danger battles');
const normalAnalytics = generationAnalytics(generated);
assert.strictEqual(normalAnalytics.graphCount, 1000);
assert.strictEqual(normalAnalytics.fallbackCount, 0);
assert.ok(normalAnalytics.averageAttempts >= 1);

for (const template of MACRO_TEMPLATES) {
  let normal = null;
  let mirrored = null;
  for (let seed = 1; seed < 10000 && (!normal || !mirrored); seed += 1) {
    const graph = generateProductionActGraph({ rootSeed: seed });
    if (graph.macroTemplateId !== template.id) continue;
    if (graph.isMirrored) mirrored = graph;
    else normal = graph;
  }
  assert.ok(normal, `${template.id} normal variant was not generated`);
  assert.ok(mirrored, `${template.id} mirrored variant was not generated`);
  assert.strictEqual(validateProductionActGraph(normal).ok, true);
  assert.strictEqual(validateProductionActGraph(mirrored).ok, true);
}

const deterministicA = generateProductionActGraph({ rootSeed: 9042 });
const deterministicB = generateProductionActGraph({ rootSeed: 9042 });
assert.deepStrictEqual(deterministicA, deterministicB);
const fallback = generateProductionActGraph({
  rootSeed: 77,
  validateCandidate: () => ({ ok: false, errors: ['forced rejection'] })
});
assert.strictEqual(fallback.fallbackUsed, true);
assert.strictEqual(fallback.macroTemplateId, 'reserve_bastion');
assert.strictEqual(fallback.generationLog.length, 10);
assert.strictEqual(validateProductionActGraph(fallback).ok, true);
assert.deepStrictEqual(generationAnalytics([fallback]), {
  graphCount: 1,
  fallbackCount: 1,
  fallbackRate: 1,
  averageAttempts: 10,
  retryCount: 9
});

const levelA = materializeLevel(deterministicA, 'start', {}, {
  contentPools: pools(),
  participantIds: ['hero.a', 'hero.b']
});
const levelB = materializeLevel(deterministicA, 'start', {}, {
  contentPools: pools(),
  participantIds: ['hero.a', 'hero.b'],
  army: { gold: 999, wounds: 10, relics: ['x'] }
});
assert.deepStrictEqual(levelA, levelB, 'army state must not influence materialization');
assert.deepStrictEqual(
  materializeLevel(deterministicA, 'start', levelA.materializedByNode, { contentPools: pools() }).materializedByNode,
  levelA.materializedByNode,
  'opened nodes must never regenerate'
);
const initialEvents = Object.values(levelA.materializedByNode).filter((entry) => entry.type === 'event');
assert.strictEqual(new Set(initialEvents.map((entry) => entry.contentId)).size, initialEvents.length);

let scoutState = createProductionCampaignState(deterministicA, { supplies: 10, contentPools: pools() });
const scoutRoutes = availableRoutes(scoutState);
assert.ok(scoutRoutes.length >= 2);
assert.strictEqual(scoutingCost(scoutState, scoutRoutes[0].to), 1);
scoutState = scoutNode(scoutState, scoutRoutes[0].to);
assert.strictEqual(scoutState.supplies, 9);
assert.strictEqual(scoutingCost(scoutState, scoutRoutes[1].to), 2);
scoutState = scoutNode(scoutState, scoutRoutes[1].to);
assert.strictEqual(scoutState.supplies, 7);
if (scoutRoutes[2]) {
  assert.strictEqual(scoutingCost(scoutState, scoutRoutes[2].to), null);
  assert.throws(() => scoutNode(scoutState, scoutRoutes[2].to), /third scouting attempt/);
}

let branchState = createProductionCampaignState(deterministicA, { supplies: 10, gold: 50, contentPools: pools() });
const firstRoutes = availableRoutes(branchState);
const chosenRoute = firstRoutes.find((route) => !deterministicA.edgesById[route.edgeId].reopenable) || firstRoutes[0];
const reopenableRoute = firstRoutes.find((route) => route.to !== chosenRoute.to && deterministicA.edgesById[route.edgeId].reopenable);
assert.ok(reopenableRoute, 'initial fork must contain an authored reopenable position');
const savedClosedContent = branchState.materializedContentByNode[reopenableRoute.to];
branchState = travelTo(branchState, chosenRoute.to);
assert.ok(branchState.closedNodeIds.includes(reopenableRoute.to));
assert.deepStrictEqual(branchState.materializedContentByNode[reopenableRoute.to], savedClosedContent);
branchState = reopenBranch(branchState, reopenableRoute.to);
const rareRoute = availableRoutes(branchState).find((route) => route.rare && route.to === reopenableRoute.to);
assert.ok(rareRoute);
const suppliesBeforeRare = branchState.supplies;
branchState = travelTo(branchState, reopenableRoute.to);
assert.strictEqual(branchState.supplies, suppliesBeforeRare - 1);
assert.strictEqual(branchState.rareRoute.status, 'used');
assert.deepStrictEqual(branchState.materializedContentByNode[reopenableRoute.to], savedClosedContent);

let forcedState = createProductionCampaignState(generateProductionActGraph({ rootSeed: 1881 }), {
  supplies: 0,
  gold: 50,
  contentPools: pools()
});
let forcedTarget = availableRoutes(forcedState)[0].to;
assert.strictEqual(travelRequirement(forcedState, forcedTarget).mode, 'forced_march');
assert.throws(() => travelTo(forcedState, forcedTarget), /consequence/);
forcedState = travelTo(forcedState, forcedTarget, { forcedMarchChoice: 'next_battle_penalty' });
assert.strictEqual(forcedState.forcedMarch.consecutiveCount, 1);
assert.strictEqual(forcedState.temporaryPenalties.nextBattle, 1);
forcedTarget = availableRoutes(forcedState)[0].to;
forcedState = travelTo(forcedState, forcedTarget, { forcedMarchChoice: 'next_battle_penalty' });
assert.strictEqual(forcedState.forcedMarch.consecutiveCount, 2);
assert.strictEqual(forcedState.temporaryPenalties.nextBattle, 3, 'second consecutive forced march must escalate');
const paidState = createProductionCampaignState(generateProductionActGraph({ rootSeed: 1882 }), { supplies: 1, contentPools: pools() });
assert.throws(
  () => travelTo(paidState, availableRoutes(paidState)[0].to, { forcedMarchChoice: 'gold_loss' }),
  /voluntary forced march/
);

const completedId = forcedState.currentNodeId;
forcedState = completeNode(forcedState, completedId);
assert.throws(() => completeNode(forcedState, completedId), /already completed/);

let foundState = null;
for (let seed = 1; seed <= 1000 && !foundState; seed += 1) {
  const graph = generateProductionActGraph({ rootSeed: seed });
  let candidate = createProductionCampaignState(graph, { supplies: 10, contentPools: pools() });
  for (const node of graph.nodes.filter((entry) => graph.secretChecks[entry.id])) {
    const completed = completeNode(candidate, node.id, { rewardClaimed: false });
    candidate = checkSecretAfterNode(completed, node.id);
    if (candidate.secret.pendingDecision) {
      foundState = candidate;
      break;
    }
  }
}
assert.ok(foundState, 'at least one deterministic seed should discover a secret node after completion');
const beforeSecretNode = foundState.currentNodeId;
const beforeSecretSupplies = foundState.supplies;
foundState = decideSecret(foundState, 'enter');
assert.strictEqual(foundState.supplies, beforeSecretSupplies - 1);
assert.ok(foundState.secret.active);
foundState = completeSecret(foundState);
assert.strictEqual(foundState.currentNodeId, beforeSecretNode);
assert.strictEqual(foundState.secret.completed, true);
assert.strictEqual(checkSecretAfterNode(foundState, beforeSecretNode), foundState, 'only one secret may be opened per act');

const incompleteSecretGraph = generateProductionActGraph({ rootSeed: 12 });
const incompleteSecretState = createProductionCampaignState(incompleteSecretGraph, { supplies: 10, contentPools: pools() });
const incompleteSource = Object.keys(incompleteSecretGraph.secretChecks)[0];
assert.strictEqual(checkSecretAfterNode(incompleteSecretState, incompleteSource), incompleteSecretState, 'secret check must not run before node completion');

const legacyGraph = {
  seed: 5,
  nodes: [
    { id: 'start', type: 'start', layer: 0, contentId: null },
    { id: 'x', type: 'event', layer: 1, contentId: 'event.legacy' }
  ],
  nodesById: { start: { id: 'start', layer: 0 }, x: { id: 'x', layer: 1 } }
};
const migrated = migrateProductionCampaignState({
  format: 'rpchess-campaign-state',
  schemaVersion: 2,
  graph: legacyGraph,
  currentNodeId: 'x',
  supplies: 3,
  visibility: { start: 3, x: 3 },
  visitedNodeIds: ['start', 'x'],
  traversedEdgeIds: [],
  closedNodeIds: [],
  history: []
});
assert.strictEqual(migrated.schemaVersion, 3);
assert.strictEqual(migrated.materializedContentByNode.x.contentId, 'event.legacy');
assert.strictEqual(migrated.macroTemplateId, 'legacy_preserved');

const beforeReload = createProductionCampaignState(deterministicA, { supplies: 10, contentPools: pools() });
const afterReload = migrateProductionCampaignState(JSON.parse(JSON.stringify(beforeReload)));
assert.deepStrictEqual(afterReload.materializedContentByNode, beforeReload.materializedContentByNode);
const reloadTarget = availableRoutes(beforeReload)[0].to;
const directTravel = travelTo(beforeReload, reloadTarget);
const reloadedTravel = travelTo(afterReload, reloadTarget);
assert.deepStrictEqual(reloadedTravel.materializedContentByNode, directTravel.materializedContentByNode, 'reload must not alter future level materialization');
assert.deepStrictEqual(reloadedTravel.selectorState, directTravel.selectorState);

console.log('B9 production map: templates, danger bands without smoothing, deterministic topology, retries, reserve map, level materialization, save migration/reload, scouting, forced march, authored reopening and completed-node secrets passed.');
