'use strict';

const legacyModule = require('./state.cjs');
const legacy = Object.freeze({
  createCampaignState: legacyModule.createCampaignState,
  migrateCampaignState: legacyModule.migrateCampaignState,
  visibleNode: legacyModule.visibleNode,
  availableRoutes: legacyModule.availableRoutes,
  scoutingCost: legacyModule.scoutingCost,
  scoutNode: legacyModule.scoutNode,
  travelTo: legacyModule.travelTo,
  gainSupplies: legacyModule.gainSupplies,
  gainScouting: legacyModule.gainScouting,
  royalRetreatToConvergence: legacyModule.royalRetreatToConvergence,
  completeBossNode: legacyModule.completeBossNode
});
const production = require('./production-map-state.cjs');
const { materializeLevel } = require('./production-map-materialization.cjs');
const { freezeArray, deepFreeze } = require('./production-map-contract.cjs');

function isProductionGraph(graph) { return Boolean(graph && graph.generatorVersion === 3); }
function isProductionState(state) { return Boolean(state && (state.generatorVersion === 3 || isProductionGraph(state.graph))); }

function createCampaignState(graph, options = {}) {
  return isProductionGraph(graph) ? production.createProductionCampaignState(graph, options) : legacy.createCampaignState(graph, options);
}
function migrateCampaignState(snapshot) {
  return isProductionState(snapshot) || snapshot?.schemaVersion === 3
    ? production.migrateProductionCampaignState(snapshot)
    : legacy.migrateCampaignState(snapshot);
}
function visibleNode(state, nodeId) { return isProductionState(state) ? production.visibleNode(state, nodeId) : legacy.visibleNode(state, nodeId); }
function availableRoutes(state) { return isProductionState(state) ? production.availableRoutes(state) : legacy.availableRoutes(state); }
function scoutingCost(state, nodeId) { return isProductionState(state) ? production.scoutingCost(state, nodeId) : legacy.scoutingCost(state, nodeId); }
function scoutNode(state, nodeId, options = {}) { return isProductionState(state) ? production.scoutNode(state, nodeId, options) : legacy.scoutNode(state, nodeId, options); }
function travelTo(state, targetNodeId, options = {}) { return isProductionState(state) ? production.travelTo(state, targetNodeId, options) : legacy.travelTo(state, targetNodeId); }
function completeNode(state, nodeId, options = {}) { return isProductionState(state) ? production.completeNode(state, nodeId, options) : state; }
function reopenBranch(state, nodeId, options = {}) {
  if (!isProductionState(state)) throw new Error('rare branch reopening requires a production campaign');
  return production.reopenBranch(state, nodeId, options);
}
function checkSecretAfterNode(state, nodeId) { return isProductionState(state) ? production.checkSecretAfterNode(state, nodeId) : state; }
function decideSecret(state, decision) {
  if (!isProductionState(state)) throw new Error('secret-node decisions require a production campaign');
  return production.decideSecret(state, decision);
}
function completeSecret(state) {
  if (!isProductionState(state)) throw new Error('secret-node completion requires a production campaign');
  return production.completeSecret(state);
}
function gainSupplies(state, amount, reason = 'reward') {
  if (!isProductionState(state)) return legacy.gainSupplies(state, amount, reason);
  if (!Number.isInteger(amount)) throw new Error('supply change must be an integer');
  const next = state.supplies + amount;
  if (next < 0) throw new Error('supply change would make supplies negative');
  return deepFreeze({ ...state, supplies: next, history: freezeArray([...state.history, deepFreeze({ index: state.history.length, type: 'supplies', amount, reason, suppliesBefore: state.supplies, suppliesAfter: next })]) });
}
function gainScouting(state, amount = 1) {
  if (!isProductionState(state)) return legacy.gainScouting(state, amount);
  if (!Number.isInteger(amount) || amount < 1) throw new Error('scouting gain must be a positive integer');
  return deepFreeze({ ...state, scouting: Math.min(3, Number(state.scouting || 0) + amount), history: freezeArray([...state.history, deepFreeze({ index: state.history.length, type: 'scouting', before: Number(state.scouting || 0), after: Math.min(3, Number(state.scouting || 0) + amount) })]) });
}
function royalRetreatToConvergence(state, lostNodeId, options = {}) {
  if (!isProductionState(state)) return legacy.royalRetreatToConvergence(state, lostNodeId, options);
  const node = state.graph.nodesById[lostNodeId || state.currentNodeId];
  if (!node) throw new Error('royal retreat requires a valid lost node');
  const destinationId = node.emergencyTo || state.graph.bossNodeId;
  const destination = state.graph.nodesById[destinationId];
  if (!destination || destination.layer <= node.layer) throw new Error('royal retreat has no valid forward convergence');
  const levelResult = materializeLevel(state.graph, destinationId, state.materializedContentByNode, { ...(state.materializationContext || {}), ...options, selectorState: state.selectorState });
  const revealedNodeIds = [...new Set([...state.revealedNodeIds, destinationId, ...levelResult.materializedNodeIds])].sort();
  const revealedLevelIds = [...new Set([...state.revealedLevelIds, destination.layer, destination.layer + 1].filter((layer) => layer <= 10))].sort((a, b) => a - b);
  return deepFreeze({
    ...state,
    currentNodeId: destinationId,
    currentLevel: destination.layer,
    visitedNodeIds: freezeArray(state.visitedNodeIds.includes(destinationId) ? state.visitedNodeIds : [...state.visitedNodeIds, destinationId]),
    closedNodeIds: freezeArray([...new Set([...state.closedNodeIds, node.id])].sort()),
    revealedNodeIds: freezeArray(revealedNodeIds),
    revealedLevelIds: freezeArray(revealedLevelIds),
    materializedContentByNode: levelResult.materializedByNode,
    selectorState: levelResult.selectorState,
    status: destinationId === state.graph.bossNodeId ? 'boss_reached' : 'active',
    history: freezeArray([...state.history, deepFreeze({ index: state.history.length, type: 'royal_retreat', from: node.id, to: destinationId, reason: options.reason || 'battle_defeat', materializedNodeIds: levelResult.materializedNodeIds })])
  });
}
function completeBossNode(state, outcome) {
  if (!isProductionState(state)) return legacy.completeBossNode(state, outcome);
  if (!['victory', 'defeat'].includes(outcome)) throw new Error('boss outcome must be victory or defeat');
  return deepFreeze({ ...state, status: outcome === 'victory' ? 'completed' : 'failed', history: freezeArray([...state.history, deepFreeze({ index: state.history.length, type: 'boss', outcome })]) });
}

module.exports = {
  isProductionGraph, isProductionState,
  createCampaignState, migrateCampaignState, visibleNode, availableRoutes, scoutingCost,
  scoutNode, travelTo, completeNode, reopenBranch, checkSecretAfterNode, decideSecret, completeSecret,
  gainSupplies, gainScouting, royalRetreatToConvergence, completeBossNode
};
