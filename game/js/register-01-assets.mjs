const ASSET_ROOT = 'assets';

const CORE_ASSETS = Object.freeze({
  focusRing: `${ASSET_ROOT}/ui/focus_ring.png`,
  neutralBoard: Object.freeze({
    light: `${ASSET_ROOT}/boards/neutral/tile_light.png`,
    dark: `${ASSET_ROOT}/boards/neutral/tile_dark.png`,
    blocker: `${ASSET_ROOT}/boards/neutral/blocked_cell.png`,
    startZone: `${ASSET_ROOT}/boards/neutral/start_zone.png`
  }),
  vfx: Object.freeze({
    legalMove: `${ASSET_ROOT}/vfx/legal_move.png`,
    captureMove: `${ASSET_ROOT}/vfx/capture_move.png`,
    check: `${ASSET_ROOT}/vfx/check.png`,
    checkmate: Object.freeze({ source: `${ASSET_ROOT}/vfx/checkmate.png`, columns: 8, rows: 8, frames: 24, durationMs: 720 }),
    pieceCapture: Object.freeze({ source: `${ASSET_ROOT}/vfx/piece_capture.png`, columns: 8, rows: 8, frames: 28, durationMs: 430 }),
    promotion: Object.freeze({ source: `${ASSET_ROOT}/vfx/promotion.png`, columns: 8, rows: 8, frames: 48, durationMs: 960 })
  })
});

const MAIN_REGION_IDS = Object.freeze([
  'iron_marches',
  'thorn_covenant',
  'ashen_dominion',
  'sky_khanate',
  'luminous_synod',
  'free_cities'
]);

const RARE_REGION_IDS = Object.freeze(['mirror_conclave', 'verdant_exiles']);

function mainRegionAssets(id) {
  const base = `${ASSET_ROOT}/regions/${id}`;
  return Object.freeze({
    id,
    status: 'REVIEW',
    rare: false,
    mapBanner: `${base}/map_banner.jpg`,
    capital: `${base}/capital.jpg`,
    battle: `${base}/battle.jpg`,
    elite: `${base}/elite.jpg`,
    bossArena: `${base}/boss_arena.jpg`,
    crest: `${base}/crest.png`,
    tileLight: `${base}/tile_light.png`,
    tileDark: `${base}/tile_dark.png`,
    environmentSheet: `${base}/environment_sheet.png`
  });
}

function rareRegionAssets(id) {
  const base = `${ASSET_ROOT}/regions/${id}`;
  return Object.freeze({
    id,
    status: 'REVIEW',
    rare: true,
    mapBanner: `${base}/map_banner.jpg`,
    capital: null,
    battle: `${base}/battle.jpg`,
    elite: null,
    bossArena: `${base}/boss_arena.jpg`,
    crest: `${base}/crest.png`,
    tileLight: `${base}/tile_light.png`,
    tileDark: `${base}/tile_dark.png`,
    environmentSheet: `${base}/environment_sheet.png`
  });
}

const REGION_ASSETS = Object.freeze(Object.fromEntries([
  ...MAIN_REGION_IDS.map((id) => [id, mainRegionAssets(id)]),
  ...RARE_REGION_IDS.map((id) => [id, rareRegionAssets(id)])
]));

const KING_IDS = Object.freeze([
  'oathkeeper',
  'stone_crown',
  'wanderer_queen',
  'pilgrim',
  'fox_prince',
  'ash_regent',
  'nameless_heir'
]);

const KING_ASSETS = Object.freeze(Object.fromEntries(KING_IDS.map((id) => {
  const base = `${ASSET_ROOT}/kings/${id}`;
  return [id, Object.freeze({
    id,
    status: 'REVIEW',
    portrait: `${base}/portrait.png`,
    piece: `${base}/piece.png`,
    commandIcon: `${base}/command_icon.png`,
    passiveIcon: `${base}/passive_icon.png`
  })];
})));

const DOCTRINE_IDS = Object.freeze([
  'fortress',
  'cavalry',
  'sacred_diagonals',
  'pawn_ascension',
  'royal_court',
  'gambit'
]);

const DOCTRINE_ASSETS = Object.freeze(Object.fromEntries(DOCTRINE_IDS.map((id) => {
  const base = `${ASSET_ROOT}/doctrines/${id}`;
  return [id, Object.freeze({
    id,
    status: 'REVIEW',
    emblem: `${base}/emblem.png`,
    nodes: Object.freeze(Array.from({ length: 5 }, (_, index) => `${base}/node_${String(index + 1).padStart(2, '0')}.png`))
  })];
})));

function stableSlug(value, prefix = '') {
  const source = String(value || '');
  const withoutPrefix = prefix && source.startsWith(prefix) ? source.slice(prefix.length) : source;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(withoutPrefix)) return null;
  return withoutPrefix;
}

function regionSlug(regionId) {
  return stableSlug(regionId, 'region.');
}

function kingSlug(kingId) {
  return stableSlug(kingId, 'king.');
}

function doctrineSlug(doctrineId) {
  return stableSlug(doctrineId, 'doctrine.');
}

function regionAssets(regionId) {
  return REGION_ASSETS[regionSlug(regionId)] || null;
}

function kingAssets(kingId) {
  return KING_ASSETS[kingSlug(kingId)] || null;
}

function doctrineAssets(doctrineId) {
  return DOCTRINE_ASSETS[doctrineSlug(doctrineId)] || null;
}

function sceneAsset(snapshot, purpose = 'campaign') {
  const assets = regionAssets(snapshot?.campaign?.regionId);
  if (!assets) return null;
  if (purpose === 'event' && snapshot?.event?.sceneArt) return snapshot.event.sceneArt;
  if (purpose === 'boss' || snapshot?.currentNode?.type === 'boss') return assets.bossArena;
  if (purpose === 'elite' || snapshot?.currentNode?.type === 'elite') return assets.elite || assets.battle;
  if (purpose === 'battle' || ['battle', 'scenario'].includes(snapshot?.currentNode?.type)) return assets.battle;
  if (purpose === 'capital' || purpose === 'reward') return assets.capital || assets.mapBanner;
  return assets.mapBanner;
}

function effectForBattleEvent(event, scenario) {
  const type = event?.type;
  const payload = event?.payload || {};
  if (type === 'PieceCaptured') {
    return Object.freeze({ ...CORE_ASSETS.vfx.pieceCapture, square: payload.square || null, eventId: event.id || null, type });
  }
  if (type === 'PawnPromoted') {
    return Object.freeze({ ...CORE_ASSETS.vfx.promotion, square: payload.square || null, eventId: event.id || null, type });
  }
  if (type === 'CheckmateDeclared') {
    const losingSide = payload.loser || (payload.winner === 'w' ? 'b' : payload.winner === 'b' ? 'w' : null);
    const king = (scenario?.pieces || []).find((piece) => piece.type === 'k' && (!losingSide || piece.side === losingSide));
    return Object.freeze({ ...CORE_ASSETS.vfx.checkmate, square: payload.kingSquare || king?.square || null, eventId: event.id || null, type });
  }
  return null;
}

function allRegister01Paths() {
  const result = [
    CORE_ASSETS.focusRing,
    CORE_ASSETS.neutralBoard.light,
    CORE_ASSETS.neutralBoard.dark,
    CORE_ASSETS.neutralBoard.blocker,
    CORE_ASSETS.neutralBoard.startZone,
    CORE_ASSETS.vfx.check,
    CORE_ASSETS.vfx.checkmate.source,
    CORE_ASSETS.vfx.pieceCapture.source,
    CORE_ASSETS.vfx.promotion.source
  ];
  for (const region of Object.values(REGION_ASSETS)) {
    result.push(...[
      region.mapBanner,
      region.capital,
      region.battle,
      region.elite,
      region.bossArena,
      region.crest,
      region.tileLight,
      region.tileDark,
      region.environmentSheet
    ].filter(Boolean));
  }
  for (const king of Object.values(KING_ASSETS)) {
    result.push(king.portrait, king.piece, king.commandIcon, king.passiveIcon);
  }
  for (const doctrine of Object.values(DOCTRINE_ASSETS)) result.push(doctrine.emblem, ...doctrine.nodes);
  return Object.freeze(result);
}

export {
  ASSET_ROOT,
  CORE_ASSETS,
  MAIN_REGION_IDS,
  RARE_REGION_IDS,
  REGION_ASSETS,
  KING_IDS,
  KING_ASSETS,
  DOCTRINE_IDS,
  DOCTRINE_ASSETS,
  regionSlug,
  kingSlug,
  doctrineSlug,
  regionAssets,
  kingAssets,
  doctrineAssets,
  sceneAsset,
  effectForBattleEvent,
  allRegister01Paths
};
