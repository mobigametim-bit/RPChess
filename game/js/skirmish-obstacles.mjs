const FILES = 'abcdefgh';
const OBSTACLE_REGIONS = Object.freeze([
  'ashen_dominion', 'free_cities', 'iron_marches', 'luminous_synod',
  'mirror_conclave', 'sky_khanate', 'thorn_covenant', 'verdant_exiles'
]);
const OBSTACLE_CELLS_PER_REGION = 16;
const SKIRMISH_OBSTACLE_MIN_COUNT = 1;
const SKIRMISH_OBSTACLE_MAX_COUNT = 4;
const SKIRMISH_OBSTACLE_RANKS = Object.freeze(['3', '4', '5', '6']);

function hashSeed(input) { let hash = 2166136261; for (const char of String(input)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function seededRandom(seed) { let value = hashSeed(seed) || 1; return () => { value += 0x6D2B79F5; let next = value; next = Math.imul(next ^ (next >>> 15), next | 1); next ^= next + Math.imul(next ^ (next >>> 7), next | 61); return ((next ^ (next >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(values, random) { const result = [...values]; for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }

// Only source slices that passed the obstacle-audit are eligible for Skirmish.
// The source sheets retain a 4×4 layout; this curated runtime pool deliberately
// omits off-centre and cross-cell fragments.
const OBSTACLE_PROP_PATHS = Object.freeze([
  'assets/boards/obstacles/ashen_dominion/obstacle_02.png',
  'assets/boards/obstacles/ashen_dominion/obstacle_08.png',
  'assets/boards/obstacles/ashen_dominion/obstacle_10.png',
  'assets/boards/obstacles/ashen_dominion/obstacle_11.png',
  'assets/boards/obstacles/ashen_dominion/obstacle_12.png',
  'assets/boards/obstacles/ashen_dominion/obstacle_14.png',
  'assets/boards/obstacles/ashen_dominion/obstacle_15.png',
  'assets/boards/obstacles/ashen_dominion/obstacle_16.png',
  'assets/boards/obstacles/free_cities/obstacle_05.png',
  'assets/boards/obstacles/free_cities/obstacle_09.png',
  'assets/boards/obstacles/free_cities/obstacle_11.png',
  'assets/boards/obstacles/free_cities/obstacle_13.png',
  'assets/boards/obstacles/iron_marches/obstacle_02.png',
  'assets/boards/obstacles/iron_marches/obstacle_05.png',
  'assets/boards/obstacles/iron_marches/obstacle_06.png',
  'assets/boards/obstacles/iron_marches/obstacle_09.png',
  'assets/boards/obstacles/iron_marches/obstacle_10.png',
  'assets/boards/obstacles/iron_marches/obstacle_13.png',
  'assets/boards/obstacles/iron_marches/obstacle_14.png',
  'assets/boards/obstacles/mirror_conclave/obstacle_03.png',
  'assets/boards/obstacles/mirror_conclave/obstacle_05.png',
  'assets/boards/obstacles/mirror_conclave/obstacle_11.png',
  'assets/boards/obstacles/mirror_conclave/obstacle_15.png',
  'assets/boards/obstacles/sky_khanate/obstacle_02.png',
  'assets/boards/obstacles/sky_khanate/obstacle_03.png',
  'assets/boards/obstacles/sky_khanate/obstacle_05.png',
  'assets/boards/obstacles/sky_khanate/obstacle_08.png',
  'assets/boards/obstacles/sky_khanate/obstacle_10.png',
  'assets/boards/obstacles/sky_khanate/obstacle_12.png',
  'assets/boards/obstacles/verdant_exiles/obstacle_05.png',
  'assets/boards/obstacles/verdant_exiles/obstacle_07.png'
]);
function skirmishObstacleSquares() { return SKIRMISH_OBSTACLE_RANKS.flatMap((rank) => [...FILES].map((file) => `${file}${rank}`)); }
function generateSkirmishObstacles(seed = 'rpchess-skirmish') {
  const random = seededRandom(`${seed}:skirmish-obstacles:v1`);
  const count = SKIRMISH_OBSTACLE_MIN_COUNT + Math.floor(random() * (SKIRMISH_OBSTACLE_MAX_COUNT - SKIRMISH_OBSTACLE_MIN_COUNT + 1));
  const squares = shuffle(skirmishObstacleSquares(), random).slice(0, count);
  const assets = shuffle(OBSTACLE_PROP_PATHS, random);
  return Object.freeze(squares.map((square, index) => Object.freeze({ square, asset: assets[index] })));
}

export { OBSTACLE_REGIONS, OBSTACLE_CELLS_PER_REGION, OBSTACLE_PROP_PATHS, SKIRMISH_OBSTACLE_MIN_COUNT, SKIRMISH_OBSTACLE_MAX_COUNT, SKIRMISH_OBSTACLE_RANKS, skirmishObstacleSquares, generateSkirmishObstacles };
