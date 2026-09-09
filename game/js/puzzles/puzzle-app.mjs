import { ClassicChessEngine } from '../classic-chess-engine.mjs';
import { readRun, writeRun } from '../run-persistence.mjs';
import { t, subscribe } from '../i18n.mjs';
import { PUZZLE_CATALOG } from './puzzle-catalog.mjs';
import {
  createPuzzleState,
  puzzleBaseGold,
  puzzleGoldReward,
  selectPuzzle,
  uciParts,
  resolvedPuzzleState
} from './puzzle-core.mjs';
import { starsText } from '../encounter-difficulty.mjs';

const FILES = 'abcdefgh';
const PIECE_ASSETS = Object.freeze({ p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king' });
const PIECE_KEYS = Object.freeze({ p:'piece.pawn', n:'piece.knight', b:'piece.bishop', r:'piece.rook', q:'piece.queen', k:'piece.king' });
const PIECE_GLYPHS = Object.freeze({
  w:Object.freeze({ p:'♙', n:'♘', b:'♗', r:'♖', q:'♕', k:'♔' }),
  b:Object.freeze({ p:'♟', n:'♞', b:'♝', r:'♜', q:'♛', k:'♚' })
});
const PROMOTION_KEYS = Object.freeze({ q:'piece.queen', r:'piece.rook', b:'piece.bishop', n:'piece.knight' });

let screen = null;
let activeRun = null;
let puzzle = null;
let state = null;
let engine = null;
let selected = null;
let selectedMoves = [];
let locked = false;
let promotionResolve = null;

function audio() { return globalThis.RPChessRebootAudio; }
function pieceAsset(piece) { return `generated_assets/unit_${PIECE_ASSETS[piece.type]}_${piece.color === 'w' ? 'player' : 'enemy'}.png`; }
function pieceLabel(type) { return t(PIECE_KEYS[type] || 'piece.pawn'); }
function squareFromIndex(index) { return `${FILES[index % 8]}${Math.floor(index / 8) + 1}`; }
function reducedMotion() { return document.documentElement.dataset.reducedMotion === '1'; }
function replyDelay() { return reducedMotion() ? 0 : 320; }

function ensureStylesheet(marker, href) {
  if (document.querySelector(`[${marker}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute(marker, '');
  document.head.append(link);
}

function ensureCss() {
  ensureStylesheet('data-puzzles-css', 'css/puzzles.css?v=20260909-owner2');
  ensureStylesheet('data-puzzles-compact-css', 'css/puzzles-compact.css?v=20260909-owner1');
}

function ensureScreen() {
  if (screen) return screen;
  ensureCss();
  const app = document.querySelector('#app');
  if (!app) return null;
  screen = document.createElement('main');
  screen.className = 'puzzle-screen';
  screen.dataset.puzzleScreen = '';
  screen.hidden = true;
  screen.setAttribute('aria-label', t('puzzle.ariaLabel'));
  screen.innerHTML = `
    <div class="puzzle-shell">
      <header class="puzzle-topbar">
        <img class="puzzle-logo" src="generated_assets/title_wordmark.png" alt="RPChess">
        <div class="puzzle-topbar__actions">
          <button class="reboot-button reboot-button--primary" type="button" data-puzzle-settings>${t('puzzle.settings')}</button>
        </div>
      </header>
      <header class="puzzle-heading">
        <div>
          <div class="reboot-eyebrow" data-puzzle-kicker>${t('puzzle.kicker')}</div>
          <h1 data-puzzle-objective>${t('puzzle.objective.mate1')}</h1>
        </div>
        <div class="puzzle-difficulty">
          <strong data-puzzle-stars>★</strong>
          <span data-puzzle-difficulty-label>${t('puzzle.difficulty')}</span>
        </div>
      </header>
      <div class="puzzle-layout">
        <section class="puzzle-panel">
          <div class="puzzle-polish-objective" data-puzzle-compact-objective aria-hidden="true">
            <strong data-puzzle-compact-objective-label>${t('puzzle.objective.mate1')}</strong>
            <span data-puzzle-compact-stars>★</span>
          </div>
          <h2 data-puzzle-condition>${t('puzzle.condition')}</h2>
          <p data-puzzle-instruction>${t('puzzle.instruction.mate1')}</p>
          <div class="puzzle-attempts" data-puzzle-attempts aria-label="${t('puzzle.attemptsAria')}"></div>
          <div class="puzzle-reward">
            <span data-puzzle-reward-perfect>${t('puzzle.rewardPerfect')}</span>
            <strong data-puzzle-base-reward>12 Gold</strong>
            <p data-puzzle-current-reward>${t('puzzle.rewardCurrent',{reward:12})}</p>
          </div>
          <div class="puzzle-polish-reward" data-puzzle-compact-reward aria-hidden="true">
            <img src="generated_assets/reward_gold.png" alt="">
            <strong data-puzzle-compact-reward-value>12</strong>
          </div>
          <p class="puzzle-source" data-puzzle-source>${t('puzzle.source')}</p>
        </section>
        <section class="puzzle-board-wrap">
          <div class="puzzle-board" data-puzzle-board role="grid" aria-label="${t('puzzle.boardAria')}"></div>
          <div class="puzzle-status" data-puzzle-status role="status" aria-live="polite"></div>
          <div class="puzzle-promotion" data-puzzle-promotion hidden>
            <div class="puzzle-promotion__panel" data-puzzle-promotion-options></div>
          </div>
        </section>
        <section class="puzzle-panel puzzle-outcome" data-puzzle-outcome hidden>
          <h2 data-puzzle-outcome-title>${t('puzzle.outcome.solved')}</h2>
          <p data-puzzle-outcome-text></p>
          <div class="puzzle-outcome__gold" data-puzzle-outcome-gold></div>
          <button class="reboot-button reboot-button--primary puzzle-continue" type="button" data-puzzle-continue>${t('puzzle.continue')}</button>
        </section>
      </div>
    </div>`;
  app.append(screen);
  screen.querySelector('[data-puzzle-settings]')?.addEventListener('click', () => globalThis.RPChessOpenSettings?.());
  screen.querySelector('[data-puzzle-continue]')?.addEventListener('click', continueTravel);
  return screen;
}

function renderStaticCopy() {
  if (!screen) return;
  screen.setAttribute('aria-label', t('puzzle.ariaLabel'));
  const values = [
    ['[data-puzzle-settings]','puzzle.settings'],
    ['[data-puzzle-kicker]','puzzle.kicker'],
    ['[data-puzzle-difficulty-label]','puzzle.difficulty'],
    ['[data-puzzle-condition]','puzzle.condition'],
    ['[data-puzzle-reward-perfect]','puzzle.rewardPerfect'],
    ['[data-puzzle-source]','puzzle.source'],
    ['[data-puzzle-continue]','puzzle.continue']
  ];
  for (const [selector,key] of values) {
    const node = screen.querySelector(selector);
    if (node) node.textContent = t(key);
  }
  screen.querySelector('[data-puzzle-attempts]')?.setAttribute('aria-label', t('puzzle.attemptsAria'));
  screen.querySelector('[data-puzzle-board]')?.setAttribute('aria-label', t('puzzle.boardAria'));
}

function hideAllScenes() {
  for (const main of document.querySelectorAll('#app > main')) main.hidden = true;
  document.body.classList.remove('roster-active', 'skirmish-active', 'battle-active', 'classic-chess-active', 'settlement-active', 'starvation-active', 'events-active', 'travel-choice-active', 'puzzles-active');
}

function showPuzzle() {
  const root = ensureScreen();
  if (!root) return;
  hideAllScenes();
  root.hidden = false;
  document.body.classList.add('puzzles-active');
  window.scrollTo({ top: 0, behavior: 'auto' });
  globalThis.RPChessResources?.render?.();
}

function hidePuzzle() {
  if (screen) screen.hidden = true;
  document.body.classList.remove('puzzles-active');
}

function findPuzzle(id) { return PUZZLE_CATALOG.find((item) => item.id === id) || null; }
function puzzleHistory(run) { return Array.isArray(run?.puzzleHistory) ? run.puzzleHistory.filter((id) => Boolean(findPuzzle(id))) : []; }

function persist(nextState = state) {
  state = nextState;
  activeRun = writeRun({ ...activeRun, currentPuzzle: state });
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  return state;
}

function objectiveText(item) {
  if (!item) return t('puzzle.objective.fallback');
  if (item.type === 'material') {
    const target = ['queen','rook','bishop','knight'].includes(item.targetPiece) ? item.targetPiece : null;
    return target ? t(`puzzle.objective.material.${target}`) : t('puzzle.objective.fallback');
  }
  return ['mate1','mate2','mate3'].includes(item.type) ? t(`puzzle.objective.${item.type}`) : t('puzzle.objective.fallback');
}

function instructionText(item) {
  if (item?.type === 'material') return t('puzzle.instruction.material');
  return ['mate1','mate2','mate3'].includes(item?.type) ? t(`puzzle.instruction.${item.type}`) : t('puzzle.instruction.mate1');
}

function renderMeta() {
  const objective = objectiveText(puzzle);
  const stars = starsText(state.stars);
  const baseReward = puzzleBaseGold(state.stars);
  const currentReward = puzzleGoldReward(state.stars, state.errors);
  renderStaticCopy();
  screen.querySelector('[data-puzzle-objective]').textContent = objective;
  screen.querySelector('[data-puzzle-stars]').textContent = stars;
  screen.querySelector('[data-puzzle-compact-objective-label]').textContent = objective;
  screen.querySelector('[data-puzzle-compact-stars]').textContent = stars;
  screen.querySelector('[data-puzzle-instruction]').textContent = instructionText(puzzle);
  screen.querySelector('[data-puzzle-base-reward]').textContent = `${baseReward} Gold`;
  screen.querySelector('[data-puzzle-current-reward]').textContent = t('puzzle.rewardCurrent',{reward:currentReward});
  screen.querySelector('[data-puzzle-compact-reward-value]').textContent = String(currentReward);

  const attempts = screen.querySelector('[data-puzzle-attempts]');
  attempts.replaceChildren();
  for (let index = 0; index < 3; index += 1) {
    const mark = document.createElement('span');
    mark.className = 'puzzle-attempt';
    if (index < state.errors) mark.classList.add('is-spent');
    attempts.append(mark);
  }

  const outcome = screen.querySelector('[data-puzzle-outcome]');
  outcome.hidden = !state.resolved;
  if (!state.resolved) return;
  screen.querySelector('[data-puzzle-outcome-title]').textContent = t(state.result === 'solved' ? 'puzzle.outcome.solved' : 'puzzle.outcome.failed');
  screen.querySelector('[data-puzzle-outcome-text]').textContent = state.result === 'solved'
    ? t('puzzle.outcome.solvedText',{errors:state.errors})
    : t('puzzle.outcome.failedText');
  screen.querySelector('[data-puzzle-outcome-gold]').textContent = state.goldReward > 0 ? `+${state.goldReward} Gold` : '0 Gold';
}

function renderBoard() {
  const board = screen.querySelector('[data-puzzle-board]');
  const snapshot = engine.snapshot();
  const targets = new Map(selectedMoves.map((move) => [move.to, move]));
  const reverse = puzzle.side === 'b';
  const ranks = reverse ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const files = reverse ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  board.replaceChildren();

  for (let rankPosition = 0; rankPosition < 8; rankPosition += 1) {
    const rank = ranks[rankPosition];
    for (let filePosition = 0; filePosition < 8; filePosition += 1) {
      const file = files[filePosition];
      const index = rank * 8 + file;
      const square = squareFromIndex(index);
      const piece = snapshot.board[index];
      const target = targets.get(square);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `puzzle-square puzzle-square--${(file + rank) % 2 === 0 ? 'dark' : 'light'}`;
      button.dataset.square = square;
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-label', piece ? `${square}: ${pieceLabel(piece.type)}` : square);
      if (selected === square) button.classList.add('is-selected');
      if (target) button.classList.add(target.capture ? 'is-capture' : 'is-legal');
      if (piece) {
        const image = document.createElement('img');
        image.className = 'puzzle-piece';
        image.src = pieceAsset(piece);
        image.alt = '';
        image.draggable = false;
        const marker = document.createElement('span');
        marker.className = `puzzle-piece-marker puzzle-piece-marker--${piece.color}`;
        marker.dataset.puzzlePieceMarker = piece.type;
        marker.textContent = PIECE_GLYPHS[piece.color][piece.type];
        marker.title = pieceLabel(piece.type);
        marker.setAttribute('aria-hidden', 'true');
        button.append(image, marker);
      }
      if (rankPosition === 7) {
        const fileLabel = document.createElement('span');
        fileLabel.className = 'puzzle-coordinate puzzle-coordinate--file';
        fileLabel.textContent = FILES[file];
        fileLabel.setAttribute('aria-hidden', 'true');
        button.append(fileLabel);
      }
      if (filePosition === 0) {
        const rankLabel = document.createElement('span');
        rankLabel.className = 'puzzle-coordinate puzzle-coordinate--rank';
        rankLabel.textContent = String(rank + 1);
        rankLabel.setAttribute('aria-hidden', 'true');
        button.append(rankLabel);
      }
      button.addEventListener('click', () => clickSquare(square));
      board.append(button);
    }
  }
}

function status(text = '', kind = '') {
  const root = screen.querySelector('[data-puzzle-status]');
  root.textContent = text;
  root.className = 'puzzle-status';
  if (kind) root.classList.add(`is-${kind}`);
}

function choosePromotion(choices) {
  return new Promise((resolve) => {
    const root = screen.querySelector('[data-puzzle-promotion]');
    const options = screen.querySelector('[data-puzzle-promotion-options]');
    options.replaceChildren();
    promotionResolve = resolve;
    for (const value of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = t(PROMOTION_KEYS[value] || 'piece.queen');
      button.addEventListener('click', () => {
        root.hidden = true;
        promotionResolve = null;
        resolve(value);
      }, { once: true });
      options.append(button);
    }
    root.hidden = false;
  });
}

function expectedMove() { return uciParts(puzzle.solution[state.solutionIndex]); }

async function validateCandidate(from, to, promotion) {
  const move = `${from}${to}${promotion || ''}`.toLowerCase();
  if (puzzle.type === 'mate1') {
    const test = new ClassicChessEngine(engine.fen());
    const result = test.move(from, to, promotion);
    return Boolean(result.ok && result.status.type === 'checkmate' && result.status.winner === puzzle.side);
  }
  return move === expectedMove()?.uci;
}

async function clickSquare(square) {
  if (locked || state.resolved || engine.turn() !== puzzle.side) return;
  const piece = engine.pieceAt(square);
  if (!selected) {
    if (piece?.color === puzzle.side) {
      selected = square;
      selectedMoves = engine.legalMoves(square);
      renderBoard();
    }
    return;
  }
  if (piece?.color === puzzle.side) {
    selected = square;
    selectedMoves = engine.legalMoves(square);
    renderBoard();
    return;
  }
  const candidate = selectedMoves.find((move) => move.to === square);
  if (!candidate) {
    selected = null;
    selectedMoves = [];
    renderBoard();
    return;
  }

  let promotion = null;
  const promotions = engine.promotionChoices(selected, square);
  if (promotions.length) promotion = await choosePromotion(promotions);
  const from = selected;
  selected = null;
  selectedMoves = [];
  if (!await validateCandidate(from, square, promotion)) {
    wrongMove();
    return;
  }
  await correctMove(from, square, promotion);
}

function wrongMove() {
  audio()?.close?.();
  const errors = state.errors + 1;
  if (errors >= 3) {
    persist(resolvedPuzzleState({ ...state, errors: 3 }, 'failed'));
    settleReward();
    locked = false;
    status(t('puzzle.status.thirdError'), 'error');
    renderMeta();
    renderBoard();
    return;
  }
  persist({ ...state, errors });
  status(t('puzzle.status.wrongMove'), 'error');
  renderMeta();
  renderBoard();
}

function moveEngine(parts) {
  const result = engine.move(parts.from, parts.to, parts.promotion);
  if (!result.ok) throw new Error(`Puzzle solution contains illegal move ${parts.uci}`);
  return result;
}

async function playForcedReply({ resume = false } = {}) {
  if (state.resolved) return;
  if (state.solutionIndex >= puzzle.solution.length) {
    finishSolved();
    return;
  }
  const reply = uciParts(puzzle.solution[state.solutionIndex]);
  if (!reply) throw new Error('Puzzle forced reply missing');
  locked = true;
  status(t(resume ? 'puzzle.status.restoreOpponent' : 'puzzle.status.opponentMove'));
  await new Promise((resolve) => setTimeout(resolve, replyDelay()));
  const replyResult = moveEngine(reply);
  const nextIndex = state.solutionIndex + 1;
  persist({ ...state, currentFen: replyResult.fen, solutionIndex: nextIndex });
  renderBoard();
  if (nextIndex >= puzzle.solution.length) {
    finishSolved();
    return;
  }
  locked = false;
  status(t('puzzle.status.yourMove'));
}

async function correctMove(from, to, promotion) {
  locked = true;
  const parts = { from, to, promotion, uci: `${from}${to}${promotion || ''}` };
  const result = moveEngine(parts);
  const nextIndex = state.solutionIndex + 1;
  persist({ ...state, currentFen: result.fen, solutionIndex: nextIndex });
  audio()?.move?.();
  renderBoard();
  status(t('puzzle.status.correct'), 'correct');

  if (result.status.type === 'checkmate' || nextIndex >= puzzle.solution.length) {
    finishSolved();
    return;
  }
  await playForcedReply();
}

function settleReward() {
  activeRun = readRun() || activeRun;
  if (!activeRun || !state.resolved || state.rewardSettled) return;
  const reward = state.goldReward || 0;
  const stateWithReceipt = { ...state, rewardSettled: true };
  activeRun = writeRun({
    ...activeRun,
    gold: (activeRun.gold || 0) + reward,
    currentPuzzle: stateWithReceipt,
    lastPuzzle: {
      puzzleId: puzzle.id,
      routeId: state.routeId,
      result: state.result,
      errors: state.errors,
      goldReward: reward
    }
  });
  state = stateWithReceipt;
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  if (reward > 0) globalThis.RPChessResources?.showChange?.({ goldDelta: reward, label: t('puzzle.change.reward') });
}

function finishSolved() {
  if (state.resolved) {
    settleReward();
    locked = false;
    renderMeta();
    renderBoard();
    status(t('puzzle.status.solved'), 'correct');
    return;
  }
  persist(resolvedPuzzleState(state, 'solved'));
  settleReward();
  locked = false;
  status(t('puzzle.status.solved'), 'correct');
  renderMeta();
  renderBoard();
}

function renderAll() {
  renderMeta();
  renderBoard();
  if (state.resolved) status(t(state.result === 'solved' ? 'puzzle.status.solved' : 'puzzle.status.failed'), state.result === 'solved' ? 'correct' : 'error');
  else if (engine.turn() !== puzzle.side) status(t('puzzle.status.opponentMove'));
  else status(t('puzzle.status.yourMove'));
}

async function resumeSession() {
  if (state.resolved) {
    settleReward();
    return;
  }
  if (state.solutionIndex >= puzzle.solution.length || engine.status().type === 'checkmate') {
    finishSolved();
    return;
  }
  if (engine.turn() !== puzzle.side) await playForcedReply({ resume: true });
}

function openPuzzle(event) {
  activeRun = readRun();
  const choice = activeRun?.activeTravelChoice || event?.detail?.choice;
  if (!activeRun || activeRun.ended || choice?.type !== 'puzzle') return;
  const week = choice.step || activeRun.journeyStep || 1;

  if (activeRun.currentPuzzle?.routeId === choice.id) {
    state = activeRun.currentPuzzle;
    puzzle = findPuzzle(state.puzzleId);
  } else {
    let history = puzzleHistory(activeRun);
    if (history.length >= PUZZLE_CATALOG.length) history = [];
    puzzle = selectPuzzle(PUZZLE_CATALOG, { runId: activeRun.id, routeId: choice.id, stars: choice.stars, week, excludedIds: history });
    state = createPuzzleState({ puzzle, routeId: choice.id, stars: choice.stars, week });
    activeRun = writeRun({ ...activeRun, puzzleHistory:[...history, puzzle.id], currentPuzzle: state });
    globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }

  if (!puzzle) {
    activeRun = writeRun({ ...activeRun, currentPuzzle: null });
    return;
  }

  engine = new ClassicChessEngine(state.currentFen);
  selected = null;
  selectedMoves = [];
  locked = false;
  ensureScreen();
  showPuzzle();
  renderAll();
  void resumeSession().catch((error) => {
    console.error(error);
    locked = false;
    status(t('puzzle.status.restoreFailed'), 'error');
  });
}

function continueTravel() {
  if (!state?.resolved) return;
  audio()?.click?.();
  activeRun = readRun() || activeRun;
  if (!activeRun) return;
  activeRun = writeRun({ ...activeRun, currentPuzzle: null, activeTravelChoice: null, currentTravelChoices: null });
  state = null;
  puzzle = null;
  engine = null;
  hidePuzzle();
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  globalThis.dispatchEvent(new CustomEvent('rpchess:travel-open', { detail: { source: 'puzzle-aftermath' } }));
}

ensureScreen();
subscribe(() => {
  renderStaticCopy();
  if (screen && !screen.hidden && puzzle && state && engine) renderAll();
});
addEventListener('rpchess:puzzle-open', openPuzzle);
globalThis.RPChessPuzzle = Object.freeze({
  open: openPuzzle,
  continueTravel,
  get state() { return state; },
  get puzzle() { return puzzle; }
});