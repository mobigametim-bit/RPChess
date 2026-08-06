'use strict';

const { freezeArray, deepFreeze } = require('./production-map-contract.cjs');
const { materializeLevel } = require('./production-map-materialization.cjs');
const { FORCED_MARCH_CHOICES, routeRecords, availableRoutes, travelRequirement, scoutingCost } = require('./production-map-state-base.cjs');

function forcedMarchEffect(choice, escalation) {
  if (!FORCED_MARCH_CHOICES.includes(choice)) throw new Error(`unsupported forced march consequence: ${choice}`);
  if (choice === 'gold_loss') return { goldDelta: -10 * escalation };
  if (choice === 'light_injury') return { lightInjuryCount: escalation };
  if (choice === 'next_battle_penalty') return { nextBattlePenalty: escalation };
  if (choice === 'reward_choice_reduction') return { rewardChoiceReduction: escalation };
  return { scoutingLock: true };
}
function callbackSelectorState(callback, payload, fallback) {
  if (typeof callback !== 'function') return fallback;
  const result = callback(payload);
  return result?.selectorState ?? result ?? fallback;
}
function travelTo(state, targetNodeId, options = {}) {
  const requirement = travelRequirement(state, targetNodeId);
  const route = availableRoutes(state).find((entry) => entry.to === targetNodeId);
  let supplies = state.supplies; let gold = state.gold;
  let forcedMarch = state.forcedMarch; let scoutingLockedUntilTravel = false;
  const temporaryPenalties = { ...state.temporaryPenalties };
  let externalEffects = {};
  if (requirement.mode === 'paid') {
    if (options.forcedMarchChoice) throw new Error('voluntary forced march is forbidden while supplies are available');
    supplies -= 1; forcedMarch = { ...forcedMarch, consecutiveCount: 0 };
  } else {
    const choice = String(options.forcedMarchChoice || '');
    if (!choice) throw new Error('forced march consequence must be chosen before travel');
    const escalation = state.forcedMarch.consecutiveCount >= 1 ? 2 : 1;
    const effect = forcedMarchEffect(choice, escalation);
    gold = Math.max(0, gold + Number(effect.goldDelta || 0));
    temporaryPenalties.nextBattle += Number(effect.nextBattlePenalty || 0);
    temporaryPenalties.rewardChoiceReduction += Number(effect.rewardChoiceReduction || 0);
    scoutingLockedUntilTravel = Boolean(effect.scoutingLock); externalEffects = effect;
    forcedMarch = { consecutiveCount: state.forcedMarch.consecutiveCount + 1, totalCount: state.forcedMarch.totalCount + 1, lastChoice: choice };
  }
  const siblings = routeRecords(state).map(({ node }) => node.id).filter((id) => id !== targetNodeId);
  const closedNodeIds = [...new Set([...state.closedNodeIds, ...siblings])].sort();
  const visitedNodeIds = state.visitedNodeIds.includes(targetNodeId) ? state.visitedNodeIds : [...state.visitedNodeIds, targetNodeId];
  let selectorState = callbackSelectorState(options.onBranchesClosed, {
    graph: state.graph, state: state.selectorState, nodeIds: freezeArray(siblings),
    materializedContentByNode: state.materializedContentByNode
  }, state.selectorState);
  const levelResult = materializeLevel(state.graph, targetNodeId, state.materializedContentByNode, { ...options, selectorState });
  selectorState = levelResult.selectorState;
  const revealedNodeIds = [...new Set([...state.revealedNodeIds, targetNodeId, ...levelResult.materializedNodeIds])].sort();
  const revealedLevelIds = [...new Set([...state.revealedLevelIds, state.graph.nodesById[targetNodeId].layer + 1].filter((layer) => layer <= 10))].sort((a, b) => a - b);
  const record = deepFreeze({
    index: state.history.length, type: requirement.mode === 'paid' ? 'travel' : 'forced_march_travel',
    from: state.currentNodeId, to: targetNodeId, edgeId: route.edgeId,
    suppliesBefore: state.supplies, suppliesAfter: supplies,
    forcedMarchChoice: options.forcedMarchChoice || null, externalEffects,
    closedNodeIds: freezeArray(siblings), materializedNodeIds: levelResult.materializedNodeIds
  });
  return deepFreeze({
    ...state, currentNodeId: targetNodeId, currentLevel: state.graph.nodesById[targetNodeId].layer,
    supplies, gold, forcedMarch: deepFreeze(forcedMarch), scoutingLockedUntilTravel,
    temporaryPenalties: deepFreeze(temporaryPenalties),
    closedNodeIds: freezeArray(closedNodeIds), visitedNodeIds: freezeArray(visitedNodeIds),
    traversedEdgeIds: freezeArray([...state.traversedEdgeIds, route.edgeId]),
    revealedNodeIds: freezeArray(revealedNodeIds), revealedLevelIds: freezeArray(revealedLevelIds),
    materializedContentByNode: levelResult.materializedByNode, selectorState,
    history: freezeArray([...state.history, record])
  });
}
function scoutNode(state, nodeId) {
  if (state.scoutingLockedUntilTravel) throw new Error('scouting is locked by forced march consequence');
  const cost = scoutingCost(state, nodeId);
  if (cost == null) throw new Error('third scouting attempt at this fork is unavailable');
  if (state.scoutedNodeIds.includes(nodeId)) return state;
  if (state.supplies < cost) throw new Error('not enough supplies for scouting');
  const attempts = { ...state.scoutAttemptsByFork, [state.currentNodeId]: Number(state.scoutAttemptsByFork?.[state.currentNodeId] || 0) + 1 };
  return deepFreeze({ ...state, supplies: state.supplies - cost,
    scoutedNodeIds: freezeArray([...state.scoutedNodeIds, nodeId]), scoutAttemptsByFork: deepFreeze(attempts),
    history: freezeArray([...state.history, deepFreeze({ index: state.history.length, type: 'node_scouted', from: state.currentNodeId, nodeId, cost, attempt: attempts[state.currentNodeId] })]) });
}
function completeNode(state, nodeId, options = {}) {
  if (state.completedNodeIds.includes(nodeId)) throw new Error(`${nodeId} is already completed`);
  const selectorState = callbackSelectorState(options.onNodeCompleted, {
    graph: state.graph, state: state.selectorState, nodeId,
    materializedContent: state.materializedContentByNode[nodeId] || null
  }, state.selectorState);
  return deepFreeze({ ...state, selectorState,
    completedNodeIds: freezeArray([...state.completedNodeIds, nodeId]),
    rewardsClaimedNodeIds: freezeArray(options.rewardClaimed === false ? state.rewardsClaimedNodeIds : [...state.rewardsClaimedNodeIds, nodeId]),
    history: freezeArray([...state.history, deepFreeze({ index: state.history.length, type: 'node_completed', nodeId, rewardClaimed: options.rewardClaimed !== false })]) });
}
function reopenBranch(state, nodeId, options = {}) {
  if (!state.closedNodeIds.includes(nodeId)) throw new Error(`${nodeId} is not a closed branch node`);
  if (state.completedNodeIds.includes(nodeId) || state.rewardsClaimedNodeIds.includes(nodeId)) throw new Error('completed nodes cannot be reopened for another reward');
  const node = state.graph.nodesById[nodeId];
  if (!node || ['elite', 'boss'].includes(node.type)) throw new Error('rare branch reopening cannot target elite or boss');
  const selectorState = callbackSelectorState(options.onBranchReopened, {
    graph: state.graph, state: state.selectorState, nodeId,
    materializedContent: state.materializedContentByNode[nodeId] || null
  }, state.selectorState);
  return deepFreeze({ ...state, selectorState,
    closedNodeIds: freezeArray(state.closedNodeIds.filter((id) => id !== nodeId)),
    reopenedNodeIds: freezeArray([...new Set([...state.reopenedNodeIds, nodeId])]),
    history: freezeArray([...state.history, deepFreeze({ index: state.history.length, type: 'branch_reopened', nodeId, preservedContentId: state.materializedContentByNode[nodeId]?.contentId || null })]) });
}

module.exports = { forcedMarchEffect, travelTo, scoutNode, completeNode, reopenBranch };
