const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {chromium}=require(process.cwd()+'/node_modules/playwright');
const {startNewRun}=require(process.cwd()+'/tests/browser-test-helpers.cjs');
const url='http://127.0.0.1:4173';
const RUN_KEY='rpchess.reboot.v1.run';
const shots=path.resolve('solo-king-screenshots');
fs.mkdirSync(shots,{recursive:true});

async function setLanguage(page,language){
  await page.waitForFunction(()=>Boolean(globalThis.RPChessI18n?.setLanguage));
  await page.evaluate((value)=>globalThis.RPChessI18n.setLanguage(value),language);
}

async function runCase(browser,width,height,language,filename){
  const page=await browser.newPage({viewport:{width,height}});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e.stack||e)));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate(key=>localStorage.removeItem(key),RUN_KEY);
  await page.reload({waitUntil:'networkidle'});
  await setLanguage(page,language);
  await startNewRun(page,{playerName:'Solo King Visual'});
  await page.evaluate(()=>dispatchEvent(new CustomEvent('rpchess:battle-open')));
  await page.locator('[data-battle-screen]:not([hidden])').waitFor();
  const kingId=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).roster.find(c=>c.isRunKing).id,RUN_KEY);
  const cards=page.locator('[data-battle-character]');
  for(let i=0;i<await cards.count();i++){
    const c=cards.nth(i);
    if((await c.getAttribute('data-battle-character'))!==kingId)await c.click();
  }
  await page.locator('[data-battle-start]').click();
  await page.locator('[data-classic-screen]:not([hidden])').waitFor();
  assert.deepStrictEqual(await page.evaluate(()=>globalThis.RPChessBattle.battlePlan?.participants||[]),[kingId]);
  await page.evaluate(()=>globalThis.RPChessBattle.finishBattle({over:true,type:'stalemate',winner:null}));
  await page.locator('[data-battle-run-end]:not([hidden])').waitFor();
  await page.waitForTimeout(100);
  const state=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),RUN_KEY);
  assert.strictEqual(state.endReason,'king_solo_battle');
  assert.strictEqual(state.roster.find(c=>c.isRunKing).status,'dead');
  const expected=language==='en'
    ?'The mercenaries paid no heed to the words of a lone king without a kingdom and hanged you from the nearest tree.'
    :'Наемники не посчитались со словами одинокого короля без королевства и повесили вас на суку ближайшего дерева';
  assert.strictEqual((await page.locator('[data-battle-run-end-text]').innerText()).trim(),expected);
  const g=await page.evaluate(()=>{
    const panel=document.querySelector('.battle-run-end .battle-aftermath-panel');
    const required=['[data-battle-run-end-title]','[data-battle-run-end-text]','[data-battle-run-metric="combats"]','[data-battle-run-metric="healthy"]','[data-battle-run-metric="wounded"]','[data-battle-run-end-continue]'];
    const box=el=>{const r=el.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    return {vw:innerWidth,vh:innerHeight,doc:{sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight},panel:box(panel),panelScrollHeight:panel.scrollHeight,panelClientHeight:panel.clientHeight,panelOverflowY:getComputedStyle(panel).overflowY,required:required.map(selector=>({selector,rect:box(document.querySelector(selector))}))};
  });
  await page.screenshot({path:path.join(shots,filename),fullPage:false});
  assert(g.doc.sw<=g.doc.cw+1,`${filename}: horizontal page overflow`);
  assert(g.doc.sh<=g.doc.ch+1,`${filename}: vertical page overflow ${g.doc.sh}>${g.doc.ch}`);
  assert(g.panelScrollHeight<=g.panelClientHeight+2,`${filename}: panel scroll ${g.panelScrollHeight}>${g.panelClientHeight}`);
  assert(!['auto','scroll'].includes(g.panelOverflowY),`${filename}: internal scrollbar ${g.panelOverflowY}`);
  for(const item of g.required){
    assert(item.rect.left>=-1&&item.rect.top>=-1&&item.rect.right<=g.vw+1&&item.rect.bottom<=g.vh+1,`${filename}: ${item.selector} outside viewport`);
    assert(item.rect.left>=g.panel.left-1&&item.rect.top>=g.panel.top-1&&item.rect.right<=g.panel.right+1&&item.rect.bottom<=g.panel.bottom+1,`${filename}: ${item.selector} outside panel`);
  }
  assert.deepStrictEqual(errors,[],`${filename}: browser errors ${errors.join('\n')}`);
  console.log(`${filename}: PASS ${JSON.stringify(g)}`);
  await page.close();
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    await runCase(browser,1366,768,'ru','solo-king-1366x768-ru.png');
    await runCase(browser,1024,768,'ru','solo-king-1024x768-ru.png');
    await runCase(browser,844,390,'ru','solo-king-844x390-ru.png');
    await runCase(browser,844,390,'en','solo-king-844x390-en.png');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
