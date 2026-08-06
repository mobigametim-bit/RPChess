'use strict';

const { hash32, XorShift32 } = require('../core/determinism.cjs');
const { SERVICE_TYPES, SECRET_CONTENT_WEIGHTS, freezeArray, deepFreeze, weightedPick, categoryForType } = require('./production-map-contract.cjs');

function poolForNode(type, pools = {}) {
  if (type === 'battle' || type === 'elite') return pools.encounters || [];
  if (type === 'event') return pools.events || [];
  if (type === 'boss') return pools.bosses || [];
  if (SERVICE_TYPES.includes(type)) return pools[type] || pools.services || [];
  return [];
}
function deterministicPoolPick(pool, seed, excluded = new Set()) {
  const candidates = pool.map(String).filter((id) => !excluded.has(id));
  const source = candidates.length ? candidates : pool.map(String);
  if (!source.length) return null;
  return source[hash32(`${seed}:pool`) % source.length];
}
function defaultMaterialization(node, graph, options, excludedIds) {
  let contentId = null;
  let selectorState = options.selectorState || null;
  if (node.type === 'event' && typeof options.selectEvent === 'function') {
    const selected = options.selectEvent({ graph, node, seed: node.contentSeed, excludedEventIds: freezeArray([...excludedIds]), selectorState });
    contentId = selected?.eventId || selected?.contentId || null;
    selectorState = selected?.selectorState ?? selectorState;
  } else if ((node.type === 'battle' || node.type === 'elite') && typeof options.selectScenario === 'function') {
    const selected = options.selectScenario({ graph, node, seed: node.contentSeed, excludedScenarioIds: freezeArray([...excludedIds]) });
    contentId = selected?.scenarioId || selected?.contentId || null;
  } else contentId = deterministicPoolPick(poolForNode(node.type, options.contentPools), node.contentSeed, excludedIds);
  const participantIds = options.participantIds || [];
  const participantId = participantIds.length ? participantIds[hash32(`${node.contentSeed}:participant`) % participantIds.length] : null;
  const success = 50 + (hash32(`${node.contentSeed}:percent`) % 41);
  const details = node.type === 'battle' || node.type === 'elite' ? {
    encounterId: contentId,
    enemyProfileSeed: hash32(`${node.contentSeed}:enemies`),
    deploymentSeed: hash32(`${node.contentSeed}:deployment`),
    environmentSeed: hash32(`${node.contentSeed}:environment`),
    missionSeed: hash32(`${node.contentSeed}:mission`),
    rewardSeed: hash32(`${node.contentSeed}:reward`)
  } : node.type === 'event' ? {
    eventId: contentId,
    variantSeed: hash32(`${node.contentSeed}:variant`),
    participantId,
    percentages: freezeArray([success, 100 - success])
  } : SERVICE_TYPES.includes(node.type) ? {
    serviceType: node.type,
    inventorySeed: hash32(`${node.contentSeed}:inventory`)
  } : {};
  return deepFreeze({
    nodeId: node.id, type: node.type, contentVersion: node.contentVersion,
    contentSeed: node.contentSeed, contentId, materialized: true,
    materializedFromNodeId: options.sourceNodeId, materializedLevel: node.layer,
    participantId, details, selectorState
  });
}
function materializeLevel(graph, sourceNodeId, existingByNode = {}, options = {}) {
  if (!graph?.nodesById?.[sourceNodeId]) throw new Error(`unknown source node ${sourceNodeId}`);
  const targetIds = (graph.outgoing[sourceNodeId] || []).map((edgeId) => graph.edgesById[edgeId].to).sort();
  const updates = {};
  let selectorState = options.selectorState || null;
  const sourceContentId = existingByNode[sourceNodeId]?.contentId || null;
  const batchEventIds = new Set(); const batchScenarioIds = new Set();
  for (const targetId of targetIds) {
    if (existingByNode[targetId]) { updates[targetId] = existingByNode[targetId]; continue; }
    const node = graph.nodesById[targetId];
    const excluded = node.type === 'event' ? new Set(batchEventIds) : (node.type === 'battle' || node.type === 'elite') ? new Set(batchScenarioIds) : new Set();
    if (sourceContentId && categoryForType(graph.nodesById[sourceNodeId].type) === categoryForType(node.type)) excluded.add(sourceContentId);
    const materialized = defaultMaterialization(node, graph, { ...options, sourceNodeId, selectorState }, excluded);
    selectorState = materialized.selectorState;
    updates[targetId] = materialized;
    if (node.type === 'event' && materialized.contentId) batchEventIds.add(materialized.contentId);
    if ((node.type === 'battle' || node.type === 'elite') && materialized.contentId) batchScenarioIds.add(materialized.contentId);
  }
  return deepFreeze({ materializedByNode: { ...existingByNode, ...updates }, materializedNodeIds: freezeArray(targetIds), selectorState });
}
function secretContentType(checkSeed, allowedTypes = null) {
  const allowed = allowedTypes ? new Set(allowedTypes) : null;
  const entries = SECRET_CONTENT_WEIGHTS.filter((entry) => !allowed || allowed.has(entry.value));
  const mixedSeed = hash32(`${Number(checkSeed) >>> 0}:secret-content-type`);
  return weightedPick(new XorShift32(mixedSeed), entries);
}

module.exports = { poolForNode, deterministicPoolPick, defaultMaterialization, materializeLevel, secretContentType };
