function isCustomCombatArt(src) {
  const value = String(src || '');
  return Boolean(value) && !value.includes('/generated_assets/unit_') && !value.includes('generated_assets/unit_');
}

function castleRookSquares(move, color) {
  if (!move?.castle || !['K', 'Q'].includes(move.castle)) return null;
  const rank = color === 'w' ? '1' : '8';
  return move.castle === 'K'
    ? { from: `h${rank}`, to: `f${rank}` }
    : { from: `a${rank}`, to: `d${rank}` };
}

function advanceTrackedArt(previous, entry) {
  const next = new Map(previous || []);
  const move = entry?.move;
  if (!move?.from || !move?.to) return next;

  const movingArt = next.get(move.from) || null;
  next.delete(move.from);
  if (move.capture) next.delete(move.capture || move.to);
  else next.delete(move.to);
  if (movingArt && !move.promotion) next.set(move.to, movingArt);

  const rookMove = castleRookSquares(move, entry.color);
  if (rookMove) {
    const rookArt = next.get(rookMove.from) || null;
    next.delete(rookMove.from);
    next.delete(rookMove.to);
    if (rookArt) next.set(rookMove.to, rookArt);
  }
  return next;
}

function artFromBoard(board) {
  const result = new Map();
  if (!board) return result;
  for (const cell of board.querySelectorAll('[data-square]')) {
    const image = cell.querySelector('.classic-piece');
    const src = image?.getAttribute('src') || image?.src || '';
    if (image && isCustomCombatArt(src)) result.set(cell.dataset.square, src);
  }
  return result;
}

function applyTrackedArt(board, tracked) {
  if (!board) return;
  for (const [square, src] of tracked) {
    const image = board.querySelector(`[data-square="${square}"] .classic-piece`);
    if (image && src) image.src = src;
  }
}

function installCombatArtContinuity() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return null;
  const board = document.querySelector('[data-chess-board]');
  if (!board) return null;

  let tracked = new Map();
  let processedMoves = 0;
  let scheduled = false;

  function sync() {
    scheduled = false;
    const api = globalThis.RPChessClassicChess;
    const log = Array.isArray(api?.moveLog) ? api.moveLog : [];

    if (log.length < processedMoves) {
      tracked = new Map();
      processedMoves = 0;
    }

    if (log.length === 0) {
      tracked = artFromBoard(board);
      processedMoves = 0;
      applyTrackedArt(board, tracked);
      return;
    }

    if (processedMoves === 0 && tracked.size === 0) tracked = artFromBoard(board);
    while (processedMoves < log.length) {
      tracked = advanceTrackedArt(tracked, log[processedMoves]);
      processedMoves += 1;
    }

    // Combat apps can introduce fresh personalized/race art synchronously after
    // a board render. Merge it without replacing identities already followed.
    for (const [square, src] of artFromBoard(board)) if (!tracked.has(square)) tracked.set(square, src);
    applyTrackedArt(board, tracked);
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(sync);
  }

  const observer = new MutationObserver(scheduleSync);
  observer.observe(board, { childList: true, subtree: true });
  scheduleSync();
  return Object.freeze({ observer, sync });
}

const installed = installCombatArtContinuity();

export { isCustomCombatArt, castleRookSquares, advanceTrackedArt, artFromBoard, applyTrackedArt, installCombatArtContinuity, installed };
