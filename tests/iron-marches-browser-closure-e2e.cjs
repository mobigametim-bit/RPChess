'use strict';

const assert = require('assert');
const { chromium } = require('playwright');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');
const { chooseObjectiveBrowserCommand } = require('./helpers/objective-browser-guide.cjs');

const BASE_URL = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const SEED = 9042;
const VIEWPORTS = [[1600,1000],[1366,768],[760,900],[390,844]];
const FORBIDDEN = [/\[object Object\]/i,/\bundefined\b/i,/\bNaN\b/i,/fate\.iron_marches/i,/politics\.iron_marches/i,/obligation\.iron_marches/i];
const TEMPLATES = buildBrowserProductionBundle().scenarioTemplates;
const purchasedServices = new Set();
const seen = {
  viewports:new Set(), statuses:new Set(), movers:new Set(), services:new Set(), events:new Set(),
  scout:false, rare:false, secret:false, forced:false, capture:false, ai:false, order:false,
  talent:false, boss:false, bossTransition:false, actReward:false, interact:false, animationBlock:false
};

function log(label,value='') { console.log(`[closure-e2e] ${label}${value===''?'':` ${typeof value==='string'?value:JSON.stringify(value)}`}`); }
function delay(ms) { return new Promise((resolve)=>setTimeout(resolve,ms)); }
async function snapshot(page) { return page.evaluate(() => globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.() || null); }
async function waitIdle(page) { await page.waitForFunction(() => !globalThis.RPChessVerticalSlice?.runtimeClient?.pending, null, {timeout:7000}); }
async function click(page,target) {
  const locator=typeof target==='string'?page.locator(target).first():(target.first?target.first():target);
  await locator.waitFor({state:'visible',timeout:7000});
  await locator.scrollIntoViewIfNeeded();
  await locator.click({timeout:7000});
}
async function clickIf(page,selector) {
  const locator=page.locator(selector).first();
  if (await locator.count() && await locator.isVisible().catch(()=>false) && await locator.isEnabled().catch(()=>true)) { await click(page,locator); return true; }
  return false;
}
function captureErrors(page,errors) {
  page.on('pageerror',(error)=>errors.push(`pageerror: ${error.message}`));
  page.on('console',(message)=>{ if(message.type()==='error') errors.push(`console: ${message.text()}`); });
  page.on('requestfailed',(request)=>{ const failure=request.failure()?.errorText||''; if(!request.url().startsWith('data:') && failure!=='net::ERR_ABORTED') errors.push(`requestfailed: ${failure} ${request.url()}`); });
}
async function qa(page,label) {
  const text=await page.locator('body').innerText().catch(()=> '');
  for(const pattern of FORBIDDEN) assert.strictEqual(pattern.test(text),false,`${label}: leaked ${pattern}`);
  const layout=await page.evaluate(()=>({
    width:innerWidth,
    scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),
    dialogs:[...document.querySelectorAll('[role="dialog"],.rpu-modal__window')].filter((node)=>node.getClientRects().length).map((node)=>{const r=node.getBoundingClientRect();return [r.left,r.right];})
  }));
  assert.ok(layout.scrollWidth<=layout.width+3,`${label}: horizontal overflow ${layout.scrollWidth}>${layout.width}`);
  for(const [left,right] of layout.dialogs) assert.ok(left>=-3&&right<=layout.width+3,`${label}: modal overflow`);
}

async function openFresh(page,seed=SEED) {
  await page.goto(`${BASE_URL}/index.html?new=1&seed=${seed}&autosave=1`,{waitUntil:'domcontentloaded',timeout:15000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.locator('[data-shell-action="profiles"]').waitFor({state:'visible',timeout:10000});
  await click(page,'[data-shell-action="profiles"]');
  await click(page,page.locator('[data-profile-action="start"]').first());
  await page.locator('[data-launch-commander]').waitFor({state:'visible',timeout:10000});
}
async function finishSetup(page) {
  await click(page,'[data-launch-commander]');
  await page.locator('.rprs').waitFor({state:'visible',timeout:10000});
  assert.strictEqual(await page.locator('[data-lock-selection]').isEnabled(),false);
  await click(page,'[data-king-id]:not([disabled])'); await waitIdle(page);
  await click(page,'[data-doctrine-id]:not([disabled])'); await waitIdle(page);
  assert.strictEqual(await page.locator('[data-lock-selection]').isEnabled(),true);
  await click(page,'[data-lock-selection]');
  await page.locator('[data-draft-hero]').first().waitFor({state:'visible',timeout:10000});
  assert.strictEqual(await page.locator('[data-draft-hero]').count(),3);
  await click(page,'[data-draft-hero]'); await waitIdle(page);
  await click(page,'[data-draft-regular]'); await waitIdle(page);
  await click(page,'[data-confirm-draft]');
  await page.waitForFunction(()=>globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()?.status==='campaign',null,{timeout:10000});
  await waitIdle(page);
}

async function responsive(browser) {
  for(const [width,height] of VIEWPORTS) {
    const page=await browser.newPage({viewport:{width,height}}); const errors=[]; captureErrors(page,errors);
    await openFresh(page); await qa(page,`${width}x${height}:commander`);
    await click(page,'[data-launch-commander]'); await page.locator('.rprs').waitFor({state:'visible'}); await qa(page,`${width}x${height}:setup`);
    await click(page,'[data-king-id]:not([disabled])'); await waitIdle(page); await click(page,'[data-doctrine-id]:not([disabled])'); await waitIdle(page); await click(page,'[data-lock-selection]');
    await page.locator('[data-draft-hero]').first().waitFor({state:'visible'}); await qa(page,`${width}x${height}:draft`);
    assert.deepStrictEqual(errors,[],errors.join('\n')); seen.viewports.add(`${width}x${height}`); await page.close();
  }
}

async function squarePoint(page,square) {
  const canvas=page.locator('[data-board]').first(); const box=await canvas.boundingBox(); assert.ok(box,'battle canvas missing');
  const p=await page.evaluate((wanted)=>{
    const presenter=globalThis.RPChessVerticalSlice?.presenter; const viewport=presenter?.boardReport?.viewport; const cell=presenter?.boardPlan?.activeCells?.find((entry)=>entry.square===wanted); const element=document.querySelector('[data-board]');
    if(!viewport||!cell||!element) return null; const rect=element.getBoundingClientRect(); const sx=rect.width/(element.width||rect.width); const sy=rect.height/(element.height||rect.height);
    return {x:(viewport.x+(cell.displayX+.5)*viewport.cellSize)*sx,y:(viewport.y+(cell.displayY+.5)*viewport.cellSize)*sy};
  },square);
  assert.ok(p,`missing board geometry ${square}`); return {x:box.x+p.x,y:box.y+p.y};
}
function actionIndex(state) { return Number(state?.scenario?.actionIndex ?? state?.scenario?.battle?.actionIndex ?? 0); }
async function waitAnimation(page) { await page.waitForFunction(()=>!globalThis.RPChessVerticalSlice?.presenter?.animationRunning && !document.getElementById('app')?.classList.contains('rpvs__animating'),null,{timeout:7000}); }
async function verifyDoubleInput(page) {
  if(seen.animationBlock) return;
  if(!await page.evaluate(()=>Boolean(globalThis.RPChessVerticalSlice?.presenter?.animationRunning))) return;
  const state=await snapshot(page); const command=chooseObjectiveBrowserCommand(state,TEMPLATES); if(!command) return;
  const before=actionIndex(state); const from=await squarePoint(page,command.payload.from); const to=await squarePoint(page,command.payload.to);
  await page.mouse.click(from.x,from.y); await page.mouse.click(to.x,to.y); await delay(100);
  assert.strictEqual(actionIndex(await snapshot(page)),before,'second input accepted during animation'); seen.animationBlock=true;
}
async function battle(page,state) {
  seen.boss ||= state.status==='boss';
  if(state.scenario?.orderPoints?.player) seen.order=true;
  const command=chooseObjectiveBrowserCommand(state,TEMPLATES);
  if(!command) { if(await clickIf(page,'[data-finalize-scenario],[data-finalize]')) { await waitIdle(page); return; } throw new Error(`no objective-aware move in ${state.scenario?.scenarioId}`); }
  const mover=(state.scenario.pieces||[]).find((piece)=>piece.square===command.payload.from); assert.ok(mover,`missing mover ${command.payload.from}`); seen.movers.add(mover.type);
  if((state.scenario.pieces||[]).some((piece)=>piece.square===command.payload.to&&piece.side!==state.scenario.playerSide)) seen.capture=true;
  const before=actionIndex(state); const from=await squarePoint(page,command.payload.from); const to=await squarePoint(page,command.payload.to); log('move',`${mover.type}:${command.payload.from}->${command.payload.to}`);
  await page.mouse.click(from.x,from.y); await page.mouse.click(to.x,to.y);
  await page.waitForFunction(({status,before})=>{const s=globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.(); if(!s)return false; if(s.status!==status)return true; const i=Number(s.scenario?.actionIndex??s.scenario?.battle?.actionIndex??0); return i>before&&Boolean(s.scenario?.playerTurn);},{status:state.status,before},{timeout:8000});
  const resolved=await snapshot(page); if(resolved?.scenario&&actionIndex(resolved)>=before+2) seen.ai=true;
  await page.waitForFunction(()=>Boolean(globalThis.RPChessVerticalSlice?.presenter?.animationRunning)||!['scenario','boss'].includes(globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()?.status),null,{timeout:1200}).catch(()=>{});
  await verifyDoubleInput(page); await waitAnimation(page);
}
async function maybeTalent(page) {
  const modal=page.locator('[data-rpu-talent-modal]'); if(await modal.count()&&await modal.isVisible().catch(()=>false)) { seen.talent=true; await click(page,modal.locator('[data-talent-id]').first()); await waitIdle(page); return true; } return false;
}
async function campaign(page,state) {
  if(state.campaign?.secret?.status==='pending') { seen.secret=true; if(await clickIf(page,'[data-secret-decision="enter"]')) {await waitIdle(page);return;} await clickIf(page,'[data-secret-decision="decline"]');await waitIdle(page);return; }
  if(state.campaign?.secret?.status==='active') { seen.secret=true; await click(page,'[data-complete-secret]'); await waitIdle(page); return; }
  if(!seen.rare&&(state.campaign?.reopenableNodeIds||[]).length&&await clickIf(page,'[data-reopen-node]')) { seen.rare=true; await waitIdle(page); return; }
  if(!seen.scout&&await clickIf(page,'[data-rpu-scout]:not([disabled])')) { seen.scout=true; await waitIdle(page); return; }
  if(await page.locator('[data-rpu-forced-choice]').count()) { seen.forced=true; await click(page,'[data-rpu-travel]:not([disabled])'); await waitIdle(page); return; }
  const routes=page.locator('.rpu-map-node.is-route [data-node-id]:not([disabled])'); if(await routes.count()) await click(page,routes.first());
  if(await clickIf(page,'[data-rpu-travel]:not([disabled])')) { await waitIdle(page); return; }
  if(await clickIf(page,'[data-forced-travel]:not([disabled])')) { seen.forced=true; await waitIdle(page); return; }
  throw new Error('campaign has no reachable UI action');
}
async function service(page,state) {
  const type=state.stageB?.service?.type||'service'; seen.services.add(type); const key=`${state.currentNode?.nodeId||state.campaign?.currentNodeId}:${type}`;
  if(!purchasedServices.has(key)&&await page.locator('[data-service-offer]:not([disabled])').count()) { await click(page,'[data-service-offer]:not([disabled])'); purchasedServices.add(key); await waitIdle(page); }
  await click(page,'[data-leave-service]'); await page.waitForFunction(()=>globalThis.RPChessVerticalSlice?.runtimeHost?.getSnapshot?.()?.status!=='service',null,{timeout:7000}); await waitIdle(page);
}
async function drive(page) {
  await openFresh(page); await finishSetup(page); let last='';
  for(let guard=0;guard<240;guard+=1) {
    if(await maybeTalent(page)) continue;
    const state=await snapshot(page); assert.ok(state,'missing runtime snapshot'); seen.statuses.add(state.status); if(state.status!==last){log('status',state.status);last=state.status;} await qa(page,`run:${state.status}`); if(state.event?.eventId)seen.events.add(state.event.eventId);
    if(state.status==='complete') return state;
    if(state.status==='failed') throw new Error(`run failed ${JSON.stringify(state.failure||state.scenario?.result||{})}`);
    if(state.status==='campaign') await campaign(page,state);
    else if(state.status==='briefing'){await click(page,'[data-confirm-briefing]');await waitIdle(page);}
    else if(state.status==='deployment'){const c=page.locator('[data-confirm-deployment]');assert.strictEqual(await c.isEnabled(),true,'default deployment not confirmable');await click(page,c);await waitIdle(page);}
    else if(['scenario','boss'].includes(state.status)) await battle(page,state);
    else if(state.status==='boss_transition'){seen.bossTransition=true;assert.ok(await clickIf(page,'[data-begin-phase],[data-begin-boss-phase],[data-resume-boss],[data-boss-transition]'));await waitIdle(page);}
    else if(state.status==='event'){const choices=page.locator('[data-event-choice]:not([disabled]),[data-choice-id]:not([disabled])');assert.ok(await choices.count(),'event has no choice');await click(page,choices.first());await waitIdle(page);}
    else if(state.status==='reward'){await click(page,'[data-claim]');await waitIdle(page);}
    else if(state.status==='reward_choice'){if(state.politicalFinaleB14?.stage==='act_reward')seen.actReward=true;await click(page,'[data-reward-offer]:not([disabled])');await waitIdle(page);}
    else if(state.status==='service') await service(page,state);
    else if(state.status==='act_outcome'){const c=page.locator('[data-act-choice]:not([disabled])').first();assert.ok(await c.count(),'act outcome has no choice');await click(page,c);await waitIdle(page);}
    else if(state.status==='reorganization'){seen.interact=true;assert.ok(await page.locator('[data-interact-conversion]').count(),'inter-act conversion missing');await click(page,'[data-confirm-reorganization]');await waitIdle(page);}
    else throw new Error(`unhandled status ${state.status}`);
    await delay(40);
  }
  throw new Error('closure e2e action guard exceeded');
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    await responsive(browser);
    const page=await browser.newPage({viewport:{width:1366,height:768}}); page.setDefaultTimeout(7000); const errors=[]; captureErrors(page,errors);
    const final=await drive(page); assert.strictEqual(final.status,'complete');
    for(const [key,value] of Object.entries({scout:seen.scout,boss:seen.boss,bossTransition:seen.bossTransition,actReward:seen.actReward,interact:seen.interact,order:seen.order,capture:seen.capture,animationBlock:seen.animationBlock})) assert.ok(value,`${key} not exercised`);
    assert.deepStrictEqual(errors,[],errors.join('\n'));
    console.log('Iron Marches objective-aware Chromium closure: PASS');
    console.log(JSON.stringify({viewports:[...seen.viewports],statuses:[...seen.statuses],movers:[...seen.movers],services:[...seen.services],events:[...seen.events],scout:seen.scout,rare:seen.rare,secret:seen.secret,forced:seen.forced,capture:seen.capture,ai:seen.ai,order:seen.order,talent:seen.talent,boss:seen.boss,bossTransition:seen.bossTransition,actReward:seen.actReward,interact:seen.interact,animationBlock:seen.animationBlock},null,2));
    await page.close();
  } finally { await browser.close(); }
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1;});
