const assert=require('assert');
const {chromium}=require('playwright');
const {startNewRun,waitForVisible}=require('./browser-test-helpers.cjs');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const RUN_KEY='rpchess.reboot.v1.run';

async function fresh(page){
  await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate(k=>localStorage.removeItem(k),RUN_KEY);
  await page.reload({waitUntil:'networkidle'});
  await startNewRun(page);
  await page.evaluate(k=>{
    const r=JSON.parse(localStorage.getItem(k));
    r.id='roster-browser';
    r.currentTravelChoices=null;
    r.activeTravelChoice=null;
    localStorage.setItem(k,JSON.stringify(r));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  },RUN_KEY);
}

async function assertOneScreen(page,label){
  const layout=await page.evaluate(()=>({
    sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,
    sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight,
    x:window.scrollX,y:window.scrollY
  }));
  assert(layout.sw<=layout.cw+1,`${label}: horizontal page overflow ${layout.sw}/${layout.cw}`);
  assert(layout.sh<=layout.ch+1,`${label}: vertical page overflow ${layout.sh}/${layout.ch}`);
  assert(Math.abs(layout.x)<=1&&Math.abs(layout.y)<=1,`${label}: page must not be used as the scroll container`);
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e.stack||e)));
    await fresh(page);
    assert.strictEqual(await page.locator('[data-roster-card]').count(),6);
    assert.strictEqual(await page.locator('[data-run-king="true"]').count(),1);
    assert((await page.locator('[data-roster-detail]').innerText()).includes('Хранитель Клятвы'));
    await page.locator('[data-roster-card="hero.aldric_wall"]').click();
    assert((await page.locator('[data-roster-detail]').innerText()).includes('Альдрик Стена'));
    assert.strictEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).selectedCharacterId,RUN_KEY),'hero.aldric_wall');
    await assertOneScreen(page,'desktop Roster');

    await page.locator('[data-roster-travel]').click();
    await waitForVisible(page,'[data-travel-choice-screen]:not([hidden])','Travel Choice');
    assert.strictEqual(await page.locator('[data-travel-choice]').count(),3);
    assert((await page.locator('[data-travel-type="skirmish"]').count())>=1,'seeded regression fork needs Skirmish');
    await page.locator('[data-travel-type="skirmish"]').first().click();
    await waitForVisible(page,'[data-skirmish-screen]:not([hidden])','Skirmish prep');
    assert.strictEqual((await page.locator('[data-skirmish-piece-count]').innerText()).trim(),'6 / 16');
    assert.strictEqual(await page.locator('[data-skirmish-back]').count(),0,'approved Skirmish prep must not retain a legacy back control');

    await page.evaluate(()=>dispatchEvent(new CustomEvent('rpchess:run-continue')));
    await waitForVisible(page,'[data-roster-screen]:not([hidden])','Roster after encounter return');
    await page.locator('[data-roster-menu]').click();
    const menu=await waitForVisible(page,'[data-reboot-foundation]:not([hidden])','Menu before reload');
    await page.reload({waitUntil:'networkidle'});
    const reloadedMenu=await waitForVisible(page,'[data-reboot-foundation]:not([hidden])','Menu after reload');
    await reloadedMenu.locator('[data-continue-run]').click();
    await waitForVisible(page,'[data-roster-screen]:not([hidden])','Roster after Continue');
    assert((await page.locator('[data-roster-detail]').innerText()).includes('Альдрик Стена'));

    const serialized=await page.evaluate(k=>localStorage.getItem(k),RUN_KEY);
    const mobile=await browser.newPage({viewport:{width:844,height:390}}),mobileErrors=[];
    mobile.on('pageerror',e=>mobileErrors.push(String(e.stack||e)));
    await mobile.goto(url,{waitUntil:'networkidle'});
    await mobile.evaluate(([k,v])=>localStorage.setItem(k,v),[RUN_KEY,serialized]);
    await mobile.reload({waitUntil:'networkidle'});
    const mobileMenu=await waitForVisible(mobile,'[data-reboot-foundation]:not([hidden])','Landscape phone menu');
    await mobileMenu.locator('[data-continue-run]').click();
    await waitForVisible(mobile,'[data-roster-screen]:not([hidden])','Landscape phone Roster');
    await assertOneScreen(mobile,'landscape phone Roster');
    const frame=await mobile.locator('.roster-catalog').evaluate((element)=>{
      const r=element.getBoundingClientRect();const s=getComputedStyle(element);
      return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,vw:innerWidth,vh:innerHeight,overflowX:s.overflowX,overflowY:s.overflowY,sw:element.scrollWidth,cw:element.clientWidth,sh:element.scrollHeight,ch:element.clientHeight};
    });
    assert(frame.left>=-1&&frame.right<=frame.vw+1&&frame.top>=-1&&frame.bottom<=frame.vh+1,'Roster catalog frame must stay in viewport');
    if(frame.sw>frame.cw+1)assert(['auto','scroll'].includes(frame.overflowX),'overflowing Roster catalog must own horizontal scrolling');
    if(frame.sh>frame.ch+1)assert(['auto','scroll'].includes(frame.overflowY),'overflowing Roster catalog must own vertical scrolling');

    assert.deepStrictEqual(errors,[]);
    assert.deepStrictEqual(mobileErrors,[]);
    await mobile.close();
    console.log('Roster persistence, deterministic Travel bridge and one-screen landscape Chromium acceptance: PASS');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
