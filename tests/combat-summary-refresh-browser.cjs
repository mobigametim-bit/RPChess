const assert=require('assert');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const RUN_KEY='rpchess.reboot.v1.run';

function route(type,id){return{id,step:1,type,label:type==='battle'?'БИТВА':'СТЫЧКА',stars:6,threatLabel:'ОПАСНАЯ',flavor:'Проверка краткой боевой сводки.',mechanicalHint:'',seed:`${id}-seed`,difficultyModel:'power-v1',playerColor:'w',enemyColor:'b',enemyRaceTag:'orcs',enemyRoleRaces:{pawn:'orcs',knight:'orcs',bishop:'orcs',rook:'orcs',queen:'orcs',king:'orcs'},sideNarrative:'Ваш отряд первым выходит на поле.'};}

async function openCombat(page,type){
  await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate(k=>localStorage.removeItem(k),RUN_KEY);
  await page.reload({waitUntil:'networkidle'});
  await startNewRun(page);
  const routes=[route(type,`summary.${type}.1`),route(type,`summary.${type}.2`),route(type,`summary.${type}.3`)];
  await page.evaluate(({k,routes,type})=>{const run=JSON.parse(localStorage.getItem(k));run.id=`combat-summary-${type}`;run.currentTravelChoices=routes;run.activeTravelChoice=null;localStorage.setItem(k,JSON.stringify(run));dispatchEvent(new CustomEvent('rpchess:run-updated'));},{k:RUN_KEY,routes,type});
  await page.locator('[data-roster-travel]').click();
  await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
  await page.locator(`[data-travel-type="${type}"]`).first().click();
  await page.locator(type==='battle'?'[data-battle-screen]:not([hidden])':'[data-skirmish-screen]:not([hidden])').waitFor();
  await page.locator(type==='battle'?'[data-battle-start]':'[data-skirmish-start]').click();
  await page.locator('[data-classic-screen]:not([hidden])').waitFor();
  await page.waitForTimeout(50);
}

async function assertSummarySurvivesMove(page,type){
  const api=type==='battle'?'RPChessBattle':'RPChessSkirmish';
  const before=await page.evaluate(api=>{const combat=globalThis[api];return{expected:combat.encounter.label,heading:document.querySelector('.classic-party-panel h2')?.textContent||'',mode:document.querySelector('[data-game-mode]')?.textContent||''};},api);
  assert.strictEqual(before.heading,type==='battle'?'Битва':'Стычка');
  assert.strictEqual(before.mode,before.expected);
  assert(!before.mode.includes('·'));
  const moved=await page.evaluate(()=>{const engine=globalThis.RPChessClassicChess.engine;const move=engine.legalMoves()[0];if(!move)return false;return globalThis.RPChessClassicChess.move(move.from,move.to,move.promotion||null).ok;});
  assert.strictEqual(moved,true,'fixture must execute a legal first move');
  await page.waitForTimeout(650);
  const after=await page.evaluate(api=>{globalThis[api].syncBattleFromChess();return{expected:globalThis[api].encounter.label,mode:document.querySelector('[data-game-mode]')?.textContent||''};},api);
  assert.strictEqual(after.mode,after.expected,`${type} summary must remain the canonical difficulty label after combat refresh`);
  assert(!after.mode.includes('·'),`${type} summary must not restore the old technical sentence`);
}

(async()=>{const browser=await chromium.launch({headless:true});try{
  const skirmish=await browser.newPage({viewport:{width:1440,height:900}}),skirmishErrors=[];skirmish.on('pageerror',e=>skirmishErrors.push(String(e.stack||e)));await openCombat(skirmish,'skirmish');await assertSummarySurvivesMove(skirmish,'skirmish');assert.deepStrictEqual(skirmishErrors,[]);
  const battle=await browser.newPage({viewport:{width:1440,height:900}}),battleErrors=[];battle.on('pageerror',e=>battleErrors.push(String(e.stack||e)));await openCombat(battle,'battle');await assertSummarySurvivesMove(battle,'battle');assert.deepStrictEqual(battleErrors,[]);
  console.log('Skirmish/Battle canonical difficulty summary survives first move and combat refresh: PASS');
}finally{await browser.close();}})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
