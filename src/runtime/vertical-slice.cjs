'use strict';

const { normalizeProfileId } = require('../save/profile-store.cjs');
const {
  availableRoutes,
  travelTo,
  gainSupplies,
  completeBossNode,
  scoutNode,
  royalRetreatToConvergence,
  migrateCampaignState
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
  validateRuntimeArmy,
  createRuntimeArmy
} = require('./army-roster.cjs');
const {
  STAGE_B_FORMAT,
  SERVICE_TYPES,
  createStageBActState,
  assertStageB,
  chooseDraftHero,
  chooseDraftRegular,
  confirmDraft,
  createBattleBriefing,
  setBriefingRoster,
  confirmBriefing,
  generateRewardOffers,
  chooseRewardOffer,
  createServiceState,
  useService,
  applyBattleResults,
  chooseTalent,
  beginRoyalRetreat,
  completeRoyalRetreat,
  beginActOutcome,
  chooseActOutcome,
  updateReorganization,
  confirmReorganization
} = require('./stage-b-act.cjs');

const RUNTIME_FORMAT = 'rpchess-vertical-slice-runtime';
const LEGACY_RUNTIME_SCHEMA_VERSION = 1;
const PREVIOUS_RUNTIME_SCHEMA_VERSION = 2;
const RUNTIME_SCHEMA_VERSION = 3;
const RUNTIME_STATUSES = Object.freeze([
  'draft',
  'campaign',
  'briefing',
  'deployment',
  'event',
  'scenario',
  'boss',
  'boss_transition',
  'reward',
  'reward_choice',
  'service',
  'retreat',
  'act_outcome',
  'reorganization',
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
    if (options.requireArmy) throw new Error('vertical slice army validation requires contentRegistry and combatProfiles');
    return army;
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

function heroCatalogFromOptions(army, options = {}) {
  if (Array.isArray(options.heroCatalog) && options.heroCatalog.length) return options.heroCatalog;
  if (options.contentRegistry && typeof options.contentRegistry.list === 'function') {
    return options.contentRegistry.list('hero')
      .filter((hero) => !army?.regionId || hero.regionId === army.regionId)
      .map((hero) => ({
        id: hero.id,
        name: options.localization?.[hero.nameKey] || hero.nameKey || hero.id,
        pieceType: hero.pieceType,
        relicIds: options.combatProfiles?.heroes?.[hero.id]?.relicIds || []
      }));
  }
  return (army?.heroes || []).map((hero) => ({ id: hero.heroId, name: hero.nameKey || hero.heroId, pieceType: hero.contentPieceType || hero.pieceType, relicIds: hero.relicIds || [] }));
}

function migrationStageB(snapshot, army, campaign, options = {}) {
  if (snapshot.stageB?.format === STAGE_B_FORMAT) return snapshot.stageB;
  return createStageBActState({
    seed: snapshot.seed || campaign?.graph?.seed || 1,
    act: campaign?.graph?.act || 1,
    army,
    heroCatalog: heroCatalogFromOptions(army, options),
    preferredHeroId: army?.heroIds?.[0] || null,
    difficulty: options.difficulty || 'normal',
    skipDraft: true
  });
}

function migrateVerticalSliceSnapshot(snapshot, options = {}) {
  if (!snapshot || snapshot.format !== RUNTIME_FORMAT) throw new Error('invalid vertical slice runtime state');
  if (![LEGACY_RUNTIME_SCHEMA_VERSION, PREVIOUS_RUNTIME_SCHEMA_VERSION, RUNTIME_SCHEMA_VERSION].includes(snapshot.schemaVersion)) throw new Error('unsupported vertical slice runtime schema');
  const cloned = cloneSerializable(snapshot);
  const army = migrationArmy(cloned, options);
  if (!hasOwn(cloned, 'army') && cloned.schemaVersion >= PREVIOUS_RUNTIME_SCHEMA_VERSION) throw new Error('vertical slice runtime schema 2 requires an army field');
  const campaign = migrateCampaignState(cloned.campaign);
  const stageB = migrationStageB(cloned, army, campaign, options);
  const status = cloned.schemaVersion === RUNTIME_SCHEMA_VERSION ? cloned.status : (cloned.status === 'campaign' && stageB.status === 'draft' ? 'draft' : cloned.status);
  return {
    ...cloned,
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    army,
    campaign,
    stageB,
    status
  };
}

function assertRuntimeState(state) {
  if (!state || state.format !== RUNTIME_FORMAT) throw new Error('invalid vertical slice runtime state');
  if (state.schemaVersion !== RUNTIME_SCHEMA_VERSION) throw new Error('unsupported vertical slice runtime schema');
  if (!hasOwn(state, 'army')) throw new Error('vertical slice runtime requires an army field');
  if (!RUNTIME_STATUSES.includes(state.status)) throw new Error(`invalid vertical slice runtime status: ${state.status}`);
  if (!state.campaign || state.campaign.format !== 'rpchess-campaign-state') throw new Error('vertical slice runtime requires campaign state');
  if (!state.stageB || state.stageB.format !== STAGE_B_FORMAT) throw new Error('vertical slice runtime requires Stage B act state');
  assertStageB(state.stageB);
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
  const seed = Number(options.seed ?? campaign.graph.seed ?? 1);
  const stageB = options.stageB || createStageBActState({
    seed,
    act: campaign.graph.act,
    army,
    heroCatalog: heroCatalogFromOptions(army, options),
    preferredHeroId: options.preferredHeroId || army?.heroIds?.[0] || null,
    preselectPreferredHero: Boolean(options.preselectPreferredHero),
    difficulty: options.difficulty || 'normal',
    skipDraft: options.skipStageBDraft === true || !campaign.graph.stageB
  });

  return deepFreeze({
    format: RUNTIME_FORMAT,
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    runtimeId: String(options.runtimeId || `${campaign.graph.graphId}:${profileId}`),
    seed,
    profileId,
    playerSide,
    aiProfile: String(options.aiProfile || 'tactician'),
    campaign,
    army,
    stageB,
    status: stageB.status === 'draft' ? 'draft' : 'campaign',
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

function activeStageBRosterIds(state) {
  return freezeArray((state.stageB?.roster || []).filter((entry) => entry.active && entry.available).map((entry) => entry.id));
}

function capturedStageBRosterIds(state, scenario) {
  if (!scenario?.battle) return freezeArray([]);
  const metadata = scenario.battle.identities?.metadata || {};
  const active = (state.stageB?.roster || []).filter((entry) => entry.active);
  const consumedRegular = new Set();
  const captured = [];
  for (const event of scenario.battle.eventLog || []) {
    if (event.type !== 'PieceCaptured' || event.payload?.capturedSide !== state.playerSide) continue;
    const record = metadata[event.payload.capturedId] || {};
    if (record.heroId && state.stageB.roster.some((entry) => entry.id === record.heroId)) {
      captured.push(record.heroId);
      continue;
    }
    if (record.kingId) {
      const king = active.find((entry) => entry.kind === 'king');
      if (king) captured.push(king.id);
      continue;
    }
    const regular = active.find((entry) => entry.kind === 'regular' && entry.type === event.payload.capturedType && !consumedRegular.has(entry.id));
    if (regular) { consumedRegular.add(regular.id); captured.push(regular.id); }
  }
  return freezeArray([...new Set(captured)]);
}

function completeStageBBattle(state, scenario, victory, options = {}) {
  const stageBWithResults = applyBattleResults(state.stageB, {
    victory,
    capturedRosterIds: capturedStageBRosterIds(state, scenario),
    activeRosterIds: activeStageBRosterIds(state),
    sideObjectiveCompleted: Boolean(options.sideObjectiveCompleted),
    criticalRisk: Boolean(options.criticalRisk)
  });
  if (victory) {
    const stageB = generateRewardOffers(stageBWithResults, {
      nodeId: state.currentNode?.nodeId || null,
      elite: state.currentNode?.type === 'elite' || state.currentNode?.type === 'boss',
      sideObjectiveCompleted: Boolean(options.sideObjectiveCompleted),
      doctrineId: state.army?.doctrineId || null
    });
    return Object.freeze({ stageB, status: 'reward_choice' });
  }
  const node = state.campaign.graph.nodesById[state.currentNode?.nodeId || state.campaign.currentNodeId];
  const destinationNodeId = node?.emergencyTo || state.campaign.graph.bossNodeId;
  const stageB = beginRoyalRetreat(stageBWithResults, {
    nodeId: node?.id || null,
    destinationNodeId,
    lossGold: 5,
    lossSupplies: 2
  });
  return Object.freeze({ stageB, status: stageB.status === 'failed' ? 'failed' : 'retreat', destinationNodeId });
}

function executeVerticalSliceDraft(state, command, dependencies = {}) {
  assertRuntimeState(state);
  if (state.status !== 'draft') throw new Error('Stage B draft is not active');
  let stageB = state.stageB;
  if (command.type === 'ChooseDraftHero') stageB = chooseDraftHero(stageB, command.heroId || command.payload?.heroId);
  else if (command.type === 'ChooseDraftRegular') stageB = chooseDraftRegular(stageB, command.regularId || command.payload?.regularId);
  else if (command.type === 'ConfirmDraft') {
    stageB = confirmDraft(stageB);
    const heroId = stageB.draft.selectedHeroId;
    const army = state.army && dependencies.contentRegistry && dependencies.combatProfiles
      ? createRuntimeArmy({ regionId: state.army.regionId, kingId: state.army.kingId, doctrineId: state.army.doctrineId, heroIds: [heroId] }, dependencies.contentRegistry, dependencies.combatProfiles)
      : state.army;
    const operation = Object.freeze({ type: 'ConfirmDraft' });
    return deepFreeze({ ...state, army, stageB, status: 'campaign', campaign: stageB.draft.crownBonus.supplies ? gainSupplies(state.campaign, stageB.draft.crownBonus.supplies, 'crown_start_bonus') : state.campaign, transcript: freezeArray([...state.transcript, operation]), history: freezeArray([...state.history, Object.freeze({ index: state.history.length, type: 'stage_b_draft_confirmed', heroId, regularId: stageB.draft.selectedRegularId })]) });
  } else throw new Error(`unsupported Stage B draft command: ${command.type}`);
  return deepFreeze({ ...state, stageB, transcript: freezeArray([...state.transcript, Object.freeze({ type: command.type, ...(command.payload || command) })]) });
}

function scoutVerticalSliceNode(state, nodeId) {
  assertRuntimeState(state);
  if (state.status !== 'campaign') throw new Error('scouting is available only on the campaign map');
  const campaign = scoutNode(state.campaign, nodeId);
  const operation = Object.freeze({ type: 'ScoutNode', nodeId });
  return deepFreeze({ ...state, campaign, transcript: freezeArray([...state.transcript, operation]), history: freezeArray([...state.history, Object.freeze({ index: state.history.length, type: 'node_scouted', nodeId })]) });
}

function executeVerticalSliceBriefing(state, command) {
  assertRuntimeState(state);
  if (state.status !== 'briefing' || !state.currentNode) throw new Error('no battle briefing is active');
  let stageB = state.stageB;
  if (command.type === 'SetBriefingRoster') stageB = setBriefingRoster(stageB, command.activeRosterIds || command.payload?.activeRosterIds || []);
  else if (command.type === 'ConfirmBriefing') {
    stageB = confirmBriefing(stageB);
    const status = state.currentNode.postBriefingStatus || (state.deployment ? 'deployment' : state.boss ? 'boss' : 'scenario');
    return deepFreeze({ ...state, stageB, status, transcript: freezeArray([...state.transcript, Object.freeze({ type: 'ConfirmBriefing' })]) });
  } else throw new Error(`unsupported briefing command: ${command.type}`);
  return deepFreeze({ ...state, stageB, transcript: freezeArray([...state.transcript, Object.freeze({ type: command.type, activeRosterIds: command.activeRosterIds || command.payload?.activeRosterIds || [] })]) });
}

function chooseVerticalSliceRewardOffer(state, offerId, options = {}) {
  assertRuntimeState(state);
  if (state.status !== 'reward_choice') throw new Error('no Stage B reward choice is pending');
  const offer = state.stageB.pendingRewardOffers.find((entry) => entry.id === offerId);
  if (!offer) throw new Error('reward offer is unavailable');
  let campaign = state.campaign;
  let resources = { ...state.resources };
  if (offer.type === 'gold') resources.gold += offer.payload.gold || 0;
  if (offer.type === 'supplies') campaign = gainSupplies(campaign, offer.payload.supplies || 0, `stage_b_reward:${offer.id}`);
  if (offer.type === 'scouting') campaign = { ...campaign, scouting: Math.min(3, campaign.scouting + (offer.payload.scouting || 1)) };
  let stageB = chooseRewardOffer(state.stageB, offerId, { targetRosterId: options.targetRosterId || null, nodeId: state.currentNode?.nodeId || null });
  const bossCompleted = state.currentNode?.type === 'boss';
  if (bossCompleted) {
    if (campaign.status === 'boss_reached') campaign = completeBossNode(campaign, 'victory');
    stageB = beginActOutcome(stageB, { regionalRecruitId: stageB.draft.selectedHeroId || state.army?.heroIds?.[0] || 'hero.aldric_wall' });
  }
  const operation = Object.freeze({ type: 'ChooseRewardOffer', offerId, targetRosterId: options.targetRosterId || null });
  const rewardRecord = Object.freeze({ nodeId: state.currentNode?.nodeId || null, nodeType: state.currentNode?.type || null, contentId: state.currentNode?.contentId || null, offer });
  return deepFreeze({
    ...state,
    campaign,
    resources: Object.freeze(resources),
    stageB,
    status: bossCompleted ? 'act_outcome' : 'campaign',
    currentNode: null,
    deployment: null,
    event: null,
    scenario: null,
    boss: null,
    pendingReward: null,
    rewardLog: freezeArray([...state.rewardLog, rewardRecord]),
    transcript: freezeArray([...state.transcript, operation]),
    history: freezeArray([...state.history, Object.freeze({ index: state.history.length, type: 'stage_b_reward_selected', ...rewardRecord })])
  });
}

function executeVerticalSliceService(state, command) {
  assertRuntimeState(state);
  if (state.status !== 'service') throw new Error('no specialized service is active');
  if (command.type === 'LeaveService') return deepFreeze({ ...state, status: 'campaign', currentNode: null, stageB: { ...state.stageB, status: 'campaign', service: null }, transcript: freezeArray([...state.transcript, Object.freeze({ type: 'LeaveService' })]) });
  if (command.type !== 'UseService') throw new Error(`unsupported service command: ${command.type}`);
  const offerId = command.offerId || command.payload?.offerId;
  const targetRosterId = command.targetRosterId || command.payload?.targetRosterId || null;
  const offer = state.stageB.service?.offers.find((entry) => entry.id === offerId);
  if (!offer) throw new Error('service offer is unavailable');
  const stageB = useService(state.stageB, offerId, { targetRosterId, gold: state.resources.gold });
  const resources = Object.freeze({ ...state.resources, gold: state.resources.gold - offer.cost });
  return deepFreeze({ ...state, stageB, resources, status: 'campaign', currentNode: null, transcript: freezeArray([...state.transcript, Object.freeze({ type: 'UseService', offerId, targetRosterId })]) });
}

function executeVerticalSliceRetreat(state) {
  assertRuntimeState(state);
  if (state.status !== 'retreat') throw new Error('no royal retreat is pending');
  const retreat = state.stageB.royalRetreat;
  const campaign = royalRetreatToConvergence(state.campaign, retreat.lostNodeId, { reason: 'royal_retreat' });
  const stageB = completeRoyalRetreat(state.stageB);
  const resources = Object.freeze({ ...state.resources, gold: Math.max(0, state.resources.gold - 5) });
  const nextCampaign = campaign.supplies >= 2 ? gainSupplies(campaign, -2, 'royal_retreat') : { ...campaign, supplies: 0 };
  return deepFreeze({ ...state, campaign: nextCampaign, stageB, resources, status: 'campaign', currentNode: null, deployment: null, scenario: null, boss: null, pendingReward: null, transcript: freezeArray([...state.transcript, Object.freeze({ type: 'ContinueRoyalRetreat' })]) });
}

function executeVerticalSliceTalent(state, command) {
  assertRuntimeState(state);
  const rosterId = command.rosterId || command.payload?.rosterId;
  const talentId = command.talentId || command.payload?.talentId;
  if (!rosterId || !talentId) throw new Error('ChooseTalent requires rosterId and talentId');
  const stageB = chooseTalent(state.stageB, rosterId, talentId);
  return deepFreeze({
    ...state,
    stageB,
    transcript: freezeArray([...state.transcript, Object.freeze({ type: 'ChooseTalent', rosterId, talentId })]),
    history: freezeArray([...state.history, Object.freeze({ index: state.history.length, type: 'stage_b_talent_selected', rosterId, talentId })])
  });
}

function executeVerticalSliceActOutcome(state, command) {
  assertRuntimeState(state);
  if (command.type === 'ChooseActOutcome') {
    const choiceId = command.choiceId || command.payload?.choiceId;
    const stageB = chooseActOutcome(state.stageB, choiceId);
    return deepFreeze({ ...state, stageB, status: 'reorganization', transcript: freezeArray([...state.transcript, Object.freeze({ type: 'ChooseActOutcome', choiceId })]) });
  }
  if (command.type === 'SetReorganization') {
    const activeRosterIds = command.activeRosterIds || command.payload?.activeRosterIds || [];
    const stageB = updateReorganization(state.stageB, activeRosterIds);
    return deepFreeze({ ...state, stageB, transcript: freezeArray([...state.transcript, Object.freeze({ type: 'SetReorganization', activeRosterIds })]) });
  }
  if (command.type === 'ConfirmReorganization') {
    const stageB = confirmReorganization(state.stageB);
    return deepFreeze({ ...state, stageB, status: 'complete', transcript: freezeArray([...state.transcript, Object.freeze({ type: 'ConfirmReorganization' })]) });
  }
  if (command.type === 'ChooseTalent') {
    const rosterId = command.rosterId || command.payload?.rosterId;
    const talentId = command.talentId || command.payload?.talentId;
    const stageB = chooseTalent(state.stageB, rosterId, talentId);
    return deepFreeze({ ...state, stageB, transcript: freezeArray([...state.transcript, Object.freeze({ type: 'ChooseTalent', rosterId, talentId })]) });
  }
  throw new Error(`unsupported Stage B act command: ${command.type}`);
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
  const resolution = normalizeNodeResolution(node, content, dependencies.nodeResolver({ runtime: state, campaign, node, content }));
  if (resolution.mode === 'scenario' && resolution.scenario.battle.position.sideToMove !== state.playerSide) throw new Error(`${node.id} scenario must begin on the player side`);
  if (resolution.mode === 'boss' && resolution.boss.scenario.battle.position.sideToMove !== state.playerSide) throw new Error(`${node.id} boss must begin on the player side`);

  const deployment = resolution.mode === 'scenario' && typeof dependencies.deploymentFactory === 'function'
    ? dependencies.deploymentFactory({ runtime: state, campaign, node, content, scenario: resolution.scenario })
    : null;
  const operation = Object.freeze({ type: 'Travel', targetNodeId });
  let currentNode = Object.freeze({ nodeId: node.id, type: node.type, contentId: resolution.contentId, reward: resolution.reward, postBriefingStatus: null });
  let stageB = state.stageB;
  let nextStatus;
  let pendingReward = resolution.mode === 'immediate' ? resolution.reward : null;

  if (state.campaign.graph.stageB && SERVICE_TYPES.includes(node.type)) {
    stageB = createServiceState(stageB, node.type, { nodeId: node.id });
    nextStatus = 'service';
    pendingReward = null;
  } else if (resolution.mode === 'scenario' && state.campaign.graph.stageB) {
    stageB = createBattleBriefing(stageB, node, resolution.scenario, {
      title: node.type === 'elite' ? 'Элитное столкновение' : 'Тактическое сражение',
      fixedRosterIds: stageB.roster.filter((entry) => entry.kind === 'king').map((entry) => entry.id),
      deploymentZone: deployment?.zone || [],
      ambush: Boolean(resolution.scenario?.tags?.includes?.('ambush'))
    });
    currentNode = Object.freeze({ ...currentNode, postBriefingStatus: deployment ? 'deployment' : 'scenario' });
    nextStatus = 'briefing';
  } else if (resolution.mode === 'scenario') {
    nextStatus = deployment ? 'deployment' : 'scenario';
  } else if (resolution.mode === 'boss' && state.campaign.graph.stageB) {
    stageB = createBattleBriefing(stageB, node, resolution.boss.scenario, {
      title: 'Железный Регент',
      fixedRosterIds: stageB.roster.filter((entry) => entry.kind === 'king').map((entry) => entry.id),
      deploymentZone: []
    });
    currentNode = Object.freeze({ ...currentNode, postBriefingStatus: 'boss' });
    nextStatus = 'briefing';
  } else if (resolution.mode === 'boss') nextStatus = 'boss';
  else if (resolution.mode === 'event') nextStatus = 'event';
  else if (state.campaign.graph.stageB && ['treasure', 'recovery'].includes(node.type)) {
    stageB = generateRewardOffers(stageB, { nodeId: node.id, elite: false, sideObjectiveCompleted: false, doctrineId: state.army?.doctrineId || null });
    nextStatus = 'reward_choice';
    pendingReward = null;
  } else nextStatus = 'reward';

  return deepFreeze({
    ...state,
    campaign,
    stageB,
    status: nextStatus,
    currentNode,
    deployment,
    event: resolution.event,
    scenario: resolution.scenario,
    boss: resolution.boss,
    pendingReward,
    transcript: freezeArray([...state.transcript, operation]),
    history: freezeArray([...state.history, Object.freeze({ index: state.history.length, type: 'node_entered', nodeId: node.id, nodeType: node.type, contentId: resolution.contentId, routeCost: route.cost, mode: resolution.mode })])
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
  const stageBFlow = Boolean(state.campaign.graph.stageB);
  const nodeReward = normalizeReward(state.currentNode.reward || {});
  if (stageBFlow) {
    if (nodeReward.supplies) campaign = gainSupplies(campaign, nodeReward.supplies, `event_reward:${event.eventId}`);
    const rewardRecord = Object.freeze({ nodeId: state.currentNode.nodeId, nodeType: state.currentNode.type, contentId: state.currentNode.contentId, reward: nodeReward, eventChoiceId: event.selectedChoiceId });
    return deepFreeze({
      ...state,
      campaign,
      event,
      status: 'campaign',
      currentNode: null,
      pendingReward: null,
      resources: Object.freeze({ gold: gold + nodeReward.gold, meta: meta + nodeReward.meta }),
      flags,
      chronicleKeys,
      rewardLog: freezeArray([...state.rewardLog, rewardRecord]),
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
  return deepFreeze({
    ...state,
    campaign,
    event,
    status: 'reward',
    pendingReward: nodeReward,
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
  let stageB = state.stageB;
  if (scenario.status === 'completed') {
    if (state.campaign.graph.stageB) {
      const completion = completeStageBBattle(state, scenario, scenario.result?.outcome === 'victory', {
        sideObjectiveCompleted: (scenario.objectiveStates || []).some((item) => item.completed && /side|bonus|optional/i.test(item.id || ''))
      });
      stageB = completion.stageB;
      status = completion.status;
    } else if (scenario.result?.outcome === 'victory') {
      status = 'reward';
      pendingReward = state.currentNode.reward;
    } else status = 'failed';
  }

  return deepFreeze({
    ...state,
    scenario,
    stageB,
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
  let stageB = state.stageB;
  if (boss.status === 'awaiting_phase_transition') status = 'boss_transition';
  else if (boss.status === 'completed') {
    if (state.campaign.graph.stageB) {
      const completion = completeStageBBattle(state, boss.scenario, boss.result?.outcome === 'victory', { sideObjectiveCompleted: false, criticalRisk: true });
      stageB = completion.stageB;
      status = completion.status;
      if (status === 'failed' && campaign.status === 'boss_reached') campaign = completeBossNode(campaign, 'defeat');
    } else if (boss.result?.outcome === 'victory') {
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
    stageB,
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
  if (state.status === 'draft' && state.stageB.status !== 'draft') throw new Error('snapshot draft state is invalid');
  if (state.status === 'briefing' && (!state.stageB.briefing || state.stageB.status !== 'briefing')) throw new Error('snapshot briefing state is invalid');
  if (state.status === 'deployment' && (!state.deployment || state.deployment.format !== 'rpchess-scenario-deployment-gate' || !state.scenario)) throw new Error('snapshot active deployment is invalid');
  if (state.status === 'event' && (!state.event || state.event.status !== 'active')) throw new Error('snapshot active event is invalid');
  if (state.status === 'scenario' && (!state.scenario || state.scenario.status !== 'active')) throw new Error('snapshot active scenario is invalid');
  if (state.status === 'boss' && (!state.boss || state.boss.status !== 'active')) throw new Error('snapshot active boss is invalid');
  if (state.status === 'boss_transition' && (!state.boss || state.boss.status !== 'awaiting_phase_transition')) throw new Error('snapshot boss transition is invalid');
  if (state.status === 'reward' && !state.pendingReward) throw new Error('snapshot reward state has no pending reward');
  if (state.status === 'reward_choice' && (!state.stageB.pendingRewardOffers || state.stageB.pendingRewardOffers.length !== 3)) throw new Error('snapshot Stage B reward choice is invalid');
  if (state.status === 'service' && !state.stageB.service) throw new Error('snapshot Stage B service is invalid');
  if (state.status === 'retreat' && state.stageB.royalRetreat?.status !== 'pending') throw new Error('snapshot royal retreat is invalid');
  if (state.status === 'act_outcome' && !state.stageB.actOutcome) throw new Error('snapshot act outcome is invalid');
  if (state.status === 'reorganization' && !state.stageB.reorganization) throw new Error('snapshot reorganization is invalid');
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
    else if (['ChooseDraftHero', 'ChooseDraftRegular', 'ConfirmDraft'].includes(operation.type)) state = executeVerticalSliceDraft(state, operation, dependencies);
    else if (operation.type === 'ScoutNode') state = scoutVerticalSliceNode(state, operation.nodeId);
    else if (['SetBriefingRoster', 'ConfirmBriefing'].includes(operation.type)) state = executeVerticalSliceBriefing(state, operation);
    else if (DEPLOYMENT_COMMANDS.includes(operation.type)) state = executeVerticalSliceDeployment(state, operation, dependencies);
    else if (operation.type === 'ChooseEvent') state = chooseVerticalSliceEvent(state, operation.choiceId, dependencies);
    else if (operation.type === 'PlayerCommand') state = executeVerticalSlicePlayerTurn(state, operation.request, dependencies);
    else if (operation.type === 'BeginBossPhase') state = beginVerticalSliceBossPhase(state, dependencies);
    else if (operation.type === 'ChooseRewardOffer') state = chooseVerticalSliceRewardOffer(state, operation.offerId, operation);
    else if (['UseService', 'LeaveService'].includes(operation.type)) state = executeVerticalSliceService(state, operation);
    else if (operation.type === 'ContinueRoyalRetreat') state = executeVerticalSliceRetreat(state);
    else if (operation.type === 'ChooseTalent') state = executeVerticalSliceTalent(state, operation);
    else if (['ChooseActOutcome', 'SetReorganization', 'ConfirmReorganization'].includes(operation.type)) state = executeVerticalSliceActOutcome(state, operation);
    else if (operation.type === 'ClaimReward') state = claimVerticalSliceReward(state);
    else throw new Error(`unsupported vertical slice replay operation: ${operation.type}`);
  }
  return state;
}

module.exports = {
  RUNTIME_FORMAT,
  LEGACY_RUNTIME_SCHEMA_VERSION,
  PREVIOUS_RUNTIME_SCHEMA_VERSION,
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
  executeVerticalSliceDraft,
  scoutVerticalSliceNode,
  executeVerticalSliceBriefing,
  chooseVerticalSliceRewardOffer,
  executeVerticalSliceService,
  executeVerticalSliceRetreat,
  executeVerticalSliceTalent,
  executeVerticalSliceActOutcome,
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
