import { VerticalSlicePresenter } from './vertical-slice-presenter-final.mjs';

const INSTALL_KEY = Symbol.for('rpchess.battle-pointer-coordinate-safety.installed');

function installBattlePointerCoordinateSafety(Presenter = VerticalSlicePresenter) {
  const prototype = Presenter?.prototype;
  if (!prototype || prototype[INSTALL_KEY]) return false;
  const original = prototype.handleBoardPointer;
  if (typeof original !== 'function') throw new Error('battle pointer safety requires handleBoardPointer');

  prototype.handleBoardPointer = function handleScaledBoardPointer(event) {
    const canvas = event?.currentTarget;
    const bounds = canvas?.getBoundingClientRect?.();
    const dpr = Math.max(1, Number(globalThis.devicePixelRatio) || 1);
    const logicalWidth = Number(canvas?.width) / dpr;
    const logicalHeight = Number(canvas?.height) / dpr;

    if (!canvas || !bounds || !(bounds.width > 0) || !(bounds.height > 0)
      || !(logicalWidth > 0) || !(logicalHeight > 0)) {
      return original.call(this, event);
    }

    const scaleX = logicalWidth / bounds.width;
    const scaleY = logicalHeight / bounds.height;
    if (Math.abs(scaleX - 1) < 0.001 && Math.abs(scaleY - 1) < 0.001) {
      return original.call(this, event);
    }

    const clientX = bounds.left + (Number(event.clientX) - bounds.left) * scaleX;
    const clientY = bounds.top + (Number(event.clientY) - bounds.top) * scaleY;
    return original.call(this, { currentTarget: canvas, clientX, clientY });
  };

  Object.defineProperty(prototype, INSTALL_KEY, { value:true });
  return true;
}

installBattlePointerCoordinateSafety();

export { installBattlePointerCoordinateSafety };
