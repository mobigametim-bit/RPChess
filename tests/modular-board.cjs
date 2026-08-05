const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  fileLabel,
  fileIndex,
  parseSquare,
  buildBoardCellPlan,
  technicalTileSet,
  validateTileSet
} = require('../src/rendering/modular-board.cjs');
const {
  PNG_SIGNATURE,
  readPngDimensions,
  validateBoardThemeManifest,
  loadBoardThemeManifest,
  auditBoardThemeFiles
} = require('../src/assets/board-manifest.cjs');

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

function writeAsset(root, relativePath, width = 512, height = 512) {
  const absolute = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, fakePng(width, height));
}

test('file labels and square parsing support standard and extended boards', () => {
  assert.strictEqual(fileLabel(0), 'a');
  assert.strictEqual(fileLabel(25), 'z');
  assert.strictEqual(fileLabel(26), 'aa');
  assert.strictEqual(fileIndex('aa'), 26);
  assert.deepStrictEqual(parseSquare('h1', 8, 8), { x: 7, y: 7 });
  assert.deepStrictEqual(parseSquare('a8', 8, 8), { x: 0, y: 0 });
  assert.throws(() => parseSquare('i1', 8, 8), /outside board/);
});

test('standard board plan alternates one light and one dark modular tile', () => {
  const tileSet = {
    id: 'neutral',
    light: 'assets/boards/neutral/tile_light.png',
    dark: 'assets/boards/neutral/tile_dark.png'
  };
  const plan = buildBoardCellPlan({ width: 8, height: 8, tileSet });
  assert.strictEqual(plan.cells.length, 64);
  assert.strictEqual(plan.activeCells.length, 64);
  assert.strictEqual(plan.cells[0].square, 'a8');
  assert.strictEqual(plan.cells[0].parity, 'light');
  assert.strictEqual(plan.cells[1].parity, 'dark');
  assert.strictEqual(plan.cells[8].parity, 'dark');
  assert.strictEqual(plan.cells[63].square, 'h1');
});

test('non-standard active-cell configurations reuse the same tile pair', () => {
  const plan = buildBoardCellPlan({
    width: 5,
    height: 5,
    tileSet: technicalTileSet('fractured'),
    activeCells: ['a5', 'b5', 'd5', 'e5', 'a1', 'b1', 'd1', 'e1', 'c3']
  });
  assert.strictEqual(plan.activeCells.length, 9);
  assert.strictEqual(plan.inactiveCells.length, 16);
  assert.strictEqual(plan.cells.find((cell) => cell.square === 'c3').active, true);
  assert.strictEqual(plan.cells.find((cell) => cell.square === 'c5').asset, null);
  assert.strictEqual(new Set(plan.activeCells.map((cell) => cell.asset)).size, 2);
});

test('flipping changes display coordinates but preserves logical square and parity', () => {
  const plan = buildBoardCellPlan({ width: 8, height: 8, tileSet: technicalTileSet(), flipped: true });
  const a8 = plan.cells.find((cell) => cell.square === 'a8');
  assert.deepStrictEqual({ x: a8.x, y: a8.y, displayX: a8.displayX, displayY: a8.displayY }, { x: 0, y: 0, displayX: 7, displayY: 7 });
  assert.strictEqual(a8.parity, 'light');
});

test('tile sets reject complete boards, frames and underlays', () => {
  const base = { id: 'bad', light: 'tile_light.png', dark: 'tile_dark.png' };
  assert.throws(() => validateTileSet({ ...base, boardImage: 'board.png' }), /must not define boardImage/);
  assert.throws(() => validateTileSet({ ...base, frame: 'frame.png' }), /must not define frame/);
  assert.throws(() => validateTileSet({ ...base, underlay: 'underlay.png' }), /must not define underlay/);
});

test('canonical manifest contains neutral, six main and two rare modular themes', () => {
  const manifestPath = path.resolve(__dirname, '../content/assets/board-themes.json');
  const manifest = loadBoardThemeManifest(manifestPath);
  assert.strictEqual(manifest.themes.length, 9);
  assert.strictEqual(manifest.themes[0].id, 'neutral');
  for (const theme of manifest.themes) {
    assert.strictEqual(path.posix.basename(theme.light), 'tile_light.png');
    assert.strictEqual(path.posix.basename(theme.dark), 'tile_dark.png');
  }
});

test('manifest rejects duplicate IDs and non-canonical tile filenames', () => {
  assert.throws(() => validateBoardThemeManifest({
    schemaVersion: 1,
    themes: [
      { id: 'same', light: 'a/tile_light.png', dark: 'a/tile_dark.png' },
      { id: 'same', light: 'b/tile_light.png', dark: 'b/tile_dark.png' }
    ]
  }), /duplicate board theme id/);
  assert.throws(() => validateBoardThemeManifest({
    schemaVersion: 1,
    themes: [{ id: 'whole_board', light: 'board_light.png', dark: 'tile_dark.png' }]
  }), /must be named tile_light.png/);
});

test('PNG header audit verifies exact square dimensions', () => {
  assert.deepStrictEqual(readPngDimensions(fakePng(512, 512)), { width: 512, height: 512, bitDepth: 8, colorType: 2 });
  assert.throws(() => readPngDimensions(Buffer.from('not a png')), /too small|invalid PNG/);
});

test('asset audit allows missing work-in-progress files and rejects wrong dimensions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rpchess-board-'));
  try {
    const manifest = {
      schemaVersion: 1,
      themes: [{
        id: 'neutral',
        light: 'assets/boards/neutral/tile_light.png',
        dark: 'assets/boards/neutral/tile_dark.png'
      }]
    };
    let report = auditBoardThemeFiles(root, manifest, { allowMissing: true });
    assert.strictEqual(report.ok, true);
    assert.strictEqual(report.missing.length, 2);

    writeAsset(root, manifest.themes[0].light, 512, 512);
    writeAsset(root, manifest.themes[0].dark, 256, 512);
    report = auditBoardThemeFiles(root, manifest, { allowMissing: false });
    assert.strictEqual(report.ok, false);
    assert.strictEqual(report.errors.length, 1);
    assert.match(report.errors[0].message, /expected 512x512/);

    writeAsset(root, manifest.themes[0].dark, 512, 512);
    report = auditBoardThemeFiles(root, manifest, { allowMissing: false });
    assert.strictEqual(report.ok, true);
    assert.strictEqual(report.themes[0].ready, true);
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
console.log(`\nModular board foundation: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
