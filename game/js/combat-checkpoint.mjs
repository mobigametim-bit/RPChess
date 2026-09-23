const SQUARE = /^[a-h][1-8]$/;
const PROMOTION = /^[qrbn]$/;

function isCombatCheckpoint(value) {
  return value == null || Boolean(
    value && typeof value === 'object' && ['battle', 'skirmish'].includes(value.type) &&
    typeof value.encounterId === 'string' && value.encounterId &&
    Array.isArray(value.selectedIds) && value.selectedIds.length > 0 &&
    value.selectedIds.every((id) => typeof id === 'string' && id) &&
    Array.isArray(value.moves) && value.moves.every((move) =>
      SQUARE.test(move?.from) && SQUARE.test(move?.to) &&
      (move.promotion == null || PROMOTION.test(move.promotion)))
  );
}

function checkpointFor(run, type, encounter) {
  const checkpoint = run?.currentCombat;
  return isCombatCheckpoint(checkpoint) && checkpoint?.type === type &&
    checkpoint.encounterId === encounter?.id ? checkpoint : null;
}

function combatMoves(moveLog) {
  return (moveLog || []).map(({ move }) => ({
    from:move.from, to:move.uciTo || move.to, promotion:move.promotion || null
  }));
}

export { isCombatCheckpoint, checkpointFor, combatMoves };
