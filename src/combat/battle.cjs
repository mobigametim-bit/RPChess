'use strict';

const { DeterministicIdFactory } = require('../core/determinism.cjs');
const { DomainEnvelopeFactory } = require('../core/domain.cjs');
const { indexToSquare, squareToIndex, toFen } = require('../core/chess/position.cjs');
const { generateLegalMoves, makeMove, gameStatus } = require('../core/chess/rules.cjs');
const { createOrderPoints } = require('./order-points.cjs');
const {
  normalizeReserve,
  normalizeReserveCells,
  deployReserve,
  legalReserveDeployments
} = require('./reserve.cjs');

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
  return new DomainEnvelopeFactory({ idFactory: new DeterministicIdFactory(battleId, seed) }).snapshot();
}

function normalizeOrderPools(options = {}) {
  return Object.freeze({
    w: createOrderPoints(options.w || {}),
    b: createOrderPoints(options.b || {})
  });
}

function outcomeForStatus(state, position, status) {
  if (status.state === 'checkmate') {
    return {
      status: 'completed',
      result: {
        outcome: status.winner === state.playerSide ? 'victory' : 'defeat',
        winner: status.winner,
        reason: 'checkmate'
      }
    };
  }
  if (status.state === 'stalemate') {
    return { status: 'completed', result: { outcome: 'draw', winner: null, reason: 'stalemate' } };
  }
  return { status: 'active', result: null };
}

function createBattleState(options) {
  if (!options || !options.position) throw new TypeError('position is required');
  const battleId = String(options.battleId || 'battle');
  const playerSide = options.playerSide || 'w';
  const initialStatus = gameStatus(options.position);
  const outcome = outcomeForStatus({ playerSide }, options.position, initialStatus);
  return Object.freeze({
    format: 'rpchess-battle-state',
    schemaVersion: 2,
    battleId,
    playerSide,
    position: options.position,
    actionIndex: 0,
    status: outcome.status,
    result: outcome.result,
    orderPoints: normalizeOrderPools(options.orderPoints),
    reserve: normalizeReserve(options.reserve || []),
    reserveCells: normalizeReserveCells(options.reserveCells || {}),
    envelope: initialEnvelope(battleId, options.seed || 1),
    history: freezeArray([]),
    eventLog: freezeArray([])
  });
}

function moveCommands(state) {
  return generateLegalMoves(state.position).map((move) => Object.freeze({
    type: 'MovePiece',
    payload: Object.freeze({
      from: indexToSquare(move.from),
      to: indexToSquare(move.to),
      promotion: move.promotion || null
    })
  }));
}

function legalBattleCommands(state) {
  if (state.status !== 'active') return [];
  return [
    ...moveCommands(state),
    ...legalReserveDeployments({
      position: state.position,
      reserve: state.reserve,
      reserveCells: state.reserveCells,
      orderPoints: state.orderPoints
    })
  ];
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

function appendPositionStatusEvents(state, position, factory, events) {
  const chessStatus = gameStatus(position);
  const outcome = outcomeForStatus(state, position, chessStatus);
  if (chessStatus.state === 'check') {
    const kingIndex = position.board.findIndex((value) => value && value.side === position.sideToMove && value.type === 'k');
    events.push(factory.event('KingChecked', {
      battleId: state.battleId,
      checkedSide: position.sideToMove,
      kingSquare: indexToSquare(kingIndex)
    }));
  } else if (chessStatus.state === 'checkmate') {
    events.push(factory.event('CheckmateDeclared', {
      battleId: state.battleId,
      winner: chessStatus.winner,
      loser: position.sideToMove
    }));
    events.push(factory.event('BattleCompleted', { battleId: state.battleId, ...outcome.result }));
  } else if (chessStatus.state === 'stalemate') {
    events.push(factory.event('StalemateDeclared', { battleId: state.battleId }));
    events.push(factory.event('BattleCompleted', { battleId: state.battleId, ...outcome.result }));
  }
  return outcome;
}

function executeMoveCommand(state, command, factory) {
  const before = state.position;
  const moving = before.board[squareToIndex(command.payload.from)];
  if (!moving) throw new Error(`no piece on ${command.payload.from}`);
  const result = makeMove(before, command.payload);
  const move = result.move;
  const captured = captureDetails(before, move);
  const events = [factory.event('PieceMoved', {
    battleId: state.battleId,
    side: moving.side,
    pieceType: moving.type,
    from: indexToSquare(move.from),
    to: indexToSquare(move.to),
    actionIndex: state.actionIndex
  })];

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
  if (move.castle) events.push(factory.event('CastleCompleted', { battleId: state.battleId, side: moving.side, flank: move.castle }));
  if (move.promotion) events.push(factory.event('PawnPromoted', {
    battleId: state.battleId,
    side: moving.side,
    square: indexToSquare(move.to),
    promotedTo: move.promotion
  }));

  const outcome = appendPositionStatusEvents(state, result.position, factory, events);
  return {
    position: result.position,
    events,
    status: outcome.status,
    result: outcome.result,
    orderPoints: state.orderPoints,
    reserve: state.reserve
  };
}

function executeReserveCommand(state, command, factory) {
  const actorSide = state.position.sideToMove;
  const deployed = deployReserve({
    position: state.position,
    reserve: state.reserve,
    reserveCells: state.reserveCells,
    orderPoints: state.orderPoints,
    entryId: command.payload.entryId,
    square: command.payload.square
  });
  const events = [
    factory.event('ReserveDeployed', {
      battleId: state.battleId,
      side: actorSide,
      entryId: deployed.entry.id,
      pieceType: deployed.entry.type,
      square: deployed.square,
      orderCost: deployed.entry.orderCost
    }),
    factory.event('OrderPointsChanged', {
      battleId: state.battleId,
      side: actorSide,
      changedBy: deployed.orderChange,
      current: deployed.orderPoints[actorSide].current,
      reason: 'reserve_deployment'
    })
  ];
  const outcome = appendPositionStatusEvents(state, deployed.position, factory, events);
  return {
    position: deployed.position,
    events,
    status: outcome.status,
    result: outcome.result,
    orderPoints: deployed.orderPoints,
    reserve: deployed.reserve
  };
}

function executeBattleCommand(state, request) {
  if (!state || state.format !== 'rpchess-battle-state') throw new TypeError('invalid battle state');
  if (state.status !== 'active') throw new Error('battle is already completed');
  if (!request || !['MovePiece', 'DeployReserve'].includes(request.type)) {
    throw new Error(`unsupported battle command: ${request && request.type}`);
  }

  const factory = createEnvelopeFactory(state.envelope);
  const command = factory.command(request.type, request.payload || {}, {
    battleId: state.battleId,
    actorSide: state.position.sideToMove,
    actionIndex: state.actionIndex
  });
  const resolution = request.type === 'MovePiece'
    ? executeMoveCommand(state, command, factory)
    : executeReserveCommand(state, command, factory);

  const nextState = Object.freeze({
    ...state,
    position: resolution.position,
    actionIndex: state.actionIndex + 1,
    status: resolution.status,
    result: resolution.result,
    orderPoints: resolution.orderPoints,
    reserve: resolution.reserve,
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

module.exports = { createBattleState, legalBattleCommands, executeBattleCommand, replayBattle };
