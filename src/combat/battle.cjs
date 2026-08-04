'use strict';

const { DeterministicIdFactory } = require('../core/determinism.cjs');
const { DomainEnvelopeFactory } = require('../core/domain.cjs');
const { indexToSquare, squareToIndex, toFen } = require('../core/chess/position.cjs');
const { generateLegalMoves, makeMove, gameStatus } = require('../core/chess/rules.cjs');

function freezeArray(items) {
  return Object.freeze(items.slice());
}

function createEnvelopeFactory(snapshot) {
  return new DomainEnvelopeFactory({
    idFactory: DeterministicIdFactory.fromSnapshot(snapshot.idFactory),
    sequence: snapshot.sequence
  });
}

function initialEnvelope(battleId, seed) {
  return new DomainEnvelopeFactory({
    idFactory: new DeterministicIdFactory(battleId, seed)
  }).snapshot();
}

function createBattleState(options) {
  if (!options || !options.position) throw new TypeError('position is required');
  const battleId = String(options.battleId || 'battle');
  const initialStatus = gameStatus(options.position);
  const state = {
    format: 'rpchess-battle-state',
    schemaVersion: 1,
    battleId,
    playerSide: options.playerSide || 'w',
    position: options.position,
    actionIndex: 0,
    status: initialStatus.state === 'checkmate' || initialStatus.state === 'stalemate' ? 'completed' : 'active',
    result: initialStatus.state === 'checkmate'
      ? { outcome: initialStatus.winner === (options.playerSide || 'w') ? 'victory' : 'defeat', winner: initialStatus.winner, reason: 'checkmate' }
      : initialStatus.state === 'stalemate'
        ? { outcome: 'draw', winner: null, reason: 'stalemate' }
        : null,
    envelope: initialEnvelope(battleId, options.seed || 1),
    history: freezeArray([]),
    eventLog: freezeArray([])
  };
  return Object.freeze(state);
}

function legalBattleCommands(state) {
  if (state.status !== 'active') return [];
  return generateLegalMoves(state.position).map((move) => Object.freeze({
    type: 'MovePiece',
    payload: Object.freeze({
      from: indexToSquare(move.from),
      to: indexToSquare(move.to),
      promotion: move.promotion || null
    })
  }));
}

function captureDetails(position, move) {
  if (!move.capture) return null;
  if (move.enPassant) {
    const to = squareToIndex(move.to);
    const captured = to + (position.sideToMove === 'w' ? 8 : -8);
    return { square: captured, piece: position.board[captured] };
  }
  const to = squareToIndex(move.to);
  return { square: to, piece: position.board[to] };
}

function executeMoveCommand(state, command, factory) {
  const before = state.position;
  const moving = before.board[squareToIndex(command.payload.from)];
  if (!moving) throw new Error(`no piece on ${command.payload.from}`);
  const result = makeMove(before, command.payload);
  const move = result.move;
  const captured = captureDetails(before, move);
  const events = [];

  events.push(factory.event('PieceMoved', {
    battleId: state.battleId,
    side: moving.side,
    pieceType: moving.type,
    from: indexToSquare(move.from),
    to: indexToSquare(move.to),
    actionIndex: state.actionIndex
  }));

  if (captured && captured.piece) {
    events.push(factory.event('PieceCaptured', {
      battleId: state.battleId,
      capturedSide: captured.piece.side,
      capturedType: captured.piece.type,
      square: indexToSquare(captured.square),
      bySide: moving.side,
      byType: moving.type,
      enPassant: move.enPassant
    }));
  }

  if (move.castle) {
    events.push(factory.event('CastleCompleted', {
      battleId: state.battleId,
      side: moving.side,
      flank: move.castle
    }));
  }

  if (move.promotion) {
    events.push(factory.event('PawnPromoted', {
      battleId: state.battleId,
      side: moving.side,
      square: indexToSquare(move.to),
      promotedTo: move.promotion
    }));
  }

  const status = gameStatus(result.position);
  let battleStatus = 'active';
  let battleResult = null;
  if (status.state === 'check') {
    events.push(factory.event('KingChecked', {
      battleId: state.battleId,
      checkedSide: result.position.sideToMove,
      kingSquare: indexToSquare(result.position.board.findIndex((value) => value && value.side === result.position.sideToMove && value.type === 'k'))
    }));
  } else if (status.state === 'checkmate') {
    battleStatus = 'completed';
    battleResult = {
      outcome: status.winner === state.playerSide ? 'victory' : 'defeat',
      winner: status.winner,
      reason: 'checkmate'
    };
    events.push(factory.event('CheckmateDeclared', {
      battleId: state.battleId,
      winner: status.winner,
      loser: result.position.sideToMove
    }));
    events.push(factory.event('BattleCompleted', { battleId: state.battleId, ...battleResult }));
  } else if (status.state === 'stalemate') {
    battleStatus = 'completed';
    battleResult = { outcome: 'draw', winner: null, reason: 'stalemate' };
    events.push(factory.event('StalemateDeclared', { battleId: state.battleId }));
    events.push(factory.event('BattleCompleted', { battleId: state.battleId, ...battleResult }));
  }

  return {
    position: result.position,
    move,
    events,
    status: battleStatus,
    result: battleResult
  };
}

function executeBattleCommand(state, request) {
  if (!state || state.format !== 'rpchess-battle-state') throw new TypeError('invalid battle state');
  if (state.status !== 'active') throw new Error('battle is already completed');
  if (!request || request.type !== 'MovePiece') throw new Error(`unsupported battle command: ${request && request.type}`);

  const factory = createEnvelopeFactory(state.envelope);
  const command = factory.command(request.type, request.payload || {}, {
    battleId: state.battleId,
    actorSide: state.position.sideToMove,
    actionIndex: state.actionIndex
  });
  const resolution = executeMoveCommand(state, command, factory);
  const nextState = Object.freeze({
    ...state,
    position: resolution.position,
    actionIndex: state.actionIndex + 1,
    status: resolution.status,
    result: resolution.result,
    envelope: factory.snapshot(),
    history: freezeArray([...state.history, command]),
    eventLog: freezeArray([...state.eventLog, ...resolution.events])
  });
  return Object.freeze({ state: nextState, command, events: freezeArray(resolution.events) });
}

function replayBattle(initialState, requests) {
  let state = initialState;
  const events = [];
  for (const request of requests) {
    const result = executeBattleCommand(state, request);
    state = result.state;
    events.push(...result.events);
  }
  return Object.freeze({ state, events: freezeArray(events), finalFen: toFen(state.position) });
}

module.exports = {
  createBattleState,
  legalBattleCommands,
  executeBattleCommand,
  replayBattle
};
