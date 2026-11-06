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
console.log('Gateway health and preflight checks passed. Browser matchmaking remains separate manual acceptance.');
