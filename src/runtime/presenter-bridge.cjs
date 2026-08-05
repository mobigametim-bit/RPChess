'use strict';

const { squareToIndex, toFen } = require('../core/chess/position.cjs');
const { gameStatus } = require('../core/chess/rules.cjs');
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
  chooseVerticalSliceEvent,
  executeVerticalSliceDeployment,
  executeVerticalSlicePlayerTurn,
  beginVerticalSliceBossPhase,
  claimVerticalSliceReward,
  saveVerticalSlice
} = require('./vertical-slice.cjs');
const { deploymentGateSnapshot } = require('./deployment-gate.cjs');

const PRESENTER_FORMAT = 'rpchess-presenter-snapshot';
const PRESENTER_SCHEMA_VERSION = 1;
const PRESENTER_COMMANDS = Object.freeze([
  'Travel',
  'PlaceDeploymentUnit',
  'RemoveDeploymentUnit',
  'ConfirmDeployment',
  'ChooseEvent',
  'PlayerCommand',
  'BeginBossPhase',
  'ClaimReward',
  'SaveCheckpoint'
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
  return Object.freeze({
    pieceId,
    square,
    side: metadata.side || boardPiece?.side || null,
    type: metadata.type || boardPiece?.type || null,
    heroId: metadata.heroId || null,
    nameKey: metadata.nameKey || null,
    stars: Number.isInteger(metadata.stars) ? metadata.stars : 0,
    relicIds: freezeArray(metadata.relicIds || []),
    status: statusView(battle.statuses, pieceId)
  });
}

function eventSnapshot(state, dependencies = {}) {
  if (!state.event) return null;
  const event = state.event;
  const localization = dependencies.localization || null;
  return Object.freeze({
    eventId: event.eventId,
    nodeId: event.nodeId,
    status: event.status,
    title: localizationValue(localization, event.titleKey, event.eventId),
    body: localizationValue(localization, event.bodyKey, event.eventId),
    sceneArt: event.sceneArt,
    scope: event.scope,
    selectedChoiceId: event.selectedChoiceId,
    choices: freezeArray(event.choices.map((choice) => Object.freeze({
      id: choice.id,
      label: localizationValue(localization, choice.textKey, choice.id),
      effectCount: choice.effectIds.length
    }))),
    outcome: event.resolution?.outcomeKey
      ? localizationValue(localization, event.resolution.outcomeKey, event.resolution.outcomeKey)
      : null
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

function activeScenario(state) {
  return state.scenario || state.boss?.scenario || null;
}

function recentBattleEvents(battle, limit = 8) {
  return freezeArray((battle.eventLog || []).slice(-limit).map((event) => Object.freeze({
    id: event.id,
    sequence: event.sequence,
    type: event.type,
    payload: deepFreeze(serializableCopy(event.payload || {}))
  })));
}

function orderPoolSnapshot(pool) {
  return Object.freeze({
    current: Number.isInteger(pool?.current) ? pool.current : 0,
    max: Number.isInteger(pool?.max) ? pool.max : 0
  });
}

function reserveSnapshot(battle, legalCommands, localization) {
  const legalSquaresByEntry = new Map();
  for (const command of legalCommands) {
    if (command.type !== 'DeployReserve') continue;
    const entryId = command.payload.entryId;
    if (!legalSquaresByEntry.has(entryId)) legalSquaresByEntry.set(entryId, []);
    legalSquaresByEntry.get(entryId).push(command.payload.square);
  }
  return freezeArray((battle.reserve || []).map((entry) => {
    const metadata = entry.metadata || {};
    const legalSquares = [...new Set(legalSquaresByEntry.get(entry.id) || [])].sort();
    const pool = battle.orderPoints?.[entry.side];
    return Object.freeze({
      id: entry.id,
      entryId: entry.id,
      side: entry.side,
      type: entry.type,
      orderCost: entry.orderCost,
      heroId: metadata.heroId || null,
      nameKey: metadata.nameKey || null,
      label: localizationValue(localization, metadata.nameKey, metadata.heroId || entry.id),
      affordable: Boolean(pool && pool.current >= entry.orderCost),
      activeTurn: battle.position.sideToMove === entry.side,
      legalSquares: freezeArray(legalSquares)
    });
  }));
}

function scenarioSnapshot(state, dependencies = {}) {
  const scenario = activeScenario(state);
  if (!scenario) return null;
  const battle = scenario.battle;
  const boardTheme = resolveBoardTheme(state, dependencies);
  const content = currentContent(state, dependencies.contentRegistry);
  const width = scenario.board?.width || content?.board?.width || 8;
  const height = scenario.board?.height || content?.board?.height || 8;
  const activeCells = content?.board?.activeCells || null;
  const playerTurn = ['scenario', 'boss'].includes(state.status) && battle.position.sideToMove === state.playerSide && scenario.status === 'active';
  const legalCommands = playerTurn
    ? legalWardAwareCommands(battle).map(normalizeCommand).sort((a, b) => commandKey(a).localeCompare(commandKey(b)))
    : [];
  const localization = dependencies.localization || null;
  const reserve = reserveSnapshot(battle, legalCommands, localization);
  const opponentSide = state.playerSide === 'w' ? 'b' : 'w';
  const orderPoints = Object.freeze({
    w: orderPoolSnapshot(battle.orderPoints?.w),
    b: orderPoolSnapshot(battle.orderPoints?.b),
    player: Object.freeze({ side: state.playerSide, ...orderPoolSnapshot(battle.orderPoints?.[state.playerSide]) }),
    opponent: Object.freeze({ side: opponentSide, ...orderPoolSnapshot(battle.orderPoints?.[opponentSide]) })
  });
  const reserveCells = Object.freeze({
    w: freezeArray(battle.reserveCells?.w || []),
    b: freezeArray(battle.reserveCells?.b || [])
  });
  const pieces = Object.entries(battle.identities.bySquare)
    .map(([square, pieceId]) => pieceSnapshot(battle, square, pieceId))
    .sort((a, b) => a.square.localeCompare(b.square));
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
  const chess = gameStatus(battle.position, battle.scenarioRules || {});
  return Object.freeze({
    scenarioId: scenario.scenarioId,
    status: scenario.status,
    result: scenario.result ? deepFreeze(serializableCopy(scenario.result)) : null,
    actionIndex: scenario.actionIndex,
    playerSide: state.playerSide,
    sideToMove: battle.position.sideToMove,
    playerTurn,
    chessStatus: Object.freeze({
      state: chess.state,
      check: Boolean(chess.check),
      legalMoves: chess.legalMoves,
      winner: chess.winner || null
    }),
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
    orderPoints,
    reserve,
    reserveCells,
    objectives: freezeArray(objectives),
    failures: freezeArray(failures),
    environment: freezeArray(environment),
    recentBattleEvents: recentBattleEvents(battle),
    battleEventCount: battle.eventLog.length,
    scenarioEventCount: scenario.eventLog.length
  });
}

function bossSnapshot(state, dependencies = {}) {
  if (!state.boss) return null;
  const boss = state.boss;
  const phase = boss.phases[boss.phaseIndex];
  const nextPhase = boss.phases[boss.phaseIndex + 1] || null;
  const localization = dependencies.localization || null;
  return Object.freeze({
    bossId: boss.bossId,
    status: boss.status,
    result: boss.result ? deepFreeze(serializableCopy(boss.result)) : null,
    phaseIndex: boss.phaseIndex,
    phaseNumber: boss.phaseIndex + 1,
    phaseCount: boss.phases.length,
    currentPhaseId: boss.currentPhaseId,
    currentPhaseTitle: localizationValue(localization, phase?.titleKey, boss.currentPhaseId),
    nextPhaseId: nextPhase?.id || null,
    nextPhaseTitle: nextPhase ? localizationValue(localization, nextPhase.titleKey, nextPhase.id) : null,
    completedPhases: freezeArray(boss.phaseHistory.map((record) => Object.freeze({
      phaseIndex: record.phaseIndex,
      phaseId: record.phaseId,
      outcome: record.outcome,
      reason: record.reason,
      actionCount: record.actionCount
    })))
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

function presenterActions(state, event, scenario) {
  if (state.status === 'campaign') return freezeArray(['Travel']);
  if (state.status === 'deployment') return freezeArray(['PlaceDeploymentUnit', 'RemoveDeploymentUnit', 'ConfirmDeployment']);
  if (state.status === 'event' && event?.status === 'active') return freezeArray(['ChooseEvent']);
  if (['scenario', 'boss'].includes(state.status) && scenario?.playerTurn) return freezeArray(['PlayerCommand']);
  if (state.status === 'boss_transition') return freezeArray(['BeginBossPhase']);
  if (state.status === 'reward') return freezeArray(['ClaimReward']);
  return freezeArray([]);
}

function createPresenterSnapshot(state, dependencies = {}) {
  assertRuntimeState(state);
  const campaign = campaignSnapshot(state, dependencies);
  const event = eventSnapshot(state, dependencies);
  const deployment = state.deployment ? deploymentGateSnapshot(state.deployment) : null;
  const scenario = scenarioSnapshot(state, dependencies);
  const boss = bossSnapshot(state, dependencies);
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
    flags: freezeArray(state.flags || []),
    chronicleKeys: freezeArray(state.chronicleKeys || []),
    campaign,
    currentNode: state.currentNode ? deepFreeze(serializableCopy(state.currentNode)) : null,
    event,
    deployment,
    scenario,
    boss,
    reward,
    terminal,
    actions: presenterActions(state, event, scenario),
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
  if (type === 'PlaceDeploymentUnit') {
    const unitId = String(command.unitId || command.payload?.unitId || '');
    const square = String(command.square || command.payload?.square || '');
    if (!unitId || !square) throw new Error('PlaceDeploymentUnit requires unitId and square');
    return Object.freeze({ type, payload: Object.freeze({ unitId, square }) });
  }
  if (type === 'RemoveDeploymentUnit') {
    const unitId = String(command.unitId || command.payload?.unitId || '');
    if (!unitId) throw new Error('RemoveDeploymentUnit requires unitId');
    return Object.freeze({ type, payload: Object.freeze({ unitId }) });
  }
  if (type === 'ChooseEvent') {
    const choiceId = String(command.choiceId || command.payload?.choiceId || '');
    if (!choiceId) throw new Error('ChooseEvent requires choiceId');
    return Object.freeze({ type, choiceId });
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
  else if (['PlaceDeploymentUnit', 'RemoveDeploymentUnit', 'ConfirmDeployment'].includes(command.type)) nextState = executeVerticalSliceDeployment(state, command, dependencies);
  else if (command.type === 'ChooseEvent') nextState = chooseVerticalSliceEvent(state, command.choiceId, dependencies);
  else if (command.type === 'PlayerCommand') nextState = executeVerticalSlicePlayerTurn(state, command.request, dependencies);
  else if (command.type === 'BeginBossPhase') nextState = beginVerticalSliceBossPhase(state, dependencies);
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
  activeScenario,
  recentBattleEvents,
  createPresenterSnapshot,
  normalizePresenterCommand,
  dispatchPresenterCommand
};
