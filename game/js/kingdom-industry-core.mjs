/* Weekly automatic economic buildings. Pure, replay-safe, map-seed driven. */
import {worldAt} from './kingdom-world-core.mjs';
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
const SITE_ART='construction_site.png',BUILDING_DIR='assets/kingdom-production/';
const KEY=/^-?\d+,-?\d+$/;
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
 return {buildings:[],processedWeek,accruedGold:0,accruedSupplies:0,creditedGold:0,creditedSupplies:0};
}
function validIndustry(value){
 if(value==null)return true; // old saves before feature rollout
 if(!value||!Array.isArray(value.buildings)||!integer(value.processedWeek))return false;
 if(!['accruedGold','accruedSupplies','creditedGold','creditedSupplies'].every(field=>integer(value[field])))return false;
 if(value.creditedGold>value.accruedGold||value.creditedSupplies>value.accruedSupplies)return false;
 const seen=new Set();
 return value.buildings.every(b=>{
  if(!b||!KEY.test(b.id||'')||!BUILDING_TYPES[b.kind]||!integer(b.builtWeek)||
    b.builtWeek<1||b.builtWeek>value.processedWeek||seen.has(b.id))return false;
  seen.add(b.id);return true;
 });
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
  const terrain=worldAt(map.seed,x,y);
  if(!TYPES_BY_BIOME[terrain.biome]?.length||terrain.type||
     terrain.paths?.road||terrain.landmark)continue;
  available.push({id,biome:terrain.biome});
 }
 return available.sort((a,b)=>a.id.localeCompare(b.id,'en'));
}
function selectConstruction(map,industry,week){
 const options=candidateCells(map,industry);
 if(!options.length)return null;
 const id=options[hashString(map.seed+':industry:cell:'+week)%options.length];
 const types=TYPES_BY_BIOME[id.biome];
 const kind=types[hashString(map.seed+':industry:type:'+week+':'+id.id)%types.length];
 return {id:id.id,kind,builtWeek:week};
}
function settleIndustryWeek(map,week){
 const old=map.industry||initialIndustry(Math.max(0,week-1));
 if(!validIndustry(old))return map;
 if(week<=old.processedWeek)return map.industry?map:{...map,industry:old};
 let industry={...old,buildings:[...old.buildings]};
 // No instant payment for a brand-new site. One weekly payment per completed
 // site, then exactly one construction attempt for that week.
 for(let current=old.processedWeek+1;current<=week;current++){
  const level=industryLevel(map);
  for(const site of industry.buildings){
   if(site.builtWeek>=current)continue;
   const resource=BUILDING_TYPES[site.kind].kind;
   if(resource==='gold')industry.accruedGold+=industryBase('gold')*level;
   else industry.accruedSupplies+=industryBase('supplies')*level;
  }
  const site=selectConstruction(map,industry,current);
  if(site)industry.buildings.push(site);
  industry.processedWeek=current;
 }
 return {...map,industry};
}
function applyIndustryCredits(run){
 const industry=run?.kingdomMap?.industry;
 if(!industry||!validIndustry(industry))return run;
 const gold=industry.accruedGold-industry.creditedGold,
  supplies=industry.accruedSupplies-industry.creditedSupplies;
 if(!gold&&!supplies)return run;
 if(!integer(run.gold)||!integer(run.supplies))return run;
 if(!Number.isSafeInteger(run.gold+gold)||!Number.isSafeInteger(run.supplies+supplies))
  throw new Error('Kingdom industry credit exceeds safe resource bounds');
 return {...run,gold:run.gold+gold,supplies:run.supplies+supplies,
  kingdomMap:{...run.kingdomMap,industry:{...industry,
   creditedGold:industry.accruedGold,creditedSupplies:industry.accruedSupplies}}};
}
function industrySprite(site,week){return BUILDING_DIR+((site.builtWeek>=week)?SITE_ART:site.kind+'.png');}
export {BUILDING_TYPES,TYPES_BY_BIOME,BUILDING_DIR,initialIndustry,validIndustry,
 occupiedRoadCells,candidateCells,selectConstruction,settleIndustryWeek,
 industryLevel,industryBase,industryYield,industrySprite,applyIndustryCredits};
