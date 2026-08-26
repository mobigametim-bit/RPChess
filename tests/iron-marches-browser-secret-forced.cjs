'use strict';

const assert = require('assert');
const { chromium } = require('playwright');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');
const { chooseObjectiveBrowserCommand } = require('./helpers/objective-browser-guide.cjs');
const FIXTURES = require('./fixtures/iron-marches-targeted.cjs');

const BASE_URL = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const TEMPLATES = buildBrowserProductionBundle().scenarioTemplates;

function log(message) { console.log(`[secret-forced] ${message}`); }
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
async function checkpoint(page, seed, label) {
  await idle(page);
  const before = await snap(page);
  await page.goto(`${BASE_URL}/index.html?profile=profile-1&autosave=1&seed=${seed}`, { waitUntil:'domcontentloaded', timeout:15000 });
  await page.waitForFunction(() => Boolean(globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()), null, { timeout:12000 });
  await idle(page);
  assert.deepStrictEqual(await snap(page), before, `${label}: changed across reload`);
  log(`reload:${label}`);
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
async function move(page, command) {
  const beforeState = await snap(page);
  const before = actionIndex(beforeState);
  await clickBoardSquare(page, command.payload.from);
  await clickBoardSquare(page, command.payload.to);
  await page.waitForFunction(({ status, before }) => {
    const state = globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.();
    if (!state) return false;
    if (state.status !== status) return true;
    return Number(state.scenario?.actionIndex ?? state.scenario?.battle?.actionIndex ?? 0) > before && Boolean(state.scenario?.playerTurn);
  }, { status:beforeState.status, before }, { timeout:9000 });
  await page.waitForFunction(() => !globalThis.RPChessVerticalSlice?.presenter?.animationRunning, null, { timeout:8000 });
  await idle(page);
}
async function finishBattle(page) {
  for (let guard=0; guard<60; guard+=1) {
    const state = await snap(page);
    if (state.status !== 'scenario') return;
    const command = chooseObjectiveBrowserCommand(state, TEMPLATES);
    assert.ok(command, `no guided command ${state.scenario?.scenarioId}`);
    await move(page, command);
  }
  throw new Error('battle did not finish');
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
  if (state.status === 'reward_choice') {
    const offers = state.stageB?.rewardOffers || [];
    const preferred = offers.find((offer) => !['supplies','heal'].includes(offer.type)) || offers[0];
    await click(page, preferred ? `[data-reward-offer="${preferred.id}"]` : '[data-reward-offer]:not([disabled])');
    await idle(page);
  }
}
async function finishEvent(page) {
  for (let guard=0; guard<20; guard+=1) {
    const state = await snap(page);
    if (state.status === 'campaign') return;
    if (state.status === 'scenario') { await finishBattle(page); continue; }
    if (['reward','reward_choice'].includes(state.status)) { await reward(page); continue; }
    assert.strictEqual(state.status, 'event');
    const choices = page.locator('[data-choice-id]:not([disabled])');
    assert.ok(await choices.count(), `${state.event?.eventId}: no event choices`);
    await click(page, choices.first()); await idle(page);
  }
  throw new Error('event did not finish');
}
async function resolveNode(page, stopAtPendingSecret = false) {
  for (let guard=0; guard<80; guard+=1) {
    if (await talent(page)) continue;
    const state = await snap(page);
    if (state.status === 'campaign') {
      if (state.campaign?.secret?.status === 'pending') {
        if (stopAtPendingSecret) return;
        if (await visible(page, '[data-secret-decision="decline"]')) { await click(page, '[data-secret-decision="decline"]'); await idle(page); continue; }
      }
      return;
    }
    if (state.status === 'briefing') { await click(page, '[data-confirm-briefing]'); await idle(page); continue; }
    if (state.status === 'deployment') { await click(page, '[data-confirm-deployment]'); await idle(page); continue; }
    if (state.status === 'scenario') { await finishBattle(page); continue; }
    if (['reward','reward_choice'].includes(state.status)) { await reward(page); continue; }
    if (state.status === 'service') { await click(page, '[data-leave-service]'); await idle(page); continue; }
    if (state.status === 'event') { await finishEvent(page); continue; }
    throw new Error(`unhandled node state ${state.status}`);
  }
  throw new Error('node did not resolve');
}
async function waitRouteRendered(page, nodeId) {
  await page.waitForFunction((wanted) => {
    const state = globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.();
    const button = [...document.querySelectorAll('[data-node-id]')].find((entry) => entry.dataset.nodeId === wanted);
    return Boolean(state?.status === 'campaign'
      && state.campaign?.routes?.some((route) => route.to === wanted)
      && button
      && !button.disabled);
  }, nodeId, { timeout:10000 });
}
async function selectAndTravel(page, nodeId) {
  const before = await snap(page);
  assert.strictEqual(before.status, 'campaign');
  const route = (before.campaign?.routes || []).find((entry) => entry.to === nodeId);
  assert.ok(route, `route ${nodeId} missing from ${before.campaign?.currentNodeId}`);
  await waitRouteRendered(page, nodeId);
  await click(page, `[data-node-id="${nodeId}"]`);
  await page.waitForFunction((wanted) => globalThis.RPChessVerticalSlice?.presenter?.selectedCampaignNodeId === wanted, nodeId, { timeout:5000 });
  await click(page, '[data-rpu-travel]');
  await page.waitForFunction(({ nodeId, beforeNode }) => {
    const state = globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.();
    return Boolean(state && (state.status !== 'campaign' || state.campaign?.currentNodeId === nodeId || state.campaign?.currentNodeId !== beforeNode));
  }, { nodeId, beforeNode:before.campaign?.currentNodeId }, { timeout:10000 });
  await idle(page);
}
async function coverSecret(page) {
  const fixture = FIXTURES.secret;
  await fresh(page, fixture.seed);
  await selectAndTravel(page, fixture.path[0]);
  await resolveNode(page, true);
  let state = await snap(page);
  assert.strictEqual(state.status, 'campaign');
  assert.strictEqual(state.campaign?.secret?.status, 'pending', 'secret discovery must remain pending for player choice');
  await checkpoint(page, fixture.seed, 'secret_pending');
  await click(page, '[data-secret-decision="enter"]'); await idle(page);
  state = await snap(page);
  assert.strictEqual(state.campaign?.secret?.status, 'active');
  await checkpoint(page, fixture.seed, 'secret_active');
  await click(page, '[data-complete-secret]'); await idle(page);
  state = await snap(page);
  assert.strictEqual(state.campaign?.secret?.status, 'completed');
  assert.strictEqual(state.status, 'campaign');
  log('secret:PASS');
}
async function coverForced(page) {
  const seed = 9042;
  await fresh(page, seed);
  let state = await snap(page);
  const initialRoutes = (state.campaign?.routes || []).slice(0,2);
  for (const route of initialRoutes) {
    await waitRouteRendered(page, route.to);
    await click(page, `[data-node-id="${route.to}"]`);
    await page.waitForFunction((wanted) => globalThis.RPChessVerticalSlice?.presenter?.selectedCampaignNodeId === wanted, route.to, { timeout:5000 });
    if (await visible(page, '[data-rpu-scout]:not([disabled])')) { await click(page, '[data-rpu-scout]:not([disabled])'); await idle(page); }
  }
  for (let guard=0; guard<16; guard+=1) {
    state = await snap(page);
    assert.strictEqual(state.status, 'campaign');
    if (state.campaign?.secret?.status === 'pending' && await visible(page, '[data-secret-decision="decline"]')) { await click(page, '[data-secret-decision="decline"]'); await idle(page); continue; }
    const forced = (state.campaign?.routes || []).find((route) => route.requiresForcedMarch);
    if (forced) {
      await waitRouteRendered(page, forced.to);
      await click(page, `[data-node-id="${forced.to}"]`);
      await page.waitForFunction((wanted) => globalThis.RPChessVerticalSlice?.presenter?.selectedCampaignNodeId === wanted, forced.to, { timeout:5000 });
      const button = page.locator('[data-rpu-travel]').first();
      await button.waitFor({ state:'visible', timeout:5000 });
      assert.strictEqual(await button.isEnabled(), true, 'forced march CTA must be enabled');
      assert.match((await button.textContent()) || '', /ФОРСИРОВАННЫЙ МАРШ/i);
      await button.click();
      await page.waitForFunction(() => Number(globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()?.campaign?.forcedMarch?.consecutiveCount || 0) >= 1, null, { timeout:10000 });
      await idle(page);
      const after = await snap(page);
      assert.ok(Number(after.campaign?.forcedMarch?.consecutiveCount || 0) >= 1);
      log(`forced-march:${state.campaign?.currentNodeId}->${forced.to}:PASS`);
      return;
    }
    const routes = state.campaign?.routes || [];
    const normal = routes.filter((route) => route.type !== 'boss' && !route.requiresForcedMarch);
    const route = normal.find((entry) => !['event','service'].includes(entry.type)) || normal[0] || routes.find((entry) => entry.type !== 'boss') || routes[0];
    assert.ok(route, 'campaign ended before forced march became available');
    await selectAndTravel(page, route.to);
    await resolveNode(page, false);
  }
  throw new Error('forced march did not become available in 16 traversals');
}

(async()=>{
  const browser = await chromium.launch({ headless:true });
  try {
    const context = await browser.newContext({ viewport:{ width:1366, height:768 } });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors=[]; page.on('pageerror',(error)=>errors.push(error.message));
    await coverSecret(page);
    await coverForced(page);
    assert.deepStrictEqual(errors, [], `page errors: ${errors.join(' | ')}`);
    console.log('Iron Marches secret + forced march real Chromium: PASS');
    await context.close();
  } finally { await browser.close(); }
})().catch((error)=>{ console.error(error.stack || error); process.exitCode=1; });
