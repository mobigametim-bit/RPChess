const assert=require('assert');
const {chromium}=require('playwright');
const {startNewRun,waitForVisible}=require('./browser-test-helpers.cjs');

const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const RUN_KEY='rpchess.reboot.v1.run';

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const source=await browser.newPage();
    const startupErrors=[];
    source.on('pageerror',error=>startupErrors.push(String(error.stack||error)));
    source.on('console',message=>{if(message.type()==='error')
      startupErrors.push('console: '+message.text());});
    await source.goto(url,{waitUntil:'networkidle'});
    try{
      await startNewRun(source,{playerName:'Cloud Tester'});
    }catch(error){
      throw new Error('Cloud new-run startup diagnostics: '+JSON.stringify({
        pageErrors:startupErrors.slice(-12),
        activeScripts:await source.evaluate(()=>({
          readyState:document.readyState,
          menu:!!globalThis.RPChessRebootFoundation,
          gameLoading:document.querySelector('[data-game-loading]')?.hidden,
          modalHidden:document.querySelector('[data-journey-choice-modal]')?.hidden
        })).catch(()=>null)
      })+' | '+String(error));
    }
    const run=await source.evaluate(key=>localStorage.getItem(key),RUN_KEY);
    assert(run,'source device must have an active run');
    await source.close();

    const phone=await browser.newPage({viewport:{width:844,height:390}}),errors=[];
    phone.on('pageerror',error=>errors.push(String(error.stack||error)));
    await phone.addInitScript(()=>{
      let ready;
      Object.defineProperty(window,'RPChessCloudReady',{
        configurable:true,
        get(){return ready;},
        set(_value){ready=new Promise(resolve=>{window.__finishCloudRestore=resolve;});}
      });
    });
    await phone.goto(url,{waitUntil:'networkidle'});
    const button=phone.locator('[data-continue-run]');
    assert.strictEqual(await phone.evaluate(key=>localStorage.getItem(key),RUN_KEY),null);
    assert.strictEqual(await button.isDisabled(),false,'Journey icon always allows starting a new run');
    await phone.evaluate(([key,saved])=>{
      localStorage.setItem(key,saved);
      window.__finishCloudRestore({status:'cloud'});
    },[RUN_KEY,run]);
    await phone.waitForFunction(()=>document.querySelector('[data-continue-run]')?.dataset.journeyActive==='true');
    await button.click();
    await phone.locator('[data-journey-choice-modal]:not([hidden]) [data-journey-continue]').click();
    await waitForVisible(phone,'[data-roster-screen]:not([hidden])','Roster after cloud restore');
    assert.deepStrictEqual(errors,[]);
    await phone.close();
    console.log('Delayed cloud save restores Continue and opens the existing run: PASS');
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1});
