/* Infinite Journey kingdom map. Pure state transitions: no DOM, no timers. */
import { createTravelChoices, hashString, PLAYABLE_TRAVEL_TYPES, hasHealthySkirmishCompanion } from './travel-choice-core.mjs';
import { RACE_TAGS } from './race-assets.mjs';
import { EVENT_IDS, eventById } from './events-data.mjs';
import {combatTheme} from './race-assets.mjs';
import {worldAt,biomeAt} from './kingdom-world-core.mjs?v=20261109-kingdom-feedback1';
import {SCOUT_RADIUS} from './kingdom-world-config.mjs';
import {KINGDOM_OUTPOST_SHARD_COST} from './arena-core.mjs?v=20261109-kingdom-economy-v7';
import {DEFAULT_KINGDOM_ECONOMY} from './kingdom-economy-config.mjs';

// Live defaults mirror Atlas Lab's canonical economy; change only after acceptance.
const production=DEFAULT_KINGDOM_ECONOMY.production;
const WEEK_DAYS=production.weekDays,PROTOTYPE_YIELDS=Object.freeze({
 settlement:{gold:production.settlementGold},puzzle:{shards:production.puzzleShards},
 skirmish:{recruits:production.skirmishRecruits},battle:{battle:production.battleRespawnWeeks},
 caravan:{gold:production.caravanGold,supplies:production.caravanSupplies},
 event:{gold:production.eventGold,supplies:production.eventSupplies}
});

const MAP_VERSION=1;
const WORLD_GENERATOR_VERSION=5;
const ROMANS=['I','II','III','IV','V'];
const TYPES=['battle','skirmish','caravan','event','settlement','puzzle'];
const EMPTY=Object.freeze({});
function keyOf(x,y){return x+','+y;}
function isPoint(p){return !!p&&Number.isSafeInteger(p.x)&&Number.isSafeInteger(p.y);}
function adjacent(a,b){return isPoint(a)&&isPoint(b)&&Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))===1;}
function orthogonal(a,b){return isPoint(a)&&isPoint(b)&&Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;}
// Every king step is 8-neighbor, so a diagonal-first Chebyshev route is the
// shortest possible path on unobstructed kingdom terrain. Any encounter along
// the route interrupts the remaining steps and opens its existing game owner.
function shortestKingRoute(map,destination,maxSteps=400){
 if(!map||!isPoint(map.king)||!isPoint(destination))return [];
 const count=Math.max(Math.abs(destination.x-map.king.x),Math.abs(destination.y-map.king.y));
 if(!count||count>maxSteps)return [];
 const path=[],point={...map.king};
 for(let n=0;n<count;n++){
  point.x+=Math.sign(destination.x-point.x);
  point.y+=Math.sign(destination.y-point.y);
  path.push({...point});
 }
 return path;
}
// Central territory grows automatically and retains previously annexed land.
function territoryCapacity(map){
 const legacy=map.legacyBonusLands??map.battlePointsEarned??0;
 return Math.max(0,Math.floor((map.peakKingPower||0)/100)+legacy+
  (map.uniqueFirstConquests||[]).reduce((n,c)=>n+Math.max(0,c.bonusLands||0),0));
}
function pointsEarned(map){return territoryCapacity(map);}
function pointsAvailable(map){return Math.max(0,territoryCapacity(map)-
  Math.max(0,(map.centralOwnedCells||[]).length-1));}
function isOwned(map,point){
 const id=typeof point==='string'?point:keyOf(point.x,point.y);
 return id===keyOf(map.castle.x,map.castle.y)||
  (map.centralOwnedCells||[]).includes(id)||Boolean(map.cells?.[id]?.annexed)||
  (map.outposts||[]).some(post=>post.cells?.includes(id));
}
const CARDINAL=Object.freeze([[0,-1],[1,0],[0,1],[-1,0]]);
function growTerritory(map){
 const owned=new Set([keyOf(map.castle.x,map.castle.y),
  ...(map.centralOwnedCells||[]),
  ...Object.entries(map.cells).filter(([,cell])=>cell.annexed).map(([id])=>id)]);
 const target=Math.max(owned.size,territoryCapacity(map)+1),frontier=new Set();
 const addNeighbors=id=>{
  const [x,y]=id.split(',').map(Number);
  for(const [dx,dy] of CARDINAL){
   const n=keyOf(x+dx,y+dy);if(!owned.has(n))frontier.add(n);
  }
 };
 for(const id of owned)addNeighbors(id);
 while(owned.size<target&&frontier.size){
  let chosen=null,score=Infinity;
  for(const id of frontier){
   const [x,y]=id.split(',').map(Number);
   const radius=Math.abs(x-map.castle.x)+Math.abs(y-map.castle.y);
   const jitter=(hashString(map.seed+':territory:'+id)>>>0)/4294967296*.85;
   if(radius+jitter<score){chosen=id;score=radius+jitter;}
  }
  if(!chosen)break;
  frontier.delete(chosen);owned.add(chosen);addNeighbors(chosen);
 }
 const ordered=[...owned].sort((a,b)=>a.localeCompare(b,'en'));
 const prev=map.centralOwnedCells||[];
 let cells=map.cells;
 for(const id of ordered)if(cells[id]&&!cells[id].annexed){
  if(cells===map.cells)cells={...map.cells};
  cells[id]={...cells[id],annexed:true};
 }
 if(cells===map.cells&&prev.length===ordered.length&&prev.every((id,i)=>id===ordered[i]))return map;
 return {...map,cells,centralOwnedCells:ordered};
}
function migrateKingdomMap(map,run=null){
 if(!validateKingdomMap(map))return map;
 let result=map;
 if(!Array.isArray(result.centralOwnedCells))
  result={...result,centralOwnedCells:[],
   legacyBonusLands:Math.max(0,Number(result.battlePointsEarned)||0),
   uniqueFirstConquests:[]};
 if(!Number.isSafeInteger(result.day)||result.day<1)
  result={...result,day:Math.max(1,(run?.journeyStep||0)+1),calendarActions:[]};
 if(!Array.isArray(result.calendarActions))
  result={...result,calendarActions:[]};
 if(!Number.isInteger(result.processedThroughWeek))
  result={...result,processedThroughWeek:0};
 if(!Array.isArray(result.outposts))result={...result,outposts:[]};
 if(!Array.isArray(result.builtSettlements))result={...result,builtSettlements:[]};
 if(!Array.isArray(result.outpostRoads))result={...result,outpostRoads:[]};
 if(!Array.isArray(result.productionClaims))result={...result,productionClaims:[]};
 // Legacy completions have no reliable chronology; do not invent roads.
 if(!Array.isArray(result.completedRoads))
  result={...result,completedRoads:[],lastCompletedRouteCell:null};
 return growTerritory(result);
}
// Route paths are historical: each first successful completion links to
// the last different completed event, or to the castle for the first one.
function linkCompletedRoad(map,id){
 if((map.completedRoads||[]).some(road=>road.to===id))return map;
 const from=map.lastCompletedRouteCell||keyOf(map.castle.x,map.castle.y);
 if(from===id)return map;
 const [x1,y1]=from.split(',').map(Number),[x2,y2]=id.split(',').map(Number);
 const distance=Math.hypot(x2-x1,y2-y1);
 const entropy=hashString(map.seed+':road:'+from+':'+id)>>>0;
 const bend=(entropy%2?-1:1)*Math.max(.18,Math.min(1.15,distance*(.18+((entropy>>>8)%80)/1000)));
 return {...map,completedRoads:[...(map.completedRoads||[]),
  {id:'completed:'+id,from,to:id,bend}],lastCompletedRouteCell:id};
}
function weekForDay(day){return Math.max(0,Math.floor((day||1)/WEEK_DAYS));}
function productionFor(map,id,type,week){
 const choices=PROTOTYPE_YIELDS[type];if(!choices)return null;
 const kinds=Object.keys(choices),kind=kinds[hashString(map.seed+':production:'+id+':'+week)%kinds.length];
 return {id:'production:'+id+':'+week+':'+kind,week,kind,amount:choices[kind]};
}
function settleWeeklyProduction(map){
 const week=weekForDay(map.day);
 if(week<=Math.max(0,map.processedThroughWeek||0))return map;
 let cells=map.cells,created=0;
 for(const [id,cell] of Object.entries(map.cells)){
  const type=cell?.selectedEncounter?.type;
  if(cell.status!=='completed'||!cell.selectedEncounter||!(isOwned(map,id)||(map.builtSettlements||[]).some(p=>p.id===id))||
     cell.production||cell.respawnReady||!PROTOTYPE_YIELDS[type])continue;
  const production=productionFor(map,id,type,week);
  if(!production)continue;
  if(cells===map.cells)cells={...map.cells};
  cells[id]={...cell,production,
   ...(production.kind==='battle'?{respawnReady:true}:{})};
  created++;
 }
 return {...map,cells,processedThroughWeek:week,
  productionCyclesResolved:Math.max(map.productionCyclesResolved||0,week)};
}
function acknowledgeReturn(map,id){
 const cell=map?.cells?.[id];
 if(cell?.production?.kind!=='battle'||cell?.respawnReady!==true)return {ok:false,map};
 const next=copyMap(map);
 next.cells[id]={...cell,production:null}; // Defender sprite stays visible.
 return {ok:true,map:next};
}
function collectProduction(map,id){
 const cell=map?.cells?.[id],item=cell?.production;
 if(!cell||!item||!['gold','supplies','shards','recruits'].includes(item.kind)||
    !(isOwned(map,id)||(map.builtSettlements||[]).some(p=>p.id===id))||cell.status!=='completed'||
    (map.productionClaims||[]).includes(item.id))return {ok:false,map};
 const next=copyMap(map);
 next.cells[id]={...cell,production:null};
 next.productionClaims=[...(map.productionClaims||[]),item.id];
 return {ok:true,map:next,kind:item.kind,amount:item.amount,receiptId:item.id};
}
// Building a Settlement does not annex its cell. Outside sites still produce.
function canBuildSettlement(map,point){
 if(!validateKingdomMap(map)||!isPoint(point)||map.pendingCell)return false;
 const id=keyOf(point.x,point.y),cell=map.cells?.[id];
 return Boolean(cell?.explored&&cell.type==='empty'&&cell.status==='completed'&&
  !cell.selectedEncounter&&id!==keyOf(map.castle.x,map.castle.y)&&
  !(map.outposts||[]).some(post=>post.id===id||post.cells?.includes(id))&&
  !(map.builtSettlements||[]).some(site=>site.id===id));
}
function buildSettlement(map,point,transactionId,{gold,shards,raceTag='humans'}={}){
 if(!canBuildSettlement(map,point)||typeof transactionId!=='string'||!transactionId||
  !Number.isSafeInteger(gold)||gold<0||!Number.isSafeInteger(shards)||shards<0)return {ok:false,map};
 const id=keyOf(point.x,point.y),seed=map.seed+':built-settlement:'+id;
 const base=createTravelChoices({runId:seed,step:1,types:['settlement'],playerPower:map.peakKingPower})[0];
 const encounter={...base,id:'kingdom.built.'+hashString(seed).toString(36),seed,
  type:'settlement',kingdomCell:id,raceTag:RACE_TAGS.includes(raceTag)?raceTag:map.castle.raceTag,
  builtByPlayer:true};
 const ownedAtBuild=isOwned(map,point);
 const previous=map.cells[id];
 const next=copyMap(map);
 next.builtSettlements=[...(map.builtSettlements||[]),
  {id,transactionId,gold,shards,ownedAtBuild}];
 next.cells[id]={...previous,status:'completed',type:'settlement',completedOnce:true,
  selectedEncounter:encounter,production:null,explored:true};
 return {ok:true,map:advanceDay(linkCompletedRoad(next,id),'build-settlement:'+id),encounter};
}
function canBuildOutpost(map,point){
 if(!validateKingdomMap(map)||!isPoint(point)||map.pendingCell||isOwned(map,point))return false;
 const id=keyOf(point.x,point.y),cell=map.cells[id];
 return Boolean(cell?.explored&&cell.status==='completed'&&
  (cell.type==='empty'||cell.completedOnce===true)&&
  !(map.outposts||[]).some(post=>post.id===id));
}
function linkOutpostRoad(map,id){
 if((map.outpostRoads||[]).some(road=>road.to===id))return map;
 const castle=keyOf(map.castle.x,map.castle.y);
 const nodes=new Set([castle,...(map.completedRoads||[]).map(r=>r.to),
  ...(map.outpostRoads||[]).map(r=>r.to)]);
 const [x,y]=id.split(',').map(Number);
 let from=castle,best=Infinity;
 for(const node of nodes){
  if(node===id)continue;
  const [nx,ny]=node.split(',').map(Number);
  const dist=Math.hypot(x-nx,y-ny);
  if(dist<best){best=dist;from=node;}
 }
 const e=hashString(map.seed+':outpost-road:'+from+':'+id)>>>0;
 const bend=(e&1?-1:1)*Math.max(.16,Math.min(1.15,best*.22));
 return {...map,outpostRoads:[...(map.outpostRoads||[]),
  {id:'outpost:'+id,from,to:id,bend}]};
}
function buildOutpost(map,point,transactionId){
 if(!canBuildOutpost(map,point)||typeof transactionId!=='string'||!transactionId)
  return {ok:false,map};
 const id=keyOf(point.x,point.y);
 const neighbors=CARDINAL.map(([dx,dy])=>keyOf(point.x+dx,point.y+dy))
  .filter(key=>!isOwned(map,key))
  .sort((a,b)=>(hashString(map.seed+':outpost:'+id+':'+a)>>>0)-
   (hashString(map.seed+':outpost:'+id+':'+b)>>>0)).slice(0,2);
 const post={id,cells:[id,...neighbors],transactionId,price:KINGDOM_OUTPOST_SHARD_COST};
 const next=linkOutpostRoad({...map,outposts:[...(map.outposts||[]),post]},id);
 return {ok:true,map:advanceDay(next,'build-outpost:'+id),outpost:post};
}
function advanceDay(map,actionId){
 if(typeof actionId!=='string'||!actionId)return map;
 const actions=map.calendarActions||[];
 if(actions.includes(actionId))return map;
 return settleWeeklyProduction({...map,day:Math.max(1,map.day||1)+1,calendarActions:[...actions,actionId]});
}
function romanForStars(stars){const n=Math.max(1,Math.min(12,Math.round(stars||1)));return n===1?'I':n<=4?'II':n<=6?'III':n<=9?'IV':'V';}
function castleLevel(power){return Math.max(1,Math.min(5,Math.floor(Math.max(0,power||0)/500)+1));}
function copyMap(map){return {...map,king:{...map.king},cells:{...map.cells}};}
// Select the new run's world by king race while preserving the castle at (0,0).
const CASTLE_BIOMES=Object.freeze({
 humans:['plains'],elves:['forest'],orcs:['hills','wasteland'],
 undead:['marsh','wasteland'],dark_elves:['marsh','wasteland'],
 dwarves:['mountain','hills'],demons:['wasteland'],angels:['mountain'],
 dragonborn:['mountain'],beastfolk:['forest','hills'],
 constructs:['wasteland','hills'],animals:['plains','forest'],
 fae:['forest'],goblins:['marsh','hills']
});
function castleWorldSeed(runId,raceTag){
 const preferred=CASTLE_BIOMES[raceTag]||['plains'];
 for(let attempt=0;attempt<512;attempt++){
  const candidate=runId+':castle-biome:'+attempt;
  if(preferred.includes(biomeAt(candidate,0,0)))return candidate;
 }
 return runId;
}
function createKingdomMap(run,playerPower=400,raceTag='humans'){
 if(!run?.id)throw new Error('Kingdom map requires run identity');
 const castleRace=RACE_TAGS.includes(raceTag)?raceTag:'humans';
 const power=Math.max(0,Math.floor(Number(playerPower)||0));
 return growTerritory({version:MAP_VERSION,worldGeneratorVersion:WORLD_GENERATOR_VERSION,seed:castleWorldSeed(run.id,castleRace),king:{x:0,y:0},castle:{x:0,y:0,raceTag:castleRace},
  cells:{'0,0':{status:'completed',type:'castle',annexed:true}},pendingCell:null,
  peakKingPower:power,annexationPointsSpent:0,battlePointsEarned:0,legacyBonusLands:0,
  creditedBattleEncounterIds:[],uniqueFirstConquests:[],centralOwnedCells:[],
  day:1,calendarActions:[],processedThroughWeek:0,outposts:[],builtSettlements:[],productionClaims:[],
  completedRoads:[],lastCompletedRouteCell:null,outpostRoads:[],
  completedNewEncounterCount:0,productionCyclesResolved:0});
}
function validateKingdomMap(map){
 if(!map||map.version!==MAP_VERSION||typeof map.seed!=='string'||!isPoint(map.king)||
    !isPoint(map.castle)||!map.cells||typeof map.cells!=='object'||Array.isArray(map.cells))return false;
 if(!map.cells[keyOf(map.castle.x,map.castle.y)]?.annexed)return false;
 if(!Number.isFinite(map.peakKingPower)||map.peakKingPower<0||
    !Number.isInteger(map.annexationPointsSpent)||map.annexationPointsSpent<0||
    !Number.isInteger(map.battlePointsEarned)||map.battlePointsEarned<0||
    !Array.isArray(map.creditedBattleEncounterIds))return false;
 if(map.day!=null&&(!Number.isSafeInteger(map.day)||map.day<1))return false;
 if(map.outposts!=null&&(!Array.isArray(map.outposts)||
   !map.outposts.every(p=>p&&typeof p.id==='string'&&
     /^-?[0-9]+,-?[0-9]+$/.test(p.id)&&Array.isArray(p.cells)&&
     p.cells.length>=1&&p.cells.length<=3&&
     p.cells.every(id=>typeof id==='string'&&/^-?[0-9]+,-?[0-9]+$/.test(id))&&
     typeof p.transactionId==='string')))return false;
 if(map.builtSettlements!=null&&(!Array.isArray(map.builtSettlements)||!map.builtSettlements.every(p=>p&&typeof p.id==='string'&&/^-?[0-9]+,-?[0-9]+$/.test(p.id)&&typeof p.transactionId==='string'&&Number.isSafeInteger(p.gold)&&p.gold>=0&&Number.isSafeInteger(p.shards)&&p.shards>=0)))return false;
 if(map.productionClaims!=null&&(!Array.isArray(map.productionClaims)||
  !map.productionClaims.every(id=>typeof id==='string')))return false;
 if(map.outpostRoads!=null&&(!Array.isArray(map.outpostRoads)||
  !map.outpostRoads.every(road=>road&&typeof road.id==='string'&&
   /^-?[0-9]+,-?[0-9]+$/.test(road.from)&&/^-?[0-9]+,-?[0-9]+$/.test(road.to)&&
   Number.isFinite(road.bend))))return false;
 if(map.completedRoads!=null&&(!Array.isArray(map.completedRoads)||
  !map.completedRoads.every(road=>road&&typeof road.id==='string'&&
   /^-?[0-9]+,-?[0-9]+$/.test(road.from)&&/^-?[0-9]+,-?[0-9]+$/.test(road.to)&&
   Number.isFinite(road.bend))))return false;
 if(map.lastCompletedRouteCell!=null&&!/^-?[0-9]+,-?[0-9]+$/.test(map.lastCompletedRouteCell))return false;
 if(map.calendarActions!=null&&(!Array.isArray(map.calendarActions)||
    !map.calendarActions.every(id=>typeof id==='string'&&id.length>0)))return false;
 if(map.centralOwnedCells!=null&&(!Array.isArray(map.centralOwnedCells)||
    !map.centralOwnedCells.every(id=>/^-?\d+,-?\d+$/.test(id))))return false;
 if(map.uniqueFirstConquests!=null&&(!Array.isArray(map.uniqueFirstConquests)||
    !map.uniqueFirstConquests.every(c=>c&&typeof c.encounterId==='string'&&
      ['battle','skirmish','caravan'].includes(c.type)&&Number.isSafeInteger(c.bonusLands)&&c.bonusLands>=0)))return false;
 // Validate only the sparse visited region; NEVER allocate an infinite board.
 return Object.entries(map.cells).every(([id,cell])=>
   /^-?\d+,-?\d+$/.test(id)&&cell&&typeof cell==='object'&&
   ['completed','revealed','in_progress','failed'].includes(cell.status)&&
   (!cell.selectedEncounter||TYPES.includes(cell.selectedEncounter.type))&&
   (!cell.production||typeof cell.production.id==='string'&&
    ['gold','supplies','shards','battle','recruits'].includes(cell.production.kind)&&
    Number.isSafeInteger(cell.production.week)&&cell.production.week>=1&&
    Number.isSafeInteger(cell.production.amount)&&cell.production.amount>=0));
}
function updatePeak(map,power){
 const next=Math.max(map.peakKingPower,Math.max(0,Math.floor(Number(power)||0)));
 if(next===map.peakKingPower)return map;
 return growTerritory({...map,peakKingPower:next});
}
function randomEncounter(run,point,power,planned=null){
 const coord=keyOf(point.x,point.y),worldSeed=run.kingdomMap?.seed||run.id,
  seed=worldSeed+':kingdom:'+coord;
 const possible=PLAYABLE_TRAVEL_TYPES.filter(t=>t!=='skirmish'||hasHealthySkirmishCompanion(run));
 const world=planned||worldAt(worldSeed,point.x,point.y,{allowSkirmish:hasHealthySkirmishCompanion(run)});
 // Keep this public factory compatible with the previous map and its existing
 // regression fixtures. Only revealAround decides whether a cell has a meeting.
 const kind=world.type&&possible.includes(world.type)?world.type:possible[hashString(seed+':kind')%possible.length];
 const step=(run.journeyStep||0)+1;
 const base=createTravelChoices({runId:seed,step,types:[kind],playerPower:power})[0];
 const id='kingdom.'+hashString(seed).toString(36);
 const route={...base,id,seed,step,flavor:base.flavor,kingdomCell:coord,biome:world.biome,landmark:world.landmark};
 if(['battle','skirmish','caravan'].includes(kind)&&RACE_TAGS.includes(world.raceTag)){
  const theme=combatTheme({seed:base.seed,raceTag:world.raceTag});
  Object.assign(route,{enemyRaceTag:world.raceTag,raceTag:world.raceTag,
   enemyRoleRaces:theme.enemyRoleRaces,playerColor:theme.playerColor,
   sideNarrative:theme.sideNarrative});
 }
 if(kind==='event'){
  const eventId=EVENT_IDS[hashString(seed+':event')%EVENT_IDS.length];
  const race=eventById(eventId)?.raceTag||'mixed';
  route.eventId=eventId;route.raceTag=race;
  // Visual-only race: pinned to the persisted cell's seed. Never rewrite
  // mixed/unknown narrative event races or their neutral chessboard tiles.
  route.visualRaceTag=RACE_TAGS.includes(race)?race:
    RACE_TAGS[hashString(seed+':event-visual-race')%RACE_TAGS.length];
 }else if(kind==='settlement'){
  // Settlement data has no canonical race field. This is a map-visual,
  // coordinate-seeded affiliation, independent of recruitment offers.
  route.raceTag=RACE_TAGS.includes(world.raceTag)?world.raceTag:
   RACE_TAGS[hashString(seed+':settlement-race')%RACE_TAGS.length];
 }else if(kind==='puzzle'){
  route.raceTag=null;
 }else{
  route.raceTag=route.enemyRaceTag||'mixed';
 }
 return route;
}
// Reveals nearby locations without forcing a fight or charging travel supplies.
// Unvisited locations are stable world content. Saved legacy routes always win.
function revealAround(map,run,power,radius=SCOUT_RADIUS){
 if(!validateKingdomMap(map)||!run?.id)return map;
 let cells=null;
 const range=Math.max(0,Math.min(3,Math.floor(radius)));
 // Sovereign land is already discovered, even where the king has never walked.
 // Generate stable encounter data for those tiles without starting encounters.
 const locations=new Set([keyOf(map.castle.x,map.castle.y),...(map.centralOwnedCells||[])]);
 for(let dy=-range;dy<=range;dy++)for(let dx=-range;dx<=range;dx++)
  locations.add(keyOf(map.king.x+dx,map.king.y+dy));
 for(const post of map.outposts||[])for(const id of post.cells||[])locations.add(id);
 for(const [id,cell] of Object.entries(map.cells))if(cell.annexed)locations.add(id);
 for(const id of locations){
  if(map.cells[id])continue;
  const [x,y]=id.split(',').map(Number);
  const world=worldAt(map.seed,x,y,{allowSkirmish:hasHealthySkirmishCompanion(run)});
  const entry=world.type?
   {status:'revealed',annexed:isOwned(map,id),explored:false,biome:world.biome,landmark:world.landmark,
    selectedEncounter:randomEncounter({...run,kingdomMap:map},{x,y},power,world)}:
   {status:'completed',type:'empty',annexed:isOwned(map,id),explored:false,biome:world.biome,landmark:world.landmark};
  if(!cells)cells={...map.cells};
  cells[id]=entry;
 }
 return cells?{...map,cells,explorationVersion:2}:
  map.explorationVersion===2?map:{...map,explorationVersion:2};
}
function enterCell(map,point,encounter=null,now=Date.now()){
 if(!validateKingdomMap(map)||!adjacent(map.king,point)||map.pendingCell)return {ok:false,reason:'not_adjacent_or_busy',map};
 const id=keyOf(point.x,point.y),before=map.king,existing=map.cells[id];
 let next=copyMap(map);
 next.king={...point};
 if(!existing||existing.explored===false)next=advanceDay(next,'explore:'+id);
 if(existing?.status==='completed'&&existing.selectedEncounter?.type==='battle'&&existing.respawnReady===true){
  // Returning champion challenge: same stars and race, no repeated land bonus.
  next.cells[id]={...existing,status:'revealed',completedOnce:true,production:null,respawnReady:false,
   explored:true,lastEntryFrom:{...before}};
  next.pendingCell=id;
  return {ok:true,kind:'retry',map:next,cell:next.cells[id]};
 }
 if(id===keyOf(map.castle.x,map.castle.y)||existing?.status==='completed'){
  if(existing)next.cells[id]={...existing,explored:true};
  return {ok:true,kind:'walk',map:next,cell:next.cells[id]||EMPTY};
 }
 if(existing?.status==='failed'||existing?.status==='revealed'){
  if(!existing.selectedEncounter)return {ok:false,reason:'missing_route',map};
  const first=!existing.explored&&existing.status==='revealed';
  next.cells[id]={...existing,status:'revealed',explored:true,lastEntryFrom:{...before}};
  next.pendingCell=id;
  return {ok:true,kind:first?'discover':'retry',map:next,cell:next.cells[id]};
 }
 if(existing?.status==='in_progress')return {ok:false,reason:'active_encounter',map};
 if(!encounter||!TYPES.includes(encounter.type)||!encounter.id)return {ok:false,reason:'missing_random_encounter',map};
 next.cells[id]={status:'revealed',annexed:isOwned(map,id),explored:true,selectedEncounter:encounter,lastEntryFrom:{...before},
   discoveredAt:now,firstVisit:true};
 next.pendingCell=id;
 return {ok:true,kind:'discover',map:next,cell:next.cells[id]};
}
function beginEncounter(map,id){
 if(map?.pendingCell!==id||map.cells?.[id]?.status!=='revealed')return {ok:false,map};
 const next=copyMap(map);
 next.cells[id]={...next.cells[id],status:'in_progress',attempts:(next.cells[id].attempts||0)+1};
 return {ok:true,map:next};
}
function finishEncounter(map,id,{success=false,opponentPower=0}={}){
 const prev=map?.cells?.[id];
 if(!prev||!['in_progress','revealed'].includes(prev.status))return {ok:false,map};
 let next=copyMap(map);
 const first=Boolean(success&&!prev.completedOnce);
 next.cells[id]={...prev,status:success?'completed':'failed',completedOnce:prev.completedOnce||Boolean(success)};
 if(!success&&isPoint(prev.lastEntryFrom))next.king={...prev.lastEntryFrom};
 next.pendingCell=null;
 if(first){
  next.completedNewEncounterCount++;
  const choice=prev.selectedEncounter;
  if(choice?.id)next=linkCompletedRoad(next,id);
  if(['battle','skirmish','caravan'].includes(choice?.type)&&!next.creditedBattleEncounterIds.includes(choice.id)){
   const enemyPower=Math.max(0,Math.floor(Number(opponentPower)||0));
    const divisor={battle:200,skirmish:400,caravan:300}[choice.type];
    const bonusLands=Math.floor(enemyPower/divisor);
   next.creditedBattleEncounterIds=[...next.creditedBattleEncounterIds,choice.id];
   if(choice.type==='battle')next.battlePointsEarned+=bonusLands; // legacy analytics, not new capacity
   next.uniqueFirstConquests=[...(next.uniqueFirstConquests||[]),
    {encounterId:choice.id,type:choice.type,enemyPower,bonusLands}];
   next=growTerritory(next);
  }
 }
 next=advanceDay(next,'complete:'+id+':'+(prev.attempts||0)+':'+(success?'success':'failed'));
 return {ok:true,map:next,first,retreated:!success};
}
// Engine encounter IDs are derived from the seed; map route IDs identify
// cells. Accept both, including old saves created before explicit receipts.
function matchesCombatReceipt(choice,last){
 if(!choice||!last||!['battle','skirmish','caravan'].includes(choice.type))return false;
 if(last.routeId===choice.id||last.encounterId===choice.id)return true;
 if(!['battle','skirmish'].includes(choice.type)||
    typeof choice.seed!=='string'||!Number.isInteger(choice.stars))return false;
 return last.encounterId===`${choice.type}-${hashString(choice.seed).toString(36)}-${choice.stars}`;
}
function canAnnex(map,point){
 // Inert legacy API: current territories auto-expand without manual purchases.
 if(!validateKingdomMap(map)||Array.isArray(map.centralOwnedCells)||pointsAvailable(map)<1)return false;
 const id=keyOf(point.x,point.y),cell=map.cells[id];
 if(!cell||cell.status!=='completed'||cell.annexed)return false;
 return [[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy])=>map.cells[keyOf(point.x+dx,point.y+dy)]?.annexed===true);
}
function annexCell(map,point){
 if(!canAnnex(map,point))return {ok:false,map};
 const next=copyMap(map),id=keyOf(point.x,point.y);
 next.cells[id]={...next.cells[id],annexed:true};
 next.annexationPointsSpent++;
 return {ok:true,map:next};
}
function borderEdges(map,point){
 if(!isOwned(map,point))return [];
 return [['n',0,-1],['e',1,0],['s',0,1],['w',-1,0]]
  .filter(([_,dx,dy])=>!isOwned(map,keyOf(point.x+dx,point.y+dy)))
  .map(([edge])=>edge);
}
export {MAP_VERSION,TYPES,ROMANS,keyOf,isPoint,adjacent,orthogonal,shortestKingRoute,romanForStars,castleLevel,
 createKingdomMap,validateKingdomMap,migrateKingdomMap,updatePeak,randomEncounter,revealAround,enterCell,beginEncounter,
 finishEncounter,matchesCombatReceipt,canAnnex,annexCell,pointsEarned,pointsAvailable,territoryCapacity,
 growTerritory,advanceDay,isOwned,linkCompletedRoad,borderEdges,weekForDay,productionFor,
 settleWeeklyProduction,collectProduction,acknowledgeReturn,canBuildOutpost,buildOutpost,linkOutpostRoad,
 canBuildSettlement,buildSettlement,WEEK_DAYS,PROTOTYPE_YIELDS};
