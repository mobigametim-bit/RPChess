/* Synthetic Tournament ranked-win QA only. Inject into isolated dist HTML;
   never import from game/ or deploy to canonical Profile/Tournament Workers. */
(()=>{
 const query=new URLSearchParams(location.search);
 if(query.get('tournament_shards_qa')!=='1')return;
 const matchId='00000000-0000-4000-8000-000000000217';
 const token='Q'.repeat(43);
 const state={demo:true,queueJoins:0,matchReads:0,realAPICalls:0};
 globalThis.RPChessTournamentShardsQADemo=state;
 try{
  localStorage.setItem('rpchess.reboot.v1.tutorial',JSON.stringify({
   schemaVersion:1,activated:true,dismissed:{welcome:true,identity:true,chronicle:true}
  }));
  localStorage.setItem('rpchess.reboot.v1.player-rating',JSON.stringify({
   schemaVersion:1,power:500,receipts:[]
  }));
  localStorage.removeItem('rpchess.reboot.v1.arena');
 }catch(e){console.error('Tournament shard QA seed failed',e);}
 const native=globalThis.fetch.bind(globalThis);
 globalThis.fetch=(input,options={})=>{
  let u;try{u=new URL(typeof input==='string'?input:input.url,location.href);}
  catch{return native(input,options);}
  if(u.hostname!=='rpchess-tournament-profile-preview.mobigametim.workers.dev')
   return native(input,options);
  const method=(options.method||(typeof input==='object'?input.method:null)||'GET').toUpperCase();
  let status=200,body;
  const score={id:'tournament:'+matchId+':w',before:500,after:516,
    delta:16,opponentElo:500,result:1,shards:16};
  const match={status:'finished',matchId,playerColor:'w',rated:true,
   players:[
    {color:'w',name:'QA winner',power:500,displayPower:500,race:'humans',commanderId:'pilgrim'},
    {color:'b',name:'QA opponent',power:500,displayPower:500,race:'orcs',commanderId:'ash_regent'}
   ],moves:[],turn:'w',remaining:{w:600000,b:599000},
   result:{kind:'resign',winner:'w'},rating:score,serverTime:Date.now()};
  switch(u.pathname){
   case '/health':body={ok:true,service:'tournament-qa'};break;
   case '/v1/session':
    if(method==='GET'){status=405;body={error:'method_not_allowed'};}
    else body={token,ranked:true,kind:'vk',name:'QA winner'};
    break;
   case '/v1/profile':body={ranked:true,kind:'vk',power:500,ratedGames:0};break;
   case '/v1/queue/status':body={status:'not_queued'};break;
   case '/v1/queue/join':
    state.queueJoins++;body={status:'matched',matchId,rated:true};break;
   case '/v1/queue/cancel':body={status:'cancelled'};break;
   case '/v1/match/'+matchId+'/snapshot':state.matchReads++;body=match;break;
   default:status=404;body={error:'unknown_synthetic_route'};
  }
  return Promise.resolve(new Response(JSON.stringify(body),{
   status,headers:{'content-type':'application/json'}
  }));
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const badge=document.createElement('aside');
  badge.dataset.tournamentShardsQaNotice='';
  badge.textContent='QA DEMO — +16 ELO → +16 ОСКОЛКОВ · РЕЙТИНГ ИГРОВОЙ, НЕ НАСТОЯЩИЙ';
  badge.style.cssText='position:fixed;z-index:100000;top:0;left:0;right:0;background:#452900;color:#ffdfa8;text-align:center;font:700 11px/1.3 system-ui;padding:4px;pointer-events:none';
  document.body.append(badge);
 });
})();