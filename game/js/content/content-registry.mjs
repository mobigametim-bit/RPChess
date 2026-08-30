import { RACE_TAGS, RACE_LABELS, BACKGROUND_POOLS, PIECE_TYPES, racePiecePath } from '../race-assets.mjs';
import { STARTER_TEMPLATES } from '../roster-data.mjs';
import { RECRUIT_LIBRARY } from '../settlement-core.mjs';
import { EVENT_CATALOG } from '../events-data.mjs';

const ENCOUNTER_TYPES = Object.freeze(['skirmish', 'battle', 'settlement', 'event', 'puzzle']);

const CORE_ASSETS = Object.freeze([
  'generated_assets/title_wordmark.png',
  'generated_assets/splash_poster.jpg',
  'generated_assets/scene_campaign.jpg',
  'generated_assets/scene_reward.jpg',
  'generated_assets/scene_defeat.jpg',
  'generated_assets/scene_victory.jpg',
  'generated_assets/node_battle.png',
  'generated_assets/node_elite.png',
  'generated_assets/node_shop.png',
  'generated_assets/node_story.png',
  'generated_assets/node_training.png',
  'generated_assets/reward_gold.png',
  'assets/kings/oathkeeper/portrait.png',
  'assets/kings/oathkeeper/piece.png',
  'SFX/win_fanfare.mp3'
]);

function eventBackgroundAssets(raceTag) {
  const pool = BACKGROUND_POOLS[raceTag] || [];
  return Object.freeze(pool.map((filename) => `assets/events/register-04/backgrounds/${raceTag}/${filename}`));
}

function pieceAssets(raceTag) {
  if (raceTag === 'humans') {
    return Object.freeze(['w', 'b'].flatMap((color) => PIECE_TYPES.map((pieceType) => racePiecePath(raceTag, pieceType, color))));
  }
  return Object.freeze(PIECE_TYPES.map((pieceType) => racePiecePath(raceTag, pieceType, 'b')));
}

const CONTENT_RACES = Object.freeze(RACE_TAGS.map((id) => Object.freeze({
  id,
  label: RACE_LABELS[id],
  pieceTypes: PIECE_TYPES,
  pieceAssets: pieceAssets(id),
  eventBackgrounds: eventBackgroundAssets(id)
})));

const heroById = new Map();
for (const source of [...STARTER_TEMPLATES, ...RECRUIT_LIBRARY]) {
  if (!source?.id) continue;
  heroById.set(source.id, Object.freeze({
    id: source.id,
    name: source.name,
    pieceType: source.pieceType,
    origin: source.origin,
    portrait: source.portrait,
    pieceArt: source.pieceArt,
    description: source.description,
    isRunKing: Boolean(source.isRunKing)
  }));
}
const CONTENT_HEROES = Object.freeze([...heroById.values()]);
const GENERIC_EVENT_BACKGROUNDS = Object.freeze((BACKGROUND_POOLS.generic || []).map((filename) => `assets/events/register-04/backgrounds/generic/${filename}`));

const CONTENT_ASSET_PATHS = Object.freeze([...new Set([
  ...CORE_ASSETS,
  ...GENERIC_EVENT_BACKGROUNDS,
  ...CONTENT_RACES.flatMap((race) => [...race.pieceAssets, ...race.eventBackgrounds]),
  ...CONTENT_HEROES.flatMap((hero) => [hero.portrait, hero.pieceArt])
])]);

const CONTENT_REGISTRY = Object.freeze({
  version: 1,
  races: CONTENT_RACES,
  heroes: CONTENT_HEROES,
  encounterTypes: ENCOUNTER_TYPES,
  assets: Object.freeze({
    core: CORE_ASSETS,
    genericEventBackgrounds: GENERIC_EVENT_BACKGROUNDS,
    all: CONTENT_ASSET_PATHS
  }),
  adapters: Object.freeze({
    events: Object.freeze({
      module: 'js/events-data.mjs',
      presentationModule: 'js/events/event-content-v3.mjs',
      catalog: EVENT_CATALOG,
      expectedEvents: 100,
      expectedChoices: 415
    }),
    puzzles: Object.freeze({
      module: 'js/puzzles/puzzle-catalog.mjs',
      source: 'js/puzzles/catalog-data/puzzle-catalog-11498.json.gz',
      provider: 'Lichess Open Database Puzzles',
      license: 'CC0',
      expectedEntries: 11498,
      levels: 12
    }),
    settlement: Object.freeze({
      module: 'js/settlement-core.mjs',
      offerCount: 3,
      recruitIds: Object.freeze(RECRUIT_LIBRARY.map((hero) => hero.id))
    })
  })
});

function contentRace(id) {
  return CONTENT_RACES.find((race) => race.id === id) || null;
}

function contentHero(id) {
  return heroById.get(id) || null;
}

export {
  CONTENT_REGISTRY,
  CONTENT_RACES,
  CONTENT_HEROES,
  CONTENT_ASSET_PATHS,
  ENCOUNTER_TYPES,
  CORE_ASSETS,
  contentRace,
  contentHero
};
