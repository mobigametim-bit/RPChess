'use strict';

const assert = require('assert');
const { chromium } = require('playwright');

const BASE_URL = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const VIEWPORTS = [
  { width:1600, height:1000, name:'1600x1000' },
  { width:1366, height:768, name:'1366x768' },
  { width:760, height:900, name:'760x900' },
  { width:390, height:844, name:'390x844' }
];
const FORBIDDEN_TEXT = [/\[object Object\]/i, /\bundefined\b/i, /\bnull\b/i, /\bNaN\b/i, /fate\.iron_marches/i, /politics\.iron_marches/i, /obligation\.iron_marches/i];
const observed = {
  statuses:new Set(), viewports:new Set(), battlePieceTypes:new Set(), eventIds:new Set(), serviceTypes:new Set(),
  sawScouting:false, sawCapture:false, sawAiTurn:false, sawOrderPoints:false, sawTalent:false,
  sawBoss:false, sawBossTransition:false, sawActReward:false, sawInterAct:false, sawSaveReload:false,
  sawSecret:false, sawForcedMarch:false, sawReopen:false
};

function delay(ms) { return new Promise((resolve)=>setTimeout(resolve,ms)); }
function squareDistance(a,b) {
  const file = (s)=>String(s).charCodeAt(0)-97;
  const rank = (s)=>Number(String(s).slice(1));
  return Math.abs(file(a)-file(b)) + Math.abs(rank(a)-rank(b));
}
async function runtimeSnapshot(page) {
  return page.evaluate(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.() || globalThis.RPChessVerticalSlice?.runtimeClient?.getSnapshot?.() || null);
}
async function waitRuntime(page, predicateSource, timeout=10000) {
  await page.waitForFunction((source) => {
    const snapshot = globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.() || globalThis.RPChessVerticalSlice?.runtimeClient?.getSnapshot?.();
    if (!snapshot) return false;
    return Function('snapshot', `return (${source});`)(snapshot);
  }, predicateSource, { timeout });
  return runtimeSnapshot(page);
}
async function clickIf(page, selector) {
  const locator = page.locator(selector).first();
  if (await locator.count() && await locator.isVisible().catch(()=>false) && await locator.isEnabled().catch(()=>true)) {
    await locator.click();
    return true;
  }
  return false;
}
async function bodyLeakCheck(page, label) {
  const body = await page.locator('body').innerText().catch(()=> '');
  for (const pattern of FORBIDDEN_TEXT) assert.strictEqual(pattern.test(body), false, `${label}: leaked ${pattern}`);
  const metrics = await page.evaluate(() => ({
    innerWidth:window.innerWidth,
    scrollWidth:Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    dialogs:[...document.querySelectorAll('[role="dialog"],.rpu-modal__window')].filter((node)=>node.getClientRects().length).map((node)=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};})
  }));
  assert.ok(metrics.scrollWidth <= metrics.innerWidth + 3, `${label}: horizontal overflow ${metrics.scrollWidth} > ${metrics.innerWidth}`);
  for (const dialog of metrics.dialogs) {
    assert.ok(dialog.right <= metrics.innerWidth + 3 && dialog.left >= -3, `${label}: modal exceeds horizontal viewport`);
  }
}
async function installFailureCapture(page, errors) {
  page.on('pageerror', (error)=>errors.push(`pageerror: ${error.message}`));
  page.on('console', (message)=>{ if (message.type()==='error') errors.push(`console: ${message.text()}`); });
  page.on('requestfailed', (request)=>{
    const url=request.url();
    if (!url.startsWith('data:')) errors.push(`requestfailed: ${request.failure()?.errorText || ''} ${url}`);
  });
}
async function freshCommanderScreen(page, seed) {
  await page.goto(`${BASE_URL}/index.html?new=1&seed=${seed}&autosave=1`, { waitUntil:'networkidle' });
  await page.evaluate(()=>localStorage.clear());
  await page.reload({ waitUntil:'networkidle' });
  await page.locator('[data-shell-action="profiles"]').click();
  await page.locator('[data-profile-action="start"]').first().click();
  await page.locator('[data-launch-commander]').waitFor({ state:'visible' });
  await bodyLeakCheck(page,'commander-selection');
}
async function explicitSetup(page, seed) {
  await freshCommanderScreen(page,seed);
  const launch = page.locator('[data-launch-commander]');
  assert.match(await launch.innerText(), /КОРОЛЯ|KING/i);
  await launch.click();
  await page.locator('.rprs').waitFor({ state:'visible' });
  assert.strictEqual(await page.locator('#rprs-kings').innerText(), '1. Выберите короля');
  assert.strictEqual(await page.locator('#rprs-doctrines').innerText(), '2. Выберите доктрину');
  assert.strictEqual(await page.locator('section[aria-labelledby="rprs-heroes"]').isHidden(), true);
  assert.match(await page.locator('.rprs__counter').innerText(), /3/);
  const lock = page.locator('[data-lock-selection]');
  assert.strictEqual(await lock.isEnabled(), false, 'run must not lock before explicit king/doctrine selection');
  await page.locator('[data-king-id]:not([disabled])').first().click();
  await page.locator('[data-doctrine-id]:not([disabled])').first().click();
  assert.strictEqual(await lock.isEnabled(), true, 'run must become lockable after explicit king/doctrine selection');
  await lock.click();
  await page.locator('[data-draft-hero]').first().waitFor({ state:'visible' });
  assert.strictEqual(await page.locator('[data-draft-hero]').count(), 3, 'fresh run must expose exactly three seed-materialized hero offers');
  await page.locator('[data-draft-hero]').first().click();
  await page.locator('[data-draft-regular]').first().click();
  await page.locator('[data-confirm-draft]').click();
  await waitRuntime(page, `snapshot.status === 'campaign'`);
  await bodyLeakCheck(page,'fresh-campaign');
}
function chooseObjectiveCommand(snapshot) {
  const scenario=snapshot.scenario;
  const legal=(scenario?.legalCommands || []).filter((c)=>c.type==='MovePiece');
  if (!legal.length) return null;
  const pieces=scenario.pieces || [];
  const objectives=(scenario.objectives || []).filter((o)=>!o.complete && !o.completed && o.status!=='completed');
  const objective=objectives[0] || scenario.objectives?.[0] || null;
  const pieceById=(id)=>pieces.find((p)=>p.pieceId===id || p.id===id);
  const targetSquares=(objective?.targetPieceIds || []).map((id)=>pieceById(id)?.square).filter(Boolean);
  const destinationSquares=(objective?.targetCells || objective?.cells || []).filter(Boolean);
  const escortSquare=objective?.pieceId ? pieceById(objective.pieceId)?.square : null;
  const directTarget=new Set([...targetSquares,...destinationSquares]);
  const direct=legal.find((c)=>directTarget.has(c.payload.to) && (!escortSquare || c.payload.from===escortSquare));
  if (direct) return direct;
  if (objective?.type==='checkmate') {
    const qg7=legal.find((c)=>c.payload.from==='g6' && c.payload.to==='g7');
    if (qg7) return qg7;
  }
  if (escortSquare && destinationSquares.length) {
    return legal.filter((c)=>c.payload.from===escortSquare).sort((a,b)=>Math.min(...destinationSquares.map((t)=>squareDistance(a.payload.to,t)))-Math.min(...destinationSquares.map((t)=>squareDistance(b.payload.to,t))))[0] || legal[0];
  }
  if (targetSquares.length) {
    const playerPieces=new Set(pieces.filter((p)=>p.side===snapshot.scenario.playerSide || p.side==='w').map((p)=>p.square));
    return legal.slice().sort((a,b)=>{
      const captureA=targetSquares.includes(a.payload.to)?-1000:0, captureB=targetSquares.includes(b.payload.to)?-1000:0;
      const da=Math.min(...targetSquares.map((t)=>squareDistance(a.payload.to,t))), db=Math.min(...targetSquares.map((t)=>squareDistance(b.payload.to,t)));
      const moverA=playerPieces.has(a.payload.from)?0:50, moverB=playerPieces.has(b.payload.from)?0:50;
      return captureA+da+moverA-(captureB+db+moverB);
    })[0];
  }
  if (destinationSquares.length) return legal.slice().sort((a,b)=>Math.min(...destinationSquares.map((t)=>squareDistance(a.payload.to,t)))-Math.min(...destinationSquares.map((t)=>squareDistance(b.payload.to,t))))[0];
  return legal[0];
}
async function canvasSquarePoint(page, selector, square) {
  const box=await page.locator(selector).boundingBox();
  assert.ok(box,`missing canvas ${selector}`);
  const padding=24;
  const cell=Math.max(1,Math.floor(Math.min((box.width-padding*2)/8,(box.height-padding*2)/8)));
  const boardWidth=cell*8, boardHeight=cell*8;
  const originX=box.x+Math.floor((box.width-boardWidth)/2), originY=box.y+Math.floor((box.height-boardHeight)/2);
  const x=String(square).charCodeAt(0)-97, rank=Number(String(square).slice(1)), y=8-rank;
  return { x:originX+(x+.5)*cell, y:originY+(y+.5)*cell };
}
async function pointerMove(page, command, before) {
  const from=await canvasSquarePoint(page,'[data-board],.rpvs__canvas:not([data-deployment-board])',command.payload.from);
  const to=await canvasSquarePoint(page,'[data-board],.rpvs__canvas:not([data-deployment-board])',command.payload.to);
  await page.mouse.click(from.x,from.y);
  await page.mouse.click(to.x,to.y);
  await page.waitForFunction((actionIndex)=>{
    const s=globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.();
    return !s || !['scenario','boss'].includes(s.status) || Number(s.scenario?.actionIndex ?? s.scenario?.battle?.actionIndex ?? 0) !== actionIndex;
  }, Number(before.scenario?.actionIndex ?? before.scenario?.battle?.actionIndex ?? 0), { timeout:10000 }).catch(()=>{});
}
async function handleBattle(page,snapshot) {
  observed.sawBoss ||= snapshot.status==='boss';
  const legal=snapshot.scenario?.legalCommands || [];
  for (const p of snapshot.scenario?.pieces || []) if (p.side==='w') observed.battlePieceTypes.add(p.type);
  const order=snapshot.scenario?.orderPoints?.player;
  if (order) {
    observed.sawOrderPoints=true;
    const body=await page.locator('body').innerText();
    assert.ok(body.includes(String(order.current)) && body.includes(String(order.max)), 'battle UI must expose current/max order points');
  }
  const command=chooseObjectiveCommand(snapshot);
  if (!command) {
    if (await clickIf(page,'[data-end-turn]')) return;
    throw new Error(`No legal UI move in ${snapshot.scenario?.scenarioId || snapshot.status}`);
  }
  const target=snapshot.scenario?.pieces?.find((p)=>p.square===command.payload.to && p.side!=='w');
  if (target) observed.sawCapture=true;
  const beforeAction=Number(snapshot.scenario?.actionIndex ?? snapshot.scenario?.battle?.actionIndex ?? 0);
  await pointerMove(page,command,snapshot);
  const after=await runtimeSnapshot(page);
  if (after?.scenario) {
    const afterAction=Number(after.scenario.actionIndex ?? after.scenario.battle?.actionIndex ?? beforeAction);
    assert.ok(afterAction>=beforeAction, 'battle action index cannot go backwards');
    assert.ok(afterAction<=beforeAction+2, 'double input must not resolve more than one player/AI action pair');
    if (afterAction===beforeAction+2) observed.sawAiTurn=true;
  }
}
async function maybeTalent(page) {
  const modal=page.locator('[data-rpu-talent-modal]');
  if (await modal.count() && await modal.isVisible().catch(()=>false)) {
    observed.sawTalent=true;
    await modal.locator('[data-talent-id]').first().click();
    await delay(50);
    return true;
  }
  return false;
}
async function campaignAction(page,snapshot) {
  if (snapshot.campaign?.secret?.status==='pending') {
    observed.sawSecret=true;
    if (await clickIf(page,'[data-secret-decision="enter"]')) return;
    await clickIf(page,'[data-secret-decision="decline"]'); return;
  }
  if (snapshot.campaign?.secret?.status==='active') { observed.sawSecret=true; await clickIf(page,'[data-complete-secret]'); return; }
  if ((snapshot.campaign?.reopenableNodeIds || []).length && await clickIf(page,'[data-reopen-node]')) { observed.sawReopen=true; return; }
  const scout=page.locator('[data-rpu-scout]:not([disabled])');
  if (!observed.sawScouting && await scout.count()) { observed.sawScouting=true; await scout.first().click(); return; }
  const forced=page.locator('[data-rpu-forced-choice]');
  if (await forced.count()) { observed.sawForcedMarch=true; await page.locator('[data-rpu-travel]:not([disabled])').click(); return; }
  const routes=page.locator('.rpu-map-node.is-route [data-node-id]:not([disabled])');
  if (await routes.count()) await routes.first().click();
  const travel=page.locator('[data-rpu-travel]:not([disabled])');
  if (await travel.count()) { await travel.click(); return; }
  if (await clickIf(page,'[data-forced-travel]:not([disabled])')) { observed.sawForcedMarch=true; return; }
  throw new Error('campaign has no user-reachable action');
}
async function serviceAction(page,snapshot) {
  observed.serviceTypes.add(snapshot.stageB?.service?.type || 'service');
  const buy=page.locator('[data-service-offer]:not([disabled])');
  if (await buy.count()) { await buy.first().click(); await delay(50); }
  await clickIf(page,'[data-leave-service]');
}
async function driveFullRun(page,seed) {
  await explicitSetup(page,seed);
  let guard=0;
  while (guard++<220) {
    if (await maybeTalent(page)) continue;
    const snapshot=await runtimeSnapshot(page);
    assert.ok(snapshot,'runtime snapshot missing during production run');
    observed.statuses.add(snapshot.status);
    await bodyLeakCheck(page,`run:${snapshot.status}`);
    if (snapshot.event?.eventId) observed.eventIds.add(snapshot.event.eventId);
    if (snapshot.status==='complete') return snapshot;
    if (snapshot.status==='failed') throw new Error(`production run failed: ${JSON.stringify(snapshot.failure || snapshot.scenario?.result || {})}`);
    if (snapshot.status==='campaign') { await campaignAction(page,snapshot); }
    else if (snapshot.status==='briefing') { await page.locator('[data-confirm-briefing]').click(); }
    else if (snapshot.status==='deployment') {
      const confirm=page.locator('[data-confirm-deployment]');
      if (await confirm.isEnabled().catch(()=>false)) await confirm.click();
      else throw new Error('deployment requires placement but no browser placement was materialized');
    }
    else if (snapshot.status==='scenario' || snapshot.status==='boss') await handleBattle(page,snapshot);
    else if (snapshot.status==='boss_transition') { observed.sawBossTransition=true; if (!await clickIf(page,'[data-resume-boss],[data-boss-transition]')) throw new Error('boss transition lacks UI control'); }
    else if (snapshot.status==='event') { const choices=page.locator('[data-choice-id]:not([disabled])'); assert.ok(await choices.count(),'event has no visible choice'); await choices.first().click(); }
    else if (snapshot.status==='reward') await page.locator('[data-claim]').click();
    else if (snapshot.status==='reward_choice') { if(snapshot.politicalFinaleB14?.stage==='act_reward') observed.sawActReward=true; await page.locator('[data-reward-offer]:not([disabled])').first().click(); }
    else if (snapshot.status==='service') await serviceAction(page,snapshot);
    else if (snapshot.status==='act_outcome') { const choice=page.locator('[data-act-choice]:not([disabled])').first(); assert.ok(await choice.count(),'political stage has no available UI choice'); await choice.click(); }
    else if (snapshot.status==='reorganization') { observed.sawInterAct=true; assert.ok(await page.locator('[data-interact-conversion]').count(),'inter-act UI lacks real conversion binding'); await page.locator('[data-confirm-reorganization]').click(); }
    else throw new Error(`unhandled production UI status: ${snapshot.status}`);
    await delay(40);
  }
  throw new Error('full production UI run exceeded action guard');
}
async function responsiveAcceptance(browser) {
  for (const viewport of VIEWPORTS) {
    const page=await browser.newPage({ viewport:{width:viewport.width,height:viewport.height} });
    const errors=[]; await installFailureCapture(page,errors);
    await freshCommanderScreen(page,9042);
    observed.viewports.add(viewport.name);
    await bodyLeakCheck(page,`responsive:${viewport.name}:commander`);
    await page.locator('[data-launch-commander]').click();
    await page.locator('.rprs').waitFor({state:'visible'});
    await bodyLeakCheck(page,`responsive:${viewport.name}:king-doctrine`);
    await page.locator('[data-king-id]:not([disabled])').first().click();
    await page.locator('[data-doctrine-id]:not([disabled])').first().click();
    await page.locator('[data-lock-selection]').click();
    await page.locator('[data-draft-hero]').first().waitFor({state:'visible'});
    await bodyLeakCheck(page,`responsive:${viewport.name}:draft`);
    assert.deepStrictEqual(errors,[],`browser errors at ${viewport.name}: ${errors.join('\n')}`);
    await page.close();
  }
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    await responsiveAcceptance(browser);
    const page=await browser.newPage({viewport:{width:1366,height:768}});
    const errors=[]; await installFailureCapture(page,errors);
    const completed=await driveFullRun(page,9042);
    assert.strictEqual(completed.status,'complete');
    assert.ok(observed.statuses.has('campaign'));
    assert.ok(observed.statuses.has('briefing') || observed.statuses.has('scenario'),'run must reach combat flow');
    assert.ok(observed.sawScouting,'production run must exercise reconnaissance');
    assert.ok(observed.sawBoss,'production run must exercise boss UI');
    assert.ok(observed.sawActReward,'production run must exercise B14 Act Reward');
    assert.ok(observed.sawInterAct,'production run must exercise inter-act UI');
    assert.ok(observed.sawOrderPoints,'battle UI must bind order points');
    assert.ok(observed.sawCapture,'production battle must perform a capture by pointer');
    assert.deepStrictEqual(errors,[],`browser/page/network errors:\n${errors.join('\n')}`);
    await page.close();
    console.log('Iron Marches Chromium acceptance PASS');
    console.log(JSON.stringify({
      viewports:[...observed.viewports], statuses:[...observed.statuses], battlePieceTypes:[...observed.battlePieceTypes],
      eventIds:[...observed.eventIds], serviceTypes:[...observed.serviceTypes], scouting:observed.sawScouting,
      capture:observed.sawCapture, aiTurn:observed.sawAiTurn, orderPoints:observed.sawOrderPoints,
      boss:observed.sawBoss, bossTransition:observed.sawBossTransition, actReward:observed.sawActReward,
      interAct:observed.sawInterAct, secret:observed.sawSecret, forcedMarch:observed.sawForcedMarch, reopen:observed.sawReopen
    },null,2));
  } finally { await browser.close(); }
})().catch((error)=>{ console.error(error.stack || error); process.exitCode=1; });
