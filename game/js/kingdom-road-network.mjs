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
function synchronizeRoyalRoads(map){
 if(!map?.castle||!map.cells)return map;
 const nodes=eligibleRoadNodes(map),castle=map.castle.x+','+map.castle.y;
 const previous=Array.isArray(map.royalRoads)?map.royalRoads:[];
 const edges=new Map();
 for(const old of previous){
  if(!point(old?.from)||!point(old?.to)||old.from===old.to)continue;
  const fixed=edge(map,old.from,old.to);
  if(fixed)edges.set(pairKey(fixed.from,fixed.to),fixed);
 }
 for(const id of nodes){
  for(const other of [castle,nearestNode(id,nodes)]){
   if(!other)continue;
   const key=pairKey(id,other);
   if(!edges.has(key))edges.set(key,edge(map,id,other));
  }
 }
 const next=[...edges.values()].sort((a,b)=>lex(a.id,b.id));
 if(previous.length===next.length&&previous.every((r,i)=>
   r.id===next[i].id&&r.from===next[i].from&&r.to===next[i].to&&r.bend===next[i].bend))return map;
 return {...map,royalRoads:next};
}
function visibleRoyalRoads(map){
 if(!map)return [];
 const authoritative=Array.isArray(map.royalRoads)?map.royalRoads:
  synchronizeRoyalRoads(map).royalRoads||[];
 const found=new Set(),roads=[];
 for(const road of [...authoritative,...(map.outpostRoads||[])]){
  if(!point(road?.from)||!point(road?.to)||!Number.isFinite(road?.bend))continue;
  const key=pairKey(road.from,road.to);
  if(found.has(key))continue;
  found.add(key);roads.push(road);
 }
 return roads;
}
export {eligibleRoadNodes,nearestNode,synchronizeRoyalRoads,visibleRoyalRoads,pairKey};
