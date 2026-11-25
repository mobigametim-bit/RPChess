/* Opt-in measurement, not a gameplay regression gate or a migration.
 * Synthetic completed encounters use production route data and persistence;
 * omit fog, roads, economy receipts and conquests to isolate cell growth.
 * All storage is process-local; no requests or actual player data. */
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const fs=require('node:fs');
const {gzipSync,gunzipSync}=require('node:zlib');
const {pack,unpack}=require('./audit-save-codec.cjs');
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
 const report=[],ownershipReport=[],roadReport=[],signatureReport=[];
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
 console.log('SAVE_GROWTH_AUDIT '+JSON.stringify({profileLimit,chunkLimit,codecLimits,codecChecks:'exact roundtrip and malformed/oversized rejection passed',report,ownershipReport,roadReport,signatureReport,
  replay:{plies:moves.length,oldEngineMoveCalls:moves.length*(moves.length+1)/2,
   incrementalEngineMoveCalls:moves.length,replayMs,incrementalMs},
  limitations:'synthetic route-only cells; no fog/roads/hero match history; gzip sizes exclude protocol metadata and are not accepted by current server; Node runner timings, not mobile browser or end-to-end battle'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
