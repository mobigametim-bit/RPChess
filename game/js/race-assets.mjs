const RACE_TAGS = Object.freeze(['humans','elves','orcs','undead','dark_elves','dwarves','demons','angels','dragonborn','beastfolk','constructs','animals','fae','goblins']);
const PIECE_TYPES = Object.freeze(['pawn','knight','bishop','rook','queen','king']);

const RACE_LABELS = Object.freeze({
  humans:'Люди', elves:'Эльфы', orcs:'Орки', undead:'Нежить', dark_elves:'Тёмные эльфы', dwarves:'Гномы', demons:'Демоны', angels:'Ангелы', dragonborn:'Дракониды', beastfolk:'Зверолюди', constructs:'Конструкты', animals:'Животные', fae:'Феи', goblins:'Гоблины', mixed:'Смешанное войско'
});

const BACKGROUND_POOLS = Object.freeze({
  generic:Object.freeze(['forest_crossroad.png','old_kings_road.png','roadside_shrine.png','abandoned_camp.png','ancient_ruins.png','stormy_bridge.png','moonlit_gravefield.png','market_square_twilight.png']),
  humans:Object.freeze(['human_waystation.png','human_chapel_court.png']),
  elves:Object.freeze(['elven_glade.png','elven_waystones.png']),
  orcs:Object.freeze(['orc_war_camp.png','orc_trial_circle.png']),
  undead:Object.freeze(['necropolis_gate.png','bone_court.png']),
  dark_elves:Object.freeze(['obsidian_passage.png','spider_shrine.png']),
  dwarves:Object.freeze(['dwarven_forgehall.png','dwarven_gate_road.png']),
  demons:Object.freeze(['infernal_breach.png','ashen_altar.png']),
  angels:Object.freeze(['sky_sanctuary.png','hall_of_halos.png']),
  dragonborn:Object.freeze(['dragonborn_aerie.png','ember_tribunal.png']),
  beastfolk:Object.freeze(['beastfolk_hunting_camp.png','moon_run_path.png']),
  constructs:Object.freeze(['construct_foundry.png','silent_observatory.png']),
  animals:Object.freeze(['wild_glen.png','riverbank_tracks.png']),
  fae:Object.freeze(['fae_ring_garden.png','whispering_meadow.png']),
  goblins:Object.freeze(['goblin_trade_nook.png','goblin_scrapyard_camp.png'])
});

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function normalizeRaceTag(value) {
  const tag = String(value || '').toLowerCase().trim();
  return RACE_TAGS.includes(tag) ? tag : 'mixed';
}

function oppositeColor(color) { return color === 'b' ? 'w' : 'b'; }

function racePiecePath(raceTag, pieceType, color = 'b') {
  const race = normalizeRaceTag(raceTag);
  const type = PIECE_TYPES.includes(pieceType) ? pieceType : 'pawn';
  if (race === 'humans') return `assets/races/humans/pieces/${color === 'w' ? 'white' : 'black'}/${type}.png`;
  const resolved = race === 'mixed' ? 'humans' : race;
  return `assets/races/${resolved}/pieces/${type}.png`;
}

function eventBackgroundPath(event) {
  const id = event?.id || event?.eventId || 'event';
  const race = normalizeRaceTag(event?.raceTag);
  const pool = race === 'mixed' ? BACKGROUND_POOLS.generic : (BACKGROUND_POOLS[race] || BACKGROUND_POOLS.generic);
  const filename = pool[hashString(`${id}:background`) % pool.length];
  const folder = race === 'mixed' ? 'generic' : race;
  return `assets/events/register-04/backgrounds/${folder}/${filename}`;
}

function deterministicPlayerColor(seed, explicit = null) {
  if (explicit === 'w' || explicit === 'b') return explicit;
  return hashString(`${seed}:player-color`) % 100 < 36 ? 'b' : 'w';
}

function deterministicRace(seed, explicit = null) {
  const tag = normalizeRaceTag(explicit);
  if (tag !== 'mixed') return tag;
  return RACE_TAGS[hashString(`${seed}:enemy-race`) % RACE_TAGS.length];
}

function mixedRoleRaces(seed, raceTag = 'mixed') {
  const normalized = normalizeRaceTag(raceTag);
  if (normalized !== 'mixed') return Object.freeze(Object.fromEntries(PIECE_TYPES.map((type) => [type, normalized])));
  const pool = [...RACE_TAGS];
  const first = pool[hashString(`${seed}:mix:1`) % pool.length];
  let second = pool[hashString(`${seed}:mix:2`) % pool.length];
  if (second === first) second = pool[(pool.indexOf(second) + 5) % pool.length];
  let third = pool[hashString(`${seed}:mix:3`) % pool.length];
  if (third === first || third === second) third = pool[(pool.indexOf(third) + 9) % pool.length];
  return Object.freeze({ pawn:first, knight:second, bishop:third, rook:second, queen:third, king:first });
}

function combatTheme({ seed, raceTag = null, playerColor = null, mixed = false } = {}) {
  const resolvedSeed = String(seed || 'rpchess-combat');
  const normalized = normalizeRaceTag(raceTag);
  const roleRaces = mixed || normalized === 'mixed'
    ? mixedRoleRaces(resolvedSeed, 'mixed')
    : mixedRoleRaces(resolvedSeed, deterministicRace(resolvedSeed, normalized));
  const primaryRace = normalized === 'mixed' ? roleRaces.pawn : deterministicRace(resolvedSeed, normalized);
  const color = deterministicPlayerColor(resolvedSeed, playerColor);
  const enemyColor = oppositeColor(color);
  const defense = color === 'b';
  return Object.freeze({
    playerColor: color,
    enemyColor,
    enemyRaceTag: primaryRace,
    enemyRoleRaces: roleRaces,
    mixedArmy: new Set(Object.values(roleRaces)).size > 1,
    sideNarrative: defense
      ? 'Враг уже занял поле и начинает первым. Ваш отряд принимает бой, удерживая оборону.'
      : 'Ваш отряд перехватывает инициативу и первым выходит на поле.'
  });
}

function pieceArtForTheme(theme, pieceType, color) {
  const race = theme?.enemyRoleRaces?.[pieceType] || theme?.enemyRaceTag || 'humans';
  return racePiecePath(race, pieceType, color || theme?.enemyColor || 'b');
}

export { RACE_TAGS, PIECE_TYPES, RACE_LABELS, BACKGROUND_POOLS, hashString, normalizeRaceTag, oppositeColor, racePiecePath, eventBackgroundPath, deterministicPlayerColor, deterministicRace, mixedRoleRaces, combatTheme, pieceArtForTheme };
