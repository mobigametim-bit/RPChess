import { VerticalSlicePresenter } from './vertical-slice-presenter-final.mjs?v=20260826-2';

const INSTALL_KEY = Symbol.for('rpchess.battle-pointer-coordinate-safety.20260826');

function logicalPointer(canvas, event) {
  const bounds = canvas?.getBoundingClientRect?.();
  const dpr = Math.max(1, Number(globalThis.devicePixelRatio) || 1);
  const logicalWidth = Number(canvas?.width) / dpr;
  const logicalHeight = Number(canvas?.height) / dpr;
  if (!canvas || !bounds || !(bounds.width > 0) || !(bounds.height > 0)
    || !(logicalWidth > 0) || !(logicalHeight > 0)) return null;
  return Object.freeze({
    bounds,
    logicalWidth,
    logicalHeight,
    x: (Number(event.clientX) - bounds.left) * (logicalWidth / bounds.width),
    y: (Number(event.clientY) - bounds.top) * (logicalHeight / bounds.height)
  });
}

function movableVisualSquare(presenter, x, y) {
  const scenario = presenter?.lastSnapshot?.scenario;
  const viewport = presenter?.boardReport?.viewport;
  const plan = presenter?.boardPlan;
  if (!scenario?.playerTurn || !viewport || !plan || presenter.selectedSquare || presenter.selectedReserveEntryId) return null;

  const movableSquares = new Set((scenario.legalCommands || [])
    .filter((command) => command.type === 'MovePiece' && command.payload?.from)
    .map((command) => command.payload.from));
  if (!movableSquares.size) return null;

  const rawDisplayX = Math.floor((x - viewport.x) / viewport.cellSize);
  const rawDisplayY = Math.floor((y - viewport.y) / viewport.cellSize);
  const rawCell = plan.activeCells.find((cell) => cell.displayX === rawDisplayX && cell.displayY === rawDisplayY);
  if (rawCell && movableSquares.has(rawCell.square)) return rawCell.square;

  let best = null;
  for (const square of movableSquares) {
    const cell = plan.activeCells.find((candidate) => candidate.square === square);
    if (!cell) continue;
    const left = viewport.x + cell.displayX * viewport.cellSize;
    const top = viewport.y + cell.displayY * viewport.cellSize;
    const size = viewport.cellSize;

    // Unit illustrations are character art rather than abstract chess glyphs.
    // Their visible silhouette can read slightly above the logical cell centre,
    // especially with browser/UI scaling. Treat that visible silhouette as part
    // of the piece hit target instead of forcing the player to click below it.
    const hitLeft = left + size * 0.08;
    const hitRight = left + size * 0.92;
    const hitTop = top - size * 0.36;
    const hitBottom = top + size * 0.94;
    if (x < hitLeft || x > hitRight || y < hitTop || y > hitBottom) continue;

    const cx = left + size * 0.5;
    const cy = top + size * 0.42;
    const distance = ((x - cx) / size) ** 2 + ((y - cy) / size) ** 2;
    if (!best || distance < best.distance) best = { square, distance };
  }
  return best?.square || null;
}

function installBattlePointerCoordinateSafety(Presenter = VerticalSlicePresenter) {
  const prototype = Presenter?.prototype;
  if (!prototype || prototype[INSTALL_KEY]) return false;
  const original = prototype.handleBoardPointer;
  if (typeof original !== 'function') throw new Error('battle pointer safety requires handleBoardPointer');

  prototype.handleBoardPointer = function handleScaledBoardPointer(event) {
    const canvas = event?.currentTarget;
    const point = logicalPointer(canvas, event);
    if (!point) return original.call(this, event);

    if (!this.busy && !this.animationRunning && ['scenario','boss'].includes(this.lastSnapshot?.status)) {
      const visualSquare = movableVisualSquare(this, point.x, point.y);
      if (visualSquare) {
        this.selectedSquare = visualSquare;
        this.selectedReserveEntryId = null;
        this.drawBoard();
        return;
      }
    }

    const clientX = point.bounds.left + point.x * (point.bounds.width / point.logicalWidth);
    const clientY = point.bounds.top + point.y * (point.bounds.height / point.logicalHeight);
    return original.call(this, { currentTarget:canvas, clientX, clientY });
  };

  Object.defineProperty(prototype, INSTALL_KEY, { value:true });
  return true;
}

installBattlePointerCoordinateSafety();

export { logicalPointer, movableVisualSquare, installBattlePointerCoordinateSafety };
