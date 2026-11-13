/* Weekly automatic economic buildings. Pure, replay-safe, map-seed driven. */
import {worldAt} from './kingdom-world-core.mjs';
import {randomAt} from './kingdom-parchment-core.mjs';
import {VISUAL} from './kingdom-world-config.mjs';
import {nearestNaturalPaths} from './kingdom-geography.mjs';
import {blockedConstructionCell} from './kingdom-site-occupancy.mjs';
import {hashString} from './travel-choice-core.mjs';
import {DEFAULT_KINGDOM_ECONOMY} from './kingdom-economy-config.mjs';

const BUILDING_TYPES=Object.freeze({
 farm:Object.freeze({biomes:['plains'],kind:'supplies'}),
 pasture:Object.freeze({biomes:['plains','hills'],kind:'supplies'}),
 fishing_pier:Object.freeze({biomes:['marsh'],kind:'supplies'}),
 hunting_lodge:Object.freeze({biomes:['forest'],kind:'supplies'}),
 gold_mine:Object.freeze({biomes:['mountain'],kind:'gold'}),
 stone_quarry:Object.freeze({biomes:['mountain','hills'],kind:'gold'}),
 sawmill:Object.freeze({biomes:['forest'],kind:'gold'}),
 oasis:Object.freeze({biomes:['wasteland'],kind:'supplies'})
});
const TYPES_BY_BIOME=Object.freeze(Object.fromEntries(
 ['plains','hills','forest','mountain','marsh','wasteland'].map(biome=>[
  biome,Object.freeze(Object.keys(BUILDING_TYPES).filter(type=>BUILDING_TYPES[type].biomes.includes(biome)))])));
const BUILDING_DIR='assets/kingdom-production/';
const INDUSTRY_ATLAS=BUILDING_DIR+'industry-atlas.png';
const INDUSTRY_ATLAS_ORDER=Object.freeze(['construction_site','farm','fishing_pier','gold_mine',
 'hunting_lodge','pasture','sawmill','stone_quarry','oasis']);
const KEY=/^-?\d+,-?\d+$/;
// The category 'marsh' is based on wetness, while the actual parchment art
// still stamps forest there. Fishing piers need a *visible* river beside them.
// Keep this aligned with drawWaterRoads() in kingdom-parchment-app.mjs,
// which uses the visual randomAt hash (not atlasRandom used for encounters).
function nearVisibleRiver(seed,x,y){
 return nearestNaturalPaths(seed,x+.5,y+.5).riverDistance<=.48;
}
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const key=(x,y)=>x+','+y;
function industryLevel(map){
 return Math.max(1,Math.min(5,Math.floor(Math.max(0,map?.peakKingPower||0)/500)+1));
}
function industryBase(kind){
 return kind==='gold'?DEFAULT_KINGDOM_ECONOMY.production.industryGold:
  kind==='supplies'?DEFAULT_KINGDOM_ECONOMY.production.industrySupplies:0;
}
function industryYield(building,map){
 const resource=BUILDING_TYPES[building?.kind]?.kind;
 return resource?{kind:resource,amount:industryBase(resource)*industryLevel(map)}:null;
}
function initialIndustry(processedWeek=0){
 return {buildings:[],processedWeek,pending:{},accruedGold:0,accruedSupplies:0,creditedGold:0,creditedSupplies:0};
}
function validIndustry(value){
 if(value==null)return true; // old saves before feature rollout
 if(!value||!Array.isArray(value.buildings)||!integer(value.processedWeek))return false;
 if(!['accruedGold','accruedSupplies','creditedGold','creditedSupplies'].every(field=>integer(value[field])))return false;
 if(value.creditedGold>value.accruedGold||value.creditedSupplies>value.accruedSupplies)return false;
 // Pre-manual-collection preview saves lack pending: their previously
 // automatic credits are already accounted for and must not be paid twice.
 if(value.pending!=null&&(!value.pending||typeof value.pending!=='object'||
    Array.isArray(value.pending)))return false;
 const seen=new Set();
 return value.buildings.every(b=>{
  if(!b||!KEY.test(b.id||'')||!BUILDING_TYPES[b.kind]||!integer(b.builtWeek)||
    b.builtWeek<1||b.builtWeek>value.processedWeek||seen.has(b.id))return false;
  seen.add(b.id);return true;
 })&&(value.pending==null||Object.entries(value.pending).every(([id,amount])=>
   seen.has(id)&&integer(amount)&&amount>0));
}
// Royal-road segments, historical completed-event roads and outpost roads
// reserve endpoints. Generated natural roads also prohibit construction.
function occupiedRoadCells(map){
 const occupied=new Set();
 for(const field of ['royalRoads','completedRoads','outpostRoads'])
  for(const road of map[field]||[])
   for(const id of [road.from,road.to])if(KEY.test(id||''))occupied.add(id);
 return occupied;
}
function candidateCells(map,industry=map?.industry){
 if(!map||!map.castle||!map.seed)return [];
 const owned=new Set([key(map.castle.x,map.castle.y),...(map.centralOwnedCells||[]),
  ...(map.battleConqueredCells||[]),
  ...(map.outposts||[]).flatMap(p=>p.cells||[]),
  ...Object.keys(map.cells||{}).filter(id=>map.cells[id]?.annexed)]);
 const occupied=occupiedRoadCells(map);
 for(const id of (industry?.buildings||[]).map(b=>b.id))occupied.add(id);
 for(const post of map.outposts||[])occupied.add(post.id);
 for(const settlement of map.builtSettlements||[])occupied.add(settlement.id);
 for(const [id,cell] of Object.entries(map.cells||{}))
  if(cell?.selectedEncounter||cell?.type==='castle'||cell?.type==='settlement')occupied.add(id);
 const available=[];
 for(const id of owned){
  if(!KEY.test(id)||occupied.has(id))continue;
  const [x,y]=id.split(',').map(Number);
  if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y))continue;
  const terrain=worldAt(map.seed,x,y,{generatorVersion:map.worldGeneratorVersion});
  if(!TYPES_BY_BIOME[terrain.biome]?.length||terrain.type||
     terrain.paths?.road||terrain.landmark||blockedConstructionCell(map,x,y))continue;
  // A wet cell with no drawn water is forest in the player's view.
  // Give it normal forest buildings instead of losing its weekly site.
  const industryBiome=terrain.biome==='marsh'&&!nearVisibleRiver(map.seed,x,y)?'forest':terrain.biome;
  available.push({id,biome:industryBiome});
 }
 return available.sort((a,b)=>a.id.localeCompare(b.id,'en'));
}
function selectConstruction(map,industry,week){
 const options=candidateCells(map,industry);
 if(!options.length)return null;
 const id=options[hashString(map.seed+':industry:cell:'+week)%options.length];
 const types=TYPES_BY_BIOME[id.biome].filter(type=>
  type!=='fishing_pier'||nearVisibleRiver(map.seed,...id.id.split(',').map(Number)));
 if(!types.length)return null;
 const kind=types[hashString(map.seed+':industry:type:'+week+':'+id.id)%types.length];
 return {id:id.id,kind,builtWeek:week};
}
// Reclassify legacy piers founded on wet forest tiles far from drawn water.
// Hunting lodges yield the same resource, so accrued/pending/credited amounts,
// site identity, construction date and collection receipts stay untouched.
function realignLandlockedPiers(map){
 if(!map?.industry?.buildings?.some(b=>b.kind==='fishing_pier'))return map;
 let changed=false;
 const buildings=map.industry.buildings.map(site=>{
  if(site.kind!=='fishing_pier')return site;
  const [x,y]=site.id.split(',').map(Number);
  if(nearVisibleRiver(map.seed,x,y))return site;
  changed=true;
  return {...site,kind:'hunting_lodge'};
 });
 return changed?{...map,industry:{...map.industry,buildings}}:map;
}
function settleIndustryWeek(map,week){
 const old=map.industry||initialIndustry(Math.max(0,week-1));
 if(!validIndustry(old))return map;
 if(week<=old.processedWeek)return map.industry?map:{...map,industry:old};
 let industry={...old,buildings:[...old.buildings],pending:{...(old.pending||{})}};
 // No instant payment for a brand-new site. One weekly payment per completed
 // site, then exactly one construction attempt for that week.
 for(let current=old.processedWeek+1;current<=week;current++){
  const level=industryLevel(map);
  for(const site of industry.buildings){
   if(site.builtWeek>=current)continue;
   const resource=BUILDING_TYPES[site.kind].kind;
   const gain=industryBase(resource)*level;
   industry.pending[site.id]=(industry.pending[site.id]||0)+gain;
   if(resource==='gold')industry.accruedGold+=gain;
   else industry.accruedSupplies+=gain;
  }
  const site=selectConstruction(map,industry,current);
  if(site)industry.buildings.push(site);
  industry.processedWeek=current;
 }
 return {...map,industry};
}
// Uncollected weekly yields stay above each finished building even across
// saves and skipped weeks. The amount is frozen when its week is processed.
function industryPending(map,id){
 const state=map?.industry;
 const amount=state?.pending?.[id]||0;
 const site=state?.buildings?.find(b=>b.id===id);
 if(!site||site.builtWeek>=state.processedWeek||!integer(amount)||!amount)return null;
 return {kind:BUILDING_TYPES[site.kind].kind,amount};
}
function collectIndustry(map,id){
 if(!validIndustry(map?.industry))return {ok:false,map};
 const available=industryPending(map,id);
 if(!available)return {ok:false,map};
 const old=map.industry,pending={...old.pending};
 delete pending[id];
 const total=available.kind==='gold'?'creditedGold':'creditedSupplies';
 const industry={...old,pending,[total]:old[total]+available.amount};
 if(!validIndustry(industry))return {ok:false,map};
 return {ok:true,map:{...map,industry},...available,
  receiptId:'industry:'+id+':'+old.processedWeek};
}
function industrySprite(){return INDUSTRY_ATLAS;}
function industrySpriteIndex(site,week){
 return INDUSTRY_ATLAS_ORDER.indexOf(site.builtWeek>=week?'construction_site':site.kind);
}
export {BUILDING_TYPES,TYPES_BY_BIOME,BUILDING_DIR,INDUSTRY_ATLAS,INDUSTRY_ATLAS_ORDER,initialIndustry,validIndustry,
 occupiedRoadCells,candidateCells,selectConstruction,realignLandlockedPiers,nearVisibleRiver,settleIndustryWeek,
 industryLevel,industryBase,industryYield,industryPending,collectIndustry,industrySprite,industrySpriteIndex};
