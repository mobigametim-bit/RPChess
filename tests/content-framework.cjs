const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const game = path.resolve(__dirname, '..', 'game');
  const registry = await import(pathToFileURL(path.join(game, 'js/content/content-registry.mjs')).href);
  assert.strictEqual(registry.CONTENT_REGISTRY.version, 1);
  assert.strictEqual(registry.CONTENT_RACES.length, 14);
  assert(registry.CONTENT_HEROES.length >= 34);
  assert.strictEqual(registry.CONTENT_REGISTRY.adapters.events.catalog.length, 100);
  assert.strictEqual(registry.CONTENT_REGISTRY.adapters.events.catalog.reduce((sum, event) => sum + event.choices.length, 0), 415);
  assert.strictEqual(registry.CONTENT_REGISTRY.adapters.settlement.recruitIds.length, 33);
  assert.strictEqual(registry.CONTENT_REGISTRY.adapters.puzzles.expectedEntries, 11498);
  assert.deepStrictEqual([...registry.ENCOUNTER_TYPES], ['skirmish', 'battle', 'settlement', 'event', 'puzzle']);
  assert(registry.CONTENT_ASSET_PATHS.includes('generated_assets/scene_campaign.jpg'));
  assert(registry.CONTENT_ASSET_PATHS.includes('generated_assets/scene_reward.jpg'));
  assert(registry.CONTENT_ASSET_PATHS.includes('generated_assets/scene_defeat.jpg'));
  assert(registry.CONTENT_ASSET_PATHS.includes('generated_assets/node_story.png'));
  assert(registry.contentRace('dragonborn'));
  assert.strictEqual(registry.contentHero('hero.aldric_wall')?.pieceType, 'rook');
  assert.strictEqual(registry.contentHero('king.oathkeeper')?.isRunKing, true);
  console.log('Content Framework registry/adapters regression: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
