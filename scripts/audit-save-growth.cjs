/* Opt-in measurement, not a gameplay regression gate or a migration.
 * Synthetic completed encounters use production route data and persistence;
 * omit fog, roads, economy receipts and conquests to isolate cell growth.
 * All storage is process-local; no requests or actual player data. */
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const fs=require('node:fs');
const {gzipSync,gunzipSync}=require('node:zlib');
const {pack,unpack}=require('./audit-save-codec.cjs');
const {splitGeneration,restoreGeneration}=require('./audit-save-generation.cjs');
const {MemoryGenerationStore}=require('./audit-save-publication.cjs');
const {auditSqlitePublication}=require('./audit-save-sqlite.cjs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
class MemoryStorage{
 constructor(){this.data=new Map();}
 getItem(k){return this.data.get(k)??null;}
 setItem(k,v){this.data.set(k,String(v));}
 removeItem(k){this.data.delete(k);}
}
const bytes=v=>Buffer.byteLength(typeof v==='string'?v:JSON.stringify(v),'utf8');
const load=relative=>import(pathToFileURL(path.resolve(__dirname,'..',relative)).href);
function medianMs(fn,count=5){
 const times=[];
 for(let i=0;i<count;i++){const t=performance.now();fn();times.push(performance.now()-t);}
 return Number(times.sort((a,b)=>a-b)[Math.floor(count/2)].toFixed(2));
}
(async()=>{
 globalThis.localStorage=new MemoryStorage();
 const p=await load('game/js/run-persistence.mjs');
 const k=await load('game/js/kingdom-map-core.mjs');
 const roadGraph=await load('game/js/kingdom-road-network.mjs');
 const c=await load('game/js/cloud-save.mjs');
 const {ClassicChessEngine}=await load('game/js/classic-chess-engine.mjs');
 const {shapeOfSnapshot}=await load('profile-worker/src/index.mjs');
 const {supported,packWeb,unpackWeb}=await load('scripts/audit-save-web-codec.mjs');
 assert(supported(),'CI Web compression APIs must be available');
 const webCodecReport=[],generationReport=[];
 const publicationFixtures=[];
 let publicationReport=null,sqlitePublicationReport=null;
 // Experimental budgets cover these synthetic fixtures only.
 const codecLimits={maxDecodedBytes:16*1024*1024,maxEncodedBytes:2*1024*1024};
 const validVKEnvelope=value=>Boolean(value?.schemaVersion===1&&Number.isSafeInteger(value.revision)&&value.revision>=0&&
  Number.isFinite(value.updatedAt)&&value.payload&&typeof value.payload==='object'&&!Array.isArray(value.payload)&&
  shapeOfSnapshot({...value.payload,schemaVersion:1}));
 const worker=fs.readFileSync(path.resolve(__dirname,'../profile-worker/src/index.mjs'),'utf8');
 const profileLimit=Number(worker.match(/const MAX_SAVE_BYTES=(\d+)/)?.[1]);
 const cloudSource=fs.readFileSync(path.resolve(__dirname,'../game/js/cloud-save.mjs'),'utf8');
 const chunkLimit=Number(cloudSource.match(/const CLOUD_MAX_CHUNKS = (\d+)/)?.[1]);
 assert(profileLimit&&chunkLimit,'read current source limits');
 const run=p.createRun({id:'save-growth-audit',now:1000,playerName:'Audit'});
 const map=k.createKingdomMap(run,600,'humans');
 const cells={...map.cells};
 const types=['battle','skirmish','caravan','event','settlement','puzzle'];
 const report=[],ownershipReport=[],roadReport=[],signatureReport=[],richSaveReport=[];
 const historyEngine=new ClassicChessEngine(),historyMoves=[];
 while(historyMoves.length<80&&!historyEngine.status().over){
  const legal=historyEngine.legalMoves();if(!legal.length)break;
  const m=legal[(historyMoves.length*73+17)%legal.length];
  assert(historyEngine.move(m.from,m.uciTo||m.to,m.promotion||null).ok);
  historyMoves.push({uci:[m.from,m.uciTo||m.to,m.promotion||''].join(''),grade:null});
 }
 let n=0;
 for(const target of [100,500,1000,5000,10000]){
  for(;n<target;n++){
   const x=n%100+1,y=Math.floor(n/100)+1,id=k.keyOf(x,y);
   const selectedEncounter=k.randomEncounter({...run,kingdomMap:map,journeyStep:n},{x,y},600,
    {type:types[n%types.length],biome:'plains',landmark:null,raceTag:'humans'});
   cells[id]={status:'completed',completedOnce:true,explored:true,annexed:false,selectedEncounter,
    discoveredAt:1000+n,lastEntryFrom:{x:x-1,y}};
  }
  const sample={...run,journeyStep:target,kingdomMap:{...map,cells:{...cells},
    completedNewEncounterCount:target}};
  assert(p.isValidRun(sample),'fixture must pass production validation');
  p.writeRun(sample,null,1000+target);
  assert.equal(p.readRun().kingdomMap.completedNewEncounterCount,target);
  // Synthetic dense sovereignty fixture, separate from the route-only save
  // baseline. Include index construction in the measured render operation.
  const dense={...sample.kingdomMap,centralOwnedCells:Object.keys(cells)};
  const points=Array.from({length:400},(_,i)=>({x:85+i%20,y:Math.max(0,Math.floor(target/100)-10)+Math.floor(i/20)}));
  const direct=()=>({count:k.playerTerritoryCount(dense),tiles:points.map(point=>{
   const owned=k.isOwned(dense,point);
   return [owned,owned?k.borderEdges(dense,point):[]];
  })});
  const indexed=()=>{const keys=k.playerTerritoryKeys(dense);return {count:keys.size,tiles:points.map(point=>{
   const owned=keys.has(k.keyOf(point.x,point.y));
   return [owned,owned?k.borderEdges(dense,point,keys):[]];
  })};};
  assert.deepStrictEqual(indexed(),direct(),'indexed map ownership and border parity');
  ownershipReport.push({territories:k.playerTerritoryCount(dense),viewportCells:points.length,
   directMedianMs:medianMs(direct),indexedMedianMs:medianMs(indexed)});
  // Isolate worst-case repeated connectivity queries on a synthetic long
  // cardinal chain. Same royal/travel inputs for historical BFS and new index.
  const chain=Array.from({length:target+1},(_,i)=>i+',0');
  const chainMap={...map,royalRoadsVersion:3,centralOwnedCells:chain,
   royalRoads:chain.slice(1).map((id,i)=>({from:chain[i],to:id,bend:0})),
   completedRoads:chain.slice(2).map((id,i)=>({id:'audit-road:'+i,from:chain[0],to:id,bend:.4}))};
  const oldConnectedCount=()=>{
   const royal=roadGraph.visibleRoyalRoads(chainMap),owned=roadGraph.ownedKeys(chainMap);
   const adj=new Map();
   for(const r of royal)for(const [a,b] of [[r.from,r.to],[r.to,r.from]]){
    if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);
   }
   let visible=0;
   for(const r of chainMap.completedRoads){
    if(!owned.has(r.from)||!owned.has(r.to)){visible++;continue;}
    const queue=[r.from],visited=new Set(queue);let connected=false;
    for(let i=0;i<queue.length;i++){
     if(queue[i]===r.to){connected=true;break;}
     for(const next of adj.get(queue[i])||[])if(!visited.has(next)){visited.add(next);queue.push(next);}
    }
    if(!connected)visible++;
   }
   return visible;
  };
  // Cap the diagnostic's repeated BFS workload, while still exercising the
  // full 10000-edge graph with the indexed production path.
  if(target<=1000){
   assert.equal(roadGraph.visibleTravelRoads(chainMap).length,oldConnectedCount());
   roadReport.push({royalEdges:target,queries:target-1,
    oldBfsMedianMs:medianMs(oldConnectedCount,3),
    indexedMedianMs:medianMs(()=>roadGraph.visibleTravelRoads(chainMap),3)});
  }else{
   assert.equal(roadGraph.visibleTravelRoads(chainMap).length,0);
   roadReport.push({royalEdges:target,queries:target-1,oldBfsMedianMs:null,
    indexedMedianMs:medianMs(()=>roadGraph.visibleTravelRoads(chainMap),3)});
  }
  // Measure only signature construction on the same unchanged world, not
  // Canvas repaint, DOM, or the cost of JSON parsing the save.
  const signatureMap=sample.kingdomMap,view={x:0,y:0},WIDTH=15,HEIGHT=11;
  const oldSignature=()=>JSON.stringify([signatureMap.seed,signatureMap.worldGeneratorVersion,
   view.x,view.y,WIDTH,HEIGHT,signatureMap.royalRoadsSignature,signatureMap.royalRoads,
   signatureMap.completedRoads,signatureMap.outpostRoads,signatureMap.centralOwnedCells,
   signatureMap.battleConqueredCells,signatureMap.outposts,signatureMap.battleTerritories,
   Object.entries(signatureMap.cells).map(([id,cell])=>
    [id,cell?.explored===true,cell?.annexed===true,cell?.status||''])]);
  const compactSignature=()=>k.staticMapSignature(signatureMap,view,WIDTH,HEIGHT);
  const compact=compactSignature();
  assert.equal(compact,k.staticMapSignature(JSON.parse(JSON.stringify(signatureMap)),view,WIDTH,HEIGHT));
  signatureReport.push({cells:Object.keys(signatureMap.cells).length,
   oldBytes:bytes(oldSignature()),compactBytes:bytes(compact),
   oldMedianMs:medianMs(oldSignature),compactMedianMs:medianMs(compactSignature)});
  const localBytes=bytes(localStorage.getItem(p.RUN_STORAGE_KEY));
  const payload=c.localPayload();
  const profileJson=JSON.stringify({...payload,schemaVersion:1});
  const profileBytes=bytes(profileJson);
  const envelope=JSON.stringify({schemaVersion:1,revision:1,updatedAt:1000+target,payload});
  // Candidate wire format only: compressed exact JSON, with ASCII transport.
  // No change to actual client/server encoding or on-disk format.
  const profileGzip=gzipSync(profileJson),vkGzip=gzipSync(envelope);
  assert.equal(gunzipSync(profileGzip).toString('utf8'),profileJson,'lossless profile compression');
  assert.equal(gunzipSync(vkGzip).toString('utf8'),envelope,'lossless VK compression');
  const packedProfile=pack(profileJson,codecLimits),packedVK=pack(envelope,codecLimits);
  assert.equal(unpack(packedProfile,codecLimits,shapeOfSnapshot),profileJson,'bounded profile codec exact roundtrip');
  assert.equal(unpack(packedVK,codecLimits,validVKEnvelope),envelope,'bounded VK codec exact roundtrip');
  if(target===100){
   assert.throws(()=>unpack({...packedProfile,codecVersion:2},codecLimits,shapeOfSnapshot));
   assert.throws(()=>unpack({...packedProfile,sha256:'0'.repeat(64)},codecLimits,shapeOfSnapshot),/checksum/);
   assert.throws(()=>unpack({...packedProfile,data:packedProfile.data.slice(0,-4)},codecLimits,shapeOfSnapshot));
   assert.throws(()=>unpack({...packedProfile,decodedBytes:32},codecLimits,shapeOfSnapshot),'forged short length must stop inflate');
   assert.throws(()=>unpack(packedProfile,{...codecLimits,maxDecodedBytes:packedProfile.decodedBytes-1},shapeOfSnapshot));
   assert.throws(()=>unpack(packedProfile,{...codecLimits,maxEncodedBytes:packedProfile.data.length-1},shapeOfSnapshot));
   assert.throws(()=>unpack(pack('{"schemaVersion":2}',codecLimits),codecLimits,shapeOfSnapshot),/shape/);
   assert.throws(()=>unpack(pack('not JSON',codecLimits),codecLimits,shapeOfSnapshot),SyntaxError);
  }
  const gzipProfileBase64Bytes=bytes(profileGzip.toString('base64url'));
  const gzipVkChunks=Math.ceil(bytes(vkGzip.toString('base64url'))/c.CLOUD_CHUNK_BYTES);
  const vkBytes=bytes(c.encodeCloudPayload(envelope));
  const vkChunks=Math.ceil(vkBytes/c.CLOUD_CHUNK_BYTES);
  report.push({encounters:target,cells:Object.keys(cells).length,localBytes,profileBytes,
   profileFits:profileBytes<=profileLimit,vkChunks,vkFits:vkChunks<=chunkLimit,
   gzipProfileBytes:profileGzip.length,gzipProfileBase64Bytes,gzipVkChunks,
   codecProfileEnvelopeBytes:bytes(packedProfile),codecVKEnvelopeBytes:bytes(packedVK),
   gzipMedianMs:medianMs(()=>gzipSync(profileJson),3),
   gunzipMedianMs:medianMs(()=>gunzipSync(profileGzip),3),
   readMedianMs:medianMs(()=>p.readRun()),
   writeMedianMs:medianMs(()=>p.writeRun(sample,null,1000+target))});
  // Separate enriched synthetic snapshot; not a replay of a real player's
  // campaign. Keep the original baseline untouched for comparability.
  const richCells={...sample.kingdomMap.cells},completedRoads=[],calendarActions=[],
   productionClaims=[],uniqueFirstConquests=[],battleConqueredCells=[];
  let previousId=null;
  for(let i=0;i<target;i++){
   const x=i%100+1,y=Math.floor(i/100)+1,id=k.keyOf(x,y),cell=richCells[id],choice=cell.selectedEncounter;
   // Obtain the exact canonical single-edge geometry without O(n^2) copying
   // of an ever-growing receipt array while constructing this fixture.
   const linked=k.linkCompletedRoad({...map,lastCompletedRouteCell:previousId,completedRoads:[]},id);
   if(linked.completedRoads.length)completedRoads.push(linked.completedRoads[0]);
   previousId=id;calendarActions.push('complete:'+id+':1:success');
   if(i%5===0){
    const fogId=k.keyOf(x,-y);
    richCells[fogId]={status:'revealed',explored:false,annexed:false,biome:'plains',
     selectedEncounter:k.randomEncounter({...run,kingdomMap:map,journeyStep:i},
      {x,y:-y},600,{type:'event',biome:'plains',landmark:null,raceTag:'humans'})};
   }
   if(['battle','skirmish','caravan'].includes(choice.type)){
    const enemyPower=600,divisor={battle:200,skirmish:400,caravan:300}[choice.type];
    uniqueFirstConquests.push({encounterId:choice.id,type:choice.type,enemyPower,
     bonusLands:choice.type==='battle'?0:Math.floor(enemyPower/divisor)});
    if(choice.type==='battle')battleConqueredCells.push(id);
   }
   if(i%12===0&&choice.type==='battle'){
    const item=k.productionFor(sample.kingdomMap,id,choice.type,2);
    if(item)richCells[id]={...cell,production:item,respawnReady:item.kind==='battle'};
   }
   if(i%12===3&&choice.type==='event'){
    const item=k.productionFor(sample.kingdomMap,id,choice.type,2);
    if(item){richCells[id]={...cell,annexed:true};productionClaims.push(item.id);}
   }
  }
  const historyCount=Math.min(20,Math.ceil(target/100)),receipts=[];
  let named=0;
  const roster=run.roster.map(hero=>{
   if(hero.isRunKing||named>=3)return hero;
   named++;
   const history=Array.from({length:historyCount},(_,i)=>{
    const receiptId=[run.id,'weekly-battle',i+1,'1,1',hero.id].join(':');
    receipts.push(receiptId);
    return {receiptId,week:i+1,cellId:'1,1',enemyLevel:4,heroLevel:hero.threatLevel,
     result:'draw',moves:historyMoves,gold:0,mastery:0};
   });
   return {...hero,weeklyCommandedWeek:historyCount,
    weeklyBattleStats:{wins:0,draws:historyCount,losses:0,highestDefeatedThreat:0},
    weeklyBattleHistory:history};
  });
  const richMap={...sample.kingdomMap,cells:richCells,day:Math.max(target+1,historyCount*7+1),
   completedRoads,lastCompletedRouteCell:previousId,calendarActions,productionClaims,
   uniqueFirstConquests,creditedBattleEncounterIds:uniqueFirstConquests.map(c=>c.encounterId),battleConqueredCells};
  const rich={...sample,kingdomMap:richMap,roster,weeklyDefenders:{active:null,receipts}};
  assert(p.isValidRun(rich),'enriched fixture passes production run validation');
  const richStore=new MemoryStorage();
  p.writeRun(rich,richStore,1000+target);
  const restored=p.readRun(richStore);
  assert.deepEqual(restored.kingdomMap,richMap,'local persistence preserves enriched map');
  const compactRun=c.compactRun(restored),expanded=c.expandRun(compactRun);
  for(const hero of roster.filter(h=>h.weeklyBattleHistory?.length)){
   assert.deepEqual(restored.roster.find(h=>h.id===hero.id).weeklyBattleHistory,hero.weeklyBattleHistory);
   assert.deepEqual(expanded.roster.find(h=>h.id===hero.id).weeklyBattleHistory,hero.weeklyBattleHistory);
  }
  const richPayload={...payload,run:compactRun};
  const richProfile=JSON.stringify({...richPayload,schemaVersion:1});
  const richVK=JSON.stringify({schemaVersion:1,revision:1,updatedAt:1000+target,payload:richPayload});
  const packedRich=pack(richProfile,codecLimits),packedRichVK=pack(richVK,codecLimits);
  assert.equal(unpack(packedRich,codecLimits,shapeOfSnapshot),richProfile);
  assert.equal(unpack(packedRichVK,codecLimits,validVKEnvelope),richVK);
  // Interoperate with the Node reference codec in both directions, using
  // the actual Web Streams and SubtleCrypto APIs in the Node 22 runner.
  const webStart=performance.now(),webPacked=await packWeb(richProfile,codecLimits);
  const webPackMs=performance.now()-webStart,webReadStart=performance.now();
  assert.equal(await unpackWeb(packedRich,codecLimits,shapeOfSnapshot),richProfile);
  const webUnpackMs=performance.now()-webReadStart;
  assert.equal(unpack(webPacked,codecLimits,shapeOfSnapshot),richProfile);
  assert.equal(await unpackWeb(webPacked,codecLimits,shapeOfSnapshot),richProfile);
  if(target===100){
   assert.equal(await unpackWeb(await packWeb(richVK,codecLimits),codecLimits,validVKEnvelope),richVK);
   const unicode=JSON.stringify({schemaVersion:1,run:{playerName:'Шахматы ♟️ 👑'}});
   assert.equal(await unpackWeb(pack(unicode,codecLimits),codecLimits,shapeOfSnapshot),unicode);
   assert.equal(unpack(await packWeb(unicode,codecLimits),codecLimits,shapeOfSnapshot),unicode);
   await assert.rejects(unpackWeb({...webPacked,codecVersion:2},codecLimits,shapeOfSnapshot));
   await assert.rejects(unpackWeb({...webPacked,sha256:'0'.repeat(64)},codecLimits,shapeOfSnapshot),/checksum/);
   await assert.rejects(unpackWeb({...webPacked,data:webPacked.data.slice(0,-4)},codecLimits,shapeOfSnapshot));
   await assert.rejects(unpackWeb({...webPacked,decodedBytes:32},codecLimits,shapeOfSnapshot),/budget/);
   await assert.rejects(unpackWeb(webPacked,{...codecLimits,maxDecodedBytes:webPacked.decodedBytes-1},shapeOfSnapshot));
   await assert.rejects(unpackWeb(webPacked,{...codecLimits,maxEncodedBytes:webPacked.data.length-1},shapeOfSnapshot));
   await assert.rejects(packWeb(richProfile,{...codecLimits,maxEncodedBytes:32}),/budget/);
   await assert.rejects(unpackWeb(await packWeb('{"schemaVersion":2}',codecLimits),codecLimits,shapeOfSnapshot),/shape/);
  }
  webCodecReport.push({encounters:target,decodedBytes:webPacked.decodedBytes,
   envelopeBytes:bytes(webPacked),packMs:Number(webPackMs.toFixed(2)),unpackMs:Number(webUnpackMs.toFixed(2))});
  // Transport-format prototype only: chunks contain the compressed ASCII
  // payload, not a gameplay slice. No deletion, storage or network request.
  const generationLimits={...codecLimits,maxChunkBytes:96*1024,maxChunks:32};
  const {manifest,chunks}=splitGeneration(webPacked,generationLimits);
  assert.equal(restoreGeneration(manifest,chunks,generationLimits,shapeOfSnapshot),richProfile);
  if(target===1000){
   const other=splitGeneration(pack(JSON.stringify({schemaVersion:1,run:{id:'other'}}),codecLimits),generationLimits);
   assert(chunks.length>1,'multi-chunk fixture required');
   assert.throws(()=>restoreGeneration(manifest,chunks.slice(0,-1),generationLimits,shapeOfSnapshot),/incomplete/);
   assert.throws(()=>restoreGeneration(manifest,[...chunks].reverse(),generationLimits,shapeOfSnapshot),/chunk/);
   assert.throws(()=>restoreGeneration(manifest,[chunks[0],chunks[0]],generationLimits,shapeOfSnapshot),/chunk/);
   assert.throws(()=>restoreGeneration(manifest,[other.chunks[0],...chunks.slice(1)],generationLimits,shapeOfSnapshot),/chunk/);
   const damaged={...chunks[0],data:(chunks[0].data[0]==='A'?'B':'A')+chunks[0].data.slice(1)};
   assert.throws(()=>restoreGeneration(manifest,[damaged,...chunks.slice(1)],generationLimits,shapeOfSnapshot),/chunk/);
   assert.throws(()=>restoreGeneration({...manifest,chunkHashes:manifest.chunkHashes.map(()=> '0'.repeat(64))},chunks,generationLimits,shapeOfSnapshot),/checksum/);
   assert.throws(()=>restoreGeneration(manifest,chunks,{...generationLimits,maxChunks:1},shapeOfSnapshot));
  }
  if(target<=1000)publicationFixtures.push({manifest,chunks,json:richProfile});
  if(target===1000){
   const [first,competing,next]=publicationFixtures;
   const store=new MemoryGenerationStore(generationLimits,shapeOfSnapshot);
   const scope='audit-profile-A',otherScope='audit-profile-B';
   const stage=(account,generation,parts=generation.chunks)=>{
    store.stageManifest(account,generation.manifest);
    for(const chunk of parts)store.stageChunk(account,chunk);
   };
   const request=(generation,expectedRevision,operationId)=>({generationId:generation.manifest.generationId,expectedRevision,operationId});
   stage(scope,first);
   assert.equal(store.publish(scope,request(first,0,'initial')).revision,1);
   assert.equal(store.read(scope).json,first.json);
   assert.equal(store.read(otherScope),null,'other account sees no committed data');
   assert.throws(()=>store.publish(otherScope,request(first,0,'initial')),/unknown generation/);
   stage(scope,next,next.chunks.slice(0,1));
   assert.throws(()=>store.publish(scope,request(next,1,'upload-next')),/incomplete/);
   assert.equal(store.read(scope).json,first.json,'interrupted upload preserves last published data');
   assert.equal(store.head(scope).revision,1);
   assert.equal(store.read(scope,2),null,'staged generation is not a committed revision');
   const damaged={...next.chunks[1],data:'!'+next.chunks[1].data.slice(1)};
   assert.throws(()=>store.stageChunk(scope,damaged),/chunk/);
   stage(scope,competing);
   stage(scope,next,next.chunks.slice(1));
   store.stageChunk(scope,next.chunks[0]); // identical chunk retry is harmless
   assert.equal(store.read(scope).json,first.json,'complete staging alone is not publication');
   const nextRequest=request(next,1,'upload-next');
   assert.equal(store.publish(scope,nextRequest).revision,2);
   assert.equal(store.read(scope).json,next.json);
   assert.equal(store.publish(scope,nextRequest).status,'replayed','lost acknowledgement cannot double-commit');
   assert.equal(store.publish(scope,request(competing,1,'device-B')).status,'conflict');
   assert.equal(store.read(scope).json,next.json,'stale writer cannot overwrite latest data');
   assert.throws(()=>store.publish(scope,request(competing,2,'upload-next')),/operation ID conflict/);
   assert.equal(store.publish(scope,request(competing,2,'device-B')).revision,3);
   const lateRetry=store.publish(scope,nextRequest);
   assert.equal(lateRetry.revision,2);
   assert.equal(lateRetry.head.revision,3);
   assert.equal(store.read(scope).json,competing.json,'late retry cannot roll back newer revision');
   assert.equal(store.read(scope,1).json,first.json,'previous committed generation retained');
   assert.equal(store.read(scope,2).json,next.json);
   assert.equal(store.publish(scope,request(competing,3,'same-content')).revision,3);
   stage(otherScope,first);
   assert.equal(store.publish(otherScope,request(first,0,'initial')).revision,1);
   assert.equal(store.read(otherScope).json,first.json);
   assert.equal(store.read(scope).json,competing.json);
   publicationReport={checks:'partial upload, corrupt chunk, immutable retry, stale writer, lost acknowledgement, late retry, operation conflict, prior revision, no-op, account isolation',
    firstRevision:1,nextRevision:2,finalRevision:3,otherAccountRevision:1,scope:'in-memory sequential interleaving only'};
   sqlitePublicationReport=await auditSqlitePublication(publicationFixtures,generationLimits,shapeOfSnapshot);
  }
  generationReport.push({encounters:target,chunks:chunks.length,manifestBytes:bytes(manifest),
   largestChunkBytes:Math.max(...chunks.map(bytes)),totalStoredBytes:bytes(manifest)+chunks.reduce((sum,chunk)=>sum+bytes(chunk),0)});
  richSaveReport.push({encounters:target,cells:Object.keys(richCells).length,roads:completedRoads.length,
   historyEntries:receipts.length,historyPlies:receipts.length*historyMoves.length,productionClaims:productionClaims.length,
   localBytes:bytes(richStore.getItem(p.RUN_STORAGE_KEY)),profileBytes:bytes(richProfile),
   codecProfileEnvelopeBytes:bytes(packedRich),codecVKEnvelopeBytes:bytes(packedRichVK),
   rawVkChunks:Math.ceil(bytes(c.encodeCloudPayload(richVK))/c.CLOUD_CHUNK_BYTES),
   hypotheticalCodecVkChunks:Math.ceil(bytes(packedRichVK)/c.CLOUD_CHUNK_BYTES),
   readMedianMs:medianMs(()=>p.readRun(richStore),3),
   writeMedianMs:medianMs(()=>p.writeRun(rich,richStore,1000+target),3)});
 }
 // Isolate the old replay cost from UI, analysis, and storage. Actual legal
 // moves, deterministic selection; record the exact number before game ends.
 const seed=new ClassicChessEngine(),moves=[];
 while(moves.length<200&&!seed.status().over){
  const legal=seed.legalMoves();
  if(!legal.length)break;
  const m=legal[(moves.length*73+17)%legal.length];
  const uci=[m.from,m.uciTo||m.to,m.promotion||''].join('');
  assert(seed.move(uci.slice(0,2),uci.slice(2,4),uci[4]||null).ok);
  moves.push(uci);
 }
 const apply=(engine,uci)=>{assert(engine.move(uci.slice(0,2),uci.slice(2,4),uci[4]||null).ok);};
 const replay=()=>{for(let i=1;i<=moves.length;i++){const e=new ClassicChessEngine();for(let j=0;j<i;j++)apply(e,moves[j]);}};
 const incremental=()=>{const e=new ClassicChessEngine();for(const uci of moves)apply(e,uci);assert.equal(e.fen(),seed.fen());};
 const replayMs=medianMs(replay,3),incrementalMs=medianMs(incremental,3);
 console.log('SAVE_GROWTH_AUDIT '+JSON.stringify({profileLimit,chunkLimit,codecLimits,codecChecks:'exact roundtrip and malformed/oversized rejection passed',report,ownershipReport,roadReport,signatureReport,richSaveReport,webCodecReport,generationReport,publicationReport,sqlitePublicationReport,
  replay:{plies:moves.length,oldEngineMoveCalls:moves.length*(moves.length+1)/2,
   incrementalEngineMoveCalls:moves.length,replayMs,incrementalMs},
  limitations:'baseline route-only; enriched fixture includes synthetic fog, canonical single-edge road geometry, conquest/production receipts and up to 3 hero histories (legal move prefixes, not actual played matches); not full world generation or economy simulation; codec envelopes include metadata but not transport manifest, not accepted by current server; Node timings, not mobile or end-to-end frame time'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
