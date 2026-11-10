/* Decorative road walkers: pure route generation with no game-state effects.
 * Travelers are drawn on an independent canvas; they never advance the calendar,
 * trigger an encounter, alter resources or persist animation state. */
import {visibleRoyalRoads,eligibleRoadNodes,ownedKeys} from './kingdom-road-network.mjs?v=20261110-roadgrid-v2';
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

// The same shared road graph drives both painting and NPC journeys.
function adjacencyOf(edges){
 const adj=new Map();
 for(const edge of edges)for(const [a,b] of [[edge.from,edge.to],[edge.to,edge.from]]){
  if(!adj.has(a))adj.set(a,[]);
  adj.get(a).push({to:b,edge});
 }
 for(const next of adj.values())next.sort((a,b)=>a.to<b.to?-1:a.to>b.to?1:0);
 return adj;
}
function findRoute(adj,start,end){
 if(start===end)return [];
 const seen=new Map([[start,null]]),queue=[start];
 for(let i=0;i<queue.length;i++){
  const here=queue[i];if(here===end)break;
  for(const next of adj.get(here)||[]){
   if(seen.has(next.to))continue;
   seen.set(next.to,{prev:here,edge:next.edge});queue.push(next.to);
  }
 }
 if(!seen.has(end))return null;
 const result=[];
 for(let id=end;id!==start;){
  const previous=seen.get(id);
  result.unshift({from:previous.prev,to:id,edge:previous.edge});
  id=previous.prev;
 }
 return result;
}
function royalTrip(map,seed,roads,origins){
 const adj=adjacencyOf(roads),stops=origins.filter(id=>adj.has(id));
 if(stops.length<2)return null;
 const origin=stops[seed%stops.length],visits=new Map([[origin,1]]);
 let current=origin;const legs=[];
 for(let n=0;n<Math.min(4,Math.max(2,stops.length));n++){
  const candidates=stops.filter(id=>id!==current&&findRoute(adj,current,id)?.length);
  if(!candidates.length)break;
  candidates.sort((a,b)=>(visits.get(a)||0)-(visits.get(b)||0)||
   (hash(seed+':'+n+':'+a)%100003)-(hash(seed+':'+n+':'+b)%100003)||
   (a<b?-1:1));
  const goal=candidates[0],route=findRoute(adj,current,goal);
  const segmentLengths=route.map(piece=>Math.hypot(
   Number(piece.to.split(',')[0])-Number(piece.from.split(',')[0]),
   Number(piece.to.split(',')[1])-Number(piece.from.split(',')[1])));
  const distance=segmentLengths.reduce((a,b)=>a+b,0);
  legs.push({kind:'royal',from:current,to:goal,route,segmentLengths,distance,
    hold:5+((seed>>>((n*4)%24))%9)});
  visits.set(goal,(visits.get(goal)||0)+1);current=goal;
 }
 if(current!==origin){
  const route=findRoute(adj,current,origin);
  if(route?.length)legs.push({kind:'royal',from:current,to:origin,route,
   segmentLengths:route.map(()=>1),distance:route.length,
   hold:7+((seed>>>22)%12)});
 }
 return legs.length?{origin,legs}:null;
}
function naturalHeading(map,start,index,owned,seed){
 const x=Number(start.split(',')[0])+.5;
 const outside=sign=>{
  let count=0;
  for(let step=1;step<=7;step++){
   const sx=x+sign*step,y=naturalRoadY(map,index,sx);
   if(!owned.has(Math.floor(sx)+','+Math.floor(y)))count++;
  }
  return count;
 };
 const right=outside(1),left=outside(-1);
 return right===left?(seed&1?1:-1):right>left?1:-1;
}
function naturalTrip(map,start,index,seed,owned){
 const x=Number(start.split(',')[0])+.5,dir=naturalHeading(map,start,index,owned,seed);
 // Visit distinct trail points beyond the border and on both sides of origin.
 const stops=[0,dir*(3+seed%3),-dir*(2+((seed>>>3)%4)),
              dir*(5+((seed>>>7)%3)),0];
 const legs=[];
 for(let j=1;j<stops.length;j++){
  const fromX=x+stops[j-1],toX=x+stops[j];
  legs.push({kind:'natural',fromX,toX,distance:Math.abs(toX-fromX),
   hold:j===stops.length-1?7+((seed>>>22)%12):5+((seed>>>(j*4))%9)});
 }
 return {origin:start,index,legs};
}
function createTravelers(map,{parchment=true,maxTravelers=MAX_TRAVELERS}={}){
 if(!map?.cells||!map?.castle)return [];
 const castle=map.castle.x+','+map.castle.y;
 const origins=[castle,...eligibleRoadNodes(map)];
 const owned=ownedKeys(map);
 const roads=visibleRoyalRoads(map),inside=roads.filter(e=>entirelyOwned(e,owned));
 const max=Math.min(MAX_TRAVELERS,Math.max(0,Math.floor(maxTravelers)));
 const walkers=[];
 for(let i=0;i<max;i++){
  const type=TYPES[i%TYPES.length],seed=hash(map.seed+':walker:'+i);
  const pool=OWNED_ONLY.has(type)?inside:roads;
  const trails=parchment&&!OWNED_ONLY.has(type)?
   origins.map(id=>({id,index:nearestNaturalRoad(map,id)}))
    .filter(o=>o.index!==null):[];
  const natural=trails.length>0&&
   (type==='merchant'||type==='courier'||(seed>>>4)%3===0||!pool.length);
  if(!natural&&!pool.length)continue;
  const itinerary=natural?
   (()=>{const src=trails[seed%trails.length];
     return naturalTrip(map,src.id,src.index,seed,owned);})():
   royalTrip(map,seed,pool,origins);
  if(!itinerary?.legs?.length)continue;
  const kind=natural?'natural':'royal';
  const speed=(natural?.38+(seed%25)/100:.32+(seed%35)/100)*WALK_SPEED_FACTOR;
  const schedule=travelerSchedule(seed,i);
  walkers.push({id:'walker:'+i,type,kind,start:itinerary.origin,
   ...itinerary,...schedule,seed,speed,
   // Compatibility with existing route tests, now the first of several legs.
   maxDistance:itinerary.legs[0].distance,
   edge:kind==='royal'?itinerary.legs[0].route[0]?.edge:null});
 }
 return walkers;
}
function travelerMotion(map,walker,elapsed){
 if(!walker||!Number.isFinite(elapsed)||elapsed<(walker.spawnDelay||0))return null;
 const legs=walker.legs||[];if(!legs.length||!(walker.speed>0))return null;
 const cycle=legs.reduce((total,l)=>total+l.distance/walker.speed+l.hold,0);
 if(!cycle)return null;
 let time=((elapsed-(walker.spawnDelay||0))%cycle+cycle)%cycle;
 for(let n=0;n<legs.length;n++){
  const leg=legs[n],duration=leg.distance/walker.speed;
  const moving=time<duration,progress=moving?time/duration:1;
  if(time<duration+leg.hold||n===legs.length-1){
   let position=null,heading=1;
   if(leg.kind==='natural'){
    const x=leg.fromX+(leg.toX-leg.fromX)*progress;
    position={x,y:naturalRoadY(map,walker.index,x)};
    heading=Math.sign(leg.toX-leg.fromX)||1;
   }else{
    let remaining=leg.distance*progress;
    for(let i=0;i<leg.route.length;i++){
     const segment=leg.route[i],span=leg.segmentLengths[i];
     if(remaining<=span||i===leg.route.length-1){
      const t=Math.max(0,Math.min(1,remaining/span));
      position=bezierPoint(segment.edge,segment.from===segment.edge.from?t:1-t);
      const a=numeric(segment.from),b=numeric(segment.to);
      heading=Math.sign(b[0]-a[0])||Math.sign(b[1]-a[1])||1;break;
     }
     remaining-=span;
    }
   }
   return {position,moving,heading,progress,legIndex:n,
      from:leg.from??walker.start,to:leg.to??null};
  }
  time-=duration+leg.hold;
 }
 return null;
}
function travelerPosition(map,walker,elapsed){
 return travelerMotion(map,walker,elapsed)?.position||null;
}
function visibleTraveler(map,walker,pos,owned){
 if(!pos||!map?.cells)return false;
 const id=Math.floor(pos.x)+','+Math.floor(pos.y),cell=map.cells[id];
 if(!cell||!(cell.explored||
   ['revealed','in_progress','failed','completed'].includes(cell.status)))return false;
 return !OWNED_ONLY.has(walker.type)||(owned||ownedKeys(map)).has(id);
}
export {TYPES,OWNED_ONLY,MAX_TRAVELERS,bezierPoint,entirelyOwned,
 naturalRoadY,nearestNaturalRoad,createTravelers,travelerMotion,travelerPosition,
 visibleTraveler,adjacencyOf,findRoute};
