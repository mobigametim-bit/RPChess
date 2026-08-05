'use strict';

const { squareToIndex, toFen } = require('../core/chess/position.cjs');
const { statusView } = require('../combat/statuses.cjs');
const { legalWardAwareCommands } = require('../combat/ward-protection.cjs');
const { technicalTileSet, validateTileSet } = require('../rendering/modular-board.cjs');
const {
  RUNTIME_FORMAT,
  RUNTIME_SCHEMA_VERSION,
  RUNTIME_STATUSES,
  contentKindForNode,
  availableVerticalSliceRoutes,
  enterVerticalSliceNode,
  executeVerticalSlicePlayerTurn,
  claimVerticalSliceReward,
  saveVerticalSlice
} = require('./vertical-slice.cjs');

const PRESENTER_FORMAT = 'rpchess-presenter-snapshot';
const PRESENTER_SCHEMA_VERSION = 1;
const PRESENTER_COMMANDS = Object.freeze(['Travel', 'PlayerCommand', 'ClaimReward', 'SaveCheckpoint']);

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

function serializableCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertRuntimeState(state) {
  if (!state || state.format !== RUNTIME_FORMAT) throw new Error('invalid vertical slice runtime state');
  if (state.schemaVersion !== RUNTIME_SCHEMA_VERSION) throw new Error('unsupported vertical slice runtime schema');
  if (!RUNTIME_STATUSES.includes(state.status)) throw new Error(`invalid vertical slice runtime status: ${state.status}`);
  if (!state.campaign || state.campaign.format !== 'rpchess-campaign-state') throw new Error('vertical slice runtime requires campaign state');
  return state;
}

function localizationValue(localization, key, fallback = null) {
  if (!key) return fallback;
  if (!localization) return fallback || key;
  if (typeof localization === 'function') return localization(key) ?? fallback ?? key;
  if (typeof localization.get === 'function') return localization.get(key) ?? fallback ?? key;
  return localization[key] ?? fallback ?? key;
}

function currentContent(state, registry) {
  if (!state.currentNode || !registry || typeof registry.get !== 'function') return null;
  const kind = contentKindForNode(state.currentNode.type);
  if (!kind || !state.currentNode.contentId) return null;
  return registry.get(kind, state.currentNode.contentId) || null;
}

function regionContent(state, registry) {
  if (!registry || typeof registry.get !== 'function') return null;
  return registry.get('region', state.campaign.graph.regionId) || null;
}

function normalizeTileSet(input, fallbackId = 'technical') {
  if (!input) return technicalTileSet(fallbackId);
  try {
    return validateTileSet(input);
  } catch (_error) {
    return technicalTileSet(fallbackId);
  }
}

function resolveBoardTheme(state, dependencies = {}) {
  const registry = dependencies.contentRegistry;
  const content = currentContent(state, registry);
  const region = regionContent(state, registry);
  const themeId = content?.board?.themeId || region?.boardThemeId || dependencies.defaultBoardThemeId || 'technical';
  let candidate = null;
  if (typeof dependencies.boardThemeResolver === 'function') candidate = dependencies.boardThemeResolver(themeId, { state, content, region });
  else if (dependencies.boardThemes && typeof dependencies.boardThemes === 'object') candidate = dependencies.boardThemes[themeId];
  return Object.freeze({ themeId, tileSet: normalizeTileSet(candidate, themeId) });
}

function normalizeCommand(command) {
  return Object.freeze({
    type: String(command.type),
    payload: Object.freeze({ ...(command.payload || {}) })
  });
}

function commandKey(command) {
  const payload = command.payload || {};
  if (command.type === 'MovePiece') return `move:${payload.from}:${payload.to}:${payload.promotion || '-'}`;
  if (command.type === 'DeployReserve') return `reserve:${payload.entryId}:${payload.square}`;
  return `${command.type}:${JSON.stringify(payload)}`;
}

function pieceSnapshot(battle, square, pieceId) {
  const boardPiece = battle.position.board[squareToIndex(square)];
  const metadata = battle.identities.metadata[pieceId] || {};
  const status = statusView(battle.statuses, pieceId);
  return Object.freeze({
    pieceId,
    square,
    side: metadata.side || boardPiece?.side || null,
    type: metadata.type || boardPiece?.type || null,
    heroId: metadata.heroId || null,
    nameKey: metadata.nameKey || null,
    stars: Number.isInteger(metadata.stars) ? metadata.stars : 0,
    relicIds: freezeArray(metadata.relicIds || []),
    status
  });
}

function objectiveSnapshot(definition, progress, localization) {
  return Object.freeze({
    id: definition.id,
    type: definition.type,
    mandatory: definition.mandatory,
    side: definition.side,
    status: progress.status,
    current: progress.current,
    target: progress.target,
    details: deepFreeze(serializableCopy(progress.details || {})),
    label: localizationValue(localization, definition.previewKey, definition.id)
  });
}

function failureSnapshot(definition, progress, localization) {
  return Object.freeze({
    id: definition.id,
    type: definition.type,
    side: definition.side,
    triggered: progress.triggered,
    details: deepFreeze(serializableCopy(progress.details || {})),
    label: localizationValue(localization, definition.previewKey, definition.id)
  });
}

function scenarioSnapshot(state, dependencies = {}) {
  if (!state.scenario) return null;
  const scenario = state.scenario;
  const battle = scenario.battle;
  const boardTheme = resolveBoardTheme(state, dependencies);
  const content = currentContent(state, dependencies.contentRegistry);
  const width = scenario.board?.width || content?.board?.width || 8;
  const height = scenario.board?.height || content?.board?.height || 8;
  const activeCells = content?.board?.activeCells || null;
  const playerTurn = battle.position.sideToMove === state.playerSide && scenario.status === 'active';
  const legalCommands = playerTurn
    ? legalWardAwareCommands(battle).map(normalizeCommand).sort((a, b) => commandKey(a).localeCompare(commandKey(b)))
    : [];
  const pieces = Object.entries(battle.identities.bySquare)
    .map(([square, pieceId]) => pieceSnapshot(battle, square, pieceId))
    .sort((a, b) => a.square.localeCompare(b.square));
  const localization = dependencies.localization || null;
  const objectives = scenario.objectives.map((definition, index) => objectiveSnapshot(definition, scenario.objectiveStates[index], localization));
  const failures = scenario.failures.map((definition, index) => failureSnapshot(definition, scenario.failureStates[index], localization));
  const environment = (scenario.environment?.objects || []).map((object) => Object.freeze({
    id: object.id,
    type: object.type,
    cells: freezeArray(object.cells),
    active: object.active,
    passable: object.passable,
    interaction: object.interaction,
    label: localizationValue(localization, object.previewKey, object.id),
    metadata: deepFreeze(serializableCopy(object.metadata || {}))
  }));
  return Object.freeze({
    scenarioId: scenario.scenarioId,
    status: scenario.status,
    result: scenario.result ? deepFreeze(serializableCopy(scenario.result)) : null,
    actionIndex: scenario.actionIndex,
    playerSide: state.playerSide,
    sideToMove: battle.position.sideToMove,
    playerTurn,
    board: Object.freeze({
      width,
      height,
      activeCells: activeCells ? freezeArray(activeCells) : null,
      flipped: state.playerSide === 'b',
      themeId: boardTheme.themeId,
      tileSet: boardTheme.tileSet
    }),
    positionFen: toFen(battle.position),
    pieces: freezeArray(pieces),
    legalCommands: freezeArray(legalCommands),
    objectives: freezeArray(objectives),
    failures: freezeArray(failures),
    environment: freezeArray(environment),
    battleEventCount: battle.eventLog.length,
    scenarioEventCount: scenario.eventLog.length
  });
}

function campaignSnapshot(state, dependencies = {}) {
  const localization = dependencies.localization || null;
  const graph = state.campaign.graph;
  const routes = availableVerticalSliceRoutes(state).map((route) => Object.freeze({
    edgeId: route.edgeId,
    from: route.from,
    to: route.to,
    cost: route.cost,
    affordable: route.affordable,
    visibility: route.node.visibility,
    type: route.node.type,
    contentId: route.node.contentId,
    label: localizationValue(localization, route.node.contentId ? `${route.node.contentId}.name` : null, route.node.type || route.to)
  }));
  const nodes = graph.nodes.map((node) => {
    const visible = state.campaign.visibility[node.id] || (node.id === graph.startNodeId ? 3 : 0);
    return Object.freeze({
      id: node.id,
      layer: node.layer,
      type: visible >= 2 ? node.type : null,
      contentId: visible >= 3 ? node.contentId : null,
      visibility: visible === 0 ? 'hidden' : visible === 1 ? 'route' : visible === 2 ? 'type' : 'content',
      visited: state.campaign.visitedNodeIds.includes(node.id),
      current: state.campaign.currentNodeId === node.id,
      label: visible >= 3 && node.contentId
        ? localizationValue(localization, `${node.contentId}.name`, node.type)
        : visible >= 2 ? node.type : null
    });
  });
  return Object.freeze({
    graphId: graph.graphId,
    act: graph.act,
    regionId: graph.regionId,
    status: state.campaign.status,
    currentNodeId: state.campaign.currentNodeId,
    bossNodeId: graph.bossNodeId,
    supplies: state.campaign.supplies,
    scouting: state.campaign.scouting,
    visitedNodeIds: freezeArray(state.campaign.visitedNodeIds),
    traversedEdgeIds: freezeArray(state.campaign.traversedEdgeIds),
    nodes: freezeArray(nodes),
    routes: freezeArray(routes)
  });
}

function presenterActions(state, scenario) {
  if (state.status === 'campaign') return freezeArray(['Travel']);
  if (state.status === 'scenario' && scenario?.playerTurn) return freezeArray(['PlayerCommand']);
  if (state.status === 'reward') return freezeArray(['ClaimReward']);
  return freezeArray([]);
}

function createPresenterSnapshot(state, dependencies = {}) {
  assertRuntimeState(state);
  const campaign = campaignSnapshot(state, dependencies);
  const scenario = scenarioSnapshot(state, dependencies);
  const content = currentContent(state, dependencies.contentRegistry);
  const reward = state.pendingReward && state.currentNode ? Object.freeze({
    nodeId: state.currentNode.nodeId,
    nodeType: state.currentNode.type,
    contentId: state.currentNode.contentId,
    title: localizationValue(dependencies.localization, content?.nameKey, state.currentNode.contentId || state.currentNode.type),
    gold: state.pendingReward.gold,
    supplies: state.pendingReward.supplies,
    meta: state.pendingReward.meta
  }) : null;
  const terminal = ['complete', 'failed'].includes(state.status) ? Object.freeze({
    outcome: state.status === 'complete' ? 'victory' : 'defeat',
    campaignStatus: state.campaign.status,
    rewardsClaimed: state.rewardLog.length
  }) : null;
  return deepFreeze({
    format: PRESENTER_FORMAT,
    schemaVersion: PRESENTER_SCHEMA_VERSION,
    runtimeId: state.runtimeId,
    seed: state.seed,
    profileId: state.profileId,
    status: state.status,
    playerSide: state.playerSide,
    resources: Object.freeze({
      gold: state.resources.gold,
      supplies: state.campaign.supplies,
      meta: state.resources.meta
    }),
    campaign,
    currentNode: state.currentNode ? deepFreeze(serializableCopy(state.currentNode)) : null,
    scenario,
    reward,
    terminal,
    actions: presenterActions(state, scenario),
    transcriptLength: state.transcript.length,
    historyLength: state.history.length
  });
}

function normalizePresenterCommand(command) {
  if (!command || typeof command !== 'object') throw new Error('presenter command is required');
  const type = String(command.type || '');
  if (!PRESENTER_COMMANDS.includes(type)) throw new Error(`unsupported presenter command: ${type}`);
  if (type === 'Travel') {
    const targetNodeId = String(command.targetNodeId || command.payload?.targetNodeId || '');
    if (!targetNodeId) throw new Error('Travel requires targetNodeId');
    return Object.freeze({ type, targetNodeId });
  }
  if (type === 'PlayerCommand') {
    const request = command.request || command.payload?.request;
    if (!request || typeof request.type !== 'string') throw new Error('PlayerCommand requires request');
    return Object.freeze({ type, request: normalizeCommand(request) });
  }
  return Object.freeze({ type });
}

function dispatchPresenterCommand(state, commandInput, dependencies = {}) {
  assertRuntimeState(state);
  const command = normalizePresenterCommand(commandInput);
  let nextState = state;
  let saveEnvelope = null;
  if (command.type === 'Travel') nextState = enterVerticalSliceNode(state, command.targetNodeId, dependencies);
  else if (command.type === 'PlayerCommand') nextState = executeVerticalSlicePlayerTurn(state, command.request, dependencies);
  else if (command.type === 'ClaimReward') nextState = claimVerticalSliceReward(state);
  else if (command.type === 'SaveCheckpoint') {
    if (!dependencies.saveStore) throw new Error('SaveCheckpoint requires saveStore');
    saveEnvelope = saveVerticalSlice(dependencies.saveStore, state);
  }
  return Object.freeze({
    state: nextState,
    snapshot: createPresenterSnapshot(nextState, dependencies),
    command,
    saveEnvelope
  });
}

module.exports = {
  PRESENTER_FORMAT,
  PRESENTER_SCHEMA_VERSION,
  PRESENTER_COMMANDS,
  localizationValue,
  normalizeTileSet,
  resolveBoardTheme,
  commandKey,
  createPresenterSnapshot,
  normalizePresenterCommand,
  dispatchPresenterCommand
};
