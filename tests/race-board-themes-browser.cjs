const assert=require('assert');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');

const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const RUN_KEY='rpchess.reboot.v1.run';

async function fresh(page){
  await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate((key)=>localStorage.removeItem(key),RUN_KEY);
  await page.reload({waitUntil:'networkidle'});
  await startNewRun(page);
  await page.waitForFunction(()=>Boolean(globalThis.RPChessClassicChess&&globalThis.RPChessBattle&&globalThis.RPChessSkirmish));
}

async function assertThemedBoard(page,kind){
  const api=kind==='battle'?'RPChessBattle':'RPChessSkirmish';
  await page.evaluate((kind)=>dispatchEvent(new CustomEvent(kind==='battle'?'rpchess:battle-open':'rpchess:skirmish-open')),kind);
  await page.locator(kind==='battle'?'[data-battle-screen]:not([hidden])':'[data-skirmish-screen]:not([hidden])').waitFor();
  await page.locator(kind==='battle'?'[data-battle-start]':'[data-skirmish-start]').click();
  await page.locator('[data-classic-screen]:not([hidden])').waitFor();
  const state=await page.evaluate((api)=>{
    const plan=globalThis[api].battlePlan;
    const board=document.querySelector('[data-chess-board]');
    const light=board?.querySelector('.classic-square--light');
    const dark=board?.querySelector('.classic-square--dark');
    return {
      race:plan?.encounter?.enemyRaceTag||'',
      boardRace:board?.dataset.boardRace||'',
      lightVar:board?.style.getPropertyValue('--board-light-tile')||'',
      darkVar:board?.style.getPropertyValue('--board-dark-tile')||'',
      lightBg:light?getComputedStyle(light).backgroundImage:'',
      darkBg:dark?getComputedStyle(dark).backgroundImage:''
    };
  },api);
  assert(state.race,`${kind} must expose an enemy race`);
  assert.strictEqual(state.boardRace,state.race,`${kind} board theme must match encounter enemyRaceTag`);
  assert(state.lightVar.includes(`assets/races/${state.race}/board/white.png`),`${kind} light tile path mismatch: ${state.lightVar}`);
  assert(state.darkVar.includes(`assets/races/${state.race}/board/black.png`),`${kind} dark tile path mismatch: ${state.darkVar}`);
  assert(state.lightBg.includes(`/assets/races/${state.race}/board/white.png`),`${kind} light cell must render race image`);
  assert(state.darkBg.includes(`/assets/races/${state.race}/board/black.png`),`${kind} dark cell must render race image`);
  const dimensions=await page.evaluate(async(race)=>{
    const load=(file)=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({w:image.naturalWidth,h:image.naturalHeight});image.onerror=()=>reject(new Error(`failed to load ${image.src}`));image.src=`assets/races/${race}/board/${file}`;});
    return {white:await load('white.png'),black:await load('black.png')};
  },state.race);
  assert.deepStrictEqual(dimensions.white,{w:384,h:384},`${kind} white runtime tile must be 384x384`);
  assert.deepStrictEqual(dimensions.black,{w:384,h:384},`${kind} black runtime tile must be 384x384`);
  return state.race;
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const battle=await browser.newPage({viewport:{width:1440,height:900}});
    const battleErrors=[];battle.on('pageerror',(error)=>battleErrors.push(String(error.stack||error)));
    await fresh(battle);
    const battleRace=await assertThemedBoard(battle,'battle');

    const skirmish=await browser.newPage({viewport:{width:1440,height:900}});
    const skirmishErrors=[];skirmish.on('pageerror',(error)=>skirmishErrors.push(String(error.stack||error)));
    await fresh(skirmish);
    const skirmishRace=await assertThemedBoard(skirmish,'skirmish');

    assert.deepStrictEqual(battleErrors,[]);
    assert.deepStrictEqual(skirmishErrors,[]);
    console.log(`Race board themes browser: PASS — Battle=${battleRace}, Skirmish=${skirmishRace}, themed white/black cells and 384px runtime assets`);
  }finally{await browser.close();}
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1;});
