/* Experimental generation format, never connected to live storage.
 * ASCII compressed payload chunks; immutable content ID, ordered and bounded.
 * Integrity hashes do not establish authorization. No database or CAS here. */
const {createHash}=require('node:crypto');
const {unpack}=require('./audit-save-codec.cjs');
const hash=value=>createHash('sha256').update(value,'utf8').digest('hex');
const hex=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const ascii=value=>typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value);
function checkLimits(limits){
 if(!Number.isSafeInteger(limits?.maxChunkBytes)||limits.maxChunkBytes<1||
    !Number.isSafeInteger(limits?.maxEncodedBytes)||limits.maxEncodedBytes<1||
    !Number.isSafeInteger(limits?.maxDecodedBytes)||limits.maxDecodedBytes<1||
    !Number.isSafeInteger(limits?.maxChunks)||limits.maxChunks<1)
  throw Error('invalid generation limits');
}
function metadata(envelope){
 return {codecVersion:envelope.codecVersion,encoding:envelope.encoding,
  decodedBytes:envelope.decodedBytes,sha256:envelope.sha256};
}
function manifestBody(manifest){
 return {generationVersion:manifest.generationVersion,codec:metadata(manifest.codec),
  encodedBytes:manifest.encodedBytes,chunkBytes:manifest.chunkBytes,chunkHashes:manifest.chunkHashes};
}
function validateManifest(manifest,limits){
 checkLimits(limits);
 if(!manifest||manifest.generationVersion!==1||!hex(manifest.generationId)||
    manifest.codec?.codecVersion!==1||manifest.codec?.encoding!=='gzip+base64url'||
    !Number.isSafeInteger(manifest.codec.decodedBytes)||manifest.codec.decodedBytes<1||
    manifest.codec.decodedBytes>limits.maxDecodedBytes||!hex(manifest.codec.sha256)||
    !Number.isSafeInteger(manifest.encodedBytes)||manifest.encodedBytes<1||
    manifest.encodedBytes>limits.maxEncodedBytes||!Number.isSafeInteger(manifest.chunkBytes)||
    manifest.chunkBytes<1||manifest.chunkBytes>limits.maxChunkBytes||
    !Array.isArray(manifest.chunkHashes)||manifest.chunkHashes.length>limits.maxChunks||
    manifest.chunkHashes.length!==Math.ceil(manifest.encodedBytes/manifest.chunkBytes)||
    !manifest.chunkHashes.every(hex))
  throw Error('invalid or oversized generation manifest');
 if(hash(JSON.stringify(manifestBody(manifest)))!==manifest.generationId)
  throw Error('manifest checksum mismatch');
}
function splitGeneration(envelope,limits){
 checkLimits(limits);
 if(typeof envelope?.data!=='string'||envelope.data.length>limits.maxEncodedBytes||!ascii(envelope.data))
  throw Error('invalid or oversized generation payload');
 const count=Math.ceil(envelope.data.length/limits.maxChunkBytes);
 if(count>limits.maxChunks)throw Error('chunk count budget exceeded');
 const parts=[];
 for(let at=0;at<envelope.data.length;at+=limits.maxChunkBytes)
  parts.push(envelope.data.slice(at,at+limits.maxChunkBytes));
 const body={generationVersion:1,codec:metadata(envelope),encodedBytes:envelope.data.length,
  chunkBytes:limits.maxChunkBytes,chunkHashes:parts.map(hash)};
 const manifest={...body,generationId:hash(JSON.stringify(body))};
 validateManifest(manifest,limits);
 return {manifest,chunks:parts.map((data,index)=>({generationId:manifest.generationId,index,data}))};
}
function restoreGeneration(manifest,chunks,limits,validateShape){
 validateManifest(manifest,limits);
 if(!Array.isArray(chunks)||chunks.length!==manifest.chunkHashes.length)
  throw Error('incomplete generation');
 const parts=[];
 for(let i=0;i<chunks.length;i++){
  const chunk=chunks[i],expected=Math.min(manifest.chunkBytes,manifest.encodedBytes-i*manifest.chunkBytes);
  if(!chunk||chunk.generationId!==manifest.generationId||chunk.index!==i||
     typeof chunk.data!=='string'||chunk.data.length!==expected||
     !ascii(chunk.data)||hash(chunk.data)!==manifest.chunkHashes[i])
   throw Error('invalid generation chunk '+i);
  parts.push(chunk.data);
 }
 return unpack({...manifest.codec,data:parts.join('')},limits,validateShape);
}
module.exports={splitGeneration,restoreGeneration};
