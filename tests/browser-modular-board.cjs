const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { buildBoardCellPlan, technicalTileSet: coreTechnicalTileSet } = require('../src/rendering/modular-board.cjs');

class FakeContext {
  constructor(width = 800, height = 600) {
    this.canvas = { width, height, clientWidth: width, clientHeight: height, style: {} };
    this.calls = [];
    this.fillStyle = '';
    this.strokeStyle = '';
    this.lineWidth = 1;
    this.font = '';
    this.textAlign = '';
    this.textBaseline = '';
  }
  record(name, args) { this.calls.push({ name, args: Array.from(args) }); }
  save() { this.record('save', arguments); }
  restore() { this.record('restore', arguments); }
  clearRect() { this.record('clearRect', arguments); }
  fillRect() { this.record('fillRect', arguments); }
  strokeRect() { this.record('strokeRect', arguments); }
  drawImage() { this.record('drawImage', arguments); }
  fillText() { this.record('fillText', arguments); }
  beginPath() { this.record('beginPath', arguments); }
  moveTo() { this.record('moveTo', arguments); }
  lineTo() { this.record('lineTo', arguments); }
  stroke() { this.record('stroke', arguments); }
  setTransform() { this.record('setTransform', arguments); }
}

(async () => {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, '../game/js/modular-board-renderer.mjs')).href;
  const browser = await import(moduleUrl);
  const tests = [];
  const test = (name, fn) => tests.push({ name, fn });

  function comparable(plan) {
    return {
      width: plan.width,
      height: plan.height,
      flipped: plan.flipped,
      tileSet: plan.tileSet,
      cells: plan.cells.map((cell) => ({
        x: cell.x,
        y: cell.y,
        displayX: cell.displayX,
        displayY: cell.displayY,
        square: cell.square,
        active: cell.active,
        parity: cell.parity,
        asset: cell.asset,
        fallback: cell.fallback
      }))
    };
  }

  test('browser plan stays byte-equivalent to the production modular board planner', () => {
    const tileSet = {
      id: 'neutral',
      light: 'assets/boards/neutral/tile_light.png',
      dark: 'assets/boards/neutral/tile_dark.png',
      fallbackLight: '#aaa',
      fallbackDark: '#333'
    };
    const variants = [
      { width: 8, height: 8, tileSet },
      { width: 8, height: 8, tileSet, flipped: true, activeCells: ['a8', 'h8', 'd4', 'a1', 'h1'] },
      { width: 10, height: 6, tileSet, lightOnEven: false }
    ];
    for (const options of variants) {
      assert.deepStrictEqual(
        comparable(browser.buildBrowserBoardPlan(options)),
        comparable(buildBoardCellPlan(options))
      );
    }
  });

  test('technical fallback renders only active cells and needs no raster board asset', () => {
    const plan = browser.buildBrowserBoardPlan({
      width: 5,
      height: 5,
      activeCells: ['a5', 'e5', 'c3', 'a1', 'e1'],
      tileSet: browser.technicalTileSet()
    });
    const context = new FakeContext(500, 500);
    const report = browser.renderModularBoard(context, plan, {
      canvasWidth: 500,
      canvasHeight: 500,
      padding: 20,
      background: '#111'
    });
    assert.strictEqual(report.activeCells, 5);
    assert.strictEqual(report.inactiveCells, 20);
    assert.strictEqual(report.fallbackCells, 5);
    assert.strictEqual(report.imageCells, 0);
    assert.deepStrictEqual(report.missingAssets, []);
    assert.strictEqual(context.calls.filter((call) => call.name === 'drawImage').length, 0);
    assert.strictEqual(context.calls.filter((call) => call.name === 'strokeRect').length, 5);
  });

  test('loaded light and dark cell images replace every technical fallback', () => {
    class ImmediateImage {
      set src(value) { this._src = value; this.onload(); }
      get src() { return this._src; }
    }
    const tileSet = {
      id: 'forest',
      light: 'assets/regions/forest/tile_light.png',
      dark: 'assets/regions/forest/tile_dark.png'
    };
    const cache = new browser.TileImageCache({ ImageCtor: ImmediateImage }).prime([tileSet.light, tileSet.dark]);
    const plan = browser.buildBrowserBoardPlan({ width: 8, height: 8, tileSet });
    const context = new FakeContext(640, 640);
    const report = browser.renderModularBoard(context, plan, {
      canvasWidth: 640,
      canvasHeight: 640,
      assetCache: cache,
      showCoordinates: false
    });
    assert.strictEqual(report.imageCells, 64);
    assert.strictEqual(report.fallbackCells, 0);
    assert.deepStrictEqual(report.missingAssets, []);
    assert.strictEqual(context.calls.filter((call) => call.name === 'drawImage').length, 64);
  });

  test('missing one tile image falls back per cell and reports only that canonical asset', () => {
    class PartialImage {
      set src(value) {
        this._src = value;
        if (value.includes('tile_dark')) this.onerror();
        else this.onload();
      }
      get src() { return this._src; }
    }
    const tileSet = {
      id: 'thorn',
      light: 'assets/regions/thorn/tile_light.png',
      dark: 'assets/regions/thorn/tile_dark.png'
    };
    const cache = new browser.TileImageCache({ ImageCtor: PartialImage }).prime([tileSet.light, tileSet.dark]);
    const plan = browser.buildBrowserBoardPlan({ width: 8, height: 8, tileSet });
    const report = browser.renderModularBoard(new FakeContext(640, 640), plan, {
      canvasWidth: 640,
      canvasHeight: 640,
      assetCache: cache,
      showCoordinates: false
    });
    assert.strictEqual(report.imageCells, 32);
    assert.strictEqual(report.fallbackCells, 32);
    assert.deepStrictEqual(report.missingAssets, [tileSet.dark]);
  });

  test('viewport fits rectangular and non-standard boards without stretching cells', () => {
    const viewport = browser.calculateBoardViewport({
      canvasWidth: 1000,
      canvasHeight: 600,
      boardWidth: 10,
      boardHeight: 6,
      padding: 20
    });
    assert.strictEqual(viewport.cellSize, 93);
    assert.strictEqual(viewport.width, 930);
    assert.strictEqual(viewport.height, 558);
    assert.strictEqual(viewport.x, 35);
    assert.strictEqual(viewport.y, 21);
  });

  test('high-DPI resize keeps CSS geometry separate from backing resolution', () => {
    const context = new FakeContext(1, 1);
    const canvas = {
      width: 0,
      height: 0,
      style: {},
      getContext: () => context
    };
    context.canvas = canvas;
    const display = browser.resizeCanvasForDisplay(canvas, 400, 300, 2);
    assert.strictEqual(canvas.width, 800);
    assert.strictEqual(canvas.height, 600);
    assert.strictEqual(canvas.style.width, '400px');
    assert.strictEqual(canvas.style.height, '300px');
    assert.strictEqual(display.cssWidth, 400);
    assert.strictEqual(context.calls.some((call) => call.name === 'setTransform' && call.args[0] === 2), true);
  });

  test('renderer invokes overlays once per active logical cell after tile drawing', () => {
    const plan = browser.buildBrowserBoardPlan({ width: 3, height: 3, tileSet: browser.technicalTileSet() });
    const context = new FakeContext(300, 300);
    const squares = [];
    const report = browser.renderModularBoard(context, plan, {
      canvasWidth: 300,
      canvasHeight: 300,
      drawCellOverlay: (_context, cell, rect) => squares.push([cell.square, rect.size]),
      showCoordinates: false
    });
    assert.strictEqual(report.overlayCalls, 9);
    assert.strictEqual(squares.length, 9);
    assert.strictEqual(new Set(squares.map(([square]) => square)).size, 9);
  });

  test('browser tile sets reject complete boards, frames and underlays', () => {
    for (const field of browser.FORBIDDEN_TILESET_FIELDS) {
      assert.throws(() => browser.buildBrowserBoardPlan({
        tileSet: {
          id: 'invalid',
          light: 'tile_light.png',
          dark: 'tile_dark.png',
          [field]: 'forbidden.png'
        }
      }), /modular cells only/);
    }
    assert.deepStrictEqual(browser.technicalTileSet(), coreTechnicalTileSet());
  });

  let failures = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(error.stack || error);
    }
  }
  console.log(`\nBrowser modular board: ${tests.length - failures}/${tests.length} passed.`);
  if (failures) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
