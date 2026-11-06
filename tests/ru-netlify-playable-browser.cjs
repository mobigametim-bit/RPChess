/* Real Chromium smoke against isolated, PUBLIC Netlify playable build.
 * Reproduces a stuck loading screen; deliberately avoids public matchmaking.
 * No tokens, player identities or HTTP headers are logged.
 */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const url='https://rpchess-ru-api-gateway.netlify.app/play/?rpchess_profile=1&rpchess_api_route=proxy&check=boot';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const failures=[],errors=[];
  page.on('requestfailed',req=>{if(failures.length<25)failures.push(new URL(req.url()).pathname+': '+(req.failure()?.errorText||'failed'));});
  page.on('pageerror',e=>{if(errors.length<25)errors.push(e.message.slice(0,300));});
  page.on('response',r=>{if(r.status()>=400&&failures.length<25)
    failures.push('HTTP '+r.status()+' '+new URL(r.url()).pathname);});
  const nav=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(nav.status(),200,'Netlify playable entry');
  let booted=false;
  try{
   await page.locator('[data-game-loading]').waitFor({state:'hidden',timeout:50000});
   await page.locator('[data-tournament-open]').waitFor({state:'visible',timeout:6000});
   booted=true;
  }catch{}
  const state=await page.evaluate(()=>({
   overlay:document.querySelector('[data-game-loading]')?.hidden,
   label:document.querySelector('[data-game-loading-label]')?.textContent,
   profile:globalThis.RPChessProfileStatus?.status,
   route:document.querySelector('[data-tournament-screen]')?.hidden,
   loaded:document.readyState
  }));
  console.log('STARTUP',JSON.stringify(state));
  console.log('ERROR COUNTS',failures.length,errors.length);
  if(failures.length)console.log('FAILED PATHS',JSON.stringify(failures.slice(0,15)));
  if(errors.length)console.log('SCRIPT ERRORS',JSON.stringify(errors.slice(0,15)));
  assert(booted,'Real Netlify playable game did not finish loading');
  await page.locator('[data-tournament-open]').click();
  await page.locator('[data-tournament-screen] .tournament-setup').waitFor({state:'visible',timeout:14000});
  console.log('Real Chromium startup + Tournament menu PASS');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
