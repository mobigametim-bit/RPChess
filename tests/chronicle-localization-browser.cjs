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
    await page.route('https://rpchess-profile-preview.mobigametim.workers.dev/**',route=>
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
    for(const text of ['CURRENT JOURNEY','Great Commanders','POWER','DAY','HEROES IN RANKS'])assert((await panel.innerText()).includes(text),text);
    assert.strictEqual(await panel.locator('[data-chronicle-current] .chronicle-v2-profile-copy strong').innerText(),'Тимур');
    assert.strictEqual(await panel.locator('[data-chronicle-best] h3').innerText(),'Great Commanders');
    assert(!/[А-Яа-яЁё]/u.test((await panel.innerText()).replaceAll('Тимур','')),'only player names may retain Cyrillic');
    // Mock only the public v3 board. The retired signed VK score uploader
    // must remain disabled; verified RPChess profile snapshots own writes.
    await page.evaluate(async()=>{
      window.RPChessProfileAPI='https://board-v2.example.invalid';
      const original=window.fetch.bind(window);
      window.__chronicleOriginalFetch=original;
      window.fetch=(resource,options)=>String(resource).startsWith('https://board-v2.example.invalid/')
        ?Promise.resolve(new Response(JSON.stringify({scoreVersion:2,
          top:[{rank:1,name:'Рагнар',glory:177,commanderId:'ash_regent'},
            {rank:2,name:'Ивар',glory:155,commanderId:'oathkeeper'}],
          me:null}),{status:200,headers:{'content-type':'application/json'}}))
        :original(resource,options);
      window.__portraitLeaderboardFetch=window.fetch;
      const {loadLeaderboard}=await import('./js/leaderboard-client.mjs');
      await loadLeaderboard({force:true});
    });
    assert.strictEqual(await panel.locator('.chronicle-leaderboard-row').count(),2);
    assert((await panel.innerText()).includes('177'),'real top score should render');
    // Main-menu refresh reflects a new achievement, not mere passage of time.
    await page.evaluate(async()=>{
      const {readRun,writeRun}=await import('./js/run-persistence.mjs');
      const {writePlayerRating}=await import('./js/player-rating.mjs');
      const current=readRun();
      writeRun({...current,gloryV2:{version:2,events:[['battle','ba11e',5]]},journeyStep:50});
      writePlayerRating({power:1600,receipts:[]});
      window.RPChessChronicle.render();
    });
    const initial=await panel.locator('.chronicle-v2-quick strong').first().innerText();
    assert(Number(initial)>0,'first battle award earns live Glory');
    await page.evaluate(async()=>{
      const {readRun,writeRun}=await import('./js/run-persistence.mjs');
      writeRun({...readRun(),journeyStep:60});
      window.RPChessChronicle.render();
    });
    assert.strictEqual(await panel.locator('.chronicle-v2-quick strong').first().innerText(),initial,
      'passing more weeks alone must not award Glory');
    for(const viewport of [{width:1653,height:760},{width:844,height:390},{width:667,height:300}]){
      await page.setViewportSize(viewport);
      const view=await panel.evaluate(root=>({
        visible:getComputedStyle(root).display!=='none',
        own:root.querySelector('.chronicle-v2-quick')?.textContent||'',
        top:root.querySelector('.chronicle-leaderboard-row')?.textContent||''
      }));
      assert(view.visible&&view.own.includes(initial)&&view.top.includes('177'),
        `live Glory and v3 leaderboard at ${viewport.width}x${viewport.height}: ${JSON.stringify(view)}`);
    }
    await page.setViewportSize({width:1653,height:760});
    if(process.env.RPCHESS_FLAG_SCREENSHOT_DIR) {
      const dir=path.resolve(process.env.RPCHESS_FLAG_SCREENSHOT_DIR);
      fs.mkdirSync(dir,{recursive:true});
      await panel.screenshot({path:path.join(dir,'leaderboard-en.png')});
    }
    await setLanguage('ru');
    assert.strictEqual(await panel.locator('h2').innerText(),'Летопись');
    // Existing Chronicle acceptance also verifies the global Goznak font:
    // all text uses Goznak, not just Chronicle, while SVG artwork is untouched.
    const fontPreview=await page.evaluate(async()=>{
      await document.fonts.load("400 32px GoznakUI","Строчные буквы Aa Бб 2026");
      await document.fonts.load("italic 400 32px GoznakUI","Наклонные Aa Бб");
      const family=selector=>{
        const node=document.querySelector(selector);
        return node?getComputedStyle(node).fontFamily:null;
      };
      return {loaded:document.fonts.check("400 32px GoznakUI","Строчные буквы Aa Бб 2026"),
        italic:document.fonts.check("italic 400 32px GoznakUI","Наклонные Aa Бб"),
        body:family('body'),title:family('.chronicle-header h2'),
        subheading:family('.chronicle-v2-profile-copy strong'),
        button:family('.reboot-menu-actions .reboot-button'),
        label:family('.chronicle-section-label'),
        otherTitle:family('.reboot-menu-screen h1')};
    });
    assert(fontPreview.loaded,'global Goznak web font must load');
    assert(fontPreview.italic,'Goznak Oblique web font must load');
    for(const [part,family] of Object.entries(fontPreview)){
      if(part==='loaded'||part==='italic'||family===null)continue;
      assert(family.includes('GoznakUI'),part+' must use global Goznak: '+family);
    }
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
    const identitySubmit=page.locator('[data-player-identity-submit]');
    const identityName=page.locator('[data-player-identity-input]');
    assert.strictEqual(await page.locator('[data-identity-commander][aria-pressed="true"]').count(),0,
      'new Journey must not preselect the Guardian or any other commander');
    assert.strictEqual(await page.locator('[data-identity-commander-image]').isHidden(),true,
      'preview must stay empty until the player explicitly chooses a portrait');
    assert.strictEqual(await identitySubmit.isDisabled(),true,'Continue starts disabled');
    // The empty-state instruction must fit and be centered in the preview on
    // desktop, short landscape and portrait; chosen portraits keep old layout.
    for (const [width,height] of [[1313,641],[844,390],[390,844]]) {
      await page.setViewportSize({width,height});
      const layout=await page.evaluate(()=>{
        const preview=document.querySelector('[data-identity-commander-preview]');
        const title=preview.querySelector('h3');
        const frame=preview.getBoundingClientRect();
        const text=title.getBoundingClientRect();
        return {
          empty:preview.classList.contains('identity-commander-preview--empty'),
          dx:Math.abs((frame.left+frame.right-text.left-text.right)/2),
          dy:Math.abs((frame.top+frame.bottom-text.top-text.bottom)/2),
          contained:text.left>=frame.left-1&&text.right<=frame.right+1&&text.top>=frame.top-1&&text.bottom<=frame.bottom+1,
          fits:title.scrollWidth<=title.clientWidth+1&&title.scrollHeight<=title.clientHeight+1,
          wrapped:getComputedStyle(title).whiteSpace==='normal'
        };
      });
      assert(layout.empty&&layout.contained&&layout.fits&&layout.wrapped&&layout.dx<=5&&layout.dy<=5,
        `empty portrait instruction must be centered and never clipped at ${width}x${height}: ${JSON.stringify(layout)}`);
    }
    await page.setViewportSize({width:1653,height:760});
    await identityName.fill('Тимур');
    assert.strictEqual(await identitySubmit.isDisabled(),true,'name alone cannot start a Journey');
    await page.locator('[data-identity-commander="wanderer_queen"]').click();
    assert.strictEqual(await identitySubmit.isEnabled(),true,'Continue requires both a valid name and an explicit portrait');
    assert.strictEqual(await page.locator('[data-identity-commander-preview]').evaluate(n=>n.classList.contains('identity-commander-preview--empty')),false,
      'the selected portrait must preserve its existing preview layout');
    await identityName.fill('  ');
    assert.strictEqual(await identitySubmit.isDisabled(),true,'removing the name must disable Continue again');
    await identityName.fill('Тимур');
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
    await page.evaluate(()=>window.RPChessPlayerIdentity.close());
    await page.evaluate(()=>window.RPChessPlayerIdentity.open());
    assert.strictEqual(await identityName.inputValue(),'','reopening New Journey clears previous name');
    assert.strictEqual(await page.locator('[data-identity-commander][aria-pressed="true"]').count(),0,
      'reopening New Journey requires a new explicit portrait choice');
    assert.strictEqual(await identitySubmit.isDisabled(),true,'Continue remains disabled on reopening');
    assert.strictEqual(await page.locator('[data-identity-commander-title]').innerText(),'CHOOSE YOUR COMMANDER',
      'empty preview prompt must localize when no portrait is selected');
    await page.evaluate(()=>{
      window.RPChessPlayerIdentity.close();
      // The synthetic signed VK launch is only for the in-page leaderboard
      // submission regression. Do not reload standalone Pages as a fake VK app.
      history.replaceState(null,'',location.pathname);
    });
    await page.reload({waitUntil:'networkidle'});
    assert.strictEqual(await panel.locator('h2').innerText(),'Chronicle','persisted English applies at startup');
    assert.strictEqual(await panel.locator('[data-chronicle-current] .chronicle-v2-profile-copy strong').innerText(),'Тимур');
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
