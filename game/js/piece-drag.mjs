/* Shared pointer drag input for real 8x8 chess boards.
   Click-to-select remains authoritative: drag begins only after a short move.
   The move is committed by the owning screen's existing rules/validation. */
function attachPieceDrag(board, { canPick, onStart, onDrop }) {
  if (!board) return;
  board.classList.add('rpchess-draggable-board');
  let gesture = null;
  let suppressClick = null;

  function squareAt(x, y) {
    const target = document.elementFromPoint(x, y)?.closest?.('[data-square]');
    return target && board.contains(target) ? target : null;
  }

  function removeFeedback() {
    board.querySelectorAll('.rpchess-drag-origin,.rpchess-drop-target').forEach(
      cell => cell.classList.remove('rpchess-drag-origin', 'rpchess-drop-target'));
    document.querySelectorAll('.rpchess-piece-drag-ghost').forEach(node => node.remove());
  }

  function detach() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('blur', cancel);
  }

  function reset() {
    const id = gesture?.id;
    detach();
    removeFeedback();
    gesture = null;
    if (id !== undefined && board.hasPointerCapture?.(id)) {
      try { board.releasePointerCapture(id); } catch { /* release on pointerup may be automatic */ }
    }
  }

  function positionGhost(x, y) {
    if (!gesture?.ghost) return;
    gesture.ghost.style.left = x + 'px';
    // Keep the preview just above a finger; centering it under the touch
    // obscures the artwork even when the ghost itself is visible.
    const lift = gesture.pointerType === 'touch' ? Math.max(24, Math.min(40, gesture.size * .6)) : 0;
    gesture.ghost.style.top = (y - lift) + 'px';
  }

  function begin(x, y) {
    if (!gesture) return;
    gesture.dragging = true;
    // Capture only after actual movement. Capturing during a simple tap would
    // redirect click-to-select events from the square to the board.
    try { board.setPointerCapture?.(gesture.id); } catch { /* pointer already ended */ }
    const { from, src, size, glyph, glyphColor } = gesture;
    // The owner highlights legal destinations; re-rendering cells is safe.
    onStart(from);
    if (!gesture) return;
    const ghost = document.createElement(glyph ? 'span' : 'img');
    ghost.className = 'rpchess-piece-drag-ghost' + (glyph ? ' rpchess-piece-symbol rpchess-piece-symbol--' + glyphColor : '');
    if (glyph) {
      ghost.textContent = glyph;
      ghost.style.fontSize = (size * .88) + 'px';
      ghost.setAttribute('aria-hidden', 'true');
    } else {
      ghost.src = src;
      ghost.alt = '';
      ghost.draggable = false;
    }
    ghost.style.width = size + 'px';
    ghost.style.height = size + 'px';
    document.body.append(ghost);
    gesture.ghost = ghost;
    board.querySelector('[data-square="' + from + '"]')?.classList.add('rpchess-drag-origin');
    positionGhost(x, y);
  }

  function move(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!gesture.dragging) {
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 7) return;
      begin(event.clientX, event.clientY);
    }
    if (!gesture?.dragging) return;
    if (event.cancelable) event.preventDefault();
    positionGhost(event.clientX, event.clientY);
    board.querySelector('.rpchess-drop-target')?.classList.remove('rpchess-drop-target');
    const target = squareAt(event.clientX, event.clientY);
    if (target?.dataset.square !== gesture.from) target?.classList.add('rpchess-drop-target');
  }

  function finish(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const { from, dragging } = gesture;
    const target = dragging ? squareAt(event.clientX, event.clientY) : null;
    if (dragging) {
      if (event.cancelable) event.preventDefault();
      // A release can synthesize a click after pointerup. Suppress just that click,
      // not an unrelated tap/click or keyboard activation.
      suppressClick = { x:event.clientX, y:event.clientY, until:performance.now() + 90 };
    }
    reset();
    if (dragging) onDrop(from, target && target.dataset.square !== from ? target.dataset.square : null);
  }

  function cancel() { reset(); }

  board.addEventListener('pointerdown', event => {
    // A new real press must never be mistaken for the synthetic click from
    // the previous drag, even when the player taps the same square quickly.
    suppressClick = null;
    if (gesture || !event.isPrimary || event.button !== 0) return;
    const square = event.target.closest?.('[data-square]');
    if (!square || !board.contains(square) || square.disabled) return;
    const image = square.querySelector('.classic-piece,.puzzle-piece');
    if (!image || !canPick(square.dataset.square)) return;
    const symbol = document.documentElement.dataset.simplePieces === '1'
      ? square.querySelector('.rpchess-piece-symbol') : null;
    gesture = {
      id:event.pointerId, pointerType:event.pointerType, from:square.dataset.square, x:event.clientX, y:event.clientY,
      src:image.currentSrc || image.src, size:square.getBoundingClientRect().width * .85,
      glyph:symbol?.textContent || null,
      glyphColor:symbol?.classList.contains('rpchess-piece-symbol--b') ? 'b' : 'w',
      dragging:false, ghost:null
    };
    window.addEventListener('pointermove', move, { passive:false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
  });

  // Capture phase is necessary because owners have click listeners per square.
  document.addEventListener('click', event => {
    if (!suppressClick) return;
    const pending = suppressClick;
    suppressClick = null;
    if (performance.now() > pending.until || event.detail === 0) return;
    if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 32) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}

export { attachPieceDrag };
