'use strict';

const assert = require('assert');
const { chromium } = require('playwright');

const BASE_URL = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';

async function clickSquare(page, square) {
  const point = await page.evaluate((wanted) => {
    const canvas = document.querySelector('[data-special-board]');
    const cell = globalThis.__rpchessSpecial.presenter.boardPlan.activeCells.find((entry) => entry.square === wanted);
    const viewport = globalThis.__rpchessSpecial.presenter.boardReport.viewport;
    const rect = canvas.getBoundingClientRect();
    return {
      x:rect.left + viewport.x + (cell.displayX + .5) * viewport.cellSize,
      y:rect.top + viewport.y + (cell.displayY + .5) * viewport.cellSize
    };
  }, square);
  await page.mouse.click(point.x, point.y);
}

async function commandAfter(page, commands, from, to, promotionChoice = null) {
  await page.evaluate((legalCommands) => globalThis.__rpchessSpecial.configure(legalCommands), commands);
  await clickSquare(page, from);
  await clickSquare(page, to);
  if (promotionChoice) {
    const chooser = page.locator('[data-promotion-chooser]');
    await chooser.waitFor({ state:'visible', timeout:3000 });
    const buttons = chooser.locator('[data-promotion-piece]');
    assert.strictEqual(await buttons.count(), 4, 'promotion chooser must expose Q/R/B/N');
    await page.locator(`[data-promotion-piece="${promotionChoice}"]`).click();
  }
  await page.waitForFunction(() => globalThis.__rpchessSpecial.client.captured.length === 1, null, { timeout:3000 });
  return page.evaluate(() => globalThis.__rpchessSpecial.client.captured[0]);
}

(async()=>{
  const browser = await chromium.launch({ headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1000, height:900 } });
    await page.goto(`${BASE_URL}/index.html`, { waitUntil:'domcontentloaded', timeout:15000 });
    await page.evaluate(async() => {
      const { VerticalSlicePresenter } = await import('/js/vertical-slice-presenter-final.mjs');
      class CaptureClient extends EventTarget {
        constructor() { super(); this.captured = []; }
        getSnapshot() { return null; }
        dispatch(command) { this.captured.push(structuredClone(command)); return Promise.resolve(command); }
      }
      const root = document.createElement('div');
      root.dataset.specialRoot = '';
      root.style.cssText = 'position:relative;width:800px;height:800px;margin:20px;';
      const canvas = document.createElement('canvas');
      canvas.dataset.specialBoard = '';
      canvas.width = 800; canvas.height = 800;
      canvas.style.cssText = 'display:block;width:800px;height:800px;';
      root.appendChild(canvas);
      document.body.replaceChildren(root);
      const client = new CaptureClient();
      const presenter = new VerticalSlicePresenter({ root, client });
      presenter.drawBoard = () => {};
      presenter.boardReport = { viewport:{ x:0, y:0, cellSize:100, width:800, height:800 } };
      presenter.boardPlan = { activeCells:Array.from({ length:64 }, (_, index) => {
        const file = index % 8;
        const rank = Math.floor(index / 8) + 1;
        return { square:`${String.fromCharCode(97 + file)}${rank}`, displayX:file, displayY:8-rank };
      }) };
      presenter.lastSnapshot = { status:'scenario', scenario:{ playerTurn:true, legalCommands:[] } };
      canvas.addEventListener('click', (event) => presenter.handleBoardPointer(event));
      const configure = (legalCommands) => {
        client.captured.length = 0;
        presenter.clearPromotionChooser?.();
        presenter.selectedSquare = null;
        presenter.selectedReserveEntryId = null;
        presenter.lastSnapshot = { status:'scenario', scenario:{ playerTurn:true, legalCommands:structuredClone(legalCommands) } };
      };
      globalThis.__rpchessSpecial = { root, canvas, client, presenter, configure };
    });

    const castle = await commandAfter(page, [
      { type:'MovePiece', payload:{ from:'e1', to:'g1', promotion:null } }
    ], 'e1', 'g1');
    assert.deepStrictEqual(castle, { type:'PlayerCommand', request:{ type:'MovePiece', payload:{ from:'e1', to:'g1', promotion:null } } });
    console.log('PASS final UI emits castling MovePiece e1->g1');

    const enPassant = await commandAfter(page, [
      { type:'MovePiece', payload:{ from:'e5', to:'d6', promotion:null } }
    ], 'e5', 'd6');
    assert.deepStrictEqual(enPassant, { type:'PlayerCommand', request:{ type:'MovePiece', payload:{ from:'e5', to:'d6', promotion:null } } });
    console.log('PASS final UI emits en-passant MovePiece e5->d6');

    const promotions = ['q','r','b','n'].map((promotion) => ({ type:'MovePiece', payload:{ from:'e7', to:'e8', promotion } }));
    const promotion = await commandAfter(page, promotions, 'e7', 'e8', 'n');
    assert.deepStrictEqual(promotion, { type:'PlayerCommand', request:{ type:'MovePiece', payload:{ from:'e7', to:'e8', promotion:'n' } } });
    assert.strictEqual(await page.locator('[data-promotion-chooser]').count(), 0, 'promotion chooser must close after selection');
    console.log('PASS final UI promotion chooser emits selected knight promotion');

    console.log('Chess special-rules final UI regression: 3/3 passed.');
  } finally { await browser.close(); }
})().catch((error)=>{ console.error(error.stack || error); process.exitCode=1; });
