import { ClassicChessEngine } from './classic-chess-engine.mjs';

const FILES = 'abcdefgh';
const PIECE_NAMES = Object.freeze({ p: 'Пешка', n: 'Конь', b: 'Слон', r: 'Ладья', q: 'Ферзь', k: 'Король' });
const PIECE_ASSETS = Object.freeze({ p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' });
const PROMOTION_LABELS = Object.freeze({ q: 'Ферзь', r: 'Ладья', b: 'Слон', n: 'Конь' });

const menu = document.querySelector('[data-reboot-foundation]');
const screen = document.querySelector('[data-classic-screen]');
const board = document.querySelector('[data-chess-board]');
const turnLabel = document.querySelector('[data-classic-turn]');
const stateLabel = document.querySelector('[data-classic-state]');
const summary = document.querySelector('[data-classic-summary]');
const historyRoot = document.querySelector('[data-move-history]');
const resultRoot = document.querySelector('[data-game-result]');
const resultTitle = document.querySelector('[data-result-title]');
const resultText = document.querySelector('[data-result-text]');
const promotionModal = document.querySelector('[data-promotion-modal]');
const promotionOptions = document.querySelector('[data-promotion-options]');

let engine = new ClassicChessEngine();
let selected = null;
let selectedMoves = [];
let moveLog = [];
let pendingPromotion = null;

function audio() { return globalThis.RPChessRebootAudio; }
function sideName(color) { return color === 'w' ? 'белых' : 'чёрных'; }
function sideNameTitle(color) { return color === 'w' ? 'Белые' : 'Чёрные'; }
function squareFromIndex(index) { return `${FILES[index % 8]}${Math.floor(index / 8) + 1}`; }
function indexFromSquare(square) { return (Number(square[1]) - 1) * 8 + FILES.indexOf(square[0]); }
function pieceAsset(piece) { return `generated_assets/unit_${PIECE_ASSETS[piece.type]}_${piece.color === 'w' ? 'player' : 'enemy'}.png`; }

function moveNotation(move, status) {
  if (move.castle === 'K') return `O-O${status.type === 'checkmate' ? '#' : status.checked ? '+' : ''}`;
  if (move.castle === 'Q') return `O-O-O${status.type === 'checkmate' ? '#' : status.checked ? '+' : ''}`;
  const symbol = move.piece === 'p' ? '' : ({ n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' }[move.piece]);
  const separator = move.capture ? '×' : '–';
  const promotion = move.promotion ? `=${move.promotion.toUpperCase()}` : '';
  const suffix = status.type === 'checkmate' ? '#' : status.checked ? '+' : '';
  return `${symbol}${move.from}${separator}${move.to}${promotion}${suffix}`;
}

function describeStatus(status) {
  switch (status.type) {
    case 'check': return { state: 'Шах', title: '', text: '' };
    case 'checkmate': return { state: `Мат — победа ${sideName(status.winner)}`, title: 'Мат', text: `${sideNameTitle(status.winner)} победили.` };
    case 'stalemate': return { state: 'Пат — ничья', title: 'Пат', text: 'Легальных ходов нет, шаха нет. Ничья.' };
    case 'draw_50_move': return { state: 'Ничья — правило 50 ходов', title: 'Ничья', text: 'Пятьдесят ходов прошли без хода пешкой и без взятия.' };
    case 'draw_threefold': return { state: 'Ничья — троекратное повторение', title: 'Ничья', text: 'Одна и та же позиция возникла трижды.' };
    case 'draw_insufficient': return { state: 'Ничья — недостаточно материала', title: 'Ничья', text: 'На доске недостаточно материала для мата.' };
    default: return { state: 'Партия продолжается', title: '', text: '' };
  }
}

function renderHistory() {
  historyRoot.replaceChildren();
  if (!moveLog.length) {
    const empty = document.createElement('div');
    empty.className = 'classic-empty';
    empty.textContent = 'Ходов пока нет';
    historyRoot.append(empty);
    return;
  }
  for (let index = 0; index < moveLog.length; index += 2) {
    const number = document.createElement('div');
    number.className = 'classic-move-number';
    number.textContent = `${Math.floor(index / 2) + 1}.`;
    historyRoot.append(number);
    for (let offset = 0; offset < 2; offset += 1) {
      const item = document.createElement('div');
      item.className = 'classic-move';
      item.textContent = moveLog[index + offset]?.notation || '…';
      historyRoot.append(item);
    }
  }
  historyRoot.scrollTop = historyRoot.scrollHeight;
}

function renderStatus() {
  const snapshot = engine.snapshot();
  const status = snapshot.status;
  const description = describeStatus(status);
  turnLabel.textContent = status.over ? 'Партия завершена' : `Ход ${sideName(snapshot.turn)}`;
  stateLabel.textContent = description.state;
  summary.innerHTML = status.over
    ? `<strong>${description.title}</strong><br>${description.text}`
    : status.checked
      ? `<strong>${sideNameTitle(snapshot.turn)}</strong> под шахом. Нужно защитить короля.`
      : `<strong>${sideNameTitle(snapshot.turn)}</strong> делают ход.`;

  if (status.over) {
    resultRoot.hidden = false;
    resultTitle.textContent = description.title;
    resultText.textContent = description.text;
  } else {
    resultRoot.hidden = true;
    resultTitle.textContent = '';
    resultText.textContent = '';
  }
}

function renderBoard() {
  const snapshot = engine.snapshot();
  const legalTargets = new Map();
  for (const move of selectedMoves) {
    if (!legalTargets.has(move.to)) legalTargets.set(move.to, move);
  }
  const checkedKing = snapshot.status.checked
    ? snapshot.board.findIndex((piece) => piece?.type === 'k' && piece.color === snapshot.turn)
    : -1;

  board.replaceChildren();
  for (let rank = 7; rank >= 0; rank -= 1) {
    for (let file = 0; file < 8; file += 1) {
      const index = rank * 8 + file;
      const square = squareFromIndex(index);
      const piece = snapshot.board[index];
      const targetMove = legalTargets.get(square);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `classic-square classic-square--${(file + rank) % 2 === 0 ? 'dark' : 'light'}`;
      button.dataset.square = square;
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-label', piece ? `${square}: ${PIECE_NAMES[piece.type]}, ${sideName(piece.color)}` : square);

      if (selected === square) button.classList.add('classic-square--selected');
      if (snapshot.lastMove && (snapshot.lastMove.from === square || snapshot.lastMove.to === square)) button.classList.add('classic-square--last');
      if (checkedKing === index) button.classList.add('classic-square--check');
      if (targetMove) button.classList.add(targetMove.capture ? 'classic-square--capture' : 'classic-square--legal');

      if (piece) {
        const image = document.createElement('img');
        image.className = 'classic-piece';
        image.src = pieceAsset(piece);
        image.alt = '';
        image.draggable = false;
        button.append(image);
      }

      if (rank === 0) {
        const fileLabel = document.createElement('span');
        fileLabel.className = 'classic-coordinate classic-coordinate--file';
        fileLabel.textContent = FILES[file];
        button.append(fileLabel);
      }
      if (file === 0) {
        const rankLabel = document.createElement('span');
        rankLabel.className = 'classic-coordinate classic-coordinate--rank';
        rankLabel.textContent = String(rank + 1);
        button.append(rankLabel);
      }

      button.addEventListener('click', () => handleSquare(square));
      board.append(button);
    }
  }
}

function render() {
  renderBoard();
  renderStatus();
  renderHistory();
}

function closePromotion() {
  promotionModal.hidden = true;
  document.body.classList.remove('reboot-modal-open');
  promotionOptions.replaceChildren();
}

function openPromotion(from, to, color, choices) {
  pendingPromotion = { from, to };
  promotionOptions.replaceChildren();
  for (const type of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'classic-promotion-option';
    button.dataset.promotion = type;
    const image = document.createElement('img');
    image.src = pieceAsset({ type, color });
    image.alt = '';
    const label = document.createElement('span');
    label.textContent = PROMOTION_LABELS[type];
    button.append(image, label);
    button.addEventListener('click', () => {
      const pending = pendingPromotion;
      pendingPromotion = null;
      closePromotion();
      if (pending) executeMove(pending.from, pending.to, type);
    });
    promotionOptions.append(button);
  }
  promotionModal.hidden = false;
  document.body.classList.add('reboot-modal-open');
  audio()?.open?.();
  promotionOptions.querySelector('button')?.focus();
}

function executeMove(from, to, promotion = null) {
  const moving = engine.pieceAt(from);
  const result = engine.move(from, to, promotion);
  if (!result.ok) {
    if (result.reason === 'promotion_required') {
      openPromotion(from, to, moving?.color || engine.turn(), result.choices);
      return false;
    }
    return false;
  }

  moveLog.push({ color: moving.color, notation: moveNotation(result.move, result.status), move: result.move });
  selected = null;
  selectedMoves = [];
  if (result.move.capture) audio()?.capture?.() || audio()?.tone?.(250, .08, 'triangle', .04);
  else audio()?.move?.() || audio()?.tone?.(430, .045, 'triangle', .025);
  if (result.status.checked) setTimeout(() => audio()?.check?.() || audio()?.tone?.(720, .09, 'square', .04), 45);
  render();
  return true;
}

function handleSquare(square) {
  if (pendingPromotion || engine.status().over) return;
  const piece = engine.pieceAt(square);
  const turn = engine.turn();

  if (!selected) {
    if (piece?.color !== turn) return;
    selected = square;
    selectedMoves = engine.legalMoves(square);
    audio()?.click?.();
    renderBoard();
    return;
  }

  if (square === selected) {
    selected = null;
    selectedMoves = [];
    renderBoard();
    return;
  }

  if (piece?.color === turn) {
    selected = square;
    selectedMoves = engine.legalMoves(square);
    audio()?.click?.();
    renderBoard();
    return;
  }

  const candidates = selectedMoves.filter((move) => move.to === square);
  if (!candidates.length) return;
  executeMove(selected, square);
}

function showGame() {
  menu.hidden = true;
  screen.hidden = false;
  document.body.classList.add('classic-chess-active');
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function showMenu() {
  closePromotion();
  pendingPromotion = null;
  selected = null;
  selectedMoves = [];
  screen.hidden = true;
  menu.hidden = false;
  document.body.classList.remove('classic-chess-active');
  window.scrollTo({ top: 0, behavior: 'auto' });
  audio()?.click?.();
}

function newGame(fen = null) {
  engine = new ClassicChessEngine(fen);
  selected = null;
  selectedMoves = [];
  moveLog = [];
  pendingPromotion = null;
  closePromotion();
  showGame();
  render();
}

window.addEventListener('rpchess:new-game', () => newGame());
document.querySelector('[data-classic-new]')?.addEventListener('click', () => { audio()?.click?.(); newGame(); });
document.querySelector('[data-classic-menu]')?.addEventListener('click', showMenu);
document.querySelector('[data-result-rematch]')?.addEventListener('click', () => { audio()?.click?.(); newGame(); });
document.querySelector('[data-result-menu]')?.addEventListener('click', showMenu);

render();

globalThis.RPChessClassicChess = {
  get engine() { return engine; },
  get moveLog() { return moveLog.map((entry) => ({ ...entry })); },
  newGame,
  loadFen(fen) { newGame(fen); return engine.snapshot(); },
  move(from, to, promotion = null) {
    const ok = executeMove(from, to, promotion);
    return { ok, snapshot: engine.snapshot() };
  },
  showMenu,
  snapshot() { return engine.snapshot(); }
};
