const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {chromium}=require('playwright');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1653,height:760}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    // Keep browser localization deterministic; public API connectivity is exercised
    // separately by the Cloudflare deployment smoke test.
    await page.route('https://rpchess-leaderboard.mobigametim.workers.dev/**',route=>
      route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({top:[],me:null})}));
    await page.goto(url,{waitUntil:'networkidle'});
    const panel=page.locator('[data-chronicle-panel]');
    await panel.waitFor();
    const setLanguage=language=>page.evaluate(async language=>{const i18n=await import('./js/i18n.mjs');i18n.setLanguage(language);},language);
    await setLanguage('en');
    assert.strictEqual(await panel.locator('h2').innerText(),'Chronicle');
    assert((await panel.innerText()).includes('No active journey'));
    assert((await panel.innerText()).includes('Great Commanders'));
    assert((await panel.innerText()).includes('No results yet'),'online empty leaderboard should translate');
    assert(!/[А-Яа-яЁё]/u.test(await panel.innerText()),'empty Chronicle must fully translate');
    await page.evaluate(async()=>{
      const persistence=await import('./js/run-persistence.mjs');
      persistence.writeRun({...persistence.createRun({id:'chronicle-language',playerName:'Тимур'}),journeyStep:12});
      localStorage.setItem('rpchess.reboot.v1.chronicle',JSON.stringify({schemaVersion:1,history:[{runId:'best-language',playerName:'Рагнар',week:35,power:900,completedAt:1000}]}));
      window.RPChessChronicle.render();
    });
    for(const text of ['CURRENT JOURNEY','Great Commanders','POWER','WEEK','HEROES IN RANKS'])assert((await panel.innerText()).includes(text),text);
    assert.strictEqual(await panel.locator('[data-chronicle-current] h3').innerText(),'Тимур');
    assert.strictEqual(await panel.locator('[data-chronicle-best] h3').innerText(),'Great Commanders');
    assert(!/[А-Яа-яЁё]/u.test((await panel.innerText()).replaceAll('Тимур','')),'only player names may retain Cyrillic');
    // Mock the API only in the browser regression, never in production.
    await page.evaluate(async()=>{
      window.RPChessLeaderboardAPI='https://leaderboard.example.invalid';
      const original=window.fetch.bind(window);
      window.__chronicleOriginalFetch=original;
      window.fetch=(resource,options)=>String(resource).startsWith('https://leaderboard.example.invalid/')
        ?Promise.resolve(new Response(JSON.stringify({
          top:[{rank:1,name:'Рагнар',glory:17},{rank:2,name:'Ивар',glory:15}],
          me:{rank:43,name:'Тимур',glory:14}
        }),{status:200,headers:{'content-type':'application/json'}}))
        :original(resource,options);
      const {loadLeaderboard}=await import('./js/leaderboard-client.mjs');
      await loadLeaderboard({force:true});
    });
    assert.strictEqual(await panel.locator('.chronicle-leaderboard-row').count(),2);
    assert((await panel.locator('.chronicle-leaderboard-self').innerText()).includes('#43'));
    // Signed VK browser: every return to Main Menu can publish a NEW ongoing
    // Journey's Glory; no backend calls are made without a VK launch signature.
    const online=await page.evaluate(async()=>{
      history.replaceState(null,'',location.pathname+'?vk_app_id=54754579&vk_user_id=42&sign=browser-test-only');
      const {readRun,writeRun}=await import('./js/run-persistence.mjs');
      const {writePlayerRating}=await import('./js/player-rating.mjs');
      writeRun({...readRun(),journeyStep:50});
      writePlayerRating({power:1600,receipts:[]});
      // Preserve the two-player portrait fixture: the active-Glory scenario
      // below deliberately installs a separate single-record fake server.
      window.__portraitLeaderboardFetch=window.fetch;
      window.__rankedSubmissions=[];
      window.__rankedServerBest=null;
      window.fetch=async(resource,options)=>{
        if(!String(resource).startsWith('https://leaderboard.example.invalid/'))return window.__chronicleOriginalFetch(resource,options);
        const request=options?.body?JSON.parse(options.body):{};
        if(String(resource).endsWith('/submit')){
          window.__rankedSubmissions.push(request.record);
          window.__rankedServerBest=request.record;
        }
        const best=window.__rankedServerBest;
        return new Response(JSON.stringify({top:best?[{rank:1,name:best.playerName,glory:best.glory}]:[],
          me:best?{rank:1,name:best.playerName,glory:best.glory,week:best.week,power:best.power}:null}),
          {status:200,headers:{'content-type':'application/json'}});
      };
      return true;
    });
    assert(online);
    async function revisitMenu(){
      await page.evaluate(async()=>{
        const menu=document.querySelector('[data-reboot-foundation]');
        menu.hidden=true;
        await new Promise(resolve=>requestAnimationFrame(resolve));
        menu.hidden=false;
      });
    }
    await revisitMenu();
    await page.waitForFunction(()=>window.__rankedSubmissions.length===1);
    const record=await page.evaluate(()=>window.__rankedSubmissions[0]);
    assert.strictEqual(record.glory,28);
    assert.strictEqual(record.week,50);
    assert.strictEqual(record.playerName,'Тимур');
    assert((await panel.innerText()).includes('28'),'new active-run Glory must appear in the rank');
    await revisitMenu();
    await page.waitForTimeout(120);
    assert.strictEqual(await page.evaluate(()=>window.__rankedSubmissions.length),1,
      'returning to menu without improvement must not resubmit');
    await page.evaluate(async()=>{
      const persistence=await import('./js/run-persistence.mjs');
      persistence.writeRun({...persistence.readRun(),journeyStep:60});
    });
    await revisitMenu();
    await page.waitForFunction(()=>window.__rankedSubmissions.length===2);
    assert.strictEqual(await page.evaluate(()=>window.__rankedSubmissions[1].glory),30,
      'a later return to menu must publish the higher current Glory');
    assert.strictEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('rpchess.reboot.v1.chronicle')).history.length),1,
      'rank submissions must not write unfinished runs into completed Chronicle');
    for(const viewport of [{width:1653,height:760},{width:844,height:390},{width:667,height:300}]){
      await page.setViewportSize(viewport);
      const view=await panel.evaluate(root=>{
        const own=root.querySelector('.chronicle-leaderboard-self');
        const row=root.querySelector('.chronicle-leaderboard-row');
        return {rank:own?.textContent,row:row?.textContent,visible:getComputedStyle(root).display!=='none'};
      });
      assert(view.visible&&view.rank.includes('30')&&view.row?.includes('30'),
        `live Glory must render at ${viewport.width}x${viewport.height}: ${JSON.stringify(view)}`);
    }
    await page.setViewportSize({width:1653,height:760});
    if(process.env.RPCHESS_FLAG_SCREENSHOT_DIR) {
      const dir=path.resolve(process.env.RPCHESS_FLAG_SCREENSHOT_DIR);
      fs.mkdirSync(dir,{recursive:true});
      await panel.screenshot({path:path.join(dir,'leaderboard-en.png')});
    }
    await setLanguage('ru');
    assert.strictEqual(await panel.locator('h2').innerText(),'Летопись');
    assert((await panel.innerText()).includes('Великие полководцы'));
    if(process.env.RPCHESS_FLAG_SCREENSHOT_DIR) {
      const dir=path.resolve(process.env.RPCHESS_FLAG_SCREENSHOT_DIR);
      await panel.screenshot({path:path.join(dir,'leaderboard-ru.png')});
    }
    assert((await panel.innerText()).includes('ГЕРОЕВ В СТРОЮ'));
    // Reset the leaderboard provider between the active-Journey and
    // multi-commander portrait scenarios so their fixtures cannot collide.
    await page.evaluate(async()=>{
      window.fetch=window.__portraitLeaderboardFetch;
      const {loadLeaderboard}=await import('./js/leaderboard-client.mjs');
      await loadLeaderboard({force:true});
    });
    await page.locator('.chronicle-leaderboard-row').nth(1).waitFor();
    await page.evaluate(()=>window.RPChessPlayerIdentity.open());
    assert.strictEqual(await page.locator('[data-identity-commander]').count(),7,'seven original commanders available in the name dialog');
    await page.locator('[data-identity-commander="wanderer_queen"]').click();
    assert.strictEqual(await page.locator('[data-identity-commander="wanderer_queen"]').getAttribute('aria-pressed'),'true');
    assert((await page.locator('[data-identity-commander-image]').getAttribute('src')).includes('wanderer_queen/portrait.webp'));
    // Guard the actual 1313x641 modal layout: warm-gold cards, and both
    // portrait and biography centered within the tall selected-king preview.
    await page.setViewportSize({width:1313,height:641});
    const commanderLayout=await page.evaluate(()=>{
      const card=document.querySelector('.identity-commander-option');
      const preview=document.querySelector('.identity-commander-preview');
      const rect=preview.getBoundingClientRect(), middle=rect.top+rect.height/2;
      const color=element=>getComputedStyle(element).borderTopColor.match(/[0-9.]+/g).slice(0,3).map(Number);
      const offset=element=>{const r=element.getBoundingClientRect();return Math.abs(r.top+r.height/2-middle);};
      return {cardBorder:color(card),previewBorder:color(preview),
        portraitOffset:offset(preview.querySelector('img')),
        biographyOffset:offset(preview.querySelector('div'))};
    });
    for(const rgb of [commanderLayout.cardBorder,commanderLayout.previewBorder])
      assert(rgb[0]>rgb[1]&&rgb[1]>rgb[2],'commander card borders should be warm gold, not blue');
    assert(commanderLayout.portraitOffset<=12&&commanderLayout.biographyOffset<=12,
      'selected commander portrait and biography must both be vertically centered');
    await page.setViewportSize({width:1653,height:760});
    await page.locator('[data-player-identity-input]').fill('Тимур');
    await setLanguage('en');
    assert.strictEqual(await page.locator('#player-identity-title').innerText(),'Who are you, warrior?');
    assert.strictEqual(await page.locator('[data-player-identity-input]').inputValue(),'Тимур','language changes preserve entered names');
    assert.strictEqual(await page.locator('[data-identity-commander="wanderer_queen"]').getAttribute('aria-pressed'),'true','language switch must preserve the selected portrait');
    assert((await page.locator('[data-identity-commander-description]').innerText()).includes('queen without a palace'),'commander bio changes to English');
    assert.strictEqual(await panel.locator('.chronicle-leaderboard-avatar').count(),2,'existing flag shows portrait per ranked commander');
    const portrait=await panel.locator('[data-chronicle-current] .chronicle-current-profile img').getAttribute('src');
    assert(portrait.includes('/kings/oathkeeper/portrait.webp'),'legacy current runs keep the default royal portrait');

    assert.strictEqual(await page.locator('[data-player-identity-close]').getAttribute('aria-label'),'Close');
    await page.evaluate(()=>{
      window.RPChessPlayerIdentity.close();
      // The synthetic signed VK launch is only for the in-page leaderboard
      // submission regression. Do not reload standalone Pages as a fake VK app.
      history.replaceState(null,'',location.pathname);
    });
    await page.reload({waitUntil:'networkidle'});
    assert.strictEqual(await panel.locator('h2').innerText(),'Chronicle','persisted English applies at startup');
    assert.strictEqual(await panel.locator('[data-chronicle-current] h3').innerText(),'Тимур');
    // Reuse this existing real-browser acceptance to capture a visual preview
    // of the exact JPEG sent to VK Stories, not a schematic test placeholder.
    const previews=await page.evaluate(async()=>{
      const {createRun}=await import('./js/run-persistence.mjs');
      const {renderRunStory}=await import('./js/content/story-card.mjs');
      const sample={...createRun({id:'vk-story-visual-preview',playerName:'Тимур'}),
        ended:true,endReason:'king_solo_battle',journeyStep:28,
        runStats:{weeks:28,goldEarned:322,skirmishWins:0,battleWins:3,
          puzzlesSolved:9,eventsResolved:6,caravansDefended:1}};
      const images={};
      for(const [language,endReason] of [
        ['ru','Наёмники отказались слушать одинокого короля без королевства.'],
        ['en','Mercenaries ignored the words of a lone king without a kingdom.']
      ]) {
        const story=await renderRunStory(sample,{language,power:634,endReason});
        if(story.width!==1080||story.height!==1920||story.dataUrl.length<20000)
          throw new Error('Story card must be a real 1080x1920 JPEG with game art');
        images[language]=story.dataUrl;
      }
      return images;
    });
    if(process.env.RPCHESS_FLAG_SCREENSHOT_DIR) {
      const dir=path.resolve(process.env.RPCHESS_FLAG_SCREENSHOT_DIR);
      fs.mkdirSync(dir,{recursive:true});
      for(const language of ['ru','en'])
        fs.writeFileSync(path.join(dir,`vk-story-${language}-1080x1920.jpg`),
          Buffer.from(previews[language].split(',')[1],'base64'));
    }
    assert.deepStrictEqual(errors,[]);
    console.log('Chronicle + genuine VK Story card JPEG previews (RU/EN): PASS');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
