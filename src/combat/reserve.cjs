'use strict';

const {
  opposite,
  piece,
  squareToIndex,
  indexToSquare,
  createPosition
} = require('../core/chess/position.cjs');
const { isInCheck } = require('../core/chess/rules.cjs');
const { spendOrderPoints } = require('./order-points.cjs');

function normalizeReserve(entries = []) {
  if (!Array.isArray(entries)) throw new TypeError('reserve must be an array');
  const ids = new Set();
  const normalized = entries.map((entry) => {
    if (!entry || typeof entry.id !== 'string' || !entry.id) throw new TypeError('reserve entry requires id');
    if (ids.has(entry.id)) throw new Error(`duplicate reserve id: ${entry.id}`);
    ids.add(entry.id);
    if (!['w', 'b'].includes(entry.side)) throw new TypeError(`invalid reserve side for ${entry.id}`);
    if (!['p', 'n', 'b', 'r', 'q'].includes(entry.type)) throw new TypeError(`invalid reserve type for ${entry.id}`);
    const orderCost = Number.isInteger(entry.orderCost) && entry.orderCost >= 0 ? entry.orderCost : 1;
    return Object.freeze({
      id: entry.id,
      side: entry.side,
      type: entry.type,
      orderCost,
      metadata: Object.freeze({ ...(entry.metadata || {}) })
    });
  });
  return Object.freeze(normalized);
}

function normalizeReserveCells(cells = {}) {
  const result = { w: [], b: [] };
  for (const side of ['w', 'b']) {
    result[side] = Object.freeze([...new Set((cells[side] || []).map((square) => indexToSquare(squareToIndex(square))))]);
  }
  return Object.freeze(result);
}

function findReserveEntry(reserve, id) {
  const entry = reserve.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`reserve entry not found: ${id}`);
  return entry;
}

function deployReserve(options) {
  const { position, reserve, reserveCells, orderPoints, entryId, square } = options;
  const entry = findReserveEntry(reserve, entryId);
  if (entry.side !== position.sideToMove) throw new Error(`${entryId} cannot deploy on ${position.sideToMove} action`);
  const target = indexToSquare(squareToIndex(square));
  if (!(reserveCells[entry.side] || []).includes(target)) throw new Error(`${target} is not a legal reserve cell`);
  const targetIndex = squareToIndex(target);
  if (position.board[targetIndex]) throw new Error(`${target} is occupied`);

  const spent = spendOrderPoints(orderPoints[entry.side], entry.orderCost, 'reserve_deployment');
  const board = position.board.slice();
  board[targetIndex] = piece(entry.side, entry.type);
  const nextPosition = createPosition({
    board,
    sideToMove: opposite(entry.side),
    castling: position.castling,
    enPassant: null,
    halfmove: position.halfmove + 1,
    fullmove: position.fullmove + (entry.side === 'b' ? 1 : 0)
  });
  if (isInCheck(nextPosition, entry.side)) throw new Error('reserve deployment leaves own king in check');

  return Object.freeze({
    position: nextPosition,
    reserve: Object.freeze(reserve.filter((candidate) => candidate.id !== entryId)),
    reserveCells,
    orderPoints: Object.freeze({ ...orderPoints, [entry.side]: spent.pool }),
    entry,
    square: target,
    orderChange: spent.changedBy
  });
}

function legalReserveDeployments(options) {
  const { position, reserve, reserveCells, orderPoints } = options;
  const side = position.sideToMove;
  const commands = [];
  for (const entry of reserve.filter((candidate) => candidate.side === side)) {
    if (orderPoints[side].current < entry.orderCost) continue;
    for (const square of reserveCells[side] || []) {
      try {
        deployReserve({ position, reserve, reserveCells, orderPoints, entryId: entry.id, square });
        commands.push(Object.freeze({ type: 'DeployReserve', payload: Object.freeze({ entryId: entry.id, square }) }));
      } catch (error) {
        // Illegal square for the current position; omit it from command discovery.
      }
    }
  }
  return commands;
}

module.exports = { normalizeReserve, normalizeReserveCells, deployReserve, legalReserveDeployments };
