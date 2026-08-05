const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PNG_SIGNATURE } = require('../src/assets/board-manifest.cjs');
const {
  normalizeCanonicalPath,
  planBoardAssetIntake,
  applyBoardAssetIntake
} = require('../src/assets/intake.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function fakePng(width, height, colorType = 2) {
  const buffer = Buffer.alloc(26);
  PNG_SIGNATURE.copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 4, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = 8;
  buffer[25] = colorType;
  return buffer;
}

function write(root, relativePath, buffer) {
  const absolute = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, buffer);
  return absolute;
}

function fixtureManifest() {
  return {
    schemaVersion: 1,
    themes: [{
      id: 'neutral',
      priority: 'P0',
      light: 'assets/boards/neutral/tile_light.png',
      dark: 'assets/boards/neutral/tile_dark.png'
    }]
  };
}

function tempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rpchess-intake-'));
  fs.mkdirSync(path.join(root, 'game/generated_assets'), { recursive: true });
  return root;
}

test('canonical paths stay relative and preserve nested register paths', () => {
  assert.strictEqual(normalizeCanonicalPath('./assets/regions/iron_marches/tile_light.png'), 'assets/regions/iron_marches/tile_light.png');
  assert.throws(() => normalizeCanonicalPath('../outside.png'), /must stay relative/);
  assert.throws(() => normalizeCanonicalPath('/absolute.png'), /must stay relative/);
});

test('missing board cells are reported without blocking development intake', () => {
  const root = tempProject();
  try {
    const plan = planBoardAssetIntake({ projectRoot: root, manifest: fixtureManifest() });
    assert.strictEqual(plan.counts.missing, 2);
    assert.strictEqual(plan.blocking.length, 0);
    assert.strictEqual(plan.missingP0.length, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('valid staged cells are copied to canonical runtime paths', () => {
  const root = tempProject();
  try {
    const light = 'assets/boards/neutral/tile_light.png';
    const dark = 'assets/boards/neutral/tile_dark.png';
    write(path.join(root, 'game/generated_assets'), light, fakePng(512, 512, 2));
    write(path.join(root, 'game/generated_assets'), dark, fakePng(512, 512, 6));

    let plan = planBoardAssetIntake({ projectRoot: root, manifest: fixtureManifest() });
    assert.strictEqual(plan.counts.ready_to_integrate, 2);
    const result = applyBoardAssetIntake(plan);
    assert.strictEqual(result.copied.length, 2);
    assert.strictEqual(fs.existsSync(path.join(root, 'game', light)), true);
    assert.strictEqual(fs.existsSync(path.join(root, 'game', dark)), true);

    plan = planBoardAssetIntake({ projectRoot: root, manifest: fixtureManifest() });
    assert.strictEqual(plan.counts.duplicate, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('different staged replacement requires explicit review and replace option', () => {
  const root = tempProject();
  try {
    const light = 'assets/boards/neutral/tile_light.png';
    write(path.join(root, 'game'), light, fakePng(512, 512, 2));
    write(path.join(root, 'game/generated_assets'), light, fakePng(512, 512, 6));
    const plan = planBoardAssetIntake({ projectRoot: root, manifest: fixtureManifest() });
    const entry = plan.entries.find((item) => item.kind === 'light');
    assert.strictEqual(entry.state, 'replacement_review');
    assert.strictEqual(plan.blocking.length, 1);
    assert.strictEqual(applyBoardAssetIntake(plan).copied.length, 0);
    assert.strictEqual(applyBoardAssetIntake(plan, { replace: true }).copied.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('invalid staged dimensions block intake and never overwrite runtime', () => {
  const root = tempProject();
  try {
    const light = 'assets/boards/neutral/tile_light.png';
    write(path.join(root, 'game/generated_assets'), light, fakePng(1024, 512));
    const plan = planBoardAssetIntake({ projectRoot: root, manifest: fixtureManifest() });
    const entry = plan.entries.find((item) => item.kind === 'light');
    assert.strictEqual(entry.state, 'invalid_staging');
    assert.match(entry.staging.error, /expected 512x512/);
    assert.strictEqual(applyBoardAssetIntake(plan).copied.length, 0);
    assert.strictEqual(fs.existsSync(path.join(root, 'game', light)), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('valid staged cell can repair an invalid runtime cell', () => {
  const root = tempProject();
  try {
    const dark = 'assets/boards/neutral/tile_dark.png';
    write(path.join(root, 'game'), dark, fakePng(256, 256));
    write(path.join(root, 'game/generated_assets'), dark, fakePng(512, 512));
    let plan = planBoardAssetIntake({ projectRoot: root, manifest: fixtureManifest() });
    const entry = plan.entries.find((item) => item.kind === 'dark');
    assert.strictEqual(entry.state, 'ready_to_repair');
    assert.strictEqual(applyBoardAssetIntake(plan).copied.length, 1);
    plan = planBoardAssetIntake({ projectRoot: root, manifest: fixtureManifest() });
    assert.strictEqual(plan.entries.find((item) => item.kind === 'dark').state, 'duplicate');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
  }
}
console.log(`\nProduction asset intake: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
