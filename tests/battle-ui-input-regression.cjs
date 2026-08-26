'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function actionIndex(state) { return Number(state?.scenario?.actionIndex ?? state?.scenario?.battle?.actionIndex ?? 0); }
function distance(a,b) { return Math.abs(String(a).charCodeAt(0)-String(b).charCodeAt(0)) + Math.abs(Number(String(a).slice(1))-Number(String(b).slice(1))); }
function log(label, value = '') { console.log(`[battle-input-regression] ${label}${value === '' ? '' : ` ${JSON.stringify(value)}`}`); }

const battleUiSource = fs.readFileSync(path.resolve(__dirname, '../game/js/ui-approved-battle.mjs'), 'utf8');
const briefingHotfixSource = fs.readFileSync(path.resolve(__dirname, '../game/css/briefing-battle-hotfix-20260826.css'), 'utf8');
const pointerSafetySource = fs.readFileSync(path.resolve(__dirname, '../game/js/battle-pointer-coordinate-safety-20260826.mjs'), 'utf8');
assert.ok(battleUiSource.includes("s.playerTurn?'ВАШ ХОД':'ХОД ПРОТИВНИКА'"), 'battle turn label must use presenter playerTurn');
assert.strictEqual(battleUiSource.includes('s.turnSide===snapshot.playerSide'), false, 'battle UI must not read the nonexistent turnSide field');
assert.ok(battleUiSource.includes("type:'PlayerCommand',request:c"), 'button abilities must use the PlayerCommand scheduler');
assert.ok(battleUiSource.includes("type:'PlayerCommand',request:{type:'EndTurn',payload:{}}"), 'end turn must use the PlayerCommand scheduler');
assert.ok(briefingHotfixSource.includes('[data-save-briefing]'), 'briefing hotfix must retire legacy apply button');
assert.ok(briefingHotfixSource.includes('display: none !important'), 'briefing hotfix must fully hide checkbox controls');
assert.ok(pointerSafetySource.includes('movableVisualSquare'), 'battle pointer safety must include visible-piece hit testing');
assert.ok(pointerSafetySource.includes('hitTop = top - size * 0.36'), 'visible-piece hit target must extend above the logical square');

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
async function point(page, square, anchor = { x:.5, y:.5 }) {
  const canvas = page.locator('[data-board]').first();
  const box = await canvas.boundingBox();
  assert.ok(box, 'canvas missing');
  const local = await page.evaluate(({ wanted, anchor }) => {
    const presenter = globalThis.RPChessVerticalSlice?.presenter;
    const viewport = presenter?.boardReport?.viewport;
    const cell = presenter?.boardPlan?.activeCells?.find((entry) => entry.square === wanted);
    const element = document.querySelector('[data-board]');
    if (!viewport || !cell || !element) return null;
    const rect = element.getBoundingClientRect();
    const dpr = Math.max(1, Number(devicePixelRatio) || 1);
    const logicalWidth = element.width / dpr;
    const logicalHeight = element.height / dpr;
    const scaleX = rect.width / logicalWidth;
    const scaleY = rect.height / logicalHeight;
    return {
      x:(viewport.x + (cell.displayX + Number(anchor.x)) * viewport.cellSize) * scaleX,
      y:(viewport.y + (cell.displayY + Number(anchor.y)) * viewport.cellSize) * scaleY
    };
  }, { wanted:square, anchor });
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

async function captureBriefingRoster(page) {
  const roster = page.locator('.rpu-brief-roster').first();
  await roster.waitFor({ state:'visible', timeout:7000 });
  const audit = await roster.evaluate((node) => {
    const cards = [...node.querySelectorAll('[data-briefing-roster]')];
    return {
      cardCount: cards.length,
      cardTags: cards.map((card) => card.tagName),
      checkboxCount: node.querySelectorAll('input[type="checkbox"]').length,
      firstBefore: cards[0] ? getComputedStyle(cards[0], '::before').content : null,
      firstAppearance: cards[0] ? getComputedStyle(cards[0]).appearance : null
    };
  });
  assert.ok(audit.cardCount >= 1, 'briefing roster must contain selectable cards');
  assert.ok(audit.cardTags.every((tag) => tag === 'BUTTON'), `briefing roster must use button cards, got ${audit.cardTags.join(',')}`);
  assert.strictEqual(audit.checkboxCount, 0, 'briefing roster screenshot must contain no checkbox controls');
  assert.ok(audit.firstBefore === 'none' || audit.firstBefore === 'normal' || audit.firstBefore === '""', `briefing card pseudo-marker must be absent, got ${audit.firstBefore}`);
  assert.strictEqual(await page.locator('[data-save-briefing]').count(), 0, 'briefing screenshot must contain no apply button');
  const output = path.resolve(__dirname, '../artifacts/qa/briefing-active-roster.jpg');
  fs.mkdirSync(path.dirname(output), { recursive:true });
  await roster.screenshot({ path:output, type:'jpeg', quality:68 });
  console.log(`[briefing-visual] screenshot=${output}`);
}

async function verifyBriefingCardToggle(page) {
  assert.strictEqual(await page.locator('input[type="checkbox"][data-briefing-roster]').count(), 0, 'briefing roster must not render checkboxes');
  assert.strictEqual(await page.locator('[data-save-briefing]').count(), 0, 'briefing roster must not render an apply button');
  await captureBriefingRoster(page);
  const toggle = page.locator('[data-briefing-roster][aria-disabled="false"].is-selected').first();
  await toggle.waitFor({ state:'visible', timeout:7000 });
  const id = await toggle.getAttribute('data-briefing-roster');
  assert.ok(id, 'toggleable selected roster card missing id');
  assert.strictEqual(await toggle.getAttribute('aria-pressed'), 'true');
  await realClick(page, toggle);
  await page.waitForFunction((rosterId) => {
    const current = globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.();
    return current?.status === 'briefing' && !current.stageB?.briefing?.activeRosterIds?.includes(rosterId);
  }, id, { timeout:7000 });
  const deselected = page.locator(`[data-briefing-roster="${id}"]`).first();
  assert.strictEqual(await deselected.getAttribute('aria-pressed'), 'false', 'second render must visibly deselect the card');
  await realClick(page, deselected);
  await page.waitForFunction((rosterId) => {
    const current = globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.();
    return current?.status === 'briefing' && current.stageB?.briefing?.activeRosterIds?.includes(rosterId);
  }, id, { timeout:7000 });
  const reselected = page.locator(`[data-briefing-roster="${id}"]`).first();
  assert.strictEqual(await reselected.getAttribute('aria-pressed'), 'true', 'repeat click must reselect the card');
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
  await verifyBriefingCardToggle(page);
  await realClick(page, '[data-confirm-briefing]');
  await page.waitForFunction(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()?.status === 'deployment', null, { timeout:10000 });
  const confirm = page.locator('[data-confirm-deployment]');
  assert.strictEqual(await confirm.isEnabled(), true, 'default deployment unexpectedly requires edits');
  await realClick(page, confirm);
  await page.waitForFunction(() => ['scenario','boss'].includes(globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()?.status), null, { timeout:10000 });
  await page.waitForFunction(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()?.scenario?.playerTurn === true, null, { timeout:7000 });
  const turnLabel = (await page.locator('.rpu-battle__heading strong').first().textContent() || '').trim();
  assert.strictEqual(turnLabel, 'ВАШ ХОД', 'battle UI must agree with the runtime player turn');
}

async function moveThroughCanvas(page, ordinal, sourceAnchor = {x:.5,y:.5}) {
  const before = await snapshot(page);
  assert.ok(before?.scenario?.playerTurn, `${ordinal}: runtime is not on player turn`);
  const command = objectiveMove(before);
  assert.ok(command, `${ordinal}: no legal player move`);
  const from = await point(page, command.payload.from, sourceAnchor);
  const to = await point(page, command.payload.to);
  const start = await debugState(page, from, to);
  log(`${ordinal}-before`, { command:`${command.payload.from}->${command.payload.to}`, sourceAnchor, ...start });
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
  const page = await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1.25});
  page.setDefaultTimeout(7000);
  const errors=[];
  page.on('pageerror',(error)=>errors.push(`pageerror: ${error.message}`));
  page.on('console',(message)=>{ if(message.type()==='error') errors.push(`console: ${message.text()}`); });
  try {
    await launchToBattle(page);
    // Exercise the upper silhouette tolerance: the click is intentionally above
    // the logical cell centre, matching the manual report that the visible unit
    // art could otherwise require a click lower than the figure itself.
    await moveThroughCanvas(page,'first',{x:.5,y:-.18});
    await moveThroughCanvas(page,'second');
    assert.deepStrictEqual(errors,[],errors.join('\n'));
    console.log('Battle UI visible-piece hit area, turn label, briefing card toggle and sequential input regression: PASS');
  } finally {
    await browser.close();
  }
})().catch((error)=>{ console.error(error.stack||error); process.exitCode=1; });
