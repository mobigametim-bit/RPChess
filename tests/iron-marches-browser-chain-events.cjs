'use strict';
const assert = require('assert');
const { chromium } = require('playwright');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');
const { chooseObjectiveBrowserCommand } = require('./helpers/objective-browser-guide.cjs');
const FIXTURES = require('./fixtures/iron-marches-targeted.cjs');
const BASE_URL = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const TEMPLATES = buildBrowserProductionBundle().scenarioTemplates;
function log(message) { console.log(`[chain-events] ${message}`); }
async function snap(page) { return page.evaluate(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.() || null); }
async function idle(page) { await page.waitForFunction(() => !globalThis.RPChessVerticalSlice?.runtimeClient?.pending, null, { timeout:8000 }); }
async function click(page, target) {
  const locator = typeof target === 'string' ? page.locator(target).first() : (target.first ? target.first() : target);
  await locator.waitFor({ state:'visible', timeout:8000 });
  await locator.scrollIntoViewIfNeeded();
  await locator.click({ timeout:8000 });
}
async function visible(page, selector) {
  const locator = page.locator(selector).first();
  return Boolean(await locator.count() && await locator.isVisible().catch(() => false) && await locator.isEnabled().catch(() => false));
}
async function checkpoint(page, seed, label) {
  await idle(page);
  const before = await snap(page);
  await page.goto(`${BASE_URL}/index.html?profile=profile-1&autosave=1&seed=${seed}`, { waitUntil:'domcontentloaded', timeout:15000 });
  await page.waitForFunction(() => Boolean(globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()), null, { timeout:12000 });
  await idle(page);
  assert.deepStrictEqual(await snap(page), before, `${label}: changed across reload`);
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
  assert.ok(point, `missing board point ${square}`);
  assert.ok(point.x >= 0 && point.x <= point.width && point.y >= 0 && point.y <= point.height, `${square}: board target outside viewport ${JSON.stringify(point)}`);
  assert.strictEqual(point.hitBoard, true, `${square}: board target is not pointer-reachable ${JSON.stringify(point)}`);
  await page.mouse.click(point.x, point.y);
}
function actionIndex(state) { return Number(state?.scenario?.actionIndex ?? state?.scenario?.battle?.actionIndex ?? 0); }
async function move(page, command) {
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
    assert.ok(command, `no battle guide for ${state.scenario?.scenarioId}`);
    await move(page, command);
  }
  throw new Error('chain battle did not finish');
}
async function talent(page) {
  const modal = page.locator('[data-rpu-talent-modal]');
  if (await modal.count() && await modal.isVisible().catch(() => false)) { await click(page, modal.locator('[data-talent-id]').first()); await idle(page); return true; }
  return false;
}
async function reward(page) {
  await talent(page);
  const state = await snap(page);
  if (state.status === 'reward') { await click(page, '[data-claim]'); await idle(page); return; }
  if (state.status === 'reward_choice') { await click(page, '[data-reward-offer]:not([disabled])'); await idle(page); }
}
async function event(page, options = {}) {
  const stageSeen = new Set();
  for (let guard=0; guard<20; guard+=1) {
    await talent(page);
    const state = await snap(page);
    if (state.status === 'campaign') return;
    if (state.status === 'scenario') { await finishBattle(page); continue; }
    if (['reward','reward_choice'].includes(state.status)) { await reward(page); continue; }
    assert.strictEqual(state.status, 'event', `${options.eventId}: unexpected ${state.status}`);
    assert.strictEqual(state.event?.eventId, options.eventId);
    const stage = Number(state.event?.stageIndex || 0);
    if (options.reloadStages && !stageSeen.has(stage)) { stageSeen.add(stage); await checkpoint(page, options.seed, `${options.eventId}:stage${stage+1}`); }
    let selector = '[data-choice-id]:not([disabled])';
    if (options.firstChoiceId && stage === 0 && await page.locator(`[data-choice-id="${options.firstChoiceId}"]:not([disabled])`).count()) selector = `[data-choice-id="${options.firstChoiceId}"]:not([disabled])`;
    await click(page, selector); await idle(page);
  }
  throw new Error(`${options.eventId}: did not resolve`);
}
async function resolveNode(page) {
  for (let guard=0; guard<60; guard+=1) {
    if (await talent(page)) continue;
    const state = await snap(page);
    if (state.status === 'campaign') {
      if (state.campaign?.secret?.status === 'pending' && await visible(page, '[data-secret-decision="decline"]')) { await click(page, '[data-secret-decision="decline"]'); await idle(page); continue; }
      return;
    }
    if (state.status === 'briefing') { await click(page, '[data-confirm-briefing]'); await idle(page); continue; }
    if (state.status === 'deployment') { await click(page, '[data-confirm-deployment]'); await idle(page); continue; }
    if (state.status === 'scenario') { await finishBattle(page); continue; }
    if (['reward','reward_choice'].includes(state.status)) { await reward(page); continue; }
    if (state.status === 'service') { await click(page, '[data-leave-service]'); await idle(page); continue; }
    if (state.status === 'event') { await event(page, { eventId:state.event.eventId, seed:state.seed }); continue; }
    if (state.status === 'boss') {
      const selector = state.campaign?.selectorState || {};
      const followups = (selector.assignments || []).filter((entry) => String(entry.eventId).startsWith('event.')).map((entry) => `${entry.nodeId}:${entry.eventId}:${entry.status}`);
      throw new Error(`unhandled chain node boss; current=${state.campaign?.currentNodeId}; activeChains=${JSON.stringify(selector.activeChainIds || [])}; followups=${JSON.stringify(followups)}; routes=${JSON.stringify((state.campaign?.routes || []).map((route) => ({to:route.to,type:route.type,contentId:route.contentId})))}`);
    }
    throw new Error(`unhandled chain node ${state.status}`);
  }
  throw new Error('chain node did not resolve');
}
async function travel(page, nodeId) {
  const before = await snap(page);
  assert.strictEqual(before.status, 'campaign');
  const route = (before.campaign?.routes || []).find((entry) => entry.to === nodeId);
  assert.ok(route, `route ${nodeId} unavailable from ${before.campaign?.currentNodeId}`);
  await click(page, `[data-node-id="${nodeId}"]`);
  await click(page, '[data-rpu-travel]');
  await page.waitForFunction(({ nodeId, beforeNode }) => {
    const next = globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.();
    return Boolean(next && (next.status !== 'campaign' || next.campaign?.currentNodeId === nodeId || next.campaign?.currentNodeId !== beforeNode));
  }, { nodeId, beforeNode:before.campaign?.currentNodeId }, { timeout:8000 });
  await idle(page);
}
async function coverChain(page, targetId, fixture) {
  await fresh(page, fixture.seed);
  await travel(page, fixture.startPath[0]);
  let state = await snap(page);
  assert.strictEqual(state.status, 'event');
  assert.strictEqual(state.event?.eventId, fixture.chainStart);
  await event(page, { eventId:fixture.chainStart, seed:fixture.seed, firstChoiceId:fixture.chainStart === 'event.miners_on_strike' ? 'guards' : null });
  log(`chain-start:${fixture.chainStart}:PASS`);
  for (let depth=0; depth<14; depth+=1) {
    state = await snap(page);
    assert.strictEqual(state.status, 'campaign');
    if (state.campaign?.secret?.status === 'pending' && await visible(page, '[data-secret-decision="decline"]')) { await click(page, '[data-secret-decision="decline"]'); await idle(page); state = await snap(page); }
    const routes = state.campaign?.routes || [];
    assert.ok(routes.length, `${targetId}: campaign exhausted before follow-up`);
    const eventRoute = routes.find((route) => route.type === 'event');
    const route = eventRoute || routes.find((entry) => entry.type !== 'boss') || routes[0];
    await travel(page, route.to);
    state = await snap(page);
    if (state.status === 'event' && state.event?.eventId === targetId) {
      await event(page, { eventId:targetId, seed:fixture.seed, reloadStages:true });
      assert.strictEqual((await snap(page)).status, 'campaign');
      log(`follow-up:${targetId}:PASS`);
      return;
    }
    await resolveNode(page);
  }
  throw new Error(`${targetId}: authored follow-up did not materialize in 14 traversals`);
}
(async()=>{
  const browser = await chromium.launch({ headless:true });
  try {
    const context = await browser.newContext({ viewport:{ width:1366, height:768 } });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors=[]; page.on('pageerror',(error)=>errors.push(error.message));
    for (const [targetId, fixture] of Object.entries(FIXTURES.chainEvents)) await coverChain(page, targetId, fixture);
    assert.deepStrictEqual(errors, [], `page errors: ${errors.join(' | ')}`);
    console.log('Iron Marches authored chain events Chromium: PASS');
    await context.close();
  } finally { await browser.close(); }
})().catch((error)=>{ console.error(error.stack || error); process.exitCode=1; });
