'use strict';

const { freezeArray, deepFreeze } = require('./production-map-contract.cjs');
const { materializeLevel } = require('./production-map-materialization.cjs');

const PRODUCTION_CAMPAIGN_SCHEMA_VERSION = 3;
const FORCED_MARCH_CHOICES = Object.freeze(['gold_loss', 'light_injury', 'next_battle_penalty', 'reward_choice_reduction', 'scouting_lock']);

function routeRecords(state) {
  const closed = new Set(state.closedNodeIds);
  return (state.graph.outgoing[state.currentNodeId] || []).map((edgeId) => {
    const edge = state.graph.edgesById[edgeId];
    return { edge, node: state.graph.nodesById[edge.to] };
  }).filter(({ node }) => !closed.has(node.id));
}
function visibleNode(state, nodeId) {
  const node = state.graph.nodesById[nodeId];
  if (!node) return null;
  const materialized = state.materializedContentByNode[nodeId] || null;
  const revealed = state.revealedNodeIds.includes(nodeId) || state.visitedNodeIds.includes(nodeId);
  const landmark = ['elite', 'boss'].includes(node.type);
  if (!revealed && !landmark) return deepFreeze({ id: nodeId, visibility: 'hidden' });
  const visited = state.visitedNodeIds.includes(nodeId) || nodeId === state.currentNodeId;
  const adjacent = routeRecords(state).some(({ node: target }) => target.id === nodeId);
  const scouted = state.scoutedNodeIds.includes(nodeId);
  const showContent = visited || scouted;
  const details = showContent ? materialized?.details || null : null;
  const visibility = visited || scouted ? 'content' : adjacent ? 'type' : landmark ? 'landmark' : 'history';
  return deepFreeze({
    id: node.id, layer: node.layer, visibility,
    type: revealed || landmark ? node.type : null, phase: revealed ? node.phase : null, danger: revealed ? node.danger : null,
    branchLength: revealed ? Math.max(0, state.graph.nodesById[node.emergencyTo]?.layer - node.layer || 0) : null,
    branchProfile: revealed ? node.branchProfile : null, convergence: node.convergence, mandatory: node.mandatory,
    contentId: showContent ? materialized?.contentId || null : null, materialized: Boolean(materialized), details, intel: details, scouted
  });
}
function createProductionCampaignState(graph, options = {}) {
  if (!graph || graph.generatorVersion !== 3) throw new Error('production campaign requires generatorVersion 3 graph');
  const materializationContext = deepFreeze({
    contentPools: deepFreeze({ ...(options.contentPools || graph.materializationContext?.contentPools || {}) }),
    participantIds: freezeArray(options.participantIds || graph.materializationContext?.participantIds || [])
  });
  const initial = materializeLevel(graph, graph.startNodeId, {}, { ...materializationContext, ...options });
  return deepFreeze({
    format: 'rpchess-campaign-state', schemaVersion: PRODUCTION_CAMPAIGN_SCHEMA_VERSION,
    generatorVersion: graph.generatorVersion, rootSeed: graph.rootSeed, attemptIndex: graph.attemptIndex,
    macroTemplateId: graph.macroTemplateId, isMirrored: graph.isMirrored,
    graph, currentNodeId: graph.startNodeId, currentLevel: 0, status: 'active', minimumPathCost: 10, scouting: 0,
    supplies: Number.isInteger(options.supplies) ? options.supplies : 10,
    gold: Number.isInteger(options.gold) ? options.gold : 0,
    materializationContext,
    revealedLevelIds: freezeArray([0, 1]), revealedNodeIds: freezeArray([graph.startNodeId, ...initial.materializedNodeIds]),
    materializedContentByNode: initial.materializedByNode, selectorState: initial.selectorState || null,
    visitedNodeIds: freezeArray([graph.startNodeId]), traversedEdgeIds: freezeArray([]),
    closedNodeIds: freezeArray([]), reopenedNodeIds: freezeArray([]), completedNodeIds: freezeArray([]),
    rewardsClaimedNodeIds: freezeArray([]), scoutedNodeIds: freezeArray([]), scoutAttemptsByFork: deepFreeze({}),
    scoutingModifiers: deepFreeze({ costDiscount: 0, thirdScoutAllowed: false }), scoutingLockedUntilTravel: false,
    temporaryPenalties: deepFreeze({ nextBattle: 0, rewardChoiceReduction: 0 }),
    forcedMarch: deepFreeze({ consecutiveCount: 0, totalCount: 0, lastChoice: null }),
    secret: deepFreeze({ checksByNode: {}, discovered: null, pendingDecision: null, active: null, completed: false, declined: false }),
    history: freezeArray([])
  });
}
function availableRoutes(state) {
  if (state.status !== 'active' || state.secret.active || state.secret.pendingDecision) return freezeArray([]);
  return freezeArray(routeRecords(state).map(({ edge, node }) => deepFreeze({
    edgeId: edge.id, from: edge.from, to: edge.to, cost: 1,
    affordable: state.supplies >= 1, requiresForcedMarch: state.supplies === 0,
    node: visibleNode(state, node.id)
  })));
}
function travelRequirement(state, targetNodeId) {
  const route = availableRoutes(state).find((entry) => entry.to === targetNodeId);
  if (!route) throw new Error(`${targetNodeId} is not reachable from ${state.currentNodeId}`);
  return state.supplies > 0
    ? deepFreeze({ mode: 'paid', cost: 1, choices: [] })
    : deepFreeze({ mode: 'forced_march', cost: 0, choices: FORCED_MARCH_CHOICES });
}
function scoutingCost(state, nodeId) {
  if (!availableRoutes(state).some((route) => route.to === nodeId)) throw new Error(`${nodeId} is not an adjacent route`);
  if (state.scoutedNodeIds.includes(nodeId)) return 0;
  const attempts = Number(state.scoutAttemptsByFork?.[state.currentNodeId] || 0);
  if (attempts >= 2 && !state.scoutingModifiers?.thirdScoutAllowed) return null;
  const base = Math.min(2, attempts + 1);
  return Math.max(0, base - Number(state.scoutingModifiers?.costDiscount || 0));
}

module.exports = {
  PRODUCTION_CAMPAIGN_SCHEMA_VERSION, FORCED_MARCH_CHOICES,
  routeRecords, visibleNode, createProductionCampaignState, availableRoutes, travelRequirement, scoutingCost
};
