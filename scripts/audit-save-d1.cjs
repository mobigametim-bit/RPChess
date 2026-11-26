/* D1 binding experiment only: local workerd via Wrangler, never production.
 * Uses Node reference validation of immutable staged chunks. Real Worker
 * Web API validation, authenticated routes, quotas and GC remain separate. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {validateManifest,validateChunk,restoreGeneration}=require('./audit-save-generation.cjs');
const schema=[
 `CREATE TABLE generations(scope TEXT NOT NULL,id TEXT NOT NULL,manifest TEXT NOT NULL,PRIMARY KEY(scope,id))`,
 `CREATE TABLE chunks(scope TEXT NOT NULL,id TEXT NOT NULL,idx INTEGER NOT NULL,data TEXT NOT NULL,
 PRIMARY KEY(scope,id,idx),FOREIGN KEY(scope,id) REFERENCES generations(scope,id))`,
 `CREATE TABLE revisions(scope TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),id TEXT NOT NULL,
 PRIMARY KEY(scope,revision),UNIQUE(scope,revision,id),FOREIGN KEY(scope,id) REFERENCES generations(scope,id))`,
 `CREATE TABLE heads(scope TEXT PRIMARY KEY,revision INTEGER NOT NULL,
 FOREIGN KEY(scope,revision) REFERENCES revisions(scope,revision))`,
 `CREATE TABLE receipts(scope TEXT NOT NULL,operation TEXT NOT NULL,expected INTEGER NOT NULL,revision INTEGER NOT NULL,id TEXT NOT NULL,
 PRIMARY KEY(scope,operation),FOREIGN KEY(scope,revision,id) REFERENCES revisions(scope,revision,id))`,
 // The conditional receipt INSERT is the only publication entry point.
 // Its trigger creates the revision and updates the head within the same
 // statement/transaction. The receipt foreign key is checked at statement end.
 `CREATE TRIGGER publish_generation AFTER INSERT ON receipts BEGIN
 INSERT INTO revisions(scope,revision,id) SELECT NEW.scope,NEW.revision,NEW.id WHERE NEW.revision>NEW.expected;
 INSERT INTO heads(scope,revision) SELECT NEW.scope,NEW.revision WHERE NEW.revision>NEW.expected
 ON CONFLICT(scope) DO UPDATE SET revision=excluded.revision;
 END`
];
const HEAD=`SELECT h.revision,r.id AS generationId FROM heads h JOIN revisions r ON r.scope=h.scope AND r.revision=h.revision WHERE h.scope=?`;
const RECEIPT=`SELECT expected,revision,id FROM receipts WHERE scope=? AND operation=?`;
const DEFAULT_HEAD={revision:0,generationId:null};
// No read-then-unconditional-write race: both the expected revision and
// operation uniqueness are evaluated at the database write itself.
const PUBLISH=`INSERT INTO receipts(scope,operation,expected,revision,id)
 SELECT ?,?,?,?+CASE WHEN COALESCE((SELECT r.id FROM heads h JOIN revisions r ON r.scope=h.scope AND r.revision=h.revision WHERE h.scope=?),'')=? THEN 0 ELSE 1 END,?
 WHERE COALESCE((SELECT revision FROM heads WHERE scope=?),0)=?
 AND NOT EXISTS(SELECT 1 FROM receipts WHERE scope=? AND operation=?)
 ON CONFLICT(scope,operation) DO NOTHING
 RETURNING revision`;
const scopeKey=scope=>{if(typeof scope!=='string'||!scope||scope.length>128)throw Error('invalid scope');return scope;};
class D1AuditStore{
 constructor(db,limits,shape){this.db=db;this.limits={...limits};this.shape=shape;}
 stmt(sql,...args){const p=this.db.prepare(sql);return args.length?p.bind(...args):p;}
 async init(){await this.db.batch(schema.map(sql=>this.stmt(sql)));}
 async manifest(scope,id){
  const row=await this.stmt('SELECT manifest FROM generations WHERE scope=? AND id=?',scope,id).first();
  if(!row)throw Error('unknown generation');
  const m=JSON.parse(row.manifest);validateManifest(m,this.limits);return m;
 }
 async stageManifest(scope,m){
  scopeKey(scope);validateManifest(m,this.limits);
  const canonical={generationVersion:m.generationVersion,generationId:m.generationId,
   codec:{codecVersion:m.codec.codecVersion,encoding:m.codec.encoding,decodedBytes:m.codec.decodedBytes,sha256:m.codec.sha256},
   encodedBytes:m.encodedBytes,chunkBytes:m.chunkBytes,chunkHashes:[...m.chunkHashes]};
  await this.stmt('INSERT INTO generations VALUES(?,?,?) ON CONFLICT(scope,id) DO NOTHING',scope,m.generationId,JSON.stringify(canonical)).run();
 }
 async stageChunk(scope,c){
  scopeKey(scope);const m=await this.manifest(scope,c?.generationId??'');
  validateChunk(m,c,c.index);
  const [,check]=await this.db.batch([
   this.stmt('INSERT INTO chunks VALUES(?,?,?,?) ON CONFLICT(scope,id,idx) DO NOTHING',scope,c.generationId,c.index,c.data),
   this.stmt('SELECT data FROM chunks WHERE scope=? AND id=? AND idx=?',scope,c.generationId,c.index)
  ]);
  if(check.results[0]?.data!==c.data)throw Error('immutable chunk conflict');
 }
 async decode(scope,id){
  const m=await this.manifest(scope,id);
  const rows=(await this.stmt('SELECT idx,data FROM chunks WHERE scope=? AND id=? ORDER BY idx LIMIT ?',scope,id,this.limits.maxChunks+1).all()).results;
  return restoreGeneration(m,rows.map(row=>({generationId:id,index:row.idx,data:row.data})),this.limits,this.shape);
 }
 async head(scope){return await this.stmt(HEAD,scopeKey(scope)).first()||{...DEFAULT_HEAD};}
 async read(scope,revision=null){
  scopeKey(scope);
  const h=revision===null?await this.head(scope):await this.stmt('SELECT revision,id AS generationId FROM revisions WHERE scope=? AND revision=?',scope,revision).first();
  return h?.generationId?{revision:h.revision,generationId:h.generationId,json:await this.decode(scope,h.generationId)}:null;
 }
 async publish(scope,{expectedRevision,generationId,operationId}={}){
  scopeKey(scope);
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER||
     typeof operationId!=='string'||!operationId||operationId.length>128||
     typeof generationId!=='string'||!/^[0-9a-f]{64}$/.test(generationId))throw Error('invalid publish request');
  // No deletions or mutations of staged content in this prototype, so once
  // validated the generation cannot change between verification and publish.
  const [priorResult,headResult]=await this.db.batch([this.stmt(RECEIPT,scope,operationId),this.stmt(HEAD,scope)]);
  const prior=priorResult.results[0],head=headResult.results[0]||{...DEFAULT_HEAD};
  const replay=(receipt,current)=>{
   if(receipt.expected!==expectedRevision||receipt.id!==generationId)throw Error('operation ID conflict');
   return {status:'replayed',revision:receipt.revision,generationId,head:current};
  };
  if(prior)return replay(prior,head);
  if(head.revision!==expectedRevision)return {status:'conflict',head};
  await this.decode(scope,generationId);
  const [write,receiptRead,headRead]=await this.db.batch([
   this.stmt(PUBLISH,scope,operationId,expectedRevision,expectedRevision,scope,generationId,generationId,scope,expectedRevision,scope,operationId),
   this.stmt(RECEIPT,scope,operationId),this.stmt(HEAD,scope)
  ]);
  const receipt=receiptRead.results[0],current=headRead.results[0]||{...DEFAULT_HEAD};
  if(!receipt)return {status:'conflict',head:current};
  if(!write.results.length)return replay(receipt,current);
  return {status:'committed',revision:receipt.revision,generationId,head:current};
 }
}
async function auditD1Publication(fixtures,limits,shape){
 const {getPlatformProxy}=await import('wrangler');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rpchess-d1-audit-'));
 let proxy;
 try{
  // Never load the repository's real Worker config or database ID.
  const configPath=path.join(dir,'wrangler.json');
  fs.writeFileSync(configPath,JSON.stringify({name:'rpchess-save-audit-local',compatibility_date:'2025-01-01',
   d1_databases:[{binding:'AUDIT_DB',database_name:'disposable-audit',database_id:'00000000-0000-4000-8000-000000000001',remote:false}]}));
  proxy=await getPlatformProxy({configPath,persist:false,remoteBindings:false});
  const store=new D1AuditStore(proxy.env.AUDIT_DB,limits,shape);
  await store.init();
  const [first,competing,next]=fixtures,scope='audit-A',other='audit-B';
  const request=(g,expectedRevision,operationId)=>({generationId:g.manifest.generationId,expectedRevision,operationId});
  const stage=async(s,g,parts=g.chunks)=>{await store.stageManifest(s,g.manifest);for(const c of parts)await store.stageChunk(s,c);};
  await stage(scope,first);assert.equal((await store.publish(scope,request(first,0,'initial'))).revision,1);
  await stage(scope,next,next.chunks.slice(0,1));
  await assert.rejects(store.publish(scope,request(next,1,'partial')),/incomplete/);
  assert.equal((await store.read(scope)).json,first.json);assert.equal(await store.read(scope,2),null);
  assert.equal(await store.read(other),null);
  await assert.rejects(store.publish(other,request(first,0,'initial')),/unknown generation/);
  await stage(scope,next);await stage(scope,competing);
  // Fail on the head update after receipt and revision insertion.
  await store.stmt("CREATE TRIGGER audit_failure BEFORE UPDATE ON heads BEGIN SELECT RAISE(ABORT,'injected D1 failure'); END").run();
  await assert.rejects(store.publish(scope,request(next,1,'fault')),/injected D1 failure/);
  assert.equal((await store.head(scope)).revision,1);assert.equal(await store.read(scope,2),null);
  assert.equal(await store.stmt(RECEIPT,scope,'fault').first(),null);
  await store.stmt('DROP TRIGGER audit_failure').run();
  const requests=[request(next,1,'device-A'),request(competing,1,'device-B')];
  const outcomes=await Promise.all(requests.map(q=>store.publish(scope,q)));
  assert.deepEqual(outcomes.map(o=>o.status).sort(),['committed','conflict']);
  const winner=outcomes.findIndex(o=>o.status==='committed'),loser=1-winner;
  const winning=winner===0?next:competing,losing=winner===0?competing:next;
  assert.equal((await store.read(scope)).json,winning.json);
  assert.equal((await store.publish(scope,requests[winner])).status,'replayed');
  assert.equal((await store.publish(scope,{...requests[loser],expectedRevision:2})).revision,3);
  const late=await store.publish(scope,requests[winner]);
  assert.equal(late.revision,2);assert.equal(late.head.revision,3);
  assert.equal((await store.read(scope)).json,losing.json);
  assert.equal((await store.read(scope,1)).json,first.json);
  assert.equal((await store.read(scope,2)).json,winning.json);
  await assert.rejects(store.publish(scope,request(first,3,requests[winner].operationId)),/operation ID conflict/);
  assert.equal((await store.publish(scope,request(losing,3,'no-op'))).revision,3);
  await stage(other,first);assert.equal((await store.publish(other,request(first,0,'initial'))).revision,1);
  assert.equal((await store.read(other)).json,first.json);
  assert.equal((await store.read(scope)).json,losing.json);
  return {checks:'partial upload; atomic trigger rollback; concurrent CAS requests; idempotent retry; late retry; previous revisions; no-op; scope isolation',
   outcomes:outcomes.map(o=>o.status),finalRevision:3,otherRevision:1,
   scope:'local workerd D1 binding via Wrangler getPlatformProxy; Node reference validation; not hosted D1'};
 }finally{try{if(proxy)await proxy.dispose();}finally{fs.rmSync(dir,{recursive:true,force:true});}}
}
module.exports={auditD1Publication};
