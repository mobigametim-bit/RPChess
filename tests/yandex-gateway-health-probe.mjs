/* Run ONLY against a user-created public Yandex API Gateway probe URL.
   No authentication, profile sync, matchmaking or changes to game state. */
import assert from 'node:assert/strict';

const input=process.argv[2]||process.env.RPCHESS_YANDEX_GATEWAY_URL||'';
let base;
try{
  const value=new URL(input);
  if(value.protocol!=='https:'||value.username||value.password||value.search||value.hash||
    !value.hostname.endsWith('.apigw.yandexcloud.net'))throw Error('invalid Yandex API Gateway domain');
  base=value.origin+value.pathname.replace(/[/]$/,'');
}catch{
  throw Error('Usage: node tests/yandex-gateway-health-probe.mjs https://<your-id>.apigw.yandexcloud.net');
}
async function probe(path){
  const abort=new AbortController();
  const clock=setTimeout(()=>abort.abort(),14000);
  try{
    const response=await fetch(base+path,{signal:abort.signal,cache:'no-store'});
    const body=await response.json().catch(()=>null);
    console.log(path, 'HTTP', response.status, 'service:',body?.service||body?.via||'unknown');
    assert.equal(response.status,200,path+' HTTP '+response.status);
    assert.equal(body?.ok,true,path+' did not return expected health JSON');
    return body;
  }finally{clearTimeout(clock);}
}
assert.equal((await probe('/ping')).via,'yandex-api-gateway');
assert.equal((await probe('/probe/profile')).service,'rpchess-profile-preview');
assert.equal((await probe('/probe/tournament')).service,'tournament');
console.log('YANDEX API GATEWAY OUTBOUND HEALTH PROBE PASS');
