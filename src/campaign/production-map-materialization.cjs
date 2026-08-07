'use strict';

const { hash32, XorShift32 } = require('../core/determinism.cjs');
const { SERVICE_TYPES, SECRET_CONTENT_WEIGHTS, freezeArray, deepFreeze, weightedPick, categoryForType } = require('./production-map-contract.cjs');
const { selectProductionScenario } = require('./production-scenario-selector.cjs');

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
function builtInScenarioSelection(node, graph, options, excludedIds) {
  const candidates = options.contentPools?.scenarioCandidates || [];
  if (!candidates.length) return null;
  return selectProductionScenario({
    seed: node.contentSeed,
    candidates,
    excludedScenarioIds: freezeArray([...excludedIds]),
    context: {
      regionId: graph.regionId,
      phase: node.phase,
      danger: node.danger,
      branchProfile: node.branchProfile,
      boardId: options.boardId || null,
      objectiveId: options.objectiveId || null,
      environmentId: options.environmentId || null,
      storyFacts: options.storyFacts || options.flags || []
    }
  });
}
function versionOf(selection, fallback) {
  const value = Number(selection?.contentVersion ?? selection?.eventVersion ?? selection?.scenarioVersion ?? selection?.serviceVersion ?? selection?.version ?? fallback);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}
function defaultMaterialization(node, graph, options, excludedIds) {
  let contentId = null;
  let selectorState = options.selectorState || null;
  let scenarioSelection = null;
  let eventSelection = null;
  let serviceSelection = null;
  if (node.type === 'event' && typeof options.selectEvent === 'function') {
    eventSelection = options.selectEvent({
      graph,
      node,
      seed: node.contentSeed,
      contentVersion: node.contentVersion,
      excludedEventIds: freezeArray([...excludedIds]),
      selectorState,
      storyFacts: freezeArray(options.storyFacts || options.flags || []),
      heroIds: freezeArray(options.heroIds || []),
      doctrineIds: freezeArray(options.doctrineIds || []),
      relicIds: freezeArray(options.relicIds || []),
      roster: freezeArray(options.roster || []),
      participatedRosterIds: freezeArray(options.participatedRosterIds || []),
      gold: options.gold,
      supplies: options.supplies,
      eventContext: options.eventContext || null
    });
    contentId = eventSelection?.eventId || eventSelection?.contentId || null;
    selectorState = eventSelection?.selectorState ?? selectorState;
  } else if ((node.type === 'battle' || node.type === 'elite') && typeof options.selectScenario === 'function') {
    scenarioSelection = options.selectScenario({
      graph,
      node,
      seed: node.contentSeed,
      contentVersion: node.contentVersion,
      excludedScenarioIds: freezeArray([...excludedIds]),
      storyFacts: freezeArray(options.storyFacts || options.flags || [])
    });
    contentId = scenarioSelection?.scenarioId || scenarioSelection?.contentId || null;
  } else if (SERVICE_TYPES.includes(node.type) && typeof options.selectService === 'function') {
    serviceSelection = options.selectService({
      graph,
      node,
      seed: node.contentSeed,
      contentVersion: node.contentVersion,
      serviceType: node.type
    });
    contentId = serviceSelection?.serviceId || serviceSelection?.contentId || null;
  } else if (node.type === 'battle' || node.type === 'elite') {
    scenarioSelection = builtInScenarioSelection(node, graph, options, excludedIds);
    contentId = scenarioSelection?.scenarioId || deterministicPoolPick(poolForNode(node.type, options.contentPools), node.contentSeed, excludedIds);
  } else {
    contentId = deterministicPoolPick(poolForNode(node.type, options.contentPools), node.contentSeed, excludedIds);
  }

  const participantIds = options.participantIds || [];
  const generatedParticipantId = participantIds.length ? participantIds[hash32(`${node.contentSeed}:participant`) % participantIds.length] : null;
  const participantId = eventSelection?.participantId ?? generatedParticipantId;
  const success = 50 + (hash32(`${node.contentSeed}:percent`) % 41);
  const percentages = eventSelection?.percentages || [success, 100 - success];
  const contentVersion = versionOf(eventSelection || scenarioSelection || serviceSelection, node.contentVersion);

  const details = node.type === 'battle' || node.type === 'elite' ? {
    encounterId: contentId,
    scenarioVersion: contentVersion,
    scenarioSelection: scenarioSelection ? deepFreeze({
      weight: scenarioSelection.weight ?? null,
      totalWeight: scenarioSelection.totalWeight ?? null,
      appliedFactors: freezeArray(scenarioSelection.appliedFactors || []),
      optionalObjectiveRequirements: deepFreeze({ ...(scenarioSelection.optionalObjectiveRequirements || {}) }),
      metadata: deepFreeze({ ...(scenarioSelection.metadata || {}) }),
      snapshot: deepFreeze({ ...(scenarioSelection.snapshot || scenarioSelection.details || {}) })
    }) : null,
    enemyProfileSeed: hash32(`${node.contentSeed}:enemies`),
    deploymentSeed: hash32(`${node.contentSeed}:deployment`),
    environmentSeed: hash32(`${node.contentSeed}:environment`),
    missionSeed: hash32(`${node.contentSeed}:mission`),
    rewardSeed: hash32(`${node.contentSeed}:reward`)
  } : node.type === 'event' ? {
    eventId: contentId,
    eventVersion: contentVersion,
    variantId: eventSelection?.variantId || null,
    assignmentSeed: node.contentSeed,
    variantSeed: hash32(`${node.contentSeed}:variant`),
    participantId,
    percentages: freezeArray(percentages),
    snapshot: deepFreeze({ ...(eventSelection?.snapshot || eventSelection?.details || {}) })
  } : SERVICE_TYPES.includes(node.type) ? {
    serviceId: contentId,
    serviceType: node.type,
    serviceVersion: contentVersion,
    inventorySeed: hash32(`${node.contentSeed}:inventory`),
    inventory: freezeArray(serviceSelection?.inventory || []),
    parameters: deepFreeze({ ...(serviceSelection?.parameters || serviceSelection?.details || {}) })
  } : {};

  return deepFreeze({
    nodeId: node.id,
    type: node.type,
    contentVersion,
    contentSeed: node.contentSeed,
    contentId,
    materialized: true,
    materializedFromNodeId: options.sourceNodeId,
    materializedLevel: node.layer,
    participantId,
    details,
    selectorState
  });
}
function materializeLevel(graph, sourceNodeId, existingByNode = {}, options = {}) {
  if (!graph?.nodesById?.[sourceNodeId]) throw new Error(`unknown source node ${sourceNodeId}`);
  const targetIds = (graph.outgoing[sourceNodeId] || []).map((edgeId) => graph.edgesById[edgeId].to).sort();
  const updates = {};
  let selectorState = options.selectorState || null;
  const sourceContentId = existingByNode[sourceNodeId]?.contentId || null;
  const batchEventIds = new Set();
  const batchScenarioIds = new Set();
  for (const targetId of targetIds) {
    if (existingByNode[targetId]) {
      updates[targetId] = existingByNode[targetId];
      continue;
    }
    const node = graph.nodesById[targetId];
    const excluded = node.type === 'event'
      ? new Set(batchEventIds)
      : (node.type === 'battle' || node.type === 'elite')
        ? new Set(batchScenarioIds)
        : new Set();
    if (sourceContentId && categoryForType(graph.nodesById[sourceNodeId].type) === categoryForType(node.type)) excluded.add(sourceContentId);
    const materialized = defaultMaterialization(node, graph, { ...options, sourceNodeId, selectorState }, excluded);
    selectorState = materialized.selectorState;
    updates[targetId] = materialized;
    if (node.type === 'event' && materialized.contentId) batchEventIds.add(materialized.contentId);
    if ((node.type === 'battle' || node.type === 'elite') && materialized.contentId) batchScenarioIds.add(materialized.contentId);
  }
  return deepFreeze({
    materializedByNode: { ...existingByNode, ...updates },
    materializedNodeIds: freezeArray(targetIds),
    selectorState
  });
}
function secretContentType(checkSeed, allowedTypes = null) {
  const allowed = allowedTypes ? new Set(allowedTypes) : null;
  const entries = SECRET_CONTENT_WEIGHTS.filter((entry) => !allowed || allowed.has(entry.value));
  const mixedSeed = hash32(`${Number(checkSeed) >>> 0}:secret-content-type`);
  return weightedPick(new XorShift32(mixedSeed), entries);
}

module.exports = {
  poolForNode,
  deterministicPoolPick,
  builtInScenarioSelection,
  versionOf,
  defaultMaterialization,
  materializeLevel,
  secretContentType
};
