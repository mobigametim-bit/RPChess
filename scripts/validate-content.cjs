const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const game = path.join(root, 'game');

function fail(message) {
  throw new Error(`[content validation] ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function exists(relative) {
  const full = path.join(game, relative);
  return fs.existsSync(full) && fs.statSync(full).isFile();
}

(async () => {
  const registryUrl = `${pathToFileURL(path.join(game, 'js/content/content-registry.mjs')).href}?validation=${Date.now()}`;
  const { CONTENT_REGISTRY, CONTENT_ASSET_PATHS } = await import(registryUrl);
  const pieceTypes = new Set(['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']);

  assert(CONTENT_REGISTRY.version === 1, 'registry version must be 1');
  assert(Array.isArray(CONTENT_REGISTRY.races) && CONTENT_REGISTRY.races.length === 14, `expected 14 races, got ${CONTENT_REGISTRY.races?.length}`);
  assert(new Set(CONTENT_REGISTRY.races.map((race) => race.id)).size === CONTENT_REGISTRY.races.length, 'race ids must be unique');

  for (const race of CONTENT_REGISTRY.races) {
    assert(typeof race.id === 'string' && race.id.length > 0, 'race id is required');
    assert(typeof race.label === 'string' && race.label.length > 0, `race ${race.id} label is required`);
    assert(Array.isArray(race.pieceTypes) && race.pieceTypes.length === 6, `race ${race.id} must expose six chess piece roles`);
    assert(race.pieceTypes.every((pieceType) => pieceTypes.has(pieceType)), `race ${race.id} contains an unknown chess role`);
    const expectedPieceAssets = race.id === 'humans' ? 12 : 6;
    assert(race.pieceAssets.length === expectedPieceAssets, `race ${race.id} must expose ${expectedPieceAssets} piece assets`);
    assert(race.eventBackgrounds.length === 2, `race ${race.id} must expose two event backgrounds`);
  }

  assert(Array.isArray(CONTENT_REGISTRY.heroes) && CONTENT_REGISTRY.heroes.length >= 34, `expected at least 34 personalized characters, got ${CONTENT_REGISTRY.heroes?.length}`);
  assert(new Set(CONTENT_REGISTRY.heroes.map((hero) => hero.id)).size === CONTENT_REGISTRY.heroes.length, 'hero ids must be unique');
  assert(CONTENT_REGISTRY.heroes.filter((hero) => hero.isRunKing).length === 1, 'exactly one personalized run king is required');
  for (const hero of CONTENT_REGISTRY.heroes) {
    assert(pieceTypes.has(hero.pieceType), `hero ${hero.id} has unknown chess role ${hero.pieceType}`);
    assert(typeof hero.name === 'string' && hero.name.length > 0, `hero ${hero.id} name is required`);
    assert(typeof hero.origin === 'string' && hero.origin.length > 0, `hero ${hero.id} origin is required`);
    assert(typeof hero.portrait === 'string' && hero.portrait.length > 0, `hero ${hero.id} portrait is required`);
    assert(typeof hero.pieceArt === 'string' && hero.pieceArt.length > 0, `hero ${hero.id} pieceArt is required`);
  }

  assert(Array.isArray(CONTENT_REGISTRY.encounterTypes), 'encounterTypes must be an array');
  assert(new Set(CONTENT_REGISTRY.encounterTypes).size === CONTENT_REGISTRY.encounterTypes.length, 'encounter types must be unique');
  for (const requiredType of ['skirmish', 'battle', 'settlement', 'event', 'puzzle']) {
    assert(CONTENT_REGISTRY.encounterTypes.includes(requiredType), `missing encounter type ${requiredType}`);
  }

  const knownRaces = new Set([...CONTENT_REGISTRY.races.map((race) => race.id), 'mixed']);
  const events = CONTENT_REGISTRY.adapters.events.catalog;
  assert(events.length === CONTENT_REGISTRY.adapters.events.expectedEvents, `expected ${CONTENT_REGISTRY.adapters.events.expectedEvents} events, got ${events.length}`);
  assert(new Set(events.map((event) => event.id)).size === events.length, 'event ids must be unique');
  let choiceCount = 0;
  for (const event of events) {
    assert(knownRaces.has(event.raceTag), `event ${event.id} references unknown raceTag ${event.raceTag}`);
    assert(Array.isArray(event.choices) && event.choices.length > 0, `event ${event.id} must contain choices`);
    choiceCount += event.choices.length;
  }
  assert(choiceCount === CONTENT_REGISTRY.adapters.events.expectedChoices, `expected ${CONTENT_REGISTRY.adapters.events.expectedChoices} event choices, got ${choiceCount}`);

  const eventBackgroundCount = CONTENT_REGISTRY.assets.genericEventBackgrounds.length + CONTENT_REGISTRY.races.reduce((sum, race) => sum + race.eventBackgrounds.length, 0);
  assert(eventBackgroundCount === 36, `expected 36 registered event backgrounds, got ${eventBackgroundCount}`);

  for (const relative of CONTENT_ASSET_PATHS) {
    assert(!relative.includes('..'), `asset path must stay inside game root: ${relative}`);
    assert(exists(relative), `missing registered asset: ${relative}`);
  }

  for (const adapter of Object.values(CONTENT_REGISTRY.adapters)) {
    if (adapter.module) assert(exists(adapter.module), `missing adapter module: ${adapter.module}`);
    if (adapter.presentationModule) assert(exists(adapter.presentationModule), `missing adapter presentation module: ${adapter.presentationModule}`);
    if (adapter.source) assert(exists(adapter.source), `missing adapter source: ${adapter.source}`);
  }

  assert(CONTENT_REGISTRY.adapters.puzzles.provider === 'Lichess Open Database Puzzles', 'Puzzle provider must remain Lichess Open Database Puzzles');
  assert(CONTENT_REGISTRY.adapters.puzzles.license === 'CC0', 'Puzzle license must remain CC0');
  assert(CONTENT_REGISTRY.adapters.puzzles.expectedEntries === 11498, 'Puzzle catalog baseline must remain 11,498');
  assert(CONTENT_REGISTRY.adapters.puzzles.levels === 12, 'Puzzle adapter must expose 12 levels');
  assert(CONTENT_REGISTRY.adapters.settlement.offerCount === 3, 'Settlement adapter must expose three offers');
  assert(CONTENT_REGISTRY.adapters.settlement.recruitIds.length === 33, `expected 33 Settlement recruits, got ${CONTENT_REGISTRY.adapters.settlement.recruitIds.length}`);

  console.log(`Content Framework validation: PASS — ${CONTENT_REGISTRY.races.length} races, ${CONTENT_REGISTRY.heroes.length} personalized characters, ${events.length} events / ${choiceCount} choices, ${CONTENT_ASSET_PATHS.length} registered asset references.`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
