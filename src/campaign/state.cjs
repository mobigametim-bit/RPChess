'use strict';

const { assertValidActGraph, minimumPathCost } = require('./validate.cjs');

const CAMPAIGN_SCHEMA_VERSION = 2;

function freezeArray(values) { return Object.freeze(values.slice()); }
function freezeObject(value) { return Object.freeze({ ...(value || {}) }); }

function visibilityLevel(scouting) { return Math.min(3, 1 + scouting); }

function baseOutgoingVisibility(graph, nodeId) {
  const visibility = { [nodeId]: 3 };
  for (const edgeId of graph.outgoing[nodeId] || []) {
    const target = graph.nodesById[graph.edgesById[edgeId].to];
    visibility[target.id] = target.secret ? 0 : 2;
  }
  return visibility;
}

function revealOutgoing(graph, nodeId, scouting, visibility) {
  const next = { ...visibility, [nodeId]: 3 };
  const level = graph.stageB ? 2 : visibilityLevel(scouting);
  for (const edgeId of graph.outgoing[nodeId] || []) {
    const targetId = graph.edgesById[edgeId].to;
    const target = graph.nodesById[targetId];
    if (target.secret && !(visibility[targetId] > 0)) continue;
    next[targetId] = Math.max(next[targetId] || 0, level);
  }
  return Object.freeze(next);
}

function createCampaignState(graph, options = {}) {
  assertValidActGraph(graph);
  const safeDefaultSupplies = minimumPathCost(graph) + (graph.stageB ? 5 : 3);
  const supplies = options.supplies ?? safeDefaultSupplies;
  const scouting = options.scouting ?? (graph.stageB ? 1 : 0);
  if (!Number.isInteger(supplies) || supplies < 0) throw new Error('campaign supplies must be a non-negative integer');
  if (!Number.isInteger(scouting) || scouting < 0 || scouting > 3) throw new Error('campaign scouting must be 0–3');
  const initialVisibility = graph.stageB ? baseOutgoingVisibility(graph, graph.startNodeId) : revealOutgoing(graph, graph.startNodeId, scouting, {});
  return Object.freeze({
    format: 'rpchess-campaign-state',
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    graph,
    currentNodeId: graph.startNodeId,
    supplies,
    minimumPathCost: minimumPathCost(graph),
    scouting,
    visibility: Object.freeze(initialVisibility),
    visitedNodeIds: freezeArray([graph.startNodeId]),
    traversedEdgeIds: freezeArray([]),
    closedNodeIds: freezeArray([]),
    scoutedNodeIds: freezeArray([]),
    secretNodeIdsDiscovered: freezeArray(options.secretNodeIdsDiscovered || []),
    scoutAttemptsByFork: freezeObject({}),
    scoutingModifiers: Object.freeze({
      costDiscount: Math.max(0, Number(options.scoutingModifiers?.costDiscount || 0)),
      thirdScoutAllowed: Boolean(options.scoutingModifiers?.thirdScoutAllowed),
      revealSecrets: Boolean(options.scoutingModifiers?.revealSecrets),
      revealDepth: Math.max(1, Number(options.scoutingModifiers?.revealDepth || 1))
    }),
    status: 'active',
    history: freezeArray([])
  });
}

function migrateCampaignState(snapshot) {
  if (!snapshot || snapshot.format !== 'rpchess-campaign-state') throw new Error('invalid campaign state');
  if (snapshot.schemaVersion === CAMPAIGN_SCHEMA_VERSION) return snapshot;
  if (snapshot.schemaVersion !== 1) throw new Error('unsupported campaign state schema');
  const graph = snapshot.graph;
  const visibility = graph.stageB ? Object.freeze({ ...baseOutgoingVisibility(graph, snapshot.currentNodeId), ...(snapshot.visibility || {}) }) : Object.freeze({ ...(snapshot.visibility || {}) });
  return Object.freeze({
    ...snapshot,
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    visibility,
    closedNodeIds: freezeArray([]),
    scoutedNodeIds: freezeArray([]),
    secretNodeIdsDiscovered: freezeArray([]),
    scoutAttemptsByFork: freezeObject({}),
    scoutingModifiers: Object.freeze({ costDiscount: 0, thirdScoutAllowed: false, revealSecrets: false, revealDepth: 1 })
  });
}

function assertCampaignState(input) {
  const state = migrateCampaignState(input);
  if (!state.graph || !state.graph.nodesById[state.currentNodeId]) throw new Error('campaign current node is invalid');
  return state;
}

function routeTargets(state) {
  const closed = new Set(state.closedNodeIds || []);
  const discovered = new Set(state.secretNodeIdsDiscovered || []);
  return (state.graph.outgoing[state.currentNodeId] || [])
    .map((edgeId) => ({ edgeId, edge: state.graph.edgesById[edgeId], node: state.graph.nodesById[state.graph.edgesById[edgeId].to] }))
    .filter(({ node }) => !closed.has(node.id) && (!node.secret || discovered.has(node.id)));
}

function availableRoutes(stateInput) {
  const state = assertCampaignState(stateInput);
  if (state.status !== 'active') return freezeArray([]);
  return freezeArray(routeTargets(state).map(({ edgeId, edge }) => Object.freeze({
    edgeId,
    from: edge.from,
    to: edge.to,
    cost: edge.cost,
    affordable: state.supplies >= edge.cost,
    node: visibleNode(state, edge.to)
  })));
}

function visibleNode(stateInput, nodeId) {
  const state = assertCampaignState(stateInput);
  const node = state.graph.nodesById[nodeId];
  if (!node) return null;
  const discovered = new Set(state.secretNodeIdsDiscovered || []);
  if (node.secret && !discovered.has(nodeId)) return Object.freeze({ id: nodeId, visibility: 'hidden', secret: true });
  const level = state.visibility[nodeId] || 0;
  if (level === 0) return Object.freeze({ id: nodeId, visibility: 'hidden', secret: Boolean(node.secret) });
  return Object.freeze({
    id: node.id,
    layer: node.layer,
    visibility: level === 1 ? 'route' : level === 2 ? 'type' : 'content',
    type: level >= 2 ? node.type : null,
    contentId: level >= 3 ? node.contentId : null,
    contentSlot: level >= 3 ? node.contentSlot : null,
    danger: level >= 2 ? node.danger ?? null : null,
    branchLength: level >= 2 ? node.branchLength ?? null : null,
    convergence: Boolean(node.convergence),
    mandatory: Boolean(node.mandatory),
    secret: Boolean(node.secret),
    scouted: (state.scoutedNodeIds || []).includes(node.id),
    intel: level >= 3 ? node.intel || null : null
  });
}

function scoutingCost(state, nodeId) {
  const stateValue = assertCampaignState(state);
  const targets = routeTargets(stateValue);
  if (!targets.some(({ node }) => node.id === nodeId)) throw new Error(`${nodeId} is not an adjacent visible route`);
  if ((stateValue.scoutedNodeIds || []).includes(nodeId)) return 0;
  const count = Number(stateValue.scoutAttemptsByFork?.[stateValue.currentNodeId] || 0);
  if (count >= 2 && !stateValue.scoutingModifiers.thirdScoutAllowed) return null;
  return Math.max(0, Math.min(2, count + 1) - stateValue.scoutingModifiers.costDiscount);
}

function discoverSecretNodes(stateInput, reason = 'scouting') {
  const state = assertCampaignState(stateInput);
  const outgoing = (state.graph.outgoing[state.currentNodeId] || []).map((edgeId) => state.graph.edgesById[edgeId].to);
  const secrets = outgoing.filter((nodeId) => state.graph.nodesById[nodeId]?.secret);
  if (!secrets.length) return state;
  const discovered = [...new Set([...(state.secretNodeIdsDiscovered || []), ...secrets])].sort();
  const visibility = { ...state.visibility };
  for (const nodeId of secrets) visibility[nodeId] = Math.max(visibility[nodeId] || 0, 2);
  return Object.freeze({
    ...state,
    visibility: Object.freeze(visibility),
    secretNodeIdsDiscovered: freezeArray(discovered),
    history: freezeArray([...state.history, Object.freeze({ index: state.history.length, type: 'secret_nodes_discovered', nodeIds: freezeArray(secrets), reason })])
  });
}

function scoutNode(stateInput, nodeId, options = {}) {
  let state = assertCampaignState(stateInput);
  if (state.status !== 'active') throw new Error('scouting is available only on the campaign map');
  if (state.scoutingModifiers.revealSecrets || options.revealSecrets) state = discoverSecretNodes(state, options.reason || 'targeted_scouting');
  const cost = scoutingCost(state, nodeId);
  if (cost == null) throw new Error('third scouting attempt at this fork is unavailable');
  if (state.supplies < cost) throw new Error('not enough supplies for scouting');
  if ((state.scoutedNodeIds || []).includes(nodeId)) return state;
  const visibility = { ...state.visibility, [nodeId]: 3 };
  const attempts = { ...(state.scoutAttemptsByFork || {}), [state.currentNodeId]: Number(state.scoutAttemptsByFork?.[state.currentNodeId] || 0) + 1 };
  const record = Object.freeze({
    index: state.history.length,
    type: 'node_scouted',
    from: state.currentNodeId,
    nodeId,
    cost,
    attempt: attempts[state.currentNodeId],
    modifiers: state.scoutingModifiers
  });
  return Object.freeze({
    ...state,
    supplies: state.supplies - cost,
    visibility: Object.freeze(visibility),
    scoutedNodeIds: freezeArray([...state.scoutedNodeIds, nodeId]),
    scoutAttemptsByFork: Object.freeze(attempts),
    history: freezeArray([...state.history, record])
  });
}

function travelTo(stateInput, targetNodeId) {
  const state = assertCampaignState(stateInput);
  if (state.status !== 'active') throw new Error('campaign act is already completed');
  const route = availableRoutes(state).find((candidate) => candidate.to === targetNodeId);
  if (!route) throw new Error(`${targetNodeId} is not reachable from ${state.currentNodeId}`);
  if (state.supplies < route.cost) throw new Error(`not enough supplies for route ${route.edgeId}`);
  const siblings = routeTargets(state).map(({ node }) => node.id).filter((id) => id !== targetNodeId);
  const closedNodeIds = [...new Set([...(state.closedNodeIds || []), ...siblings])].sort();
  const visited = state.visitedNodeIds.includes(targetNodeId) ? state.visitedNodeIds : [...state.visitedNodeIds, targetNodeId];
  const traversed = [...state.traversedEdgeIds, route.edgeId];
  const status = targetNodeId === state.graph.bossNodeId ? 'boss_reached' : 'active';
  const visibility = revealOutgoing(state.graph, targetNodeId, state.scouting, state.visibility);
  const record = Object.freeze({
    index: state.history.length,
    type: 'travel',
    edgeId: route.edgeId,
    from: state.currentNodeId,
    to: targetNodeId,
    cost: route.cost,
    suppliesBefore: state.supplies,
    suppliesAfter: state.supplies - route.cost,
    closedNodeIds: freezeArray(siblings)
  });
  return Object.freeze({
    ...state,
    currentNodeId: targetNodeId,
    supplies: state.supplies - route.cost,
    visibility,
    visitedNodeIds: freezeArray(visited),
    traversedEdgeIds: freezeArray(traversed),
    closedNodeIds: freezeArray(closedNodeIds),
    status,
    history: freezeArray([...state.history, record])
  });
}

function royalRetreatToConvergence(stateInput, lostNodeId, options = {}) {
  const state = assertCampaignState(stateInput);
  const node = state.graph.nodesById[lostNodeId || state.currentNodeId];
  if (!node) throw new Error('royal retreat requires a valid lost node');
  const destinationId = node.emergencyTo || state.graph.bossNodeId;
  const destination = state.graph.nodesById[destinationId];
  if (!destination || destination.layer <= node.layer) throw new Error('royal retreat has no valid forward convergence');
  const visited = state.visitedNodeIds.includes(destinationId) ? state.visitedNodeIds : [...state.visitedNodeIds, destinationId];
  const closedNodeIds = [...new Set([...(state.closedNodeIds || []), node.id])].sort();
  const visibility = revealOutgoing(state.graph, destinationId, state.scouting, { ...state.visibility, [destinationId]: 3 });
  return Object.freeze({
    ...state,
    currentNodeId: destinationId,
    visibility,
    visitedNodeIds: freezeArray(visited),
    closedNodeIds: freezeArray(closedNodeIds),
    status: destinationId === state.graph.bossNodeId ? 'boss_reached' : 'active',
    history: freezeArray([...state.history, Object.freeze({
      index: state.history.length,
      type: 'royal_retreat',
      from: node.id,
      to: destinationId,
      reason: options.reason || 'battle_defeat'
    })])
  });
}

function gainSupplies(stateInput, amount, reason = 'reward') {
  const state = assertCampaignState(stateInput);
  if (!Number.isInteger(amount)) throw new Error('supply change must be an integer');
  const next = state.supplies + amount;
  if (next < 0) throw new Error('supply change would make supplies negative');
  return Object.freeze({ ...state, supplies: next, history: freezeArray([...state.history, Object.freeze({ index: state.history.length, type: 'supplies', amount, reason, suppliesBefore: state.supplies, suppliesAfter: next })]) });
}

function gainScouting(stateInput, amount = 1) {
  const state = assertCampaignState(stateInput);
  if (!Number.isInteger(amount) || amount < 1) throw new Error('scouting gain must be a positive integer');
  const scouting = Math.min(3, state.scouting + amount);
  const visibility = { ...state.visibility };
  for (const { node } of routeTargets(state)) visibility[node.id] = Math.max(visibility[node.id] || 0, Math.min(3, 1 + scouting));
  return Object.freeze({ ...state, scouting, visibility: Object.freeze(visibility), history: freezeArray([...state.history, Object.freeze({ index: state.history.length, type: 'scouting', before: state.scouting, after: scouting })]) });
}

function completeBossNode(stateInput, outcome) {
  const state = assertCampaignState(stateInput);
  if (state.status !== 'boss_reached') throw new Error('boss node has not been reached');
  if (!['victory', 'defeat'].includes(outcome)) throw new Error('boss outcome must be victory or defeat');
  return Object.freeze({ ...state, status: outcome === 'victory' ? 'completed' : 'failed', history: freezeArray([...state.history, Object.freeze({ index: state.history.length, type: 'boss', outcome })]) });
}

module.exports = {
  CAMPAIGN_SCHEMA_VERSION,
  visibilityLevel,
  revealOutgoing,
  createCampaignState,
  migrateCampaignState,
  visibleNode,
  availableRoutes,
  scoutingCost,
  scoutNode,
  discoverSecretNodes,
  travelTo,
  royalRetreatToConvergence,
  gainSupplies,
  gainScouting,
  completeBossNode
};
