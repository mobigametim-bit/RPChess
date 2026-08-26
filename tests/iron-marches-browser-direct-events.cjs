'use strict';

const assert = require('assert');
const { chromium } = require('playwright');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');
const { chooseObjectiveBrowserCommand } = require('./helpers/objective-browser-guide.cjs');
const FIXTURES = require('./fixtures/iron-marches-targeted.cjs');

const BASE_URL = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const TEMPLATES = buildBrowserProductionBundle().scenarioTemplates;
const DIRECT_EVENTS = Object.entries(FIXTURES.directEvents);

function log(message) { console.log(`[direct-events] ${message}`); }
async function snap(page) { return page.evaluate(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.() || null); }
async function idle(page) { await page.waitForFunction(() => !globalThis.RPChessVerticalSlice?.runtimeClient?.pending, null, { timeout:8000 }); }
async function click(page, target) {
  const locator = typeof target === 'string' ? page.locator(target).first() : (target.first ? target.first() : target);
  await locator.waitFor({ state:'visible', timeout:8000 });
  await locator.scrollIntoViewIfNeeded();
  await locator.click({ timeout:8000 });
}
async function checkpoint(page, seed, label) {
  await idle(page);
  const before = await snap(page);
  assert.ok(before, `${label}: missing pre-reload snapshot`);
  await page.goto(`${BASE_URL}/index.html?profile=profile-1&autosave=1&seed=${seed}`, { waitUntil:'domcontentloaded', timeout:15000 });
  await page.waitForFunction(() => Boolean(globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()), null, { timeout:12000 });
  await idle(page);
  assert.deepStrictEqual(await snap(page), before, `${label}: state changed across real reload`);
  log(`reload:${label}`);
}
async function fresh(page, seed) {
  await page.goto(`${BASE_URL}/index.html?new=1&seed=${seed}&autosave=1`, { waitUntil:'domcontentloaded', timeout:15000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil:'domcontentloaded', timeout:15000 });
  await click(page, '[data-shell-action="profiles"]');
  await click(page, page.locator('[data-profile-action="start"]').first());
  await click(page, '[data-launch-commander]');
  await page.locator('.rprs').waitFor({ state:'visible', timeout:8000 });
  await click(page, '[data-king-id]:not([disabled])'); await idle(page);
  await click(page, '[data-doctrine-id]:not([disabled])'); await idle(page);
  await click(page, '[data-lock-selection]');
  await page.locator('[data-draft-hero]').first().waitFor({ state:'visible', timeout:8000 });
  await click(page, '[data-draft-hero]'); await idle(page);
  await click(page, '[data-draft-regular]'); await idle(page);
  await click(page, '[data-confirm-draft]');
  await page.waitForFunction(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()?.status === 'campaign', null, { timeout:10000 });
  await idle(page);
}
async function clickBoardSquare(page, square) {
  const point = await page.evaluate((wanted) => {
    const presenter = globalThis.RPChessVerticalSlice?.presenter;
    const viewport = presenter?.boardReport?.viewport;
    const cell = presenter?.boardPlan?.activeCells?.find((entry) => entry.square === wanted);
    const element = document.querySelector('[data-board]');
    if (!viewport || !cell || !element || !element.getClientRects().length) return null;

    element.scrollIntoView({ block:'center', inline:'center', behavior:'auto' });
    const locate = () => {
      const rect = element.getBoundingClientRect();
      const scaleX = rect.width / (element.width || rect.width);
      const scaleY = rect.height / (element.height || rect.height);
      return {
        x:rect.left + (viewport.x + (cell.displayX + .5) * viewport.cellSize) * scaleX,
        y:rect.top + (viewport.y + (cell.displayY + .5) * viewport.cellSize) * scaleY
      };
    };

    let target = locate();
    const margin = 8;
    if (target.y < margin || target.y > innerHeight - margin) {
      scrollBy({ top:target.y - innerHeight / 2, left:0, behavior:'auto' });
      target = locate();
    }
    if (target.x < margin || target.x > innerWidth - margin) {
      scrollBy({ top:0, left:target.x - innerWidth / 2, behavior:'auto' });
      target = locate();
    }
    const hit = document.elementFromPoint(target.x, target.y);
    return {
      ...target,
      width:innerWidth,
      height:innerHeight,
      hitBoard:Boolean(hit?.matches?.('[data-board]'))
    };
  }, square);
  assert.ok(point, `missing geometry ${square}`);
  assert.ok(point.x >= 0 && point.x <= point.width && point.y >= 0 && point.y <= point.height, `${square}: board target outside viewport ${JSON.stringify(point)}`);
  assert.strictEqual(point.hitBoard, true, `${square}: board target is not pointer-reachable ${JSON.stringify(point)}`);
  await page.mouse.click(point.x, point.y);
}
function actionIndex(state) { return Number(state?.scenario?.actionIndex ?? state?.scenario?.battle?.actionIndex ?? 0); }
async function realMove(page, command) {
  const state = await snap(page);
  const before = actionIndex(state);
  await clickBoardSquare(page, command.payload.from);
  await clickBoardSquare(page, command.payload.to);
  await page.waitForFunction(({ status, before }) => {
    const next = globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.();
    if (!next) return false;
    if (next.status !== status) return true;
    return Number(next.scenario?.actionIndex ?? next.scenario?.battle?.actionIndex ?? 0) > before && Boolean(next.scenario?.playerTurn);
  }, { status:state.status, before }, { timeout:9000 });
  await page.waitForFunction(() => !globalThis.RPChessVerticalSlice?.presenter?.animationRunning, null, { timeout:8000 });
  await idle(page);
}
async function finishBattle(page) {
  for (let guard=0; guard<50; guard+=1) {
    const state = await snap(page);
    if (state.status !== 'scenario') return;
    const command = chooseObjectiveBrowserCommand(state, TEMPLATES);
    assert.ok(command, `no guided event-combat move for ${state.scenario?.scenarioId}`);
    await realMove(page, command);
  }
  throw new Error('event battle did not finish in 50 UI moves');
}
async function talent(page) {
  const modal = page.locator('[data-rpu-talent-modal]');
  if (await modal.count() && await modal.isVisible().catch(() => false)) {
    await click(page, modal.locator('[data-talent-id]').first()); await idle(page); return true;
  }
  return false;
}
async function reward(page) {
  await talent(page);
  const state = await snap(page);
  if (state.status === 'reward') { await click(page, '[data-claim]'); await idle(page); return; }
  if (state.status === 'reward_choice') { await click(page, '[data-reward-offer]:not([disabled])'); await idle(page); }
}
async function travelDirect(page, nodeId) {
  const before = await snap(page);
  assert.strictEqual(before.status, 'campaign');
  const route = (before.campaign?.routes || []).find((entry) => entry.to === nodeId);
  assert.ok(route, `direct event route ${nodeId} missing from ${before.campaign?.currentNodeId}`);
  await click(page, `[data-node-id="${nodeId}"]`);
  await page.waitForFunction((nodeId) => globalThis.RPChessVerticalSlice?.presenter?.selectedCampaignNodeId === nodeId, nodeId, { timeout:5000 });
  const travel = page.locator('[data-rpu-travel]').first();
  await travel.waitFor({ state:'visible', timeout:5000 });
  assert.strictEqual(await travel.isEnabled(), true, `${nodeId}: travel button disabled`);
  log(`travel:${before.campaign?.currentNodeId}->${nodeId}:${route.type || 'unknown'}`);
  await travel.click({ timeout:8000 });
  await page.waitForFunction(({ beforeNode, nodeId }) => {
    const next = globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.();
    if (!next) return false;
    return next.status !== 'campaign' || next.campaign?.currentNodeId === nodeId || next.campaign?.currentNodeId !== beforeNode;
  }, { beforeNode:before.campaign?.currentNodeId, nodeId }, { timeout:10000 });
  await idle(page);
}
async function finishEvent(page, eventId, seed, firstChoiceId = null) {
  const reloadedStages = new Set();
  let reloadedCombat = false;
  for (let guard=0; guard<24; guard+=1) {
    if (await talent(page)) continue;
    const state = await snap(page);
    if (state.status === 'campaign') return;
    if (state.status === 'scenario') {
      if (!reloadedCombat) {
        reloadedCombat = true;
        await checkpoint(page, seed, `${eventId}:combat_pending`);
      }
      await finishBattle(page);
      continue;
    }
    if (state.status === 'reward' || state.status === 'reward_choice') { await reward(page); continue; }
    assert.strictEqual(state.status, 'event', `${eventId}: unexpected status ${state.status}`);
    assert.strictEqual(state.event?.eventId, eventId, `${eventId}: wrong event rendered`);
    const stage = Number(state.event?.stageIndex || 0);
    if (!reloadedStages.has(stage)) {
      reloadedStages.add(stage);
      await checkpoint(page, seed, `${eventId}:stage${stage+1}`);
    }
    let selector = '[data-choice-id]:not([disabled])';
    if (stage === 0 && firstChoiceId && await page.locator(`[data-choice-id="${firstChoiceId}"]:not([disabled])`).count()) selector = `[data-choice-id="${firstChoiceId}"]:not([disabled])`;
    await click(page, selector);
    await idle(page);
  }
  throw new Error(`${eventId}: did not resolve in 24 UI steps`);
}
async function cover(page, eventId, fixture) {
  await fresh(page, fixture.seed);
  await travelDirect(page, fixture.path[0]);
  const state = await snap(page);
  assert.strictEqual(state.status, 'event', `${eventId}: travel did not enter event`);
  assert.strictEqual(state.event?.eventId, eventId, `${eventId}: materialized wrong event`);
  const firstChoiceId = eventId === 'event.miners_on_strike' ? 'guards' : null;
  await finishEvent(page, eventId, fixture.seed, firstChoiceId);
  assert.strictEqual((await snap(page)).status, 'campaign', `${eventId}: did not return to campaign`);
  log(`event:${eventId}:PASS`);
}

(async()=>{
  const browser = await chromium.launch({ headless:true });
  try {
    const context = await browser.newContext({ viewport:{ width:1366, height:768 } });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors=[]; page.on('pageerror',(error)=>errors.push(error.message));
    for (const [eventId, fixture] of DIRECT_EVENTS) await cover(page, eventId, fixture);
    assert.deepStrictEqual(errors, [], `page errors: ${errors.join(' | ')}`);
    console.log('Iron Marches direct events real Chromium: PASS');
    console.log(JSON.stringify(DIRECT_EVENTS.map(([id])=>id), null, 2));
    await context.close();
  } finally { await browser.close(); }
})().catch((error)=>{ console.error(error.stack || error); process.exitCode=1; });
