'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));
const exists = (relative) => fs.existsSync(path.join(root, relative));

const ANNEXES = Object.freeze([
  'register/REGISTER_01_FOUNDATIONS.md',
  'register/REGISTER_02_HEROES_AND_POLITICS.md',
  'register/REGISTER_03_RELICS.md',
  'register/REGISTER_04_EVENTS.md',
  'register/REGISTER_05_ENCOUNTERS_AND_BOSSES.md'
]);

function repoPathFromCanonical(canonical) {
  return canonical.startsWith('game/') ? canonical : path.join('game', canonical);
}

(async () => {
  const master = read('CONTENT_AND_ASSET_PRODUCTION_REGISTER.md');
  for (const annex of ANNEXES) {
    assert(exists(annex), `missing annex ${annex}`);
    const filename = path.basename(annex);
    assert(master.includes(`(${annex})`), `master register link is missing or stale for ${filename}`);
  }

  const register01 = json('content/assets/register_01_assets.json');
  const register02 = json('content/assets/register_02_assets.json');
  const register03 = json('content/manifests/register-03-relics.json');
  const register04 = json('content/manifests/register-04-events.json');
  const register05 = json('content/manifests/register-05-boss-assets.json');

  assert.strictEqual(register01.assetCount, 141);
  assert.strictEqual(register02.assetCount, 126);
  assert.strictEqual(register03.records.length, 72);
  assert.strictEqual(register04.count, 74);
  assert.strictEqual(register05.assetCount, 105);
  assert.strictEqual(register05.bossCount, 15);

  const register01Paths = register01.assets.map((entry) => entry.repositoryPath);
  const register02Paths = register02.assets.map((entry) => entry.repositoryPath);
  const register03Paths = register03.records.map((entry) => repoPathFromCanonical(entry.path));
  const register04Paths = register04.assets.map((entry) => entry.path);
  const register05Paths = register05.bosses.flatMap((boss) => {
    const base = `game/assets/bosses/${boss.slug}`;
    return [
      `${base}/portrait.png`, `${base}/piece.png`, `${base}/arena.jpg`,
      `${base}/phase_01.png`, `${base}/phase_02.png`, `${base}/phase_03.png`, `${base}/phase_transition.png`
    ];
  });

  const families = [
    ['REGISTER_01', register01Paths, 141],
    ['REGISTER_02', register02Paths, 126],
    ['REGISTER_03', register03Paths, 72],
    ['REGISTER_04', register04Paths, 74],
    ['REGISTER_05_BOSS_ART', register05Paths, 105]
  ];
  for (const [name, paths, count] of families) {
    assert.strictEqual(paths.length, count, `${name} manifest count`);
    assert.strictEqual(new Set(paths).size, count, `${name} duplicate canonical path`);
    for (const relative of paths) assert(exists(relative), `${name} missing file ${relative}`);
  }

  const allPaths = families.flatMap(([, paths]) => paths);
  assert.strictEqual(allPaths.length, 518);
  assert.strictEqual(new Set(allPaths).size, 518, 'cross-register repository paths must be unique');

  const r01 = await import(pathToFileURL(path.join(root, 'game/js/register-01-assets.mjs')).href);
  const r02 = await import(pathToFileURL(path.join(root, 'game/js/register-02-assets.mjs')).href);
  const r03 = await import(pathToFileURL(path.join(root, 'game/js/register-03-relic-assets.mjs')).href);
  const r04 = await import(pathToFileURL(path.join(root, 'game/js/register-04-event-assets.mjs')).href);
  const r05 = await import(pathToFileURL(path.join(root, 'game/js/register-05-boss-assets.mjs')).href);

  assert.strictEqual(r01.allRegister01Paths().length, 141);
  assert.strictEqual(r02.allRegister02Paths().length, 126);
  assert.strictEqual(r03.allRegister03Paths().length, 72);
  assert.strictEqual(r04.REGISTER_04_UNIQUE_ASSET_COUNT, 74);
  assert.strictEqual(r05.allRegister05BossPaths().length, 105);

  for (const relative of r01.allRegister01Paths()) assert(exists(repoPathFromCanonical(relative)), `R01 catalog ${relative}`);
  for (const relative of r02.allRegister02Paths()) assert(exists(repoPathFromCanonical(relative)), `R02 catalog ${relative}`);
  for (const relative of r03.allRegister03Paths()) assert(exists(repoPathFromCanonical(relative)), `R03 catalog ${relative}`);
  for (const relative of r05.allRegister05BossPaths()) assert(exists(repoPathFromCanonical(relative)), `R05 catalog ${relative}`);
  for (const asset of register04.assets) {
    const runtimePath = asset.path.replace(/^game\//, '');
    assert.strictEqual(r04.register04EventAsset(`event.${asset.slug}`), runtimePath, asset.slug);
  }

  const verticalPresenter = read('game/js/vertical-slice-presenter.mjs');
  const runSelectionPresenter = read('game/js/run-selection-presenter.mjs');
  const relicCodex = read('game/js/register-03-relic-codex.mjs');
  const bossPresenter = read('game/js/production-vertical-slice-presenter.mjs');
  assert(verticalPresenter.includes("from './register-01-assets.mjs'"), 'Register 01 must feed the runtime presenter');
  assert(verticalPresenter.includes("from './register-04-event-assets.mjs'"), 'Register 04 must feed event scene resolution');
  assert(runSelectionPresenter.includes("from './register-02-assets.mjs'"), 'Register 02 must feed hero selection');
  assert(relicCodex.includes("from './register-03-relic-assets.mjs'"), 'Register 03 must feed relic UI');
  assert(bossPresenter.includes("from './register-05-boss-assets.mjs'"), 'Register 05 boss art must feed boss presentation');

  const pack = json('content/packs/iron_marches_vertical_slice.json');
  const ironBoss = pack.content.bosses.find((entry) => entry.id === 'boss.iron_regent');
  assert(ironBoss, 'Iron Regent boss record is missing');
  const canonicalBoss = r05.bossAssets(ironBoss.id);
  assert.strictEqual(ironBoss.assets.portrait, canonicalBoss.portrait);
  assert.strictEqual(ironBoss.assets.piece, canonicalBoss.piece);
  assert.strictEqual(ironBoss.assets.arena, canonicalBoss.arena);
  assert.strictEqual(ironBoss.assets.phaseTransition, canonicalBoss.phaseTransition);
  for (const sigil of ironBoss.assets.phaseSigils) assert(canonicalBoss.phaseSigils.includes(sigil), `non-canonical Iron Regent sigil ${sigil}`);

  console.log('Register 01–05 integrity: 5 annex links valid; 518 supplied visual assets exist, are unique and are covered by canonical runtime catalogs.');
  console.log('Runtime wiring: R01 board/regions, R02 heroes/politics, R03 relics, R04 event scenes and R05 boss art are connected; future-region assets remain catalogued until their gameplay content is implemented.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
