'use strict';

const {
  coordinates,
  indexOf,
  indexToSquare,
  squareToIndex,
  createPosition,
  opposite
} = require('../core/chess/position.cjs');
const { gameStatus, isInCheck } = require('../core/chess/rules.cjs');
const { identityAt } = require('./identity.cjs');
const { statusFor, hasStatus, applyPrimaryStatus } = require('./statuses.cjs');
const { spendOrderPoints } = require('./order-points.cjs');

const ABILITY_STATE_FORMAT = 'rpchess-ability-state';
const ABILITY_STATE_SCHEMA_VERSION = 1;
const SUPPORTED_KINDS = Object.freeze(['place_adjacent_ward']);
const FIRST_ABILITY_DISCOUNT = 'effect.first_ability_order_discount';

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function freezeRecord(record) {
  return Object.freeze({ ...record });
}

function normalizeEntry(raw, index) {
  if (!raw || typeof raw !== 'object') throw new TypeError(`ability entry ${index} must be an object`);
  const instanceId = String(raw.instanceId || '');
  const abilityId = String(raw.abilityId || '');
  const effectId = String(raw.effectId || '');
  const ownerId = String(raw.ownerId || '');
  const side = String(raw.side || '');
  const kind = String(raw.kind || '');
  if (!instanceId || !abilityId || !effectId || !ownerId) throw new Error(`ability entry ${index} requires stable ids`);
  if (!['w', 'b'].includes(side)) throw new Error(`${instanceId} requires side w or b`);
  if (!SUPPORTED_KINDS.includes(kind)) throw new Error(`${instanceId} has unsupported kind: ${kind}`);
  const orderCost = Number(raw.orderCost);
  const maxUses = Number(raw.maxUses ?? 1);
  const used = Number(raw.used ?? 0);
  if (!Number.isInteger(orderCost) || orderCost < 0) throw new Error(`${instanceId} requires a non-negative orderCost`);
  if (!Number.isInteger(maxUses) || maxUses < 1) throw new Error(`${instanceId} requires a positive maxUses`);
  if (!Number.isInteger(used) || used < 0 || used > maxUses) throw new Error(`${instanceId} has invalid used count`);
  return freezeRecord({
    instanceId,
    abilityId,
    effectId,
    sourceId: String(raw.sourceId || effectId),
    ownerId,
    side,
    kind,
    orderCost,
    maxUses,
    used
  });
}

function normalizeModifier(raw, index) {
  if (!raw || typeof raw !== 'object') throw new TypeError(`ability modifier ${index} must be an object`);
  const instanceId = String(raw.instanceId || '');
  const effectId = String(raw.effectId || '');
  const ownerId = String(raw.ownerId || '');
  if (!instanceId || !effectId || !ownerId) throw new Error(`ability modifier ${index} requires stable ids`);
  if (effectId !== FIRST_ABILITY_DISCOUNT) throw new Error(`${instanceId} has unsupported modifier effect: ${effectId}`);
  const amount = Number(raw.amount ?? 1);
  if (!Number.isInteger(amount) || amount < 1) throw new Error(`${instanceId} requires a positive discount amount`);
  return freezeRecord({ instanceId, effectId, ownerId, amount, consumed: Boolean(raw.consumed) });
}

function createAbilityState(input = {}) {
  if (input && input.format === ABILITY_STATE_FORMAT) {
    if (input.schemaVersion !== ABILITY_STATE_SCHEMA_VERSION) throw new Error('unsupported ability state schema');
  }
  const entriesInput = Array.isArray(input) ? input : (input.entries || []);
  const modifiersInput = Array.isArray(input) ? [] : (input.modifiers || []);
  const entries = entriesInput.map(normalizeEntry);
  const modifiers = modifiersInput.map(normalizeModifier);
  const ids = entries.map((entry) => entry.instanceId);
  const modifierIds = modifiers.map((modifier) => modifier.instanceId);
  if (new Set(ids).size !== ids.length) throw new Error('ability instance IDs must be unique');
  if (new Set(modifierIds).size !== modifierIds.length) throw new Error('ability modifier IDs must be unique');
  return Object.freeze({
    format: ABILITY_STATE_FORMAT,
    schemaVersion: ABILITY_STATE_SCHEMA_VERSION,
    entries: freezeArray(entries),
    modifiers: freezeArray(modifiers)
  });
}

function activeSquare(identities, pieceId) {
  const found = Object.entries(identities.bySquare).find(([, id]) => id === pieceId);
  return found ? found[0] : null;
}

function modifierForOwner(abilities, ownerId) {
  return abilities.modifiers.find((modifier) => modifier.ownerId === ownerId
    && modifier.effectId === FIRST_ABILITY_DISCOUNT
    && !modifier.consumed) || null;
}

function effectiveOrderCost(abilities, entry) {
  const modifier = modifierForOwner(abilities, entry.ownerId);
  return Math.max(0, entry.orderCost - (modifier?.amount || 0));
}

function adjacentSquares(square) {
  const index = squareToIndex(square);
  const { x, y } = coordinates(index);
  const result = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx > 7 || ny < 0 || ny > 7) continue;
    result.push(indexToSquare(indexOf(nx, ny)));
  }
  return result;
}

function wardTargets(state, entry) {
  const ownerSquare = activeSquare(state.identities, entry.ownerId);
  if (!ownerSquare) return [];
  if (hasStatus(state.statuses, entry.ownerId, 'silenced')) return [];
  const targets = [];
  for (const square of adjacentSquares(ownerSquare)) {
    const boardPiece = state.position.board[squareToIndex(square)];
    if (!boardPiece || boardPiece.side !== entry.side || boardPiece.type === 'k') continue;
    const targetId = identityAt(state.identities, square);
    if (!targetId || targetId === entry.ownerId || statusFor(state.statuses, targetId)) continue;
    targets.push(Object.freeze({ targetId, targetSquare: square }));
  }
  return targets;
}

function legalAbilityCommands(state) {
  const abilities = state.abilities && state.abilities.format === ABILITY_STATE_FORMAT
    ? state.abilities
    : createAbilityState();
  if (state.status !== 'active' || isInCheck(state.position, state.position.sideToMove)) return [];
  const side = state.position.sideToMove;
  const pool = state.orderPoints?.[side];
  if (!pool) return [];
  const commands = [];
  for (const entry of abilities.entries) {
    if (entry.side !== side || entry.used >= entry.maxUses || !activeSquare(state.identities, entry.ownerId)) continue;
    const cost = effectiveOrderCost(abilities, entry);
    if (pool.current < cost) continue;
    const targets = entry.kind === 'place_adjacent_ward' ? wardTargets(state, entry) : [];
    for (const target of targets) {
      commands.push(Object.freeze({
        type: 'UseAbility',
        payload: Object.freeze({
          instanceId: entry.instanceId,
          abilityId: entry.abilityId,
          effectId: entry.effectId,
          sourceId: entry.sourceId,
          ownerId: entry.ownerId,
          targetId: target.targetId,
          targetSquare: target.targetSquare,
          baseOrderCost: entry.orderCost,
          effectiveOrderCost: cost
        })
      }));
    }
  }
  return freezeArray(commands);
}

function normalizeAbilityRequest(state, request) {
  if (!request || request.type !== 'UseAbility') throw new Error('UseAbility request is required');
  const payload = request.payload || {};
  const command = legalAbilityCommands(state).find((candidate) => candidate.payload.instanceId === payload.instanceId
    && candidate.payload.abilityId === payload.abilityId
    && candidate.payload.ownerId === payload.ownerId
    && candidate.payload.targetId === payload.targetId
    && candidate.payload.targetSquare === payload.targetSquare);
  if (!command) throw new Error('ability command is not currently legal');
  return command;
}

function passActionPosition(position) {
  const actingSide = position.sideToMove;
  return createPosition({
    board: position.board,
    sideToMove: opposite(actingSide),
    castling: position.castling,
    enPassant: null,
    halfmove: position.halfmove + 1,
    fullmove: position.fullmove + (actingSide === 'b' ? 1 : 0)
  });
}

function outcomeForStatus(state, position, identities, factory, events) {
  const status = gameStatus(position);
  if (status.state === 'check') {
    const kingIndex = position.board.findIndex((value) => value && value.side === position.sideToMove && value.type === 'k');
    const kingSquare = indexToSquare(kingIndex);
    events.push(factory.event('KingChecked', {
      battleId: state.battleId,
      checkedSide: position.sideToMove,
      kingSquare,
      kingId: identityAt(identities, kingSquare)
    }));
    return { status: 'active', result: null };
  }
  if (status.state === 'checkmate') {
    const result = {
      outcome: status.winner === state.playerSide ? 'victory' : 'defeat',
      winner: status.winner,
      reason: 'checkmate'
    };
    events.push(factory.event('CheckmateDeclared', {
      battleId: state.battleId,
      winner: status.winner,
      loser: position.sideToMove
    }));
    events.push(factory.event('BattleCompleted', { battleId: state.battleId, ...result }));
    return { status: 'completed', result };
  }
  if (status.state === 'stalemate') {
    const result = { outcome: 'draw', winner: null, reason: 'stalemate' };
    events.push(factory.event('StalemateDeclared', { battleId: state.battleId }));
    events.push(factory.event('BattleCompleted', { battleId: state.battleId, ...result }));
    return { status: 'completed', result };
  }
  return { status: 'active', result: null };
}

function updateAbilityState(abilities, entry, modifier) {
  return createAbilityState({
    entries: abilities.entries.map((candidate) => candidate.instanceId === entry.instanceId
      ? { ...candidate, used: candidate.used + 1 }
      : candidate),
    modifiers: abilities.modifiers.map((candidate) => modifier && candidate.instanceId === modifier.instanceId
      ? { ...candidate, consumed: true }
      : candidate)
  });
}

function resolveAbilityCommand(state, command, factory) {
  const abilities = state.abilities && state.abilities.format === ABILITY_STATE_FORMAT
    ? state.abilities
    : createAbilityState();
  const entry = abilities.entries.find((candidate) => candidate.instanceId === command.payload.instanceId);
  if (!entry) throw new Error(`missing ability instance: ${command.payload.instanceId}`);
  const modifier = modifierForOwner(abilities, entry.ownerId);
  const cost = effectiveOrderCost(abilities, entry);
  const spending = spendOrderPoints(state.orderPoints[entry.side], cost, `ability:${entry.abilityId}`);
  const orderPoints = Object.freeze({ ...state.orderPoints, [entry.side]: spending.pool });
  const applied = applyPrimaryStatus(state.statuses, command.payload.targetId, 'ward', {
    sourceId: entry.sourceId,
    actionIndex: state.actionIndex,
    data: { abilityId: entry.abilityId, effectId: entry.effectId, ownerId: entry.ownerId }
  });
  const events = [
    factory.event('AbilityUsed', {
      battleId: state.battleId,
      abilityId: entry.abilityId,
      effectId: entry.effectId,
      sourceId: entry.sourceId,
      ownerId: entry.ownerId,
      targetId: command.payload.targetId,
      targetSquare: command.payload.targetSquare,
      baseOrderCost: entry.orderCost,
      effectiveOrderCost: cost,
      useNumber: entry.used + 1,
      maxUses: entry.maxUses
    }),
    factory.event('StatusApplied', {
      battleId: state.battleId,
      pieceId: command.payload.targetId,
      statusId: 'ward',
      sourceId: entry.sourceId,
      expiry: applied.applied.expiry
    }),
    factory.event('OrderPointsChanged', {
      battleId: state.battleId,
      side: entry.side,
      changedBy: spending.changedBy,
      current: spending.pool.current,
      reason: `ability:${entry.abilityId}`
    })
  ];
  if (modifier) {
    events.push(factory.event('RelicEffectConsumed', {
      battleId: state.battleId,
      effectId: modifier.effectId,
      ownerId: modifier.ownerId,
      amount: modifier.amount,
      reason: 'first_ability_order_discount'
    }));
  }
  const position = passActionPosition(state.position);
  const outcome = outcomeForStatus(state, position, state.identities, factory, events);
  return {
    position,
    identities: state.identities,
    statuses: applied.state,
    abilities: updateAbilityState(abilities, entry, modifier),
    events,
    status: outcome.status,
    result: outcome.result,
    orderPoints,
    reserve: state.reserve,
    actedPieceId: entry.ownerId,
    capturedId: null
  };
}

module.exports = {
  ABILITY_STATE_FORMAT,
  ABILITY_STATE_SCHEMA_VERSION,
  FIRST_ABILITY_DISCOUNT,
  createAbilityState,
  activeSquare,
  effectiveOrderCost,
  legalAbilityCommands,
  normalizeAbilityRequest,
  resolveAbilityCommand
};
