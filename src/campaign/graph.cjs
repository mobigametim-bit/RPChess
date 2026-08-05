'use strict';

const { RngStreams, hash32 } = require('../core/determinism.cjs');

const NODE_TYPES = Object.freeze(['start', 'battle', 'elite', 'event', 'shop', 'service', 'treasure', 'boss']);
const ECONOMY_TYPES = Object.freeze(['shop', 'service']);

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function weightedPick(rng, entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!(total > 0)) throw new Error('weighted pick requires positive total weight');
  let roll = rng.float() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll < 0) return entry.value;
  }
  return entries[entries.length - 1].value;
}

function middleLayerCounts(nodeCount) {
  if (!Number.isInteger(nodeCount) || nodeCount < 9 || nodeCount > 12) throw new Error('act nodeCount must be between 9 and 12');
  const middleNodes = nodeCount - 2;
  const layerCount = Math.max(4, Math.min(5, Math.ceil(middleNodes / 2)));
  const counts = Array(layerCount).fill(1);
  let remaining = middleNodes - layerCount;
  let cursor = 0;
  while (remaining > 0) {
    if (counts[cursor] < 3) {
      counts[cursor] += 1;
      remaining -= 1;
    }
    cursor = (cursor + 1) % counts.length;
  }
  return Object.freeze(counts);
}

function nodeTypeWeights(act, layerIndex, middleLayerTotal) {
  const early = layerIndex <= 1;
  const late = layerIndex >= middleLayerTotal - 1;
  const weights = [
    { value: 'battle', weight: early ? 42 : 34 },
    { value: 'event', weight: early ? 30 : 22 },
    { value: 'shop', weight: early ? 8 : 13 },
    { value: 'service', weight: early ? 7 : 12 },
    { value: 'treasure', weight: late ? 10 : 6 }
  ];
  if (act >= 2 && !early) weights.push({ value: 'elite', weight: late ? 24 : 12 });
  return weights;
}

function assignNodeTypes(layers, act, rng) {
  const middle = layers.slice(1, -1);
  for (let layerOffset = 0; layerOffset < middle.length; layerOffset += 1) {
    for (const node of middle[layerOffset]) {
      node.type = weightedPick(rng, nodeTypeWeights(act, layerOffset, middle.length));
    }
  }

  const all = middle.flat();
  if (!all.some((node) => node.type === 'event')) all[rng.int(0, all.length - 1)].type = 'event';
  if (!all.some((node) => ECONOMY_TYPES.includes(node.type))) {
    const candidates = all.filter((node) => node.type !== 'event');
    (candidates.length ? rng.pick(candidates) : rng.pick(all)).type = rng.pick(ECONOMY_TYPES);
  }
  if (act >= 2 && !all.some((node) => node.type === 'elite')) {
    const late = middle.slice(Math.floor(middle.length / 2)).flat().filter((node) => !['event', 'shop', 'service'].includes(node.type));
    (late.length ? rng.pick(late) : rng.pick(all)).type = 'elite';
  }

  for (const layer of middle) {
    const battles = layer.filter((node) => node.type === 'battle');
    if (battles.length === layer.length && layer.length > 1) rng.pick(battles).type = 'event';
  }
}

function connectLayers(fromLayer, toLayer, rng, edges) {
  const keys = new Set();
  const add = (from, to) => {
    const key = `${from.id}->${to.id}`;
    if (keys.has(key)) return;
    keys.add(key);
    edges.push({
      id: `edge_${from.id}_${to.id}`,
      from: from.id,
      to: to.id,
      cost: rng.int(1, 3)
    });
  };

  for (const from of fromLayer) add(from, rng.pick(toLayer));
  for (const to of toLayer) add(rng.pick(fromLayer), to);
  for (const from of fromLayer) {
    for (const to of toLayer) {
      if (rng.float() < 0.28) add(from, to);
    }
  }
}

function createLayers(nodeCount) {
  const counts = middleLayerCounts(nodeCount);
  const layers = [[{ id: 'start', layer: 0, index: 0, type: 'start' }]];
  counts.forEach((count, offset) => {
    const layer = offset + 1;
    layers.push(Array.from({ length: count }, (_unused, index) => ({
      id: `l${layer}_n${index + 1}`,
      layer,
      index,
      type: null
    })));
  });
  const bossLayer = layers.length;
  layers.push([{ id: 'boss', layer: bossLayer, index: 0, type: 'boss' }]);
  return layers;
}

function contentPoolKey(type) {
  if (type === 'battle' || type === 'elite') return 'encounters';
  if (type === 'event') return 'events';
  if (type === 'boss') return 'bosses';
  if (type === 'shop') return 'shops';
  if (type === 'service') return 'services';
  if (type === 'treasure') return 'treasures';
  return null;
}

function assignContent(nodes, pools, rng) {
  const queues = {};
  for (const [key, values] of Object.entries(pools || {})) {
    if (!Array.isArray(values)) throw new Error(`content pool ${key} must be an array`);
    queues[key] = rng.shuffle(values.map(String));
  }
  const cursors = {};
  return nodes.map((node) => {
    const key = contentPoolKey(node.type);
    if (!key) return Object.freeze({ ...node, contentId: null, contentSlot: node.type });
    const pool = queues[key] || [];
    const cursor = cursors[key] || 0;
    const contentId = pool.length ? pool[cursor % pool.length] : null;
    cursors[key] = cursor + 1;
    return Object.freeze({
      ...node,
      contentId,
      contentSlot: contentId ? null : `${node.type}.${node.layer}.${node.index}`
    });
  });
}

function generateActGraph(options = {}) {
  const act = options.act ?? 1;
  if (!Number.isInteger(act) || act < 1 || act > 3) throw new Error('act must be 1, 2 or 3');
  const nodeCount = options.nodeCount ?? 9 + (hash32(`${options.seed || 1}:act:${act}`) % 4);
  const regionId = String(options.regionId || 'region.neutral');
  if (!/^region\.[a-z0-9][a-z0-9_-]*$/.test(regionId)) throw new Error('regionId must use region.* format');
  const seed = options.seed || 1;
  const streams = new RngStreams(seed);
  const layoutRng = streams.get(`campaign.act${act}.layout`);
  const typeRng = streams.get(`campaign.act${act}.types`);
  const contentRng = streams.get(`campaign.act${act}.content`);
  const layers = createLayers(nodeCount);
  assignNodeTypes(layers, act, typeRng);
  const edges = [];
  for (let index = 0; index < layers.length - 1; index += 1) connectLayers(layers[index], layers[index + 1], layoutRng, edges);
  const nodes = assignContent(layers.flat(), options.contentPools || {}, contentRng);
  const nodesById = Object.freeze(Object.fromEntries(nodes.map((node) => [node.id, node])));
  const outgoing = {};
  const incoming = {};
  for (const edge of edges) {
    (outgoing[edge.from] ||= []).push(edge.id);
    (incoming[edge.to] ||= []).push(edge.id);
  }
  return Object.freeze({
    format: 'rpchess-act-graph',
    schemaVersion: 1,
    graphId: `act_${act}_${hash32(`${seed}:${regionId}`).toString(36)}`,
    seed,
    act,
    regionId,
    startNodeId: 'start',
    bossNodeId: 'boss',
    nodes: freezeArray(nodes),
    edges: freezeArray(edges.map((edge) => Object.freeze(edge))),
    nodesById,
    edgesById: Object.freeze(Object.fromEntries(edges.map((edge) => [edge.id, Object.freeze(edge)]))),
    outgoing: Object.freeze(Object.fromEntries(Object.entries(outgoing).map(([id, values]) => [id, freezeArray(values)]))),
    incoming: Object.freeze(Object.fromEntries(Object.entries(incoming).map(([id, values]) => [id, freezeArray(values)]))),
    rng: Object.freeze(streams.snapshot())
  });
}

module.exports = {
  NODE_TYPES,
  ECONOMY_TYPES,
  weightedPick,
  middleLayerCounts,
  contentPoolKey,
  generateActGraph
};
