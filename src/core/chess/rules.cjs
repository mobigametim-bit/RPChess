'use strict';

const {
  opposite,
  indexOf,
  coordinates,
  squareToIndex,
  indexToSquare,
  piece,
  createPosition,
  validatePosition,
  findKing,
  normalizeCastling
} = require('./position.cjs');

const KNIGHT_OFFSETS = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
const KING_OFFSETS = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
const BISHOP_DIRECTIONS = [[1,1],[1,-1],[-1,1],[-1,-1]];
const ROOK_DIRECTIONS = [[1,0],[-1,0],[0,1],[0,-1]];
const QUEEN_DIRECTIONS = [...BISHOP_DIRECTIONS, ...ROOK_DIRECTIONS];
const PROMOTIONS = ['q', 'r', 'b', 'n'];

const inside = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;

function isSquareAttacked(position, square, bySide) {
  const target = squareToIndex(square);
  const { x, y } = coordinates(target);
  const board = position.board;

  const pawnDirection = bySide === 'w' ? -1 : 1;
  const pawnSourceY = y - pawnDirection;
  for (const sourceX of [x - 1, x + 1]) {
    if (!inside(sourceX, pawnSourceY)) continue;
    const candidate = board[indexOf(sourceX, pawnSourceY)];
    if (candidate && candidate.side === bySide && candidate.type === 'p') return true;
  }

  for (const [dx, dy] of KNIGHT_OFFSETS) {
    const sourceX = x + dx;
    const sourceY = y + dy;
    if (!inside(sourceX, sourceY)) continue;
    const candidate = board[indexOf(sourceX, sourceY)];
    if (candidate && candidate.side === bySide && candidate.type === 'n') return true;
  }

  for (const [dx, dy] of KING_OFFSETS) {
    const sourceX = x + dx;
    const sourceY = y + dy;
    if (!inside(sourceX, sourceY)) continue;
    const candidate = board[indexOf(sourceX, sourceY)];
    if (candidate && candidate.side === bySide && candidate.type === 'k') return true;
  }

  const scan = (directions, allowedTypes) => {
    for (const [dx, dy] of directions) {
      let sourceX = x + dx;
      let sourceY = y + dy;
      while (inside(sourceX, sourceY)) {
        const candidate = board[indexOf(sourceX, sourceY)];
        if (candidate) {
          if (candidate.side === bySide && allowedTypes.includes(candidate.type)) return true;
          break;
        }
        sourceX += dx;
        sourceY += dy;
      }
    }
    return false;
  };

  return scan(BISHOP_DIRECTIONS, ['b', 'q']) || scan(ROOK_DIRECTIONS, ['r', 'q']);
}

function isInCheck(position, side = position.sideToMove) {
  const king = findKing(position, side);
  if (king == null) throw new Error(`missing ${side} king`);
  return isSquareAttacked(position, king, opposite(side));
}

function createMove(from, to, options = {}) {
  return Object.freeze({
    from,
    to,
    promotion: options.promotion || null,
    capture: Boolean(options.capture),
    enPassant: Boolean(options.enPassant),
    castle: options.castle || null,
    doublePawn: Boolean(options.doublePawn)
  });
}

function addTargetMove(moves, position, moving, from, x, y, options = {}) {
  if (!inside(x, y)) return false;
  const to = indexOf(x, y);
  const target = position.board[to];
  if (target && target.side === moving.side) return false;
  if (target && target.type === 'k') return false;
  moves.push(createMove(from, to, { ...options, capture: Boolean(target) || options.enPassant }));
  return !target;
}

function generatePawnMoves(position, from, moving, moves) {
  const { x, y } = coordinates(from);
  const direction = moving.side === 'w' ? -1 : 1;
  const startY = moving.side === 'w' ? 6 : 1;
  const promotionY = moving.side === 'w' ? 0 : 7;
  const forwardY = y + direction;

  if (inside(x, forwardY) && !position.board[indexOf(x, forwardY)]) {
    if (forwardY === promotionY) {
      for (const promotion of PROMOTIONS) moves.push(createMove(from, indexOf(x, forwardY), { promotion }));
    } else {
      moves.push(createMove(from, indexOf(x, forwardY)));
      const doubleY = y + direction * 2;
      if (y === startY && !position.board[indexOf(x, doubleY)]) {
        moves.push(createMove(from, indexOf(x, doubleY), { doublePawn: true }));
      }
    }
  }

  for (const captureX of [x - 1, x + 1]) {
    if (!inside(captureX, forwardY)) continue;
    const to = indexOf(captureX, forwardY);
    const target = position.board[to];
    if (target && target.side !== moving.side && target.type !== 'k') {
      if (forwardY === promotionY) {
        for (const promotion of PROMOTIONS) moves.push(createMove(from, to, { promotion, capture: true }));
      } else {
        moves.push(createMove(from, to, { capture: true }));
      }
      continue;
    }
    if (position.enPassant === to) {
      const capturedIndex = indexOf(captureX, y);
      const captured = position.board[capturedIndex];
      if (captured && captured.side !== moving.side && captured.type === 'p') {
        moves.push(createMove(from, to, { capture: true, enPassant: true }));
      }
    }
  }
}

function generateStepMoves(position, from, moving, moves, offsets) {
  const { x, y } = coordinates(from);
  for (const [dx, dy] of offsets) addTargetMove(moves, position, moving, from, x + dx, y + dy);
}

function generateSlidingMoves(position, from, moving, moves, directions) {
  const { x, y } = coordinates(from);
  for (const [dx, dy] of directions) {
    let targetX = x + dx;
    let targetY = y + dy;
    while (inside(targetX, targetY)) {
      if (!addTargetMove(moves, position, moving, from, targetX, targetY)) break;
      targetX += dx;
      targetY += dy;
    }
  }
}

function generateCastlingMoves(position, from, moving, moves) {
  if (moving.type !== 'k') return;
  const white = moving.side === 'w';
  const rankY = white ? 7 : 0;
  const kingStart = indexOf(4, rankY);
  if (from !== kingStart) return;
  const enemy = opposite(moving.side);
  if (isSquareAttacked(position, kingStart, enemy)) return;

  const options = white
    ? [
      { right: 'K', rookX: 7, emptyX: [5, 6], safeX: [5, 6], toX: 6, castle: 'king' },
      { right: 'Q', rookX: 0, emptyX: [1, 2, 3], safeX: [3, 2], toX: 2, castle: 'queen' }
    ]
    : [
      { right: 'k', rookX: 7, emptyX: [5, 6], safeX: [5, 6], toX: 6, castle: 'king' },
      { right: 'q', rookX: 0, emptyX: [1, 2, 3], safeX: [3, 2], toX: 2, castle: 'queen' }
    ];

  for (const option of options) {
    if (!position.castling.includes(option.right)) continue;
    const rook = position.board[indexOf(option.rookX, rankY)];
    if (!rook || rook.side !== moving.side || rook.type !== 'r') continue;
    if (option.emptyX.some((targetX) => position.board[indexOf(targetX, rankY)])) continue;
    if (option.safeX.some((targetX) => isSquareAttacked(position, indexOf(targetX, rankY), enemy))) continue;
    moves.push(createMove(from, indexOf(option.toX, rankY), { castle: option.castle }));
  }
}

function generatePseudoLegalMoves(position, side = position.sideToMove) {
  validatePosition(position);
  const moves = [];
  for (let from = 0; from < 64; from += 1) {
    const moving = position.board[from];
    if (!moving || moving.side !== side) continue;
    if (moving.type === 'p') generatePawnMoves(position, from, moving, moves);
    else if (moving.type === 'n') generateStepMoves(position, from, moving, moves, KNIGHT_OFFSETS);
    else if (moving.type === 'b') generateSlidingMoves(position, from, moving, moves, BISHOP_DIRECTIONS);
    else if (moving.type === 'r') generateSlidingMoves(position, from, moving, moves, ROOK_DIRECTIONS);
    else if (moving.type === 'q') generateSlidingMoves(position, from, moving, moves, QUEEN_DIRECTIONS);
    else if (moving.type === 'k') {
      generateStepMoves(position, from, moving, moves, KING_OFFSETS);
      generateCastlingMoves(position, from, moving, moves);
    }
  }
  return moves;
}

function removeCastlingRight(rights, right) {
  return rights.replace(right, '');
}

function updateCastlingRights(position, moving, move, capturedPiece) {
  let rights = normalizeCastling(position.castling);
  if (moving.type === 'k') {
    rights = moving.side === 'w'
      ? removeCastlingRight(removeCastlingRight(rights, 'K'), 'Q')
      : removeCastlingRight(removeCastlingRight(rights, 'k'), 'q');
  }
  if (moving.type === 'r') {
    if (move.from === squareToIndex('a1')) rights = removeCastlingRight(rights, 'Q');
    if (move.from === squareToIndex('h1')) rights = removeCastlingRight(rights, 'K');
    if (move.from === squareToIndex('a8')) rights = removeCastlingRight(rights, 'q');
    if (move.from === squareToIndex('h8')) rights = removeCastlingRight(rights, 'k');
  }
  if (capturedPiece && capturedPiece.type === 'r') {
    if (move.to === squareToIndex('a1')) rights = removeCastlingRight(rights, 'Q');
    if (move.to === squareToIndex('h1')) rights = removeCastlingRight(rights, 'K');
    if (move.to === squareToIndex('a8')) rights = removeCastlingRight(rights, 'q');
    if (move.to === squareToIndex('h8')) rights = removeCastlingRight(rights, 'k');
  }
  return normalizeCastling(rights);
}

function applyMoveUnchecked(position, move) {
  const from = squareToIndex(move.from);
  const to = squareToIndex(move.to);
  const moving = position.board[from];
  if (!moving) throw new Error(`no piece on ${indexToSquare(from)}`);
  const board = position.board.slice();
  const target = board[to];
  board[from] = null;

  let capturedPiece = target;
  if (move.enPassant) {
    const { x: toX, y: toY } = coordinates(to);
    const capturedY = toY + (moving.side === 'w' ? 1 : -1);
    const capturedIndex = indexOf(toX, capturedY);
    capturedPiece = board[capturedIndex];
    board[capturedIndex] = null;
  }

  let placed = moving;
  const { y: toY } = coordinates(to);
  if (moving.type === 'p' && (toY === 0 || toY === 7)) {
    if (!PROMOTIONS.includes(move.promotion)) throw new Error('promotion piece is required');
    placed = piece(moving.side, move.promotion);
  }
  board[to] = placed;

  if (move.castle) {
    const rankY = moving.side === 'w' ? 7 : 0;
    const rookFrom = indexOf(move.castle === 'king' ? 7 : 0, rankY);
    const rookTo = indexOf(move.castle === 'king' ? 5 : 3, rankY);
    const rook = board[rookFrom];
    if (!rook || rook.side !== moving.side || rook.type !== 'r') throw new Error('castling rook is missing');
    board[rookFrom] = null;
    board[rookTo] = rook;
  }

  let enPassant = null;
  if (moving.type === 'p' && Math.abs(to - from) === 16) enPassant = (to + from) / 2;
  const isCapture = Boolean(capturedPiece);
  return createPosition({
    board,
    sideToMove: opposite(moving.side),
    castling: updateCastlingRights(position, moving, { from, to }, capturedPiece),
    enPassant,
    halfmove: moving.type === 'p' || isCapture ? 0 : position.halfmove + 1,
    fullmove: position.fullmove + (moving.side === 'b' ? 1 : 0)
  });
}

function generateLegalMoves(position) {
  const side = position.sideToMove;
  return generatePseudoLegalMoves(position, side).filter((move) => {
    const next = applyMoveUnchecked(position, move);
    return !isInCheck(next, side);
  });
}

function moveKey(move) {
  return `${squareToIndex(move.from)}:${squareToIndex(move.to)}:${move.promotion || ''}`;
}

function makeMove(position, request) {
  const desired = {
    from: squareToIndex(request.from),
    to: squareToIndex(request.to),
    promotion: request.promotion || null
  };
  const match = generateLegalMoves(position).find((move) => moveKey(move) === moveKey(desired));
  if (!match) throw new Error(`illegal move: ${indexToSquare(desired.from)}${indexToSquare(desired.to)}${desired.promotion || ''}`);
  return { position: applyMoveUnchecked(position, match), move: match };
}

function gameStatus(position) {
  const legalMoves = generateLegalMoves(position);
  const check = isInCheck(position, position.sideToMove);
  if (legalMoves.length) return { state: check ? 'check' : 'active', check, legalMoves: legalMoves.length };
  return { state: check ? 'checkmate' : 'stalemate', check, legalMoves: 0, winner: check ? opposite(position.sideToMove) : null };
}

function perft(position, depth) {
  if (!Number.isInteger(depth) || depth < 0) throw new RangeError('perft depth must be a non-negative integer');
  if (depth === 0) return 1;
  let nodes = 0;
  for (const move of generateLegalMoves(position)) nodes += perft(applyMoveUnchecked(position, move), depth - 1);
  return nodes;
}

module.exports = {
  PROMOTIONS,
  createMove,
  isSquareAttacked,
  isInCheck,
  generatePseudoLegalMoves,
  generateLegalMoves,
  applyMoveUnchecked,
  makeMove,
  gameStatus,
  perft,
  moveKey
};
