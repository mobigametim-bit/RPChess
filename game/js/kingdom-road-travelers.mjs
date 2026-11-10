/* Decorative road walkers: pure route generation with no game-state effects.
 * Travelers are drawn on an independent canvas; they never advance the calendar,
 * trigger an encounter, alter resources or persist animation state. */
import {visibleRoyalRoads,eligibleRoadNodes} from './kingdom-road-network.mjs';
import {randomAt} from './kingdom-parchment-core.mjs';
import {VISUAL} from './kingdom-world-config.mjs';
const TYPES=Object.freeze(['merchant','convoy','courier','patrol','builders']);
const OWNED_ONLY=new Set(['patrol','builders']);
const MAX_TRAVELERS=8,ROAD_SAMPLES=48;
const WALK_SPEED_FACTOR=1/3; // User-approved: all five kinds walk 3 times slower.
function travelerSchedule(seed,index){
 // Distinct launch times and destination/origin holds per actor; stable
 // across camera movement, zoom and renderer rebuilds.
 return {
  spawnDelay:index*3.5+((seed>>>13)%5)*.6,
  destinationWait:5+((seed>>>18)%9),
  originWait:7+((seed>>>22)%12)
 };
}
const numeric=id=>id?.split(',').map(Number);
function hash(value){
 let h=2166136261;
 for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
 return h>>>0;
}
function ownedSet(map){
 return new Set([map.castle.x+','+map.castle.y,...(map.centralOwnedCells||[]),
 ...(map.outposts||[]).flatMap(p=>p.cells||[]),
 ...Object.keys(map.cells||{}).filter(k=>map.cells[k]?.annexed)]);
}
function bezierPoint(edge,t){
 const a=numeric(edge.from),b=numeric(edge.to);
 if(!a||!b)return null;
 const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
 if(!length)return null;
 const offset=edge.bend,nx=-dy/length,ny=dx/length;
 const x0=a[0]+.5,y0=a[1]+.5,x3=b[0]+.5,y3=b[1]+.5;
 const x1=x0+dx*.32+nx*offset,y1=y0+dy*.32+ny*offset;
 const x2=x0+dx*.68-nx*offset*.45,y2=y0+dy*.68-ny*offset*.45;
 const u=1-t;
 return {x:u*u*u*x0+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3,
   y:u*u*u*y0+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3};
}
function entirelyOwned(edge,owned){
 const a=numeric(edge?.from),b=numeric(edge?.to);
 if(!a||!b)return false;
 const distance=Math.hypot(a[0]-b[0],a[1]-b[1])+Math.abs(edge.bend||0)*2;
 // A fixed 48 samples can skip an entire foreign cell on a long road.
 // Sample at least every 1/32 cell and conservatively reject huge curves.
 if(distance>64)return false;
 const samples=Math.max(ROAD_SAMPLES,Math.ceil(distance*32));
 for(let i=0;i<=samples;i++){
  const p=bezierPoint(edge,i/samples);
  if(!p||!owned.has(Math.floor(p.x)+','+Math.floor(p.y)))return false;
 }
 return true;
}
// These are the exact natural-road equations used by drawWaterRoads; both
// the art and NPC route derive from the same world coordinates.
function naturalRoadY(map,index,x){
 const drift=randomAt(map.seed,1,1,'road')*Math.max(1,VISUAL.roadSpacing)*(8/12);
 const center=index*VISUAL.roadSpacing+drift;
 return center+Math.sin(x*.37+index*2.1)*1.25*VISUAL.roadCurve+
   Math.sin(x*.83+index)*.18;
}
function nearestNaturalRoad(map,origin){
 const p=numeric(origin);if(!p)return null;
 const x=p[0]+.5,y=p[1]+.5,spacing=VISUAL.roadSpacing||8;
 const drift=randomAt(map.seed,1,1,'road')*Math.max(1,spacing)*(8/12);
 const center=Math.round((y-drift)/spacing);
 let nearest=null,dist=Infinity;
 for(let n=center-2;n<=center+2;n++){
  const delta=Math.abs(naturalRoadY(map,n,x)-y);
  if(delta<dist){dist=delta;nearest=n;}
 }
 // Natural line must actually run across the event/castle tile.
 return dist<=.49?nearest:null;
}
// For local-only walkers, a natural road is allowed as far as every
// intermediate location stays inside the kingdom (never only its endpoints).
function ownedNaturalLength(map,start,road,direction,owned){
 const cell=numeric(start);if(!cell)return 0;
 const originX=cell[0]+.5;
 let allowed=0;
 for(let d=.025;d<=8;d+=.025){
  const x=originX+d*direction,y=naturalRoadY(map,road,x);
  if(!owned.has(Math.floor(x)+','+Math.floor(y)))break;
  allowed=d;
 }
 return allowed>=.55?allowed:0;
}
function createTravelers(map,{parchment=true,maxTravelers=MAX_TRAVELERS}={}){
 if(!map?.cells||!map?.castle)return [];
 const nodes=[map.castle.x+','+map.castle.y,...eligibleRoadNodes(map)];
 const roads=visibleRoyalRoads(map),owned=ownedSet(map);
 const safe=roads.filter(road=>entirelyOwned(road,owned));
 const max=Math.min(MAX_TRAVELERS,Math.max(0,Math.floor(maxTravelers)));
 const walkers=[];
 for(let i=0;i<max;i++){
  const type=TYPES[i%TYPES.length],seed=hash(map.seed+':walker:'+i);
  const sourceNodes=new Set(nodes);
  const pool=(OWNED_ONLY.has(type)?safe:roads).filter(edge=>sourceNodes.has(edge.from)||sourceNodes.has(edge.to));
  const naturalChoices=parchment?nodes.flatMap(id=>{
    const road=nearestNaturalRoad(map,id);
    if(road===null)return [];
    if(!OWNED_ONLY.has(type))return [{id,road,direction:seed%2?-1:1,maxDistance:9}];
    const directions=[1,-1].map(direction=>({
      id,road,direction,maxDistance:ownedNaturalLength(map,id,road,direction,owned)
    })).filter(choice=>choice.maxDistance>0);
    return directions;
  }):[];
  // Roaming merchants and couriers follow natural trails outside owned lands
  // whenever a Castle/event starting point lies on one. Convoys can do so too.
  const useNatural=naturalChoices.length>0&&(
   type==='merchant'||type==='courier'||(seed>>>4)%3===0||pool.length===0);
  if(!pool.length&&!useNatural)continue;
  if(useNatural){
   const item=naturalChoices[seed%naturalChoices.length];
   const from=numeric(item.id);
   walkers.push({id:'walker:'+i,type,kind:'natural',start:item.id,index:item.road,
    originX:from[0]+.5,direction:item.direction,maxDistance:item.maxDistance,
    speed:(.38+(seed%25)/100)*WALK_SPEED_FACTOR,...travelerSchedule(seed,i)});
  }else{
   const edge=pool[seed%pool.length];
   // Actors emerge only from the Castle or event sites, never from a bare outpost.
   const direction=sourceNodes.has(edge.from)&&sourceNodes.has(edge.to)?
     (seed&1?1:-1):sourceNodes.has(edge.from)?1:-1;
   walkers.push({id:'walker:'+i,type,kind:'royal',start:direction===1?edge.from:edge.to,
    edge,direction,speed:(.32+(seed%35)/100)*WALK_SPEED_FACTOR,...travelerSchedule(seed,i)});
  }
 }
 return walkers;
}
// Outbound walk -> linger at destination -> return -> linger at origin.
// Returns null until the actor's individual first-spawn time.
function travelerMotion(map,walker,elapsed){
 if(!walker||!Number.isFinite(elapsed)||elapsed<(walker.spawnDelay||0))return null;
 let length,heading;
 if(walker.kind==='royal'){
  const a=numeric(walker.edge?.from),b=numeric(walker.edge?.to);
  if(!a||!b)return null;
  length=Math.max(1,Math.hypot(a[0]-b[0],a[1]-b[1]));
  heading=Math.sign((b[0]-a[0])*walker.direction)||walker.direction;
 }else if(walker.kind==='natural'){
  length=walker.maxDistance||9;
  heading=walker.direction;
 }else return null;
 if(!(walker.speed>0))return null;
 const walkTime=length/walker.speed;
 const destinationWait=Math.max(0,walker.destinationWait??0);
 const originWait=Math.max(0,walker.originWait??0);
 const cycle=walkTime*2+destinationWait+originWait;
 let phase=((elapsed-(walker.spawnDelay||0))%cycle+cycle)%cycle;
 let progress=0,moving=false;
 if(phase<walkTime){
  progress=phase/walkTime;moving=true;
 }else if((phase-=walkTime)<destinationWait){
  progress=1;
 }else if((phase-=destinationWait)<walkTime){
  progress=1-phase/walkTime;moving=true;heading=-heading;
 }else{
  heading=-heading;
 }
 let position;
 if(walker.kind==='royal'){
  position=bezierPoint(walker.edge,walker.direction===1?progress:1-progress);
 }else{
  const x=walker.originX+walker.direction*length*progress;
  position={x,y:naturalRoadY(map,walker.index,x)};
 }
 return {position,moving,heading,progress};
}
function travelerPosition(map,walker,elapsed){
 return travelerMotion(map,walker,elapsed)?.position||null;
}
function visibleTraveler(map,walker,pos,owned=null){
 if(!pos)return false;
 const id=Math.floor(pos.x)+','+Math.floor(pos.y);
 if(!map.cells?.[id])return false; // Never reveal hidden fog by a walker.
 return !OWNED_ONLY.has(walker.type)||(owned||ownedSet(map)).has(id);
}
export {TYPES,OWNED_ONLY,MAX_TRAVELERS,bezierPoint,entirelyOwned,
 naturalRoadY,nearestNaturalRoad,createTravelers,travelerPosition,travelerMotion,visibleTraveler};
