/* Disposable SQLite proof of the generation publication contract.
 * No production connection, migration, credentials or live Worker imports.
 * SQLite transactions are not a substitute for D1-specific acceptance. */
const {DatabaseSync}=require('node:sqlite');
const {validateManifest,validateChunk,restoreGeneration}=require('./audit-save-generation.cjs');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {Worker}=require('node:worker_threads');
const {execFileSync}=require('node:child_process');
const scopeKey=scope=>{
 if(typeof scope!=='string'||!scope||scope.length>128)throw Error('invalid scope');
 return scope;
};
class SqliteGenerationStore{
 #db;#limits;#shape;
 constructor(filename,limits,shape){
  if(typeof shape!=='function')throw Error('missing shape validator');
  this.#limits={...limits};this.#shape=shape;
  this.#db=new DatabaseSync(filename);
  this.#db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;
   CREATE TABLE IF NOT EXISTS generations(
    scope TEXT NOT NULL,id TEXT NOT NULL,manifest TEXT NOT NULL,PRIMARY KEY(scope,id));
   CREATE TABLE IF NOT EXISTS chunks(
    scope TEXT NOT NULL,id TEXT NOT NULL,idx INTEGER NOT NULL,data TEXT NOT NULL,
    PRIMARY KEY(scope,id,idx),FOREIGN KEY(scope,id) REFERENCES generations(scope,id));
   CREATE TABLE IF NOT EXISTS revisions(
    scope TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),id TEXT NOT NULL,
    PRIMARY KEY(scope,revision),UNIQUE(scope,revision,id),
    FOREIGN KEY(scope,id) REFERENCES generations(scope,id));
   CREATE TABLE IF NOT EXISTS heads(
    scope TEXT PRIMARY KEY,revision INTEGER NOT NULL,
    FOREIGN KEY(scope,revision) REFERENCES revisions(scope,revision));
   CREATE TABLE IF NOT EXISTS receipts(
    scope TEXT NOT NULL,operation TEXT NOT NULL,expected INTEGER NOT NULL,
    revision INTEGER NOT NULL,id TEXT NOT NULL,PRIMARY KEY(scope,operation),
    FOREIGN KEY(scope,revision,id) REFERENCES revisions(scope,revision,id));
  `);
 }
 close(){this.#db.close();}
 #get(sql,...args){return this.#db.prepare(sql).get(...args);}
 #run(sql,...args){return this.#db.prepare(sql).run(...args);}
 #manifest(scope,id){
  const row=this.#get('SELECT manifest FROM generations WHERE scope=? AND id=?',scope,id);
  if(!row)throw Error('unknown generation');
  const m=JSON.parse(row.manifest);validateManifest(m,this.#limits);return m;
 }
 stageManifest(scope,m){
  scopeKey(scope);validateManifest(m,this.#limits);
  const manifest={generationVersion:m.generationVersion,generationId:m.generationId,
   codec:{codecVersion:m.codec.codecVersion,encoding:m.codec.encoding,decodedBytes:m.codec.decodedBytes,sha256:m.codec.sha256},
   encodedBytes:m.encodedBytes,chunkBytes:m.chunkBytes,chunkHashes:[...m.chunkHashes]};
  this.#run('INSERT INTO generations VALUES(?,?,?) ON CONFLICT(scope,id) DO NOTHING',scope,m.generationId,JSON.stringify(manifest));
  return m.generationId;
 }
 stageChunk(scope,chunk){
  scopeKey(scope);
  const manifest=this.#manifest(scope,chunk?.generationId??'');
  validateChunk(manifest,chunk,chunk.index);
  this.#run('INSERT INTO chunks VALUES(?,?,?,?) ON CONFLICT(scope,id,idx) DO NOTHING',scope,chunk.generationId,chunk.index,chunk.data);
  if(this.#get('SELECT data FROM chunks WHERE scope=? AND id=? AND idx=?',scope,chunk.generationId,chunk.index)?.data!==chunk.data)
   throw Error('immutable chunk conflict');
 }
 #decode(scope,id){
  const m=this.#manifest(scope,id);
  const rows=this.#db.prepare('SELECT idx,data FROM chunks WHERE scope=? AND id=? ORDER BY idx LIMIT ?').all(scope,id,this.#limits.maxChunks+1);
  return restoreGeneration(m,rows.map(row=>({generationId:id,index:row.idx,data:row.data})),this.#limits,this.#shape);
 }
 head(scope){
  scopeKey(scope);
  const row=this.#get('SELECT h.revision,r.id FROM heads h JOIN revisions r ON r.scope=h.scope AND r.revision=h.revision WHERE h.scope=?',scope);
  return row?{revision:row.revision,generationId:row.id}:{revision:0,generationId:null};
 }
 read(scope,revision=null){
  scopeKey(scope);
  const row=revision===null?this.head(scope):this.#get('SELECT revision,id AS generationId FROM revisions WHERE scope=? AND revision=?',scope,revision);
  return row?.generationId?{revision:row.revision,generationId:row.generationId,json:this.#decode(scope,row.generationId)}:null;
 }
 publish(scope,{expectedRevision,generationId,operationId}={}){
  scopeKey(scope);
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||
     typeof operationId!=='string'||!operationId||operationId.length>128||
     typeof generationId!=='string'||!/^[0-9a-f]{64}$/.test(generationId))
   throw Error('invalid publish request');
  // SQLite write reservation before reading head; all writers serialize.
  this.#db.exec('BEGIN IMMEDIATE');
  try{
   const head=this.head(scope);
   const prior=this.#get('SELECT expected,revision,id FROM receipts WHERE scope=? AND operation=?',scope,operationId);
   let result;
   if(prior){
    if(prior.expected!==expectedRevision||prior.id!==generationId)throw Error('operation ID conflict');
    result={status:'replayed',revision:prior.revision,generationId,head};
   }else if(head.revision!==expectedRevision){
    result={status:'conflict',head};
   }else{
    this.#decode(scope,generationId);
    const unchanged=generationId===head.generationId;
    if(!unchanged&&head.revision===Number.MAX_SAFE_INTEGER)throw Error('revision overflow');
    const revision=unchanged?head.revision:head.revision+1;
    if(!unchanged){
     this.#run('INSERT INTO revisions VALUES(?,?,?)',scope,revision,generationId);
     this.#run('INSERT INTO heads VALUES(?,?) ON CONFLICT(scope) DO UPDATE SET revision=excluded.revision',scope,revision);
    }
    this.#run('INSERT INTO receipts VALUES(?,?,?,?,?)',scope,operationId,expectedRevision,revision,generationId);
    result={status:'committed',revision,generationId,head:{revision,generationId}};
   }
   this.#db.exec('COMMIT');return result;
  }catch(error){this.#db.exec('ROLLBACK');throw error;}
 }
}
function race(filename,limits,scope,requests){
 // Independent SQLite connections in independent threads. Both wait on
 // the same barrier before competing to publish the same base revision.
 const gate=new SharedArrayBuffer(4),flag=new Int32Array(gate);
 const workers=[];let ready=0;
 const source=`
 const {parentPort,workerData}=require('node:worker_threads');
 const {SqliteGenerationStore}=require(workerData.modulePath);
 const store=new SqliteGenerationStore(workerData.filename,workerData.limits,
  value=>value?.schemaVersion===1&&value.run&&typeof value.run==='object');
 try{
  parentPort.postMessage({ready:true});
  if(Atomics.wait(new Int32Array(workerData.gate),0,0,15000)==='timed-out')throw Error('race barrier timeout');
  parentPort.postMessage({result:store.publish(workerData.scope,workerData.request)});
 }finally{store.close();}
 `;
 const jobs=requests.map(request=>new Promise((resolve,reject)=>{
  const worker=new Worker(source,{eval:true,workerData:{modulePath:__filename,filename,limits,scope,request,gate}});
  workers.push(worker);let result;
  worker.on('message',message=>{
   if(message.ready&&++ready===requests.length){Atomics.store(flag,0,1);Atomics.notify(flag,0);}
   if(message.result)result=message.result;
  });
  worker.once('error',reject);
  worker.once('exit',code=>code===0&&result?resolve(result):reject(Error('SQLite contender exit '+code)));
 }));
 return Promise.all(jobs).finally(()=>Promise.all(workers.map(w=>w.terminate())));
}
async function auditSqlitePublication(fixtures,limits,shape){
 const dir=mkdtempSync(path.join(tmpdir(),'rpchess-save-audit-')),filename=path.join(dir,'save.sqlite');
 let store;
 const scope='audit-A',other='audit-B',[first,competing,next]=fixtures;
 const request=(g,expectedRevision,operationId)=>({generationId:g.manifest.generationId,expectedRevision,operationId});
 const stage=(s,g,parts=g.chunks)=>{store.stageManifest(s,g.manifest);for(const c of parts)store.stageChunk(s,c);};
 const sql=fn=>{const db=new DatabaseSync(filename);try{db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000');return fn(db);}finally{db.close();}};
 try{
  store=new SqliteGenerationStore(filename,limits,shape);
  stage(scope,first);assert.equal(store.publish(scope,request(first,0,'initial')).revision,1);
  stage(scope,next,next.chunks.slice(0,1));
  assert.throws(()=>store.publish(scope,request(next,1,'partial')),/incomplete/);
  store.close();store=null;store=new SqliteGenerationStore(filename,limits,shape);
  assert.equal(store.read(scope).json,first.json);
  assert.equal(store.read(scope,2),null);
  assert.equal(store.read(other),null);
  assert.throws(()=>store.publish(other,request(first,0,'initial')),/unknown generation/);
  stage(scope,next);stage(scope,competing);
  // Fail after revision/head INSERT but before receipt INSERT; transaction
  // must undo all writes. Trigger exists only in this temporary database.
  sql(db=>db.exec("CREATE TRIGGER audit_failure BEFORE INSERT ON receipts WHEN NEW.operation='fault' BEGIN SELECT RAISE(ABORT,'injected failure'); END;"));
  assert.throws(()=>store.publish(scope,request(next,1,'fault')),/injected failure/);
  assert.equal(store.head(scope).revision,1);assert.equal(store.read(scope,2),null);
  assert.equal(store.read(scope).json,first.json);
  sql(db=>db.exec('DROP TRIGGER audit_failure'));
  const requests=[request(next,1,'device-A'),request(competing,1,'device-B')];
  const outcomes=await race(filename,limits,scope,requests);
  assert.deepEqual(outcomes.map(x=>x.status).sort(),['committed','conflict']);
  const winner=outcomes.findIndex(x=>x.status==='committed'),loser=1-winner;
  const winning=winner===0?next:competing,losing=winner===0?competing:next;
  assert.equal(store.read(scope).json,winning.json);
  assert.equal(store.publish(scope,requests[winner]).status,'replayed');
  assert.equal(store.publish(scope,{...requests[loser],expectedRevision:2}).revision,3);
  const retry=store.publish(scope,requests[winner]);
  assert.equal(retry.revision,2);assert.equal(retry.head.revision,3);
  assert.equal(store.read(scope).json,losing.json);
  assert.throws(()=>store.publish(scope,request(first,3,requests[winner].operationId)),/operation ID conflict/);
  assert.equal(store.publish(scope,request(losing,3,'unchanged')).revision,3);
  // Abrupt process exit with an open transaction after changing the head;
  // reopening must recover the last committed version from SQLite journal.
  store.close();store=null;
  execFileSync(process.execPath,['-e',
   "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);db.exec('BEGIN IMMEDIATE');db.prepare('UPDATE heads SET revision=1 WHERE scope=?').run(process.argv[2]);process.exit(0);",
   filename,scope],{stdio:'pipe'});
  store=new SqliteGenerationStore(filename,limits,shape);
  assert.equal(store.head(scope).revision,3);
  assert.equal(store.read(scope).json,losing.json);
  assert.equal(store.read(scope,1).json,first.json);
  assert.equal(store.read(scope,2).json,winning.json);
  stage(other,first);assert.equal(store.publish(other,request(first,0,'initial')).revision,1);
  assert.equal(store.read(other).json,first.json);
  assert.equal(store.read(scope).json,losing.json);
  assert.equal(sql(db=>db.prepare('PRAGMA integrity_check').get().integrity_check),'ok');
  assert.deepEqual(sql(db=>db.prepare('PRAGMA foreign_key_check').all()),[]);
  return {checks:'partial upload survives reopen; transaction rollback after head update; two competing connections; idempotent receipt; late retry; previous revisions; abrupt process exit; scope isolation; SQLite integrity and foreign keys',
   competingStatuses:outcomes.map(x=>x.status),finalRevision:3,otherRevision:1,
   scope:'temporary on-disk SQLite only, not Cloudflare D1'};
 }finally{if(store)store.close();rmSync(dir,{recursive:true,force:true});}
}
module.exports={SqliteGenerationStore,auditSqlitePublication};
