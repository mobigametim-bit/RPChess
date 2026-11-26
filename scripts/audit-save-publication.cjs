/* In-memory publication model only. No actual persistence/authentication.
 * An eventual database implementation MUST commit head+receipt atomically,
 * preserve immutable generations, enforce tenant auth/quotas and define GC.
 * All methods are synchronous so interleaving happens between calls here. */
const {validateManifest,validateChunk,restoreGeneration}=require('./audit-save-generation.cjs');
class MemoryGenerationStore{
 #accounts=new Map();
 #limits;#validateShape;
 constructor(limits,validateShape){
  this.#limits={...limits};
  if(typeof validateShape!=='function')throw Error('missing shape validator');
  this.#validateShape=validateShape;
 }
 #account(scope,create=false){
  if(typeof scope!=='string'||!scope||scope.length>128)throw Error('invalid scope');
  if(!this.#accounts.has(scope)&&create)this.#accounts.set(scope,{
   staged:new Map(),committed:{head:{revision:0,generationId:null},receipts:new Map(),revisions:new Map()}
  });
  return this.#accounts.get(scope);
 }
 stageManifest(scope,manifest){
  validateManifest(manifest,this.#limits);
  const a=this.#account(scope,true),id=manifest.generationId;
  if(!a.staged.has(id))a.staged.set(id,{
   manifest:{generationVersion:manifest.generationVersion,generationId:id,
    codec:{codecVersion:manifest.codec.codecVersion,encoding:manifest.codec.encoding,
     decodedBytes:manifest.codec.decodedBytes,sha256:manifest.codec.sha256},
    encodedBytes:manifest.encodedBytes,chunkBytes:manifest.chunkBytes,chunkHashes:[...manifest.chunkHashes]},
   chunks:new Map()
  });
  return id;
 }
 stageChunk(scope,chunk){
  const g=this.#account(scope)?.staged.get(chunk?.generationId);
  if(!g)throw Error('unknown generation');
  validateChunk(g.manifest,chunk,chunk.index);
  const prior=g.chunks.get(chunk.index);
  if(prior&&prior.data!==chunk.data)throw Error('immutable chunk conflict');
  if(!prior)g.chunks.set(chunk.index,{generationId:chunk.generationId,index:chunk.index,data:chunk.data});
 }
 #decode(a,id){
  const g=a?.staged.get(id);
  if(!g)throw Error('unknown generation');
  if(g.chunks.size!==g.manifest.chunkHashes.length)throw Error('incomplete generation');
  const chunks=g.manifest.chunkHashes.map((_,i)=>g.chunks.get(i));
  return restoreGeneration(g.manifest,chunks,this.#limits,this.#validateShape);
 }
 head(scope){return {...(this.#account(scope)?.committed.head||{revision:0,generationId:null})};}
 read(scope,revision=null){
  const a=this.#account(scope);
  if(!a)return null;
  const selected=revision===null?a.committed.head:
   {revision,generationId:a.committed.revisions.get(revision)};
  if(!selected.generationId)return null;
  return {...selected,json:this.#decode(a,selected.generationId)};
 }
 publish(scope,{expectedRevision,generationId,operationId}={}){
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||
     typeof operationId!=='string'||!operationId||operationId.length>128||
     typeof generationId!=='string'||!/^[0-9a-f]{64}$/.test(generationId))
   throw Error('invalid publish request');
  const a=this.#account(scope,true),current=a.committed,head=current.head;
  const prior=current.receipts.get(operationId);
  if(prior){
   if(prior.expectedRevision!==expectedRevision||prior.generationId!==generationId)
    throw Error('operation ID conflict');
   return {status:'replayed',revision:prior.revision,generationId,head:{...head}};
  }
  if(expectedRevision!==head.revision)return {status:'conflict',head:{...head}};
  // Verify ALL data and shape before publishing. Any throw leaves the old
  // committed head, revision history and operation receipts untouched.
  this.#decode(a,generationId);
  const unchanged=generationId===head.generationId;
  if(!unchanged&&head.revision===Number.MAX_SAFE_INTEGER)throw Error('revision overflow');
  const revision=unchanged?head.revision:head.revision+1;
  const nextHead={revision,generationId};
  const receipts=new Map(current.receipts),revisions=new Map(current.revisions);
  receipts.set(operationId,{expectedRevision,generationId,revision});
  revisions.set(revision,generationId);
  a.committed={head:nextHead,receipts,revisions};
  return {status:'committed',revision,generationId,head:{...nextHead}};
 }
}
module.exports={MemoryGenerationStore};
