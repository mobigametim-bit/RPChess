/* Infinite Journey kingdom map. Pure state transitions: no DOM, no timers. */
import { createTravelChoices, hashString, PLAYABLE_TRAVEL_TYPES, hasHealthySkirmishCompanion } from './travel-choice-core.mjs';
import { RACE_TAGS } from './race-assets.mjs';
import { EVENT_IDS, eventById } from './events-data.mjs';

const MAP_VERSION=1;
const ROMANS=['I','II','III','IV','V'];
const TYPES=['battle','skirmish','caravan','event','settlement','puzzle'];
const EMPTY=Object.freeze({});
function keyOf(x,y){return x+','+y;}
function isPoint(p){return !!p&&Number.isSafeInteger(p.x)&&Number.isSafeInteger(p.y);}
function adjacent(a,b){return isPoint(a)&&isPoint(b)&&Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))===1;}
function orthogonal(a,b){return isPoint(a)&&isPoint(b)&&Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;}
function pointsEarned(map){return Math.floor(map.peakKingPower/200)+(map.battlePointsEarned||0);}
function pointsAvailable(map){return Math.max(0,pointsEarned(map)-(map.annexationPointsSpent||0));}
function romanForStars(stars){const n=Math.max(1,Math.min(12,Math.round(stars||1)));return n===1?'I':n<=4?'II':n<=6?'III':n<=9?'IV':'V';}
function castleLevel(power){return Math.max(1,Math.min(5,Math.floor(Math.max(0,power||0)/500)+1));}
function copyMap(map){return {...map,king:{...map.king},cells:{...map.cells}};}
function createKingdomMap(run,playerPower=400,raceTag='humans'){
 if(!run?.id)throw new Error('Kingdom map requires run identity');
 const castleRace=RACE_TAGS.includes(raceTag)?raceTag:'humans';
 const power=Math.max(0,Math.floor(Number(playerPower)||0));
 return {version:MAP_VERSION,seed:run.id,king:{x:0,y:0},castle:{x:0,y:0,raceTag:castleRace},
  cells:{'0,0':{status:'completed',type:'castle',annexed:true}},pendingCell:null,
  peakKingPower:power,annexationPointsSpent:0,battlePointsEarned:0,
  creditedBattleEncounterIds:[],completedNewEncounterCount:0,productionCyclesResolved:0};
}
function validateKingdomMap(map){
 if(!map||map.version!==MAP_VERSION||typeof map.seed!=='string'||!isPoint(map.king)||
    !isPoint(map.castle)||!map.cells||typeof map.cells!=='object'||Array.isArray(map.cells))return false;
 if(!map.cells[keyOf(map.castle.x,map.castle.y)]?.annexed)return false;
 if(!Number.isFinite(map.peakKingPower)||map.peakKingPower<0||
    !Number.isInteger(map.annexationPointsSpent)||map.annexationPointsSpent<0||
    !Number.isInteger(map.battlePointsEarned)||map.battlePointsEarned<0||
    !Array.isArray(map.creditedBattleEncounterIds))return false;
 // Validate only the sparse visited region; NEVER allocate an infinite board.
 return Object.entries(map.cells).every(([id,cell])=>
   /^-?\d+,-?\d+$/.test(id)&&cell&&typeof cell==='object'&&
   ['completed','revealed','in_progress','failed'].includes(cell.status)&&
   (!cell.annexed||cell.status==='completed')&&
   (!cell.selectedEncounter||TYPES.includes(cell.selectedEncounter.type)));
}
function updatePeak(map,power){
 const next=Math.max(map.peakKingPower,Math.max(0,Math.floor(Number(power)||0)));
 if(next===map.peakKingPower)return map;
 return {...map,peakKingPower:next};
}
function randomEncounter(run,point,power){
 const coord=keyOf(point.x,point.y),seed=run.id+':kingdom:'+coord;
 const possible=PLAYABLE_TRAVEL_TYPES.filter(t=>t!=='skirmish'||hasHealthySkirmishCompanion(run));
 const kind=possible[hashString(seed+':kind')%possible.length];
 const step=(run.journeyStep||0)+1;
 const base=createTravelChoices({runId:seed,step,types:[kind],playerPower:power})[0];
 const id='kingdom.'+hashString(seed).toString(36);
 const route={...base,id,seed,step,flavor:base.flavor,kingdomCell:coord};
 if(kind==='event'){
  const eventId=EVENT_IDS[hashString(seed+':event')%EVENT_IDS.length];
  const race=eventById(eventId)?.raceTag||'mixed';
  route.eventId=eventId;route.raceTag=race;
 }else if(kind==='settlement'){
  // Settlement data has no canonical race field. This is a map-visual,
  // coordinate-seeded affiliation, independent of recruitment offers.
  route.raceTag=RACE_TAGS[hashString(seed+':settlement-race')%RACE_TAGS.length];
 }else if(kind==='puzzle'){
  route.raceTag=null;
 }else{
  route.raceTag=route.enemyRaceTag||'mixed';
 }
 return route;
}
function enterCell(map,point,encounter=null,now=Date.now()){
 if(!validateKingdomMap(map)||!adjacent(map.king,point)||map.pendingCell)return {ok:false,reason:'not_adjacent_or_busy',map};
 const id=keyOf(point.x,point.y),before=map.king,existing=map.cells[id];
 const next=copyMap(map);
 next.king={...point};
 if(id===keyOf(map.castle.x,map.castle.y)||existing?.status==='completed'){
  return {ok:true,kind:'walk',map:next,cell:existing||EMPTY};
 }
 if(existing?.status==='failed'||existing?.status==='revealed'){
  if(!existing.selectedEncounter)return {ok:false,reason:'missing_route',map};
  next.cells[id]={...existing,status:'revealed',lastEntryFrom:{...before}};
  next.pendingCell=id;
  return {ok:true,kind:'retry',map:next,cell:next.cells[id]};
 }
 if(existing?.status==='in_progress')return {ok:false,reason:'active_encounter',map};
 if(!encounter||!TYPES.includes(encounter.type)||!encounter.id)return {ok:false,reason:'missing_random_encounter',map};
 next.cells[id]={status:'revealed',annexed:false,selectedEncounter:encounter,lastEntryFrom:{...before},
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
 const next=copyMap(map),first=Boolean(success&&!prev.completedOnce);
 next.cells[id]={...prev,status:success?'completed':'failed',completedOnce:prev.completedOnce||Boolean(success)};
 if(!success&&isPoint(prev.lastEntryFrom))next.king={...prev.lastEntryFrom};
 next.pendingCell=null;
 if(first){
  next.completedNewEncounterCount++;
  if(prev.selectedEncounter?.type==='battle'&&!next.creditedBattleEncounterIds.includes(prev.selectedEncounter.id)){
   next.creditedBattleEncounterIds=[...next.creditedBattleEncounterIds,prev.selectedEncounter.id];
   next.battlePointsEarned+=Math.max(0,Math.floor(Number(opponentPower)||0)/200);
  }
 }
 return {ok:true,map:next,first,retreated:!success};
}
function canAnnex(map,point){
 if(!validateKingdomMap(map)||pointsAvailable(map)<1)return false;
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
 if(!map.cells[keyOf(point.x,point.y)]?.annexed)return [];
 return [['n',0,-1],['e',1,0],['s',0,1],['w',-1,0]]
  .filter(([_,dx,dy])=>!map.cells[keyOf(point.x+dx,point.y+dy)]?.annexed)
  .map(([edge])=>edge);
}
export {MAP_VERSION,TYPES,ROMANS,keyOf,isPoint,adjacent,orthogonal,romanForStars,castleLevel,
 createKingdomMap,validateKingdomMap,updatePeak,randomEncounter,enterCell,beginEncounter,
 finishEncounter,canAnnex,annexCell,pointsEarned,pointsAvailable,borderEdges};
