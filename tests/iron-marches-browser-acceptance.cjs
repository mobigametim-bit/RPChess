'use strict';

const assert = require('assert');
const { chromium } = require('playwright');

const BASE_URL = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const VIEWPORTS = [[1600,1000],[1366,768],[760,900],[390,844]];
const FORBIDDEN = [/\[object Object\]/i,/\bundefined\b/i,/\bNaN\b/i,/fate\.iron_marches/i,/politics\.iron_marches/i,/obligation\.iron_marches/i];
const seen = {
  statuses:new Set(), viewports:new Set(), movers:new Set(), events:new Set(), services:new Set(),
  scout:false, capture:false, ai:false, orders:false, talent:false, boss:false, bossTransition:false,
  actReward:false, interAct:false, secret:false, forced:false, reopen:false
};

function log(message, data = '') {
  const suffix = data === '' ? '' : ` ${typeof data === 'string' ? data : JSON.stringify(data)}`;
  console.log(`[chromium-acceptance] ${message}${suffix}`);
}
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function distance(a,b) {
  return Math.abs(String(a).charCodeAt(0)-String(b).charCodeAt(0)) + Math.abs(Number(String(a).slice(1))-Number(String(b).slice(1)));
}
async function snapshot(page) {
  return page.evaluate(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.() || globalThis.RPChessVerticalSlice?.runtimeClient?.getSnapshot?.() || null);
}
async function realClick(page, target) {
  const locator = typeof target === 'string' ? page.locator(target).first() : (target.first ? target.first() : target);
  await locator.waitFor({ state:'visible', timeout:5000 });
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();
  assert.ok(box, `pointer target has no box: ${typeof target === 'string' ? target : 'locator'}`);
  await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
}
async function clickIf(page, selector) {
  const locator = page.locator(selector).first();
  if (await locator.count() && await locator.isVisible().catch(() => false) && await locator.isEnabled().catch(() => true)) {
    await realClick(page, locator);
    return true;
  }
  return false;
}
function captureErrors(page, errors) {
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || '';
    if (!request.url().startsWith('data:') && failure !== 'net::ERR_ABORTED') errors.push(`requestfailed: ${failure} ${request.url()}`);
  });
}
async function qaSurface(page, label) {
  const text = await page.locator('body').innerText().catch(() => '');
  for (const pattern of FORBIDDEN) assert.strictEqual(pattern.test(text), false, `${label}: leaked ${pattern}`);
  const layout = await page.evaluate(() => ({
    width:innerWidth,
    scrollWidth:Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    dialogs:[...document.querySelectorAll('[role="dialog"],.rpu-modal__window')]
      .filter((node) => node.getClientRects().length)
      .map((node) => { const rect=node.getBoundingClientRect(); return [rect.left, rect.right]; })
  }));
  assert.ok(layout.scrollWidth <= layout.width + 3, `${label}: horizontal overflow ${layout.scrollWidth}>${layout.width}`);
  for (const [left,right] of layout.dialogs) assert.ok(left >= -3 && right <= layout.width + 3, `${label}: modal overflow`);
}

async function freshCommander(page, seed) {
  log('open-main', seed);
  await page.goto(`${BASE_URL}/index.html?new=1&seed=${seed}&autosave=1`, { waitUntil:'domcontentloaded', timeout:15000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil:'domcontentloaded', timeout:15000 });
  await page.locator('[data-shell-action="profiles"]').waitFor({ state:'visible', timeout:10000 });
  await realClick(page, '[data-shell-action="profiles"]');
  await realClick(page, page.locator('[data-profile-action="start"]').first());
  await page.locator('[data-launch-commander]').waitFor({ state:'visible', timeout:10000 });
  await qaSurface(page, 'commander');
}
async function setup(page, seed) {
  await freshCommander(page, seed);
  log('commander-to-explicit-setup');
  const launch = page.locator('[data-launch-commander]');
  assert.match(await launch.innerText(), /КОРОЛЯ|KING/i);
  await realClick(page, launch);
  await page.locator('.rprs').waitFor({ state:'visible', timeout:10000 });
  assert.strictEqual(await page.locator('#rprs-kings').innerText(), '1. Выберите короля');
  assert.strictEqual(await page.locator('#rprs-doctrines').innerText(), '2. Выберите доктрину');
  assert.strictEqual(await page.locator('section[aria-labelledby="rprs-heroes"]').isHidden(), true);
  const lock = page.locator('[data-lock-selection]');
  assert.strictEqual(await lock.isEnabled(), false, 'setup locked before king/doctrine');
  await realClick(page, '[data-king-id]:not([disabled])');
  await realClick(page, '[data-doctrine-id]:not([disabled])');
  assert.strictEqual(await lock.isEnabled(), true, 'setup did not unlock after king/doctrine');
  await realClick(page, lock);
  await page.locator('[data-draft-hero]').first().waitFor({ state:'visible', timeout:10000 });
  assert.strictEqual(await page.locator('[data-draft-hero]').count(), 3, 'Stage B must expose exactly three hero offers');
  await realClick(page, '[data-draft-hero]');
  await realClick(page, '[data-draft-regular]');
  await realClick(page, '[data-confirm-draft]');
  await page.waitForFunction(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()?.status === 'campaign', null, { timeout:10000 });
  await qaSurface(page, 'campaign');
  log('fresh-run-ready');
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
  if (objective?.type === 'checkmate') {
    const authoredMate = legal.find((command) => command.payload.from === 'g6' && command.payload.to === 'g7');
    if (authoredMate) return authoredMate;
  }
  if (escort && cells.length) {
    return legal.filter((command) => command.payload.from === escort)
      .sort((a,b) => Math.min(...cells.map((target) => distance(a.payload.to,target))) - Math.min(...cells.map((target) => distance(b.payload.to,target))))[0] || legal[0];
  }
  if (targets.length) {
    return legal.slice().sort((a,b) => {
      const aScore=(targets.includes(a.payload.to)?-1000:0)+Math.min(...targets.map((target)=>distance(a.payload.to,target)));
      const bScore=(targets.includes(b.payload.to)?-1000:0)+Math.min(...targets.map((target)=>distance(b.payload.to,target)));
      return aScore-bScore;
    })[0];
  }
  if (cells.length) {
    return legal.slice().sort((a,b) => Math.min(...cells.map((target)=>distance(a.payload.to,target))) - Math.min(...cells.map((target)=>distance(b.payload.to,target))))[0];
  }
  return legal[0];
}
async function squarePoint(page, square) {
  const canvas = page.locator('[data-board]').first();
  const box = await canvas.boundingBox();
  assert.ok(box, 'battle canvas missing');
  const rendered = await page.evaluate((wanted) => {
    const presenter=globalThis.RPChessVerticalSlice?.presenter;
    const viewport=presenter?.boardReport?.viewport;
    const cell=presenter?.boardPlan?.activeCells?.find((entry)=>entry.square===wanted);
    const element=document.querySelector('[data-board]');
    if (!viewport || !cell || !element) return null;
    const rect=element.getBoundingClientRect();
    const internalWidth=element.width || rect.width;
    const internalHeight=element.height || rect.height;
    const scaleX=rect.width/internalWidth;
    const scaleY=rect.height/internalHeight;
    return {
      x:(viewport.x+(cell.displayX+.5)*viewport.cellSize)*scaleX,
      y:(viewport.y+(cell.displayY+.5)*viewport.cellSize)*scaleY
    };
  }, square);
  assert.ok(rendered, `no rendered geometry for ${square}`);
  return { x:box.x+rendered.x, y:box.y+rendered.y };
}
async function boardMove(page, command, before) {
  const mover = (before.scenario?.pieces || []).find((piece) => piece.square === command.payload.from);
  assert.ok(mover, `no mover at ${command.payload.from}`);
  seen.movers.add(mover.type);
  log('battle-move', `${mover.type}:${command.payload.from}->${command.payload.to}`);
  const from = await squarePoint(page, command.payload.from);
  const to = await squarePoint(page, command.payload.to);
  await page.mouse.click(from.x, from.y);
  await page.mouse.click(to.x, to.y);
  await page.waitForFunction(({pieceId,to,status}) => {
    const current=globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.();
    if (!current) return false;
    if (current.status !== status) return true;
    const pieces=current.scenario?.pieces || [];
    return pieces.some((piece)=>String(piece.pieceId||piece.id)===pieceId && piece.square===to);
  }, { pieceId:String(mover.pieceId||mover.id), to:command.payload.to, status:before.status }, { timeout:4000 });
}
async function battle(page, state) {
  seen.boss ||= state.status === 'boss';
  const order = state.scenario?.orderPoints?.player;
  if (order) {
    seen.orders=true;
    const text=await page.locator('body').innerText();
    assert.ok(text.includes(`${order.current} / ${order.max}`) || text.includes(`ОП ${order.current}/${order.max}`), 'current/max order points missing from battle UI');
  }
  if (await clickIf(page, '[data-finalize-scenario],[data-finalize]')) return;
  const command=objectiveMove(state);
  if (!command) {
    if (await clickIf(page,'[data-end-turn]')) return;
    throw new Error(`No legal UI move in ${state.scenario?.scenarioId || state.status}`);
  }
  if ((state.scenario?.pieces||[]).some((piece)=>piece.square===command.payload.to && piece.side!=='w')) seen.capture=true;
  const beforeActions=Number(state.scenario?.actionIndex ?? state.scenario?.battle?.actionIndex ?? 0);
  await boardMove(page,command,state);
  const after=await snapshot(page);
  if (after?.scenario) {
    const afterActions=Number(after.scenario.actionIndex ?? after.scenario.battle?.actionIndex ?? beforeActions);
    assert.ok(afterActions>=beforeActions && afterActions<=beforeActions+2, 'one UI input resolved more than player/AI action pair');
    if (afterActions===beforeActions+2) seen.ai=true;
  }
}
async function maybeTalent(page) {
  const modal=page.locator('[data-rpu-talent-modal]');
  if (await modal.count() && await modal.isVisible().catch(()=>false)) {
    seen.talent=true;
    log('talent-choice');
    await realClick(page,modal.locator('[data-talent-id]').first());
    return true;
  }
  return false;
}
async function campaign(page,state) {
  if (state.campaign?.secret?.status==='pending') {
    seen.secret=true; log('secret-pending');
    if (await clickIf(page,'[data-secret-decision="enter"]')) return;
    await clickIf(page,'[data-secret-decision="decline"]'); return;
  }
  if (state.campaign?.secret?.status==='active') { seen.secret=true; log('secret-active'); await clickIf(page,'[data-complete-secret]'); return; }
  if ((state.campaign?.reopenableNodeIds||[]).length && await clickIf(page,'[data-reopen-node]')) { seen.reopen=true; log('rare-reopen'); return; }
  if (!seen.scout && await clickIf(page,'[data-rpu-scout]:not([disabled])')) { seen.scout=true; log('scout'); return; }
  if (await page.locator('[data-rpu-forced-choice]').count()) { seen.forced=true; log('forced-march'); await realClick(page,'[data-rpu-travel]:not([disabled])'); return; }
  const routes=page.locator('.rpu-map-node.is-route [data-node-id]:not([disabled])');
  if (await routes.count()) await realClick(page,routes.first());
  if (await clickIf(page,'[data-rpu-travel]:not([disabled])')) return;
  if (await clickIf(page,'[data-forced-travel]:not([disabled])')) { seen.forced=true; log('forced-march-fallback'); return; }
  throw new Error('campaign has no user-reachable action');
}
async function service(page,state) {
  seen.services.add(state.stageB?.service?.type || 'service');
  log('service', state.stageB?.service?.type || 'service');
  if (await page.locator('[data-service-offer]:not([disabled])').count()) {
    await realClick(page,'[data-service-offer]:not([disabled])');
    await delay(40);
  }
  assert.ok(await clickIf(page,'[data-leave-service]'), 'service has no leave control');
}
async function drive(page, seed) {
  await setup(page,seed);
  let previousStatus='';
  for (let guard=0; guard<160; guard+=1) {
    if (await maybeTalent(page)) continue;
    const state=await snapshot(page);
    assert.ok(state,'runtime snapshot missing');
    seen.statuses.add(state.status);
    if (state.status!==previousStatus) { log('status', state.status); previousStatus=state.status; }
    await qaSurface(page,`run:${state.status}`);
    if (state.event?.eventId) seen.events.add(state.event.eventId);
    if (state.status==='complete') return state;
    if (state.status==='failed') throw new Error(`run failed ${JSON.stringify(state.failure||state.scenario?.result||{})}`);
    if (state.status==='campaign') await campaign(page,state);
    else if (state.status==='briefing') await realClick(page,'[data-confirm-briefing]');
    else if (state.status==='deployment') {
      const confirm=page.locator('[data-confirm-deployment]');
      if (await confirm.isEnabled().catch(()=>false)) await realClick(page,confirm);
      else throw new Error('deployment requires placement; acceptance must implement that user path');
    }
    else if (state.status==='scenario' || state.status==='boss') await battle(page,state);
    else if (state.status==='boss_transition') {
      seen.bossTransition=true;
      assert.ok(await clickIf(page,'[data-begin-boss-phase],[data-resume-boss],[data-boss-transition]'),'boss transition lacks UI control');
    }
    else if (state.status==='event') {
      const choices=page.locator('[data-event-choice]:not([disabled]),[data-choice-id]:not([disabled])');
      assert.ok(await choices.count(),'event has no visible production choice');
      await realClick(page,choices.first());
    }
    else if (state.status==='reward') await realClick(page,'[data-claim]');
    else if (state.status==='reward_choice') {
      if (state.politicalFinaleB14?.stage==='act_reward') seen.actReward=true;
      await realClick(page,'[data-reward-offer]:not([disabled])');
    }
    else if (state.status==='service') await service(page,state);
    else if (state.status==='act_outcome') {
      const choice=page.locator('[data-act-choice]:not([disabled])').first();
      assert.ok(await choice.count(),'political stage has no available choice');
      await realClick(page,choice);
    }
    else if (state.status==='reorganization') {
      seen.interAct=true;
      assert.ok(await page.locator('[data-interact-conversion]').count(),'inter-act conversion is not bound');
      await realClick(page,'[data-confirm-reorganization]');
    }
    else throw new Error(`unhandled production status ${state.status}`);
    await delay(50);
  }
  throw new Error('run action guard exceeded');
}

async function responsive(browser) {
  for (const [width,height] of VIEWPORTS) {
    log('responsive', `${width}x${height}`);
    const page=await browser.newPage({viewport:{width,height}});
    page.setDefaultTimeout(7000);
    const errors=[]; captureErrors(page,errors);
    await freshCommander(page,9042);
    seen.viewports.add(`${width}x${height}`);
    await qaSurface(page,`${width}x${height}:commander`);
    await realClick(page,'[data-launch-commander]');
    await page.locator('.rprs').waitFor({state:'visible'});
    await qaSurface(page,`${width}x${height}:setup`);
    await realClick(page,'[data-king-id]:not([disabled])');
    await realClick(page,'[data-doctrine-id]:not([disabled])');
    await realClick(page,'[data-lock-selection]');
    await page.locator('[data-draft-hero]').first().waitFor({state:'visible'});
    await qaSurface(page,`${width}x${height}:draft`);
    assert.deepStrictEqual(errors,[],errors.join('\n'));
    await page.close();
  }
}

(async () => {
  const browser=await chromium.launch({headless:true});
  try {
    await responsive(browser);
    const page=await browser.newPage({viewport:{width:1366,height:768}});
    page.setDefaultTimeout(7000);
    const errors=[]; captureErrors(page,errors);
    const final=await drive(page,9042);
    assert.strictEqual(final.status,'complete');
    assert.ok(seen.statuses.has('campaign'),'campaign not reached');
    assert.ok(seen.scout,'reconnaissance not exercised');
    assert.ok(seen.boss,'boss UI not exercised');
    assert.ok(seen.actReward,'Act Reward not exercised');
    assert.ok(seen.interAct,'inter-act not exercised');
    assert.ok(seen.orders,'current/max order points not verified');
    assert.ok(seen.capture,'capture not performed through canvas pointer');
    assert.deepStrictEqual(errors,[],errors.join('\n'));
    console.log('Iron Marches Chromium acceptance PASS');
    console.log(JSON.stringify({
      viewports:[...seen.viewports], statuses:[...seen.statuses], movedPieceTypes:[...seen.movers],
      eventIds:[...seen.events], serviceTypes:[...seen.services], scouting:seen.scout, capture:seen.capture,
      aiTurn:seen.ai, orderPoints:seen.orders, talent:seen.talent, boss:seen.boss,
      bossTransition:seen.bossTransition, actReward:seen.actReward, interAct:seen.interAct,
      secret:seen.secret, forcedMarch:seen.forced, reopen:seen.reopen
    },null,2));
    await page.close();
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.stack||error); process.exitCode=1; });
