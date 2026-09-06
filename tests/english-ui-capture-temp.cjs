const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';
const OUT = path.resolve(process.env.RPCHESS_CAPTURE_DIR || 'english-ui-captures');
const VIEWPORTS = Object.freeze({ desktop:[1920,1080], tablet:[1024,768], mobile:[844,390] });
const REQUESTED = Object.freeze(['roster','battle','skirmish','travel','settlement','event']);

function route(type, stars, label) {
  return {
    id:`english.capture.${type}`, step:3, type, label, stars,
    threatLabel:'ОПАСНАЯ', flavor:'English localization screenshot.', mechanicalHint:'',
    seed:`english-${type}-seed`, difficultyModel:'power-v1', supplyCostAtSelection:1, supplyPaid:1
  };
}

async function fresh(page) {
  await page.goto(url, { waitUntil:'domcontentloaded' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil:'domcontentloaded' });
  await page.locator('[data-reboot-foundation]:not([hidden])').waitFor();
}

async function english(page) {
  await page.evaluate(() => globalThis.RPChessI18n?.setLanguage?.('en'));
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.waitForTimeout(120);
}

async function visualReady(page) {
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
  await page.waitForFunction(() => [...document.images].filter((image) => {
    const style=getComputedStyle(image),rect=image.getBoundingClientRect();
    return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;
  }).every((image) => image.complete), null, { timeout:5000 }).catch(() => {});
  await page.waitForTimeout(220);
}

async function newRun(page, label) {
  await startNewRun(page, { playerName:`English ${label}` });
  await english(page);
  await page.waitForTimeout(100);
}

async function setRoute(page, nextRoute) {
  await page.evaluate(([key,nextRoute]) => {
    const run=JSON.parse(localStorage.getItem(key));
    run.supplies=Math.max(6,Number(run.supplies||0));
    run.gold=Math.max(100,Number(run.gold||0));
    run.journeyStep=nextRoute.step;
    run.currentTravelChoices=null;
    run.activeTravelChoice=nextRoute;
    localStorage.setItem(key,JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, [RUN_KEY,nextRoute]);
}

async function openRequested(page, name) {
  await fresh(page);
  await newRun(page,name);
  if(name==='roster') {
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    return;
  }
  if(name==='travel') {
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    return;
  }
  if(name==='skirmish') {
    const next=route('skirmish',6,'СТЫЧКА');
    await setRoute(page,next);
    await page.evaluate(() => dispatchEvent(new CustomEvent('rpchess:skirmish-open')));
    await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
    await page.locator('[data-skirmish-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    await page.waitForFunction(() => document.body.classList.contains('run-combat-board-active'));
    return;
  }
  if(name==='battle') {
    const next=route('battle',8,'БИТВА');
    await setRoute(page,next);
    await page.evaluate(() => dispatchEvent(new CustomEvent('rpchess:battle-open')));
    await page.locator('[data-battle-screen]:not([hidden])').waitFor();
    await page.locator('[data-battle-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    await page.waitForFunction(() => document.body.classList.contains('run-combat-board-active'));
    return;
  }
  if(name==='settlement') {
    const next=route('settlement',4,'ПОСЕЛЕНИЕ');
    await setRoute(page,next);
    await page.evaluate((next) => dispatchEvent(new CustomEvent('rpchess:settlement-open',{detail:{choice:next}})),next);
    await page.locator('[data-settlement-screen]:not([hidden])').waitFor();
    return;
  }
  if(name==='event') {
    const next=route('event',6,'СОБЫТИЕ');
    await page.evaluate(([key,next]) => {
      const run=JSON.parse(localStorage.getItem(key));
      run.supplies=Math.max(6,Number(run.supplies||0));
      run.gold=Math.max(100,Number(run.gold||0));
      run.journeyStep=next.step;
      run.currentTravelChoices=null;
      run.activeTravelChoice=next;
      run.currentEvent={routeId:next.id,eventId:'E147',choiceId:null,roll:null,success:null,resolved:false,outcome:null,combat:null};
      localStorage.setItem(key,JSON.stringify(run));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
      dispatchEvent(new CustomEvent('rpchess:event-open',{detail:{choice:next}}));
    },[RUN_KEY,next]);
    await page.locator('[data-events-screen]:not([hidden])').waitFor();
    return;
  }
  throw new Error(`Unknown requested screen: ${name}`);
}

async function openResolvedTraining(page) {
  await fresh(page);
  await newRun(page,'training-resolved');
  const next=route('puzzle',7,'ТРЕНИРОВКА');
  await setRoute(page,next);
  await page.evaluate((next) => dispatchEvent(new CustomEvent('rpchess:puzzle-open',{detail:{choice:next}})),next);
  await page.locator('[data-puzzle-screen]:not([hidden])').waitFor();
  await page.evaluate((key) => {
    const run=JSON.parse(localStorage.getItem(key));
    run.currentPuzzle={...run.currentPuzzle,resolved:true,result:'solved',errors:0,goldReward:15,rewardSettled:true};
    localStorage.setItem(key,JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
    dispatchEvent(new CustomEvent('rpchess:puzzle-open',{detail:{choice:run.activeTravelChoice}}));
  },RUN_KEY);
  await page.locator('[data-puzzle-outcome]:not([hidden])').waitFor();
  await page.waitForTimeout(180);
}

async function assertEnglish(page,label) {
  const lang=await page.evaluate(() => document.documentElement.lang);
  assert.strictEqual(lang,'en',`${label}: html lang must be en`);
}

async function assertNoCombatResources(page,label) {
  const visible=await page.locator('[data-resource-hud]').evaluate((node) => {
    const style=getComputedStyle(node),rect=node.getBoundingClientRect();
    return style.display!=='none'&&!node.hidden&&rect.width>0&&rect.height>0;
  });
  assert.strictEqual(visible,false,`${label}: Gold/Supplies HUD must be absent on combat screen`);
}

async function assertResolvedTrainingGeometry(page,label) {
  const geometry=await page.evaluate(() => {
    const condition=document.querySelector('.puzzle-layout>.puzzle-panel:first-child')?.getBoundingClientRect();
    const outcome=document.querySelector('[data-puzzle-outcome]')?.getBoundingClientRect();
    const gold=document.querySelector('[data-puzzle-outcome-gold]')?.getBoundingClientRect();
    const button=document.querySelector('[data-puzzle-continue]')?.getBoundingClientRect();
    const board=document.querySelector('[data-puzzle-board]')?.getBoundingClientRect();
    return {
      condition:condition&&{left:condition.left,right:condition.right,width:condition.width},
      outcome:outcome&&{left:outcome.left,right:outcome.right,width:outcome.width},
      gold:gold&&{left:gold.left,right:gold.right,top:gold.top,bottom:gold.bottom},
      button:button&&{left:button.left,right:button.right,top:button.top,bottom:button.bottom},
      board:board&&{left:board.left}
    };
  });
  assert(geometry.condition&&geometry.outcome&&geometry.gold&&geometry.button&&geometry.board,`${label}: missing Training geometry`);
  assert(Math.abs(geometry.condition.left-geometry.outcome.left)<=2,`${label}: resolved and condition frames must share left edge`);
  assert(Math.abs(geometry.condition.width-geometry.outcome.width)<=2,`${label}: resolved and condition frames must have equal width`);
  assert(geometry.outcome.right<=geometry.board.left-4,`${label}: resolved frame must leave a gap before the board`);
  assert(geometry.button.left>=geometry.gold.right-2,`${label}: Continue button must sit to the right of victory Gold`);
  const verticalOverlap=Math.min(geometry.gold.bottom,geometry.button.bottom)-Math.max(geometry.gold.top,geometry.button.top);
  assert(verticalOverlap>0,`${label}: Continue button and victory Gold must share a row`);
}

(async()=>{
  fs.rmSync(OUT,{recursive:true,force:true});
  fs.mkdirSync(OUT,{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    for(const [adaptation,[width,height]] of Object.entries(VIEWPORTS)){
      const requestedDir=path.join(OUT,'requested',adaptation);
      const qaDir=path.join(OUT,'qa-training-resolved',adaptation);
      fs.mkdirSync(requestedDir,{recursive:true});
      fs.mkdirSync(qaDir,{recursive:true});
      for(let index=0;index<REQUESTED.length;index+=1){
        const name=REQUESTED[index];
        const page=await browser.newPage({viewport:{width,height}});
        const errors=[];page.on('pageerror',(error)=>errors.push(String(error.stack||error)));
        try{
          await openRequested(page,name);
          await visualReady(page);
          await assertEnglish(page,`${adaptation} ${name}`);
          if(name==='battle'||name==='skirmish')await assertNoCombatResources(page,`${adaptation} ${name}`);
          assert.deepStrictEqual(errors,[],`${adaptation} ${name} page errors:\n${errors.join('\n')}`);
          const file=`${String(index+1).padStart(2,'0')}-${name}-en.png`;
          await page.screenshot({path:path.join(requestedDir,file),fullPage:false});
          console.log(`[english-capture] ${adaptation} ${name}: ${file}`);
        }finally{await page.close();}
      }
      const qa=await browser.newPage({viewport:{width,height}});
      const qaErrors=[];qa.on('pageerror',(error)=>qaErrors.push(String(error.stack||error)));
      try{
        await openResolvedTraining(qa);
        await visualReady(qa);
        await assertEnglish(qa,`${adaptation} resolved Training`);
        await assertResolvedTrainingGeometry(qa,`${adaptation} resolved Training`);
        assert.deepStrictEqual(qaErrors,[],`${adaptation} resolved Training page errors:\n${qaErrors.join('\n')}`);
        await qa.screenshot({path:path.join(qaDir,'training-resolved-en.png'),fullPage:false});
      }finally{await qa.close();}
    }
  }finally{await browser.close();}
  console.log(`[english-capture] complete: ${OUT}`);
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1;});