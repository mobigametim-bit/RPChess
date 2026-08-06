'use strict';

const assert = require('assert');
const {
  GENERATOR_VERSION, MACRO_TEMPLATES, PHASE_WEIGHTS,
  generateProductionActGraph, validateProductionActGraph, materializeLevel, generationAnalytics
} = require('../src/campaign/production-map.cjs');
const {
  createProductionCampaignState, migrateProductionCampaignState,
  availableRoutes, travelTo, travelRequirement, scoutingCost, scoutNode,
  completeNode, reopenBranch, checkSecretAfterNode, decideSecret, completeSecret
} = require('../src/campaign/production-map-state.cjs');

function pools(size = 40) {
  const list = (prefix) => Array.from({ length: size }, (_unused, index) => `${prefix}.${index + 1}`);
  return { encounters: list('encounter'), events: list('event'), bosses: ['boss.iron_regent'], services: list('service'), shop: list('shop'), hospital: list('hospital'), forge: list('forge'), camp: list('camp') };
}

assert.strictEqual(MACRO_TEMPLATES.length, 6);
assert.deepStrictEqual(PHASE_WEIGHTS.early, { battle: 60, event: 25, service: 15 });
assert.deepStrictEqual(PHASE_WEIGHTS.mid, { battle: 50, event: 30, service: 20 });
assert.deepStrictEqual(PHASE_WEIGHTS.late, { battle: 45, event: 35, service: 20 });

const generated = [];
for (let seed = 1; seed <= 1000; seed += 1) {
  const graph = generateProductionActGraph({ rootSeed: seed, act: 1, regionId: 'region.iron_marches' });
  generated.push(graph);
  const report = validateProductionActGraph(graph);
  assert.strictEqual(report.ok, true, `seed ${seed}: ${report.errors.join('; ')}`);
  assert.strictEqual(graph.generatorVersion, GENERATOR_VERSION);
  assert.ok(graph.nodes.length >= 18 && graph.nodes.length <= 24);
  assert.ok(graph.routeNodeCount >= 9 && graph.routeNodeCount <= 11);
  assert.strictEqual(graph.edges.every((edge) => edge.cost === 1), true);
  assert.strictEqual(graph.nodes.every((node) => node.contentId === null && node.materialized === false), true);
}
const normalAnalytics = generationAnalytics(generated);
assert.strictEqual(normalAnalytics.graphCount, 1000);
assert.strictEqual(normalAnalytics.fallbackCount, 0);
assert.ok(normalAnalytics.averageAttempts >= 1);

for (const template of MACRO_TEMPLATES) {
  let normal = null; let mirrored = null;
  for (let seed = 1; seed < 10000 && (!normal || !mirrored); seed += 1) {
    const graph = generateProductionActGraph({ rootSeed: seed });
    if (graph.macroTemplateId !== template.id) continue;
    if (graph.isMirrored) mirrored = graph; else normal = graph;
  }
  assert.ok(normal, `${template.id} normal variant was not generated`);
  assert.ok(mirrored, `${template.id} mirrored variant was not generated`);
  assert.strictEqual(validateProductionActGraph(normal).ok, true);
  assert.strictEqual(validateProductionActGraph(mirrored).ok, true);
}

const deterministicA = generateProductionActGraph({ rootSeed: 9042 });
const deterministicB = generateProductionActGraph({ rootSeed: 9042 });
assert.deepStrictEqual(deterministicA, deterministicB);
const fallback = generateProductionActGraph({ rootSeed: 77, validateCandidate: () => ({ ok: false, errors: ['forced rejection'] }) });
assert.strictEqual(fallback.fallbackUsed, true);
assert.strictEqual(fallback.macroTemplateId, 'reserve_bastion');
assert.strictEqual(fallback.generationLog.length, 10);
assert.strictEqual(validateProductionActGraph(fallback).ok, true);
assert.deepStrictEqual(generationAnalytics([fallback]), { graphCount: 1, fallbackCount: 1, fallbackRate: 1, averageAttempts: 10, retryCount: 9 });

const levelA = materializeLevel(deterministicA, 'start', {}, { contentPools: pools(), participantIds: ['hero.a', 'hero.b'] });
const levelB = materializeLevel(deterministicA, 'start', {}, { contentPools: pools(), participantIds: ['hero.a', 'hero.b'], army: { gold: 999, wounds: 10, relics: ['x'] } });
assert.deepStrictEqual(levelA, levelB, 'army state must not influence materialization');
assert.deepStrictEqual(materializeLevel(deterministicA, 'start', levelA.materializedByNode, { contentPools: pools() }).materializedByNode, levelA.materializedByNode, 'opened nodes must never regenerate');
assert.strictEqual(new Set(Object.values(levelA.materializedByNode).filter((entry) => entry.type === 'event').map((entry) => entry.contentId)).size, Object.values(levelA.materializedByNode).filter((entry) => entry.type === 'event').length);

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

let state = createProductionCampaignState(deterministicA, { supplies: 2, gold: 50, contentPools: pools() });
const firstRoutes = availableRoutes(state);
assert.ok(firstRoutes.length >= 2);
assert.strictEqual(Object.keys(state.materializedContentByNode).length, firstRoutes.length);
const savedFirstMaterialization = JSON.parse(JSON.stringify(state.materializedContentByNode));
state = travelTo(state, firstRoutes[0].to, { contentPools: pools() });
assert.strictEqual(state.supplies, 1);
assert.deepStrictEqual(JSON.parse(JSON.stringify(state.materializedContentByNode[firstRoutes[1].to])), savedFirstMaterialization[firstRoutes[1].to]);
assert.ok(state.closedNodeIds.includes(firstRoutes[1].to));
const reopenedContent = state.materializedContentByNode[firstRoutes[1].to];
state = reopenBranch(state, firstRoutes[1].to);
assert.deepStrictEqual(state.materializedContentByNode[firstRoutes[1].to], reopenedContent);

const nextRoute = availableRoutes(state)[0];
state = travelTo(state, nextRoute.to, { contentPools: pools() });
assert.strictEqual(state.supplies, 0);
const forcedTarget = availableRoutes(state)[0].to;
assert.strictEqual(travelRequirement(state, forcedTarget).mode, 'forced_march');
assert.throws(() => travelTo(state, forcedTarget, { contentPools: pools() }), /consequence/);
state = travelTo(state, forcedTarget, { contentPools: pools(), forcedMarchChoice: 'next_battle_penalty' });
assert.strictEqual(state.forcedMarch.consecutiveCount, 1);
assert.strictEqual(state.temporaryPenalties.nextBattle, 1);
const forcedTarget2 = availableRoutes(state)[0].to;
state = travelTo(state, forcedTarget2, { contentPools: pools(), forcedMarchChoice: 'next_battle_penalty' });
assert.strictEqual(state.forcedMarch.consecutiveCount, 2);
assert.strictEqual(state.temporaryPenalties.nextBattle, 3, 'second consecutive forced march must escalate');

const completedId = state.currentNodeId;
state = completeNode(state, completedId);
assert.throws(() => completeNode(state, completedId), /already completed/);

let foundState = null;
for (let seed = 1; seed <= 1000 && !foundState; seed += 1) {
  const graph = generateProductionActGraph({ rootSeed: seed });
  let candidate = createProductionCampaignState(graph, { supplies: 10, contentPools: pools() });
  for (const node of graph.nodes.filter((entry) => graph.secretChecks[entry.id])) {
    candidate = checkSecretAfterNode(candidate, node.id);
    if (candidate.secret.pendingDecision) { foundState = candidate; break; }
  }
}
assert.ok(foundState, 'at least one deterministic seed should discover a secret node');
const beforeSecretNode = foundState.currentNodeId;
const beforeSecretSupplies = foundState.supplies;
foundState = decideSecret(foundState, 'enter');
assert.strictEqual(foundState.supplies, beforeSecretSupplies - 1);
assert.ok(foundState.secret.active);
foundState = completeSecret(foundState);
assert.strictEqual(foundState.currentNodeId, beforeSecretNode);
assert.strictEqual(foundState.secret.completed, true);
assert.strictEqual(checkSecretAfterNode(foundState, beforeSecretNode), foundState, 'only one secret may be opened per act');

const legacyGraph = { seed: 5, nodes: [{ id: 'start', type: 'start', layer: 0, contentId: null }, { id: 'x', type: 'event', layer: 1, contentId: 'event.legacy' }], nodesById: { start: { id: 'start', layer: 0 }, x: { id: 'x', layer: 1 } } };
const migrated = migrateProductionCampaignState({ format: 'rpchess-campaign-state', schemaVersion: 2, graph: legacyGraph, currentNodeId: 'x', supplies: 3, visibility: { start: 3, x: 3 }, visitedNodeIds: ['start', 'x'], traversedEdgeIds: [], closedNodeIds: [], history: [] });
assert.strictEqual(migrated.schemaVersion, 3);
assert.strictEqual(migrated.materializedContentByNode.x.contentId, 'event.legacy');
assert.strictEqual(migrated.macroTemplateId, 'legacy_preserved');
const reloaded = migrateProductionCampaignState(JSON.parse(JSON.stringify(createProductionCampaignState(deterministicA, { supplies: 10, contentPools: pools() }))));
assert.deepStrictEqual(reloaded.materializedContentByNode, createProductionCampaignState(deterministicA, { supplies: 10, contentPools: pools() }).materializedContentByNode);

const samples = 30000;
const counts = { early: { battle: 0, event: 0, service: 0 }, mid: { battle: 0, event: 0, service: 0 }, late: { battle: 0, event: 0, service: 0 } };
for (let seed = 1; seed <= samples; seed += 1) {
  const graph = generateProductionActGraph({ rootSeed: seed });
  for (const phase of ['early', 'mid', 'late']) {
    const candidates = graph.nodes.filter((node) => node.phase === phase && !['start', 'elite', 'boss'].includes(node.type) && !(node.layer === 1 && node.index === 0));
    const node = candidates[seed % candidates.length];
    counts[phase][node.category] += 1;
  }
}
for (const phase of ['early', 'mid', 'late']) {
  const total = Object.values(counts[phase]).reduce((sum, value) => sum + value, 0);
  for (const [category, expected] of Object.entries(PHASE_WEIGHTS[phase])) {
    const actual = counts[phase][category] / total * 100;
    assert.ok(Math.abs(actual - expected) < 3.5, `${phase}.${category} ${actual.toFixed(2)} is outside tolerance for ${expected}`);
  }
}

console.log('B9 production map: templates, deterministic topology, retries, reserve map, level materialization, save migration, scouting, forced march, branch reopening, secrets and distributions passed.');
