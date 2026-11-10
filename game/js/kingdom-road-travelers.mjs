/* Decorative road walkers: pure route generation with no game-state effects.
 * Travelers are drawn on an independent canvas; they never advance the calendar,
 * trigger an encounter, alter resources or persist animation state. */
import {visibleRoyalRoads,eligibleRoadNodes} from './kingdom-road-network.mjs';
import {randomAt} from './kingdom-parchment-core.mjs';
import {VISUAL} from './kingdom-world-config.mjs';
const TYPES=Object.freeze(['merchant','convoy','courier','patrol','builders']);
const OWNED_ONLY=new Set(['patrol','builders']);
const MAX_TRAVELERS=8,ROAD_SAMPLES=48;
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
 for(let i=0;i<=ROAD_SAMPLES;i++){
  const p=bezierPoint(edge,i/ROAD_SAMPLES);
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
function createTravelers(map,{parchment=true,maxTravelers=MAX_TRAVELERS}={}){
 if(!map?.cells||!map?.castle)return [];
 const nodes=[map.castle.x+','+map.castle.y,...eligibleRoadNodes(map)];
 const roads=visibleRoyalRoads(map),owned=ownedSet(map);
 const safe=roads.filter(road=>entirelyOwned(road,owned));
 const max=Math.min(MAX_TRAVELERS,Math.max(0,Math.floor(maxTravelers)));
 const walkers=[];
 for(let i=0;i<max;i++){
  const type=TYPES[i%TYPES.length],seed=hash(map.seed+':walker:'+i);
  const pool=OWNED_ONLY.has(type)?safe:roads;
  const naturalChoices=parchment&&!OWNED_ONLY.has(type)?
    nodes.map(id=>({id,road:nearestNaturalRoad(map,id)})).filter(o=>o.road!==null):[];
  const useNatural=naturalChoices.length>0&&((seed>>>4)%3===0||pool.length===0);
  if(!pool.length&&!useNatural)continue;
  if(useNatural){
   const item=naturalChoices[seed%naturalChoices.length];
   const from=numeric(item.id),direction=seed%2?-1:1;
   walkers.push({id:'walker:'+i,type,kind:'natural',start:item.id,index:item.road,
    originX:from[0]+.5,direction,speed:.38+(seed%25)/100,
    phase:((seed>>>8)%1000)/1000});
  }else{
   const edge=pool[seed%pool.length];
   const direction=seed&1?1:-1;
   walkers.push({id:'walker:'+i,type,kind:'royal',start:direction===1?edge.from:edge.to,
    edge,direction,speed:.32+(seed%35)/100,phase:((seed>>>8)%1000)/1000});
  }
 }
 return walkers;
}
function travelerPosition(map,walker,elapsed){
 if(!walker||!Number.isFinite(elapsed))return null;
 if(walker.kind==='royal'){
  const a=numeric(walker.edge.from),b=numeric(walker.edge.to);
  const length=Math.max(1,Math.hypot(a[0]-b[0],a[1]-b[1]));
  const u=((elapsed*walker.speed/length+walker.phase)%2+2)%2;
  const t=u>1?2-u:u;
  const parameter=walker.direction===1?t:1-t;
  return bezierPoint(walker.edge,parameter);
 }
 if(walker.kind==='natural'){
  const cycle=9;const u=((elapsed*walker.speed+walker.phase*cycle)% (cycle*2)+cycle*2)%(cycle*2);
  const delta=u>cycle?cycle*2-u:u;
  const x=walker.originX+walker.direction*delta;
  return {x,y:naturalRoadY(map,walker.index,x)};
 }
 return null;
}
function visibleTraveler(map,walker,pos){
 if(!pos)return false;
 const id=Math.floor(pos.x)+','+Math.floor(pos.y);
 if(!map.cells?.[id])return false; // Never reveal hidden fog by a walker.
 return !OWNED_ONLY.has(walker.type)||ownedSet(map).has(id);
}
export {TYPES,OWNED_ONLY,MAX_TRAVELERS,bezierPoint,entirelyOwned,
 naturalRoadY,nearestNaturalRoad,createTravelers,travelerPosition,visibleTraveler};
