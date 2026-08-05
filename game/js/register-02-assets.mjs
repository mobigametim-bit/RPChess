const ASSET_ROOT = 'assets';

const HERO_SLUGS = Object.freeze([
  'aldric_wall', 'mara_chain', 'brother_orell', 'vael_hammer', 'lady_sorn', 'tomas_gate',
  'seraph_lyra', 'ivar_lens', 'nemea_quill', 'orion_step', 'abbess_celene', 'deacon_mirel',
  'cassian_coin', 'viola_mask', 'renzo_bridge', 'tessa_gull', 'old_marin', 'elio_silk',
  'briar_sister', 'roan_stag', 'maeve_root', 'puck_ember', 'lord_aylen', 'ysra_moss',
  'kael_cinder', 'velka_urn', 'rath_banner', 'suri_ash', 'empress_nahla', 'daro_last',
  'temur_wind', 'altana_bow', 'batu_cliff', 'saran_dawn', 'khulan_star', 'ergen_cloud'
]);

const POLITICAL_FILENAMES = Object.freeze([
  'marshal_varn.png', 'heir_elda.png', 'guildmaster_borek.png',
  'pontiff_aelia.png', 'archivist_noem.png', 'heretic_salos.png',
  'consul_marco.png', 'speaker_ines.png', 'admiral_rava.png',
  'warden_roan.png', 'bride_melis.png', 'huntsman_orr.png',
  'empress_nahla_p.png', 'general_dor.png', 'priestess_velka.png',
  'khan_temur.png', 'princess_khulan.png', 'speaker_batu.png'
]);

function stableSlug(value, prefix = '') {
  const source = String(value || '');
  const withoutPrefix = prefix && source.startsWith(prefix) ? source.slice(prefix.length) : source;
  return /^[a-z0-9][a-z0-9_-]*$/.test(withoutPrefix) ? withoutPrefix : null;
}

function heroSlug(heroId) {
  return stableSlug(heroId, 'hero.');
}

function politicalSlug(value) {
  const source = String(value || '').replace(/\.png$/i, '');
  return stableSlug(source, 'politics.');
}

function createHeroAssets(slug) {
  const base = `${ASSET_ROOT}/heroes/${slug}`;
  return Object.freeze({
    id: `hero.${slug}`,
    slug,
    status: 'REVIEW',
    portrait: `${base}/portrait.png`,
    pieceBadge: `${base}/piece_badge.png`,
    abilityIcon: `${base}/ability_icon.png`
  });
}

const HERO_ASSETS = Object.freeze(Object.fromEntries(HERO_SLUGS.map((slug) => [slug, createHeroAssets(slug)])));

const POLITICAL_ASSETS = Object.freeze(Object.fromEntries(POLITICAL_FILENAMES.map((filename) => {
  const slug = filename.replace(/\.png$/i, '');
  return [slug, Object.freeze({
    id: `politics.${slug}`,
    slug,
    status: 'REVIEW',
    portrait: `${ASSET_ROOT}/politics/${filename}`
  })];
})));

function heroAssets(heroId) {
  return HERO_ASSETS[heroSlug(heroId)] || null;
}

function politicalAssets(value) {
  return POLITICAL_ASSETS[politicalSlug(value)] || null;
}

function allRegister02Paths() {
  const result = [];
  for (const hero of Object.values(HERO_ASSETS)) result.push(hero.portrait, hero.pieceBadge, hero.abilityIcon);
  for (const character of Object.values(POLITICAL_ASSETS)) result.push(character.portrait);
  return Object.freeze(result);
}

export {
  ASSET_ROOT,
  HERO_SLUGS,
  POLITICAL_FILENAMES,
  HERO_ASSETS,
  POLITICAL_ASSETS,
  heroSlug,
  politicalSlug,
  heroAssets,
  politicalAssets,
  allRegister02Paths
};
