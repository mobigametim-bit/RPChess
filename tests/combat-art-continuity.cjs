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

  assert.strictEqual(mod.isCustomCombatArt('generated_assets/unit_rook_enemy.png'), false);
  assert.strictEqual(mod.isCustomCombatArt('assets/races/demons/pieces/rook.png'), true);
  assert.strictEqual(mod.isCustomCombatArt('assets/kings/oathkeeper/piece.png'), true);

  console.log('Combat custom-art continuity and both castling rook relocations: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
