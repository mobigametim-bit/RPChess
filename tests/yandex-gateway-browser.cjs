/* Test feature JS in actual github.io-origin Chromium without publishing game files. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const base='https://mobigametim-bit.github.io/RPChess/';
const gateway='https://d5ds3hf0ei1mlkgjrnlm.d8epmcec.apigw.yandexcloud.net';
const names=['api-route.mjs','profile-client.mjs','tournament-app.mjs'];
const modules=new Map(names.map(n=>[n,fs.readFileSync(path.resolve(__dirname,'../game/js',n),'utf8')]));
async function main(){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:900}});
 const page=await context.newPage(),patched=new Set(),requests=[],errors=[];
 try{
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',r=>{
   if(r.url().startsWith(gateway+'/profile/')||r.url().startsWith(gateway+'/tournament/')){
    requests.push({method:r.method(),path:new URL(r.url()).pathname});
   }
  });
  await page.route('**/RPChess/js/*',async route=>{
   const n=new URL(route.request().url()).pathname.split('/').pop();
   if(modules.has(n)){patched.add(n);return route.fulfill({status:200,contentType:'text/javascript',body:modules.get(n)});}
   return route.continue();
  });
  const nav=await page.goto(base+'?rpchess_profile=1&rpchess_api_route=yandex&gateway_test=1',
    {waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(nav.status(),200,'GitHub Pages unavailable');
  await page.locator('[data-game-loading]').waitFor({state:'hidden',timeout:60000});
  await page.waitForFunction(()=>['ready','offline'].includes(globalThis.RPChessProfileStatus?.status),null,{timeout:45000});
  const state=await page.evaluate(()=>({profile:globalThis.RPChessProfileStatus?.status,
    reason:globalThis.RPChessProfileStatus?.reason||'',
    menu:!!document.querySelector('[data-reboot-foundation]')}));
  console.log('GAME LOAD:',JSON.stringify(state));
  assert.equal(state.profile,'ready');
  assert(state.menu);
  await page.locator('[data-tournament-open]').click({timeout:15000});
  await page.locator('[data-tour-action="invite"]').waitFor({state:'visible',timeout:15000});
  await page.locator('[data-tour-action="invite"]').click();
  await page.waitForFunction(()=>/^[A-Z0-9]{6}$/.test(
   document.querySelector('.tournament-room-code')?.textContent?.trim()||''
  ),null,{timeout:35000});
  for(const n of names)assert(patched.has(n),'missing patched module '+n);
  assert(requests.some(x=>x.path==='/profile/v1/session'&&x.method==='POST'),'Profile session not via Yandex');
  assert(requests.some(x=>x.path==='/tournament/v1/session'&&x.method==='POST'),'Tournament session not via Yandex');
  assert(requests.some(x=>x.path==='/tournament/v1/room/create'&&x.method==='POST'),'Room not via Yandex');
  console.log('PATCHED',JSON.stringify([...patched]));
  console.log('YANDEX API PATHS',JSON.stringify(requests));
  console.log('JS ERRORS',JSON.stringify(errors.slice(0,5)));
  assert.equal(errors.length,0,'JavaScript errors in game browser');
  await page.locator('[data-tour-action="cancel"]').click().catch(()=>{});
  console.log('CHROMIUM REAL GAME MENU, PROFILE AND PRIVATE ROOM OVER YANDEX PASS');
  // Simulate an ISP where direct workers.dev /health fails, while the
  // published GitHub Pages HTML/CSS/JS and Yandex API remain reachable.
  const blocked=await browser.newContext({serviceWorkers:'block',viewport:{width:1360,height:850}});
  const probe=await blocked.newPage(),blockedApi=[];
  probe.on('request',r=>{
   if(r.url().startsWith(gateway+'/profile/')||r.url().startsWith(gateway+'/tournament/'))
    blockedApi.push(new URL(r.url()).pathname);
  });
  await probe.route('**/RPChess/js/*',async route=>{
   const name=new URL(route.request().url()).pathname.split('/').pop();
   return modules.has(name)?route.fulfill({status:200,contentType:'text/javascript',body:modules.get(name)}):route.continue();
  });
  await probe.route('**/health',route=>{
   return new URL(route.request().url()).hostname.endsWith('.workers.dev')
     ?route.abort('failed'):route.continue();
  });
  await probe.goto(base+'?rpchess_profile=1&rpchess_api_route=auto&gateway_test=blocked-worker',
   {waitUntil:'domcontentloaded',timeout:45000});
  await probe.waitForFunction(()=>['ready','offline'].includes(globalThis.RPChessProfileStatus?.status),
   null,{timeout:60000});
  const result=await probe.evaluate(async()=>({
   profile:globalThis.RPChessProfileStatus?.status,
   route:await (await import('./js/api-route.mjs')).chosenRoute()
  }));
  assert.equal(result.profile,'ready','Guest profile failed when direct Workers blocked');
  assert.equal(result.route,'yandex','Auto selector did not switch to Yandex');
  assert(blockedApi.includes('/profile/v1/session'),'Auto route did not use Yandex Profile');
  console.log('SIMULATED RUSSIAN ISP: direct workers.dev blocked, automatic Yandex fallback PASS');
  await blocked.close();
 }catch(e){
  console.error('FAIL',String(e));
  console.error('REQUESTS',JSON.stringify(requests));
  console.error('PATCHED',JSON.stringify([...patched]));
  console.error('ERRORS',JSON.stringify(errors.slice(0,8)));
  throw e;
 }finally{await context.close();await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
