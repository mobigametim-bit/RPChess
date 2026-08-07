'use strict';

const { hash32 } = require('../core/determinism.cjs');
const { deepFreeze, freezeArray } = require('../campaign/production-map-contract.cjs');
const { generateProductionActGraph } = require('../campaign/production-map.cjs');
const { poolForNode, deterministicPoolPick } = require('../campaign/production-map-materialization.cjs');
const runtimeState = require('../campaign/runtime-state.cjs');

const INSTALL_KEY = Symbol.for('rpchess.b9-map-runtime-installed');
if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;

  const graphModule = require('../campaign/graph.cjs');
  const stateModule = require('../campaign/state.cjs');
  const originalGenerateActGraph = graphModule.generateActGraph;
  Object.assign(stateModule, runtimeState);
  graphModule.generateActGraph = function generateB9ActGraph(options = {}) {
    if (options.stageB !== true) return originalGenerateActGraph(options);
    const graph = generateProductionActGraph({
      rootSeed: options.rootSeed ?? options.seed ?? 1,
      act: options.act ?? 1,
      regionId: options.regionId || 'region.iron_marches'
    });
    return deepFreeze({
      ...graph,
      materializationContext: deepFreeze({
        contentPools: deepFreeze({ ...(options.contentPools || {}) }),
        participantIds: freezeArray(options.participantIds || [])
      })
    });
  };

  const vertical = require('../runtime/vertical-slice.cjs');
  const originalCreateRuntime = vertical.createVerticalSliceRuntime;
  const originalValidateSnapshot = vertical.validateVerticalSliceSnapshot;
  const originalEnterNode = vertical.enterVerticalSliceNode;

  function contentIdFor(campaign, node, includeUnopened) {
    const materialized = campaign.materializedContentByNode?.[node.id];
    if (materialized?.contentId) return materialized.contentId;
    if (!includeUnopened) return node.contentId || null;
    return deterministicPoolPick(poolForNode(node.type, campaign.materializationContext?.contentPools || {}), node.contentSeed || hash32(`${campaign.rootSeed}:${node.id}:compat`));
  }
  function compatibilityGraph(campaign, includeUnopened = true) {
    if (!runtimeState.isProductionState(campaign)) return campaign.graph;
    const nodes = campaign.graph.nodes.map((node) => {
      const contentId = contentIdFor(campaign, node, includeUnopened);
      const materialized = campaign.materializedContentByNode?.[node.id] || null;
      return deepFreeze({ ...node, contentId, contentSlot: contentId ? null : node.contentSlot, intel: materialized?.details || node.intel || null, materialized: Boolean(materialized) });
    });
    return deepFreeze({
      ...campaign.graph,
      nodes: freezeArray(nodes),
      nodesById: deepFreeze(Object.fromEntries(nodes.map((node) => [node.id, node])))
    });
  }
  function compatibilityCampaign(campaign, includeUnopened = true) {
    return runtimeState.isProductionState(campaign)
      ? deepFreeze({ ...campaign, graph: compatibilityGraph(campaign, includeUnopened) })
      : campaign;
  }
  function restoreProductionCampaign(runtime, campaign) {
    return runtimeState.isProductionState(campaign) ? deepFreeze({ ...runtime, campaign }) : runtime;
  }

  vertical.createVerticalSliceRuntime = function createB9VerticalSliceRuntime(options = {}) {
    if (!runtimeState.isProductionState(options.campaign)) return originalCreateRuntime(options);
    const productionCampaign = options.campaign;
    const created = originalCreateRuntime({ ...options, campaign: compatibilityCampaign(productionCampaign, true) });
    return restoreProductionCampaign(created, productionCampaign);
  };
  vertical.validateVerticalSliceSnapshot = function validateB9VerticalSliceSnapshot(snapshot, options = {}) {
    if (!runtimeState.isProductionState(snapshot?.campaign)) return originalValidateSnapshot(snapshot, options);
    const productionCampaign = runtimeState.migrateCampaignState(snapshot.campaign);
    const validated = originalValidateSnapshot({ ...snapshot, campaign: compatibilityCampaign(productionCampaign, true) }, options);
    return restoreProductionCampaign(validated, productionCampaign);
  };

  function appendStageBHistory(stageB, type, payload) {
    return freezeArray([...(stageB.history || []), deepFreeze({ index: stageB.history?.length || 0, type, payload: deepFreeze(payload || {}) })]);
  }
  function applyForcedMarchInjury(stageB, count, seed) {
    if (!count || !stageB?.roster?.length) return stageB;
    const eligible = stageB.roster.filter((entry) => entry.kind !== 'king' && entry.available && entry.injury !== 'heavy').sort((a, b) => a.id.localeCompare(b.id));
    if (!eligible.length) return stageB;
    const injuredIds = new Set();
    for (let index = 0; index < count; index += 1) injuredIds.add(eligible[hash32(`${seed}:${index}:forced-march-injury`) % eligible.length].id);
    return deepFreeze({
      ...stageB,
      roster: freezeArray(stageB.roster.map((entry) => injuredIds.has(entry.id) ? deepFreeze({ ...entry, injury: 'light', skipBattles: Math.max(1, entry.skipBattles || 0), available: false }) : entry)),
      history: appendStageBHistory(stageB, 'forced_march_injury', { rosterIds: freezeArray([...injuredIds]) })
    });
  }
  function applyNextBattlePenalty(stageB, count) {
    if (!count || !stageB) return stageB;
    const effectId = `effect.forced_march.next_battle_penalty.${count}`;
    const briefing = stageB.briefing ? deepFreeze({
      ...stageB.briefing,
      forcedMarchPenalty: count,
      warning: `${stageB.briefing.warning} Форсированный марш: штраф следующего боя ×${count}.`
    }) : stageB.briefing;
    return deepFreeze({
      ...stageB,
      briefing,
      temporaryEffects: freezeArray([...new Set([...(stageB.temporaryEffects || []), effectId])]),
      history: appendStageBHistory(stageB, 'forced_march_next_battle_penalty_applied', { count, effectId })
    });
  }
  function applyRewardChoiceReduction(runtime) {
    const reduction = Number(runtime.campaign?.temporaryPenalties?.rewardChoiceReduction || 0);
    const offers = runtime.stageB?.pendingRewardOffers || [];
    if (runtime.status !== 'reward_choice' || reduction <= 0 || offers.length <= 1) return runtime;
    const visibleCount = Math.max(1, offers.length - reduction);
    const stageB = deepFreeze({
      ...runtime.stageB,
      pendingRewardOffers: freezeArray(offers.slice(0, visibleCount)),
      history: appendStageBHistory(runtime.stageB, 'forced_march_reward_choice_reduced', { reduction, visibleCount })
    });
    const campaign = deepFreeze({
      ...runtime.campaign,
      temporaryPenalties: deepFreeze({ ...runtime.campaign.temporaryPenalties, rewardChoiceReduction: 0 })
    });
    return deepFreeze({ ...runtime, stageB, campaign });
  }
  vertical.enterVerticalSliceNode = function enterB9VerticalSliceNode(state, targetNodeId, dependencies = {}, travelOptions = {}) {
    if (!runtimeState.isProductionState(state.campaign)) return originalEnterNode(state, targetNodeId, dependencies);
    const route = runtimeState.availableRoutes(state.campaign).find((candidate) => candidate.to === targetNodeId);
    if (!route) throw new Error(`${targetNodeId} is not an available route`);
    if (route.requiresForcedMarch && !travelOptions.forcedMarchChoice) throw new Error('forced march consequence must be chosen before travel');
    const targetNode = state.campaign.graph.nodesById[targetNodeId];
    const campaignWithGold = deepFreeze({ ...state.campaign, gold: state.resources.gold });
    let campaign = runtimeState.travelTo(campaignWithGold, targetNodeId, { ...(dependencies.campaignMaterialization || {}), ...travelOptions });
    const compatibilitySource = compatibilityCampaign(campaignWithGold, false);
    const resolutionSource = route.requiresForcedMarch ? deepFreeze({ ...compatibilitySource, supplies: 1 }) : compatibilitySource;
    const resolved = originalEnterNode(deepFreeze({ ...state, campaign: resolutionSource }), targetNodeId, dependencies);
    const travelRecord = campaign.history.at(-1) || {};
    const lightInjuryCount = Number(travelRecord.externalEffects?.lightInjuryCount || 0);
    const battlePenalty = ['battle', 'elite', 'boss'].includes(targetNode.type) ? Number(campaign.temporaryPenalties.nextBattle || 0) : 0;
    let stageB = applyForcedMarchInjury(resolved.stageB, lightInjuryCount, `${campaign.rootSeed}:${campaign.history.length}`);
    stageB = applyNextBattlePenalty(stageB, battlePenalty);
    if (battlePenalty > 0) campaign = deepFreeze({
      ...campaign,
      temporaryPenalties: deepFreeze({ ...campaign.temporaryPenalties, nextBattle: 0 })
    });
    const transcript = resolved.transcript?.length
      ? freezeArray([...resolved.transcript.slice(0, -1), deepFreeze({ ...resolved.transcript.at(-1), forcedMarchChoice: travelOptions.forcedMarchChoice || null, forcedMarchBattlePenalty: battlePenalty })])
      : resolved.transcript;
    return deepFreeze({
      ...resolved,
      campaign,
      stageB,
      resources: deepFreeze({ ...resolved.resources, gold: campaign.gold }),
      transcript
    });
  };

  const presenter = require('../runtime/presenter-bridge.cjs');
  const originalPresenterCommands = presenter.PRESENTER_COMMANDS;
  const originalCreateSnapshot = presenter.createPresenterSnapshot;
  const originalNormalizeCommand = presenter.normalizePresenterCommand;
  const originalDispatchCommand = presenter.dispatchPresenterCommand;
  presenter.PRESENTER_COMMANDS = Object.freeze([...originalPresenterCommands, 'DecideSecret', 'CompleteSecret', 'ReopenBranch']);

  presenter.createPresenterSnapshot = function createB9PresenterSnapshot(state, dependencies = {}) {
    const snapshot = originalCreateSnapshot(state, dependencies);
    if (!runtimeState.isProductionState(state.campaign)) return snapshot;
    const pending = state.campaign.secret.pendingDecision;
    const active = state.campaign.secret.active;
    const routes = snapshot.campaign.routes.map((route) => {
      const source = runtimeState.availableRoutes(state.campaign).find((entry) => entry.to === route.to);
      const view = source?.node || {};
      return deepFreeze({
        ...route,
        rare: Boolean(source?.rare),
        requiresForcedMarch: Boolean(source?.requiresForcedMarch),
        forcedMarchChoices: source?.requiresForcedMarch ? stateModule.FORCED_MARCH_CHOICES || require('../campaign/production-map-state.cjs').FORCED_MARCH_CHOICES : freezeArray([]),
        branchProfile: view.branchProfile || null,
        phase: view.phase || null
      });
    });
    const nodes = snapshot.campaign.nodes.map((node) => {
      const view = runtimeState.visibleNode(state.campaign, node.id) || {};
      return deepFreeze({ ...node, branchProfile: view.branchProfile || null, phase: view.phase || null });
    });
    const reopenableNodeIds = Object.values(state.campaign.closedBranchRecordsByNode || {})
      .filter((entry) => entry.reopenable && state.campaign.closedNodeIds.includes(entry.nodeId) && !state.campaign.completedNodeIds.includes(entry.nodeId))
      .map((entry) => entry.nodeId)
      .sort();
    let actions = snapshot.actions;
    if (pending) actions = freezeArray(['DecideSecret']);
    else if (active) actions = freezeArray(['CompleteSecret']);
    return deepFreeze({
      ...snapshot,
      actions,
      campaign: deepFreeze({
        ...snapshot.campaign,
        generatorVersion: state.campaign.generatorVersion,
        rootSeed: state.campaign.rootSeed,
        attemptIndex: state.campaign.attemptIndex,
        macroTemplateId: state.campaign.macroTemplateId,
        isMirrored: state.campaign.isMirrored,
        currentLevel: state.campaign.currentLevel,
        forcedMarch: state.campaign.forcedMarch,
        temporaryPenalties: state.campaign.temporaryPenalties,
        reopenableNodeIds: freezeArray(reopenableNodeIds),
        rareRoute: state.campaign.rareRoute,
        secret: pending ? deepFreeze({ status: 'pending', symbol: '?', type: null, risk: null, reward: null, enterCost: 1, canEnter: state.campaign.supplies >= 1 })
          : active ? deepFreeze({ status: 'active', symbol: '?', type: active.contentType, returnNodeId: active.returnNodeId })
            : deepFreeze({ status: state.campaign.secret.completed ? 'completed' : state.campaign.secret.declined ? 'declined' : 'none' }),
        routes: freezeArray(routes),
        nodes: freezeArray(nodes)
      })
    });
  };
  presenter.normalizePresenterCommand = function normalizeB9PresenterCommand(command) {
    const type = String(command?.type || '');
    if (type === 'DecideSecret') {
      const decision = String(command.decision || command.payload?.decision || '');
      if (!['enter', 'decline'].includes(decision)) throw new Error('DecideSecret requires enter or decline');
      return deepFreeze({ type, decision });
    }
    if (type === 'CompleteSecret') return deepFreeze({ type });
    if (type === 'ReopenBranch') {
      const nodeId = String(command.nodeId || command.payload?.nodeId || '');
      if (!nodeId) throw new Error('ReopenBranch requires nodeId');
      return deepFreeze({ type, nodeId });
    }
    const normalized = originalNormalizeCommand(command);
    if (normalized.type !== 'Travel') return normalized;
    const forcedMarchChoice = command.forcedMarchChoice || command.payload?.forcedMarchChoice || null;
    return deepFreeze({ ...normalized, forcedMarchChoice });
  };

  function finalizeReturnedNode(previous, next, dependencies, command) {
    if (!runtimeState.isProductionState(next.campaign)) return next;
    const previousNodeId = previous.currentNode?.nodeId || null;
    const returnedToMap = previousNodeId && !next.currentNode && ['campaign', 'act_outcome', 'complete'].includes(next.status);
    if (!returnedToMap || next.campaign.completedNodeIds.includes(previousNodeId)) return next;
    let campaign = runtimeState.completeNode(next.campaign, previousNodeId, { ...(dependencies.campaignMaterialization || {}), rewardClaimed: command.type !== 'ContinueRoyalRetreat' });
    if (command.type !== 'ContinueRoyalRetreat') campaign = runtimeState.checkSecretAfterNode(campaign, previousNodeId);
    return deepFreeze({ ...next, campaign });
  }
  presenter.dispatchPresenterCommand = function dispatchB9PresenterCommand(state, commandInput, dependencies = {}) {
    const command = presenter.normalizePresenterCommand(commandInput);
    let nextState;
    let saveEnvelope = null;
    if (command.type === 'Travel') nextState = vertical.enterVerticalSliceNode(state, command.targetNodeId, dependencies, { forcedMarchChoice: command.forcedMarchChoice });
    else if (command.type === 'DecideSecret') nextState = deepFreeze({ ...state, campaign: runtimeState.decideSecret(state.campaign, command.decision), transcript: freezeArray([...state.transcript, command]) });
    else if (command.type === 'CompleteSecret') nextState = deepFreeze({ ...state, campaign: runtimeState.completeSecret(state.campaign), transcript: freezeArray([...state.transcript, command]) });
    else if (command.type === 'ReopenBranch') nextState = deepFreeze({ ...state, campaign: runtimeState.reopenBranch(state.campaign, command.nodeId, dependencies.campaignMaterialization || {}), transcript: freezeArray([...state.transcript, command]) });
    else {
      const result = originalDispatchCommand(state, command, dependencies);
      nextState = result.state;
      saveEnvelope = result.saveEnvelope || null;
    }
    nextState = applyRewardChoiceReduction(nextState);
    nextState = finalizeReturnedNode(state, nextState, dependencies, command);
    return Object.freeze({ state: nextState, snapshot: presenter.createPresenterSnapshot(nextState, dependencies), command, saveEnvelope });
  };
}

module.exports = Object.freeze({ installed: true });
