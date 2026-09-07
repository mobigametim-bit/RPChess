const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');

const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const RUN_KEY='rpchess.reboot.v1.run';
const OUT=path.resolve(process.env.RPCHESS_CAPTURE_DIR||'glyph-polish-captures');
const VIEWPORTS=Object.freeze({desktop:[1920,1080],tablet:[1024,768],mobile:[844,390]});
const FILLED=new Set(['♟','♞','♝','♜','♛','♚']);

function route(type,stars,label){return{id:`glyph.capture.${type}`,step:3,type,label,stars,threatLabel:'ОПАСНАЯ',flavor:'Glyph visual QA',mechanicalHint:'',seed:`glyph-${type}-seed`,difficultyModel:'power-v1',supplyCostAtSelection:1,supplyPaid:1};}

async function fresh(page){
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.evaluate(key=>localStorage.removeItem(key),RUN_KEY);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-reboot-foundation]:not([hidden])').waitFor();
}
async function newRun(page,label){await startNewRun(page,{playerName:`Glyph ${label}`});}
async function setRoute(page,next){
  await page.evaluate(([key,next])=>{
    const run=JSON.parse(localStorage.getItem(key));
    run.supplies=Math.max(6,Number(run.supplies||0));run.gold=Math.max(100,Number(run.gold||0));run.journeyStep=next.step;run.currentTravelChoices=null;run.activeTravelChoice=next;
    localStorage.setItem(key,JSON.stringify(run));dispatchEvent(new CustomEvent('rpchess:run-updated'));
  },[RUN_KEY,next]);
}
async function ready(page){
  await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready;});
  await page.waitForFunction(()=>[...document.images].filter(img=>{const s=getComputedStyle(img),r=img.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;}).every(img=>img.complete),null,{timeout:5000}).catch(()=>{});
  await page.waitForTimeout(220);
}

async function openCombat(page,kind){
  await fresh(page);await newRun(page,kind);
  const next=route(kind,kind==='battle'?8:6,kind==='battle'?'БИТВА':'СТЫЧКА');await setRoute(page,next);
  if(kind==='battle'){
    await page.evaluate(()=>dispatchEvent(new CustomEvent('rpchess:battle-open')));
    await page.locator('[data-battle-screen]:not([hidden])').waitFor();
    await page.locator('[data-battle-start]').click();
  }else{
    await page.evaluate(()=>dispatchEvent(new CustomEvent('rpchess:skirmish-open')));
    await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
    await page.locator('[data-skirmish-start]').click();
  }
  await page.locator('[data-classic-screen]:not([hidden])').waitFor();
  await page.waitForFunction(()=>document.body.classList.contains('run-combat-board-active'));
}

async function openTraining(page){
  await fresh(page);await newRun(page,'training');
  const next=route('puzzle',7,'ТРЕНИРОВКА');await setRoute(page,next);
  await page.evaluate(next=>dispatchEvent(new CustomEvent('rpchess:puzzle-open',{detail:{choice:next}})),next);
  await page.locator('[data-puzzle-screen]:not([hidden])').waitFor();
}

async function openSettlement(page){
  await fresh(page);await newRun(page,'settlement');
  const next=route('settlement',4,'ПОСЕЛЕНИЕ');await setRoute(page,next);
  await page.evaluate(next=>dispatchEvent(new CustomEvent('rpchess:settlement-open',{detail:{choice:next}})),next);
  await page.locator('[data-settlement-screen]:not([hidden])').waitFor();
}

async function assertGlyphContract(page,markerSelector,squareSelector,label){
  const state=await page.evaluate(({markerSelector,squareSelector})=>{
    function inspect(side){
      const marker=document.querySelector(`${markerSelector}.${markerSelector.slice(1)}--${side}`);
      const square=marker?.closest(squareSelector);if(!marker||!square)return null;
      const mr=marker.getBoundingClientRect(),sr=square.getBoundingClientRect(),pseudo=getComputedStyle(marker,'::before');
      return {content:pseudo.content.replace(/^['\"]|['\"]$/g,''),fontSize:parseFloat(pseudo.fontSize),color:pseudo.color,strokeColor:pseudo.webkitTextStrokeColor,strokeWidth:parseFloat(pseudo.webkitTextStrokeWidth||'0'),centerDelta:Math.abs((mr.left+mr.right)/2-(sr.left+sr.right)/2),bottomGap:sr.bottom-mr.bottom,marker:{w:mr.width,h:mr.height},square:{w:sr.width,h:sr.height}};
    }
    return {w:inspect('w'),b:inspect('b')};
  },{markerSelector,squareSelector});
  for(const side of ['w','b']){
    const s=state[side];assert(s,`${label}: missing ${side} glyph`);assert(FILLED.has(s.content),`${label}: ${side} glyph must use filled chess symbol, got ${s.content}`);assert(s.fontSize>=38.5,`${label}: ${side} glyph too small ${s.fontSize}px`);assert(s.centerDelta<=3,`${label}: ${side} glyph not horizontally centred (${s.centerDelta}px)`);assert(s.bottomGap>=-1&&s.bottomGap<=8,`${label}: ${side} glyph must sit at square bottom (${s.bottomGap}px)`);assert(s.strokeWidth>=1,`${label}: ${side} glyph outline missing`);
  }
  assert(/255/.test(state.w.color),`${label}: white glyph must be filled white (${state.w.color})`);
  assert(/0|5/.test(state.b.color),`${label}: black glyph must be filled dark (${state.b.color})`);
  assert(/0|5/.test(state.w.strokeColor),`${label}: white glyph must have black outline (${state.w.strokeColor})`);
  assert(/255/.test(state.b.strokeColor),`${label}: black glyph must have white outline (${state.b.strokeColor})`);
  console.log(`[glyph-contract] ${label} ${JSON.stringify(state)}`);
}

(async()=>{
  fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    for(const [adaptation,[width,height]] of Object.entries(VIEWPORTS)){
      const dir=path.join(OUT,adaptation);fs.mkdirSync(dir,{recursive:true});
      for(const kind of ['battle','skirmish']){
        const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));
        try{await openCombat(page,kind);await ready(page);await assertGlyphContract(page,'.classic-piece-marker','.classic-square',`${adaptation} ${kind}`);assert.deepStrictEqual(errors,[],`${adaptation} ${kind} errors: ${errors.join('\n')}`);await page.screenshot({path:path.join(dir,`${kind}.png`),fullPage:false});}finally{await page.close();}
      }
      {
        const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));
        try{await openTraining(page);await ready(page);await assertGlyphContract(page,'.puzzle-piece-marker','.puzzle-square',`${adaptation} training`);assert.deepStrictEqual(errors,[],`${adaptation} training errors: ${errors.join('\n')}`);await page.screenshot({path:path.join(dir,'training.png'),fullPage:false});}finally{await page.close();}
      }
    }
    {
      const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));
      try{await openSettlement(page);await ready(page);const icons=await page.locator('.settlement-service__icon').evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n);return{backgroundColor:s.backgroundColor,borderTopWidth:s.borderTopWidth,boxShadow:s.boxShadow,backgroundImage:s.backgroundImage};}));assert.strictEqual(icons.length,3,'desktop settlement must have three service icons');assert(icons.every(x=>x.backgroundColor==='rgba(0, 0, 0, 0)'&&x.borderTopWidth==='0px'&&(x.boxShadow==='none'||x.boxShadow==='')),`desktop settlement icon backing must be removed: ${JSON.stringify(icons)}`);assert.deepStrictEqual(errors,[],`desktop settlement errors: ${errors.join('\n')}`);console.log(`[settlement-icons] ${JSON.stringify(icons)}`);await page.screenshot({path:path.join(OUT,'desktop','settlement.png'),fullPage:false});}finally{await page.close();}
    }
  }finally{await browser.close();}
  console.log(`[glyph-polish-capture] complete: ${OUT}`);
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});