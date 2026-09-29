const assert=require('assert');
const {chromium}=require('playwright');
const {startNewRun,waitForVisible}=require('./browser-test-helpers.cjs');

const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const RUN_KEY='rpchess.reboot.v1.run';

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const source=await browser.newPage();
    await source.goto(url,{waitUntil:'networkidle'});
    await startNewRun(source,{playerName:'Cloud Tester'});
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
    assert.strictEqual(await button.isDisabled(),true,'Continue starts disabled before cloud restore');
    await phone.evaluate(([key,saved])=>{
      localStorage.setItem(key,saved);
      window.__finishCloudRestore({status:'cloud'});
    },[RUN_KEY,run]);
    await phone.waitForFunction(()=>!document.querySelector('[data-continue-run]').disabled);
    await button.click();
    await waitForVisible(phone,'[data-roster-screen]:not([hidden])','Roster after cloud restore');
    assert.deepStrictEqual(errors,[]);
    await phone.close();
    console.log('Delayed cloud save restores Continue and opens the existing run: PASS');
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1});
