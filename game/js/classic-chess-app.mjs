import { ClassicChessEngine } from './classic-chess-engine.mjs';
import { ChessAIAdapter, ELO_LEVELS, profileForElo } from './chess-ai-adapter.mjs';

const FILES = 'abcdefgh';
const PIECE_NAMES = Object.freeze({ p: 'Пешка', n: 'Конь', b: 'Слон', r: 'Ладья', q: 'Ферзь', k: 'Король' });
const PIECE_ASSETS = Object.freeze({ p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' });
const PIECE_LETTERS = Object.freeze({ n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' });
const PIECE_VALUES = Object.freeze({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 });
const PIECE_GLYPHS = Object.freeze({
  w: Object.freeze({ p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' }),
  b: Object.freeze({ p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' })
});
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
const setupModal = document.querySelector('[data-game-setup-modal]');
const modeSelect = document.querySelector('[data-game-mode-select]');
const eloSelect = document.querySelector('[data-ai-elo]');
const colorSelect = document.querySelector('[data-player-color]');
const eloField = document.querySelector('[data-ai-elo-field]');
const colorField = document.querySelector('[data-player-color-field]');
const startGameButton = document.querySelector('[data-start-game]');
const modeLabel = document.querySelector('[data-game-mode]');
const thinkingLabel = document.querySelector('[data-ai-thinking]');
const capturedByWhiteRoot = document.querySelector('[data-captured-by-white]');
const capturedByBlackRoot = document.querySelector('[data-captured-by-black]');
const materialWhiteRoot = document.querySelector('[data-material-white]');
const materialBlackRoot = document.querySelector('[data-material-black]');

let engine = new ClassicChessEngine();
let selected = null;
let selectedMoves = [];
let moveLog = [];
let pendingPromotion = null;
let aiThinking = false;
let visualAnimating = false;
let gameGeneration = 0;
let gameConfig = { mode: 'local', playerColor: 'w', aiColor: null, aiElo: 800 };
let aiAdapter = new ChessAIAdapter();

function audio() { return globalThis.RPChessRebootAudio; }
function sideName(color) { return color === 'w' ? 'белых' : 'чёрных'; }
function sideNameTitle(color) { return color === 'w' ? 'Белые' : 'Чёрные'; }
function opposite(color) { return color === 'w' ? 'b' : 'w'; }
function squareFromIndex(index) { return `${FILES[index % 8]}${Math.floor(index / 8) + 1}`; }
function pieceAsset(piece) { return `generated_assets/unit_${PIECE_ASSETS[piece.type]}_${piece.color === 'w' ? 'player' : 'enemy'}.png`; }
function uciParts(uci) { return { from: uci?.slice(0, 2), to: uci?.slice(2, 4), promotion: uci?.slice(4, 5) || null }; }
function prefersReducedMotion() { return document.documentElement.dataset.reducedMotion === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches; }

function sanNotation({ moving, from, to, promotion, resultMove, status, legalBefore }) {
  const suffix = status.type === 'checkmate' ? '#' : status.checked ? '+' : '';
  if (resultMove.castle === 'K') return `O-O${suffix}`;
  if (resultMove.castle === 'Q') return `O-O-O${suffix}`;

  const capture = resultMove.capture != null;
  let prefix = '';
  if (moving.type === 'p') {
    if (capture) prefix = from[0];
  } else {
    prefix = PIECE_LETTERS[moving.type] || '';
    const alternatives = legalBefore.filter((candidate) => {
      if (candidate.to !== to || candidate.from === from) return false;
      const candidatePiece = engine.pieceAt(candidate.from);
      return candidatePiece?.color === moving.color && candidatePiece.type === moving.type;
    });
    if (alternatives.length) {
      const sameFile = alternatives.some((candidate) => candidate.from[0] === from[0]);
      const sameRank = alternatives.some((candidate) => candidate.from[1] === from[1]);
      if (!sameFile) prefix += from[0];
      else if (!sameRank) prefix += from[1];
      else prefix += from;
    }
  }

  const promotionSuffix = promotion ? `=${String(promotion).toUpperCase()}` : '';
  return `${prefix}${capture ? 'x' : ''}${to}${promotionSuffix}${suffix}`;
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

function appendFigurineSAN(root, entry) {
  if (!entry) {
    root.textContent = '…';
    return;
  }
  root.dataset.san = entry.san;
  root.setAttribute('aria-label', entry.san);
  const first = entry.san[0];
  const type = ({ N: 'n', B: 'b', R: 'r', Q: 'q', K: 'k' })[first];
  if (!type) {
    root.textContent = entry.san;
    return;
  }
  const glyph = document.createElement('span');
  glyph.className = `classic-san-figurine classic-san-figurine--${entry.color}`;
  glyph.textContent = PIECE_GLYPHS[entry.color][type];
  glyph.setAttribute('aria-hidden', 'true');
  const rest = document.createElement('span');
  rest.textContent = entry.san.slice(1);
  root.append(glyph, rest);
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
      appendFigurineSAN(item, moveLog[index + offset]);
      historyRoot.append(item);
    }
  }
  historyRoot.scrollTop = historyRoot.scrollHeight;
}

function renderCapturedRow(root, entries) {
  if (!root) return;
  root.replaceChildren();
  const ordered = entries.slice().sort((a, b) => PIECE_VALUES[b.type] - PIECE_VALUES[a.type]);
  for (const piece of ordered) {
    const icon = document.createElement('span');
    icon.className = `classic-captured-piece classic-captured-piece--${piece.color}`;
    icon.textContent = PIECE_GLYPHS[piece.color][piece.type];
    icon.title = PIECE_NAMES[piece.type];
    root.append(icon);
  }
  if (!ordered.length) {
    const empty = document.createElement('span');
    empty.className = 'classic-captured-empty';
    empty.textContent = '—';
    root.append(empty);
  }
}

function renderMaterial() {
  const whiteCaptured = moveLog.filter((entry) => entry.color === 'w' && entry.captured).map((entry) => entry.captured);
  const blackCaptured = moveLog.filter((entry) => entry.color === 'b' && entry.captured).map((entry) => entry.captured);
  renderCapturedRow(capturedByWhiteRoot, whiteCaptured);
  renderCapturedRow(capturedByBlackRoot, blackCaptured);

  const snapshot = engine.snapshot();
  const totals = { w: 0, b: 0 };
  for (const piece of snapshot.board) if (piece) totals[piece.color] += PIECE_VALUES[piece.type] || 0;
  const advantage = totals.w - totals.b;
  if (materialWhiteRoot) materialWhiteRoot.textContent = advantage > 0 ? `+${advantage}` : '';
  if (materialBlackRoot) materialBlackRoot.textContent = advantage < 0 ? `+${Math.abs(advantage)}` : '';
}

function renderMode() {
  if (gameConfig.mode !== 'ai') {
    modeLabel.textContent = 'Локальная партия · два игрока';
    return;
  }
  const profile = profileForElo(gameConfig.aiElo);
  const degraded = aiAdapter.snapshot().degraded ? ' · резервный ход' : '';
  modeLabel.textContent = `Stockfish 18 lite · ${profile.label} · ≈${profile.elo} Elo${degraded}`;
}

function renderStatus() {
  const snapshot = engine.snapshot();
  const status = snapshot.status;
  const description = describeStatus(status);
  turnLabel.textContent = status.over ? 'Партия завершена' : `Ход ${sideName(snapshot.turn)}`;
  stateLabel.textContent = aiThinking ? 'Компьютер думает…' : visualAnimating ? 'Ход выполняется' : description.state;
  summary.innerHTML = status.over
    ? description.text
    : aiThinking
      ? `<strong>${sideNameTitle(snapshot.turn)}</strong> выбирают ход.`
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
  renderMode();
}

function isBlackView() {
  return gameConfig.mode === 'ai' && gameConfig.playerColor === 'b';
}

function renderBoard() {
  const snapshot = engine.snapshot();
  const legalTargets = new Map();
  for (const move of selectedMoves) if (!legalTargets.has(move.to)) legalTargets.set(move.to, move);
  const checkedKing = snapshot.status.checked
    ? snapshot.board.findIndex((piece) => piece?.type === 'k' && piece.color === snapshot.turn)
    : -1;
  const reverse = isBlackView();
  const ranks = reverse ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const files = reverse ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  board.replaceChildren();
  for (let rankPosition = 0; rankPosition < 8; rankPosition += 1) {
    const rank = ranks[rankPosition];
    for (let filePosition = 0; filePosition < 8; filePosition += 1) {
      const file = files[filePosition];
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
        const marker = document.createElement('span');
        marker.className = `classic-piece-marker classic-piece-marker--${piece.color}`;
        marker.dataset.pieceMarker = piece.type;
        marker.textContent = PIECE_GLYPHS[piece.color][piece.type];
        marker.title = PIECE_NAMES[piece.type];
        marker.setAttribute('aria-hidden', 'true');
        button.append(image, marker);
      }

      if (rankPosition === 7) {
        const fileLabel = document.createElement('span');
        fileLabel.className = 'classic-coordinate classic-coordinate--file';
        fileLabel.textContent = FILES[file];
        button.append(fileLabel);
      }
      if (filePosition === 0) {
        const rankLabel = document.createElement('span');
        rankLabel.className = 'classic-coordinate classic-coordinate--rank';
        rankLabel.textContent = String(rank + 1);
        button.append(rankLabel);
      }

      button.addEventListener('click', () => handleSquare(square));
      board.append(button);
    }
  }
  board.classList.toggle('is-locked', aiThinking || visualAnimating || (gameConfig.mode === 'ai' && engine.turn() !== gameConfig.playerColor));
  thinkingLabel.hidden = !aiThinking;
}

function render() {
  renderBoard();
  renderStatus();
  renderHistory();
  renderMaterial();
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

function setThinking(value) {
  aiThinking = Boolean(value);
  renderBoard();
  renderStatus();
}

function captureAnimationGeometry(from, to, moving, capturedPiece) {
  if (prefersReducedMotion()) return null;
  const sourceImage = board.querySelector(`[data-square="${from}"] .classic-piece`);
  const targetImage = board.querySelector(`[data-square="${to}"] .classic-piece`);
  if (!sourceImage) return null;
  return {
    source: sourceImage.getBoundingClientRect(),
    target: board.querySelector(`[data-square="${to}"]`)?.getBoundingClientRect() || null,
    moving: { ...moving },
    capturedPiece: capturedPiece ? { ...capturedPiece } : null,
    capturedRect: targetImage?.getBoundingClientRect() || null
  };
}

function animateCommittedMove(geometry, to, onDone) {
  if (!geometry?.source || !geometry?.target || typeof Element.prototype.animate !== 'function') {
    visualAnimating = false;
    renderBoard();
    renderStatus();
    onDone?.();
    return;
  }

  const destinationImage = board.querySelector(`[data-square="${to}"] .classic-piece`);
  destinationImage?.classList.add('classic-piece--arriving');
  const flyer = document.createElement('img');
  flyer.className = 'classic-piece-flyer';
  flyer.src = pieceAsset(geometry.moving);
  flyer.alt = '';
  flyer.style.left = `${geometry.source.left}px`;
  flyer.style.top = `${geometry.source.top}px`;
  flyer.style.width = `${geometry.source.width}px`;
  flyer.style.height = `${geometry.source.height}px`;
  document.body.append(flyer);

  let capturedGhost = null;
  if (geometry.capturedPiece && geometry.capturedRect) {
    capturedGhost = document.createElement('img');
    capturedGhost.className = 'classic-captured-ghost';
    capturedGhost.src = pieceAsset(geometry.capturedPiece);
    capturedGhost.alt = '';
    capturedGhost.style.left = `${geometry.capturedRect.left}px`;
    capturedGhost.style.top = `${geometry.capturedRect.top}px`;
    capturedGhost.style.width = `${geometry.capturedRect.width}px`;
    capturedGhost.style.height = `${geometry.capturedRect.height}px`;
    document.body.append(capturedGhost);
    capturedGhost.animate([
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(.72)' }
    ], { duration: 190, easing: 'ease-out', fill: 'forwards' });
  }

  const targetImage = destinationImage?.getBoundingClientRect();
  const targetLeft = targetImage ? targetImage.left : geometry.target.left + (geometry.target.width - geometry.source.width) / 2;
  const targetTop = targetImage ? targetImage.top : geometry.target.top + (geometry.target.height - geometry.source.height) / 2;
  const dx = targetLeft - geometry.source.left;
  const dy = targetTop - geometry.source.top;
  const animation = flyer.animate([
    { transform: 'translate3d(0,0,0) scale(1)', filter: 'drop-shadow(0 5px 5px rgba(0,0,0,.6))' },
    { transform: `translate3d(${dx}px,${dy}px,0) scale(1.025)`, filter: 'drop-shadow(0 10px 8px rgba(0,0,0,.72))' }
  ], { duration: 230, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'forwards' });

  animation.finished.catch(() => {}).finally(() => {
    flyer.remove();
    capturedGhost?.remove();
    destinationImage?.classList.remove('classic-piece--arriving');
    visualAnimating = false;
    renderBoard();
    renderStatus();
    onDone?.();
  });
}

function executeMove(from, to, promotion = null, { triggerAI = true } = {}) {
  const moving = engine.pieceAt(from);
  if (!moving) return false;
  const legalBefore = engine.legalMoves();
  const candidate = legalBefore.find((move) => move.from === from && move.to === to && (!move.promotion || move.promotion === promotion));
  const capturedPiece = candidate?.capture ? engine.pieceAt(candidate.capture) : engine.pieceAt(to);
  const geometry = candidate ? captureAnimationGeometry(from, to, moving, capturedPiece) : null;
  const result = engine.move(from, to, promotion);
  if (!result.ok) {
    if (result.reason === 'promotion_required') {
      openPromotion(from, to, moving?.color || engine.turn(), result.choices);
      return false;
    }
    return false;
  }

  const san = sanNotation({ moving, from, to, promotion: result.move.promotion, resultMove: result.move, status: result.status, legalBefore });
  moveLog.push({ color: moving.color, san, notation: san, move: result.move, captured: capturedPiece });
  selected = null;
  selectedMoves = [];
  if (result.move.capture) audio()?.capture?.() || audio()?.tone?.(250, .08, 'triangle', .04);
  else audio()?.move?.() || audio()?.tone?.(430, .045, 'triangle', .025);
  if (result.status.checked) setTimeout(() => audio()?.check?.() || audio()?.tone?.(720, .09, 'square', .04), 45);

  visualAnimating = Boolean(geometry);
  render();
  const afterVisual = () => { if (triggerAI) void maybeScheduleAI(); };
  if (geometry) animateCommittedMove(geometry, to, afterVisual);
  else {
    visualAnimating = false;
    renderBoard();
    afterVisual();
  }
  return true;
}

function handleSquare(square) {
  if (pendingPromotion || aiThinking || visualAnimating || engine.status().over) return;
  if (gameConfig.mode === 'ai' && engine.turn() !== gameConfig.playerColor) return;
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

async function maybeScheduleAI() {
  if (gameConfig.mode !== 'ai' || engine.status().over || engine.turn() !== gameConfig.aiColor) return;
  const generation = gameGeneration;
  const fen = engine.fen();
  const legalMoves = engine.legalMoves();
  setThinking(true);
  const started = performance.now();
  const uci = await aiAdapter.chooseMove({ fen, elo: gameConfig.aiElo, legalMoves });
  const remainingDelay = Math.max(0, 180 - (performance.now() - started));
  if (remainingDelay) await new Promise((resolve) => setTimeout(resolve, remainingDelay));
  if (generation !== gameGeneration || gameConfig.mode !== 'ai' || engine.turn() !== gameConfig.aiColor) return;
  setThinking(false);
  if (!uci) return;
  const { from, to, promotion } = uciParts(uci);
  executeMove(from, to, promotion, { triggerAI: false });
}

function showGame() {
  menu.hidden = true;
  screen.hidden = false;
  document.body.classList.add('classic-chess-active');
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function cancelAI() {
  gameGeneration += 1;
  aiAdapter.stop();
  aiThinking = false;
  visualAnimating = false;
  document.querySelectorAll('.classic-piece-flyer,.classic-captured-ghost').forEach((node) => node.remove());
}

function showMenu() {
  cancelAI();
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

function normalizeConfig(options = {}) {
  if (options.mode !== 'ai') return { mode: 'local', playerColor: 'w', aiColor: null, aiElo: 800 };
  const playerColor = options.playerColor === 'b' ? 'b' : 'w';
  return { mode: 'ai', playerColor, aiColor: opposite(playerColor), aiElo: profileForElo(options.aiElo).elo };
}

function newGame(fen = null, options = {}) {
  cancelAI();
  gameConfig = normalizeConfig(options);
  engine = new ClassicChessEngine(fen);
  selected = null;
  selectedMoves = [];
  moveLog = [];
  pendingPromotion = null;
  closePromotion();
  showGame();
  render();
  void maybeScheduleAI();
  return engine.snapshot();
}

function syncSetupFields() {
  const aiMode = modeSelect.value === 'ai';
  eloField.hidden = !aiMode;
  colorField.hidden = !aiMode;
}

function openGameSetup() {
  modeSelect.value = gameConfig.mode === 'ai' ? 'ai' : 'local';
  eloSelect.value = String(gameConfig.aiElo || 800);
  colorSelect.value = gameConfig.mode === 'ai' ? gameConfig.playerColor : 'w';
  syncSetupFields();
  setupModal.hidden = false;
  document.body.classList.add('reboot-modal-open');
  audio()?.open?.();
  modeSelect.focus();
}

function closeGameSetup() {
  setupModal.hidden = true;
  document.body.classList.remove('reboot-modal-open');
}

function startConfiguredGame() {
  const mode = modeSelect.value;
  let playerColor = colorSelect.value;
  if (playerColor === 'random') playerColor = Math.random() < .5 ? 'w' : 'b';
  const options = mode === 'ai'
    ? { mode: 'ai', playerColor, aiElo: Number(eloSelect.value) }
    : { mode: 'local' };
  closeGameSetup();
  audio()?.click?.();
  newGame(null, options);
}

modeSelect?.addEventListener('change', () => { audio()?.click?.(); syncSetupFields(); });
startGameButton?.addEventListener('click', startConfiguredGame);
window.addEventListener('rpchess:new-game', openGameSetup);
document.querySelector('[data-classic-new]')?.addEventListener('click', () => { audio()?.click?.(); openGameSetup(); });
document.querySelector('[data-classic-menu]')?.addEventListener('click', showMenu);
document.querySelector('[data-result-rematch]')?.addEventListener('click', () => { audio()?.click?.(); openGameSetup(); });
document.querySelector('[data-result-menu]')?.addEventListener('click', showMenu);

render();

globalThis.RPChessChessAI = {
  ELO_LEVELS,
  get config() { return { ...gameConfig }; },
  get thinking() { return aiThinking; },
  get adapter() { return aiAdapter; },
  snapshot() { return { ...aiAdapter.snapshot(), config: { ...gameConfig }, thinking: aiThinking, animating: visualAnimating }; },
  replaceAdapter(adapter) { aiAdapter.destroy(); aiAdapter = adapter; return aiAdapter; }
};

globalThis.RPChessClassicChess = {
  get engine() { return engine; },
  get moveLog() { return moveLog.map((entry) => ({ ...entry })); },
  newGame,
  openGameSetup,
  loadFen(fen, options = {}) { newGame(fen, options); return engine.snapshot(); },
  move(from, to, promotion = null) {
    const ok = executeMove(from, to, promotion);
    return { ok, snapshot: engine.snapshot() };
  },
  showMenu,
  snapshot() { return engine.snapshot(); }
};

addEventListener('beforeunload', () => aiAdapter.destroy(), { once: true });