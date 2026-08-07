const ASSET_ROOT = 'assets/bosses';

const BOSS_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'boss.iron_regent', slug: 'iron_regent', name: 'Железный Регент', regionId: 'region.iron_marches' }),
  Object.freeze({ id: 'boss.widow_general', slug: 'widow_general', name: 'Вдовствующая Генеральша', regionId: 'region.iron_marches' }),
  Object.freeze({ id: 'boss.blue_pontiff', slug: 'blue_pontiff', name: 'Лазурный Понтифик', regionId: 'region.luminous_synod' }),
  Object.freeze({ id: 'boss.heretic_astronomer', slug: 'heretic_astronomer', name: 'Еретик-Астроном', regionId: 'region.luminous_synod' }),
  Object.freeze({ id: 'boss.first_consul', slug: 'first_consul', name: 'Первый Консул', regionId: 'region.free_cities' }),
  Object.freeze({ id: 'boss.guild_of_three', slug: 'guild_of_three', name: 'Гильдия Троих', regionId: 'region.free_cities' }),
  Object.freeze({ id: 'boss.antler_king', slug: 'antler_king', name: 'Король Оленьих Рогов', regionId: 'region.thorn_covenant' }),
  Object.freeze({ id: 'boss.thorn_bride', slug: 'thorn_bride', name: 'Терновая Невеста', regionId: 'region.thorn_covenant' }),
  Object.freeze({ id: 'boss.cinder_emperor', slug: 'cinder_emperor', name: 'Пепельный Император', regionId: 'region.ashen_dominion' }),
  Object.freeze({ id: 'boss.last_legion', slug: 'last_legion', name: 'Последний Легион', regionId: 'region.ashen_dominion' }),
  Object.freeze({ id: 'boss.sky_khan', slug: 'sky_khan', name: 'Небесный Каган', regionId: 'region.sky_khanate' }),
  Object.freeze({ id: 'boss.storm_sister', slug: 'storm_sister', name: 'Сестра Бури', regionId: 'region.sky_khanate' }),
  Object.freeze({ id: 'boss.hollow_sovereign', slug: 'hollow_sovereign', name: 'Пустой Суверен', regionId: 'region.secret' }),
  Object.freeze({ id: 'boss.mirror_self', slug: 'mirror_self', name: 'Зеркальный Двойник', regionId: 'region.secret' }),
  Object.freeze({ id: 'boss.war_beyond_crown', slug: 'war_beyond_crown', name: 'Война за Короной', regionId: 'region.final' })
]);

function bossArt(slug) {
  const base = `${ASSET_ROOT}/${slug}`;
  return Object.freeze({
    portrait: `${base}/portrait.png`,
    piece: `${base}/piece.png`,
    arena: `${base}/arena.jpg`,
    phaseSigils: Object.freeze([1, 2, 3].map((phase) => `${base}/phase_${String(phase).padStart(2, '0')}.png`)),
    phaseTransition: `${base}/phase_transition.png`
  });
}

const BOSS_ASSETS = Object.freeze(Object.fromEntries(BOSS_DEFINITIONS.map((definition) => [
  definition.id,
  Object.freeze({ ...definition, ...bossArt(definition.slug), status: 'REVIEW' })
])));

function normalizeBossId(value) {
  const source = String(value || '');
  if (BOSS_ASSETS[source]) return source;
  if (/^[a-z0-9][a-z0-9_-]*$/.test(source) && BOSS_ASSETS[`boss.${source}`]) return `boss.${source}`;
  return null;
}

function bossAssets(value) {
  return BOSS_ASSETS[normalizeBossId(value)] || null;
}

function bossDisplayName(value) {
  return bossAssets(value)?.name || 'Босс';
}

function bossPhaseSigil(value, phaseNumber) {
  const assets = bossAssets(value);
  if (!assets) return null;
  const index = Math.max(0, Math.min(2, Number(phaseNumber || 1) - 1));
  return assets.phaseSigils[index];
}

function allRegister05BossPaths() {
  const paths = [];
  for (const assets of Object.values(BOSS_ASSETS)) {
    paths.push(assets.portrait, assets.piece, assets.arena, ...assets.phaseSigils, assets.phaseTransition);
  }
  return Object.freeze(paths);
}

export {
  ASSET_ROOT,
  BOSS_DEFINITIONS,
  BOSS_ASSETS,
  normalizeBossId,
  bossAssets,
  bossDisplayName,
  bossPhaseSigil,
  allRegister05BossPaths
};
