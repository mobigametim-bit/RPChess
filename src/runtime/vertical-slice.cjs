'use strict';

const { normalizeProfileId } = require('../save/profile-store.cjs');
const {
  availableRoutes,
  travelTo,
  gainSupplies,
  completeBossNode
} = require('../campaign/state.cjs');
const {
  executeScenarioCommand,
  scenarioObjectiveEvaluator
} = require('../scenario/scenario.cjs');
const { chooseAiCommand } = require('../ai/search.cjs');
const {
  createAuthoredEventState,
  resolveAuthoredEventChoice,
  applyFlagChanges
} = require('./authored-event.cjs');
const { executeBossActionPair, advanceBossPhase } = require('./boss-gate.cjs');
const {
  DEPLOYMENT_COMMANDS,
  executeDeploymentEdit,
  finalizeScenarioDeployment
} = require('./deployment-gate.cjs');
const {
  RUNTIME_ARMY_FORMAT,
  validateRuntimeArmy
} = require('./army-roster.cjs');

const RUNTIME_FORMAT = 'rpchess-vertical-slice-runtime';
const LEGACY_RUNTIME_SCHEMA_VERSION = 1;
const RUNTIME_SCHEMA_VERSION = 2;
const RUNTIME_STATUSES = Object.freeze([
  'campaign',
  'deployment',
  'event',
  'scenario',
  'boss',
  'boss_transition',
  'reward',
  'complete',
  'failed'
]);

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return value;
}

function cloneSerializable(value) {
  let text;
  try {
    text = JSON.stringify(value);
  } catch (error) {
    throw new Error(`vertical slice state is not serializable: ${error.message}`);
  }
  if (text === undefined) throw new Error('vertical slice state is not serializable');
  return JSON.parse(text);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeRuntimeArmy(army, options = {}) {
  if (army == null) {
    if (options.requireArmy) throw new Error('vertical slice runtime requires an army');
    return null;
  }
  if (!army || army.format !== RUNTIME_ARMY_FORMAT) throw new Error('vertical slice runtime has an invalid army');
  if (!options.contentRegistry || !options.combatProfiles) {
    throw new Error('vertical slice army validation requires contentRegistry and combatProfiles');
  }
  return validateRuntimeArmy(army, options.contentRegistry, options.combatProfiles);
}

function migrationArmy(snapshot, options = {}) {
  if (snapshot.army) return snapshot.army;
  if (options.defaultArmy) return options.defaultArmy;
  if (options.army) return options.army;
  if (typeof options.armyFactory === 'function') return options.armyFactory(snapshot);
  return null;
}

function migrateVerticalSliceSnapshot(snapshot, options = {}) {
  if (!snapshot || snapshot.format !== RUNTIME_FORMAT) throw new Error('invalid vertical slice runtime state');
  if (snapshot.schemaVersion === RUNTIME_SCHEMA_VERSION) {
    if (!hasOwn(snapshot, 'army')) throw new Error('vertical slice runtime schema 2 requires an army field');
    return snapshot;
  }
  if (snapshot.schemaVersion !== LEGACY_RUNTIME_SCHEMA_VERSION) throw new Error('unsupported vertical slice runtime schema');
  return {
    ...cloneSerializable(snapshot),
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    army: migrationArmy(snapshot, options)
  };
}

function assertRuntimeState(state) {
  if (!state || state.format !== RUNTIME_FORMAT) throw new Error('invalid vertical slice runtime state');
  if (state.schemaVersion !== RUNTIME_SCHEMA_VERSION) throw new Error('unsupported vertical slice runtime schema');
  if (!hasOwn(state, 'army')) throw new Error('vertical slice runtime requires an army field');
  if (!RUNTIME_STATUSES.includes(state.status)) throw new Error(`invalid vertical slice runtime status: ${state.status}`);
  if (!state.campaign || state.campaign.format !== 'rpchess-campaign-state') throw new Error('vertical slice runtime requires campaign state');
  return state;
}

function contentKindForNode(type) {
  if (type === 'battle' || type === 'elite') return 'encounter';
  if (type === 'boss') return 'boss';
  if (type === 'event') return 'event';
  return null;
}

function resolveNodeContent(registry, node) {
  const kind = contentKindForNode(node.type);
  if (!kind) return null;
  if (!node.contentId) throw new Error(`${node.id} has no compiled ${kind} contentId`);
  const record = registry.get(kind, node.contentId);
  if (!record) throw new Error(`${node.id} references missing ${kind} content: ${node.contentId}`);
  return record;
}

function validateGraphContent(graph, registry) {
  if (!registry || typeof registry.get !== 'function') throw new Error('vertical slice runtime requires a content registry');
  const errors = [];
  for (const node of graph.nodes) {
    const kind = contentKindForNode(node.type);
    if (!kind) continue;
    if (!node.contentId) errors.push(`${node.id} has no compiled ${kind} contentId`);
    else if (!registry.get(kind, node.contentId)) errors.push(`${node.id} references missing ${kind} content: ${node.contentId}`);
  }
  if (errors.length) {
    const error = new Error(`vertical slice content validation failed with ${errors.length} error(s)`);
    error.details = Object.freeze(errors);
    throw error;
  }
  return true;
}

function normalizeReward(input = {}) {
  const reward = {
    gold: input.gold ?? 0,
    supplies: input.supplies ?? 0,
    meta: input.meta ?? 0
  };
  for (const [key, value] of Object.entries(reward)) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`reward ${key} must be a non-negative integer`);
  }
  return Object.freeze(reward);
}

function createVerticalSliceRuntime(options = {}) {
  const campaign = options.campaign;
  if (!campaign || campaign.format !== 'rpchess-campaign-state') throw new Error('campaign state is required');
  if (campaign.status !== 'active') throw new Error('vertical slice campaign must start active');
  const profileId = normalizeProfileId(options.profileId || 'profile-1');
  const playerSide = options.playerSide || 'w';
  if (!['w', 'b'].includes(playerSide)) throw new Error('playerSide must be w or b');
  validateGraphContent(campaign.graph, options.contentRegistry);
  const army = normalizeRuntimeArmy(options.army ?? null, options);

  return deepFreeze({
    format: RUNTIME_FORMAT,
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    runtimeId: String(options.runtimeId || `${campaign.graph.graphId}:${profileId}`),
    seed: Number(options.seed ?? campaign.graph.seed ?? 1),
    profileId,
    playerSide,
    aiProfile: String(options.aiProfile || 'tactician'),
    campaign,
    army,
    status: 'campaign',
    currentNode: null,
    deployment: null,
    event: null,
    scenario: null,
    boss: null,
    pendingReward: null,
    resources: Object.freeze({ gold: 0, meta: 0 }),
    flags: freezeArray([]),
    chronicleKeys: freezeArray([]),
    rewardLog: freezeArray([]),
    transcript: freezeArray([]),
    history: freezeArray([])
  });
}

function availableVerticalSliceRoutes(state) {
  assertRuntimeState(state);
  if (state.status !== 'campaign') return freezeArray([]);
  return availableRoutes(state.campaign);
}

function normalizeNodeResolution(node, content, resolution) {
  if (!resolution || typeof resolution !== 'object') throw new Error(`node resolver returned no result for ${node.id}`);
  const mode = resolution.mode;
  if (!['scenario', 'boss', 'event', 'immediate'].includes(mode)) throw new Error(`node resolver returned invalid mode for ${node.id}`);
  const reward = normalizeReward(resolution.reward || {});
  if (mode === 'scenario') {
    const scenario = resolution.scenario;
    if (!scenario || scenario.format !== 'rpchess-scenario-state') throw new Error(`${node.id} resolver must return a valid scenario state`);
    return Object.freeze({ mode, scenario, boss: null, event: null, reward, contentId: content?.id || node.contentId || null });
  }
  if (mode === 'boss') {
    const boss = resolution.boss;
    if (node.type !== 'boss') throw new Error(`${node.id} may use boss mode only for a boss node`);
    if (!boss || boss.format !== 'rpchess-boss-phase-state' || boss.status !== 'active') throw new Error(`${node.id} resolver must return an active boss phase state`);
    return Object.freeze({ mode, scenario: null, boss, event: null, reward, contentId: content?.id || node.contentId || null });
  }
  if (mode === 'event') {
    if (!content || content.kind !== 'event') throw new Error(`${node.id} event mode requires compiled event content`);
    const event = resolution.event || createAuthoredEventState(content, { nodeId: node.id });
    if (!event || event.format !== 'rpchess-authored-event-state' || event.status !== 'active') throw new Error(`${node.id} resolver must return an active authored event state`);
    return Object.freeze({ mode, scenario: null, boss: null, event, reward, contentId: content.id });
  }
  return Object.freeze({ mode, scenario: null, boss: null, event: null, reward, contentId: content?.id || node.contentId || null });
}

function enterVerticalSliceNode(state, targetNodeId, dependencies = {}) {
  assertRuntimeState(state);
  if (state.status !== 'campaign') throw new Error(`cannot travel while runtime status is ${state.status}`);
  if (typeof dependencies.nodeResolver !== 'function') throw new Error('nodeResolver is required');
  const route = availableRoutes(state.campaign).find((candidate) => candidate.to === targetNodeId);
  if (!route) throw new Error(`${targetNodeId} is not an available route`);
  if (!route.affordable) throw new Error(`${targetNodeId} route is not affordable`);

  const campaign = travelTo(state.campaign, targetNodeId);
  const node = campaign.graph.nodesById[targetNodeId];
  const content = resolveNodeContent(dependencies.contentRegistry, node);
  const resolution = normalizeNodeResolution(node, content, dependencies.nodeResolver({
    runtime: state,
    campaign,
    node,
    content
  }));
  if (resolution.mode === 'scenario' && resolution.scenario.battle.position.sideToMove !== state.playerSide) {
    throw new Error(`${node.id} scenario must begin on the player side`);
  }
  if (resolution.mode === 'boss' && resolution.boss.scenario.battle.position.sideToMove !== state.playerSide) {
    throw new Error(`${node.id} boss must begin on the player side`);
  }

  const deployment = resolution.mode === 'scenario' && typeof dependencies.deploymentFactory === 'function'
    ? dependencies.deploymentFactory({ runtime: state, campaign, node, content, scenario: resolution.scenario })
    : null;
  const operation = Object.freeze({ type: 'Travel', targetNodeId });
  const currentNode = Object.freeze({
    nodeId: node.id,
    type: node.type,
    contentId: resolution.contentId,
    reward: resolution.reward
  });
  const nextStatus = resolution.mode === 'scenario'
    ? (deployment ? 'deployment' : 'scenario')
    : resolution.mode === 'boss'
      ? 'boss'
      : resolution.mode === 'event'
        ? 'event'
        : 'reward';
  return deepFreeze({
    ...state,
    campaign,
    status: nextStatus,
    currentNode,
    deployment,
    event: resolution.event,
    scenario: resolution.scenario,
    boss: resolution.boss,
    pendingReward: resolution.mode === 'immediate' ? resolution.reward : null,
    transcript: freezeArray([...state.transcript, operation]),
    history: freezeArray([...state.history, Object.freeze({
      index: state.history.length,
      type: 'node_entered',
      nodeId: node.id,
      nodeType: node.type,
      contentId: resolution.contentId,
      routeCost: route.cost,
      mode: resolution.mode
    })])
  });
}

function chooseVerticalSliceEvent(state, choiceId, dependencies = {}) {
  assertRuntimeState(state);
  if (state.status !== 'event' || !state.event || !state.currentNode) throw new Error('no active vertical slice event');
  const event = resolveAuthoredEventChoice(state.event, choiceId, dependencies.eventChoiceResolver, {
    runtimeId: state.runtimeId,
    seed: state.seed,
    profileId: state.profileId,
    node: state.currentNode,
    resources: Object.freeze({ ...state.resources, supplies: state.campaign.supplies }),
    flags: state.flags
  });
  const delta = event.resolution.resourceDelta;
  const gold = state.resources.gold + delta.gold;
  const meta = state.resources.meta + delta.meta;
  if (gold < 0) throw new Error('event choice would make gold negative');
  if (meta < 0) throw new Error('event choice would make meta currency negative');
  let campaign = state.campaign;
  if (delta.supplies) campaign = gainSupplies(campaign, delta.supplies, `event:${event.eventId}:${event.selectedChoiceId}`);
  const flags = applyFlagChanges(state.flags, event.resolution);
  const chronicleKeys = freezeArray([...new Set([...state.chronicleKeys, ...event.resolution.chronicleKeys])].sort());
  const operation = Object.freeze({ type: 'ChooseEvent', choiceId: event.selectedChoiceId });
  return deepFreeze({
    ...state,
    campaign,
    event,
    status: 'reward',
    pendingReward: state.currentNode.reward,
    resources: Object.freeze({ gold, meta }),
    flags,
    chronicleKeys,
    transcript: freezeArray([...state.transcript, operation]),
    history: freezeArray([...state.history, Object.freeze({
      index: state.history.length,
      type: 'event_choice',
      nodeId: state.currentNode.nodeId,
      eventId: event.eventId,
      choiceId: event.selectedChoiceId,
      effectIds: event.resolution.effectIds,
      resourceDelta: event.resolution.resourceDelta,
      addFlags: event.resolution.addFlags,
      removeFlags: event.resolution.removeFlags,
      chronicleKeys: event.resolution.chronicleKeys,
      outcomeKey: event.resolution.outcomeKey
    })])
  });
}

function executeVerticalSliceDeployment(state, commandInput, dependencies = {}) {
  assertRuntimeState(state);
  if (state.status !== 'deployment' || !state.deployment || !state.scenario) throw new Error('no active vertical slice deployment');
  if (!commandInput || !DEPLOYMENT_COMMANDS.includes(commandInput.type)) throw new Error('unsupported vertical slice deployment command');
  const command = Object.freeze({
    type: commandInput.type,
    payload: Object.freeze({ ...(commandInput.payload || {}) })
  });
  if (command.type === 'ConfirmDeployment') {
    const finalized = finalizeScenarioDeployment(state.deployment);
    return deepFreeze({
      ...state,
      status: 'scenario',
      deployment: null,
      scenario: finalized.scenario,
      transcript: freezeArray([...state.transcript, command]),
      history: freezeArray([...state.history, Object.freeze({
        index: state.history.length,
        type: 'deployment_confirmed',
        nodeId: state.currentNode.nodeId,
        commandSpent: finalized.summary.commandSpent,
        commandLimit: finalized.summary.commandLimit,
        reserveIds: finalized.summary.reserveIds
      })])
    });
  }
  const deployment = executeDeploymentEdit(state.deployment, command);
  return deepFreeze({
    ...state,
    deployment,
    transcript: freezeArray([...state.transcript, command]),
    history: freezeArray([...state.history, Object.freeze({
      index: state.history.length,
      type: 'deployment_edited',
      nodeId: state.currentNode.nodeId,
      commandType: command.type,
      payload: command.payload,
      revision: deployment.revision
    })])
  });
}

function copyRequest(request) {
  if (!request || typeof request !== 'object' || typeof request.type !== 'string') throw new Error('player command is required');
  return Object.freeze({
    type: request.type,
    payload: Object.freeze({ ...(request.payload || {}) })
  });
}

function executeOrdinaryActionPair(state, request, dependencies) {
  if (!state.scenario) throw new Error('no active vertical slice scenario');
  if (state.scenario.battle.position.sideToMove !== state.playerSide) throw new Error('it is not the player side turn');
  const playerRequest = copyRequest(request);
  const playerResult = executeScenarioCommand(state.scenario, playerRequest);
  let scenario = playerResult.state;
  let aiDecision = null;
  let aiEvents = freezeArray([]);

  if (scenario.status === 'active' && scenario.battle.position.sideToMove !== state.playerSide) {
    const perspective = scenario.battle.position.sideToMove;
    aiDecision = chooseAiCommand(scenario.battle, {
      profile: state.aiProfile,
      perspective,
      objectiveEvaluator: scenarioObjectiveEvaluator(scenario),
      timeBudgetMs: dependencies.aiTimeBudgetMs ?? 0,
      maxNodes: dependencies.aiMaxNodes
    });
    if (!aiDecision.command) throw new Error(`AI produced no legal command: ${aiDecision.reason || 'unknown'}`);
    const aiResult = executeScenarioCommand(scenario, aiDecision.command);
    scenario = aiResult.state;
    aiEvents = aiResult.scenarioEvents;
  }

  if (scenario.status === 'active' && scenario.battle.position.sideToMove !== state.playerSide) {
    throw new Error('vertical slice action scheduler did not return control to the player');
  }

  let status = 'scenario';
  let pendingReward = null;
  if (scenario.status === 'completed') {
    if (scenario.result?.outcome === 'victory') {
      status = 'reward';
      pendingReward = state.currentNode.reward;
    } else status = 'failed';
  }

  return deepFreeze({
    ...state,
    scenario,
    status,
    pendingReward,
    transcript: freezeArray([...state.transcript, Object.freeze({ type: 'PlayerCommand', request: playerRequest })]),
    history: freezeArray([...state.history, Object.freeze({
      index: state.history.length,
      type: 'action_pair',
      playerCommand: playerRequest,
      playerScenarioEvents: playerResult.scenarioEvents.map((event) => event.type),
      aiCommand: aiDecision?.command || null,
      aiProfile: aiDecision?.profile || null,
      aiCompletedDepth: aiDecision?.completedDepth ?? null,
      aiNodes: aiDecision?.nodes ?? 0,
      aiAbortedBy: aiDecision?.abortedBy || null,
      aiScenarioEvents: aiEvents.map((event) => event.type),
      scenarioStatus: scenario.status,
      scenarioResult: scenario.result
    })])
  });
}

function executeBossAction(state, request, dependencies) {
  if (!state.boss || state.boss.status !== 'active') throw new Error('no active vertical slice boss');
  const resolution = executeBossActionPair(state.boss, request, {
    playerSide: state.playerSide,
    aiProfile: state.aiProfile,
    aiTimeBudgetMs: dependencies.aiTimeBudgetMs ?? 0,
    aiMaxNodes: dependencies.aiMaxNodes
  });
  const boss = resolution.boss;
  let status = 'boss';
  let pendingReward = null;
  let campaign = state.campaign;
  if (boss.status === 'awaiting_phase_transition') status = 'boss_transition';
  else if (boss.status === 'completed') {
    if (boss.result?.outcome === 'victory') {
      status = 'reward';
      pendingReward = state.currentNode.reward;
    } else {
      status = 'failed';
      if (campaign.status === 'boss_reached') campaign = completeBossNode(campaign, 'defeat');
    }
  }
  const playerRequest = resolution.playerRequest;
  return deepFreeze({
    ...state,
    campaign,
    boss,
    status,
    pendingReward,
    transcript: freezeArray([...state.transcript, Object.freeze({ type: 'PlayerCommand', request: playerRequest })]),
    history: freezeArray([...state.history, Object.freeze({
      index: state.history.length,
      type: 'boss_action_pair',
      bossId: boss.bossId,
      phaseIndex: boss.phaseIndex,
      phaseId: boss.currentPhaseId,
      playerCommand: playerRequest,
      playerScenarioEvents: resolution.playerScenarioEvents.map((event) => event.type),
      playerBossEvents: resolution.playerBossEvents.map((event) => event.type),
      aiCommand: resolution.aiDecision?.command || null,
      aiProfile: resolution.aiDecision?.profile || null,
      aiCompletedDepth: resolution.aiDecision?.completedDepth ?? null,
      aiNodes: resolution.aiDecision?.nodes ?? 0,
      aiAbortedBy: resolution.aiDecision?.abortedBy || null,
      aiScenarioEvents: resolution.aiScenarioEvents.map((event) => event.type),
      aiBossEvents: resolution.aiBossEvents.map((event) => event.type),
      bossStatus: boss.status,
      bossResult: boss.result
    })])
  });
}

function executeVerticalSlicePlayerTurn(state, request, dependencies = {}) {
  assertRuntimeState(state);
  if (state.status === 'scenario') return executeOrdinaryActionPair(state, request, dependencies);
  if (state.status === 'boss') return executeBossAction(state, request, dependencies);
  throw new Error('no active vertical slice scenario or boss');
}

function beginVerticalSliceBossPhase(state, dependencies = {}) {
  assertRuntimeState(state);
  if (state.status !== 'boss_transition' || !state.boss || state.boss.status !== 'awaiting_phase_transition') {
    throw new Error('vertical slice boss is not awaiting a phase transition');
  }
  if (typeof dependencies.bossPhaseBattleResolver !== 'function') throw new Error('bossPhaseBattleResolver is required');
  const nextPhaseIndex = state.boss.phaseIndex + 1;
  const nextPhase = state.boss.phases[nextPhaseIndex];
  const battle = dependencies.bossPhaseBattleResolver({
    runtime: state,
    boss: state.boss,
    bossId: state.boss.bossId,
    phaseIndex: nextPhaseIndex,
    phase: nextPhase,
    contentId: state.currentNode?.contentId || null
  });
  if (!battle || battle.format !== 'rpchess-battle-state') throw new Error('bossPhaseBattleResolver must return a battle state');
  const transition = advanceBossPhase(state.boss, battle);
  const boss = transition.state;
  const operation = Object.freeze({ type: 'BeginBossPhase', phaseIndex: nextPhaseIndex, phaseId: boss.currentPhaseId });
  return deepFreeze({
    ...state,
    boss,
    status: 'boss',
    transcript: freezeArray([...state.transcript, operation]),
    history: freezeArray([...state.history, Object.freeze({
      index: state.history.length,
      type: 'boss_phase_started',
      bossId: boss.bossId,
      phaseIndex: boss.phaseIndex,
      phaseId: boss.currentPhaseId,
      events: transition.events.map((event) => event.type)
    })])
  });
}

function claimVerticalSliceReward(state) {
  assertRuntimeState(state);
  if (state.status !== 'reward' || !state.pendingReward || !state.currentNode) throw new Error('no pending vertical slice reward');
  const reward = normalizeReward(state.pendingReward);
  let campaign = state.campaign;
  if (reward.supplies) campaign = gainSupplies(campaign, reward.supplies, `node:${state.currentNode.nodeId}`);
  const resources = Object.freeze({
    gold: state.resources.gold + reward.gold,
    meta: state.resources.meta + reward.meta
  });
  const bossCompleted = state.currentNode.type === 'boss';
  if (bossCompleted) campaign = completeBossNode(campaign, 'victory');
  const operation = Object.freeze({ type: 'ClaimReward' });
  const rewardRecord = Object.freeze({
    nodeId: state.currentNode.nodeId,
    nodeType: state.currentNode.type,
    contentId: state.currentNode.contentId,
    reward
  });

  return deepFreeze({
    ...state,
    campaign,
    status: bossCompleted ? 'complete' : 'campaign',
    currentNode: null,
    deployment: null,
    event: null,
    scenario: null,
    boss: null,
    pendingReward: null,
    resources,
    rewardLog: freezeArray([...state.rewardLog, rewardRecord]),
    transcript: freezeArray([...state.transcript, operation]),
    history: freezeArray([...state.history, Object.freeze({
      index: state.history.length,
      type: 'reward_claimed',
      ...rewardRecord,
      campaignStatus: campaign.status
    })])
  });
}

function snapshotVerticalSlice(state) {
  assertRuntimeState(state);
  return cloneSerializable(state);
}

function validateVerticalSliceSnapshot(snapshot, options = {}) {
  const migrated = migrateVerticalSliceSnapshot(snapshot, options);
  const asserted = assertRuntimeState(migrated);
  normalizeProfileId(asserted.profileId);
  if (options.contentRegistry) validateGraphContent(asserted.campaign.graph, options.contentRegistry);
  const army = normalizeRuntimeArmy(asserted.army, options);
  const state = army === asserted.army ? asserted : { ...asserted, army };
  if (state.currentNode) {
    const node = state.campaign.graph.nodesById[state.currentNode.nodeId];
    if (!node) throw new Error(`snapshot current node is missing: ${state.currentNode.nodeId}`);
    if (node.type !== state.currentNode.type) throw new Error('snapshot current node type mismatch');
  }
  if (state.status === 'deployment' && (!state.deployment || state.deployment.format !== 'rpchess-scenario-deployment-gate' || !state.scenario)) throw new Error('snapshot active deployment is invalid');
  if (state.status === 'event' && (!state.event || state.event.status !== 'active')) throw new Error('snapshot active event is invalid');
  if (state.status === 'scenario' && (!state.scenario || state.scenario.status !== 'active')) throw new Error('snapshot active scenario is invalid');
  if (state.status === 'boss' && (!state.boss || state.boss.status !== 'active')) throw new Error('snapshot active boss is invalid');
  if (state.status === 'boss_transition' && (!state.boss || state.boss.status !== 'awaiting_phase_transition')) throw new Error('snapshot boss transition is invalid');
  if (state.status === 'reward' && !state.pendingReward) throw new Error('snapshot reward state has no pending reward');
  if (state.status === 'complete' && state.campaign.status !== 'completed') throw new Error('snapshot completion does not match campaign');
  return deepFreeze(state);
}

function saveVerticalSlice(store, state) {
  if (!store || typeof store.save !== 'function') throw new Error('atomic profile store is required');
  const snapshot = snapshotVerticalSlice(state);
  return store.save(state.profileId, snapshot);
}

function loadVerticalSlice(store, profileId, options = {}) {
  if (!store || typeof store.load !== 'function') throw new Error('atomic profile store is required');
  const loaded = store.load(profileId, options);
  if (!loaded.payload) return Object.freeze({ ...loaded, state: null, migratedFrom: null });
  const sourceSchemaVersion = loaded.payload.schemaVersion;
  const state = validateVerticalSliceSnapshot(loaded.payload, options);
  return Object.freeze({
    ...loaded,
    state,
    migratedFrom: sourceSchemaVersion === RUNTIME_SCHEMA_VERSION ? null : sourceSchemaVersion
  });
}

function replayVerticalSlice(initialState, operations, dependencies = {}) {
  if (!Array.isArray(operations)) throw new Error('vertical slice replay operations must be an array');
  let state = validateVerticalSliceSnapshot(initialState, dependencies);
  for (const operation of operations) {
    if (!operation || typeof operation.type !== 'string') throw new Error('invalid vertical slice replay operation');
    if (operation.type === 'Travel') state = enterVerticalSliceNode(state, operation.targetNodeId, dependencies);
    else if (DEPLOYMENT_COMMANDS.includes(operation.type)) state = executeVerticalSliceDeployment(state, operation, dependencies);
    else if (operation.type === 'ChooseEvent') state = chooseVerticalSliceEvent(state, operation.choiceId, dependencies);
    else if (operation.type === 'PlayerCommand') state = executeVerticalSlicePlayerTurn(state, operation.request, dependencies);
    else if (operation.type === 'BeginBossPhase') state = beginVerticalSliceBossPhase(state, dependencies);
    else if (operation.type === 'ClaimReward') state = claimVerticalSliceReward(state);
    else throw new Error(`unsupported vertical slice replay operation: ${operation.type}`);
  }
  return state;
}

module.exports = {
  RUNTIME_FORMAT,
  LEGACY_RUNTIME_SCHEMA_VERSION,
  RUNTIME_SCHEMA_VERSION,
  RUNTIME_STATUSES,
  normalizeRuntimeArmy,
  migrateVerticalSliceSnapshot,
  contentKindForNode,
  resolveNodeContent,
  validateGraphContent,
  normalizeReward,
  createVerticalSliceRuntime,
  availableVerticalSliceRoutes,
  enterVerticalSliceNode,
  chooseVerticalSliceEvent,
  executeVerticalSliceDeployment,
  executeVerticalSlicePlayerTurn,
  beginVerticalSliceBossPhase,
  claimVerticalSliceReward,
  snapshotVerticalSlice,
  validateVerticalSliceSnapshot,
  saveVerticalSlice,
  loadVerticalSlice,
  replayVerticalSlice
};
