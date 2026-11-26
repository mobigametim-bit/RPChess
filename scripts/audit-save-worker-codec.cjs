/* Local workerd codec diagnostic only. No Wrangler production config,
 * bindings, external fetch, credentials, or deployed Worker. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {pack,unpack}=require('./audit-save-codec.cjs');
async function auditWorkerCodec(json,limits,shape){
 // Resolve the already locked Miniflare dependency through Wrangler.
 const {Miniflare}=createRequire(require.resolve('wrangler'))('miniflare');
 const codec=fs.readFileSync(path.join(__dirname,'audit-save-web-codec.mjs'),'utf8');
 const script=codec+`
 // Synthetic shape only, not the production profile authorization contract.
 const shape=value=>value?.schemaVersion===1&&value.run&&typeof value.run==='object'&&!Array.isArray(value.run);
 export default {async fetch(request){
  try{
   const {operation,json,envelope,limits}=await request.json();
   if(!supported())throw Error('Worker Web codec unavailable');
   const start=performance.now();
   const result=operation==='pack'?await packWeb(json,limits):await unpackWeb(envelope,limits,shape);
   return Response.json({result,elapsedMs:performance.now()-start});
  }catch(error){return Response.json({error:String(error.message||error)},{status:422});}
 }};
 `;
 let mf;
 try{
  // Explicit module array and worker list: avoid the deprecated implicit
  // single-script inference in the locked Miniflare options schema.
  mf=new Miniflare({workers:[{name:'rpchess-codec-audit',compatibilityDate:'2025-01-01',
   modules:[{type:'ESModule',path:path.join(__dirname,'audit-codec-entry.mjs'),contents:script}]}]});
  const call=async body=>{
   const start=performance.now();
   const response=await mf.dispatchFetch('http://localhost/codec-audit',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,limits})
   });
   const result=await response.json();
   return {status:response.status,...result,roundTripMs:performance.now()-start};
  };
  const nodeEnvelope=pack(json,limits);
  const decoded=await call({operation:'unpack',envelope:nodeEnvelope});
  assert.equal(decoded.status,200,decoded.error);assert.equal(decoded.result,json);
  const encoded=await call({operation:'pack',json});
  assert.equal(encoded.status,200,encoded.error);
  assert.equal(unpack(encoded.result,limits,shape),json);
  const self=await call({operation:'unpack',envelope:encoded.result});
  assert.equal(self.status,200,self.error);assert.equal(self.result,json);
  for(const [name,envelope,pattern] of [
   ['checksum',{...nodeEnvelope,sha256:'0'.repeat(64)},/checksum/],
   ['forged length',{...nodeEnvelope,decodedBytes:32},/budget/],
   ['version',{...nodeEnvelope,codecVersion:2},/envelope/],
   ['shape',pack('{"schemaVersion":2}',limits),/shape/]
  ]){
   const failure=await call({operation:'unpack',envelope});
   assert.equal(failure.status,422,name);
   assert.match(failure.error,pattern,name);
  }
  return {decodedBytes:nodeEnvelope.decodedBytes,envelopeBytes:Buffer.byteLength(JSON.stringify(encoded.result)),
   packWorkerClockMs:Math.round(encoded.elapsedMs*100)/100,unpackWorkerClockMs:Math.round(decoded.elapsedMs*100)/100,
   packRoundTripMs:Math.round(encoded.roundTripMs*100)/100,unpackRoundTripMs:Math.round(decoded.roundTripMs*100)/100,
   checks:'Node to workerd, workerd to Node and self roundtrip; checksum, forged length, version, shape rejection',
   scope:'local workerd; Worker clock can be frozen during CPU work; round-trip includes serialization and local transport, not hosted CPU/memory quota or live profile validation'};
 }finally{if(mf)await mf.dispose();}
}
module.exports={auditWorkerCodec};
