const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const mod = await import(pathToFileURL(path.resolve(__dirname, '..', 'game/js/events/combat-art-continuity.mjs')).href);

  assert.deepStrictEqual(mod.castleRookSquares({ castle: 'K' }, 'w'), { from: 'h1', to: 'f1' });
  assert.deepStrictEqual(mod.castleRookSquares({ castle: 'Q' }, 'w'), { from: 'a1', to: 'd1' });
  assert.deepStrictEqual(mod.castleRookSquares({ castle: 'K' }, 'b'), { from: 'h8', to: 'f8' });
  assert.deepStrictEqual(mod.castleRookSquares({ castle: 'Q' }, 'b'), { from: 'a8', to: 'd8' });

  const initial = new Map([
    ['e8', 'assets/races/demons/pieces/king.png'],
    ['h8', 'assets/races/demons/pieces/rook.png'],
    ['a8', 'assets/races/demons/pieces/rook.png']
  ]);
  const kingSide = mod.advanceTrackedArt(initial, { color: 'b', move: { from: 'e8', to: 'g8', castle: 'K' } });
  assert.strictEqual(kingSide.get('g8'), 'assets/races/demons/pieces/king.png');
  assert.strictEqual(kingSide.get('f8'), 'assets/races/demons/pieces/rook.png');
  assert.strictEqual(kingSide.has('h8'), false, 'castled rook must leave h8 in the art identity map');

  const movedRook = mod.advanceTrackedArt(kingSide, { color: 'b', move: { from: 'f8', to: 'f7' } });
  assert.strictEqual(movedRook.get('f7'), 'assets/races/demons/pieces/rook.png', 'race-specific rook art must survive later moves after castling');
  assert.strictEqual(movedRook.has('f8'), false);

  assert.strictEqual(mod.promotedArtSource('assets/races/demons/pieces/pawn.png', 'q'), 'assets/races/demons/pieces/queen.png');
  assert.strictEqual(mod.promotedArtSource('assets/races/humans/pieces/white/pawn.png', 'r'), 'assets/races/humans/pieces/white/rook.png');
  assert.strictEqual(mod.promotedArtSource('generated_assets/unit_pawn_enemy.png', 'n'), 'generated_assets/unit_knight_enemy.png');
  assert.strictEqual(mod.promotedArtSource('assets/heroes/some_named_pawn.png', 'b'), 'assets/heroes/some_named_pawn.png', 'named art must keep its identity when its path is not a role asset');

  const promotion = mod.advanceTrackedArt(
    new Map([['a2', 'assets/races/humans/pieces/white/pawn.png']]),
    { color: 'w', move: { from: 'a2', to: 'a1', promotion: 'q' } }
  );
  assert.strictEqual(promotion.get('a1'), 'assets/races/humans/pieces/white/queen.png', 'temporary pawn promotion must immediately use the selected role art');
  const promotedNextMove = mod.advanceTrackedArt(promotion, { color: 'w', move: { from: 'a1', to: 'a4' } });
  assert.strictEqual(promotedNextMove.get('a4'), 'assets/races/humans/pieces/white/queen.png', 'promoted art must survive subsequent board rebuilds and moves');

  for (const [code, role] of Object.entries({ q:'queen', r:'rook', b:'bishop', n:'knight' })) {
    assert.strictEqual(
      mod.promotedArtSource('assets/races/orcs/pieces/pawn.png', code),
      `assets/races/orcs/pieces/${role}.png`,
      `promotion ${code} must resolve to ${role} art`
    );
  }

  assert.strictEqual(mod.isCustomCombatArt('generated_assets/unit_rook_enemy.png'), false);
  assert.strictEqual(mod.isCustomCombatArt('assets/races/demons/pieces/rook.png'), true);
  assert.strictEqual(mod.isCustomCombatArt('assets/kings/oathkeeper/piece.png'), true);

  console.log('Combat custom-art castling and temporary-piece promotion continuity: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
