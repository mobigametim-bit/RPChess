'use strict';

const { NODE_TYPES, ECONOMY_TYPES, STAGE_B_NODE_MIN, STAGE_B_NODE_MAX } = require('./graph.cjs');

function reachableFrom(graph, startId, direction = 'outgoing') {
  const visited = new Set([startId]);
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift();
    for (const edgeId of graph[direction][current] || []) {
      const edge = graph.edgesById[edgeId];
      const next = direction === 'outgoing' ? edge.to : edge.from;
      if (!visited.has(next)) { visited.add(next); queue.push(next); }
    }
  }
  return visited;
}

function minimumPathCost(graph, fromId = graph.startNodeId, toId = graph.bossNodeId) {
  if (!graph.nodesById[fromId] || !graph.nodesById[toId]) throw new Error('minimum path endpoints must exist');
  const costs = { [fromId]: 0 };
  const nodes = graph.nodes.slice().sort((a, b) => a.layer - b.layer || a.index - b.index || a.id.localeCompare(b.id));
  for (const node of nodes) {
    if (costs[node.id] == null) continue;
    for (const edgeId of graph.outgoing[node.id] || []) {
      const edge = graph.edgesById[edgeId];
      const cost = costs[node.id] + edge.cost;
      if (costs[edge.to] == null || cost < costs[edge.to]) costs[edge.to] = cost;
    }
  }
  return costs[toId] ?? Infinity;
}

function validateActGraph(graph, options = {}) {
  const errors = [];
  if (!graph || graph.format !== 'rpchess-act-graph') return Object.freeze({ ok: false, errors: Object.freeze(['invalid graph format']) });
  const minNodes = graph.stageB || options.requireStageB ? STAGE_B_NODE_MIN : 9;
  if (graph.nodes.length < minNodes || graph.nodes.length > STAGE_B_NODE_MAX) errors.push(`node count ${graph.nodes.length} is outside ${minNodes}–${STAGE_B_NODE_MAX}`);
  const ids = graph.nodes.map((node) => node.id);
  if (new Set(ids).size !== ids.length) errors.push('node IDs are not unique');
  const edgeIds = graph.edges.map((edge) => edge.id);
  if (new Set(edgeIds).size !== edgeIds.length) errors.push('edge IDs are not unique');

  const start = graph.nodesById[graph.startNodeId];
  const boss = graph.nodesById[graph.bossNodeId];
  if (!start || start.type !== 'start') errors.push('graph start node is missing or invalid');
  if (!boss || boss.type !== 'boss') errors.push('graph boss node is missing or invalid');

  for (const node of graph.nodes) {
    if (!NODE_TYPES.includes(node.type)) errors.push(`${node.id} has invalid node type ${node.type}`);
    if (!Number.isInteger(node.layer) || node.layer < 0) errors.push(`${node.id} has invalid layer`);
    if (options.requireContent && !['start'].includes(node.type) && !node.contentId) errors.push(`${node.id} has no compiled contentId`);
    if (graph.stageB && !['start', 'boss'].includes(node.type)) {
      if (!Number.isInteger(node.danger) || node.danger < 1 || node.danger > 5) errors.push(`${node.id} has invalid danger`);
      if (!node.emergencyTo || !graph.nodesById[node.emergencyTo]) errors.push(`${node.id} has no valid emergency convergence`);
      else if (graph.nodesById[node.emergencyTo].layer <= node.layer) errors.push(`${node.id} emergency convergence is not forward`);
    }
  }

  for (const edge of graph.edges) {
    const from = graph.nodesById[edge.from];
    const to = graph.nodesById[edge.to];
    if (!from || !to) errors.push(`${edge.id} references missing node`);
    else if (to.layer !== from.layer + 1) errors.push(`${edge.id} must connect adjacent forward layers`);
    if (!Number.isInteger(edge.cost) || edge.cost < 1 || edge.cost > 3) errors.push(`${edge.id} has invalid supply cost`);
  }

  if (start && (graph.incoming[start.id] || []).length) errors.push('start node must not have incoming edges');
  if (boss && (graph.outgoing[boss.id] || []).length) errors.push('boss node must not have outgoing edges');
  for (const node of graph.nodes) {
    if (node.id !== graph.startNodeId && !(graph.incoming[node.id] || []).length) errors.push(`${node.id} is unreachable from previous layer`);
    if (node.id !== graph.bossNodeId && !(graph.outgoing[node.id] || []).length) errors.push(`${node.id} is a dead end`);
  }

  if (start) {
    const forward = reachableFrom(graph, start.id, 'outgoing');
    for (const node of graph.nodes) if (!forward.has(node.id)) errors.push(`${node.id} is not reachable from start`);
  }
  if (boss) {
    const backward = reachableFrom(graph, boss.id, 'incoming');
    for (const node of graph.nodes) if (!backward.has(node.id)) errors.push(`${node.id} cannot reach boss`);
  }

  const middle = graph.nodes.filter((node) => !['start', 'boss'].includes(node.type));
  if (!middle.some((node) => node.type === 'event')) errors.push('act has no event node');
  if (!middle.some((node) => ECONOMY_TYPES.includes(node.type))) errors.push('act has no specialized service node');
  if (!middle.some((node) => node.type === 'elite')) errors.push('act has no elite node');
  if (start && boss && minimumPathCost(graph) === Infinity) errors.push('boss has no finite supply-cost path');
  if (graph.stageB) {
    if (graph.routeNodeCount < 9 || graph.routeNodeCount > 11) errors.push(`route visits ${graph.routeNodeCount} nodes instead of 9–11`);
    if (!Array.isArray(graph.convergenceNodeIds) || graph.convergenceNodeIds.length < 3) errors.push('Stage B graph needs at least three convergence points');
    for (const nodeId of graph.secretNodeIds || []) {
      const node = graph.nodesById[nodeId];
      const layerPeers = graph.nodes.filter((candidate) => candidate.layer === node.layer && candidate.id !== nodeId && !candidate.secret);
      if (!layerPeers.length) errors.push(`${nodeId} is a mandatory secret route`);
    }
  }

  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

function assertValidActGraph(graph, options = {}) {
  const report = validateActGraph(graph, options);
  if (!report.ok) { const error = new Error(`act graph validation failed with ${report.errors.length} error(s)`); error.details = report.errors; throw error; }
  return graph;
}

function batchValidateActGraphs(options = {}) {
  const count = options.count ?? 10000;
  if (!Number.isInteger(count) || count < 1) throw new Error('batch count must be positive');
  if (typeof options.generate !== 'function') throw new Error('batch generator function is required');
  const failures = [];
  const nodeCounts = {};
  const typeCounts = {};
  let totalEdges = 0;
  let totalCost = 0;
  let totalMinimumPathCost = 0;
  for (let index = 0; index < count; index += 1) {
    const seed = index + (options.seedStart || 1);
    const graph = options.generate(seed);
    const report = validateActGraph(graph, options.validation || {});
    if (!report.ok) failures.push(Object.freeze({ seed, errors: report.errors }));
    nodeCounts[graph.nodes.length] = (nodeCounts[graph.nodes.length] || 0) + 1;
    for (const node of graph.nodes) typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
    totalEdges += graph.edges.length;
    totalCost += graph.edges.reduce((sum, edge) => sum + edge.cost, 0);
    totalMinimumPathCost += minimumPathCost(graph);
  }
  return Object.freeze({
    count,
    ok: failures.length === 0,
    failures: Object.freeze(failures),
    nodeCounts: Object.freeze(nodeCounts),
    typeCounts: Object.freeze(typeCounts),
    averageEdges: totalEdges / count,
    averageEdgeCost: totalEdges ? totalCost / totalEdges : 0,
    averageMinimumPathCost: totalMinimumPathCost / count
  });
}

module.exports = { reachableFrom, minimumPathCost, validateActGraph, assertValidActGraph, batchValidateActGraphs };
