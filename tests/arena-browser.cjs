const assert=require('assert');
const {chromium}=require('playwright');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:950,height:530}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url,{waitUntil:'networkidle'});
    await page.locator('[data-arena-open]').click();
    await page.locator('[data-arena-screen]:not([hidden])').waitFor();
    assert.strictEqual(await page.locator('[data-arena-foes] button').count(),7);
    assert.strictEqual(await page.locator('[data-arena-foes] button:not([disabled])').count(),1);
    assert.strictEqual(await page.locator('[data-arena-squads] button').count(),14);
    assert.strictEqual(await page.locator('[data-arena-squads] button:not([disabled])').count(),1,'unaffordable squads are disabled');
    assert.strictEqual(await page.locator('[data-arena-squads] button').first().innerText(),'','owned squad shows only its art');
    await page.setViewportSize({width:667,height:300});
    const first=await page.locator('[data-arena-foes] button').first().boundingBox();
    const last=await page.locator('[data-arena-foes] button').last().boundingBox();
    assert(Math.abs(first.y-last.y)<2,'all seven opponents must share one row in mobile landscape');
    assert(last.y+last.height<=300,'opponent row must fit above the mobile landscape viewport edge');
    const layout=await page.evaluate(()=>{
      const foes=document.querySelector('[data-arena-foes]'),card=foes.querySelector('button');
      return {overflow:getComputedStyle(foes).overflowX,scrollable:foes.scrollWidth>foes.clientWidth,font:parseFloat(getComputedStyle(card.querySelector('small')).fontSize),background:getComputedStyle(card).backgroundImage};
    });
    assert.strictEqual(layout.overflow,'auto','opponent carousel must allow swiping');
    assert(layout.scrollable,'opponents should scroll horizontally instead of shrinking text');
    assert(layout.font>=14,'opponent text should remain legible on mobile landscape');
    assert(layout.background.includes('96, 36, 48'),'opponent panels should be burgundy');
    await page.locator('[data-arena-foes] button').first().click();
    assert((await page.locator('[data-arena-dialog]').textContent()).includes('Мощь'));
    assert((await page.locator('[data-arena-dialog]').textContent()).includes('Ничьих'));
    assert.strictEqual(await page.locator('.arena-dialog-panel--foe h2').count(),0,'foe popup omits the piece/race heading');
    const popup=await page.evaluate(()=>{
      const art=document.querySelector('.arena-foe-profile-art').getBoundingClientRect(),stats=document.querySelector('.arena-foe-profile-stats').getBoundingClientRect();
      return {artRight:art.right,statsLeft:stats.left};
    });
    assert(popup.artRight<=popup.statsLeft,'foe art must sit to the left of match stats');
    await page.locator('[data-arena-action="fight"]').click();
    assert.strictEqual(await page.locator('[data-arena-action="artifact"]').count(),4);
    await page.reload({waitUntil:'networkidle'});
    await page.locator('[data-arena-open]').click();
    assert.strictEqual(await page.locator('[data-arena-action="artifact"]').count(),4,'offer persists on reload');
    await page.locator('[data-artifact="none"]').click();
    assert.strictEqual(await page.locator('[data-arena-board] [data-square]').count(),64);
    await page.setViewportSize({width:1900,height:909});
    const combatBoard=await page.locator('[data-arena-board]').boundingBox();
    assert(combatBoard.x>=0 && combatBoard.y<=1 && Math.abs(combatBoard.width-909)<=1 && Math.abs(combatBoard.height-909)<=1,'battle board must fit edge to edge in the landscape viewport');
    await page.locator('[data-arena-rivals]').click();
    const resume=await page.locator('[data-arena-resume]').boundingBox();
    assert(resume && resume.y>=0 && resume.y+resume.height<=909,'resume button must remain visible on desktop');
    await page.setViewportSize({width:667,height:300});
    const compactResume=await page.locator('[data-arena-resume]').boundingBox();
    assert(compactResume && compactResume.y+compactResume.height<=300,'resume button must remain visible on phone');
    await page.locator('[data-arena-resume]').click();
    assert.strictEqual(await page.locator('[data-arena-board] .classic-piece-marker[data-piece-marker]').count(),32);
    await page.locator('[data-arena-board] [data-square="e2"]').click();
    await page.locator('[data-arena-board] [data-square="e4"]').click();
    await page.waitForFunction(()=>window.RPChessArena?.state.match.moves.length>=2,{timeout:16000});
    assert((await page.locator('[data-arena-board] [data-square="e4"] .classic-piece').getAttribute('src')).includes('/humans/pieces/white/pawn.png'));
    const moves=await page.evaluate(()=>window.RPChessArena.state.match.moves);
    await page.reload({waitUntil:'networkidle'});
    await page.locator('[data-arena-open]').click();
    assert.deepStrictEqual(await page.evaluate(()=>window.RPChessArena.state.match.moves),moves);
    assert.strictEqual(await page.locator('[data-arena-board] .classic-piece').count(),32);
    await page.evaluate(()=>{
      window.RPChessArena.engine.reset('k3r3/n7/8/8/8/8/4R3/R3K3 w - - 0 1');
      document.querySelector('[data-arena-board] [data-square="e2"]').click();
    });
    const ice=await page.evaluate(()=>{
      const square=id=>{const cell=document.querySelector(`[data-arena-board] [data-square="${id}"]`),overlay=cell.querySelector('.classic-pin-ice');return {pin:cell.dataset.pinState,src:overlay?.getAttribute('src'),opacity:overlay?getComputedStyle(overlay).opacity:''};};
      return {white:square('e2'),black:square('a7')};
    });
    assert.deepStrictEqual(ice,{white:{pin:'partial',src:'assets/vfx/pin_ice_partial.png',opacity:'0.5'},black:{pin:'full',src:'assets/vfx/pin_ice_full.png',opacity:'0.5'}},'Arena pin animation must reuse the journey overlays');
    assert.deepStrictEqual(errors,[]);
    console.log('Arena mobile landscape, offer, match and reload: PASS');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
