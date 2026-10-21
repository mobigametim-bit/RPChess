/* Real Chromium portrait capture of actual RPChess scenes, not generated images.
   Input and navigation use the same runtime and saved-run fixtures as existing QA. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const dir=process.env.RPCHESS_PORTRAIT_SCREENSHOT_DIR||'test-results/portrait-ui';
const key='rpchess.reboot.v1.run';
const sizes=[[390,844],[768,1024]];
const eventRoute={id:'manual.portrait.event',step:1,type:'event',label:'СОБЫТИЕ',stars:12,threatLabel:'ЛЕГЕНДАРНАЯ',flavor:'Необычная встреча на дороге.',mechanicalHint:'',seed:'manual-event-seed',supplyCostAtSelection:1,supplyPaid:1};
const puzzleRoute={id:'manual.portrait.puzzle',step:1,type:'puzzle',label:'ЗАДАЧА',stars:1,threatLabel:'СЛОЖНОСТЬ ★1',flavor:'На дороге обнаружена позиция, требующая точного решения.',mechanicalHint:'Шахматная задача с конкретной целью.',seed:'manual-puzzle-mate1',supplyCostAtSelection:1,supplyPaid:1};
function battleRoute(i){return {id:'manual.portrait.battle.'+i,step:1,type:'battle',label:'БИТВА',stars:6,threatLabel:'ОПАСНАЯ',flavor:'Вражеская армия закрыла дорогу.',mechanicalHint:'Полная армия',seed:'portrait-battle-'+i,difficultyModel:'power-v1',playerColor:'w',enemyColor:'b',enemyRaceTag:'orcs',enemyRoleRaces:Object.fromEntries(['pawn','knight','bishop','rook','queen','king'].map(role=>[role,'orcs']))};}
async function ready(page){
  await page.locator('[data-game-loading]').waitFor({state:'hidden',timeout:28000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(180);
}
async function capture(page,name){
  await ready(page);
  const geometry=await page.evaluate(()=>{
    const width=document.documentElement.scrollWidth;
    const active=[...document.querySelectorAll('#app>main')].find(n=>!n.hidden);
    return {width,viewport:innerWidth,active:active?.className,orientationLock:!!document.querySelector('[data-orientation-lock]')&&getComputedStyle(document.querySelector('[data-orientation-lock]')).display!=='none'};
  });
  assert(!geometry.orientationLock,'Portrait must not show rotate-device overlay');
  assert(geometry.width<=geometry.viewport+3,`${name}: horizontal overflow ${JSON.stringify(geometry)}`);
  const size=page.viewportSize(),suffix=`${size.width}x${size.height}`;
  fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,`${suffix}-${name}.png`),fullPage:true,animations:'disabled',timeout:30000});
  console.log(`PORTRAIT SCREENSHOT ${suffix}-${name}: ${geometry.active}`);
}
async function menu(page){
  await page.goto(url,{waitUntil:'networkidle'});
  await ready(page);
  await page.evaluate(k=>localStorage.removeItem(k),key);
  await page.reload({waitUntil:'networkidle'});
  await ready(page);
}
async function run(page){
  await menu(page);
  await startNewRun(page,{playerName:'Portrait Tester'});
  await page.locator('[data-roster-screen]:not([hidden])').waitFor();
}
async function seeded(page,route,eventId=null){
  await run(page);
  await page.evaluate(({k,route,eventId})=>{
    const r=JSON.parse(localStorage.getItem(k));
    r.supplies=10;r.currentTravelChoices=null;r.activeTravelChoice=route;
    r.currentSettlement=null;r.currentPuzzle=null;
    r.currentEvent=eventId?{routeId:route.id,eventId,choiceId:null,roll:null,success:null,resolved:false,outcome:null,combat:null}:null;
    localStorage.setItem(k,JSON.stringify(r));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  },{k:key,route,eventId});
  await page.locator('[data-roster-travel]').click();
}
async function capturePhoneOrTablet(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:width<600});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try {
    await menu(page);
    await capture(page,'01-main-menu');
    await page.locator('[data-arena-open]').click();
    await page.locator('[data-arena-screen]:not([hidden])').waitFor();
    await capture(page,'02-arena-rivals');
    await page.locator('[data-arena-foes] button:not([disabled])').first().click();
    await page.locator('[data-arena-dialog]:not([hidden])').waitFor();
    await capture(page,'03-arena-opponent');
    await run(page);
    await capture(page,'04-roster-formation');
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    await capture(page,'05-journey-routes');

    await seeded(page,eventRoute,'E001');
    await page.locator('[data-events-screen]:not([hidden])').waitFor();
    await capture(page,'06-event-choice');
    await page.locator('[data-event-choice]:not([disabled])').first().click();
    await page.locator('[data-events-outcome]:not([hidden])').waitFor();
    await capture(page,'07-event-outcome');

    await seeded(page,puzzleRoute);
    await page.locator('[data-puzzle-screen]:not([hidden])').waitFor();
    const puzzle=page.locator('[data-puzzle-board]');
    await puzzle.waitFor();
    const board=await puzzle.boundingBox();
    assert(board&&Math.abs(board.width-board.height)<=3,`Training chess board square: ${JSON.stringify(board)}`);
    await capture(page,'08-training-board');

    await run(page);
    await page.evaluate(k=>{
      const r=JSON.parse(localStorage.getItem(k));
      r.currentTravelChoices=null;r.activeTravelChoice=null;r.currentSettlement=null;
      localStorage.setItem(k,JSON.stringify(r));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
    },key);
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    const settlement=page.locator('[data-travel-type="settlement"]').first();
    if(await settlement.count()){
      await settlement.click();
      await page.locator('[data-settlement-screen]:not([hidden])').waitFor();
      await capture(page,'09-settlement');
    }

    await run(page);
    await page.evaluate(({k,routes})=>{
      const r=JSON.parse(localStorage.getItem(k));
      r.currentTravelChoices=routes;r.activeTravelChoice=null;
      localStorage.setItem(k,JSON.stringify(r));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
    },{k:key,routes:[battleRoute(1),battleRoute(2),battleRoute(3)]});
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    await page.locator('[data-travel-type="battle"]').first().click();
    await page.locator('[data-artifact-choice-modal]:not([hidden])').waitFor();
    await page.locator('[data-artifact-choice="none"]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    await capture(page,'10-battle-chess');
    const combatBoard=await page.locator('[data-chess-board]').boundingBox();
    assert(combatBoard&&Math.abs(combatBoard.width-combatBoard.height)<=3,`Chess board must be square: ${JSON.stringify(combatBoard)}`);
    await page.evaluate(()=>globalThis.RPChessBattle.finishBattle({over:true,type:'stalemate',winner:null}));
    await page.locator('[data-battle-aftermath]:not([hidden])').waitFor();
    await capture(page,'11-battle-result');
    await page.evaluate(k=>{
      const r=JSON.parse(localStorage.getItem(k));
      r.ended=true;r.endReason='starvation_king';r.journeyStep=18;
      r.runStats={goldEarned:188,skirmishWins:2,battleWins:1,caravansDefended:1,puzzlesSolved:4,eventsResolved:5};
      globalThis.RPChessEndlessRun.open(r);
    },key);
    await page.locator('[data-endless-run-screen]:not([hidden])').waitFor();
    await capture(page,'12-journey-summary');
    assert.deepEqual(errors,[],`Portrait browser JS errors at ${width}x${height}: ${errors.join('; ')}`);
  }finally{await page.close();}
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    for(const [width,height] of sizes)await capturePhoneOrTablet(browser,width,height);
    console.log('Portrait mobile/tablet: key scenes and square boards PASS');
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
