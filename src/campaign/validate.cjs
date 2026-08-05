'use strict';

const { NODE_TYPES, ECONOMY_TYPES } = require('./graph.cjs');

function reachableFrom(graph, startId, direction = 'outgoing') {
  const visited = new Set([startId]);
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift();
    const edgeIds = graph[direction][current] || [];
    for (const edgeId of edgeIds) {
      const edge = graph.edgesById[edgeId];
      const next = direction === 'outgoing' ? edge.to : edge.from;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

function validateActGraph(graph, options = {}) {
  const errors = [];
  if (!graph || graph.format !== 'rpchess-act-graph') return Object.freeze({ ok: false, errors: Object.freeze(['invalid graph format']) });
  if (graph.nodes.length < 9 || graph.nodes.length > 12) errors.push(`node count ${graph.nodes.length} is outside 9–12`);
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
  if (!middle.some((node) => ECONOMY_TYPES.includes(node.type))) errors.push('act has no shop/service node');
  if (graph.act >= 2 && !middle.some((node) => node.type === 'elite')) errors.push('act 2–3 has no elite node');

  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

function assertValidActGraph(graph, options = {}) {
  const report = validateActGraph(graph, options);
  if (!report.ok) {
    const error = new Error(`act graph validation failed with ${report.errors.length} error(s)`);
    error.details = report.errors;
    throw error;
  }
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
  for (let index = 0; index < count; index += 1) {
    const graph = options.generate(index + (options.seedStart || 1));
    const report = validateActGraph(graph, options.validation || {});
    if (!report.ok) failures.push(Object.freeze({ seed: index + (options.seedStart || 1), errors: report.errors }));
    nodeCounts[graph.nodes.length] = (nodeCounts[graph.nodes.length] || 0) + 1;
    for (const node of graph.nodes) typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
    totalEdges += graph.edges.length;
    totalCost += graph.edges.reduce((sum, edge) => sum + edge.cost, 0);
  }
  return Object.freeze({
    count,
    ok: failures.length === 0,
    failures: Object.freeze(failures),
    nodeCounts: Object.freeze(nodeCounts),
    typeCounts: Object.freeze(typeCounts),
    averageEdges: totalEdges / count,
    averageEdgeCost: totalEdges ? totalCost / totalEdges : 0
  });
}

module.exports = {
  reachableFrom,
  validateActGraph,
  assertValidActGraph,
  batchValidateActGraphs
};
