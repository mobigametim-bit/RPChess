'use strict';

const { indexToSquare, squareToIndex } = require('../core/chess/position.cjs');
const {
  createDeploymentPlan,
  placeUnit,
  removeUnit,
  deploymentSummary,
  finalizeDeployment
} = require('../combat/deployment.cjs');
const { createBattleState } = require('../combat/battle.cjs');

const DEPLOYMENT_GATE_FORMAT = 'rpchess-scenario-deployment-gate';
const PIECE_COMMAND_COST = Object.freeze({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 });
const DEPLOYMENT_COMMANDS = Object.freeze(['PlaceDeploymentUnit', 'RemoveDeploymentUnit', 'ConfirmDeployment']);

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function assertScenario(scenario) {
  if (!scenario || scenario.format !== 'rpchess-scenario-state' || scenario.status !== 'active' || scenario.actionIndex !== 0) {
    throw new Error('deployment requires an unstarted active scenario');
  }
  return scenario;
}

function activePieceRecords(scenario) {
  const records = [];
  for (let index = 0; index < 64; index += 1) {
    const boardPiece = scenario.battle.position.board[index];
    if (!boardPiece) continue;
    const square = indexToSquare(index);
    const id = scenario.battle.identities.bySquare[square];
    if (!id) throw new Error(`deployment identity missing on ${square}`);
    records.push(Object.freeze({
      id,
      side: boardPiece.side,
      type: boardPiece.type,
      square,
      metadata: scenario.battle.identities.metadata[id] || Object.freeze({})
    }));
  }
  return freezeArray(records);
}

function requiredPlayerIds(scenario, playerRecords) {
  const required = new Set(playerRecords.filter((record) => record.type === 'k').map((record) => record.id));
  for (const objective of scenario.objectives) {
    if (objective.pieceId) required.add(objective.pieceId);
    for (const id of objective.protectedPieceIds || []) required.add(id);
  }
  for (const failure of scenario.failures) for (const id of failure.targetPieceIds || []) required.add(id);
  return required;
}

function blockerCells(scenario) {
  return new Set(scenario.environment.objects
    .filter((record) => record.type === 'blocker' && record.active)
    .flatMap((record) => record.cells));
}

function deploymentZone(scenario, playerSide, records) {
  const blocked = blockerCells(scenario);
  const enemySquares = new Set(records.filter((record) => record.side !== playerSide).map((record) => record.square));
  const zone = new Set(records.filter((record) => record.side === playerSide).map((record) => record.square));
  const ranks = playerSide === 'w' ? [1, 2] : [7, 8];
  for (const rank of ranks) for (const file of 'abcdefgh') zone.add(`${file}${rank}`);
  return freezeArray([...zone]
    .filter((square) => !blocked.has(square) && !enemySquares.has(square))
    .sort((a, b) => squareToIndex(a) - squareToIndex(b)));
}

function unitLabel(metadata, id, localization) {
  const key = metadata.nameKey || null;
  if (key && localization && Object.prototype.hasOwnProperty.call(localization, key)) return localization[key];
  return metadata.heroId || id;
}

function createScenarioDeploymentGate(scenarioInput, options = {}) {
  const scenario = assertScenario(scenarioInput);
  const playerSide = options.playerSide || scenario.playerSide;
  const records = activePieceRecords(scenario);
  const players = records.filter((record) => record.side === playerSide);
  const required = requiredPlayerIds(scenario, players);
  const zone = deploymentZone(scenario, playerSide, records);
  const units = players.map((record) => Object.freeze({
    id: record.id,
    type: record.type,
    commandCost: PIECE_COMMAND_COST[record.type],
    required: required.has(record.id),
    fixedSquare: record.type === 'k' ? record.square : null,
    originalSquare: record.square,
    metadata: record.metadata,
    label: unitLabel(record.metadata, record.id, options.localization)
  }));
  const commandLimit = units.reduce((total, unit) => total + unit.commandCost, 0);
  let plan = createDeploymentPlan({ side: playerSide, commandLimit, zone, roster: units });
  for (const unit of units) if (!unit.fixedSquare) plan = placeUnit(plan, unit.id, unit.originalSquare);
  const gate = {
    format: DEPLOYMENT_GATE_FORMAT,
    schemaVersion: 1,
    gateId: String(options.gateId || `${scenario.scenarioId}_deployment`),
    seed: Number(options.seed || 1),
    playerSide,
    scenario,
    units: freezeArray(units),
    plan,
    revision: 0,
    history: freezeArray([])
  };
  return Object.freeze(gate);
}

function assertGate(gate) {
  if (!gate || gate.format !== DEPLOYMENT_GATE_FORMAT || gate.schemaVersion !== 1) throw new Error('invalid scenario deployment gate');
  return gate;
}

function appendGate(gate, plan, command) {
  return Object.freeze({
    ...gate,
    plan,
    revision: gate.revision + 1,
    history: freezeArray([...gate.history, Object.freeze({
      revision: gate.revision + 1,
      type: command.type,
      payload: Object.freeze({ ...(command.payload || {}) })
    })])
  });
}

function executeDeploymentEdit(gateInput, command) {
  const gate = assertGate(gateInput);
  if (!command || !DEPLOYMENT_COMMANDS.includes(command.type) || command.type === 'ConfirmDeployment') throw new Error('invalid deployment edit command');
  if (command.type === 'PlaceDeploymentUnit') {
    return appendGate(gate, placeUnit(gate.plan, command.payload?.unitId, command.payload?.square), command);
  }
  return appendGate(gate, removeUnit(gate.plan, command.payload?.unitId), command);
}

function mergedReserve(gate, finalized) {
  const original = gate.scenario.battle.reserve || [];
  const originalIds = new Set(original.map((entry) => entry.id));
  const added = finalized.reserve
    .filter((entry) => !originalIds.has(entry.id))
    .map((entry) => {
      const unit = gate.units.find((candidate) => candidate.id === entry.id);
      return Object.freeze({
        id: entry.id,
        side: entry.side,
        type: entry.type,
        orderCost: Math.max(1, entry.commandCost),
        metadata: Object.freeze({ ...(unit?.metadata || {}) })
      });
    });
  return freezeArray([...original, ...added]);
}

function finalizeScenarioDeployment(gateInput) {
  const gate = assertGate(gateInput);
  const summary = deploymentSummary(gate.plan);
  if (summary.missingRequired.length) throw new Error(`deployment is missing required units: ${summary.missingRequired.join(', ')}`);
  const records = activePieceRecords(gate.scenario);
  const enemyPieces = records
    .filter((record) => record.side !== gate.playerSide)
    .map((record) => Object.freeze({ id: record.id, side: record.side, type: record.type, square: record.square }));
  const finalized = finalizeDeployment(gate.plan, {
    enemyPieces,
    sideToMove: gate.playerSide,
    castling: gate.scenario.battle.position.castling || ''
  });
  const originalBattle = gate.scenario.battle;
  const playerReserveCells = [...new Set([...(originalBattle.reserveCells?.[gate.playerSide] || []), ...gate.plan.zone])];
  const reserveCells = {
    w: freezeArray(gate.playerSide === 'w' ? playerReserveCells : (originalBattle.reserveCells?.w || [])),
    b: freezeArray(gate.playerSide === 'b' ? playerReserveCells : (originalBattle.reserveCells?.b || []))
  };
  const createdBattle = createBattleState({
    battleId: `${originalBattle.battleId}_deployed_${gate.revision}`,
    seed: gate.seed,
    playerSide: originalBattle.playerSide,
    position: finalized.position,
    identitiesBySquare: finalized.identities,
    identityMetadata: originalBattle.identities.metadata,
    statuses: originalBattle.statuses,
    orderPoints: originalBattle.orderPoints,
    reserve: mergedReserve(gate, finalized),
    reserveCells
  });
  const battle = Object.freeze({
    ...createdBattle,
    scenarioRules: originalBattle.scenarioRules || createdBattle.scenarioRules
  });
  return Object.freeze({
    scenario: Object.freeze({ ...gate.scenario, battle }),
    summary,
    battle
  });
}

function deploymentGateSnapshot(gateInput) {
  const gate = assertGate(gateInput);
  const summary = deploymentSummary(gate.plan);
  return Object.freeze({
    format: 'rpchess-deployment-presenter',
    schemaVersion: 1,
    gateId: gate.gateId,
    revision: gate.revision,
    playerSide: gate.playerSide,
    zone: gate.plan.zone,
    commandSpent: summary.commandSpent,
    commandLimit: summary.commandLimit,
    canConfirm: summary.missingRequired.length === 0,
    missingRequired: summary.missingRequired,
    units: freezeArray(gate.units.map((unit) => Object.freeze({
      id: unit.id,
      type: unit.type,
      label: unit.label,
      commandCost: unit.commandCost,
      required: unit.required,
      fixed: Boolean(unit.fixedSquare),
      originalSquare: unit.originalSquare,
      square: gate.plan.placements[unit.id] || null,
      inReserve: !gate.plan.placements[unit.id],
      metadata: unit.metadata
    })))
  });
}

module.exports = {
  DEPLOYMENT_GATE_FORMAT,
  PIECE_COMMAND_COST,
  DEPLOYMENT_COMMANDS,
  activePieceRecords,
  requiredPlayerIds,
  deploymentZone,
  createScenarioDeploymentGate,
  executeDeploymentEdit,
  finalizeScenarioDeployment,
  deploymentGateSnapshot
};
