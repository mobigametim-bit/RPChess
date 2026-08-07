'use strict';

const { hash32 } = require('../core/determinism.cjs');
const { freezeArray, deepFreeze } = require('./production-map-contract.cjs');
const { PRODUCTION_CAMPAIGN_SCHEMA_VERSION } = require('./production-map-state-base.cjs');

function defaultSecret() {
  return { checksByNode: {}, discovered: null, pendingDecision: null, active: null, completed: false, declined: false };
}
function migrateProductionCampaignState(snapshot) {
  if (!snapshot || snapshot.format !== 'rpchess-campaign-state') throw new Error('invalid campaign state');
  if (snapshot.schemaVersion === PRODUCTION_CAMPAIGN_SCHEMA_VERSION && snapshot.generatorVersion === 3) return deepFreeze({
    ...snapshot,
    materializationContext: deepFreeze(snapshot.materializationContext || { contentPools: {}, participantIds: [] }),
    closedBranchRecordsByNode: deepFreeze(snapshot.closedBranchRecordsByNode || {}),
    rareRoute: snapshot.rareRoute || null,
    status: snapshot.status || 'active',
    minimumPathCost: Number.isInteger(snapshot.minimumPathCost) ? snapshot.minimumPathCost : 10,
    scouting: Number.isInteger(snapshot.scouting) ? snapshot.scouting : 0
  });
  const graph = snapshot.graph;
  const materializedContentByNode = { ...(snapshot.materializedContentByNode || {}) };
  for (const node of graph?.nodes || []) {
    if (!materializedContentByNode[node.id] && node.contentId) materializedContentByNode[node.id] = deepFreeze({
      nodeId: node.id, type: node.type, contentVersion: 0,
      contentSeed: node.contentSeed || node.nodeSeed || hash32(`${graph.seed}:${node.id}`),
      contentId: node.contentId, materialized: true, materializedFromNodeId: null,
      materializedLevel: node.layer, participantId: null, details: node.intel || {}, selectorState: null
    });
  }
  return deepFreeze({ ...snapshot, schemaVersion: PRODUCTION_CAMPAIGN_SCHEMA_VERSION,
    generatorVersion: snapshot.generatorVersion || graph?.generatorVersion || 1,
    rootSeed: snapshot.rootSeed ?? graph?.rootSeed ?? graph?.seed ?? 1,
    attemptIndex: snapshot.attemptIndex ?? graph?.attemptIndex ?? 0,
    macroTemplateId: snapshot.macroTemplateId || graph?.macroTemplateId || 'legacy_preserved',
    isMirrored: Boolean(snapshot.isMirrored ?? graph?.isMirrored),
    status: snapshot.status || 'active',
    minimumPathCost: Number.isInteger(snapshot.minimumPathCost) ? snapshot.minimumPathCost : 10,
    scouting: Number.isInteger(snapshot.scouting) ? snapshot.scouting : 0,
    currentLevel: snapshot.currentLevel ?? graph?.nodesById?.[snapshot.currentNodeId]?.layer ?? 0,
    materializationContext: deepFreeze(snapshot.materializationContext || { contentPools: {}, participantIds: [] }),
    revealedLevelIds: freezeArray(snapshot.revealedLevelIds || []),
    revealedNodeIds: freezeArray(snapshot.revealedNodeIds || Object.keys(snapshot.visibility || {}).filter((id) => snapshot.visibility[id] > 0)),
    materializedContentByNode: deepFreeze(materializedContentByNode), selectorState: snapshot.selectorState || null,
    reopenedNodeIds: freezeArray(snapshot.reopenedNodeIds || []), completedNodeIds: freezeArray(snapshot.completedNodeIds || []),
    rewardsClaimedNodeIds: freezeArray(snapshot.rewardsClaimedNodeIds || []),
    closedBranchRecordsByNode: deepFreeze(snapshot.closedBranchRecordsByNode || {}),
    rareRoute: snapshot.rareRoute || null,
    scoutedNodeIds: freezeArray(snapshot.scoutedNodeIds || []), scoutAttemptsByFork: deepFreeze(snapshot.scoutAttemptsByFork || {}),
    scoutingModifiers: deepFreeze(snapshot.scoutingModifiers || { costDiscount: 0, thirdScoutAllowed: false }),
    scoutingLockedUntilTravel: Boolean(snapshot.scoutingLockedUntilTravel),
    temporaryPenalties: deepFreeze(snapshot.temporaryPenalties || { nextBattle: 0, rewardChoiceReduction: 0 }),
    forcedMarch: deepFreeze(snapshot.forcedMarch || { consecutiveCount: 0, totalCount: 0, lastChoice: null }),
    secret: deepFreeze(snapshot.secret || defaultSecret())
  });
}

module.exports = { defaultSecret, migrateProductionCampaignState };
