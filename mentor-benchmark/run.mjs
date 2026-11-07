/* Controlled, one-time benchmark: 72 single-model calls, <=600 total budget.
 * Only runs from GitHub Actions with an ephemeral, non-logged secret.
 * Output is a JSON artifact and compact stdout summary; no API keys.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const API='https://rpchess-mentor-api-preview.mobigametim.workers.dev/_internal/benchmark';
const ALL_MODELS=[
 'deepseek-ai/DeepSeek-V4-Flash-0731',
 'MiniMaxAI/MiniMax-M2.7','zai-org/GLM-5.3-Flash'
];
const MODELS=(process.env.BENCHMARK_MODELS||ALL_MODELS.join(',')).split(',');
assert(MODELS.every(m=>ALL_MODELS.includes(m)));
const VARIANTS=(process.env.BENCHMARK_VARIANTS||'baseline,fast,schema').split(',');
assert(VARIANTS.every(v=>['baseline','fast','schema','optimized','balanced'].includes(v)));
const N=Number(process.env.BENCHMARK_PER_CELL||8);
assert(Number.isInteger(N)&&N>0&&N<=30);
assert(N*MODELS.length*VARIANTS.length<=600);
const secret=(await fs.readFile(process.env.MENTOR_BENCHMARK_TOKEN_FILE,'utf8')).trim();
assert(secret.length>=32);
const payload={
 version:1,language:'ru',
 beforeFen:'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq e6 0 2',
 afterFen:'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2',
 uci:'g2g4',grade:'blunder',
 before:{cp:90,depth:11,bestMove:'b1c3'},
 after:{cp:200,depth:10,pv:['d8h4']}
};
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function percentile(items,p){
 if(!items.length)return null;
 const sorted=[...items].sort((a,b)=>a-b);
 return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))];
}
// Wait until the newly-provisioned short-lived Worker secret is visible.
 // This sends malformed JSON to the authenticated endpoint and costs NO model calls.
let ready=false;
for(let attempt=0;attempt<20;attempt++){
 try{
  const response=await fetch(API,{method:'POST',
   headers:{'content-type':'application/json','x-mentor-benchmark-token':secret},
   body:'{}'});
  if(response.status===400){ready=true;break;}
 }catch{}
 await sleep(1000);
}
assert(ready,'benchmark secret was not propagated to Cloudflare');
console.log('BENCH_READY authenticated; paid calls not yet started');
const cases=[];
for(let i=0;i<N;i++)
 for(const model of MODELS)
  for(const variant of VARIANTS)
   cases.push({model,variant,sequence:i+1});
let calls=0,rateRetries=0,started=Date.now();
const results=[],queue=[...cases];
let previousStart=0;
async function next(){
 while(queue.length){
  const job=queue.shift();
  const gap=Math.max(0,4100-(Date.now()-previousStart));
  if(gap)await sleep(gap);
  previousStart=Date.now();
  calls++;
  let result;
  try{
   const abort=new AbortController();
   const timeout=setTimeout(()=>abort.abort(),24000);
   let response;
   try{
    response=await fetch(API,{method:'POST',signal:abort.signal,
     headers:{'content-type':'application/json','x-mentor-benchmark-token':secret},
     body:JSON.stringify({...job,payload})
    });
   }finally{clearTimeout(timeout);}
   const raw=await response.text();
   try{result=JSON.parse(raw);}catch{result={error:'invalid_json',rawStatus:response.status};}
   if(response.status===429&&result.error==='benchmark_rate_limited'){
    rateRetries++;
    if(job.retries<2 || !job.retries){queue.push({...job,retries:(job.retries||0)+1});}
    continue;
   }
   if(response.status!==200)result={...result,model:job.model,variant:job.variant,
    sequence:job.sequence,ok:false,reason:result.error||'runner_http_'+response.status};
  }catch(err){
   result={model:job.model,variant:job.variant,sequence:job.sequence,ok:false,
    reason:err.name==='AbortError'?'runner_timeout':'runner_network'};
  }
  results.push({...job,...result});
  if(results.length%9===0)console.log('PROGRESS',results.length,'/',cases.length);
 }
}
await next();
const summary=[];
for(const model of MODELS)for(const variant of VARIANTS){
 const items=results.filter(r=>r.model===model&&r.variant===variant);
 const passed=items.filter(r=>r.ok===true);
 const avg=arr=>arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):null;
 const reasons={};
 for(const item of items)if(!item.ok)reasons[item.reason]=(reasons[item.reason]||0)+1;
 const row={model,variant,attempts:items.length,success:passed.length,
  successRate:items.length?Math.round(passed.length/items.length*1000)/10:0,
  meanMs:avg(items.map(x=>x.elapsedMs).filter(Number.isFinite)),
  p50Ms:percentile(items.map(x=>x.elapsedMs).filter(Number.isFinite),.5),
  p95Ms:percentile(items.map(x=>x.elapsedMs).filter(Number.isFinite),.95),
  meanCompletionTokens:avg(items.map(x=>x.completionTokens).filter(Number.isFinite)),
  errorReasons:reasons,
  example:passed[0]?.explanation||null};
 summary.push(row);
 console.log('BENCH_SUMMARY',JSON.stringify({...row,example:row.example?.slice(0,260)||null}));
}
const detail={utc:new Date().toISOString(),elapsedMs:Date.now()-started,
 requestedTests:cases.length,attemptedCalls:calls,rateRetries,
 position:'1.f3 e5 2.g4??',summary,results};
await fs.mkdir('test-results/mentor-benchmark',{recursive:true});
await fs.writeFile('test-results/mentor-benchmark/report.json',JSON.stringify(detail,null,2));
console.log('BENCH_TOTAL',JSON.stringify({
 requested:cases.length,actual:results.length,calls,rateRetries,
 durationSec:Math.round(detail.elapsedMs/1000)
}));
for(const model of MODELS){
 const got=summary.filter(x=>x.model===model&&x.example).sort((a,b)=>b.success-a.success)[0];
 console.log('BENCH_EXAMPLE',JSON.stringify({model,variant:got?.variant||null,text:got?.example||null}));
}
