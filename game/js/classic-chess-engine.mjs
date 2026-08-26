const FILES = 'abcdefgh';
const COLORS = Object.freeze({ WHITE: 'w', BLACK: 'b' });
const PIECES = Object.freeze({ PAWN: 'p', KNIGHT: 'n', BISHOP: 'b', ROOK: 'r', QUEEN: 'q', KING: 'k' });
const PROMOTIONS = Object.freeze(['q', 'r', 'b', 'n']);

function opposite(color) { return color === 'w' ? 'b' : 'w'; }
function clonePiece(piece) { return piece ? { type: piece.type, color: piece.color } : null; }
function cloneBoard(board) { return board.map(clonePiece); }
function fileOf(index) { return index % 8; }
function rankOf(index) { return Math.floor(index / 8); }
function inBounds(file, rank) { return file >= 0 && file < 8 && rank >= 0 && rank < 8; }
function indexOf(file, rank) { return rank * 8 + file; }
function squareToIndex(square) {
  if (typeof square === 'number') return square >= 0 && square < 64 ? square : -1;
  if (!/^[a-h][1-8]$/.test(String(square))) return -1;
  return indexOf(FILES.indexOf(square[0]), Number(square[1]) - 1);
}
function indexToSquare(index) { return `${FILES[fileOf(index)]}${rankOf(index) + 1}`; }
function pieceCode(piece) { return piece ? (piece.color === 'w' ? piece.type.toUpperCase() : piece.type) : ''; }

function createEmptyState() {
  return {
    board: Array(64).fill(null),
    turn: 'w',
    castling: { K: false, Q: false, k: false, q: false },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    lastMove: null,
    history: [],
    repetition: new Map()
  };
}

function parseFEN(fen) {
  const [placement, turn = 'w', castling = '-', ep = '-', halfmove = '0', fullmove = '1'] = String(fen).trim().split(/\s+/);
  const state = createEmptyState();
  const rows = placement.split('/');
  if (rows.length !== 8) throw new Error('Invalid FEN board');
  for (let fenRank = 0; fenRank < 8; fenRank += 1) {
    let file = 0;
    for (const char of rows[fenRank]) {
      if (/\d/.test(char)) {
        file += Number(char);
        continue;
      }
      const lower = char.toLowerCase();
      if (!'pnbrqk'.includes(lower) || file > 7) throw new Error('Invalid FEN piece');
      const rank = 7 - fenRank;
      state.board[indexOf(file, rank)] = { type: lower, color: char === lower ? 'b' : 'w' };
      file += 1;
    }
    if (file !== 8) throw new Error('Invalid FEN rank width');
  }
  if (!['w', 'b'].includes(turn)) throw new Error('Invalid FEN turn');
  state.turn = turn;
  for (const right of castling === '-' ? '' : castling) {
    if (!(right in state.castling)) throw new Error('Invalid FEN castling');
    state.castling[right] = true;
  }
  state.enPassant = ep === '-' ? null : squareToIndex(ep);
  if (state.enPassant === -1) throw new Error('Invalid FEN en passant');
  state.halfmove = Math.max(0, Number.parseInt(halfmove, 10) || 0);
  state.fullmove = Math.max(1, Number.parseInt(fullmove, 10) || 1);
  return state;
}

function boardPlacement(board) {
  const ranks = [];
  for (let rank = 7; rank >= 0; rank -= 1) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file += 1) {
      const piece = board[indexOf(file, rank)];
      if (!piece) { empty += 1; continue; }
      if (empty) { row += empty; empty = 0; }
      row += pieceCode(piece);
    }
    if (empty) row += empty;
    ranks.push(row);
  }
  return ranks.join('/');
}

function castlingField(state) {
  const rights = ['K', 'Q', 'k', 'q'].filter((right) => state.castling[right]).join('');
  return rights || '-';
}

function stateToFEN(state) {
  return `${boardPlacement(state.board)} ${state.turn} ${castlingField(state)} ${state.enPassant == null ? '-' : indexToSquare(state.enPassant)} ${state.halfmove} ${state.fullmove}`;
}

function createInitialState() {
  return parseFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
}

function addSlidingMoves(state, from, color, directions, moves) {
  const fromFile = fileOf(from);
  const fromRank = rankOf(from);
  for (const [df, dr] of directions) {
    let file = fromFile + df;
    let rank = fromRank + dr;
    while (inBounds(file, rank)) {
      const to = indexOf(file, rank);
      const target = state.board[to];
      if (!target) moves.push({ from, to });
      else {
        if (target.color !== color && target.type !== 'k') moves.push({ from, to, capture: to });
        break;
      }
      file += df;
      rank += dr;
    }
  }
}

function isSquareAttacked(state, target, byColor) {
  const tf = fileOf(target);
  const tr = rankOf(target);
  const pawnSourceRank = tr + (byColor === 'w' ? -1 : 1);
  for (const df of [-1, 1]) {
    const file = tf + df;
    if (!inBounds(file, pawnSourceRank)) continue;
    const piece = state.board[indexOf(file, pawnSourceRank)];
    if (piece?.color === byColor && piece.type === 'p') return true;
  }

  for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
    const file = tf + df;
    const rank = tr + dr;
    if (!inBounds(file, rank)) continue;
    const piece = state.board[indexOf(file, rank)];
    if (piece?.color === byColor && piece.type === 'n') return true;
  }

  for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    let file = tf + df;
    let rank = tr + dr;
    while (inBounds(file, rank)) {
      const piece = state.board[indexOf(file, rank)];
      if (piece) {
        if (piece.color === byColor && (piece.type === 'b' || piece.type === 'q')) return true;
        break;
      }
      file += df;
      rank += dr;
    }
  }

  for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let file = tf + df;
    let rank = tr + dr;
    while (inBounds(file, rank)) {
      const piece = state.board[indexOf(file, rank)];
      if (piece) {
        if (piece.color === byColor && (piece.type === 'r' || piece.type === 'q')) return true;
        break;
      }
      file += df;
      rank += dr;
    }
  }

  for (let df = -1; df <= 1; df += 1) for (let dr = -1; dr <= 1; dr += 1) {
    if (!df && !dr) continue;
    const file = tf + df;
    const rank = tr + dr;
    if (!inBounds(file, rank)) continue;
    const piece = state.board[indexOf(file, rank)];
    if (piece?.color === byColor && piece.type === 'k') return true;
  }
  return false;
}

function kingIndex(state, color) {
  return state.board.findIndex((piece) => piece?.color === color && piece.type === 'k');
}

function inCheck(state, color) {
  const king = kingIndex(state, color);
  return king >= 0 && isSquareAttacked(state, king, opposite(color));
}

function kingTransitSafe(state, from, transit, color) {
  const copy = { ...state, board: cloneBoard(state.board), castling: { ...state.castling } };
  copy.board[transit] = copy.board[from];
  copy.board[from] = null;
  return !isSquareAttacked(copy, transit, opposite(color));
}

function pseudoMovesFor(state, from, includeCastling = true) {
  const piece = state.board[from];
  if (!piece) return [];
  const moves = [];
  const file = fileOf(from);
  const rank = rankOf(from);

  if (piece.type === 'p') {
    const direction = piece.color === 'w' ? 1 : -1;
    const startRank = piece.color === 'w' ? 1 : 6;
    const promotionRank = piece.color === 'w' ? 7 : 0;
    const oneRank = rank + direction;
    if (inBounds(file, oneRank)) {
      const one = indexOf(file, oneRank);
      if (!state.board[one]) {
        if (oneRank === promotionRank) for (const promotion of PROMOTIONS) moves.push({ from, to: one, promotion });
        else moves.push({ from, to: one });
        const twoRank = rank + direction * 2;
        const two = indexOf(file, twoRank);
        if (rank === startRank && !state.board[two]) moves.push({ from, to: two, doublePawn: true });
      }
    }
    for (const df of [-1, 1]) {
      const targetFile = file + df;
      const targetRank = rank + direction;
      if (!inBounds(targetFile, targetRank)) continue;
      const to = indexOf(targetFile, targetRank);
      const target = state.board[to];
      if (target && target.color !== piece.color && target.type !== 'k') {
        if (targetRank === promotionRank) for (const promotion of PROMOTIONS) moves.push({ from, to, capture: to, promotion });
        else moves.push({ from, to, capture: to });
      } else if (state.enPassant === to) {
        const captured = indexOf(targetFile, rank);
        const capturedPiece = state.board[captured];
        if (capturedPiece?.color === opposite(piece.color) && capturedPiece.type === 'p') moves.push({ from, to, capture: captured, enPassant: true });
      }
    }
  }

  if (piece.type === 'n') {
    for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
      const tf = file + df;
      const tr = rank + dr;
      if (!inBounds(tf, tr)) continue;
      const to = indexOf(tf, tr);
      const target = state.board[to];
      if (!target) moves.push({ from, to });
      else if (target.color !== piece.color && target.type !== 'k') moves.push({ from, to, capture: to });
    }
  }

  if (piece.type === 'b') addSlidingMoves(state, from, piece.color, [[1, 1], [1, -1], [-1, 1], [-1, -1]], moves);
  if (piece.type === 'r') addSlidingMoves(state, from, piece.color, [[1, 0], [-1, 0], [0, 1], [0, -1]], moves);
  if (piece.type === 'q') addSlidingMoves(state, from, piece.color, [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]], moves);

  if (piece.type === 'k') {
    for (let df = -1; df <= 1; df += 1) for (let dr = -1; dr <= 1; dr += 1) {
      if (!df && !dr) continue;
      const tf = file + df;
      const tr = rank + dr;
      if (!inBounds(tf, tr)) continue;
      const to = indexOf(tf, tr);
      const target = state.board[to];
      if (!target) moves.push({ from, to });
      else if (target.color !== piece.color && target.type !== 'k') moves.push({ from, to, capture: to });
    }
    if (includeCastling) {
      const homeRank = piece.color === 'w' ? 0 : 7;
      const kingHome = indexOf(4, homeRank);
      if (from === kingHome && !isSquareAttacked(state, kingHome, opposite(piece.color))) {
        const kingSideRight = piece.color === 'w' ? 'K' : 'k';
        const queenSideRight = piece.color === 'w' ? 'Q' : 'q';
        const rookKing = state.board[indexOf(7, homeRank)];
        const kingTransit = indexOf(5, homeRank);
        const kingDestination = indexOf(6, homeRank);
        if (state.castling[kingSideRight] && rookKing?.type === 'r' && rookKing.color === piece.color && !state.board[kingTransit] && !state.board[kingDestination] && kingTransitSafe(state, from, kingTransit, piece.color)) {
          moves.push({ from, to: kingDestination, castle: 'K' });
        }
        const rookQueen = state.board[indexOf(0, homeRank)];
        const queenTransit = indexOf(3, homeRank);
        const queenDestination = indexOf(2, homeRank);
        if (state.castling[queenSideRight] && rookQueen?.type === 'r' && rookQueen.color === piece.color && !state.board[indexOf(1, homeRank)] && !state.board[queenDestination] && !state.board[queenTransit] && kingTransitSafe(state, from, queenTransit, piece.color)) {
          moves.push({ from, to: queenDestination, castle: 'Q' });
        }
      }
    }
  }
  return moves;
}

function applyMoveToState(state, move, { record = false } = {}) {
  const piece = state.board[move.from];
  if (!piece) throw new Error('No piece on source square');
  const moving = clonePiece(piece);
  const capturedPiece = move.capture != null ? clonePiece(state.board[move.capture]) : clonePiece(state.board[move.to]);
  const previous = record ? { fen: stateToFEN(state), move: state.lastMove ? { ...state.lastMove } : null, repetition: new Map(state.repetition) } : null;

  state.board[move.from] = null;
  if (move.capture != null && move.capture !== move.to) state.board[move.capture] = null;
  state.board[move.to] = { type: move.promotion || moving.type, color: moving.color };

  if (move.castle) {
    const rank = moving.color === 'w' ? 0 : 7;
    const rookFrom = move.castle === 'K' ? indexOf(7, rank) : indexOf(0, rank);
    const rookTo = move.castle === 'K' ? indexOf(5, rank) : indexOf(3, rank);
    state.board[rookTo] = state.board[rookFrom];
    state.board[rookFrom] = null;
  }

  if (moving.type === 'k') {
    if (moving.color === 'w') { state.castling.K = false; state.castling.Q = false; }
    else { state.castling.k = false; state.castling.q = false; }
  }
  if (moving.type === 'r') {
    if (move.from === squareToIndex('a1')) state.castling.Q = false;
    if (move.from === squareToIndex('h1')) state.castling.K = false;
    if (move.from === squareToIndex('a8')) state.castling.q = false;
    if (move.from === squareToIndex('h8')) state.castling.k = false;
  }
  if (capturedPiece?.type === 'r') {
    const capturedAt = move.capture ?? move.to;
    if (capturedAt === squareToIndex('a1')) state.castling.Q = false;
    if (capturedAt === squareToIndex('h1')) state.castling.K = false;
    if (capturedAt === squareToIndex('a8')) state.castling.q = false;
    if (capturedAt === squareToIndex('h8')) state.castling.k = false;
  }

  state.enPassant = moving.type === 'p' && Math.abs(rankOf(move.to) - rankOf(move.from)) === 2 ? indexOf(fileOf(move.from), (rankOf(move.from) + rankOf(move.to)) / 2) : null;
  state.halfmove = moving.type === 'p' || capturedPiece ? 0 : state.halfmove + 1;
  if (moving.color === 'b') state.fullmove += 1;
  state.turn = opposite(moving.color);
  state.lastMove = { from: move.from, to: move.to, piece: moving.type, color: moving.color, capture: capturedPiece?.type || null, promotion: move.promotion || null, castle: move.castle || null, enPassant: Boolean(move.enPassant) };
  if (record && previous) state.history.push(previous);
  return state;
}

function moveLeavesKingSafe(state, move, color) {
  const copy = { ...state, board: cloneBoard(state.board), castling: { ...state.castling }, repetition: state.repetition };
  applyMoveToState(copy, move);
  return !inCheck(copy, color);
}

function legalMoves(state, fromSquare = null) {
  const fromFilter = fromSquare == null ? null : squareToIndex(fromSquare);
  const moves = [];
  for (let from = 0; from < 64; from += 1) {
    if (fromFilter != null && from !== fromFilter) continue;
    const piece = state.board[from];
    if (!piece || piece.color !== state.turn) continue;
    for (const move of pseudoMovesFor(state, from, true)) if (moveLeavesKingSafe(state, move, piece.color)) moves.push(move);
  }
  return moves;
}

function legalEnPassantExists(state) {
  if (state.enPassant == null) return false;
  for (let from = 0; from < 64; from += 1) {
    const piece = state.board[from];
    if (piece?.color !== state.turn || piece.type !== 'p') continue;
    for (const move of pseudoMovesFor(state, from, false)) if (move.enPassant && moveLeavesKingSafe(state, move, piece.color)) return true;
  }
  return false;
}

function positionKey(state) {
  const ep = state.enPassant != null && legalEnPassantExists(state) ? indexToSquare(state.enPassant) : '-';
  return `${boardPlacement(state.board)} ${state.turn} ${castlingField(state)} ${ep}`;
}

function insufficientMaterial(state) {
  const pieces = state.board.map((piece, index) => ({ piece, index })).filter(({ piece }) => piece);
  if (pieces.some(({ piece }) => ['p', 'q', 'r'].includes(piece.type))) return false;
  const minors = pieces.filter(({ piece }) => ['b', 'n'].includes(piece.type));
  if (minors.length === 0 || minors.length === 1) return true;
  if (minors.every(({ piece }) => piece.type === 'b')) {
    const colors = minors.map(({ index }) => (fileOf(index) + rankOf(index)) % 2);
    return colors.every((color) => color === colors[0]);
  }
  return false;
}

function gameStatus(state) {
  const moves = legalMoves(state);
  const checked = inCheck(state, state.turn);
  if (!moves.length) return checked ? { over: true, type: 'checkmate', winner: opposite(state.turn), checked: true } : { over: true, type: 'stalemate', winner: null, checked: false };
  if (insufficientMaterial(state)) return { over: true, type: 'draw_insufficient', winner: null, checked };
  if (state.halfmove >= 100) return { over: true, type: 'draw_50_move', winner: null, checked };
  if ((state.repetition.get(positionKey(state)) || 0) >= 3) return { over: true, type: 'draw_threefold', winner: null, checked };
  return { over: false, type: checked ? 'check' : 'active', winner: null, checked };
}

function moveToPublic(move) {
  return { ...move, from: indexToSquare(move.from), to: indexToSquare(move.to), capture: move.capture == null ? null : indexToSquare(move.capture) };
}

class ClassicChessEngine {
  constructor(fen = null) {
    this.state = fen ? parseFEN(fen) : createInitialState();
    this.state.repetition = new Map();
    this.recordPosition();
  }
  recordPosition() {
    const key = positionKey(this.state);
    this.state.repetition.set(key, (this.state.repetition.get(key) || 0) + 1);
  }
  reset(fen = null) {
    this.state = fen ? parseFEN(fen) : createInitialState();
    this.state.repetition = new Map();
    this.recordPosition();
    return this.snapshot();
  }
  fen() { return stateToFEN(this.state); }
  turn() { return this.state.turn; }
  pieceAt(square) { return clonePiece(this.state.board[squareToIndex(square)]); }
  isCheck(color = this.state.turn) { return inCheck(this.state, color); }
  status() { return gameStatus(this.state); }
  positionKey() { return positionKey(this.state); }
  legalMoves(square = null) { return legalMoves(this.state, square).map(moveToPublic); }
  promotionChoices(from, to) { return this.legalMoves(from).filter((move) => move.to === to && move.promotion).map((move) => move.promotion); }
  move(fromSquare, toSquare, promotion = null) {
    const from = squareToIndex(fromSquare);
    const to = squareToIndex(toSquare);
    if (from < 0 || to < 0) return { ok: false, reason: 'invalid_square' };
    const candidates = legalMoves(this.state, from).filter((move) => move.to === to);
    if (!candidates.length) return { ok: false, reason: 'illegal_move' };
    const promotions = candidates.filter((move) => move.promotion);
    if (promotions.length && !promotion) return { ok: false, reason: 'promotion_required', choices: PROMOTIONS.slice() };
    const chosen = promotions.length ? promotions.find((move) => move.promotion === String(promotion).toLowerCase()) : candidates[0];
    if (!chosen) return { ok: false, reason: 'invalid_promotion', choices: PROMOTIONS.slice() };
    applyMoveToState(this.state, chosen, { record: true });
    this.recordPosition();
    return { ok: true, move: moveToPublic(chosen), status: this.status(), fen: this.fen() };
  }
  snapshot() {
    return {
      fen: this.fen(), turn: this.state.turn, castling: { ...this.state.castling },
      enPassant: this.state.enPassant == null ? null : indexToSquare(this.state.enPassant),
      halfmove: this.state.halfmove, fullmove: this.state.fullmove,
      lastMove: this.state.lastMove ? { ...this.state.lastMove, from: indexToSquare(this.state.lastMove.from), to: indexToSquare(this.state.lastMove.to) } : null,
      board: this.state.board.map(clonePiece), status: this.status()
    };
  }
}

export { COLORS, PIECES, PROMOTIONS, ClassicChessEngine, createInitialState, gameStatus, inCheck, indexToSquare, insufficientMaterial, isSquareAttacked, legalMoves, parseFEN, positionKey, squareToIndex, stateToFEN };
