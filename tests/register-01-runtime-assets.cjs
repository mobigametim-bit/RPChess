const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

(async () => {
  const assets = await import(pathToFileURL(path.resolve(__dirname, '../game/js/register-01-assets.mjs')).href);
  const presenter = await import(pathToFileURL(path.resolve(__dirname, '../game/js/vertical-slice-presenter.mjs')).href);

  test('Register 01 browser catalog contains exactly 141 unique canonical paths', () => {
    const paths = assets.allRegister01Paths();
    assert.strictEqual(paths.length, 141);
    assert.strictEqual(new Set(paths).size, 141);
    assert.ok(paths.every((value) => value.startsWith('assets/')));
    assert.ok(paths.every((value) => !value.includes('board_8x8') && !value.includes('board_skin')));
  });

  test('all region families resolve modular tiles, crest and appropriate scenes', () => {
    assert.strictEqual(Object.keys(assets.REGION_ASSETS).length, 8);
    const iron = assets.regionAssets('region.iron_marches');
    assert.strictEqual(iron.mapBanner, 'assets/regions/iron_marches/map_banner.jpg');
    assert.strictEqual(iron.tileLight, 'assets/regions/iron_marches/tile_light.png');
    assert.strictEqual(iron.tileDark, 'assets/regions/iron_marches/tile_dark.png');
    const mirror = assets.regionAssets('region.mirror_conclave');
    assert.strictEqual(mirror.rare, true);
    assert.strictEqual(mirror.capital, null);
    assert.strictEqual(mirror.bossArena, 'assets/regions/mirror_conclave/boss_arena.jpg');
  });

  test('all king and doctrine art families are registered without invented mechanics', () => {
    assert.strictEqual(Object.keys(assets.KING_ASSETS).length, 7);
    assert.strictEqual(Object.keys(assets.DOCTRINE_ASSETS).length, 6);
    assert.strictEqual(assets.kingAssets('king.oathkeeper').piece, 'assets/kings/oathkeeper/piece.png');
    assert.strictEqual(assets.doctrineAssets('doctrine.fortress').nodes.length, 5);
    assert.ok(Object.values(assets.KING_ASSETS).every((entry) => entry.status === 'REVIEW'));
    assert.ok(Object.values(assets.DOCTRINE_ASSETS).every((entry) => entry.status === 'REVIEW'));
  });

  test('scene resolver selects map, battle, elite and boss art from current runtime state', () => {
    const campaign = { campaign: { regionId: 'region.iron_marches' }, currentNode: null };
    const battle = { ...campaign, currentNode: { type: 'battle' } };
    assert.strictEqual(assets.sceneAsset(campaign), 'assets/regions/iron_marches/map_banner.jpg');
    assert.strictEqual(assets.sceneAsset(battle), 'assets/regions/iron_marches/battle.jpg');
    assert.strictEqual(assets.sceneAsset(battle, 'battle'), 'assets/regions/iron_marches/battle.jpg');
    assert.strictEqual(assets.sceneAsset({ ...campaign, currentNode: { type: 'elite' } }, 'elite'), 'assets/regions/iron_marches/elite.jpg');
    assert.strictEqual(assets.sceneAsset({ ...campaign, currentNode: { type: 'boss' } }, 'boss'), 'assets/regions/iron_marches/boss_arena.jpg');
  });

  test('battle events map only to declared non-blocking sprite sheets', () => {
    const scenario = { pieces: [{ side: 'b', type: 'k', square: 'e8' }] };
    const capture = assets.effectForBattleEvent({ id: 'e1', type: 'PieceCaptured', payload: { square: 'd5' } }, scenario);
    assert.strictEqual(capture.source, 'assets/vfx/piece_capture.png');
    assert.strictEqual(capture.frames, 28);
    assert.strictEqual(capture.square, 'd5');
    const promotion = assets.effectForBattleEvent({ id: 'e2', type: 'PawnPromoted', payload: { square: 'a8' } }, scenario);
    assert.strictEqual(promotion.source, 'assets/vfx/promotion.png');
    const mate = assets.effectForBattleEvent({ id: 'e3', type: 'CheckmateDeclared', payload: { winner: 'w', loser: 'b' } }, scenario);
    assert.strictEqual(mate.source, 'assets/vfx/checkmate.png');
    assert.strictEqual(mate.square, 'e8');
    assert.strictEqual(assets.effectForBattleEvent({ id: 'e4', type: 'PieceMoved', payload: {} }, scenario), null);
  });

  test('presenter keeps existing chess helpers and includes Register 01 focus styling', () => {
    assert.strictEqual(presenter.pieceGlyph({ side: 'w', type: 'n' }), '♘');
    assert.strictEqual(presenter.commandLabel({ type: 'MovePiece', payload: { from: 'e7', to: 'e8', promotion: 'q' } }), 'e7 → e8 = Q');
    const css = presenter.createPresenterStyles();
    assert.ok(css.includes('assets/ui/focus_ring.png'));
    assert.ok(css.includes('rpvs__board-vfx'));
  });

  let failures = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(error.stack || error);
    }
  }
  console.log(`\nRegister 01 runtime assets: ${tests.length - failures}/${tests.length} passed.`);
  if (failures) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
