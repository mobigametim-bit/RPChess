'use strict';

const FILES = 'abcdefgh';
const PIECE_RE = /^[prnbqk]$/;

function opposite(side) {
  if (side === 'w') return 'b';
  if (side === 'b') return 'w';
  throw new TypeError(`invalid side: ${side}`);
}

function indexOf(x, y) {
  return y * 8 + x;
}

function coordinates(index) {
  if (!Number.isInteger(index) || index < 0 || index >= 64) throw new RangeError(`invalid square index: ${index}`);
  return { x: index % 8, y: Math.floor(index / 8) };
}

function squareToIndex(square) {
  if (typeof square === 'number') {
    if (!Number.isInteger(square) || square < 0 || square >= 64) throw new RangeError(`invalid square index: ${square}`);
    return square;
  }
  if (!/^[a-h][1-8]$/.test(square)) throw new TypeError(`invalid square: ${square}`);
  const x = FILES.indexOf(square[0]);
  const y = 8 - Number(square[1]);
  return indexOf(x, y);
}

function indexToSquare(index) {
  const { x, y } = coordinates(index);
  return `${FILES[x]}${8 - y}`;
}

function piece(side, type) {
  if (!['w', 'b'].includes(side)) throw new TypeError(`invalid side: ${side}`);
  if (!PIECE_RE.test(type)) throw new TypeError(`invalid piece type: ${type}`);
  return Object.freeze({ side, type });
}

function clonePiece(value) {
  return value ? piece(value.side, value.type) : null;
}

function normalizeCastling(value) {
  const source = value === '-' || value == null ? '' : String(value);
  const unique = [...new Set(source.split('').filter((right) => 'KQkq'.includes(right)))];
  return 'KQkq'.split('').filter((right) => unique.includes(right)).join('');
}

function createPosition(input = {}) {
  const boardInput = input.board || new Array(64).fill(null);
  if (!Array.isArray(boardInput) || boardInput.length !== 64) throw new TypeError('board must contain 64 squares');
  const board = boardInput.map(clonePiece);
  const sideToMove = input.sideToMove || 'w';
  if (!['w', 'b'].includes(sideToMove)) throw new TypeError('sideToMove must be w or b');
  const enPassant = input.enPassant == null || input.enPassant === '-' ? null : squareToIndex(input.enPassant);
  const position = {
    board: Object.freeze(board),
    sideToMove,
    castling: normalizeCastling(input.castling),
    enPassant,
    halfmove: Number.isInteger(input.halfmove) && input.halfmove >= 0 ? input.halfmove : 0,
    fullmove: Number.isInteger(input.fullmove) && input.fullmove >= 1 ? input.fullmove : 1
  };
  return Object.freeze(position);
}

function parseFen(fen) {
  if (typeof fen !== 'string') throw new TypeError('FEN must be a string');
  const parts = fen.trim().split(/\s+/);
  if (parts.length !== 6) throw new Error('FEN must contain six fields');
  const [layout, sideToMove, castling, enPassant, halfmoveRaw, fullmoveRaw] = parts;
  const ranks = layout.split('/');
  if (ranks.length !== 8) throw new Error('FEN must contain eight ranks');
  const board = [];
  for (const rank of ranks) {
    let width = 0;
    for (const token of rank) {
      if (/^[1-8]$/.test(token)) {
        const count = Number(token);
        width += count;
        for (let i = 0; i < count; i += 1) board.push(null);
      } else if (/^[prnbqkPRNBQK]$/.test(token)) {
        width += 1;
        board.push(piece(token === token.toUpperCase() ? 'w' : 'b', token.toLowerCase()));
      } else {
        throw new Error(`invalid FEN token: ${token}`);
      }
    }
    if (width !== 8) throw new Error('each FEN rank must contain eight squares');
  }
  const halfmove = Number(halfmoveRaw);
  const fullmove = Number(fullmoveRaw);
  if (!Number.isInteger(halfmove) || halfmove < 0) throw new Error('invalid FEN halfmove clock');
  if (!Number.isInteger(fullmove) || fullmove < 1) throw new Error('invalid FEN fullmove number');
  const position = createPosition({ board, sideToMove, castling, enPassant, halfmove, fullmove });
  validatePosition(position);
  return position;
}

function toFen(position) {
  validatePosition(position, { requireKings: false });
  const ranks = [];
  for (let y = 0; y < 8; y += 1) {
    let rank = '';
    let empty = 0;
    for (let x = 0; x < 8; x += 1) {
      const value = position.board[indexOf(x, y)];
      if (!value) {
        empty += 1;
        continue;
      }
      if (empty) { rank += empty; empty = 0; }
      const symbol = value.type;
      rank += value.side === 'w' ? symbol.toUpperCase() : symbol;
    }
    if (empty) rank += empty;
    ranks.push(rank);
  }
  return [
    ranks.join('/'),
    position.sideToMove,
    position.castling || '-',
    position.enPassant == null ? '-' : indexToSquare(position.enPassant),
    position.halfmove,
    position.fullmove
  ].join(' ');
}

function validatePosition(position, options = {}) {
  if (!position || !Array.isArray(position.board) || position.board.length !== 64) throw new TypeError('invalid position board');
  if (!['w', 'b'].includes(position.sideToMove)) throw new TypeError('invalid position sideToMove');
  for (const value of position.board) {
    if (value && (!['w', 'b'].includes(value.side) || !PIECE_RE.test(value.type))) throw new TypeError('invalid board piece');
  }
  if (options.requireKings !== false) {
    for (const side of ['w', 'b']) {
      const count = position.board.filter((value) => value && value.side === side && value.type === 'k').length;
      if (count !== 1) throw new Error(`position must contain exactly one ${side} king`);
    }
  }
  if (position.enPassant != null) {
    const { y } = coordinates(position.enPassant);
    if (![2, 5].includes(y)) throw new Error('en passant target must be on rank 3 or 6');
  }
  return true;
}

function findKing(position, side) {
  const index = position.board.findIndex((value) => value && value.side === side && value.type === 'k');
  return index >= 0 ? index : null;
}

function withBoard(position, board, changes = {}) {
  return createPosition({
    board,
    sideToMove: changes.sideToMove ?? position.sideToMove,
    castling: changes.castling ?? position.castling,
    enPassant: Object.prototype.hasOwnProperty.call(changes, 'enPassant') ? changes.enPassant : position.enPassant,
    halfmove: changes.halfmove ?? position.halfmove,
    fullmove: changes.fullmove ?? position.fullmove
  });
}

module.exports = {
  FILES,
  opposite,
  indexOf,
  coordinates,
  squareToIndex,
  indexToSquare,
  piece,
  createPosition,
  parseFen,
  toFen,
  validatePosition,
  findKing,
  withBoard,
  normalizeCastling
};
