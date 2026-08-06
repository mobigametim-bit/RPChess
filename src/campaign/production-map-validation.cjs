'use strict';

const { GENERATOR_VERSION, GRAPH_SCHEMA_VERSION, MAX_GENERATION_ATTEMPTS, MAP_NODE_MIN, MAP_NODE_MAX, ROUTE_NODE_MIN, ROUTE_NODE_MAX, NODE_TYPES, deepFreeze } = require('./production-map-contract.cjs');

function reachable(graph, startId, direction = 'outgoing') {
  const visited = new Set([startId]); const queue = [startId];
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
function validateProductionActGraph(graph) {
  const errors = [];
  if (!graph || graph.format !== 'rpchess-act-graph' || graph.schemaVersion !== GRAPH_SCHEMA_VERSION) return deepFreeze({ ok: false, errors: ['invalid production graph format'] });
  if (graph.generatorVersion !== GENERATOR_VERSION) errors.push('generatorVersion mismatch');
  if (!Number.isInteger(graph.rootSeed)) errors.push('rootSeed is missing');
  if (!Number.isInteger(graph.attemptIndex) || graph.attemptIndex < 0 || graph.attemptIndex >= MAX_GENERATION_ATTEMPTS) errors.push('attemptIndex is invalid');
  if (!graph.macroTemplateId) errors.push('macroTemplateId is missing');
  if (typeof graph.isMirrored !== 'boolean') errors.push('isMirrored is missing');
  if (graph.nodes.length < MAP_NODE_MIN || graph.nodes.length > MAP_NODE_MAX) errors.push(`node count ${graph.nodes.length} is outside ${MAP_NODE_MIN}-${MAP_NODE_MAX}`);
  if (graph.routeNodeCount < ROUTE_NODE_MIN || graph.routeNodeCount > ROUTE_NODE_MAX) errors.push(`routeNodeCount ${graph.routeNodeCount} is outside ${ROUTE_NODE_MIN}-${ROUTE_NODE_MAX}`);
  if (new Set(graph.nodes.map((node) => node.id)).size !== graph.nodes.length) errors.push('node IDs are not unique');
  if (new Set(graph.edges.map((edge) => edge.id)).size !== graph.edges.length) errors.push('edge IDs are not unique');
  for (const node of graph.nodes) {
    if (!NODE_TYPES.includes(node.type)) errors.push(`${node.id} has invalid type ${node.type}`);
    if (!['early', 'mid', 'late'].includes(node.phase)) errors.push(`${node.id} has invalid phase`);
    if (!Number.isInteger(node.nodeSeed) || !Number.isInteger(node.contentSeed)) errors.push(`${node.id} lacks derived seeds`);
    if (node.contentId !== null || node.materialized !== false) errors.push(`${node.id} was materialized during topology generation`);
    if (node.id !== graph.bossNodeId && (!node.emergencyTo || !graph.nodesById[node.emergencyTo])) errors.push(`${node.id} has no emergency convergence`);
  }
  for (const edge of graph.edges) {
    const from = graph.nodesById[edge.from]; const to = graph.nodesById[edge.to];
    if (!from || !to) errors.push(`${edge.id} references a missing node`);
    else if (to.layer !== from.layer + 1) errors.push(`${edge.id} does not connect adjacent levels`);
    if (edge.cost !== 1) errors.push(`${edge.id} must cost exactly 1 supply`);
  }
  const forward = reachable(graph, graph.startNodeId, 'outgoing');
  const backward = reachable(graph, graph.bossNodeId, 'incoming');
  for (const node of graph.nodes) {
    if (!forward.has(node.id)) errors.push(`${node.id} is unreachable from start`);
    if (!backward.has(node.id)) errors.push(`${node.id} cannot reach boss`);
  }
  if (!graph.nodes.some((node) => node.phase === 'early' && node.type === 'battle' && node.layer < 3)) errors.push('no normal battle exists before first convergence');
  if (graph.nodesById[graph.eliteNodeId]?.type !== 'elite') errors.push('elite node is missing');
  if (graph.nodesById[graph.bossNodeId]?.type !== 'boss') errors.push('boss node is missing');
  if (graph.nodesById[graph.eliteNodeId]?.requiredRosterContract !== 'king_only_compatible') errors.push('elite universal roster contract is missing');
  if (graph.nodesById[graph.bossNodeId]?.requiredRosterContract !== 'king_only_compatible') errors.push('boss universal roster contract is missing');
  return deepFreeze({ ok: errors.length === 0, errors });
}

module.exports = { reachable, validateProductionActGraph };
