const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun, waitForVisible } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';
const SETTINGS_KEY = 'rpchess.reboot.v1.settings';
const TOLERANCE = 1;

async function clearState(page) {
  await page.goto(url, { waitUntil:'networkidle' });
  await page.evaluate(([runKey, settingsKey]) => {
    localStorage.removeItem(runKey);
    localStorage.removeItem(settingsKey);
  }, [RUN_KEY, SETTINGS_KEY]);
  await page.reload({ waitUntil:'networkidle' });
}

async function assertDocumentFits(page, label) {
  const metrics = await page.evaluate(() => ({
    sw:document.documentElement.scrollWidth,
    cw:document.documentElement.clientWidth,
    sh:document.documentElement.scrollHeight,
    ch:document.documentElement.clientHeight,
    x:window.scrollX,
    y:window.scrollY
  }));
  assert(metrics.sw <= metrics.cw + TOLERANCE, `${label}: horizontal page overflow ${metrics.sw}/${metrics.cw}`);
  assert(metrics.sh <= metrics.ch + TOLERANCE, `${label}: vertical page overflow ${metrics.sh}/${metrics.ch}`);
  assert(Math.abs(metrics.x) <= TOLERANCE && Math.abs(metrics.y) <= TOLERANCE, `${label}: page must remain at viewport origin`);
}

async function assertInsideViewport(locator, label) {
  await locator.waitFor({ state:'visible' });
  const rect = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { left:box.left, top:box.top, right:box.right, bottom:box.bottom, vw:innerWidth, vh:innerHeight };
  });
  assert(rect.left >= -TOLERANCE && rect.top >= -TOLERANCE, `${label}: starts outside viewport`);
  assert(rect.right <= rect.vw + TOLERANCE && rect.bottom <= rect.vh + TOLERANCE, `${label}: escapes viewport`);
}

async function desktopContract(browser) {
  const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
  const errors=[]; page.on('pageerror', (error)=>errors.push(String(error.stack||error)));
  try {
    await clearState(page);
    const menu = await waitForVisible(page, '[data-reboot-foundation]:not([hidden])', 'Desktop main menu');
    assert.strictEqual(await menu.locator('[data-new-game]').count(), 1);
    assert.strictEqual(await menu.locator('[data-continue-run]').isDisabled(), false, 'Journey always starts or resumes');
    assert.strictEqual(await menu.locator('[data-new-game][data-continue-run]').count(), 1);
    assert.strictEqual(await menu.locator('.mm-menu-icon').count(), 6);
    assert.strictEqual(await menu.locator('.mm-menu-icon img').count(), 6);
    await page.waitForFunction(()=>[...document.querySelectorAll('.mm-menu-icon')].length===6&&
      [...document.querySelectorAll('.mm-menu-icon')].every(node=>
        node.querySelector('img')?.naturalWidth>0&&node.textContent.trim()===''));
    assert.strictEqual(await menu.locator('.reboot-wordmark').count(), 0);
    assert.strictEqual(await menu.locator('[data-main-menu-kingdom]').isHidden(), true);
    assert.strictEqual(await menu.locator('[data-settings]').count(), 1);
    assert.strictEqual(await menu.locator('[data-language]').count(), 1);
    await assertDocumentFits(page, 'desktop menu');

    await menu.locator('[data-settings]').click();
    const settings = await waitForVisible(page, '[data-settings-modal]:not([hidden])', 'Settings');
    await assertInsideViewport(settings.locator('.reboot-modal__panel'), 'desktop Settings frame');
    await settings.locator('[data-music-volume]').evaluate((input)=>{ input.value='33'; input.dispatchEvent(new Event('input',{bubbles:true})); });
    await settings.locator('[data-close-modal]').click();

    const navigationCount = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    await menu.locator('[data-language]').click();
    const language = await waitForVisible(page, '[data-language-modal]:not([hidden])', 'Language');
    await assertInsideViewport(language.locator('.reboot-modal__panel'), 'desktop Language frame');
    await language.locator('[data-language-option="en"]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.strictEqual(await menu.locator('[data-new-game]').getAttribute('aria-label'), 'Journey');
    assert.strictEqual(await menu.locator('.reboot-menu-actions [data-settings]').getAttribute('aria-label'), 'Settings');
    assert.strictEqual((await menu.locator('[data-new-game]').textContent()).trim(),'', 'Icons have no captions');
    assert.strictEqual(await menu.locator('.mm-menu-icon img').count(),6,
      'Arena/Tournament icons survive language changes');
    assert.strictEqual((await menu.locator('[data-arena-open]').textContent()).trim(),'', 'Arena icon must not become text');
    assert.strictEqual((await menu.locator('[data-tournament-open]').textContent()).trim(),'', 'Tournament icon must not become text');
    assert.strictEqual(await page.evaluate(() => performance.getEntriesByType('navigation').length), navigationCount, 'language switch must not reload');
    assert.strictEqual(await page.evaluate((key)=>localStorage.getItem(key), RUN_KEY), null, 'language switch must not create run state');
    await language.locator('[data-close-modal].reboot-language-back').click();

    await startNewRun(page, { playerName:'Browser Tester' });
    const roster = await waitForVisible(page, '[data-roster-screen]:not([hidden])', 'Roster');
    await assertInsideViewport(roster, 'desktop Roster');
    assert.strictEqual(await page.locator('[data-roster-card]').count(), 6);
    await page.locator('[data-roster-travel]').click();
    await waitForVisible(page, '[data-travel-choice-screen]:not([hidden])', 'Travel Choice');
    assert.strictEqual(await page.locator('[data-travel-choice]').count(), 3);
    await assertDocumentFits(page, 'desktop Travel');
    assert.deepStrictEqual(errors, [], `desktop browser errors:\n${errors.join('\n')}`);
  } finally { await page.close(); }
}

async function landscapePhoneContract(browser) {
  const page = await browser.newPage({ viewport:{ width:844, height:390 } });
  const errors=[]; page.on('pageerror', (error)=>errors.push(String(error.stack||error)));
  try {
    await clearState(page);
    const menu = await waitForVisible(page, '[data-reboot-foundation]:not([hidden])', 'Phone landscape menu');
    await assertInsideViewport(menu, 'phone landscape menu');
    await assertDocumentFits(page, 'phone landscape menu');
    await menu.locator('[data-settings]').click();
    const settings = await waitForVisible(page, '[data-settings-modal]:not([hidden])', 'Phone Settings');
    await assertInsideViewport(settings.locator('.reboot-modal__panel'), 'phone Settings frame');
    await assertDocumentFits(page, 'phone Settings');
    await settings.locator('[data-close-modal]').click();
    await startNewRun(page, { playerName:'Phone Tester' });
    await assertInsideViewport(page.locator('[data-roster-screen]:not([hidden])'), 'phone landscape Roster');
    await assertDocumentFits(page, 'phone landscape Roster');
    assert.deepStrictEqual(errors, [], `phone landscape errors:\n${errors.join('\n')}`);
  } finally { await page.close(); }
}

// Regression: the current kingdom is a full-screen, read-only backdrop,
// not an inset map card in the first-column layout.
async function kingdomBackdropContract(browser) {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  try{
    await clearState(page);
    await startNewRun(page,{playerName:'Backdrop Tester',legacyTravel:false});
    await page.locator('[data-roster-travel]').click();
    await waitForVisible(page,'[data-kingdom-map-screen]:not([hidden])','Game kingdom map');
    await page.locator('[data-kingdom-menu]').click();
    await waitForVisible(page,'[data-reboot-foundation]:not([hidden])','Full-bleed menu');
    await page.waitForFunction(()=>{
      const stage=document.querySelector('[data-main-menu-kingdom]');
      return stage&&!stage.hidden&&stage.querySelector('[data-main-menu-world]')&&
        stage.querySelector('.mm-kingdom-parchment')?.width>0;
    },null,{timeout:16000});
    for(const [width,height] of [[1440,900],[1024,768],[844,390],[768,1024],[390,844]]){
      await page.setViewportSize({width,height});
      await page.waitForFunction(()=>{
        const stage=document.querySelector('[data-main-menu-kingdom]');
        const world=stage?.querySelector('[data-main-menu-world]');
        if(!stage||!world)return false;
        const a=stage.getBoundingClientRect(),b=world.getBoundingClientRect();
        return a.width>0&&a.height>0&&b.width>=a.width-2&&b.height>=a.height-2;
      },null,{timeout:10000});
      await page.waitForFunction(()=>{
        const s=document.querySelector('[data-main-menu-kingdom]');
        return s?.dataset.kingdomFocus&&s?.dataset.kingdomScale&&s?.dataset.kingdomTerritory;
      },null,{timeout:10000});
      const m=await page.evaluate(()=>{
        const menu=document.querySelector('[data-reboot-foundation]');
        const stage=menu.querySelector('[data-main-menu-kingdom]');
        const a=menu.getBoundingClientRect(),b=stage.getBoundingClientRect();
        const focus=JSON.parse(stage.dataset.kingdomFocus||'null');
        const territory=JSON.parse(stage.dataset.kingdomTerritory||'null');
        const world=stage.querySelector('[data-main-menu-world]');
        const scale=Number(stage.dataset.kingdomScale);
        const wr=world?.getBoundingClientRect();
        return {menu:[a.left,a.top,a.width,a.height],stage:[b.left,b.top,b.width,b.height],
          icons:menu.querySelectorAll('.mm-menu-icon img').length,
          outside:menu.querySelector('.reboot-menu-screen__main')?.contains(stage),
          pointer:getComputedStyle(stage).pointerEvents,
          active:menu.classList.contains('mm-has-kingdom'),
          focus,territory,scale,
          worldCenter:wr?[wr.left-b.left+wr.width/2,wr.top-b.top+wr.height/2]:null,
          navTop:menu.querySelector('.reboot-menu-actions')?.getBoundingClientRect().top-b.top,
          flagLeft:menu.querySelector('[data-chronicle-panel]')?.getBoundingClientRect().left-b.left,
          landscape:innerWidth>innerHeight};

      });
      assert(m.active,'saved kingdom must activate parchment background');
      assert.strictEqual(m.outside,false,'kingdom must be outside the left menu column');
      assert.strictEqual(m.icons,6,'six PNG icons remain visible in '+width+'x'+height);
      assert.strictEqual(m.pointer,'none','background cannot block menu clicks');
      const foreground=await page.evaluate(()=>{
        const stage=document.querySelector('[data-main-menu-kingdom]');
        const z=selector=>Number(getComputedStyle(stage.querySelector(selector)).zIndex);
        return {roads:z('.mm-kingdom-overlay'),site:z('.mm-kingdom-items'),
          walkers:z('.mm-kingdom-actors'),fog:z('.mm-kingdom-fog'),
          king:z('.mm-kingdom-king')};
      });
      assert(foreground.roads<foreground.site&&foreground.site<foreground.walkers&&
        foreground.walkers<foreground.fog&&foreground.fog<foreground.king,
        width+'x'+height+': NPC must pass over sites, under fog/king: '+JSON.stringify(foreground));
      for(const idx of [0,1,2,3])
        assert(Math.abs(m.menu[idx]-m.stage[idx])<=2,
          width+'x'+height+' backdrop must fill menu edge-to-edge: '+JSON.stringify(m));
      const label=width+'x'+height;
      assert(m.focus&&m.territory&&m.scale>0,'castle camera must be present at '+label);
      assert(Math.abs(m.worldCenter[0]-m.focus.centerX)<2&&
        Math.abs(m.worldCenter[1]-m.focus.centerY)<2,
        label+': castle must be exactly at focus center');
      assert(m.focus.bottom<=m.navTop-9,
        label+': owned kingdom must stay above icon dock');
      if(m.landscape&&m.flagLeft)
        assert(m.focus.right<=m.flagLeft-20,
          label+': owned kingdom must stay left of Chronicle');
      // The outer HALF of every extreme cell must be inside the free region.
      // Maximal fit uses the near-exact zoom, not a tiny fit-to-entire-screen.
      const owned=m.territory,castle=owned.castle,T=142;
      const left=m.focus.centerX+(owned.minX-castle.x-.5)*T*m.scale;
      const right=m.focus.centerX+(owned.maxX-castle.x+.5)*T*m.scale;
      const top=m.focus.centerY+(owned.minY-castle.y-.5)*T*m.scale;
      const bottom=m.focus.centerY+(owned.maxY-castle.y+.5)*T*m.scale;
      assert(left>=m.focus.left-2&&right<=m.focus.right+2&&
        top>=m.focus.top-2&&bottom<=m.focus.bottom+2,
        label+': whole kingdom perimeter must fit marked zone: '+JSON.stringify(m));
      const padding=Math.min(18,Math.max(7,Math.min(m.focus.width,m.focus.height)*.025));
      const xRadius=Math.max(castle.x-owned.minX,owned.maxX-castle.x)+.5;
      const yRadius=Math.max(castle.y-owned.minY,owned.maxY-castle.y)+.5;
      const ideal=Math.min((m.focus.width/2-padding)/(xRadius*T),
        (m.focus.height/2-padding)/(yRadius*T));
      assert(Math.abs(m.scale-ideal)/Math.max(ideal,.0001)<.001,
        label+': scale must be maximal and determined by owned boundaries');
    }
    assert.deepStrictEqual(errors,[],'backdrop browser errors');
  }finally{await page.close();}
}

async function portraitLockContract(browser) {
  const page = await browser.newPage({ viewport:{ width:390, height:844 } });
  const errors=[]; page.on('pageerror', (error)=>errors.push(String(error.stack||error)));
  try {
    await clearState(page);
    const lock = await waitForVisible(page, '[data-orientation-lock]', 'Portrait orientation lock');
    await assertInsideViewport(lock, 'portrait orientation lock');
    const rect = await lock.evaluate((element)=>{ const box=element.getBoundingClientRect(); return { w:box.width,h:box.height,vw:innerWidth,vh:innerHeight }; });
    assert(Math.abs(rect.w-rect.vw)<=TOLERANCE && Math.abs(rect.h-rect.vh)<=TOLERANCE, 'portrait lock must cover the viewport');
    assert((await lock.innerText()).includes('Поверните устройство'));
    await assertDocumentFits(page, 'portrait lock');
    assert.deepStrictEqual(errors, [], `portrait errors:\n${errors.join('\n')}`);
  } finally { await page.close(); }
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    await desktopContract(browser);
    await landscapePhoneContract(browser);
    await kingdomBackdropContract(browser);
    await portraitLockContract(browser);
    console.log('Reboot Foundation one-screen desktop/landscape/portrait Chromium acceptance: PASS');
  } finally { await browser.close(); }
})().catch((error)=>{ console.error(error.stack||error); process.exitCode=1; });
