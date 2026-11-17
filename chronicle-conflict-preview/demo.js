/* TEST-ONLY: injected into isolated Chronicle conflict QA dist, never game/ or production.
   Requires ?chronicle_conflict_qa=1&rpchess_profile=1&rpchess_api_route=direct.
   This demo does not send any Profile API request to D1. */
(()=>{
 const qs=new URLSearchParams(location.search);
 if(qs.get('chronicle_conflict_qa')!=='1')return;
 const id='00000000-0000-4000-8000-000000000216';
 const key='rpchess.profile.v1.web.'+id+'.';
 const token='Q'.repeat(43);
 const localBest={runId:'qa-completed-373',scoreVersion:2,
  playerName:'Тестовый воин',commanderId:'oathkeeper',
  adventure:279,kingdom:0,achievementCount:20,
  week:71,day:72,power:898,glory:373,completedAt:Date.now()-20000,
  endReason:'king_dead'};
 const initialServer={schemaVersion:1,run:null,rating:{schemaVersion:1,power:780,receipts:[]},
  chronicle:{schemaVersion:1,history:[
    {runId:'qa-older-server-run',playerName:'Другой поход',week:12,power:780,glory:11,completedAt:1}
  ]}};
 let profile={id,provider:'web',revision:3,migratedVK:false,snapshot:initialServer};
 const state={synthetic:true,attemptedRecovery:false,syncWrites:0,
  refreshRequests:0,remotePower:780,remoteHistory:1};
 globalThis.RPChessChronicleConflictQADemo=state;
 try{
  localStorage.setItem('rpchess.profile.cached-id.web',id);
  localStorage.setItem('rpchess.profile.auth.web.v1',token);
  localStorage.setItem(key+'rpchess.reboot.v1.profile-revision','2');
  localStorage.setItem(key+'rpchess.reboot.v1.profile-fingerprint','before-the-completed-journey');
  localStorage.setItem(key+'rpchess.reboot.v1.chronicle',JSON.stringify({schemaVersion:1,history:[localBest]}));
  localStorage.setItem(key+'rpchess.reboot.v1.player-rating',JSON.stringify({schemaVersion:1,power:898,receipts:[]}));
  localStorage.setItem(key+'rpchess.reboot.v1.tutorial',JSON.stringify({schemaVersion:1,activated:true,dismissed:{welcome:true,identity:true,chronicle:true}}));
  localStorage.setItem(key+'rpchess.reboot.v1.settings',JSON.stringify({language:qs.get('lang')==='en'?'en':'ru'}));
 }catch(e){console.error('QA localStorage unavailable',e);}
 document.addEventListener('click',event=>{
  if(event.target?.closest?.('[data-chronicle-conflict-recovery]'))state.attemptedRecovery=true;
 },true);
 const nativeFetch=globalThis.fetch.bind(globalThis);
 globalThis.fetch=(input,init={})=>{
  let u;try{u=new URL(typeof input==='string'?input:input.url,location.href);}
  catch{return nativeFetch(input,init);}
  if(u.hostname!=='rpchess-profile-preview.mobigametim.workers.dev')
   return nativeFetch(input,init);
  const method=(init.method||(typeof input==='object'?input.method:null)||'GET').toUpperCase();
  let status=200,body;
  const hasBest=profile.snapshot.chronicle?.history?.some(r=>r.runId===localBest.runId);
  const board=hasBest?{top:[{rank:1,name:'Тестовый воин',glory:373}],
   me:{rank:1,name:'Тестовый воин',glory:373,power:898},
   viewerAuthenticated:true,scoreVersion:2}
   :{top:[],me:null,viewerAuthenticated:true,scoreVersion:2};
  switch(u.pathname){
   case '/health':body={ok:true,service:'rpchess-conflict-synthetic'};break;
   case '/v1/session':
    body=method==='POST'?{token,profile:{...profile}}:{error:'invalid_method'};
    if(method!=='POST')status=405;
    break;
   case '/v1/profile':
    if(method==='GET')body={profile:{...profile}};
    else if(method==='PUT'){
     state.syncWrites++;
     const data=JSON.parse(init.body||'{}');
     if(data.revision!==profile.revision){status=409;body={error:'revision_conflict'};}
     else if(data.snapshot?.rating?.power!==780
       ||data.snapshot?.chronicle?.history?.[0]?.runId!=='qa-older-server-run'){
      status=422;body={error:'qa_remote_progress_must_be_preserved'};
     }else{
      profile={...profile,revision:profile.revision+1,snapshot:data.snapshot};
      state.remotePower=profile.snapshot.rating.power;
      state.remoteHistory=profile.snapshot.chronicle.history.length;
      body={profile:{...profile}};
     }
    }else{status=405;body={error:'invalid_method'};}
    break;
   case '/v1/leaderboard':body=board;break;
   case '/v1/leaderboard/refresh':state.refreshRequests++;body=board;break;
   default:status=404;body={error:'synthetic_route_missing'};
  }
  return Promise.resolve(new Response(JSON.stringify(body),{status,
   headers:{'content-type':'application/json'}}));
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const badge=document.createElement('aside');
  badge.dataset.chronicleConflictQaNotice='';
  badge.textContent='QA DEMO — КОНФЛИКТ СОХРАНЕНИЙ · РЕЙТИНГ ТЕСТОВЫЙ';
  badge.style.cssText='position:fixed;z-index:100000;top:0;left:0;right:0;padding:4px 12px;text-align:center;background:#422400;color:#ffe8a8;border-bottom:1px solid #f0b45d;font:700 11px/1.3 system-ui;pointer-events:none';
  document.body.append(badge);
 });
})();
