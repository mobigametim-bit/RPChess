'use strict';

const assert = require('assert');
const { chromium } = require('playwright');

const BASE_URL = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function actionIndex(state) { return Number(state?.scenario?.actionIndex ?? state?.scenario?.battle?.actionIndex ?? 0); }
function distance(a,b) { return Math.abs(String(a).charCodeAt(0)-String(b).charCodeAt(0)) + Math.abs(Number(String(a).slice(1))-Number(String(b).slice(1))); }
function log(label, value = '') { console.log(`[battle-input-regression] ${label}${value === '' ? '' : ` ${JSON.stringify(value)}`}`); }

async function realClick(page, selector) {
  const locator = typeof selector === 'string' ? page.locator(selector).first() : selector.first();
  await locator.waitFor({ state:'visible', timeout:7000 });
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();
  assert.ok(box, `missing click box: ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function snapshot(page) {
  return page.evaluate(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.() || null);
}
function objectiveMove(state) {
  const scenario = state.scenario;
  const legal = (scenario?.legalCommands || []).filter((command) => command.type === 'MovePiece');
  if (!legal.length) return null;
  const pieces = scenario.pieces || [];
  const objective = (scenario.objectives || []).find((entry) => !entry.complete && !entry.completed && entry.status !== 'completed') || scenario.objectives?.[0] || null;
  const piece = (id) => pieces.find((entry) => entry.pieceId === id || entry.id === id);
  const targets = (objective?.targetPieceIds || []).map((id) => piece(id)?.square).filter(Boolean);
  const cells = (objective?.targetCells || objective?.cells || []).filter(Boolean);
  const escort = objective?.pieceId ? piece(objective.pieceId)?.square : null;
  const direct = legal.find((command) => (targets.includes(command.payload.to) || cells.includes(command.payload.to)) && (!escort || command.payload.from === escort));
  if (direct) return direct;
  if (escort && cells.length) {
    return legal.filter((command) => command.payload.from === escort)
      .sort((a,b) => Math.min(...cells.map((target) => distance(a.payload.to,target))) - Math.min(...cells.map((target) => distance(b.payload.to,target))))[0] || legal[0];
  }
  if (targets.length) {
    return legal.slice().sort((a,b) => {
      const aScore = (targets.includes(a.payload.to) ? -1000 : 0) + Math.min(...targets.map((target) => distance(a.payload.to,target)));
      const bScore = (targets.includes(b.payload.to) ? -1000 : 0) + Math.min(...targets.map((target) => distance(b.payload.to,target)));
      return aScore - bScore;
    })[0];
  }
  if (cells.length) return legal.slice().sort((a,b) => Math.min(...cells.map((target) => distance(a.payload.to,target))) - Math.min(...cells.map((target) => distance(b.payload.to,target))))[0];
  return legal[0];
}
async function point(page, square) {
  const canvas = page.locator('[data-board]').first();
  const box = await canvas.boundingBox();
  assert.ok(box, 'canvas missing');
  const local = await page.evaluate((wanted) => {
    const presenter = globalThis.RPChessVerticalSlice?.presenter;
    const viewport = presenter?.boardReport?.viewport;
    const cell = presenter?.boardPlan?.activeCells?.find((entry) => entry.square === wanted);
    const element = document.querySelector('[data-board]');
    if (!viewport || !cell || !element) return null;
    const rect = element.getBoundingClientRect();
    const scaleX = rect.width / (element.width || rect.width);
    const scaleY = rect.height / (element.height || rect.height);
    return { x:(viewport.x + (cell.displayX + .5) * viewport.cellSize) * scaleX, y:(viewport.y + (cell.displayY + .5) * viewport.cellSize) * scaleY };
  }, square);
  assert.ok(local, `missing geometry ${square}`);
  return { x:box.x + local.x, y:box.y + local.y };
}
async function debugState(page, fromPoint = null, toPoint = null) {
  return page.evaluate(({fromPoint,toPoint}) => {
    const api = globalThis.RPChessVerticalSlice || {};
    const presenter = api.presenter;
    const runtime = api.runtimeHost?.getSnapshot?.();
    const client = api.runtimeClient;
    const hit = (p) => p ? (() => { const node = document.elementFromPoint(p.x,p.y); return node ? { tag:node.tagName, cls:node.className, board:node.hasAttribute?.('data-board') || false } : null; })() : null;
    return {
      presenterClass: presenter?.constructor?.name || null,
      busy: presenter?.busy,
      animationRunning: presenter?.animationRunning,
      selectedSquare: presenter?.selectedSquare,
      selectedReserveEntryId: presenter?.selectedReserveEntryId,
      presenterStatus: presenter?.lastSnapshot?.status,
      presenterPlayerTurn: presenter?.lastSnapshot?.scenario?.playerTurn,
      runtimeStatus: runtime?.status,
      runtimePlayerTurn: runtime?.scenario?.playerTurn,
      runtimeActionIndex: Number(runtime?.scenario?.actionIndex ?? runtime?.scenario?.battle?.actionIndex ?? 0),
      clientPending: client?.pending,
      clientSequence: client?.sequence,
      fromHit: hit(fromPoint),
      toHit: hit(toPoint)
    };
  }, {fromPoint,toPoint});
}

async function launchToBattle(page) {
  await page.goto(`${BASE_URL}/index.html?new=1&seed=9042&autosave=1`, { waitUntil:'domcontentloaded', timeout:15000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil:'domcontentloaded', timeout:15000 });
  await realClick(page, '[data-shell-action="profiles"]');
  await realClick(page, '[data-profile-action="start"]');
  await realClick(page, '[data-launch-commander]');
  await page.locator('.rprs').waitFor({ state:'visible' });
  await realClick(page, '[data-king-id]:not([disabled])');
  await realClick(page, '[data-doctrine-id]:not([disabled])');
  await realClick(page, '[data-lock-selection]');
  await page.locator('[data-draft-hero]').first().waitFor({ state:'visible' });
  await realClick(page, '[data-draft-hero]');
  await realClick(page, '[data-draft-regular]');
  await realClick(page, '[data-confirm-draft]');
  await page.waitForFunction(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()?.status === 'campaign', null, { timeout:10000 });
  if (await page.locator('[data-rpu-scout]:not([disabled])').count()) await realClick(page, '[data-rpu-scout]:not([disabled])');
  await delay(100);
  const route = page.locator('.rpu-map-node.is-route [data-node-id]:not([disabled])').first();
  await realClick(page, route);
  await realClick(page, '[data-rpu-travel]:not([disabled])');
  await page.waitForFunction(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()?.status === 'briefing', null, { timeout:10000 });
  await realClick(page, '[data-confirm-briefing]');
  await page.waitForFunction(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()?.status === 'deployment', null, { timeout:10000 });
  const confirm = page.locator('[data-confirm-deployment]');
  assert.strictEqual(await confirm.isEnabled(), true, 'default deployment unexpectedly requires edits');
  await realClick(page, confirm);
  await page.waitForFunction(() => ['scenario','boss'].includes(globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()?.status), null, { timeout:10000 });
}

async function moveThroughCanvas(page, ordinal) {
  const before = await snapshot(page);
  assert.ok(before?.scenario?.playerTurn, `${ordinal}: runtime is not on player turn`);
  const command = objectiveMove(before);
  assert.ok(command, `${ordinal}: no legal player move`);
  const from = await point(page, command.payload.from);
  const to = await point(page, command.payload.to);
  const start = await debugState(page, from, to);
  log(`${ordinal}-before`, { command:`${command.payload.from}->${command.payload.to}`, ...start });
  assert.strictEqual(start.busy, false, `${ordinal}: presenter busy before input`);
  assert.strictEqual(start.animationRunning, false, `${ordinal}: animation active before input`);
  assert.strictEqual(start.presenterPlayerTurn, true, `${ordinal}: presenter has stale non-player turn`);
  assert.ok(start.fromHit?.board, `${ordinal}: source pointer is intercepted by ${JSON.stringify(start.fromHit)}`);
  assert.ok(start.toHit?.board, `${ordinal}: target pointer is intercepted by ${JSON.stringify(start.toHit)}`);

  await page.mouse.click(from.x,from.y);
  await delay(60);
  const selected = await debugState(page, from, to);
  log(`${ordinal}-selected`, selected);
  assert.strictEqual(selected.selectedSquare, command.payload.from, `${ordinal}: source click did not select ${command.payload.from}`);

  const beforeIndex = actionIndex(before);
  const beforeSequence = Number(selected.clientSequence || 0);
  await page.mouse.click(to.x,to.y);
  await delay(100);
  const dispatched = await debugState(page, from, to);
  log(`${ordinal}-targeted`, dispatched);
  assert.ok(Number(dispatched.clientSequence || 0) > beforeSequence || dispatched.runtimeActionIndex > beforeIndex, `${ordinal}: target click did not reach RuntimeCommandClient`);
  assert.strictEqual(dispatched.selectedSquare, null, `${ordinal}: selected square was not cleared after accepted target`);

  await page.waitForFunction(({status,beforeIndex}) => {
    const current = globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.();
    if (!current) return false;
    if (current.status !== status) return true;
    const index = Number(current.scenario?.actionIndex ?? current.scenario?.battle?.actionIndex ?? 0);
    return index > beforeIndex && Boolean(current.scenario?.playerTurn);
  }, {status:before.status,beforeIndex}, {timeout:7000});
  await page.waitForFunction(() => !globalThis.RPChessVerticalSlice?.presenter?.animationRunning && !globalThis.RPChessVerticalSlice?.runtimeClient?.pending, null, {timeout:7000});
  await delay(80);
  const after = await debugState(page, from, to);
  log(`${ordinal}-resolved`, after);
  assert.strictEqual(after.busy, false, `${ordinal}: presenter remained busy after resolution`);
  assert.strictEqual(after.presenterPlayerTurn, true, `${ordinal}: presenter did not return to player turn`);
  return {before,after};
}

(async () => {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1366,height:768}});
  page.setDefaultTimeout(7000);
  const errors=[];
  page.on('pageerror',(error)=>errors.push(`pageerror: ${error.message}`));
  page.on('console',(message)=>{ if(message.type()==='error') errors.push(`console: ${message.text()}`); });
  try {
    await launchToBattle(page);
    await moveThroughCanvas(page,'first');
    await moveThroughCanvas(page,'second');
    assert.deepStrictEqual(errors,[],errors.join('\n'));
    console.log('Battle UI sequential input regression: PASS');
  } finally {
    await browser.close();
  }
})().catch((error)=>{ console.error(error.stack||error); process.exitCode=1; });
