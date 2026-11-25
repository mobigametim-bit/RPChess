/* Node-only experimental save codec. Never imported by the game or Worker.
 * Limits are explicit caller-supplied experiment budgets, not a release contract.
 * SHA-256 detects accidental corruption; it does not authenticate player data. */
const {gzipSync,gunzipSync}=require('node:zlib');
const {createHash}=require('node:crypto');
const digest=raw=>createHash('sha256').update(raw).digest('hex');
function validateLimits(limits){
  if(!Number.isSafeInteger(limits?.maxDecodedBytes)||limits.maxDecodedBytes<1||
     !Number.isSafeInteger(limits?.maxEncodedBytes)||limits.maxEncodedBytes<1)
    throw new Error('invalid codec limits');
}
function pack(json,limits){
  validateLimits(limits);
  if(typeof json!=='string'||Buffer.byteLength(json,'utf8')>limits.maxDecodedBytes)
    throw new Error('decoded budget exceeded');
  const raw=Buffer.from(json,'utf8'),data=gzipSync(raw).toString('base64url');
  if(raw.toString('utf8')!==json)throw new Error('invalid UTF-8 source');
  if(data.length>limits.maxEncodedBytes)throw new Error('encoded budget exceeded');
  return {codecVersion:1,encoding:'gzip+base64url',decodedBytes:raw.length,sha256:digest(raw),data};
}
function unpack(envelope,limits,validateShape){
  validateLimits(limits);
  if(typeof validateShape!=='function')throw new Error('missing shape validator');
  if(!envelope||envelope.codecVersion!==1||envelope.encoding!=='gzip+base64url'||
     !Number.isSafeInteger(envelope.decodedBytes)||envelope.decodedBytes<1||
     envelope.decodedBytes>limits.maxDecodedBytes||
     typeof envelope.sha256!=='string'||!/^[0-9a-f]{64}$/.test(envelope.sha256)||
     typeof envelope.data!=='string'||envelope.data.length<1||
     envelope.data.length>limits.maxEncodedBytes||!/^[A-Za-z0-9_-]+$/.test(envelope.data))
    throw new Error('invalid or oversized codec envelope');
  const compressed=Buffer.from(envelope.data,'base64url');
  if(compressed.toString('base64url')!==envelope.data)throw new Error('noncanonical base64url');
  // Node stops decompression at the declared length, capped by the caller's
  // decoded budget. A forged short length cannot cause an unbounded inflate.
  const raw=gunzipSync(compressed,{maxOutputLength:envelope.decodedBytes});
  if(raw.length!==envelope.decodedBytes||digest(raw)!==envelope.sha256)
    throw new Error('decoded length or checksum mismatch');
  const json=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);
  const value=JSON.parse(json);
  if(!validateShape(value))throw new Error('invalid snapshot shape');
  return json;
}
module.exports={pack,unpack};
