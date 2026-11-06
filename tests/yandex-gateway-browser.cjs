/* Test feature JS in actual github.io-origin Chromium without publishing game files. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const base='https://mobigametim-bit.github.io/RPChess/';
const gateway='https://d5ds3hf0ei1mlkgjrnlm.d8epmcec.apigw.yandexcloud.net';
const names=['api-route.mjs','profile-client.mjs','tournament-app.mjs'];
const modules=new Map(names.map(n=>[n,fs.readFileSync(path.resolve(__dirname,'../game/js',n),'utf8')]));
// Synthetic VK host acceptance: initially bad signed launch is rejected, then
// the host provides a fresh signed launch on explicit Retry. No real user,
 // real VK secret, public matchmaking or D1 mutation is involved.
async function verifyVKRecovery(browser){
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:900}});
 const page=await context.newPage();
 const pageErrors=[],apiRequests=[];
 page.on('pageerror',e=>pageErrors.push(String(e)));
 const origin='https://mobigametim-bit.github.io';
 const profileHost='rpchess-profile-preview.mobigametim.workers.dev';
 const tournamentHost='rpchess-tournament-profile-preview.mobigametim.workers.dev';
 const profileId='00000000-0000-4000-8000-000000000123';
 const profileToken='P'.repeat(43),tournamentToken='T'.repeat(48);
 const snapshot={schemaVersion:1};
 const profileResult={id:profileId,provider:'vk',revision:0,migratedVK:false,snapshot};
 const cors={
  'Access-Control-Allow-Origin':origin,
  'Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers':'Authorization, Content-Type',
  'Content-Type':'application/json'
 };
 let verifiedLaunches=0,queueJoins=0;
 await page.route('**/v1/**',route=>{
  const request=route.request(),url=new URL(request.url());
  if(![profileHost,tournamentHost].includes(url.hostname))return route.continue();
  const isProfile=url.hostname===profileHost,method=request.method(),pathname=url.pathname;
  const reply=(status,body)=>route.fulfill({status,headers:cors,body:JSON.stringify(body)});
  if(method==='OPTIONS')return route.fulfill({status:204,headers:cors,body:''});
  apiRequests.push({service:isProfile?'profile':'tournament',method,pathname});
  if(isProfile){
   if(pathname==='/v1/session'&&method==='POST'){
    const launch=JSON.parse(request.postData()||'{}').vkLaunch||'';
    if(!new URLSearchParams(launch).get('sign')?.startsWith('fresh'))
     return reply(401,{error:'vk_signature_required'});
    verifiedLaunches++;
    return reply(200,{token:profileToken,profile:profileResult});
   }
   if(pathname==='/v1/profile'&&method==='PUT')
    return reply(200,{profile:{...profileResult,revision:1}});
   if(pathname==='/v1/profile'&&method==='GET')
    return reply(200,{profile:profileResult});
   if(pathname==='/v1/leaderboard')
    return reply(200,{top:[],me:null,viewerAuthenticated:true});
   if(pathname==='/v1/leaderboard/refresh')
    return reply(200,{top:[],me:null,viewerAuthenticated:true});
  }else{
   if(pathname==='/v1/session')return reply(200,{token:tournamentToken,kind:'vk'});
   if(pathname==='/v1/profile')return reply(200,{power:500,ratedGames:0});
   if(pathname==='/v1/queue/join'){
    queueJoins++;return reply(200,{status:'waiting'});
   }
   if(pathname==='/v1/queue/status')return reply(200,{status:'waiting'});
   if(pathname==='/v1/queue/cancel')return reply(200,{status:'not_queued'});
  }
  return reply(404,{error:'test_unknown_route'});
 });
 try{
  const now=Math.floor(Date.now()/1000);
  const first=base+'?rpchess_profile=1&rpchess_api_route=direct&vk_app_id=54754579&vk_user_id=777&vk_ts='+now+'&sign=bad-signed-launch';
  await page.goto(first,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>globalThis.RPChessProfileStatus?.status==='offline',null,{timeout:30000});
  assert.equal(verifiedLaunches,0,'VK backend must reject the first invalid signature');
  // A later valid VK host launch is available. Client must not keep the
  // rejected bootPromise forever after the user explicitly clicks Search.
  await page.evaluate(()=>{
   const url=new URL(location.href);url.searchParams.set('sign','fresh-signed-launch');
   history.replaceState(null,'',url.toString());
  });
  await page.locator('[data-game-loading]').waitFor({state:'hidden',timeout:30000});
  await page.locator('[data-tournament-open]').click();
  await page.locator('[data-tour-action="search"]').click();
  await page.waitForFunction(()=>globalThis.RPChessProfileStatus?.status==='ready'&&
   globalThis.RPChessTournament?.page==='search'&&
   !!document.querySelector('.tournament-spinner'),null,{timeout:30000});
  assert.equal(verifiedLaunches,1,'Retry must submit fresh signed VK data exactly once');
  assert.equal(queueJoins,1,'Verified VK identity must reach the public queue');
  assert(apiRequests.some(x=>x.service==='tournament'&&x.pathname==='/v1/session'));
  assert.equal(pageErrors.length,0,'VK synthetic browser JS errors '+pageErrors.join('|'));
  // A failed legacy VK cloud read from this standalone Chromium browser must
  // not revoke an otherwise server-verified VK identity.
  const identity=await page.evaluate(()=>({status:globalThis.RPChessProfileStatus?.status,
   migration:globalThis.RPChessProfileMigration?.status}));
  assert.equal(identity.status,'ready');
  assert(['bridge-unavailable','no-legacy-stats','previously-imported-no-source','deferred'].includes(identity.migration),
   'Legacy migration must degrade independently: '+JSON.stringify(identity));
  await page.locator('[data-tour-action="cancel"]').click();
  console.log('VK PROFILE RECOVERY PASS: invalid launch denied, fresh signed retry accepted, legacy Bridge unavailable but Tournament queue entered');
 }catch(error){
  const status=await page.evaluate(()=>({
   profile:globalThis.RPChessProfileStatus,
   tournament:globalThis.RPChessTournament?.page,
   text:document.querySelector('[data-tournament-screen]')?.innerText?.().slice(0,700)
  })).catch(()=>null);
  console.error('VK RECOVERY DIAGNOSTIC',JSON.stringify({status,verifiedLaunches,queueJoins,
   apiRequests:apiRequests.slice(-20),pageErrors:pageErrors.slice(-10)}));
  throw error;
 }finally{await context.close();}
}

async function main(){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 if(process.env.RPCHESS_VK_AUTH_MOCK_ONLY==='1'){
  try{await verifyVKRecovery(browser);}finally{await browser.close();}
  return;
 }
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
  await page.locator('[data-tour-action="cancel"]').click();
  console.log('CHROMIUM REAL GAME MENU, PROFILE AND PRIVATE ROOM OVER YANDEX PASS');

  // Regression: on a failed public queue join the UI must not silently bounce
  // back to setup. A retry can recover without joining the live public lobby.
  let queueJoins=0,notifySecondJoin;
  const failedQueueRequests=[];
  page.on('requestfailed',req=>{if(req.url().includes('/tournament/v1/queue/'))failedQueueRequests.push({url:new URL(req.url()).pathname,method:req.method(),failure:req.failure()});});
  const secondJoin=new Promise(resolve=>{notifySecondJoin=resolve;});
  await page.route('**/tournament/v1/queue/join',route=>{
   const cors={
    'Access-Control-Allow-Origin':'https://mobigametim-bit.github.io',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'Authorization, Content-Type'
   };
   if(route.request().method()!=='POST')return route.continue();
   queueJoins++;
   if(queueJoins===2)notifySecondJoin();
   return route.fulfill({
    status:queueJoins===1?503:200,headers:{...cors,'Content-Type':'application/json'},
    body:JSON.stringify(queueJoins===1?{error:'qa_queue_temporarily_unavailable'}:{status:'waiting'})
   });
  });
  await page.locator('[data-tour-action="search"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-tour-action="search"]')
    ?.textContent?.includes('Повторить')&&globalThis.RPChessTournament?.page==='search',
    null,{timeout:35000});
  const errorView=await page.locator('[data-tournament-screen]').innerText();
  console.log('MATCHMAKING ERROR VIEW:',JSON.stringify({errorView,queueJoins,failedQueueRequests,profile:await page.evaluate(()=>({status:globalThis.RPChessProfileStatus?.status}))}));
  assert(errorView.includes('HTTP 503: qa_queue_temporarily_unavailable'),
   'Queue failure detail must remain visible on a dedicated retry screen');
  // Simulate a lost response after the Worker accepted the first join:
  // retry MUST consult read-only queue/status before sending any new join.
  let queueStatusReads=0;
  await page.route('**/tournament/v1/queue/status',route=>{
   if(route.request().method()!=='POST')return route.continue();
   queueStatusReads++;
   return route.fulfill({status:200,
    headers:{'Access-Control-Allow-Origin':'https://mobigametim-bit.github.io',
     'Access-Control-Allow-Headers':'Authorization, Content-Type',
     'Content-Type':'application/json'},
    body:JSON.stringify({status:'waiting'})});
  });
  await page.locator('[data-tour-action="search"]').click();
  await page.waitForFunction(()=>globalThis.RPChessTournament?.page==='search'
    &&document.querySelector('.tournament-spinner')
    &&!document.querySelector('[data-tour-action="search"]'),
    null,{timeout:35000});
  assert(queueStatusReads>=1,'Retry must inspect server queue after an ambiguous 503');
  assert.equal(queueJoins,1,'Ambiguous join must not be sent twice');
  await page.locator('[data-tour-action="cancel"]').click();
  await page.locator('[data-tour-action="search"]').click();
  await secondJoin;
  assert.equal(queueJoins,2,'A genuinely new search can create a new join');
  await page.locator('[data-tour-action="cancel"]').click();
  console.log('PUBLIC MATCHMAKING: AMBIGUOUS 503, STATUS RECOVERY, NO DUPLICATE JOIN, NEW SEARCH PASS');
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
