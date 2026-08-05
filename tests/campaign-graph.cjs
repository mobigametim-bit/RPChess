const assert = require('assert');
const { middleLayerCounts, generateActGraph } = require('../src/campaign/graph.cjs');
const {
  minimumPathCost,
  validateActGraph,
  batchValidateActGraphs
} = require('../src/campaign/validate.cjs');
const {
  createCampaignState,
  availableRoutes,
  visibleNode,
  travelTo,
  gainScouting,
  completeBossNode
} = require('../src/campaign/state.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function contentPools(size = 40) {
  const series = (prefix) => Array.from({ length: size }, (_unused, index) => `${prefix}.${String(index + 1).padStart(3, '0')}`);
  return {
    encounters: series('encounter.test'),
    events: series('event.test'),
    bosses: series('boss.test'),
    shops: series('shop.test'),
    services: series('service.test'),
    treasures: series('treasure.test')
  };
}

function shortestPath(graph) {
  const paths = { [graph.startNodeId]: [] };
  const costs = { [graph.startNodeId]: 0 };
  for (const node of graph.nodes.slice().sort((a, b) => a.layer - b.layer || a.index - b.index)) {
    if (costs[node.id] == null) continue;
    for (const edgeId of graph.outgoing[node.id] || []) {
      const edge = graph.edgesById[edgeId];
      const cost = costs[node.id] + edge.cost;
      if (costs[edge.to] == null || cost < costs[edge.to]) {
        costs[edge.to] = cost;
        paths[edge.to] = [...paths[node.id], edge.to];
      }
    }
  }
  return paths[graph.bossNodeId];
}

test('act layer distribution always totals the requested 9–12 nodes', () => {
  for (let count = 9; count <= 12; count += 1) {
    const middle = middleLayerCounts(count);
    assert.ok(middle.length >= 4 && middle.length <= 5);
    assert.strictEqual(middle.reduce((sum, value) => sum + value, 0) + 2, count);
    assert.ok(middle.every((value) => value >= 1 && value <= 3));
  }
});

test('same seed and inputs produce byte-equivalent act graphs', () => {
  const options = { seed: 441, act: 2, regionId: 'region.iron_marches', nodeCount: 11, contentPools: contentPools() };
  assert.deepStrictEqual(generateActGraph(options), generateActGraph(options));
});

test('compiled content pools are assigned without repeats before exhaustion', () => {
  const graph = generateActGraph({ seed: 442, act: 3, regionId: 'region.sky_khanate', nodeCount: 12, contentPools: contentPools() });
  const contentIds = graph.nodes.map((node) => node.contentId).filter(Boolean);
  assert.strictEqual(new Set(contentIds).size, contentIds.length);
  assert.strictEqual(validateActGraph(graph, { requireContent: true }).ok, true);
});

test('10,000 deterministic seeds generate valid reachable graphs', () => {
  const report = batchValidateActGraphs({
    count: 10000,
    generate: (seed) => generateActGraph({
      seed,
      act: (seed % 3) + 1,
      regionId: 'region.iron_marches'
    })
  });
  assert.strictEqual(report.ok, true, JSON.stringify(report.failures.slice(0, 3)));
  assert.strictEqual(report.count, 10000);
  assert.ok(report.nodeCounts[9] > 0 && report.nodeCounts[12] > 0);
  assert.ok(report.averageMinimumPathCost > 0);
});

test('default campaign supplies guarantee at least the cheapest boss route', () => {
  const graph = generateActGraph({ seed: 443, act: 2, regionId: 'region.thorn_covenant' });
  const state = createCampaignState(graph);
  assert.strictEqual(state.minimumPathCost, minimumPathCost(graph));
  assert.ok(state.supplies >= state.minimumPathCost);
});

test('scouting reveals route, then node type, then exact content', () => {
  const graph = generateActGraph({ seed: 444, act: 1, regionId: 'region.iron_marches', contentPools: contentPools() });
  let state = createCampaignState(graph, { supplies: 99, scouting: 0 });
  const target = availableRoutes(state)[0].to;
  assert.strictEqual(visibleNode(state, target).visibility, 'route');
  assert.strictEqual(visibleNode(state, target).type, null);
  state = gainScouting(state);
  assert.strictEqual(visibleNode(state, target).visibility, 'type');
  assert.ok(visibleNode(state, target).type);
  state = gainScouting(state);
  assert.strictEqual(visibleNode(state, target).visibility, 'content');
  assert.ok(visibleNode(state, target).contentId);
});

test('route traversal spends supplies and reaches boss through a valid path', () => {
  const graph = generateActGraph({ seed: 445, act: 3, regionId: 'region.ashen_dominion' });
  const path = shortestPath(graph);
  let state = createCampaignState(graph, { supplies: 99 });
  let spent = 0;
  for (const nodeId of path) {
    const route = availableRoutes(state).find((item) => item.to === nodeId);
    spent += route.cost;
    state = travelTo(state, nodeId);
  }
  assert.strictEqual(state.status, 'boss_reached');
  assert.strictEqual(state.supplies, 99 - spent);
  assert.strictEqual(state.visitedNodeIds.at(-1), graph.bossNodeId);
  state = completeBossNode(state, 'victory');
  assert.strictEqual(state.status, 'completed');
});

test('unaffordable and non-adjacent routes are rejected', () => {
  const graph = generateActGraph({ seed: 446, act: 1, regionId: 'region.free_cities' });
  const state = createCampaignState(graph, { supplies: 0 });
  const route = availableRoutes(state)[0];
  assert.strictEqual(route.affordable, false);
  assert.throws(() => travelTo(state, route.to), /not enough supplies/);
  assert.throws(() => travelTo(state, graph.bossNodeId), /not reachable/);
});

test('strict content validation rejects unresolved production slots', () => {
  const graph = generateActGraph({ seed: 447, act: 1, regionId: 'region.neutral' });
  const report = validateActGraph(graph, { requireContent: true });
  assert.strictEqual(report.ok, false);
  assert.ok(report.errors.some((error) => error.includes('no compiled contentId')));
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
  }
}
console.log(`\nCampaign graph: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
