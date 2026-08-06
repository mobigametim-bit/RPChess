'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'content/manifests/register-04-events.json'), 'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(root, 'content/audits/register_04_event_assets.json'), 'utf8'));

function pngSize(buffer) {
  assert.strictEqual(buffer.subarray(1, 4).toString('ascii'), 'PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

(async () => {
  assert.strictEqual(manifest.register, 'REGISTER_04_EVENTS');
  assert.strictEqual(manifest.count, 74);
  assert.strictEqual(audit.importedCount, 74);
  assert.strictEqual(audit.uniqueIllustrationCount, 74);
  assert.strictEqual(audit.eventRecordCount, 140);
  assert.strictEqual(audit.status, 'SUPPLIED_ART_COMPLETE');
  assert.strictEqual(new Set(manifest.assets.map((entry) => entry.slug)).size, 74);
  assert.strictEqual(new Set(manifest.assets.map((entry) => entry.path)).size, 74);

  for (const asset of manifest.assets) {
    const absolute = path.join(root, asset.path);
    assert(fs.existsSync(absolute), `missing ${asset.path}`);
    const bytes = fs.readFileSync(absolute);
    assert.deepStrictEqual(pngSize(bytes), [1600, 900], asset.path);
    assert.strictEqual(asset.status, 'IMPORTED');
  }

  const resolver = await import(pathToFileURL(path.join(root, 'game/js/register-04-event-assets.mjs')).href);
  assert.strictEqual(resolver.REGISTER_04_UNIQUE_ASSET_COUNT, 74);
  for (const asset of manifest.assets) {
    const expected = asset.path.replace(/^game\//, '');
    assert.strictEqual(resolver.register04EventAsset(`event.${asset.slug}`), expected, asset.slug);
    assert.strictEqual(resolver.hasRegister04EventAsset(`event.${asset.slug}`), true, asset.slug);
  }

  assert.strictEqual(resolver.register04EventAsset('event.prisoners_pass'), 'assets/events/register-04/prisoners_of_the_pass.png');
  assert.strictEqual(resolver.register04EventAsset('event.duel_masons'), 'assets/events/register-04/duel_of_masons.png');
  assert.strictEqual(resolver.register04EventAsset('event.knight_lost_between_gates'), 'assets/events/register-04/thorn_covenant/knight_between_gates.png');
  assert.strictEqual(resolver.register04EventAsset('event.board_beyond_the_board'), 'assets/events/register-04/secret/board_beyond_board.png');
  assert.strictEqual(resolver.hasRegister04EventAsset('event.not_imported'), false);
  assert.strictEqual(resolver.register04EventAsset('event.not_imported'), 'generated_assets/scene_event.jpg');

  console.log('Register 04 event assets: 74/74 supplied illustrations imported, audited and resolved.');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
