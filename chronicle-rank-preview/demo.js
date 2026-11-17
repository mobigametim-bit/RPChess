/* TEST-ONLY file. Copied to dist on isolated Chronicle QA Worker only.
   Explicit opt-in: ?chronicle_qa=1&rpchess_profile=1&rpchess_api_route=direct.
   DO NOT import into /game or production. No HTTP traffic to real Profile D1. */
(()=>{
 const qs=new URLSearchParams(location.search);
 if(qs.get('chronicle_qa')!=='1')return;
 const id='00000000-0000-4000-8000-000000000215';
 const key='rpchess.profile.v1.web.'+id+'.';
 const token='Q'.repeat(43);
 const archived={
  runId:'qa-completed-run-215',scoreVersion:2,playerName:'Тестовый воин',
  commanderId:'oathkeeper',adventure:249,kingdom:30,
  achievementCount:9,glory:373,week:71,day:72,power:898,
  territories:12,outposts:1,settlements:1,
  endReason:'king_dead',completedAt:Date.now()-60000,
  stats:{skirmishWins:8,battleWins:3,caravansDefended:2,puzzlesSolved:2,eventsResolved:7}
 };
 const profile={id,provider:'web',revision:0,migratedVK:false,
  snapshot:{schemaVersion:1}};
 let activeRank=false;
 const state={isDemo:true,attemptedRetry:false,syncWrites:0,refreshRequests:0};
 globalThis.RPChessChronicleQADemo=state;
 try{
  localStorage.setItem('rpchess.profile.cached-id.web',id);
  localStorage.setItem('rpchess.profile.auth.web.v1',token);
  localStorage.setItem(key+'rpchess.reboot.v1.chronicle',JSON.stringify({schemaVersion:1,history:[archived]}));
  localStorage.setItem(key+'rpchess.reboot.v1.player-rating',JSON.stringify({schemaVersion:1,power:898,receipts:[]}));
  localStorage.setItem(key+'rpchess.reboot.v1.settings',JSON.stringify({language:qs.get('lang')==='en'?'en':'ru'}));
 }catch(error){console.error('Chronicle QA storage unavailable',error);}
 document.addEventListener('click',event=>{
  if(event.target?.closest?.('[data-chronicle-rank-retry]')){
   activeRank=true;state.attemptedRetry=true;
  }
 },true);
 const nativeFetch=globalThis.fetch.bind(globalThis);
 globalThis.fetch=(input,init={})=>{
  let u;try{u=new URL(typeof input==='string'?input:input.url,location.href);}catch{return nativeFetch(input,init);}
  const onProfile=u.hostname==='rpchess-profile-preview.mobigametim.workers.dev';
  if(!onProfile)return nativeFetch(input,init);
  const method=(init.method||(typeof input==='object'?input.method:null)||'GET').toUpperCase();
  let status=200,body;
  const noRank={top:[],me:null,viewerAuthenticated:true,scoreVersion:2};
  const ranked={top:[{rank:1,name:'Тестовый воин',glory:373,commanderId:'oathkeeper'}],
   me:{rank:1,name:'Тестовый воин',glory:373,commanderId:'oathkeeper',day:72,power:898},
   viewerAuthenticated:true,scoreVersion:2};
  switch(u.pathname){
   case '/health':body={ok:true,service:'rpchess-chronicle-qa-demo'};break;
   case '/v1/session':
    if(method==='POST')body={token,profile:{...profile}};
    else{status=404;body={error:'method_not_allowed'};}break;
   case '/v1/profile':
    if(method==='PUT'){state.syncWrites++;profile.revision++;body={profile:{...profile}};}
    else body={profile:{...profile}};break;
   case '/v1/leaderboard':body=activeRank?ranked:noRank;break;
   case '/v1/leaderboard/refresh':
    state.refreshRequests++;
    body=activeRank?ranked:noRank;break;
   default:status=404;body={error:'qa_route_not_found'};
  }
  return Promise.resolve(new Response(JSON.stringify(body),{
   status,headers:{'content-type':'application/json'}
  }));
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const badge=document.createElement('aside');
  badge.setAttribute('data-chronicle-qa-notice','');
  badge.textContent='QA DEMO — ТЕСТОВЫЕ ДАННЫЕ · НЕТ ЗАПИСИ В ОНЛАЙН-РЕЙТИНГ';
  badge.style.cssText='position:fixed;z-index:100000;top:0;left:0;right:0;padding:4px 12px;text-align:center;background:#422400;color:#ffe8a8;border-bottom:1px solid #f0b45d;font:700 11px/1.3 system-ui;pointer-events:none';
  document.body.append(badge);
 });
})();
