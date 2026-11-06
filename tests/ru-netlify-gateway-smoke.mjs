import assert from 'node:assert/strict';

const base = 'https://rpchess-ru-api-gateway.netlify.app';
const origin = 'https://mobigametim-bit.github.io';
async function request(path, options={}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(base+path,{cache:'no-store',signal:controller.signal,...options});
  } finally { clearTimeout(timeout); }
}
for (const path of ['/geo','/profile/health','/tournament/health']) {
  const res = await request(path);
  const text = await res.text();
  assert.equal(res.status,200,path+' HTTP status: '+res.status+' '+text.slice(0,240));
  let data;try{data=JSON.parse(text);}catch{throw Error(path+' is not JSON: '+text.slice(0,240));}
  if(path==='/geo') assert.ok(data.country===null||/^[A-Z]{2}$/.test(data.country),'invalid country');
  else assert.equal(data.ok,true,path+' upstream is not healthy: '+text.slice(0,240));
  console.log(path,'HTTP',res.status,JSON.stringify(data).slice(0,160));
}
for(const service of ['profile','tournament']) {
  const path='/'+service+'/v1/session';
  const res=await request(path,{
    method:'OPTIONS',
    headers:{
      Origin:origin,
      'Access-Control-Request-Method':'POST',
      'Access-Control-Request-Headers':'Authorization, Content-Type'
    }
  });
  const allowOrigin=res.headers.get('access-control-allow-origin');
  assert.equal(res.status,204,path+' preflight status '+res.status);
  assert.equal(allowOrigin,origin,path+' wrong allow-origin');
  const allow=(res.headers.get('access-control-allow-headers')||'').toLowerCase();
  assert.ok(allow.includes('authorization')&&allow.includes('content-type'),path+' missing auth/content-type preflight');
  console.log(path,'OPTIONS',res.status,'CORS OK');
}

// Wait for the Netlify Git-based production deployment: GitHub Actions can
// reach this step before the Netlify build has finished.
async function waitForPreview(path,attempts=30){
 for(let i=0;i<attempts;i++){
  try{
   const res=await request(path);
   if(res.status===200){
    const body=await res.json();
    if(body.ok===true){console.log(path,'HTTP 200',JSON.stringify(body).slice(0,150));return;}
   }
  }catch{}
  if(i!==attempts-1)await new Promise(resolve=>setTimeout(resolve,12000));
 }
 throw Error(path+' was not healthy after Netlify build');
}
await waitForPreview('/preview-api/profile/health');
await waitForPreview('/preview-api/tournament/health');
const playable=await request('/play/index.html');
const page=await playable.text();
assert.equal(playable.status,200,'playable page HTTP status '+playable.status);
assert.ok(page.includes('data-tournament-open')&&page.includes('rpchess-gateway'),
 'playable game HTML not deployed or wrong version');
const module=await request('/play/js/api-route.mjs');
const source=await module.text();
assert.equal(module.status,200);
assert.ok(source.includes("'/preview-api'"),'new adaptive API client missing from playable preview');
console.log('/play/index.html','HTTP 200; new API route module HTTP 200');
console.log('Gateway, preflight, and playable preview reachability passed. Two real players still need manual acceptance.');
