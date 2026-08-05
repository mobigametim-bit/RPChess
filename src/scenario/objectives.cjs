'use strict';

const { parseSquare, fileIndex } = require('../rendering/modular-board.cjs');
const { identityAt } = require('../combat/identity.cjs');

const OBJECTIVE_TYPES = Object.freeze(['checkmate', 'capture_targets', 'escort', 'occupy_cells', 'survive_actions']);
const FAILURE_TYPES = Object.freeze(['piece_lost', 'action_limit', 'battle_outcome']);

function uniqueStrings(values, label, min = 1) {
  if (!Array.isArray(values) || values.length < min) throw new Error(`${label} requires at least ${min} entries`);
  const normalized = values.map((value) => String(value));
  if (normalized.some((value) => !value)) throw new Error(`${label} contains an empty value`);
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} contains duplicates`);
  return Object.freeze(normalized);
}

function normalizeCells(values, board, label) {
  const cells = uniqueStrings(values, label).map((cell) => {
    parseSquare(cell, board.width, board.height);
    return cell.toLowerCase();
  });
  return Object.freeze(cells);
}

function normalizeSide(value, label) {
  if (!['w', 'b'].includes(value)) throw new Error(`${label} must be w or b`);
  return value;
}

function normalizeObjective(record, board, defaultSide) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('objective must be an object');
  if (!/^objective\.[a-z0-9][a-z0-9_-]*$/.test(String(record.id || ''))) throw new Error('objective requires stable objective.* id');
  if (!OBJECTIVE_TYPES.includes(record.type)) throw new Error(`${record.id}.type is invalid`);
  const side = normalizeSide(record.side || defaultSide, `${record.id}.side`);
  const common = { id: record.id, type: record.type, side, mandatory: record.mandatory !== false, previewKey: record.previewKey || null };

  if (record.type === 'checkmate') return Object.freeze(common);
  if (record.type === 'capture_targets') return Object.freeze({ ...common, targetPieceIds: uniqueStrings(record.targetPieceIds, `${record.id}.targetPieceIds`) });
  if (record.type === 'escort') {
    const pieceId = String(record.pieceId || '');
    if (!pieceId) throw new Error(`${record.id}.pieceId is required`);
    return Object.freeze({
      ...common,
      pieceId,
      targetCells: normalizeCells(record.targetCells, board, `${record.id}.targetCells`)
    });
  }
  if (record.type === 'occupy_cells') return Object.freeze({
    ...common,
    targetCells: normalizeCells(record.targetCells, board, `${record.id}.targetCells`),
    holdActions: Number.isInteger(record.holdActions) && record.holdActions > 0 ? record.holdActions : 1
  });
  if (record.type === 'survive_actions') {
    if (!Number.isInteger(record.requiredActions) || record.requiredActions < 1) throw new Error(`${record.id}.requiredActions must be positive`);
    return Object.freeze({
      ...common,
      requiredActions: record.requiredActions,
      protectedPieceIds: record.protectedPieceIds ? uniqueStrings(record.protectedPieceIds, `${record.id}.protectedPieceIds`) : Object.freeze([])
    });
  }
  throw new Error(`unsupported objective type: ${record.type}`);
}

function normalizeFailure(record, board, defaultSide) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('failure condition must be an object');
  if (!/^failure\.[a-z0-9][a-z0-9_-]*$/.test(String(record.id || ''))) throw new Error('failure condition requires stable failure.* id');
  if (!FAILURE_TYPES.includes(record.type)) throw new Error(`${record.id}.type is invalid`);
  const side = normalizeSide(record.side || defaultSide, `${record.id}.side`);
  const common = { id: record.id, type: record.type, side, previewKey: record.previewKey || null };
  if (record.type === 'piece_lost') return Object.freeze({ ...common, targetPieceIds: uniqueStrings(record.targetPieceIds, `${record.id}.targetPieceIds`) });
  if (record.type === 'action_limit') {
    if (!Number.isInteger(record.maxActions) || record.maxActions < 1) throw new Error(`${record.id}.maxActions must be positive`);
    return Object.freeze({ ...common, maxActions: record.maxActions });
  }
  if (record.type === 'battle_outcome') {
    const outcomes = uniqueStrings(record.outcomes || ['defeat'], `${record.id}.outcomes`);
    for (const outcome of outcomes) if (!['victory', 'defeat', 'draw'].includes(outcome)) throw new Error(`${record.id}.outcomes contains invalid value`);
    return Object.freeze({ ...common, outcomes });
  }
  throw new Error(`unsupported failure type: ${record.type}`);
}

function activePieceIds(battle) {
  return new Set(Object.values(battle.identities.bySquare));
}

function pieceSquare(battle, pieceId) {
  for (const [square, id] of Object.entries(battle.identities.bySquare)) if (id === pieceId) return square;
  return null;
}

function sideOccupies(battle, side, cell) {
  const pieceId = identityAt(battle.identities, cell);
  return Boolean(pieceId && battle.identities.metadata[pieceId]?.side === side);
}

function squareCoordinates(square) {
  const match = /^([a-z]+)([1-9][0-9]*)$/i.exec(String(square));
  if (!match) throw new Error(`invalid square: ${square}`);
  return Object.freeze({ x: fileIndex(match[1]), rank: Number(match[2]) });
}

function initialObjectiveState(definition) {
  const state = { id: definition.id, type: definition.type, status: 'active', current: 0, target: 1, details: {} };
  if (definition.type === 'capture_targets') {
    state.target = definition.targetPieceIds.length;
    state.details = { capturedPieceIds: Object.freeze([]) };
  } else if (definition.type === 'occupy_cells') {
    state.target = definition.holdActions;
    state.details = { occupiedCells: Object.freeze([]), consecutiveActions: 0 };
  } else if (definition.type === 'survive_actions') {
    state.target = definition.requiredActions;
  }
  return Object.freeze(state);
}

function updateObjective(definition, previous, battle, events) {
  if (previous.status === 'completed') return previous;
  let current = previous.current;
  let completed = false;
  let details = previous.details;

  if (definition.type === 'checkmate') {
    completed = battle.status === 'completed' && battle.result?.reason === 'checkmate' && battle.result?.winner === definition.side;
    current = completed ? 1 : 0;
  } else if (definition.type === 'capture_targets') {
    const captured = new Set(previous.details.capturedPieceIds || []);
    for (const event of events) {
      if (event.type === 'PieceCaptured' && definition.targetPieceIds.includes(event.payload.capturedId)) captured.add(event.payload.capturedId);
    }
    const active = activePieceIds(battle);
    for (const pieceId of definition.targetPieceIds) if (!active.has(pieceId)) captured.add(pieceId);
    current = captured.size;
    completed = definition.targetPieceIds.every((pieceId) => captured.has(pieceId));
    details = { capturedPieceIds: Object.freeze([...captured].sort()) };
  } else if (definition.type === 'escort') {
    const square = pieceSquare(battle, definition.pieceId);
    completed = Boolean(square && definition.targetCells.includes(square));
    current = completed ? 1 : 0;
    details = { square };
  } else if (definition.type === 'occupy_cells') {
    const occupiedCells = definition.targetCells.filter((cell) => sideOccupies(battle, definition.side, cell));
    const allOccupied = occupiedCells.length === definition.targetCells.length;
    current = allOccupied ? (previous.details.consecutiveActions || 0) + 1 : 0;
    completed = current >= definition.holdActions;
    details = { occupiedCells: Object.freeze(occupiedCells), consecutiveActions: current };
  } else if (definition.type === 'survive_actions') {
    const active = activePieceIds(battle);
    const protectedAlive = definition.protectedPieceIds.every((pieceId) => active.has(pieceId));
    current = Math.min(battle.actionIndex, definition.requiredActions);
    completed = protectedAlive && battle.actionIndex >= definition.requiredActions;
    details = { protectedAlive };
  }

  return Object.freeze({
    id: definition.id,
    type: definition.type,
    status: completed ? 'completed' : 'active',
    current,
    target: previous.target,
    details: Object.freeze(details)
  });
}

function initialFailureState(definition) {
  return Object.freeze({ id: definition.id, type: definition.type, triggered: false, details: Object.freeze({}) });
}

function updateFailure(definition, previous, battle) {
  if (previous.triggered) return previous;
  let triggered = false;
  let details = {};
  if (definition.type === 'piece_lost') {
    const active = activePieceIds(battle);
    const lostPieceIds = definition.targetPieceIds.filter((pieceId) => !active.has(pieceId));
    triggered = lostPieceIds.length > 0;
    details = { lostPieceIds: Object.freeze(lostPieceIds) };
  } else if (definition.type === 'action_limit') {
    triggered = battle.actionIndex > definition.maxActions;
    details = { actionIndex: battle.actionIndex, maxActions: definition.maxActions };
  } else if (definition.type === 'battle_outcome') {
    triggered = battle.status === 'completed' && definition.outcomes.includes(battle.result?.outcome);
    details = { outcome: battle.result?.outcome || null, reason: battle.result?.reason || null };
  }
  return Object.freeze({ id: definition.id, type: definition.type, triggered, details: Object.freeze(details) });
}

function objectiveHeuristic(definition, battle, state, perspective) {
  const sign = definition.side === perspective ? 1 : -1;
  if (state.status === 'completed') return sign * 12000;
  if (definition.type === 'capture_targets') return sign * state.current * 900;
  if (definition.type === 'escort') {
    const square = pieceSquare(battle, definition.pieceId);
    if (!square) return sign * -5000;
    const from = squareCoordinates(square);
    let distance = Infinity;
    for (const cell of definition.targetCells) {
      const to = squareCoordinates(cell);
      distance = Math.min(distance, Math.max(Math.abs(from.x - to.x), Math.abs(from.rank - to.rank)));
    }
    return sign * (1200 - distance * 90);
  }
  if (definition.type === 'occupy_cells') return sign * ((state.details.occupiedCells?.length || 0) * 280 + state.current * 450);
  if (definition.type === 'survive_actions') return sign * (state.current / state.target) * 1000;
  return 0;
}

module.exports = {
  OBJECTIVE_TYPES,
  FAILURE_TYPES,
  normalizeObjective,
  normalizeFailure,
  activePieceIds,
  pieceSquare,
  sideOccupies,
  squareCoordinates,
  initialObjectiveState,
  updateObjective,
  initialFailureState,
  updateFailure,
  objectiveHeuristic
};
