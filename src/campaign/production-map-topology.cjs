'use strict';

const { hash32, XorShift32 } = require('../core/determinism.cjs');
const {
  GENERATOR_VERSION, GRAPH_SCHEMA_VERSION, MAX_GENERATION_ATTEMPTS,
  MAP_NODE_MIN, MAP_NODE_MAX, ROUTE_NODE_MIN, ROUTE_NODE_MAX,
  SERVICE_TYPES, NODE_TYPES, DANGER_RANGES, BRANCH_PROFILES,
  MACRO_TEMPLATES, RESERVE_TEMPLATE_ID, RESERVE_WIDTHS,
  freezeArray, deepFreeze, weightedPick, phaseForLayer, categoryForType, phaseEntries
} = require('./production-map-contract.cjs');

function nextConvergenceLayer(layer) {
  if (layer < 3) return 3;
  if (layer < 6) return 6;
  if (layer < 9) return 9;
  return 10;
}
function mirroredIndex(width, index, mirrored) { return mirrored ? width - index - 1 : index; }
function nodeId(layer, index) { return layer === 0 ? 'start' : layer === 10 ? 'boss' : `l${layer}_n${index + 1}`; }
function createLayers(widths, mirrored) {
  const layers = [[{ id: 'start', layer: 0, index: 0 }]];
  widths.forEach((width, offset) => {
    const layer = offset + 1;
    const row = Array.from({ length: width }, (_unused, rawIndex) => {
      const index = mirroredIndex(width, rawIndex, mirrored);
      return { id: nodeId(layer, index), layer, index };
    }).sort((a, b) => a.index - b.index);
    layers.push(row);
  });
  layers.push([{ id: 'boss', layer: 10, index: 0 }]);
  return layers;
}
function addEdge(edges, keys, from, to, attributes = {}) {
  const key = `${from.id}->${to.id}`;
  if (keys.has(key)) return;
  keys.add(key);
  edges.push({ id: `edge_${from.id}_${to.id}`, from: from.id, to: to.id, cost: 1, emergency: false, reopenable: Boolean(attributes.reopenable) });
}
function connectLayerPair(fromLayer, toLayer, style, rng, edges, mirrored) {
  const keys = new Set(edges.map((edge) => `${edge.from}->${edge.to}`));
  if (toLayer.length === 1) { for (const from of fromLayer) addEdge(edges, keys, from, toLayer[0]); return; }
  if (fromLayer.length === 1) {
    for (const to of toLayer) addEdge(edges, keys, fromLayer[0], to, { reopenable: to.index > 0 });
    return;
  }
  const targetIndex = (fromIndex, offset = 0) => {
    const base = Math.min(toLayer.length - 1, Math.floor(fromIndex * toLayer.length / fromLayer.length));
    const adjusted = (base + offset + toLayer.length) % toLayer.length;
    return mirrored ? toLayer.length - adjusted - 1 : adjusted;
  };
  for (let index = 0; index < fromLayer.length; index += 1) {
    const from = fromLayer[index];
    const primary = targetIndex(index, style === 'cross' ? 1 : 0);
    addEdge(edges, keys, from, toLayer[primary], { reopenable: style === 'split' && index === fromLayer.length - 1 });
    const chance = style === 'fan' ? 0.8 : style === 'weave' ? 0.66 : style === 'parallel' ? 0.28 : 0.5;
    if (rng.float() < chance) addEdge(edges, keys, from, toLayer[targetIndex(index, 1)], { reopenable: true });
  }
  for (const to of toLayer) {
    if (!edges.some((edge) => edge.to === to.id)) {
      const sourceIndex = Math.min(fromLayer.length - 1, Math.floor(to.index * fromLayer.length / toLayer.length));
      addEdge(edges, keys, fromLayer[sourceIndex], to, { reopenable: style === 'stagger' });
    }
  }
}
function branchProfile(template, layer, index, mirrored) {
  const profiles = template.profiles || BRANCH_PROFILES;
  const resolvedIndex = mirrored ? Math.max(0, profiles.length - index - 1) : index;
  return profiles[(resolvedIndex + layer) % profiles.length];
}
function pickNormalType(rng, phase) {
  const category = weightedPick(rng, phaseEntries(phase));
  return category === 'service' ? weightedPick(rng, SERVICE_TYPES.map((value) => ({ value, weight: 25 }))) : category;
}
function dangerFor(rng, phase, type) {
  const range = type === 'elite' ? DANGER_RANGES.elite : type === 'boss' ? DANGER_RANGES.boss : DANGER_RANGES[phase];
  return rng.int(range[0], range[1]);
}
function createNode(source, template, mirrored, rootSeed, attemptSeed, rng, fallback = false) {
  const { id, layer, index } = source;
  const convergence = [0, 3, 6, 9, 10].includes(layer);
  const phase = layer === 0 ? 'early' : layer === 10 ? 'late' : phaseForLayer(layer);
  let type;
  if (layer === 0) type = 'start';
  else if (layer === 10) type = 'boss';
  else if (layer === 7) type = 'elite';
  else if (fallback) type = ['battle', 'event', 'battle', 'shop', 'battle', 'event', 'elite', 'battle', 'event'][layer - 1];
  else type = pickNormalType(rng, phase);
  if (layer === 1 && index === 0) type = 'battle';
  return {
    id, layer, index, type, category: categoryForType(type), phase,
    danger: type === 'start' ? 0 : dangerFor(rng, phase, type),
    branchProfile: type === 'start' || type === 'boss' ? 'mandatory' : branchProfile(template, layer, index, mirrored),
    convergence, mandatory: type === 'elite' || type === 'boss',
    requiredRosterContract: type === 'elite' || type === 'boss' ? 'king_only_compatible' : null,
    nodeSeed: hash32(`${rootSeed}:${attemptSeed}:${id}`),
    contentSeed: hash32(`${attemptSeed}:node:${id}:content`),
    contentVersion: 1, contentId: null, contentSlot: type,
    emergencyTo: layer === 10 ? null : nodeId(nextConvergenceLayer(layer), 0),
    materialized: false
  };
}
function buildCandidate(options, attemptIndex, fallback = false) {
  const rootSeed = Number(options.rootSeed ?? options.seed ?? 1) >>> 0;
  const act = Number(options.act ?? 1);
  const regionId = String(options.regionId || 'region.iron_marches');
  const attemptSeed = hash32(`${rootSeed}:map-generator:${GENERATOR_VERSION}:attempt:${attemptIndex}`);
  const chooser = new XorShift32(attemptSeed);
  const template = fallback
    ? { id: RESERVE_TEMPLATE_ID, widths: RESERVE_WIDTHS, edgeStyle: 'parallel', profiles: ['fortified', 'direct', 'resource'] }
    : MACRO_TEMPLATES[chooser.int(0, MACRO_TEMPLATES.length - 1)];
  const mirrored = fallback ? false : chooser.float() < 0.5;
  const layers = createLayers(template.widths, mirrored);
  const edges = [];
  for (let index = 0; index < layers.length - 1; index += 1) connectLayerPair(layers[index], layers[index + 1], template.edgeStyle, chooser, edges, mirrored);
  const nodes = layers.flat().map((source) => createNode(source, template, mirrored, rootSeed, attemptSeed, chooser, fallback));
  const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const outgoing = {}; const incoming = {};
  for (const edge of edges) { (outgoing[edge.from] ||= []).push(edge.id); (incoming[edge.to] ||= []).push(edge.id); }
  const secretChecks = Object.fromEntries(nodes
    .filter((node) => !['start', 'boss', 'elite', ...SERVICE_TYPES].includes(node.type))
    .map((node) => [node.id, deepFreeze({ sourceNodeId: node.id, checkSeed: hash32(`${node.nodeSeed}:secret-check`), contentSeed: hash32(`${node.nodeSeed}:secret-content`), chance: 10 })]));
  return deepFreeze({
    format: 'rpchess-act-graph', schemaVersion: GRAPH_SCHEMA_VERSION, generatorVersion: GENERATOR_VERSION,
    graphId: `act_${act}_${hash32(`${rootSeed}:${regionId}:${attemptIndex}:${template.id}:${mirrored}`).toString(36)}`,
    rootSeed, seed: rootSeed, attemptIndex, attemptSeed, macroTemplateId: template.id, isMirrored: mirrored,
    act, regionId, stageB: true, fallbackUsed: fallback,
    routeNodeCount: 11, startNodeId: 'start', eliteNodeId: 'l7_n1', bossNodeId: 'boss',
    convergenceNodeIds: freezeArray(['l3_n1', 'l6_n1', 'l9_n1']), secretChecks: deepFreeze(secretChecks),
    nodes: freezeArray(nodes), edges: freezeArray(edges.map((edge) => deepFreeze(edge))),
    nodesById: deepFreeze(nodesById), edgesById: deepFreeze(Object.fromEntries(edges.map((edge) => [edge.id, edge]))),
    outgoing: deepFreeze(Object.fromEntries(Object.entries(outgoing).map(([key, value]) => [key, freezeArray(value)]))),
    incoming: deepFreeze(Object.fromEntries(Object.entries(incoming).map(([key, value]) => [key, freezeArray(value)]))),
    debug: deepFreeze({ generatorVersion: GENERATOR_VERSION, rootSeed, attemptIndex, attemptSeed, macroTemplateId: template.id, isMirrored: mirrored })
  });
}

module.exports = { nextConvergenceLayer, nodeId, createLayers, buildCandidate };
