'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'content/manifests/register-05-boss-assets.json'), 'utf8'));

function pngSize(buffer) {
  assert.strictEqual(buffer.subarray(1, 4).toString('ascii'), 'PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function jpegSize(buffer) {
  assert.strictEqual(buffer[0], 0xff);
  assert.strictEqual(buffer[1], 0xd8);
  let offset = 2;
  while (offset < buffer.length) {
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = buffer.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return [buffer.readUInt16BE(offset + 5), buffer.readUInt16BE(offset + 3)];
    }
    offset += length;
  }
  throw new Error('JPEG dimensions not found');
}

(async () => {
  const assets = await import(pathToFileURL(path.join(root, 'game/js/register-05-boss-assets.mjs')).href);
  const presenter = await import(pathToFileURL(path.join(root, 'game/js/production-vertical-slice-presenter.mjs')).href);

  assert.strictEqual(manifest.register, 'REGISTER_05_ENCOUNTERS_AND_BOSSES');
  assert.strictEqual(manifest.status, 'SUPPLIED_ART_COMPLETE');
  assert.strictEqual(manifest.bossCount, 15);
  assert.strictEqual(manifest.assetCount, 105);
  assert.strictEqual(manifest.bosses.length, 15);
  assert.strictEqual(assets.BOSS_DEFINITIONS.length, 15);

  const catalogPaths = assets.allRegister05BossPaths();
  assert.strictEqual(catalogPaths.length, 105);
  assert.strictEqual(new Set(catalogPaths).size, 105);

  for (const boss of manifest.bosses) {
    const record = assets.bossAssets(boss.id);
    assert(record, boss.id);
    assert.strictEqual(record.slug, boss.slug);
    assert.strictEqual(record.regionId, boss.regionId);
    const expected = [record.portrait, record.piece, record.arena, ...record.phaseSigils, record.phaseTransition];
    assert.strictEqual(expected.length, 7);
    for (const relative of expected) {
      const absolute = path.join(root, 'game', relative);
      assert(fs.existsSync(absolute), `missing ${relative}`);
      const bytes = fs.readFileSync(absolute);
      if (relative.endsWith('.jpg')) assert.deepStrictEqual(jpegSize(bytes), [1600, 900], relative);
      else {
        const size = pngSize(bytes);
        if (relative.endsWith('/portrait.png')) assert.deepStrictEqual(size, [768, 768], relative);
        else if (relative.endsWith('/phase_transition.png')) assert.deepStrictEqual(size, [1024, 1024], relative);
        else assert.deepStrictEqual(size, [512, 512], relative);
      }
    }
  }

  assert.strictEqual(assets.bossAssets('boss.iron_regent').arena, 'assets/bosses/iron_regent/arena.jpg');
  assert.strictEqual(assets.bossAssets('iron_regent').portrait, 'assets/bosses/iron_regent/portrait.png');
  assert.strictEqual(assets.bossPhaseSigil('boss.iron_regent', 2), 'assets/bosses/iron_regent/phase_02.png');
  assert.strictEqual(assets.bossPhaseSigil('boss.iron_regent', 9), 'assets/bosses/iron_regent/phase_03.png');
  assert.strictEqual(assets.bossDisplayName('boss.widow_general'), 'Вдовствующая Генеральша');

  const boss = {
    bossId: 'boss.iron_regent', phaseNumber: 1, phaseCount: 2,
    currentPhaseId: 'furnace_seals', currentPhaseTitle: 'Печати горнов',
    nextPhaseId: 'collapsing_fortress', nextPhaseTitle: 'Падающая крепость',
    completedPhases: [{ phaseId: 'furnace_seals', actionCount: 4 }]
  };
  const markup = presenter.bossTransitionMarkup(boss);
  assert(markup.includes('assets/bosses/iron_regent/phase_transition.png'));
  assert(markup.includes('assets/bosses/iron_regent/phase_02.png'));
  assert(markup.includes('Падающая крепость'));

  console.log('Register 05 boss assets: 15 kits / 105 files validated and wired to the production presenter.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
