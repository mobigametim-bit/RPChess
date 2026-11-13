/* Atlas Lab v6 world config (4) + visual preset (5), 2026-11-09.
 * Visual settings are author-chosen. Simulation economy is not live yet.
 * Biome order: forest, mountain, hills, plains, marsh, wasteland.
 * All visible terrain stamps, road/river strokes and decorative assets are fully opaque.
 * Fog and political tint remain intentionally translucent for gameplay readability.
 * Race order matches race-assets.mjs RACE_TAGS exactly.
 */
const VISUAL=Object.freeze({
  "landScale": 9.4,
  "detailScale": 4.2,
  "wetScale": 7.5,
  "largeWeight": 0.29,
  "mountainThreshold": 0.63,
  "hillThreshold": 0.56,
  "forestThreshold": 0.44,
  "stampSpacing": 1.55,
  "forestDensity": 2.4,
  "mountainDensity": 1.4,
  "hillDensity": 0.9,
  "plainDensity": 0.35,
  "stampSize": 2.2,
  "sizeVariation": 1.05,
  "stampOpacity": 1,
  "baseOpacity": 1,
  "baseSpacing": 6.5,
  "paperContrast": 1.6,
  "roadSpacing": 5,
  "roadWidth": 1.65,
  "roadCurve": 3,
  "roadOpacity": 1,
  "riverSpacing": 6,
  "riverWidth": 1.2,
  "riverCurve": 1.1,
  "riverOpacity": 1,
  "marshDensity": 2.05,
  "wastelandDensity": 1.8,
  "marshWetThreshold": 0.42,
  "marshSize": 1.85,
  "marshOpacity": 1,
  "landmarkDensity": 0.62,
  "landmarkSize": 0.75,
  "landmarkOpacity": 1,
  "fogOpacity": 0.98,
  "fogRadius": 1.1,
  "fogInner": 0.32,
  "fogInkOpacity": 0.2,
  "fogIrregularity": 0.3,
  "revealRadius": 1.6
});
// Atlas editor's approved view; runtime worlds retain their individual run seed.
const ATLAS_VIEW=Object.freeze({seed:'rpchess-kingdom-2026',centerX:1.1397535385320217,
 centerY:0.8734816261574075,zoom:117});
const BIOMES=Object.freeze(['forest','mountain','hills','plains','marsh','wasteland']);
const RACE_TAGS_ORDER=Object.freeze(['humans','elves','orcs','undead','dark_elves','dwarves','demons','angels','dragonborn','beastfolk','constructs','animals','fae','goblins']);
const ENCOUNTER_TYPES=Object.freeze(['battle','skirmish','caravan','settlement','event','puzzle']);
const DENSITY=Object.freeze([27,25,36,25,29,18]);
const SETTLEMENT_PROBABILITY_MULTIPLIER=1.2; // +20% of final settlement chance
const TYPE_WEIGHTS=Object.freeze([[12,22,11,10,28,17],[27,23,7,6,17,20],[19,24,13,11,16,17],[14,17,24,22,14,9],[20,23,5,5,32,15],[29,27,6,4,19,15]].map(row=>Object.freeze(row)));
const RACE_WEIGHTS=Object.freeze([[6,22,4,2,4,2,1,1,1,14,2,14,19,8],[5,2,9,3,5,17,6,16,20,5,4,3,1,4],[16,4,12,4,5,17,4,4,7,9,5,5,2,6],[25,6,8,4,3,6,3,5,3,9,6,11,5,6],[4,3,5,24,13,1,8,1,3,8,3,8,7,12],[4,1,13,16,6,3,22,1,9,6,9,2,1,7]].map(row=>Object.freeze(row)));
const DENSITY_MULTIPLIER=1.2;
// Atlas Lab v6 config (4): radius 1 king move, up to 3 OTHER encounters.
const EVENT_RADIUS=1;
const EVENT_NEARBY_MAX=3;
const ENCOUNTER_MIN_SPACING=EVENT_RADIUS; // historical alias
const WORLD_SETTINGS=Object.freeze({landmarks:true,roads:true,biomeInfluence:1,landmarkInfluence:1,roadInfluence:1});
const SCOUT_RADIUS=2;
export {VISUAL,ATLAS_VIEW,BIOMES,RACE_TAGS_ORDER,ENCOUNTER_TYPES,DENSITY,DENSITY_MULTIPLIER,ENCOUNTER_MIN_SPACING,SETTLEMENT_PROBABILITY_MULTIPLIER,TYPE_WEIGHTS,RACE_WEIGHTS,SCOUT_RADIUS,EVENT_RADIUS,EVENT_NEARBY_MAX,WORLD_SETTINGS};
