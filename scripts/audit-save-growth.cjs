/* Opt-in measurement, not a gameplay regression gate or a migration.
 * Synthetic completed encounters use production route data and persistence;
 * omit fog, roads, economy receipts and conquests to isolate cell growth.
 * All storage is process-local; no requests or actual player data. */
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const fs=require('node:fs');
const {gzipSync,gunzipSync}=require('node:zlib');
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
 const c=await load('game/js/cloud-save.mjs');
 const {ClassicChessEngine}=await load('game/js/classic-chess-engine.mjs');
 const worker=fs.readFileSync(path.resolve(__dirname,'../profile-worker/src/index.mjs'),'utf8');
 const profileLimit=Number(worker.match(/const MAX_SAVE_BYTES=(\d+)/)?.[1]);
 const cloudSource=fs.readFileSync(path.resolve(__dirname,'../game/js/cloud-save.mjs'),'utf8');
 const chunkLimit=Number(cloudSource.match(/const CLOUD_MAX_CHUNKS = (\d+)/)?.[1]);
 assert(profileLimit&&chunkLimit,'read current source limits');
 const run=p.createRun({id:'save-growth-audit',now:1000,playerName:'Audit'});
 const map=k.createKingdomMap(run,600,'humans');
 const cells={...map.cells};
 const types=['battle','skirmish','caravan','event','settlement','puzzle'];
 const report=[];
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
  const gzipProfileBase64Bytes=bytes(profileGzip.toString('base64url'));
  const gzipVkChunks=Math.ceil(bytes(vkGzip.toString('base64url'))/c.CLOUD_CHUNK_BYTES);
  const vkBytes=bytes(c.encodeCloudPayload(envelope));
  const vkChunks=Math.ceil(vkBytes/c.CLOUD_CHUNK_BYTES);
  report.push({encounters:target,cells:Object.keys(cells).length,localBytes,profileBytes,
   profileFits:profileBytes<=profileLimit,vkChunks,vkFits:vkChunks<=chunkLimit,
   gzipProfileBytes:profileGzip.length,gzipProfileBase64Bytes,gzipVkChunks,
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
 console.log('SAVE_GROWTH_AUDIT '+JSON.stringify({profileLimit,chunkLimit,report,
  replay:{plies:moves.length,oldEngineMoveCalls:moves.length*(moves.length+1)/2,
   incrementalEngineMoveCalls:moves.length,replayMs,incrementalMs},
  limitations:'synthetic route-only cells; no fog/roads/hero match history; gzip sizes exclude protocol metadata and are not accepted by current server; Node runner timings, not mobile browser or end-to-end battle'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
