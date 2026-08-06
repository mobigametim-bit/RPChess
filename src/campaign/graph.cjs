'use strict';

const { RngStreams, hash32 } = require('../core/determinism.cjs');

const SERVICE_TYPES = Object.freeze(['shop', 'hospital', 'forge', 'camp']);
const NODE_TYPES = Object.freeze(['start', 'battle', 'elite', 'event', ...SERVICE_TYPES, 'treasure', 'recovery', 'boss']);
const ECONOMY_TYPES = SERVICE_TYPES;
const STAGE_B_NODE_MIN = 18;
const STAGE_B_NODE_MAX = 24;
const STAGE_B_MIDDLE_LAYERS = 9;
const STAGE_B_CONVERGENCE_LAYERS = Object.freeze([3, 6, 9]);

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

function legacyMiddleLayerCounts(nodeCount) {
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

function stageBMiddleLayerCounts(nodeCount) {
  const middleNodes = nodeCount - 2;
  const counts = Array(STAGE_B_MIDDLE_LAYERS).fill(2);
  for (const layer of STAGE_B_CONVERGENCE_LAYERS) counts[layer - 1] = 1;
  let remaining = middleNodes - counts.reduce((sum, value) => sum + value, 0);
  const branchLayers = [0, 1, 3, 4, 6, 7];
  let cursor = 0;
  while (remaining > 0) {
    const layer = branchLayers[cursor % branchLayers.length];
    if (counts[layer] < 4) {
      counts[layer] += 1;
      remaining -= 1;
    }
    cursor += 1;
    if (cursor > 200) throw new Error('unable to distribute Stage B act nodes');
  }
  return Object.freeze(counts);
}

function middleLayerCounts(nodeCount) {
  if (!Number.isInteger(nodeCount) || nodeCount < 9 || nodeCount > STAGE_B_NODE_MAX) {
    throw new Error(`act nodeCount must be between 9 and ${STAGE_B_NODE_MAX}`);
  }
  return nodeCount >= STAGE_B_NODE_MIN ? stageBMiddleLayerCounts(nodeCount) : legacyMiddleLayerCounts(nodeCount);
}

function createLayers(nodeCount) {
  const counts = middleLayerCounts(nodeCount);
  const layers = [[{ id: 'start', layer: 0, index: 0, type: 'start', convergence: true }]];
  counts.forEach((count, offset) => {
    const layer = offset + 1;
    layers.push(Array.from({ length: count }, (_unused, index) => ({
      id: `l${layer}_n${index + 1}`,
      layer,
      index,
      type: null,
      convergence: count === 1,
      mandatory: false,
      secret: false
    })));
  });
  const bossLayer = layers.length;
  layers.push([{ id: 'boss', layer: bossLayer, index: 0, type: 'boss', convergence: true, mandatory: true, secret: false }]);
  return layers;
}

function stageBTypeFor(layer, index, rng) {
  if (layer === 1) return 'battle';
  if (layer === 2) return index === 0 ? 'event' : 'battle';
  if (layer === 3) return 'battle';
  if (layer === 4) return index === 0 ? rng.pick(SERVICE_TYPES) : index === 1 ? 'event' : 'battle';
  if (layer === 5) return index === 0 ? 'event' : 'battle';
  if (layer === 6) return 'battle';
  if (layer === 7) return index === 0 ? 'treasure' : index === 1 ? rng.pick(SERVICE_TYPES) : 'battle';
  if (layer === 8) return 'elite';
  if (layer === 9) return 'event';
  return weightedPick(rng, [
    { value: 'battle', weight: 50 },
    { value: 'event', weight: 25 },
    { value: rng.pick(SERVICE_TYPES), weight: 15 },
    { value: 'treasure', weight: 10 }
  ]);
}

function legacyTypeWeights(act, layerIndex, middleLayerTotal) {
  const early = layerIndex <= 1;
  const late = layerIndex >= middleLayerTotal - 1;
  const weights = [
    { value: 'battle', weight: early ? 42 : 34 },
    { value: 'event', weight: early ? 30 : 22 },
    { value: 'shop', weight: early ? 8 : 13 },
    { value: 'forge', weight: early ? 7 : 12 },
    { value: 'treasure', weight: late ? 10 : 6 }
  ];
  if (act >= 2 && !early) weights.push({ value: 'elite', weight: late ? 24 : 12 });
  return weights;
}

function forceMandatoryNodeTypes(all, act, rng) {
  const eventNode = all.find((node) => node.type === 'event') || rng.pick(all);
  const economyCandidates = all.filter((node) => node !== eventNode);
  const economyNode = economyCandidates.find((node) => ECONOMY_TYPES.includes(node.type)) || rng.pick(economyCandidates);
  eventNode.type = 'event';
  if (!ECONOMY_TYPES.includes(economyNode.type)) economyNode.type = rng.pick(ECONOMY_TYPES);
  const eliteCandidates = all.filter((node) => node !== eventNode && node !== economyNode);
  const eliteNode = eliteCandidates.find((node) => node.type === 'elite') || (act >= 1 ? rng.pick(eliteCandidates) : null);
  if (eliteNode) eliteNode.type = 'elite';
}

function assignNodeTypes(layers, act, rng, stageB) {
  const middle = layers.slice(1, -1);
  if (stageB) {
    for (const layer of middle) {
      for (const node of layer) node.type = stageBTypeFor(node.layer, node.index, rng);
    }
    const eliteLayer = middle.find((layer) => layer[0]?.layer === 8);
    if (eliteLayer) for (const node of eliteLayer) { node.type = 'elite'; node.mandatory = true; }
    const possibleSecrets = middle.flat().filter((node) => node.layer === 5 && !node.convergence);
    if (possibleSecrets.length > 1) {
      const secret = possibleSecrets[possibleSecrets.length - 1];
      secret.secret = true;
      secret.type = rng.float() < .5 ? 'treasure' : 'event';
    }
    forceMandatoryNodeTypes(middle.flat(), act, rng);
    return;
  }
  for (let layerOffset = 0; layerOffset < middle.length; layerOffset += 1) {
    for (const node of middle[layerOffset]) node.type = weightedPick(rng, legacyTypeWeights(act, layerOffset, middle.length));
  }
  for (const layer of middle) {
    const battles = layer.filter((node) => node.type === 'battle');
    if (battles.length === layer.length && layer.length > 1) rng.pick(battles).type = 'event';
  }
  forceMandatoryNodeTypes(middle.flat(), act, rng);
}

function connectLayers(fromLayer, toLayer, rng, edges, stageB) {
  const keys = new Set(edges.map((edge) => `${edge.from}->${edge.to}`));
  const add = (from, to) => {
    const key = `${from.id}->${to.id}`;
    if (keys.has(key)) return;
    keys.add(key);
    edges.push({
      id: `edge_${from.id}_${to.id}`,
      from: from.id,
      to: to.id,
      cost: stageB ? rng.int(1, 2) : rng.int(1, 3),
      emergency: false
    });
  };

  if (stageB) {
    if (toLayer.length === 1) {
      for (const from of fromLayer) add(from, toLayer[0]);
      return;
    }
    if (fromLayer.length === 1) {
      for (const to of toLayer) add(fromLayer[0], to);
      return;
    }
    for (let i = 0; i < fromLayer.length; i += 1) {
      const primary = Math.min(toLayer.length - 1, Math.floor(i * toLayer.length / fromLayer.length));
      add(fromLayer[i], toLayer[primary]);
      if (toLayer.length > 1 && rng.float() < .58) add(fromLayer[i], toLayer[(primary + 1) % toLayer.length]);
    }
    for (let i = 0; i < toLayer.length; i += 1) {
      if (!edges.some((edge) => edge.to === toLayer[i].id)) add(fromLayer[Math.min(fromLayer.length - 1, Math.floor(i * fromLayer.length / toLayer.length))], toLayer[i]);
    }
    return;
  }

  for (const from of fromLayer) add(from, rng.pick(toLayer));
  for (const to of toLayer) add(rng.pick(fromLayer), to);
  for (const from of fromLayer) for (const to of toLayer) if (rng.float() < 0.28) add(from, to);
}

function contentPoolKey(type) {
  if (type === 'battle' || type === 'elite') return 'encounters';
  if (type === 'event') return 'events';
  if (type === 'boss') return 'bosses';
  if (SERVICE_TYPES.includes(type)) return 'services';
  if (type === 'treasure' || type === 'recovery') return 'treasures';
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
    return Object.freeze({ ...node, contentId, contentSlot: contentId ? null : `${node.type}.${node.layer}.${node.index}` });
  });
}

function nextConvergenceId(layers, layerIndex) {
  for (let index = layerIndex + 1; index < layers.length; index += 1) {
    if (layers[index].length === 1) return layers[index][0].id;
  }
  return layers[layers.length - 1][0].id;
}

function enrichStageBNodes(nodes, layers, rng) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.map((node) => {
    if (node.type === 'start' || node.type === 'boss') return Object.freeze({ ...node, danger: node.type === 'boss' ? 5 : 0, branchLength: 0, emergencyTo: node.type === 'start' ? nextConvergenceId(layers, 0) : null, intel: Object.freeze({}) });
    const nextConvergence = nextConvergenceId(layers, node.layer);
    const branchLength = Math.max(0, (byId.get(nextConvergence)?.layer || node.layer) - node.layer);
    const danger = Math.min(5, Math.max(1, Math.ceil(node.layer / 2) + (node.type === 'elite' ? 1 : 0)));
    const archetypes = node.type === 'elite' ? ['тяжёлая пехота', 'командная фигура'] : node.type === 'battle' ? rng.shuffle(['пехота', 'стрелки', 'кавалерия']).slice(0, 2) : [];
    return Object.freeze({
      ...node,
      danger,
      branchLength,
      emergencyTo: nextConvergence,
      intel: Object.freeze({
        missionType: node.type === 'battle' ? rng.pick(['удержание рубежа', 'прорыв', 'защита короля', 'захват позиции']) : node.type === 'elite' ? 'элитное столкновение' : node.type,
        enemyArchetypes: freezeArray(archetypes),
        specialPieces: node.type === 'elite' || node.layer >= 7,
        environment: rng.pick(['укрепления', 'узкие проходы', 'опасные клетки', 'открытая линия']),
        firstMove: rng.float() < .72 ? 'player' : 'enemy',
        rewardCategory: node.type === 'elite' ? 'редкая' : node.type === 'battle' ? rng.pick(['реликвия', 'пополнение', 'ресурсы']) : node.type,
        risks: freezeArray([...(node.type === 'elite' ? ['тяжёлые ранения'] : []), ...(rng.float() < .18 ? ['засада'] : [])])
      })
    });
  });
}

function generateActGraph(options = {}) {
  const act = options.act ?? 1;
  if (!Number.isInteger(act) || act < 1 || act > 3) throw new Error('act must be 1, 2 or 3');
  const seed = options.seed || 1;
  const requestedStageB = options.stageB === true;
  const nodeCount = options.nodeCount ?? (requestedStageB
    ? STAGE_B_NODE_MIN + (hash32(`${seed}:act:${act}:stage-b`) % (STAGE_B_NODE_MAX - STAGE_B_NODE_MIN + 1))
    : 9 + (hash32(`${seed}:act:${act}`) % 4));
  const stageB = requestedStageB || nodeCount >= STAGE_B_NODE_MIN;
  const regionId = String(options.regionId || 'region.neutral');
  if (!/^region\.[a-z0-9][a-z0-9_-]*$/.test(regionId)) throw new Error('regionId must use region.* format');
  const streams = new RngStreams(seed);
  const layoutRng = streams.get(`campaign.act${act}.layout`);
  const typeRng = streams.get(`campaign.act${act}.types`);
  const contentRng = streams.get(`campaign.act${act}.content`);
  const intelRng = streams.get(`campaign.act${act}.intel`);
  const layers = createLayers(nodeCount);
  assignNodeTypes(layers, act, typeRng, stageB);
  const edges = [];
  for (let index = 0; index < layers.length - 1; index += 1) connectLayers(layers[index], layers[index + 1], layoutRng, edges, stageB);
  let nodes = assignContent(layers.flat(), options.contentPools || {}, contentRng);
  if (stageB) nodes = enrichStageBNodes(nodes, layers, intelRng);
  const nodesById = Object.freeze(Object.fromEntries(nodes.map((node) => [node.id, node])));
  const outgoing = {};
  const incoming = {};
  for (const edge of edges) {
    (outgoing[edge.from] ||= []).push(edge.id);
    (incoming[edge.to] ||= []).push(edge.id);
  }
  const convergenceNodeIds = nodes.filter((node) => node.convergence && !['start', 'boss'].includes(node.type)).map((node) => node.id);
  const secretNodeIds = nodes.filter((node) => node.secret).map((node) => node.id);
  return Object.freeze({
    format: 'rpchess-act-graph',
    schemaVersion: stageB ? 2 : 1,
    graphId: `act_${act}_${hash32(`${seed}:${regionId}:${nodeCount}`).toString(36)}`,
    seed,
    act,
    regionId,
    stageB,
    routeNodeCount: layers.length,
    startNodeId: 'start',
    bossNodeId: 'boss',
    convergenceNodeIds: freezeArray(convergenceNodeIds),
    secretNodeIds: freezeArray(secretNodeIds),
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
  SERVICE_TYPES,
  NODE_TYPES,
  ECONOMY_TYPES,
  STAGE_B_NODE_MIN,
  STAGE_B_NODE_MAX,
  STAGE_B_MIDDLE_LAYERS,
  STAGE_B_CONVERGENCE_LAYERS,
  weightedPick,
  middleLayerCounts,
  forceMandatoryNodeTypes,
  contentPoolKey,
  generateActGraph
};
