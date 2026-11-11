/* Decorative road walkers: pure route generation with no game-state effects.
 * Travelers are drawn on an independent canvas; they never advance the calendar,
 * trigger an encounter, alter resources or persist animation state. */
import {visibleRoyalRoads,visibleTravelRoads,eligibleRoadNodes,ownedKeys} from './kingdom-road-network.mjs?v=20261110-roadgrid-v3';
import {randomAt} from './kingdom-parchment-core.mjs';
import {VISUAL} from './kingdom-world-config.mjs';
const TYPES=Object.freeze(['merchant','convoy','courier','patrol','builders']);
const OWNED_ONLY=new Set(['convoy','patrol','builders']);
const ROAD_SAMPLES=48;
// A territory-based quota replaces the old eight-actor ceiling. Rendering
// remains viewport-culling, so expanding kingdoms do not require new assets.
const MAX_TRAVELERS=Infinity;
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
// Match the HUD's 5/5 land counter exactly: only distinct central lands
// excluding the Castle count toward each actor class's floor(lands / 5).
// Outpost cells are valid routes but do not inflate the visible land counter.
// An unavailable lawful route yields zero actors, never a placeholder.
function territoryTravelerQuota(map){
 if(!map?.castle)return 0;
 const castle=map.castle.x+','+map.castle.y;
 const lands=new Set((map.centralOwnedCells||[]).filter(id=>id!==castle));
 return Math.floor(lands.size/5);
}
function settlementStops(map){
 const built=new Set((map.builtSettlements||[]).map(s=>s.id));
 for(const [id,cell] of Object.entries(map.cells||{})){
  if(cell?.selectedEncounter?.type==='settlement'&&
    cell.status==='completed')built.add(id);
 }
 return [...built].filter(id=>numeric(id)?.every(Number.isSafeInteger)).sort();
}
function pairTrip(roads,seed,starts,targets){
 const adj=adjacencyOf(roads);
 const pairs=[];
 for(const from of [...new Set(starts)].sort())for(const to of [...new Set(targets)].sort()){
  if(from===to||!adj.has(from)||!adj.has(to))continue;
  const outbound=findRoute(adj,from,to);
  if(outbound?.length)pairs.push({from,to,outbound});
 }
 if(!pairs.length)return null;
 const chosen=pairs[seed%pairs.length];
 const returnPath=findRoute(adj,chosen.to,chosen.from);
 if(!returnPath?.length)return null;
 const leg=(from,to,route,hold)=>({
  kind:'royal',from,to,route,
  segmentLengths:route.map(s=>Math.max(.0001,Math.hypot(
    Number(s.from.split(',')[0])-Number(s.to.split(',')[0]),
    Number(s.from.split(',')[1])-Number(s.to.split(',')[1])))),
  hold
 });
 const forward=leg(chosen.from,chosen.to,chosen.outbound,5+((seed>>>18)%9));
 const backward=leg(chosen.to,chosen.from,returnPath,7+((seed>>>22)%12));
 for(const item of [forward,backward])
  item.distance=item.segmentLengths.reduce((n,d)=>n+d,0);
 return {origin:chosen.from,legs:[forward,backward]};
}
// A convoy may also use the same naturally generated highways, but the
// entire trip (outbound and return) must be inside owned territory.
function ownedNaturalTrip(map,seed,owned){
 const anchors=[...owned].sort().map(id=>({id,index:nearestNaturalRoad(map,id)}))
  .filter(a=>a.index!==null);
 const viable=[];
 for(const anchor of anchors)for(const sign of [-1,1]){
  const length=ownedNaturalLength(map,anchor.id,anchor.index,sign,owned);
  if(length>=.65)viable.push({...anchor,sign,length});
 }
 if(!viable.length)return null;
 const item=viable[seed%viable.length],startX=Number(item.id.split(',')[0])+.5;
 const endX=startX+item.sign*Math.min(item.length,3.5);
 const distance=Math.abs(endX-startX);
 return {origin:item.id,index:item.index,legs:[
  {kind:'natural',fromX:startX,toX:endX,distance,hold:5+((seed>>>18)%9)},
  {kind:'natural',fromX:endX,toX:startX,distance,hold:7+((seed>>>22)%12)}
 ]};
}
// For traders a natural road is legal only if it ACTUALLY joins Castle /
// settlements; arbitrary scenery waypoints may not spawn merchants.
function settlementNaturalTrip(map,seed,settlements,owned){
 const castle=map.castle.x+','+map.castle.y;
 const stops=[castle,...settlements],possibilities=[];
 for(let i=0;i<stops.length;i++)for(let j=i+1;j<stops.length;j++){
  const a=stops[i],b=stops[j],p=numeric(a),q=numeric(b);
  if(!p||!q||p[0]===q[0])continue;
  const lane=nearestNaturalRoad(map,a);
  if(lane===null||nearestNaturalRoad(map,b)!==lane)continue;
  const x1=p[0]+.5,x2=q[0]+.5;
  let valid=true;
  for(let k=0;k<=Math.ceil(Math.abs(x2-x1)*32);k++){
   const x=x1+(x2-x1)*k/Math.max(1,Math.ceil(Math.abs(x2-x1)*32));
   const y=naturalRoadY(map,lane,x);
   if(!Number.isFinite(y)){valid=false;break;}
  }
  if(valid)possibilities.push({a,b,lane,x1,x2});
 }
 if(!possibilities.length)return null;
 const trip=possibilities[seed%possibilities.length],distance=Math.abs(trip.x2-trip.x1);
 return {origin:trip.a,index:trip.lane,legs:[
  {kind:'natural',fromX:trip.x1,toX:trip.x2,distance,hold:6+((seed>>>18)%9)},
  {kind:'natural',fromX:trip.x2,toX:trip.x1,distance,hold:8+((seed>>>22)%12)}
 ]};
}
function createTravelers(map,{parchment=true,maxTravelers=MAX_TRAVELERS}={}){
 if(!map?.cells||!map?.castle)return [];
 const owned=ownedKeys(map),quota=territoryTravelerQuota(map);
 const castle=map.castle.x+','+map.castle.y;
 const settlements=settlementStops(map),insideSettlements=settlements.filter(id=>owned.has(id));
 const roadEvents=eligibleRoadNodes(map);
 const royal=visibleRoyalRoads(map),travel=visibleTravelRoads(map);
 const allRoads=[...royal,...travel];
 const inside=royal.filter(edge=>entirelyOwned(edge,owned));
 const ownedNodes=[...new Set(inside.flatMap(e=>[e.from,e.to]))].sort();
 const origins=[castle,...roadEvents,...settlements,
  ...travel.flatMap(e=>[e.from,e.to])];
 const couriersOnNatural=parchment?[...new Set(origins)]
  .filter(id=>map.cells?.[id])
  .map(id=>({id,index:nearestNaturalRoad(map,id)}))
  .filter(o=>o.index!==null):[];
 const limit=Number.isFinite(maxTravelers)?Math.max(0,Math.floor(maxTravelers)):Infinity;
 const walkers=[],typeCounts=Object.fromEntries(TYPES.map(type=>[type,0]));
 // Fair round-robin allocation also honors a caller-supplied testing limit.
 for(let slot=0;slot<quota;slot++)for(const type of TYPES){
  if(walkers.length>=limit)return walkers;
  const seed=hash(map.seed+':walker:'+type+':'+slot);
  let itinerary=null,kind='royal';
  if(type==='courier'){
   // Use all painted network edges, including foreign roads; supplement
   // them with natural highways that extend past the kingdom border.
   // Spread couriers over all network segments without quadratic searches.
   const edge=allRoads.length?allRoads[seed%allRoads.length]:null;
   const royalTripPlan=edge?pairTrip(allRoads,seed,[edge.from],[edge.to]):null;
   const useNatural=couriersOnNatural.length>0&&(slot%2===1||!royalTripPlan);
   if(useNatural){
    const trail=couriersOnNatural[seed%couriersOnNatural.length];
    itinerary=naturalTrip(map,trail.id,trail.index,seed,owned);kind='natural';
   }else itinerary=royalTripPlan;
  }else if(type==='merchant'){
   itinerary=pairTrip(allRoads,seed,[castle],settlements);
   if(!itinerary&&parchment){
    itinerary=settlementNaturalTrip(map,seed,settlements,owned);
    if(itinerary)kind='natural';
   }
  }else if(type==='convoy'){
   itinerary=ownedNodes.length>=2?royalTrip(map,seed,inside,ownedNodes):null;
   if(parchment&&(!itinerary||slot%2===1)){
    const natural=ownedNaturalTrip(map,seed,owned);
    if(natural){itinerary=natural;kind='natural';}
   }
  }else if(type==='builders'){
   itinerary=pairTrip(inside,seed,[castle],insideSettlements);
  }else if(type==='patrol'){
   itinerary=pairTrip(inside,seed,[castle],roadEvents.filter(id=>owned.has(id)));
  }
  if(!itinerary?.legs?.length)continue; // No road or destination = no NPC.
  const speed=(kind==='natural'?.38+(seed%25)/100:.32+(seed%35)/100)*WALK_SPEED_FACTOR;
  const schedule=travelerSchedule(seed,slot*TYPES.length+TYPES.indexOf(type));
  walkers.push({id:'walker:'+type+':'+slot,type,kind,start:itinerary.origin,
   ...itinerary,...schedule,seed,speed,
   maxDistance:itinerary.legs[0].distance,
   edge:kind==='royal'?itinerary.legs[0].route[0]?.edge:null});
  typeCounts[type]++;
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
 const inside=(owned||ownedKeys(map)).has(id);
 if(OWNED_ONLY.has(walker.type))return inside;
 return inside||Boolean(cell&&(cell.explored||
  ['revealed','in_progress','failed','completed'].includes(cell.status)));
}
export {TYPES,OWNED_ONLY,MAX_TRAVELERS,territoryTravelerQuota,settlementStops,bezierPoint,entirelyOwned,
 naturalRoadY,nearestNaturalRoad,createTravelers,travelerMotion,travelerPosition,
 visibleTraveler,adjacencyOf,findRoute};
