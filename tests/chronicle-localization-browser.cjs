const assert=require('assert');
const {chromium}=require('playwright');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1653,height:760}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url,{waitUntil:'networkidle'});
    const panel=page.locator('[data-chronicle-panel]');
    await panel.waitFor();
    const setLanguage=language=>page.evaluate(async language=>{const i18n=await import('./js/i18n.mjs');i18n.setLanguage(language);},language);
    await setLanguage('en');
    assert.strictEqual(await panel.locator('h2').innerText(),'Chronicle');
    assert((await panel.innerText()).includes('No active journey'));
    assert((await panel.innerText()).includes('The chronicle is empty'));
    assert(!/[А-Яа-яЁё]/u.test(await panel.innerText()),'empty Chronicle must fully translate');
    await page.evaluate(async()=>{
      const persistence=await import('./js/run-persistence.mjs');
      persistence.writeRun({...persistence.createRun({id:'chronicle-language',playerName:'Тимур'}),journeyStep:12});
      localStorage.setItem('rpchess.reboot.v1.chronicle',JSON.stringify({schemaVersion:1,history:[{runId:'best-language',playerName:'Рагнар',week:35,power:900,completedAt:1000}]}));
      window.RPChessChronicle.render();
    });
    for(const text of ['CURRENT JOURNEY','BEST JOURNEY','POWER','WEEK','HEROES IN RANKS','GLORY'])assert((await panel.innerText()).includes(text),text);
    assert.strictEqual(await panel.locator('[data-chronicle-current] h3').innerText(),'Тимур');
    assert.strictEqual(await panel.locator('[data-chronicle-best] h3').innerText(),'Рагнар');
    assert(!/[А-Яа-яЁё]/u.test((await panel.innerText()).replaceAll('Тимур','').replaceAll('Рагнар','')),'only player names may retain Cyrillic');
    await setLanguage('ru');
    assert.strictEqual(await panel.locator('h2').innerText(),'Летопись');
    assert((await panel.innerText()).includes('ГЕРОЕВ В СТРОЮ'));
    await page.evaluate(()=>window.RPChessPlayerIdentity.open());
    await page.locator('[data-player-identity-input]').fill('Тимур');
    await setLanguage('en');
    assert.strictEqual(await page.locator('#player-identity-title').innerText(),'Who are you, warrior?');
    assert.strictEqual(await page.locator('[data-player-identity-input]').inputValue(),'Тимур','language changes preserve entered names');
    assert.strictEqual(await page.locator('[data-player-identity-close]').getAttribute('aria-label'),'Close');
    await page.evaluate(()=>window.RPChessPlayerIdentity.close());
    await page.reload({waitUntil:'networkidle'});
    assert.strictEqual(await panel.locator('h2').innerText(),'Chronicle','persisted English applies at startup');
    assert.strictEqual(await panel.locator('[data-chronicle-current] h3').innerText(),'Тимур');
    assert.deepStrictEqual(errors,[]);
    console.log('Chronicle empty/populated states, RU/EN changes, player names and English reload: PASS');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
