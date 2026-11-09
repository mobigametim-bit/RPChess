/* Infinite Journey kingdom map. Pure state transitions: no DOM, no timers. */
import { createTravelChoices, hashString, PLAYABLE_TRAVEL_TYPES, hasHealthySkirmishCompanion } from './travel-choice-core.mjs';
import { RACE_TAGS } from './race-assets.mjs';
import { EVENT_IDS, eventById } from './events-data.mjs';
import {combatTheme} from './race-assets.mjs';
import {worldAt} from './kingdom-world-core.mjs?v=20261109-atlas-zoom-v4';
import {SCOUT_RADIUS} from './kingdom-world-config.mjs';

const MAP_VERSION=1;
const ROMANS=['I','II','III','IV','V'];
const TYPES=['battle','skirmish','caravan','event','settlement','puzzle'];
const EMPTY=Object.freeze({});
function keyOf(x,y){return x+','+y;}
function isPoint(p){return !!p&&Number.isSafeInteger(p.x)&&Number.isSafeInteger(p.y);}
function adjacent(a,b){return isPoint(a)&&isPoint(b)&&Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))===1;}
function orthogonal(a,b){return isPoint(a)&&isPoint(b)&&Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;}
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
  (map.centralOwnedCells||[]).includes(id)||Boolean(map.cells?.[id]?.annexed);
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
function advanceDay(map,actionId){
 if(typeof actionId!=='string'||!actionId)return map;
 const actions=map.calendarActions||[];
 if(actions.includes(actionId))return map;
 return {...map,day:Math.max(1,map.day||1)+1,calendarActions:[...actions,actionId]};
}
function romanForStars(stars){const n=Math.max(1,Math.min(12,Math.round(stars||1)));return n===1?'I':n<=4?'II':n<=6?'III':n<=9?'IV':'V';}
function castleLevel(power){return Math.max(1,Math.min(5,Math.floor(Math.max(0,power||0)/500)+1));}
function copyMap(map){return {...map,king:{...map.king},cells:{...map.cells}};}
function createKingdomMap(run,playerPower=400,raceTag='humans'){
 if(!run?.id)throw new Error('Kingdom map requires run identity');
 const castleRace=RACE_TAGS.includes(raceTag)?raceTag:'humans';
 const power=Math.max(0,Math.floor(Number(playerPower)||0));
 return growTerritory({version:MAP_VERSION,seed:run.id,king:{x:0,y:0},castle:{x:0,y:0,raceTag:castleRace},
  cells:{'0,0':{status:'completed',type:'castle',annexed:true}},pendingCell:null,
  peakKingPower:power,annexationPointsSpent:0,battlePointsEarned:0,legacyBonusLands:0,
  creditedBattleEncounterIds:[],uniqueFirstConquests:[],centralOwnedCells:[],
  day:1,calendarActions:[],processedThroughWeek:0,
  completedRoads:[],lastCompletedRouteCell:null,
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
      ['battle','caravan'].includes(c.type)&&Number.isSafeInteger(c.bonusLands)&&c.bonusLands>=0)))return false;
 // Validate only the sparse visited region; NEVER allocate an infinite board.
 return Object.entries(map.cells).every(([id,cell])=>
   /^-?\d+,-?\d+$/.test(id)&&cell&&typeof cell==='object'&&
   ['completed','revealed','in_progress','failed'].includes(cell.status)&&
   (!cell.selectedEncounter||TYPES.includes(cell.selectedEncounter.type)));
}
function updatePeak(map,power){
 const next=Math.max(map.peakKingPower,Math.max(0,Math.floor(Number(power)||0)));
 if(next===map.peakKingPower)return map;
 return growTerritory({...map,peakKingPower:next});
}
function randomEncounter(run,point,power,planned=null){
 const coord=keyOf(point.x,point.y),seed=run.id+':kingdom:'+coord;
 const possible=PLAYABLE_TRAVEL_TYPES.filter(t=>t!=='skirmish'||hasHealthySkirmishCompanion(run));
 const world=planned||worldAt(run.id,point.x,point.y,{allowSkirmish:hasHealthySkirmishCompanion(run)});
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
 for(let dy=-range;dy<=range;dy++)for(let dx=-range;dx<=range;dx++){
  const x=map.king.x+dx,y=map.king.y+dy,id=keyOf(x,y);
  if(map.cells[id])continue;
  const world=worldAt(map.seed,x,y,{allowSkirmish:hasHealthySkirmishCompanion(run)});
  const entry=world.type?
   {status:'revealed',annexed:isOwned(map,id),explored:false,biome:world.biome,landmark:world.landmark,
    selectedEncounter:randomEncounter(run,{x,y},power,world)}:
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
  if(['battle','caravan'].includes(choice?.type)&&!next.creditedBattleEncounterIds.includes(choice.id)){
   const enemyPower=Math.max(0,Math.floor(Number(opponentPower)||0)),bonusLands=Math.floor(enemyPower/200);
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
export {MAP_VERSION,TYPES,ROMANS,keyOf,isPoint,adjacent,orthogonal,romanForStars,castleLevel,
 createKingdomMap,validateKingdomMap,migrateKingdomMap,updatePeak,randomEncounter,revealAround,enterCell,beginEncounter,
 finishEncounter,matchesCombatReceipt,canAnnex,annexCell,pointsEarned,pointsAvailable,territoryCapacity,
 growTerritory,advanceDay,isOwned,linkCompletedRoad,borderEdges};
