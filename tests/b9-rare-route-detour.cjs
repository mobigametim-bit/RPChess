'use strict';

const assert = require('assert');
const { generateProductionActGraph } = require('../src/campaign/production-map.cjs');
const {
  createProductionCampaignState,
  availableRoutes,
  travelTo,
  completeNode,
  reopenBranch
} = require('../src/campaign/production-map-state.cjs');

function pools(size = 40) {
  const list = (prefix) => Array.from({ length:size }, (_unused,index) => `${prefix}.${index + 1}`);
  return {
    encounters:list('encounter'), events:list('event'), bosses:['boss.iron_regent'],
    services:list('service'), shop:list('shop'), hospital:list('hospital'), forge:list('forge'), camp:list('camp')
  };
}

const graph = generateProductionActGraph({ rootSeed:9042, act:1, regionId:'region.iron_marches' });
let state = createProductionCampaignState(graph, { supplies:20, gold:80, contentPools:pools() });
const opening = availableRoutes(state);
const chosen = opening.find((route) => !graph.edgesById[route.edgeId].reopenable) || opening[0];
const skipped = opening.find((route) => route.to !== chosen.to && graph.edgesById[route.edgeId].reopenable);
assert.ok(skipped, 'fixture requires an authored reopenable sibling');

state = travelTo(state, chosen.to);
const mainPosition = state.currentNodeId;
const mainLevel = state.currentLevel;
const forwardBefore = availableRoutes(state).map((route) => route.to).sort();
assert.ok(forwardBefore.length, 'main route must continue before opening the detour');
assert.ok(state.closedNodeIds.includes(skipped.to), 'skipped branch should be closed before reopening');

state = reopenBranch(state, skipped.to);
const opened = availableRoutes(state);
assert.ok(opened.some((route) => route.rare && route.to === skipped.to), 'rare detour must be available');
assert.ok(forwardBefore.every((nodeId) => opened.some((route) => route.to === nodeId)), 'opening a rare detour must preserve the main route');

const suppliesBefore = state.supplies;
state = travelTo(state, skipped.to);
assert.strictEqual(state.supplies, suppliesBefore - 1, 'rare detour costs exactly one supply');
assert.strictEqual(state.rareRoute.status, 'used');
assert.strictEqual(state.rareRoute.returnNodeId, mainPosition);
assert.ok(forwardBefore.every((nodeId) => !state.closedNodeIds.includes(nodeId)), 'entering the detour must not close the main route');

state = completeNode(state, skipped.to, { rewardClaimed:true });
assert.strictEqual(state.currentNodeId, mainPosition, 'completing the reopened node must return to the position that opened it');
assert.strictEqual(state.currentLevel, mainLevel);
assert.strictEqual(state.rareRoute.status, 'completed');
assert.ok(state.completedNodeIds.includes(skipped.to));
assert.ok(state.rewardsClaimedNodeIds.includes(skipped.to));
assert.deepStrictEqual(availableRoutes(state).map((route) => route.to).sort(), forwardBefore, 'main progression must be identical after returning from the detour');
assert.throws(() => reopenBranch(state, skipped.to), /completed|closed branch/, 'completed detour cannot be reopened for another reward');
assert.ok(state.history.some((entry) => entry.type === 'rare_route_returned' && entry.to === mainPosition));

console.log('B9 rare-route detour: main path preservation, one-time reward and safe return passed.');
