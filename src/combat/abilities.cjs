'use strict';

const {
  opposite,
  coordinates,
  indexOf,
  indexToSquare,
  squareToIndex,
  createPosition
} = require('../core/chess/position.cjs');
const {
  generateLegalMoves,
  makeMove,
  gameStatus,
  isInCheck,
  isSquareAttacked,
  normalizeRulesContext
} = require('../core/chess/rules.cjs');
const { identityAt } = require('./identity.cjs');
const { statusFor, hasStatus, applyPrimaryStatus } = require('./statuses.cjs');
const { spendOrderPoints } = require('./order-points.cjs');

const ABILITY_STATE_FORMAT = 'rpchess-ability-state';
const ABILITY_STATE_SCHEMA_VERSION = 2;
const FIRST_ABILITY_DISCOUNT = 'effect.first_ability_order_discount';
const SUPPORTED_KINDS = Object.freeze([
  'place_adjacent_ward',
  'interpose',
  'chain_formation',
  'forge_line',
  'previewed_charge',
  'hostage_tactic',
  'gate_command',
  'early_promotion',
  'declare_sacrifice'
]);
const PASSIVE_KINDS = Object.freeze(['evasion_after_non_capture']);
const QUEEN_DIRECTIONS = Object.freeze([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);

function freezeArray(values) { return Object.freeze(values.slice()); }
function freezeRecord(record) { return Object.freeze({ ...record }); }
function rulesForState(state) { return normalizeRulesContext(state.scenarioRules || {}); }

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
  const orderCost = Number(raw.orderCost ?? 0);
  const maxUses = Number(raw.maxUses ?? 1);
  const used = Number(raw.used ?? 0);
  const cooldownActions = Number(raw.cooldownActions ?? 0);
  const lastUsedAction = raw.lastUsedAction == null ? null : Number(raw.lastUsedAction);
  if (!Number.isInteger(orderCost) || orderCost < 0) throw new Error(`${instanceId} requires a non-negative orderCost`);
  if (!Number.isInteger(maxUses) || maxUses < 1) throw new Error(`${instanceId} requires a positive maxUses`);
  if (!Number.isInteger(used) || used < 0 || used > maxUses) throw new Error(`${instanceId} has invalid used count`);
  if (!Number.isInteger(cooldownActions) || cooldownActions < 0) throw new Error(`${instanceId} has invalid cooldownActions`);
  if (lastUsedAction != null && (!Number.isInteger(lastUsedAction) || lastUsedAction < 0)) throw new Error(`${instanceId} has invalid lastUsedAction`);
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
    used,
    cooldownActions,
    lastUsedAction,
    data: freezeRecord(raw.data || {})
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

function normalizePassive(raw, index) {
  if (!raw || typeof raw !== 'object') throw new TypeError(`ability passive ${index} must be an object`);
  const instanceId = String(raw.instanceId || '');
  const effectId = String(raw.effectId || '');
  const ownerId = String(raw.ownerId || '');
  const side = String(raw.side || '');
  const kind = String(raw.kind || '');
  if (!instanceId || !effectId || !ownerId) throw new Error(`ability passive ${index} requires stable ids`);
  if (!['w', 'b'].includes(side)) throw new Error(`${instanceId} requires side w or b`);
  if (!PASSIVE_KINDS.includes(kind)) throw new Error(`${instanceId} has unsupported passive kind: ${kind}`);
  return freezeRecord({
    instanceId,
    effectId,
    sourceId: String(raw.sourceId || effectId),
    ownerId,
    side,
    kind,
    consumed: Boolean(raw.consumed),
    data: freezeRecord(raw.data || {})
  });
}

function createAbilityState(input = {}) {
  if (input && input.format === ABILITY_STATE_FORMAT && ![1, 2].includes(input.schemaVersion)) {
    throw new Error('unsupported ability state schema');
  }
  const entriesInput = Array.isArray(input) ? input : (input.entries || []);
  const modifiersInput = Array.isArray(input) ? [] : (input.modifiers || []);
  const passivesInput = Array.isArray(input) ? [] : (input.passives || []);
  const entries = entriesInput.map(normalizeEntry);
  const modifiers = modifiersInput.map(normalizeModifier);
  const passives = passivesInput.map(normalizePassive);
  const ids = [...entries, ...modifiers, ...passives].map((record) => record.instanceId);
  if (new Set(ids).size !== ids.length) throw new Error('ability instance IDs must be unique');
  return Object.freeze({
    format: ABILITY_STATE_FORMAT,
    schemaVersion: ABILITY_STATE_SCHEMA_VERSION,
    entries: freezeArray(entries),
    modifiers: freezeArray(modifiers),
    passives: freezeArray(passives)
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

function cooldownReady(state, entry) {
  return entry.lastUsedAction == null || state.actionIndex - entry.lastUsedAction >= entry.cooldownActions;
}

function ownerReady(state, entry) {
  const square = activeSquare(state.identities, entry.ownerId);
  if (!square || entry.side !== state.position.sideToMove || entry.used >= entry.maxUses || !cooldownReady(state, entry)) return null;
  if (hasStatus(state.statuses, entry.ownerId, 'silenced') || hasStatus(state.statuses, entry.ownerId, 'bound')) return null;
  return square;
}

function alliedStatusTargets(state, entry) {
  const ownerSquare = activeSquare(state.identities, entry.ownerId);
  if (!ownerSquare) return [];
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

function chainFormationTargets(state, entry) {
  const ownerSquare = activeSquare(state.identities, entry.ownerId);
  if (!ownerSquare) return [];
  const ownerIndex = squareToIndex(ownerSquare);
  const ownerPiece = state.position.board[ownerIndex];
  if (!ownerPiece || ownerPiece.type !== 'p') return [];
  const { x, y } = coordinates(ownerIndex);
  const direction = ownerPiece.side === 'w' ? -1 : 1;
  const nextY = y + direction;
  if (nextY < 0 || nextY > 7) return [];
  const rules = rulesForState(state);
  const result = [];
  for (const allyX of [x - 1, x + 1]) {
    if (allyX < 0 || allyX > 7) continue;
    const allyFromIndex = indexOf(allyX, y);
    const ally = state.position.board[allyFromIndex];
    if (!ally || ally.side !== entry.side || ally.type !== 'p') continue;
    const ownerToIndex = indexOf(x, nextY);
    const allyToIndex = indexOf(allyX, nextY);
    if (rules.blocked.has(ownerToIndex) || rules.blocked.has(allyToIndex) || state.position.board[ownerToIndex] || state.position.board[allyToIndex]) continue;
    const allyFrom = indexToSquare(allyFromIndex);
    const allyId = identityAt(state.identities, allyFrom);
    if (!allyId || hasStatus(state.statuses, allyId, 'bound')) continue;
    const board = state.position.board.slice();
    board[ownerIndex] = null;
    board[allyFromIndex] = null;
    board[ownerToIndex] = ownerPiece;
    board[allyToIndex] = ally;
    const projected = createPosition({
      board,
      sideToMove: opposite(entry.side),
      castling: state.position.castling,
      enPassant: null,
      halfmove: 0,
      fullmove: state.position.fullmove + (entry.side === 'b' ? 1 : 0)
    });
    if (isInCheck(projected, entry.side, rules)) continue;
    result.push(Object.freeze({ ownerFrom: ownerSquare, ownerTo: indexToSquare(ownerToIndex), allyId, allyFrom, allyTo: indexToSquare(allyToIndex) }));
  }
  return result;
}

function forgeLineTargets(state, entry) {
  const ownerSquare = activeSquare(state.identities, entry.ownerId);
  if (!ownerSquare) return [];
  const ownerIndex = squareToIndex(ownerSquare);
  const owner = state.position.board[ownerIndex];
  if (!owner || owner.type !== 'b') return [];
  const { x, y } = coordinates(ownerIndex);
  const rules = rulesForState(state);
  const result = [];
  for (const [dx, dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
    for (let step = 1; step <= 3; step += 1) {
      const nx = x + dx * step;
      const ny = y + dy * step;
      if (nx < 0 || nx > 7 || ny < 0 || ny > 7) break;
      const target = indexOf(nx, ny);
      if (state.position.board[target] || rules.blocked.has(target)) break;
      result.push(Object.freeze({ targetSquare: indexToSquare(target), operation: 'add' }));
    }
  }
  return result;
}

function previewedChargeTargets(state, entry) {
  const ownerSquare = activeSquare(state.identities, entry.ownerId);
  if (!ownerSquare) return [];
  const ownerIndex = squareToIndex(ownerSquare);
  const owner = state.position.board[ownerIndex];
  if (!owner || owner.type !== 'n') return [];
  const rules = rulesForState(state);
  const firstMoves = generateLegalMoves(state.position, rules).filter((move) => move.from === ownerIndex && !move.capture);
  const result = [];
  for (const first of firstMoves) {
    const firstResult = makeMove(state.position, { from: ownerSquare, to: indexToSquare(first.to) }, rules);
    const continuation = createPosition({
      board: firstResult.position.board,
      sideToMove: entry.side,
      castling: firstResult.position.castling,
      enPassant: null,
      halfmove: firstResult.position.halfmove,
      fullmove: state.position.fullmove
    });
    const secondMoves = generateLegalMoves(continuation, rules).filter((move) => move.from === first.to && !move.capture && move.to !== ownerIndex);
    for (const second of secondMoves) result.push(Object.freeze({ from: ownerSquare, via: indexToSquare(first.to), to: indexToSquare(second.to) }));
  }
  return result;
}

function hostageTargets(state, entry) {
  const ownerSquare = activeSquare(state.identities, entry.ownerId);
  if (!ownerSquare || statusFor(state.statuses, entry.ownerId)) return [];
  const ownerIndex = squareToIndex(ownerSquare);
  const owner = state.position.board[ownerIndex];
  if (!owner || owner.type !== 'q') return [];
  const { x, y } = coordinates(ownerIndex);
  const rules = rulesForState(state);
  const result = [];
  for (const [dx, dy] of QUEEN_DIRECTIONS) {
    for (let step = 1; step <= 3; step += 1) {
      const nx = x + dx * step;
      const ny = y + dy * step;
      if (nx < 0 || nx > 7 || ny < 0 || ny > 7) break;
      const targetIndex = indexOf(nx, ny);
      if (rules.blocked.has(targetIndex)) break;
      const target = state.position.board[targetIndex];
      if (!target) continue;
      if (target.side !== entry.side && target.type !== 'k') {
        const targetSquare = indexToSquare(targetIndex);
        const targetId = identityAt(state.identities, targetSquare);
        if (targetId && !statusFor(state.statuses, targetId)) result.push(Object.freeze({ targetId, targetSquare }));
      }
      break;
    }
  }
  return result;
}

function gateTargets(state, entry) {
  const ownerSquare = activeSquare(state.identities, entry.ownerId);
  if (!ownerSquare) return [];
  const rules = rulesForState(state);
  const authored = Array.isArray(entry.data.gateSquares) ? entry.data.gateSquares : [];
  const candidates = authored.length ? authored : adjacentSquares(ownerSquare);
  const result = [];
  for (const square of candidates) {
    const index = squareToIndex(square);
    const blocked = rules.blocked.has(index);
    if (!blocked && state.position.board[index]) continue;
    result.push(Object.freeze({ targetSquare: indexToSquare(index), operation: blocked ? 'remove' : 'add' }));
  }
  return result;
}

function earlyPromotionTargets(state, entry) {
  const ownerSquare = activeSquare(state.identities, entry.ownerId);
  if (!ownerSquare) return [];
  const index = squareToIndex(ownerSquare);
  const owner = state.position.board[index];
  if (!owner || owner.type !== 'p') return [];
  const { x, y } = coordinates(index);
  if (y !== (owner.side === 'w' ? 1 : 6)) return [];
  const to = indexOf(x, y + (owner.side === 'w' ? -1 : 1));
  const rules = rulesForState(state);
  if (rules.blocked.has(to) || state.position.board[to]) return [];
  const targetSquare = indexToSquare(to);
  return ['r', 'b', 'n'].map((promotion) => Object.freeze({ from: ownerSquare, to: targetSquare, promotion }));
}

function sacrificeTargets(state, entry) {
  const rules = rulesForState(state);
  const enemy = opposite(entry.side);
  const result = [];
  for (const [square, targetId] of Object.entries(state.identities.bySquare)) {
    const boardPiece = state.position.board[squareToIndex(square)];
    if (!boardPiece || boardPiece.side !== entry.side || boardPiece.type === 'k' || targetId === entry.ownerId) continue;
    if (statusFor(state.statuses, targetId)) continue;
    if (isSquareAttacked(state.position, square, enemy, rules)) result.push(Object.freeze({ targetId, targetSquare: square }));
  }
  return result;
}

function targetsForEntry(state, entry) {
  if (entry.kind === 'place_adjacent_ward' || entry.kind === 'interpose') return alliedStatusTargets(state, entry);
  if (entry.kind === 'chain_formation') return chainFormationTargets(state, entry);
  if (entry.kind === 'forge_line') return forgeLineTargets(state, entry);
  if (entry.kind === 'previewed_charge') return previewedChargeTargets(state, entry);
  if (entry.kind === 'hostage_tactic') return hostageTargets(state, entry);
  if (entry.kind === 'gate_command') return gateTargets(state, entry);
  if (entry.kind === 'early_promotion') return earlyPromotionTargets(state, entry);
  if (entry.kind === 'declare_sacrifice') return sacrificeTargets(state, entry);
  return [];
}

function legalAbilityCommands(state) {
  const abilities = state.abilities && state.abilities.format === ABILITY_STATE_FORMAT ? state.abilities : createAbilityState();
  const rules = rulesForState(state);
  if (state.status !== 'active' || isInCheck(state.position, state.position.sideToMove, rules)) return [];
  const side = state.position.sideToMove;
  const pool = state.orderPoints?.[side];
  if (!pool) return [];
  const commands = [];
  for (const entry of abilities.entries) {
    if (!ownerReady(state, entry)) continue;
    const cost = effectiveOrderCost(abilities, entry);
    if (pool.current < cost) continue;
    for (const target of targetsForEntry(state, entry)) {
      commands.push(Object.freeze({
        type: 'UseAbility',
        payload: Object.freeze({
          instanceId: entry.instanceId,
          abilityId: entry.abilityId,
          effectId: entry.effectId,
          sourceId: entry.sourceId,
          ownerId: entry.ownerId,
          baseOrderCost: entry.orderCost,
          effectiveOrderCost: cost,
          ...target
        })
      }));
    }
  }
  return freezeArray(commands);
}

function commandKey(payload) {
  return JSON.stringify(Object.fromEntries(Object.entries(payload || {}).sort(([a], [b]) => a.localeCompare(b))));
}

function normalizeAbilityRequest(state, request) {
  if (!request || request.type !== 'UseAbility') throw new Error('UseAbility request is required');
  const requested = commandKey(request.payload);
  const command = legalAbilityCommands(state).find((candidate) => commandKey(candidate.payload) === requested);
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

function identityMove(identities, changes) {
  const bySquare = { ...identities.bySquare };
  for (const change of changes) delete bySquare[change.from];
  for (const change of changes) bySquare[change.to] = change.pieceId;
  return Object.freeze({ ...identities, bySquare: Object.freeze(bySquare) });
}

function outcomeForStatus(state, position, identities, scenarioRules, factory, events) {
  const status = gameStatus(position, scenarioRules || {});
  if (status.state === 'check') {
    const kingIndex = position.board.findIndex((value) => value && value.side === position.sideToMove && value.type === 'k');
    const kingSquare = indexToSquare(kingIndex);
    events.push(factory.event('KingChecked', { battleId: state.battleId, checkedSide: position.sideToMove, kingSquare, kingId: identityAt(identities, kingSquare) }));
    return { status: 'active', result: null };
  }
  if (status.state === 'checkmate') {
    const result = { outcome: status.winner === state.playerSide ? 'victory' : 'defeat', winner: status.winner, reason: 'checkmate' };
    events.push(factory.event('CheckmateDeclared', { battleId: state.battleId, winner: status.winner, loser: position.sideToMove }));
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

function abilityStateAfterUse(abilities, entry, modifier, actionIndex) {
  return createAbilityState({
    entries: abilities.entries.map((candidate) => candidate.instanceId === entry.instanceId
      ? { ...candidate, used: candidate.used + 1, lastUsedAction: actionIndex }
      : candidate),
    modifiers: abilities.modifiers.map((candidate) => modifier && candidate.instanceId === modifier.instanceId ? { ...candidate, consumed: true } : candidate),
    passives: abilities.passives
  });
}

function statusAppliedEvent(state, applied, sourceId, factory) {
  return factory.event('StatusApplied', { battleId: state.battleId, pieceId: applied.pieceId, statusId: applied.id, sourceId, expiry: applied.expiry });
}

function applyOneStatus(statuses, pieceId, statusId, entry, state, options = {}) {
  return applyPrimaryStatus(statuses, pieceId, statusId, {
    sourceId: entry.sourceId,
    actionIndex: state.actionIndex,
    ...(Object.prototype.hasOwnProperty.call(options, 'expiry') ? { expiry: options.expiry } : {}),
    data: { abilityId: entry.abilityId, effectId: entry.effectId, ownerId: entry.ownerId, ...(options.data || {}) }
  });
}

function normalizeScenarioRules(state) {
  const existing = state.scenarioRules || {};
  return Object.freeze({
    ...existing,
    baseBlockedSquares: freezeArray(existing.baseBlockedSquares || existing.blockedSquares || []),
    blockedSquares: freezeArray(existing.blockedSquares || []),
    blockers: freezeArray(existing.blockers || [])
  });
}

function toggleBlocker(state, entry, payload) {
  const rules = normalizeScenarioRules(state);
  const blockers = rules.blockers.filter((record) => record.square !== payload.targetSquare);
  if (payload.operation === 'add') {
    blockers.push(Object.freeze({
      square: payload.targetSquare,
      sourceId: entry.sourceId,
      ownerId: entry.ownerId,
      kind: entry.kind,
      expiresAfterAction: entry.kind === 'forge_line' ? state.actionIndex + 3 : null
    }));
  }
  const blockedSquares = [...new Set([...rules.baseBlockedSquares, ...blockers.map((record) => record.square)])];
  return Object.freeze({ ...rules, blockedSquares: freezeArray(blockedSquares), blockers: freezeArray(blockers) });
}

function resolveAbilityCommand(state, command, factory) {
  const abilities = state.abilities && state.abilities.format === ABILITY_STATE_FORMAT ? state.abilities : createAbilityState();
  const entry = abilities.entries.find((candidate) => candidate.instanceId === command.payload.instanceId);
  if (!entry) throw new Error(`missing ability instance: ${command.payload.instanceId}`);
  const modifier = modifierForOwner(abilities, entry.ownerId);
  const cost = effectiveOrderCost(abilities, entry);
  const spending = spendOrderPoints(state.orderPoints[entry.side], cost, `ability:${entry.abilityId}`);
  const orderPoints = Object.freeze({ ...state.orderPoints, [entry.side]: spending.pool });
  let position = state.position;
  let identities = state.identities;
  let statuses = state.statuses;
  let scenarioRules = state.scenarioRules || null;
  const events = [factory.event('AbilityUsed', {
    battleId: state.battleId,
    abilityId: entry.abilityId,
    effectId: entry.effectId,
    sourceId: entry.sourceId,
    ownerId: entry.ownerId,
    targetId: command.payload.targetId || null,
    targetSquare: command.payload.targetSquare || command.payload.to || null,
    baseOrderCost: entry.orderCost,
    effectiveOrderCost: cost,
    useNumber: entry.used + 1,
    maxUses: entry.maxUses,
    preview: command.payload
  })];

  if (entry.kind === 'place_adjacent_ward' || entry.kind === 'interpose') {
    const statusId = entry.kind === 'interpose' ? 'guarded' : 'ward';
    const applied = applyOneStatus(statuses, command.payload.targetId, statusId, entry, state, {
      data: entry.kind === 'interpose' ? { guardianId: entry.ownerId } : {}
    });
    statuses = applied.state;
    events.push(statusAppliedEvent(state, applied.applied, entry.sourceId, factory));
    position = passActionPosition(position);
  } else if (entry.kind === 'hostage_tactic') {
    const ownerApplied = applyOneStatus(statuses, entry.ownerId, 'bound', entry, state, { expiry: { kind: 'side_actions', remaining: 2 }, data: { hostageId: command.payload.targetId } });
    const targetApplied = applyOneStatus(ownerApplied.state, command.payload.targetId, 'bound', entry, state, { expiry: { kind: 'side_actions', remaining: 2 }, data: { hostageId: entry.ownerId } });
    statuses = targetApplied.state;
    events.push(statusAppliedEvent(state, ownerApplied.applied, entry.sourceId, factory));
    events.push(statusAppliedEvent(state, targetApplied.applied, entry.sourceId, factory));
    position = passActionPosition(position);
  } else if (entry.kind === 'declare_sacrifice') {
    const applied = applyOneStatus(statuses, command.payload.targetId, 'offered', entry, state, {
      expiry: { kind: 'actions', remaining: 2 },
      data: { rewardSide: entry.side, rewardOrders: 2 }
    });
    statuses = applied.state;
    events.push(statusAppliedEvent(state, applied.applied, entry.sourceId, factory));
    position = passActionPosition(position);
  } else if (entry.kind === 'chain_formation') {
    const board = position.board.slice();
    const ownerPiece = board[squareToIndex(command.payload.ownerFrom)];
    const allyPiece = board[squareToIndex(command.payload.allyFrom)];
    board[squareToIndex(command.payload.ownerFrom)] = null;
    board[squareToIndex(command.payload.allyFrom)] = null;
    board[squareToIndex(command.payload.ownerTo)] = ownerPiece;
    board[squareToIndex(command.payload.allyTo)] = allyPiece;
    position = createPosition({ board, sideToMove: opposite(entry.side), castling: position.castling, enPassant: null, halfmove: 0, fullmove: position.fullmove + (entry.side === 'b' ? 1 : 0) });
    identities = identityMove(identities, [
      { pieceId: entry.ownerId, from: command.payload.ownerFrom, to: command.payload.ownerTo },
      { pieceId: command.payload.allyId, from: command.payload.allyFrom, to: command.payload.allyTo }
    ]);
    events.push(factory.event('FormationAdvanced', { battleId: state.battleId, ownerId: entry.ownerId, allyId: command.payload.allyId, moves: [command.payload.ownerFrom + command.payload.ownerTo, command.payload.allyFrom + command.payload.allyTo] }));
  } else if (entry.kind === 'previewed_charge') {
    const rules = rulesForState(state);
    const first = makeMove(position, { from: command.payload.from, to: command.payload.via }, rules);
    const continuation = createPosition({ board: first.position.board, sideToMove: entry.side, castling: first.position.castling, enPassant: null, halfmove: first.position.halfmove, fullmove: position.fullmove });
    const second = makeMove(continuation, { from: command.payload.via, to: command.payload.to }, rules);
    position = second.position;
    identities = identityMove(identities, [{ pieceId: entry.ownerId, from: command.payload.from, to: command.payload.to }]);
    events.push(factory.event('PreviewedChargeCompleted', { battleId: state.battleId, ownerId: entry.ownerId, from: command.payload.from, via: command.payload.via, to: command.payload.to }));
  } else if (entry.kind === 'early_promotion') {
    const moved = makeMove(position, { from: command.payload.from, to: command.payload.to, promotion: command.payload.promotion }, rulesForState(state));
    position = moved.position;
    identities = identityMove(identities, [{ pieceId: entry.ownerId, from: command.payload.from, to: command.payload.to }]);
    events.push(factory.event('PawnPromoted', { battleId: state.battleId, pieceId: entry.ownerId, side: entry.side, square: command.payload.to, promotedTo: command.payload.promotion, early: true }));
  } else if (entry.kind === 'forge_line' || entry.kind === 'gate_command') {
    scenarioRules = toggleBlocker(state, entry, command.payload);
    position = passActionPosition(position);
    events.push(factory.event('BoardTopologyChanged', { battleId: state.battleId, ownerId: entry.ownerId, sourceId: entry.sourceId, square: command.payload.targetSquare, operation: command.payload.operation, durationActions: entry.kind === 'forge_line' ? 2 : null }));
  } else {
    throw new Error(`unsupported ability resolution kind: ${entry.kind}`);
  }

  events.push(factory.event('OrderPointsChanged', { battleId: state.battleId, side: entry.side, changedBy: spending.changedBy, current: spending.pool.current, reason: `ability:${entry.abilityId}` }));
  if (modifier) events.push(factory.event('RelicEffectConsumed', { battleId: state.battleId, effectId: modifier.effectId, ownerId: modifier.ownerId, amount: modifier.amount, reason: 'first_ability_order_discount' }));
  const nextAbilities = abilityStateAfterUse(abilities, entry, modifier, state.actionIndex);
  const outcome = outcomeForStatus(state, position, identities, scenarioRules, factory, events);
  return {
    position,
    identities,
    statuses,
    abilities: nextAbilities,
    events,
    status: outcome.status,
    result: outcome.result,
    orderPoints,
    reserve: state.reserve,
    scenarioRules,
    actedPieceId: entry.ownerId,
    capturedId: null
  };
}

function updatePassive(abilities, instanceId, patch) {
  return createAbilityState({
    entries: abilities.entries,
    modifiers: abilities.modifiers,
    passives: abilities.passives.map((passive) => passive.instanceId === instanceId ? { ...passive, ...patch } : passive)
  });
}

module.exports = {
  ABILITY_STATE_FORMAT,
  ABILITY_STATE_SCHEMA_VERSION,
  FIRST_ABILITY_DISCOUNT,
  SUPPORTED_KINDS,
  PASSIVE_KINDS,
  createAbilityState,
  activeSquare,
  effectiveOrderCost,
  legalAbilityCommands,
  normalizeAbilityRequest,
  resolveAbilityCommand,
  updatePassive,
  identityMove,
  rulesForState
};
