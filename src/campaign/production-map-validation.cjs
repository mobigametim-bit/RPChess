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
function routeLengthRange(graph) {
  const ordered = graph.nodes.slice().sort((a, b) => a.layer - b.layer || a.index - b.index);
  const minimum = { [graph.startNodeId]: 1 };
  const maximum = { [graph.startNodeId]: 1 };
  for (const node of ordered) {
    if (node.id === graph.startNodeId) continue;
    const predecessors = (graph.incoming[node.id] || []).map((edgeId) => graph.edgesById[edgeId].from);
    const minimumValues = predecessors.map((id) => minimum[id]).filter(Number.isFinite);
    const maximumValues = predecessors.map((id) => maximum[id]).filter(Number.isFinite);
    if (minimumValues.length) minimum[node.id] = Math.min(...minimumValues) + 1;
    if (maximumValues.length) maximum[node.id] = Math.max(...maximumValues) + 1;
  }
  return deepFreeze({ minimum: minimum[graph.bossNodeId] ?? null, maximum: maximum[graph.bossNodeId] ?? null });
}
function phaseLayerCounts(graph) {
  const layers = { early: new Set(), mid: new Set(), late: new Set() };
  for (const node of graph.nodes) if (node.id !== graph.startNodeId) layers[node.phase]?.add(node.layer);
  return deepFreeze(Object.fromEntries(Object.entries(layers).map(([phase, values]) => [phase, values.size])));
}
function layerWidths(graph) {
  const widths = {};
  for (const node of graph.nodes) widths[node.layer] = (widths[node.layer] || 0) + 1;
  return deepFreeze(widths);
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
  const routeLengths = routeLengthRange(graph);
  if (!Number.isInteger(routeLengths.minimum) || routeLengths.minimum < ROUTE_NODE_MIN || routeLengths.minimum > ROUTE_NODE_MAX) errors.push(`minimum route length ${routeLengths.minimum} is outside ${ROUTE_NODE_MIN}-${ROUTE_NODE_MAX}`);
  if (!Number.isInteger(routeLengths.maximum) || routeLengths.maximum < ROUTE_NODE_MIN || routeLengths.maximum > ROUTE_NODE_MAX) errors.push(`maximum route length ${routeLengths.maximum} is outside ${ROUTE_NODE_MIN}-${ROUTE_NODE_MAX}`);
  if (graph.routeNodeCount !== routeLengths.maximum) errors.push(`declared routeNodeCount ${graph.routeNodeCount} differs from computed ${routeLengths.maximum}`);
  const phaseCounts = phaseLayerCounts(graph);
  if (phaseCounts.early < 2 || phaseCounts.early > 4) errors.push(`early phase length ${phaseCounts.early} is outside 2-4`);
  if (phaseCounts.mid < 3 || phaseCounts.mid > 5) errors.push(`mid phase length ${phaseCounts.mid} is outside 3-5`);
  if (phaseCounts.late < 2 || phaseCounts.late > 3) errors.push(`late phase length ${phaseCounts.late} is outside 2-3`);
  for (const [phase, count] of Object.entries(phaseCounts)) if (count > routeLengths.maximum / 2) errors.push(`${phase} phase occupies more than half of the route`);
  const widths = layerWidths(graph);
  for (const [layer, width] of Object.entries(widths)) if (width > 1 && (width < 2 || width > 3)) errors.push(`fork layer ${layer} has invalid width ${width}`);
  const convergenceLayers = [0, ...(graph.convergenceNodeIds || []).map((id) => graph.nodesById[id]?.layer), graph.nodesById[graph.bossNodeId]?.layer];
  if (convergenceLayers.some((layer) => !Number.isInteger(layer))) errors.push('convergence node is missing');
  else for (let index = 1; index < convergenceLayers.length; index += 1) {
    const visitedBetween = convergenceLayers[index] - convergenceLayers[index - 1];
    if (visitedBetween < 1 || visitedBetween > 3) errors.push(`convergence spacing ${visitedBetween} is outside 1-3`);
  }
  if (!graph.nodes.some((node) => node.phase === 'early' && node.type === 'battle' && node.layer < 3)) errors.push('no normal battle exists before first convergence');
  if (graph.nodesById[graph.eliteNodeId]?.type !== 'elite') errors.push('elite node is missing');
  if (graph.nodesById[graph.bossNodeId]?.type !== 'boss') errors.push('boss node is missing');
  if (graph.nodesById[graph.eliteNodeId]?.requiredRosterContract !== 'king_only_compatible') errors.push('elite universal roster contract is missing');
  if (graph.nodesById[graph.bossNodeId]?.requiredRosterContract !== 'king_only_compatible') errors.push('boss universal roster contract is missing');
  return deepFreeze({ ok: errors.length === 0, errors, routeLengths, phaseCounts, widths });
}

module.exports = { reachable, routeLengthRange, phaseLayerCounts, layerWidths, validateProductionActGraph };
