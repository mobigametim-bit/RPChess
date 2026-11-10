/* Persistent, deterministic royal roads for the infinite map.
 * A scouted event inside owned land connects to the Castle and nearest other
 * owned scouted event. Geometry is an immutable, undirected edge snapshot.
 * Existing edges are never removed when expansion discovers closer nodes.
 * Pure data: no DOM, timers, hidden-fog disclosure, or run economy effects. */
const TILE_ID=/^-?\d+,-?\d+$/;
function point(id){
 if(typeof id!=='string'||!TILE_ID.test(id))return null;
 const [x,y]=id.split(',').map(Number);
 return Number.isSafeInteger(x)&&Number.isSafeInteger(y)?{x,y}:null;
}
function lex(a,b){return a<b?-1:a>b?1:0;}
function pairKey(a,b){return [a,b].sort(lex).join('::');}
function hash32(value){
 let h=2166136261;
 for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
 return h>>>0;
}
function ownedKeys(map){
 return new Set([String(map.castle.x)+','+String(map.castle.y),
  ...(map.centralOwnedCells||[]),
  ...(map.outposts||[]).flatMap(post=>post.cells||[]),
  ...Object.keys(map.cells||{}).filter(k=>map.cells[k]?.annexed)]);
}
function eligibleRoadNodes(map){
 if(!map?.castle||!map?.cells)return [];
 const owned=ownedKeys(map),castle=map.castle.x+','+map.castle.y;
 return Object.entries(map.cells).filter(([id,cell])=>
  id!==castle&&owned.has(id)&&point(id)&&
  cell&&typeof cell==='object'&&cell.selectedEncounter&&
  // Presence in the scouted cell record, not its "explored" visit flag:
  // entering/completing an encounter is NOT a prerequisite for a road.
  ['revealed','in_progress','failed','completed'].includes(cell.status))
  .map(([id])=>id).sort(lex);
}
function edge(map,a,b){
 const ids=[a,b].sort(lex),p=point(ids[0]),q=point(ids[1]);
 if(!p||!q||ids[0]===ids[1])return null;
 const span=Math.hypot(q.x-p.x,q.y-p.y);
 const salt=hash32((map.seed||'')+':royal-edge:'+ids.join(':'));
 const bend=(salt%2?-1:1)*Math.max(.18,Math.min(1.15,span*(.18+((salt>>>8)%80)/1000)));
 return {id:'royal:'+ids.join(':'),from:ids[0],to:ids[1],bend};
}
function nearestNode(id,nodes){
 const p=point(id);if(!p)return null;
 let best=null,dist=Infinity;
 for(const other of nodes){
  if(other===id)continue;
  const q=point(other),candidate=(p.x-q.x)**2+(p.y-q.y)**2;
  if(candidate<dist||(candidate===dist&&lex(other,best)<0)){
   best=other;dist=candidate;
  }
 }
 return best;
}

// v2: a road is a canonical undirected edge between adjacent cardinal cells.
// A tile already on the network never gets an overlaid second road.
const DIRECTIONS=Object.freeze([['n',0,-1],['e',1,0],['s',0,1],['w',-1,0]]);
const tileId=(x,y)=>x+','+y;
const cardinalEdge=(a,b)=>{
 const p=point(a),q=point(b);
 if(!p||!q||Math.abs(p.x-q.x)+Math.abs(p.y-q.y)!==1)return null;
 const ids=[a,b].sort(lex);
 return {id:'royal:'+ids.join(':'),from:ids[0],to:ids[1],bend:0};
};
function castleSector(castle,id){
 const a=point(castle),b=point(id);
 if(!a||!b||a.x===b.x&&a.y===b.y)return null;
 const dx=b.x-a.x,dy=b.y-a.y;
 return Math.abs(dx)>Math.abs(dy)?(dx>0?'e':'w'):(dy>0?'s':'n');
}
function castleSpokes(castle,nodes){
 const choices=new Map(),cp=point(castle);
 for(const id of nodes){
  const sector=castleSector(castle,id),p=point(id);
  if(!sector||!p)continue;
  const dist=(p.x-cp.x)**2+(p.y-cp.y)**2,prev=choices.get(sector);
  if(!prev||dist<prev.dist||dist===prev.dist&&lex(id,prev.id)<0)
   choices.set(sector,{id,dist});
 }
 return DIRECTIONS.filter(d=>choices.has(d[0]))
  .map(d=>({direction:d[0],id:choices.get(d[0]).id}));
}
function addPath(edges,path){
 for(let i=1;i<path.length;i++){
  const e=cardinalEdge(path[i-1],path[i]);
  if(e)edges.set(pairKey(e.from,e.to),e);
 }
}
function cmp(a,b){return a.cost-b.cost||a.steps-b.steps||lex(a.id,b.id);}
function push(heap,item){
 let i=heap.length;heap.push(item);
 while(i>0){const p=(i-1)>>1;if(cmp(heap[p],item)<=0)break;
  heap[i]=heap[p];i=p;
 }heap[i]=item;
}
function pop(heap){
 if(!heap.length)return null;
 const head=heap[0],tail=heap.pop();
 if(heap.length){
  let i=0;
  while(true){
   const l=i*2+1,r=l+1;
   if(l>=heap.length)break;
   const k=r<heap.length&&cmp(heap[r],heap[l])<0?r:l;
   if(cmp(tail,heap[k])<=0)break;
   heap[i]=heap[k];i=k;
  }
  heap[i]=tail;
 }
 return head;
}
// Bounded cardinal Dijkstra favors existing road tiles, then owned territory.
// No diagonal links or duplicated physical segments can be produced.
function routeTo(start,goals,{edges,owned,forcedFirst=null,margin=5,maxVisited=35000}){
 const targets=new Set(goals);
 if(!point(start)||!targets.size)return null;
 if(targets.has(start)&&!forcedFirst)return [start];
 const ends=[point(start),...[...targets].map(point)].filter(Boolean);
 const xs=ends.map(p=>p.x),ys=ends.map(p=>p.y);
 const minx=Math.min(...xs)-margin,maxx=Math.max(...xs)+margin;
 const miny=Math.min(...ys)-margin,maxy=Math.max(...ys)+margin;
 let initial=start,initialCost=0,prefix=[],excluded=null;
 if(forcedFirst){
  const d=DIRECTIONS.find(d=>d[0]===forcedFirst);
  if(!d)return null;
  const a=point(start);
  initial=tileId(a.x+d[1],a.y+d[2]);
  prefix=[start];excluded=start; // Never return through Castle and open a second exit.
  initialCost=1+(owned.has(initial)?0:2.5);
 }
 const heap=[],best=new Map([[initial,{cost:initialCost,steps:0,prev:null}]]);
 push(heap,{id:initial,cost:initialCost,steps:0});
 let found=null,visits=0;
 while(heap.length&&visits++<maxVisited){
  const cur=pop(heap),stored=best.get(cur.id);
  if(!stored||cur.cost!==stored.cost||cur.steps!==stored.steps)continue;
  if(targets.has(cur.id)){found=cur.id;break;}
  const p=point(cur.id);
  for(const [,dx,dy] of DIRECTIONS){
   const next=tileId(p.x+dx,p.y+dy),q=point(next);
   if(next===excluded||q.x<minx||q.x>maxx||q.y<miny||q.y>maxy)continue;
   const cost=cur.cost+(edges.has(pairKey(cur.id,next))?.05:1)+(owned.has(next)?0:2.5);
   const steps=cur.steps+1,prior=best.get(next);
   if(prior&&(prior.cost<cost-1e-8||
      Math.abs(prior.cost-cost)<1e-8&&
      (prior.steps<steps||prior.steps===steps&&lex(prior.prev,cur.id)<=0)))continue;
   best.set(next,{cost,steps,prev:cur.id});
   push(heap,{id:next,cost,steps});
  }
 }
 if(!found)return null;
 const path=[found];
 while(path[0]!==initial){
  const prior=best.get(path[0])?.prev;if(!prior)return null;
  path.unshift(prior);
 }
 return [...prefix,...path];
}
function generateRoads(map,nodes,castle){
 const owned=ownedKeys(map),edges=new Map(),used=new Set([castle]);
 for(const {direction,id} of castleSpokes(castle,nodes)){
  const route=routeTo(castle,[id],{edges,owned,forcedFirst:direction});
  if(!route)continue;
  addPath(edges,route);route.forEach(cell=>used.add(cell));
 }
 const cp=point(castle);
 const remain=nodes.filter(id=>!used.has(id)).sort((a,b)=>{
  const p=point(a),q=point(b);
  return ((p.x-cp.x)**2+(p.y-cp.y)**2)-((q.x-cp.x)**2+(q.y-cp.y)**2)||lex(a,b);
 });
 for(const id of remain){
  const p=point(id);
  const nearby=[...used].filter(u=>u!==castle).sort((a,b)=>{
   const x=point(a),y=point(b);
   return Math.abs(x.x-p.x)+Math.abs(x.y-p.y)-
          Math.abs(y.x-p.x)-Math.abs(y.y-p.y)||lex(a,b);
  }).slice(0,32);
  // If the event sits directly on a junction, no additional paving.
  if(!nearby.length)nearby.push(castle);
  const route=routeTo(id,nearby,{edges,owned});
  if(route){addPath(edges,route);route.forEach(cell=>used.add(cell));}
 }
 linkNearbyOwnedEvents(map,edges,eligibleRoadNodes(map));
 return [...edges.values()].sort((a,b)=>lex(a.id,b.id));
}
// Two king-move transitions means Chebyshev distance <= 2, including
// diagonal-near events. The physical paving remains cardinal.
function linkNearbyOwnedEvents(map,edges,events){
 const owned=ownedKeys(map),ordered=[...events].sort(lex);
 for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){
  const a=point(ordered[i]),b=point(ordered[j]);
  const dx=b.x-a.x,dy=b.y-a.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))>2)continue;
  const shortest=Math.abs(dx)+Math.abs(dy);
  if(!shortest)continue;
  let best=null,bestCost=Infinity;
  function visit(x,y,path){
   if(path.length-1===shortest){
    if(x!==b.x||y!==b.y)return;
    const existing=path.slice(1).every((id,k)=>edges.has(pairKey(id,path[k])));
    if(existing){best=null;bestCost=-1;return;}
    const outside=path.slice(1,-1).filter(id=>!owned.has(id)).length;
    const added=path.slice(1).filter((id,k)=>!edges.has(pairKey(id,path[k]))).length;
    const cost=outside*12+added*3;
    const signature=path.join('|');
    if(bestCost>=0&&(cost<bestCost||cost===bestCost&&signature<(best?.join('|')||'\uffff'))){
     bestCost=cost;best=path;
    }
    return;
   }
   if(bestCost<0)return;
   if(x!==b.x)visit(x+Math.sign(dx),y,[...path,tileId(x+Math.sign(dx),y)]);
   if(y!==b.y)visit(x,y+Math.sign(dy),[...path,tileId(x,y+Math.sign(dy))]);
  }
  visit(a.x,a.y,[ordered[i]]);
  if(best) addPath(edges,best);
 }
 return edges;
}
function visibleTravelRoads(map){
 const seen=new Set(),roads=[];
 for(const road of map?.completedRoads||[]){
  if(!point(road?.from)||!point(road?.to)||road.from===road.to)continue;
  const key=pairKey(road.from,road.to);
  if(seen.has(key))continue;
  seen.add(key);
  const base=edge(map,road.from,road.to);
  if(base)roads.push({...base,id:road.id||'completed:'+key,kind:'travel',
    bend:Number.isFinite(road.bend)?road.bend:base.bend});
 }
 return roads;
}
function synchronizeRoyalRoads(map){
 if(!map?.castle||!map.cells)return map;
 const castle=tileId(map.castle.x,map.castle.y),owned=ownedKeys(map);
 const events=eligibleRoadNodes(map);
 const extras=(map.outpostRoads||[]).flatMap(r=>[r?.from,r?.to])
  .filter(id=>point(id)&&id!==castle&&owned.has(id)&&map.cells?.[id]);
 const nodes=[...new Set([...events,...extras])].sort(lex);
 const signature=JSON.stringify({algorithm:'nearby-two-v3',castle,owned:[...owned].sort(lex),nodes});
 if(map.royalRoadsVersion===3&&map.royalRoadsSignature===signature&&
    Array.isArray(map.royalRoads))return map;
 const royalRoads=generateRoads(map,nodes,castle);
 return {...map,royalRoadsVersion:3,royalRoadsSignature:signature,royalRoads};
}
function visibleRoyalRoads(map){
 if(!map)return [];
 const current=map.royalRoadsVersion===3?map:synchronizeRoyalRoads(map);
 // Legacy completedRoads/outpostRoads remain in saves but are not painted
 // over the v2 network, preventing repeated lines at crossings.
 const seen=new Set(),result=[];
 for(const r of current.royalRoads||[]){
  if(!cardinalEdge(r?.from,r?.to))continue;
  const key=pairKey(r.from,r.to);
  if(seen.has(key))continue;
  seen.add(key);
  const own=ownedKeys(map);
  if(own.has(r.from)&&own.has(r.to))result.push({...r,surface:'sandstone'});
  else {
   const salt=hash32((map.seed||'')+':outbound:'+key);
   result.push({...r,surface:'gray',bend:(salt%2?-1:1)*(.16+(salt%7)*.025)});
  }
 }
 return result;
}
export {eligibleRoadNodes,nearestNode,castleSector,castleSpokes,ownedKeys,
 cardinalEdge,routeTo,generateRoads,linkNearbyOwnedEvents,synchronizeRoyalRoads,visibleRoyalRoads,visibleTravelRoads,pairKey};
