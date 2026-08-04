'use strict';

const {
  opposite,
  piece,
  squareToIndex,
  indexToSquare,
  createPosition,
  validatePosition
} = require('../core/chess/position.cjs');
const { isInCheck } = require('../core/chess/rules.cjs');

const PIECE_TYPES = new Set(['p', 'n', 'b', 'r', 'q', 'k']);

function normalizeUnit(unit) {
  if (!unit || typeof unit.id !== 'string' || !unit.id) throw new TypeError('deployment unit requires a stable id');
  if (!PIECE_TYPES.has(unit.type)) throw new TypeError(`invalid deployment piece type: ${unit.type}`);
  if (!Number.isInteger(unit.commandCost) || unit.commandCost < 0) throw new RangeError(`invalid command cost for ${unit.id}`);
  return Object.freeze({
    id: unit.id,
    type: unit.type,
    commandCost: unit.commandCost,
    required: Boolean(unit.required),
    fixedSquare: unit.fixedSquare == null ? null : indexToSquare(squareToIndex(unit.fixedSquare))
  });
}

function createDeploymentPlan(options) {
  if (!options || !Array.isArray(options.roster)) throw new TypeError('deployment roster is required');
  const side = options.side || 'w';
  if (!['w', 'b'].includes(side)) throw new TypeError('deployment side must be w or b');
  const commandLimit = Number.isInteger(options.commandLimit) && options.commandLimit >= 0 ? options.commandLimit : 0;
  const zone = [...new Set((options.zone || []).map((square) => indexToSquare(squareToIndex(square))))];
  if (!zone.length) throw new Error('deployment zone cannot be empty');
  const roster = options.roster.map(normalizeUnit);
  if (new Set(roster.map((unit) => unit.id)).size !== roster.length) throw new Error('deployment roster contains duplicate unit ids');

  const placements = {};
  for (const unit of roster) {
    if (!unit.fixedSquare) continue;
    if (!zone.includes(unit.fixedSquare)) throw new Error(`fixed square ${unit.fixedSquare} is outside deployment zone`);
    if (Object.values(placements).includes(unit.fixedSquare)) throw new Error(`fixed square ${unit.fixedSquare} is occupied twice`);
    placements[unit.id] = unit.fixedSquare;
  }

  const plan = {
    format: 'rpchess-deployment-plan',
    side,
    commandLimit,
    zone: Object.freeze(zone),
    roster: Object.freeze(roster),
    placements: Object.freeze(placements)
  };
  validateBudget(plan);
  return Object.freeze(plan);
}

function unitById(plan, unitId) {
  const unit = plan.roster.find((candidate) => candidate.id === unitId);
  if (!unit) throw new Error(`unknown deployment unit: ${unitId}`);
  return unit;
}

function commandSpent(plan) {
  return Object.keys(plan.placements).reduce((sum, unitId) => sum + unitById(plan, unitId).commandCost, 0);
}

function validateBudget(plan) {
  const spent = commandSpent(plan);
  if (spent > plan.commandLimit) throw new Error(`deployment exceeds command limit: ${spent}/${plan.commandLimit}`);
  return spent;
}

function replacePlacements(plan, placements) {
  const next = Object.freeze({ ...placements });
  const result = Object.freeze({ ...plan, placements: next });
  validateBudget(result);
  return result;
}

function placeUnit(plan, unitId, square) {
  if (!plan || plan.format !== 'rpchess-deployment-plan') throw new TypeError('invalid deployment plan');
  const unit = unitById(plan, unitId);
  const target = indexToSquare(squareToIndex(square));
  if (!plan.zone.includes(target)) throw new Error(`square ${target} is outside deployment zone`);
  if (unit.fixedSquare && unit.fixedSquare !== target) throw new Error(`${unitId} is fixed on ${unit.fixedSquare}`);
  const occupant = Object.entries(plan.placements).find(([otherId, otherSquare]) => otherId !== unitId && otherSquare === target);
  if (occupant) throw new Error(`square ${target} is already occupied by ${occupant[0]}`);
  return replacePlacements(plan, { ...plan.placements, [unitId]: target });
}

function removeUnit(plan, unitId) {
  if (!plan || plan.format !== 'rpchess-deployment-plan') throw new TypeError('invalid deployment plan');
  const unit = unitById(plan, unitId);
  if (unit.fixedSquare) throw new Error(`${unitId} is fixed and cannot be removed`);
  const placements = { ...plan.placements };
  delete placements[unitId];
  return replacePlacements(plan, placements);
}

function deploymentSummary(plan) {
  const placedIds = Object.keys(plan.placements);
  const reserveIds = plan.roster.filter((unit) => !placedIds.includes(unit.id)).map((unit) => unit.id);
  const missingRequired = plan.roster.filter((unit) => unit.required && !placedIds.includes(unit.id)).map((unit) => unit.id);
  return Object.freeze({
    commandSpent: commandSpent(plan),
    commandLimit: plan.commandLimit,
    placedIds: Object.freeze(placedIds),
    reserveIds: Object.freeze(reserveIds),
    missingRequired: Object.freeze(missingRequired)
  });
}

function finalizeDeployment(plan, options = {}) {
  if (!plan || plan.format !== 'rpchess-deployment-plan') throw new TypeError('invalid deployment plan');
  const summary = deploymentSummary(plan);
  if (summary.missingRequired.length) throw new Error(`required units are not deployed: ${summary.missingRequired.join(', ')}`);
  const board = new Array(64).fill(null);
  const identities = {};

  const place = (id, side, type, square) => {
    const index = squareToIndex(square);
    if (board[index]) throw new Error(`deployment square ${indexToSquare(index)} is occupied twice`);
    board[index] = piece(side, type);
    identities[indexToSquare(index)] = id;
  };

  for (const unit of plan.roster) {
    const square = plan.placements[unit.id];
    if (square) place(unit.id, plan.side, unit.type, square);
  }

  for (const enemy of options.enemyPieces || []) {
    if (!enemy || typeof enemy.id !== 'string' || !enemy.id) throw new TypeError('enemy deployment piece requires id');
    if (!PIECE_TYPES.has(enemy.type)) throw new TypeError(`invalid enemy piece type: ${enemy.type}`);
    place(enemy.id, enemy.side || opposite(plan.side), enemy.type, enemy.square);
  }

  const position = createPosition({
    board,
    sideToMove: options.sideToMove || plan.side,
    castling: options.castling || '',
    enPassant: null,
    halfmove: 0,
    fullmove: 1
  });
  validatePosition(position);

  const allowedCheckSides = new Set(options.allowInitialCheckSides || []);
  for (const side of ['w', 'b']) {
    if (isInCheck(position, side) && !allowedCheckSides.has(side)) {
      throw new Error(`${side} king starts in check`);
    }
  }

  const reserve = plan.roster
    .filter((unit) => !plan.placements[unit.id])
    .map((unit) => Object.freeze({ id: unit.id, side: plan.side, type: unit.type, commandCost: unit.commandCost }));

  return Object.freeze({
    position,
    identities: Object.freeze(identities),
    reserve: Object.freeze(reserve),
    commandSpent: summary.commandSpent,
    commandLimit: plan.commandLimit
  });
}

module.exports = {
  createDeploymentPlan,
  placeUnit,
  removeUnit,
  commandSpent,
  deploymentSummary,
  finalizeDeployment
};
