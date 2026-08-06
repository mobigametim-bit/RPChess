const assert = require('assert');
const { generateActGraph } = require('../src/campaign/graph.cjs');
const { validateActGraph } = require('../src/campaign/validate.cjs');
const { createCampaignState, availableRoutes, visibleNode, scoutingCost, scoutNode, travelTo, royalRetreatToConvergence } = require('../src/campaign/state.cjs');

for (let seed = 1; seed <= 500; seed += 1) {
  const graph = generateActGraph({ seed, act: 1, regionId: 'region.iron_marches', stageB: true });
  const report = validateActGraph(graph, { requireStageB: true });
  assert.strictEqual(report.ok, true, `seed ${seed}: ${report.errors.join('; ')}`);
  assert.ok(graph.nodes.length >= 18 && graph.nodes.length <= 24);
  assert.ok(graph.routeNodeCount >= 9 && graph.routeNodeCount <= 11);
  assert.strictEqual(graph.convergenceNodeIds.length, 3);
  assert.ok(graph.nodes.some((node) => node.type === 'elite'));
  assert.ok(graph.nodes.some((node) => ['shop', 'hospital', 'forge', 'camp'].includes(node.type)));
  for (const node of graph.nodes.filter((entry) => !['start', 'boss'].includes(entry.type))) assert.ok(node.emergencyTo, `seed ${seed} node ${node.id} missing emergency route`);
}

const graph = generateActGraph({ seed: 9042, act: 1, regionId: 'region.iron_marches', stageB: true });
let state = createCampaignState(graph, { supplies: 10 });
const routes = availableRoutes(state);
assert.ok(routes.length >= 2);
assert.strictEqual(visibleNode(state, routes[0].to).visibility, 'type');
assert.strictEqual(scoutingCost(state, routes[0].to), 1);
state = scoutNode(state, routes[0].to);
assert.strictEqual(state.supplies, 9);
assert.strictEqual(visibleNode(state, routes[0].to).visibility, 'content');
assert.strictEqual(visibleNode(state, routes[0].to).scouted, true);
assert.strictEqual(scoutingCost(state, routes[1].to), 2);
state = scoutNode(state, routes[1].to);
assert.strictEqual(state.supplies, 7);
if (routes[2]) assert.throws(() => scoutNode(state, routes[2].to), /third|трет/i);
const chosen = availableRoutes(state)[0];
const siblingIds = availableRoutes(state).filter((route) => route.to !== chosen.to).map((route) => route.to);
state = travelTo(state, chosen.to);
for (const sibling of siblingIds) assert.ok(state.closedNodeIds.includes(sibling));
const current = graph.nodesById[state.currentNodeId];
if (current.emergencyTo && current.emergencyTo !== state.currentNodeId) {
  const retreated = royalRetreatToConvergence(state, current.id);
  assert.strictEqual(retreated.currentNodeId, current.emergencyTo);
}
console.log('Stage B campaign: 500 seeds, topology, scouting, branch closure and emergency routes passed.');
