'use strict';

const { assertValidActGraph } = require('./validate.cjs');

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function visibilityLevel(scouting) {
  return Math.min(3, 1 + scouting);
}

function revealOutgoing(graph, nodeId, scouting, visibility) {
  const next = { ...visibility, [nodeId]: 3 };
  const level = visibilityLevel(scouting);
  for (const edgeId of graph.outgoing[nodeId] || []) {
    const targetId = graph.edgesById[edgeId].to;
    next[targetId] = Math.max(next[targetId] || 0, level);
  }
  return Object.freeze(next);
}

function createCampaignState(graph, options = {}) {
  assertValidActGraph(graph);
  const supplies = options.supplies ?? 12;
  const scouting = options.scouting ?? 0;
  if (!Number.isInteger(supplies) || supplies < 0) throw new Error('campaign supplies must be a non-negative integer');
  if (!Number.isInteger(scouting) || scouting < 0 || scouting > 2) throw new Error('campaign scouting must be 0, 1 or 2');
  const visibility = revealOutgoing(graph, graph.startNodeId, scouting, {});
  return Object.freeze({
    format: 'rpchess-campaign-state',
    schemaVersion: 1,
    graph,
    currentNodeId: graph.startNodeId,
    supplies,
    scouting,
    visibility,
    visitedNodeIds: freezeArray([graph.startNodeId]),
    traversedEdgeIds: freezeArray([]),
    status: 'active',
    history: freezeArray([])
  });
}

function availableRoutes(state) {
  if (!state || state.format !== 'rpchess-campaign-state') throw new Error('invalid campaign state');
  if (state.status !== 'active') return Object.freeze([]);
  return freezeArray((state.graph.outgoing[state.currentNodeId] || []).map((edgeId) => {
    const edge = state.graph.edgesById[edgeId];
    return Object.freeze({
      edgeId,
      from: edge.from,
      to: edge.to,
      cost: edge.cost,
      affordable: state.supplies >= edge.cost,
      node: visibleNode(state, edge.to)
    });
  }));
}

function visibleNode(state, nodeId) {
  const node = state.graph.nodesById[nodeId];
  if (!node) return null;
  const level = state.visibility[nodeId] || 0;
  if (level === 0) return Object.freeze({ id: nodeId, visibility: 'hidden' });
  return Object.freeze({
    id: node.id,
    layer: node.layer,
    visibility: level === 1 ? 'route' : level === 2 ? 'type' : 'content',
    type: level >= 2 ? node.type : null,
    contentId: level >= 3 ? node.contentId : null,
    contentSlot: level >= 3 ? node.contentSlot : null
  });
}

function travelTo(state, targetNodeId) {
  if (!state || state.format !== 'rpchess-campaign-state') throw new Error('invalid campaign state');
  if (state.status !== 'active') throw new Error('campaign act is already completed');
  const edgeId = (state.graph.outgoing[state.currentNodeId] || []).find((id) => state.graph.edgesById[id].to === targetNodeId);
  if (!edgeId) throw new Error(`${targetNodeId} is not reachable from ${state.currentNodeId}`);
  const edge = state.graph.edgesById[edgeId];
  if (state.supplies < edge.cost) throw new Error(`not enough supplies for route ${edgeId}`);
  const visited = state.visitedNodeIds.includes(targetNodeId) ? state.visitedNodeIds : [...state.visitedNodeIds, targetNodeId];
  const traversed = [...state.traversedEdgeIds, edgeId];
  const status = targetNodeId === state.graph.bossNodeId ? 'boss_reached' : 'active';
  const visibility = revealOutgoing(state.graph, targetNodeId, state.scouting, state.visibility);
  const record = Object.freeze({
    index: state.history.length,
    edgeId,
    from: state.currentNodeId,
    to: targetNodeId,
    cost: edge.cost,
    suppliesBefore: state.supplies,
    suppliesAfter: state.supplies - edge.cost
  });
  return Object.freeze({
    ...state,
    currentNodeId: targetNodeId,
    supplies: state.supplies - edge.cost,
    visibility,
    visitedNodeIds: freezeArray(visited),
    traversedEdgeIds: freezeArray(traversed),
    status,
    history: freezeArray([...state.history, record])
  });
}

function gainSupplies(state, amount, reason = 'reward') {
  if (!Number.isInteger(amount)) throw new Error('supply change must be an integer');
  const next = state.supplies + amount;
  if (next < 0) throw new Error('supply change would make supplies negative');
  return Object.freeze({
    ...state,
    supplies: next,
    history: freezeArray([...state.history, Object.freeze({
      index: state.history.length,
      type: 'supplies',
      amount,
      reason,
      suppliesBefore: state.supplies,
      suppliesAfter: next
    })])
  });
}

function gainScouting(state, amount = 1) {
  if (!Number.isInteger(amount) || amount < 1) throw new Error('scouting gain must be a positive integer');
  const scouting = Math.min(2, state.scouting + amount);
  return Object.freeze({
    ...state,
    scouting,
    visibility: revealOutgoing(state.graph, state.currentNodeId, scouting, state.visibility),
    history: freezeArray([...state.history, Object.freeze({
      index: state.history.length,
      type: 'scouting',
      before: state.scouting,
      after: scouting
    })])
  });
}

function completeBossNode(state, outcome) {
  if (state.status !== 'boss_reached') throw new Error('boss node has not been reached');
  if (!['victory', 'defeat'].includes(outcome)) throw new Error('boss outcome must be victory or defeat');
  return Object.freeze({
    ...state,
    status: outcome === 'victory' ? 'completed' : 'failed',
    history: freezeArray([...state.history, Object.freeze({ index: state.history.length, type: 'boss', outcome })])
  });
}

module.exports = {
  visibilityLevel,
  revealOutgoing,
  createCampaignState,
  visibleNode,
  availableRoutes,
  travelTo,
  gainSupplies,
  gainScouting,
  completeBossNode
};
