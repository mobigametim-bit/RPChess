/* IndexedDB experiment: independent audit DB, not the synchronous game store.
 * No localStorage changes, migration, cleanup or cloud sync. */
import {unpackWeb} from './__audit-save-web-codec.mjs';
function scopeKey(scope){
 if(typeof scope!=='string'||!scope||scope.length>128)throw Error('invalid scope');
 return scope;
}
function complete(tx){
 return new Promise((resolve,reject)=>{
  tx.oncomplete=()=>resolve();
  tx.onabort=()=>reject(tx.error||Error('transaction aborted'));
 });
}
function openAuditDatabase(name){
 if(typeof name!=='string'||!name.startsWith('rpchess-audit-'))throw Error('audit database required');
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(name,1);
  req.onupgradeneeded=()=>{
   req.result.createObjectStore('heads',{keyPath:'scope'});
   req.result.createObjectStore('snapshots',{keyPath:['scope','revision']});
  };
  req.onerror=()=>reject(req.error);
  req.onblocked=()=>reject(Error('audit database blocked'));
  req.onsuccess=()=>resolve(req.result);
 });
}
async function openAuditStore(name,limits,shape){
 const db=await openAuditDatabase(name);
 db.onversionchange=()=>db.close();
 const budget={...limits};
 return {
  close:()=>db.close(),
  async publish(scope,expectedRevision,envelope,{abortBeforeCommit=false}={}){
   scopeKey(scope);
   if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER)
    throw Error('invalid expected revision');
   // Copy and validate before entering the transaction. Do not await a
   // compression/crypto operation while an IndexedDB transaction is active.
   const candidate={codecVersion:envelope?.codecVersion,encoding:envelope?.encoding,
    decodedBytes:envelope?.decodedBytes,sha256:envelope?.sha256,data:envelope?.data};
   await unpackWeb(candidate,budget,shape);
   const tx=db.transaction(['heads','snapshots'],'readwrite',{durability:'strict'});
   const done=complete(tx),heads=tx.objectStore('heads'),snapshots=tx.objectStore('snapshots');
   let result;
   const request=heads.get(scope);
   request.onsuccess=()=>{
    const head=request.result||{scope,revision:0};
    if(head.revision!==expectedRevision){result={status:'conflict',revision:head.revision};return;}
    if(head.sha256===candidate.sha256&&head.decodedBytes===candidate.decodedBytes){
     result={status:'unchanged',revision:head.revision};return;
    }
    const revision=expectedRevision+1;
    snapshots.add({scope,revision,envelope:candidate});
    const update=heads.put({scope,revision,sha256:candidate.sha256,decodedBytes:candidate.decodedBytes});
    // Fault injection only, after both writes succeed but before commit.
    if(abortBeforeCommit)update.onsuccess=()=>tx.abort();
    result={status:'committed',revision};
   };
   await done;
   return result;
  },
  async read(scope,revision=null){
   scopeKey(scope);
   const tx=db.transaction(['heads','snapshots'],'readonly'),done=complete(tx);
   const snapshots=tx.objectStore('snapshots');let row,headRevision;
   const fetchRevision=rev=>{
    headRevision=rev;
    if(!rev)return;
    const req=snapshots.get([scope,rev]);req.onsuccess=()=>{row=req.result;};
   };
   if(revision===null){
    const req=tx.objectStore('heads').get(scope);req.onsuccess=()=>fetchRevision(req.result?.revision);
   }else fetchRevision(revision);
   await done;
   if(!row){
    if(revision===null&&headRevision)throw Error('committed snapshot missing');
    return null;
   }
   return {revision:row.revision,json:await unpackWeb(row.envelope,budget,shape)};
  }
 };
}
export {openAuditStore};
