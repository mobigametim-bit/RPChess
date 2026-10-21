const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:844,height:390}});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(url,{waitUntil:'networkidle'});
    await startNewRun(page);
    await page.evaluate(async()=>{
      const {readRun}=await import('./js/run-persistence.mjs');
      const {open}=await import('./js/endless-run-app.mjs');
      const original=readRun();
      const ended={...original,ended:true,endReason:'king_solo_battle',
        journeyStep:17,
        runStats:{weeks:17,goldEarned:225,skirmishWins:8,battleWins:4,puzzlesSolved:2,
          eventsResolved:4,heroesRecruited:9,caravansDefended:5}};
      if(!open(ended))throw Error('Could not open real completed Journey summary');
    });
    await page.locator('[data-endless-run-screen]:not([hidden])').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    for(const size of [{width:844,height:390},{width:667,height:300}]){
      await page.setViewportSize(size);
      const metrics=await page.evaluate(()=>{
        const box=sel=>{const r=sel.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
        const cloth=document.querySelector('.endless-run-flag-content'),root=box(cloth);
        const cards=[...document.querySelectorAll('.endless-run-metric')];
        return {scrollHeight:cloth.scrollHeight,clientHeight:cloth.clientHeight,cloth:root,
          nodes:cards.map(card=>({card:box(card),label:box(card.querySelector('span')),value:box(card.querySelector('strong')),text:card.querySelector('span').textContent})),
          viewport:[innerWidth,innerHeight]};
      });
      assert.equal(metrics.nodes.length,9);
      assert(metrics.scrollHeight<=metrics.clientHeight+2,
        `Journey summary cloth must not scroll at ${size.width}x${size.height}: ${JSON.stringify(metrics)}`);
      for(const item of metrics.nodes)assert(item.label.right<=metrics.cloth.right+2&&item.value.bottom<=metrics.cloth.bottom+2,
        `Journey metric labels/numbers stay inside cloth at ${size.width}x${size.height}: ${item.text} ${JSON.stringify(item)}`);
      if(process.env.RPCHESS_MOBILE_POLISH_SCREENSHOT_DIR){
        const dir=process.env.RPCHESS_MOBILE_POLISH_SCREENSHOT_DIR;fs.mkdirSync(dir,{recursive:true});
        await page.screenshot({path:path.join(dir,`01-journey-summary-${size.width}x${size.height}.png`)});
      }
    }
    assert.deepEqual(errors,[]);
    console.log('Real mobile Journey summary renders all nine labels and values without scroll: PASS');
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
