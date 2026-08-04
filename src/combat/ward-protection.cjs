'use strict';

const { DeterministicIdFactory } = require('../core/determinism.cjs');
const { DomainEnvelopeFactory } = require('../core/domain.cjs');
const {
  opposite,
  createPosition,
  squareToIndex,
  indexToSquare,
  coordinates,
  indexOf,
  toFen
} = require('../core/chess/position.cjs');
const { generateLegalMoves, isInCheck, gameStatus } = require('../core/chess/rules.cjs');
const { identityAt } = require('./identity.cjs');
const { hasStatus, consumeStatus, advanceStatuses } = require('./statuses.cjs');
const {
  legalBattleCommands,
  executeBattleCommand,
  applyBattleStatus
} = require('./battle.cjs');

function freezeArray(items) {
  return Object.freeze(items.slice());
}

function envelopeFactory(snapshot) {
  return new DomainEnvelopeFactory({
    idFactory: DeterministicIdFactory.fromSnapshot(snapshot.idFactory),
    sequence: snapshot.sequence
  });
}

function sameMove(move, payload) {
  return indexToSquare(move.from) === payload.from
    && indexToSquare(move.to) === payload.to
    && (move.promotion || null) === (payload.promotion || null);
}

function captureSquare(position, move) {
  if (!move.capture) return null;
  if (!move.enPassant) return indexToSquare(move.to);
  const { x, y } = coordinates(move.to);
  return indexToSquare(indexOf(x, y + (position.sideToMove === 'w' ? 1 : -1)));
}

function wardedTarget(state, request) {
  if (!request || request.type !== 'MovePiece') return null;
  const move = generateLegalMoves(state.position).find((candidate) => sameMove(candidate, request.payload));
  if (!move || !move.capture) return null;
  const square = captureSquare(state.position, move);
  const pieceId = identityAt(state.identities, square);
  return pieceId && hasStatus(state.statuses, pieceId, 'ward')
    ? Object.freeze({ move, square, pieceId })
    : null;
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

function sideByPiece(identities) {
  return Object.fromEntries(Object.entries(identities.metadata).map(([pieceId, metadata]) => [pieceId, metadata.side]));
}

function outcome(state, position, factory, events) {
  const status = gameStatus(position);
  if (status.state === 'check') {
    const kingIndex = position.board.findIndex((value) => value && value.side === position.sideToMove && value.type === 'k');
    const kingSquare = indexToSquare(kingIndex);
    events.push(factory.event('KingChecked', {
      battleId: state.battleId,
      checkedSide: position.sideToMove,
      kingSquare,
      kingId: identityAt(state.identities, kingSquare)
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

function legalWardAwareCommands(state) {
  const inCheck = isInCheck(state.position, state.position.sideToMove);
  return legalBattleCommands(state).filter((command) => {
    const target = wardedTarget(state, command);
    return !(target && inCheck);
  });
}

function applyWardStatus(state, pieceId, options = {}) {
  const square = Object.entries(state.identities.bySquare).find(([, id]) => id === pieceId);
  if (!square) throw new Error(`cannot ward inactive piece: ${pieceId}`);
  const boardPiece = state.position.board[squareToIndex(square[0])];
  if (boardPiece.type === 'k') throw new Error('ward cannot be applied to a king');
  return applyBattleStatus(state, pieceId, 'ward', options);
}

function executeWardAwareCommand(state, request) {
  const target = wardedTarget(state, request);
  if (!target) return executeBattleCommand(state, request);
  if (isInCheck(state.position, state.position.sideToMove)) {
    throw new Error('warded capture cannot be used to leave own king in check');
  }

  const actingSide = state.position.sideToMove;
  const attackerId = identityAt(state.identities, request.payload.from);
  const factory = envelopeFactory(state.envelope);
  const command = factory.command('MovePiece', request.payload, {
    battleId: state.battleId,
    actorSide: actingSide,
    actionIndex: state.actionIndex,
    interceptedByWard: true
  });
  const consumed = consumeStatus(state.statuses, target.pieceId, 'ward', 'capture_prevented');
  const events = [
    factory.event('CapturePrevented', {
      battleId: state.battleId,
      attackerId,
      protectedId: target.pieceId,
      protectedSquare: target.square,
      attemptedFrom: request.payload.from,
      attemptedTo: request.payload.to,
      protection: 'ward'
    }),
    factory.event('StatusRemoved', {
      battleId: state.battleId,
      pieceId: target.pieceId,
      statusId: 'ward',
      reason: 'capture_prevented'
    })
  ];

  const advanced = advanceStatuses(consumed.state, {
    actingSide,
    actedPieceId: attackerId,
    sideByPiece: sideByPiece(state.identities)
  });
  for (const expired of advanced.expired) {
    events.push(factory.event('StatusExpired', {
      battleId: state.battleId,
      pieceId: expired.pieceId,
      statusId: expired.id,
      expiryKind: expired.expirationReason
    }));
  }

  const position = passActionPosition(state.position);
  const battleOutcome = outcome(state, position, factory, events);
  const nextState = Object.freeze({
    ...state,
    position,
    statuses: advanced.state,
    actionIndex: state.actionIndex + 1,
    status: battleOutcome.status,
    result: battleOutcome.result,
    envelope: factory.snapshot(),
    history: freezeArray([...state.history, command]),
    eventLog: freezeArray([...state.eventLog, ...events])
  });
  return Object.freeze({ state: nextState, command, events: freezeArray(events) });
}

function replayWardAware(initialState, requests) {
  let state = initialState;
  const events = [];
  for (const request of requests) {
    const result = executeWardAwareCommand(state, request);
    state = result.state;
    events.push(...result.events);
  }
  return Object.freeze({ state, events: freezeArray(events), finalFen: toFen(state.position) });
}

module.exports = {
  wardedTarget,
  legalWardAwareCommands,
  applyWardStatus,
  executeWardAwareCommand,
  replayWardAware
};
