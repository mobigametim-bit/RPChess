/* Experimental Web API implementation, isolated from game and Worker.
 * Explicit caller budgets, no storage/network writes, no fallback to unsafe inflate.
 * SHA-256 is corruption detection, not authentication. */
const encoder=new TextEncoder();
const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
function limitsOf(limits){
 if(!Number.isSafeInteger(limits?.maxDecodedBytes)||limits.maxDecodedBytes<1||
    !Number.isSafeInteger(limits?.maxEncodedBytes)||limits.maxEncodedBytes<1)
  throw Error('invalid codec limits');
 return limits;
}
function supported(){
 return typeof CompressionStream==='function'&&typeof DecompressionStream==='function'&&
  typeof Blob==='function'&&typeof btoa==='function'&&typeof atob==='function'&&
  Boolean(globalThis.crypto?.subtle);
}
function requireSupport(){if(!supported())throw Error('Web save codec unavailable');}
async function digest(raw){
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
 return Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');
}
function base64url(raw){
 // Multiple of three so only the final segment can have padding.
 const step=24576,parts=[];
 for(let i=0;i<raw.length;i+=step)
  parts.push(btoa(String.fromCharCode(...raw.subarray(i,i+step))));
 return parts.join('').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeBase64url(data){
 const binary=atob(data.replace(/-/g,'+').replace(/_/g,'/'));
 const raw=Uint8Array.from(binary,c=>c.charCodeAt(0));
 if(base64url(raw)!==data)throw Error('noncanonical base64url');
 return raw;
}
async function boundedTransform(raw,transform,maxBytes){
 const reader=new Blob([raw]).stream().pipeThrough(transform).getReader();
 const chunks=[];let length=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   if(value.byteLength>maxBytes-length)throw Error('stream output budget exceeded');
   chunks.push(value);length+=value.byteLength;
  }
 }catch(error){
  try{await reader.cancel(error);}catch{}
  throw error;
 }finally{reader.releaseLock();}
 const result=new Uint8Array(length);let offset=0;
 for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}
 return result;
}
async function packWeb(json,limits){
 limitsOf(limits);requireSupport();
 if(typeof json!=='string'||json.length>limits.maxDecodedBytes)throw Error('decoded budget exceeded');
 const raw=encoder.encode(json);
 if(!raw.length||raw.length>limits.maxDecodedBytes)throw Error('decoded budget exceeded');
 if(decoder.decode(raw)!==json)throw Error('invalid UTF-8 source');
 const compressed=await boundedTransform(raw,new CompressionStream('gzip'),Math.floor(limits.maxEncodedBytes*3/4));
 const data=base64url(compressed);
 if(data.length>limits.maxEncodedBytes)throw Error('encoded budget exceeded');
 return {codecVersion:1,encoding:'gzip+base64url',decodedBytes:raw.length,sha256:await digest(raw),data};
}
async function unpackWeb(envelope,limits,validateShape){
 limitsOf(limits);requireSupport();
 if(typeof validateShape!=='function')throw Error('missing shape validator');
 if(!envelope||envelope.codecVersion!==1||envelope.encoding!=='gzip+base64url'||
    !Number.isSafeInteger(envelope.decodedBytes)||envelope.decodedBytes<1||
    envelope.decodedBytes>limits.maxDecodedBytes||
    typeof envelope.sha256!=='string'||!/^[0-9a-f]{64}$/.test(envelope.sha256)||
    typeof envelope.data!=='string'||envelope.data.length<1||
    envelope.data.length>limits.maxEncodedBytes||!/^[A-Za-z0-9_-]+$/.test(envelope.data))
  throw Error('invalid or oversized codec envelope');
 const compressed=decodeBase64url(envelope.data);
 const raw=await boundedTransform(compressed,new DecompressionStream('gzip'),envelope.decodedBytes);
 if(raw.length!==envelope.decodedBytes||await digest(raw)!==envelope.sha256)
  throw Error('decoded length or checksum mismatch');
 const json=decoder.decode(raw);
 if(!validateShape(JSON.parse(json)))throw Error('invalid snapshot shape');
 return json;
}
export {supported,packWeb,unpackWeb};
