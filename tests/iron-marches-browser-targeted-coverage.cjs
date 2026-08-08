'use strict';

const assert = require('assert');
const { chromium } = require('playwright');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');
const { chooseObjectiveBrowserCommand } = require('./helpers/objective-browser-guide.cjs');
const FIXTURES = require('./fixtures/iron-marches-targeted.cjs');

const BASE_URL = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const TEMPLATES = buildBrowserProductionBundle().scenarioTemplates;
const EVENT_IDS = Object.keys(FIXTURES.events).sort();

function log(message) { console.log(`[targeted-chromium] ${message}`); }
async function snapshot(page) { return page.evaluate(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.() || null); }
async function idle(page) { await page.waitForFunction(() => !globalThis.RPChessVerticalSlice?.runtimeClient?.pending, null, { timeout:8000 }); }
async function click(page, target) {
  const locator = typeof target === 'string' ? page.locator(target).first() : (target.first ? target.first() : target);
  await locator.waitFor({ state:'visible', timeout:8000 });
  await locator.scrollIntoViewIfNeeded();
  await locator.click({ timeout:8000 });
}
async function visibleEnabled(page, selector) {
  const locator = page.locator(selector).first();
  return Boolean(await locator.count() && await locator.isVisible().catch(() => false) && await locator.isEnabled().catch(() => false));
}
async function checkpoint(page, seed, label) {
  await idle(page);
  const before = await snapshot(page);
  assert.ok(before, `${label}: missing snapshot before reload`);
  await page.goto(`${BASE_URL}/index.html?profile=profile-1&autosave=1&seed=${seed}`, { waitUntil:'domcontentloaded', timeout:15000 });
  await page.waitForFunction(() => Boolean(globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()), null, { timeout:12000 });
  await idle(page);
  const after = await snapshot(page);
  assert.deepStrictEqual(after, before, `${label}: state changed across real page reload`);
  log(`reload:${label}`);
}

async function freshRun(page, seed, draftHeroId = null, draftRegularType = null) {
  await page.goto(`${BASE_URL}/index.html?new=1&seed=${seed}&autosave=1`, { waitUntil:'domcontentloaded', timeout:15000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil:'domcontentloaded', timeout:15000 });
  await click(page, '[data-shell-action="profiles"]');
  await click(page, page.locator('[data-profile-action="start"]').first());
  await click(page, '[data-launch-commander]');
  await page.locator('.rprs').waitFor({ state:'visible', timeout:8000 });
  await click(page, '[data-king-id]:not([disabled])');
  await idle(page);
  await click(page, '[data-doctrine-id]:not([disabled])');
  await idle(page);
  await click(page, '[data-lock-selection]');
  await page.locator('[data-draft-hero]').first().waitFor({ state:'visible', timeout:8000 });
  if (draftHeroId && await page.locator(`[data-draft-hero="${draftHeroId}"]`).count()) await click(page, `[data-draft-hero="${draftHeroId}"]`);
  else await click(page, '[data-draft-hero]');
  await idle(page);
  if (draftRegularType) {
    const state = await snapshot(page);
    const offer = state.stageB?.draft?.regularOffers?.find((entry) => entry.type === draftRegularType);
    assert.ok(offer, `draft has no regular ${draftRegularType} offer`);
    await click(page, `[data-draft-regular="${offer.id}"]`);
  } else {
    await click(page, '[data-draft-regular]');
  }
  await idle(page);
  await click(page, '[data-confirm-draft]');
  await page.waitForFunction(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()?.status === 'campaign', null, { timeout:10000 });
  await idle(page);
}

async function handleTalent(page) {
  const modal = page.locator('[data-rpu-talent-modal]');
  if (await modal.count() && await modal.isVisible().catch(() => false)) {
    await click(page, modal.locator('[data-talent-id]').first());
    await idle(page);
    return true;
  }
  return false;
}

async function battleSquarePoint(page, square) {
  const canvas = page.locator('[data-board]').first();
  const box = await canvas.boundingBox();
  assert.ok(box, `board is not visible for ${square}`);
  const point = await page.evaluate((wanted) => {
    const presenter = globalThis.RPChessVerticalSlice?.presenter;
    const viewport = presenter?.boardReport?.viewport;
    const cell = presenter?.boardPlan?.activeCells?.find((entry) => entry.square === wanted);
    const element = document.querySelector('[data-board]');
    if (!viewport || !cell || !element) return null;
    const rect = element.getBoundingClientRect();
    const sx = rect.width / (element.width || rect.width);
    const sy = rect.height / (element.height || rect.height);
    return {
      x:(viewport.x + (cell.displayX + .5) * viewport.cellSize) * sx,
      y:(viewport.y + (cell.displayY + .5) * viewport.cellSize) * sy
    };
  }, square);
  assert.ok(point, `missing board geometry for ${square}`);
  return { x:box.x + point.x, y:box.y + point.y };
}

async function deploymentSquarePoint(page, square) {
  const canvas = page.locator('[data-deployment-board]').first();
  const box = await canvas.boundingBox();
  assert.ok(box, `deployment board is not visible for ${square}`);
  const point = await page.evaluate((wanted) => {
    const presenter = globalThis.RPChessVerticalSlice?.presenter;
    const viewport = presenter?.boardReport?.viewport;
    const cell = presenter?.boardPlan?.activeCells?.find((entry) => entry.square === wanted);
    if (!viewport || !cell) return null;
    return {
      x:viewport.x + (cell.displayX + .5) * viewport.cellSize,
      y:viewport.y + (cell.displayY + .5) * viewport.cellSize
    };
  }, square);
  assert.ok(point, `missing deployment geometry for ${square}`);
  return { x:box.x + point.x, y:box.y + point.y };
}

function scenarioIndex(state) { return Number(state?.scenario?.actionIndex ?? state?.scenario?.battle?.actionIndex ?? 0); }
async function realMove(page, command) {
  const state = await snapshot(page);
  const before = scenarioIndex(state);
  const from = await battleSquarePoint(page, command.payload.from);
  const to = await battleSquarePoint(page, command.payload.to);
  await page.mouse.click(from.x, from.y);
  await page.mouse.click(to.x, to.y);
  await page.waitForFunction(({ status, before }) => {
    const next = globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.();
    if (!next) return false;
    if (next.status !== status) return true;
    return Number(next.scenario?.actionIndex ?? next.scenario?.battle?.actionIndex ?? 0) > before && Boolean(next.scenario?.playerTurn);
  }, { status:state.status, before }, { timeout:9000 });
  await page.waitForFunction(() => !globalThis.RPChessVerticalSlice?.presenter?.animationRunning, null, { timeout:8000 });
  await idle(page);
}

async function ensureDeploymentPiece(page, pieceType) {
  let state = await snapshot(page);
  assert.strictEqual(state.status, 'deployment');
  let unit = state.deployment?.units?.find((entry) => entry.type === pieceType && !entry.fixed && String(entry.id).includes('draft'))
    || state.deployment?.units?.find((entry) => entry.type === pieceType && !entry.fixed);
  assert.ok(unit, `deployment has no optional ${pieceType} unit`);
  if (unit.square) return unit;

  while (Number(state.deployment.commandSpent || 0) + Number(unit.commandCost || 0) > Number(state.deployment.commandLimit || 0)) {
    const removable = (state.deployment.units || [])
      .filter((entry) => !entry.fixed && entry.square && entry.id !== unit.id)
      .sort((a,b) => Number(b.commandCost || 0) - Number(a.commandCost || 0))[0];
    assert.ok(removable, `cannot free command budget for ${pieceType}`);
    await click(page, `[data-deployment-remove="${removable.id}"]`);
    await idle(page);
    state = await snapshot(page);
    unit = state.deployment.units.find((entry) => entry.id === unit.id);
  }

  const occupied = new Set((state.deployment.units || []).map((entry) => entry.square).filter(Boolean));
  const blocked = new Set((state.scenario?.environment || [])
    .filter((entry) => entry.passable === false || entry.type === 'blocker')
    .flatMap((entry) => entry.cells || []));
  const square = (state.deployment.zone || []).find((cell) => !occupied.has(cell) && !blocked.has(cell));
  assert.ok(square, `no free deployment square for ${pieceType}`);
  await click(page, `[data-deployment-unit="${unit.id}"]`);
  const point = await deploymentSquarePoint(page, square);
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(({ unitId, square }) => {
    const state = globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.();
    return state?.deployment?.units?.some((entry) => entry.id === unitId && entry.square === square);
  }, { unitId:unit.id, square }, { timeout:8000 });
  await idle(page);
  state = await snapshot(page);
  unit = state.deployment.units.find((entry) => entry.id === unit.id);
  assert.strictEqual(unit?.square, square, `${pieceType} was not placed through deployment UI`);
  return unit;
}

async function finishScenario(page) {
  for (let guard=0; guard<40; guard+=1) {
    const state = await snapshot(page);
    if (!['scenario','boss'].includes(state.status)) return;
    const command = chooseObjectiveBrowserCommand(state, TEMPLATES);
    assert.ok(command, `no objective-guided command for ${state.scenario?.scenarioId}`);
    await realMove(page, command);
  }
  throw new Error('scenario did not finish in 40 real UI moves');
}

async function finishReward(page) {
  await handleTalent(page);
  const state = await snapshot(page);
  if (state.status === 'reward') {
    await click(page, '[data-claim]');
    await idle(page);
    return;
  }
  if (state.status === 'reward_choice') {
    const offers = state.stageB?.rewardOffers || [];
    const preferred = offers.find((offer) => !['supplies','heal'].includes(offer.type)) || offers[0];
    const selector = preferred ? `[data-reward-offer="${preferred.id}"]` : '[data-reward-offer]:not([disabled])';
    await click(page, selector);
    await idle(page);
  }
}

async function finishService(page, targetType = null) {
  const state = await snapshot(page);
  assert.strictEqual(state.status, 'service');
  const serviceType = state.stageB?.service?.type;
  if (targetType) assert.strictEqual(serviceType, targetType, `expected ${targetType} service, got ${serviceType}`);
  if (targetType) {
    const enabled = page.locator('[data-service-offer]:not([disabled])').first();
    assert.ok(await enabled.count(), `${targetType}: no enabled service offer`);
    const beforeGold = Number(state.resources?.gold || 0);
    await click(page, enabled);
    await idle(page);
    const after = await snapshot(page);
    assert.ok(after.status !== 'service' || Number(after.resources?.gold || 0) <= beforeGold, `${targetType}: service click had no observable effect`);
  }
  if ((await snapshot(page)).status === 'service') {
    await click(page, '[data-leave-service]');
    await idle(page);
  }
}

async function finishEvent(page, options = {}) {
  let didFirst = false;
  let didSecond = false;
  for (let guard=0; guard<16; guard+=1) {
    await handleTalent(page);
    const state = await snapshot(page);
    if (state.status === 'campaign') return;
    if (state.status === 'scenario') {
      if (options.reloadCombat && !options._combatReloaded) {
        options._combatReloaded = true;
        await checkpoint(page, options.seed, `${options.eventId}:event_combat_pending`);
      }
      await finishScenario(page);
      continue;
    }
    if (state.status === 'reward' || state.status === 'reward_choice') {
      await finishReward(page);
      continue;
    }
    assert.strictEqual(state.status, 'event', `${options.eventId}: unexpected event flow status ${state.status}`);
    assert.strictEqual(state.event?.eventId, options.eventId, `expected ${options.eventId}, got ${state.event?.eventId}`);
    if (!didFirst) {
      didFirst = true;
      await checkpoint(page, options.seed, `${options.eventId}:stage1`);
    } else if (!didSecond) {
      didSecond = true;
      await checkpoint(page, options.seed, `${options.eventId}:stage2`);
    }
    let selector = '[data-choice-id]:not([disabled])';
    if (options.firstChoiceId && state.event?.stageIndex === 0 && await page.locator(`[data-choice-id="${options.firstChoiceId}"]:not([disabled])`).count()) {
      selector = `[data-choice-id="${options.firstChoiceId}"]:not([disabled])`;
    }
    await click(page, selector);
    await idle(page);
  }
  throw new Error(`${options.eventId}: event did not resolve`);
}

async function resolveCurrentNode(page) {
  for (let guard=0; guard<60; guard+=1) {
    if (await handleTalent(page)) continue;
    const state = await snapshot(page);
    if (state.status === 'campaign') {
      if (state.campaign?.secret?.status === 'pending' && await visibleEnabled(page, '[data-secret-decision="decline"]')) {
        await click(page, '[data-secret-decision="decline"]');
        await idle(page);
        continue;
      }
      return;
    }
    if (state.status === 'briefing') { await click(page, '[data-confirm-briefing]'); await idle(page); continue; }
    if (state.status === 'deployment') { await click(page, '[data-confirm-deployment]'); await idle(page); continue; }
    if (state.status === 'scenario') { await finishScenario(page); continue; }
    if (state.status === 'reward' || state.status === 'reward_choice') { await finishReward(page); continue; }
    if (state.status === 'service') { await finishService(page); continue; }
    if (state.status === 'event') {
      const eventId = state.event?.eventId;
      await finishEvent(page, { seed:state.seed, eventId });
      continue;
    }
    throw new Error(`cannot resolve intermediate status ${state.status}`);
  }
  throw new Error('intermediate node did not resolve');
}

async function travelExact(page, nodeId) {
  let state = await snapshot(page);
  assert.strictEqual(state.status, 'campaign');
  if (state.campaign?.secret?.status === 'pending' && await visibleEnabled(page, '[data-secret-decision="decline"]')) {
    await click(page, '[data-secret-decision="decline"]');
    await idle(page);
    state = await snapshot(page);
  }
  const route = (state.campaign?.routes || []).find((entry) => entry.to === nodeId);
  assert.ok(route, `route ${nodeId} is not available from ${state.campaign?.currentNodeId}`);
  const beforeNodeId = state.campaign?.currentNodeId;
  await click(page, `[data-node-id="${nodeId}"]`);
  await click(page, '[data-rpu-travel]');
  await page.waitForFunction(({ beforeNodeId, nodeId }) => {
    const next = globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.();
    if (!next) return false;
    return next.status !== 'campaign' || next.campaign?.currentNodeId === nodeId || next.campaign?.currentNodeId !== beforeNodeId;
  }, { beforeNodeId, nodeId }, { timeout:8000 });
  await idle(page);
}

async function reachPathTarget(page, path) {
  for (let i=0; i<path.length; i+=1) {
    await travelExact(page, path[i]);
    if (i < path.length - 1) await resolveCurrentNode(page);
  }
}

async function coverEvent(page, eventId, fixture) {
  await freshRun(page, fixture.seed);
  await reachPathTarget(page, fixture.path);
  const state = await snapshot(page);
  assert.strictEqual(state.status, 'event', `${eventId}: target did not open an event`);
  assert.strictEqual(state.event?.eventId, eventId);
  await finishEvent(page, {
    seed:fixture.seed,
    eventId,
    firstChoiceId:eventId === 'event.miners_on_strike' ? 'guards' : null,
    reloadCombat:eventId === 'event.miners_on_strike'
  });
  assert.strictEqual((await snapshot(page)).status, 'campaign', `${eventId}: did not return to campaign`);
  log(`event:${eventId}:PASS`);
}

async function coverService(page, type, fixture) {
  await freshRun(page, fixture.seed);
  await reachPathTarget(page, fixture.path);
  const state = await snapshot(page);
  assert.strictEqual(state.status, 'service', `${type}: target did not open service`);
  await finishService(page, type);
  assert.strictEqual((await snapshot(page)).status, 'campaign');
  log(`service:${type}:PASS`);
}

async function coverSecret(page) {
  const fixture = FIXTURES.secret;
  await freshRun(page, fixture.seed);
  for (const nodeId of fixture.path) {
    await travelExact(page, nodeId);
    await resolveCurrentNode(page);
  }
  let state = await snapshot(page);
  assert.strictEqual(state.status, 'campaign');
  assert.strictEqual(state.campaign?.secret?.status, 'pending', 'secret decision was not discovered');
  await checkpoint(page, fixture.seed, 'secret:pending');
  await click(page, '[data-secret-decision="enter"]');
  await idle(page);
  state = await snapshot(page);
  assert.strictEqual(state.campaign?.secret?.status, 'active');
  await checkpoint(page, fixture.seed, 'secret:active');
  await click(page, '[data-complete-secret]');
  await idle(page);
  state = await snapshot(page);
  assert.strictEqual(state.campaign?.secret?.status, 'completed');
  assert.strictEqual(state.status, 'campaign');
  log('secret:PASS');
}

async function coverPinnedPiece(page, label, fixture, pieceType) {
  await freshRun(page, fixture.seed, fixture.draftHeroId);
  await reachPathTarget(page, fixture.path);
  assert.strictEqual((await snapshot(page)).status, 'briefing');
  await click(page, '[data-confirm-briefing]'); await idle(page);
  await click(page, '[data-confirm-deployment]'); await idle(page);
  const state = await snapshot(page);
  assert.strictEqual(state.status, 'scenario');
  assert.strictEqual(state.scenario?.scenarioId, fixture.scenarioId);
  const piece = (state.scenario.pieces || []).find((entry) => entry.square === fixture.move.from);
  assert.strictEqual(piece?.type, pieceType, `${label}: fixture origin does not contain expected piece`);
  const legal = (state.scenario.legalCommands || []).find((command) => command.type === 'MovePiece' && command.payload.from === fixture.move.from && command.payload.to === fixture.move.to);
  assert.ok(legal, `${label}: pinned move is not legal`);
  const before = scenarioIndex(state);
  await realMove(page, legal);
  const after = await snapshot(page);
  assert.ok(after.status !== 'scenario' || scenarioIndex(after) > before, `${label}: real canvas move was not accepted`);
  log(`piece:${label}:${fixture.move.from}->${fixture.move.to}:PASS`);
}

async function coverKnight(page, fixture) {
  await freshRun(page, fixture.seed, null, 'n');
  await reachPathTarget(page, fixture.path);
  assert.strictEqual((await snapshot(page)).status, 'briefing');
  await click(page, '[data-confirm-briefing]');
  await idle(page);
  assert.strictEqual((await snapshot(page)).status, 'deployment');
  await ensureDeploymentPiece(page, 'n');
  assert.ok(await visibleEnabled(page, '[data-confirm-deployment]'), 'deployment cannot be confirmed after placing knight');
  await click(page, '[data-confirm-deployment]');
  await idle(page);
  const state = await snapshot(page);
  assert.strictEqual(state.status, 'scenario');
  const bySquare = new Map((state.scenario.pieces || []).map((piece) => [piece.square, piece]));
  const legal = (state.scenario.legalCommands || []).find((command) => command.type === 'MovePiece'
    && bySquare.get(command.payload.from)?.side === state.scenario.playerSide
    && bySquare.get(command.payload.from)?.type === 'n');
  assert.ok(legal, 'deployed knight has no legal UI move');
  const before = scenarioIndex(state);
  await realMove(page, legal);
  const after = await snapshot(page);
  assert.ok(after.status !== 'scenario' || scenarioIndex(after) > before, 'knight real canvas move was not accepted');
  log(`piece:knight:${legal.payload.from}->${legal.payload.to}:PASS`);
}

async function coverForcedMarch(page) {
  const fixture = FIXTURES.services.camp;
  await freshRun(page, fixture.seed);
  let state = await snapshot(page);
  const scoutTargets = (state.campaign?.routes || []).slice(0,2);
  for (const route of scoutTargets) {
    await click(page, `[data-node-id="${route.to}"]`);
    if (await visibleEnabled(page, '[data-rpu-scout]:not([disabled])')) {
      await click(page, '[data-rpu-scout]:not([disabled])');
      await idle(page);
    }
  }
  let used = false;
  const preferredPath = [...fixture.path];
  for (let guard=0; guard<18 && !used; guard+=1) {
    state = await snapshot(page);
    assert.strictEqual(state.status, 'campaign');
    if (state.campaign?.secret?.status === 'pending' && await visibleEnabled(page, '[data-secret-decision="decline"]')) {
      await click(page, '[data-secret-decision="decline"]'); await idle(page); continue;
    }
    const forced = (state.campaign?.routes || []).find((route) => route.requiresForcedMarch);
    if (forced) {
      await click(page, `[data-node-id="${forced.to}"]`);
      const button = page.locator(`[data-forced-travel="${forced.to}"]`).first();
      assert.ok(await button.count(), 'forced march route has no final UI control');
      await click(page, button);
      await idle(page);
      const after = await snapshot(page);
      assert.ok(Number(after.campaign?.forcedMarch?.consecutiveCount || 0) >= 1, 'forced march consequence was not applied');
      used = true;
      break;
    }
    let nextId = preferredPath.shift();
    if (!nextId || !(state.campaign?.routes || []).some((route) => route.to === nextId)) {
      const nonBoss = (state.campaign?.routes || []).find((route) => route.type !== 'boss');
      nextId = nonBoss?.to || state.campaign?.routes?.[0]?.to;
    }
    assert.ok(nextId, 'forced march path ended before supplies were exhausted');
    await travelExact(page, nextId);
    await resolveCurrentNode(page);
  }
  assert.ok(used, 'no real forced march became available');
  log('forced-march:PASS');
}

(async () => {
  const browser = await chromium.launch({ headless:true });
  try {
    const context = await browser.newContext({ viewport:{ width:1366, height:768 } });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await coverPinnedPiece(page, 'pawn', FIXTURES.pieces.pawn, 'p');
    await coverKnight(page, FIXTURES.pieces.knight);
    await coverService(page, 'forge', FIXTURES.services.forge);
    await coverService(page, 'camp', FIXTURES.services.camp);
    for (const eventId of EVENT_IDS) await coverEvent(page, eventId, FIXTURES.events[eventId]);
    await coverSecret(page);
    await coverForcedMarch(page);

    assert.deepStrictEqual(pageErrors, [], `page errors: ${pageErrors.join(' | ')}`);
    console.log('Iron Marches targeted real Chromium coverage: PASS');
    console.log(JSON.stringify({
      pieces:['pawn','knight'],
      services:['forge','camp'],
      events:EVENT_IDS,
      secret:true,
      forcedMarch:true,
      eventReload:['stage1','stage2','combat_pending']
    }, null, 2));
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
