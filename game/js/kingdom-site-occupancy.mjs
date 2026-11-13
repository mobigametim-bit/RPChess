/* Shared construction footprint: avoid buildings on roads/water/other sites.
 * Routes are Bezier segments; endpoints alone do not describe the footprint.
 */
import {naturalPathCrossesCell} from './kingdom-geography.mjs';

const ID=/^-?\d+,-?\d+$/;
function occupiedByRoute(route,x,y){
 if(!ID.test(route?.from||'')||!ID.test(route?.to||''))return false;
 const [ax,ay]=route.from.split(',').map(Number),[bx,by]=route.to.split(',').map(Number);
 const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);
 if(!len||!Number.isFinite(route.bend))return false;
 const b=route.bend,nx=-dy/len,ny=dx/len;
 const x0=ax+.5,y0=ay+.5,x3=bx+.5,y3=by+.5;
 const x1=x0+dx*.32+nx*b,y1=y0+dy*.32+ny*b;
 const x2=x0+dx*.68-nx*b*.45,y2=y0+dy*.68-ny*b*.45;
 const samples=Math.max(48,Math.ceil((len+Math.abs(b)*2)*16));
 for(let k=0;k<=samples;k++){
  const t=k/samples,u=1-t;
  const px=u*u*u*x0+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3;
  const py=u*u*u*y0+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3;
  if(px>=x-.05&&px<=x+1.05&&py>=y-.05&&py<=y+1.05)return true;
 }
 return false;
}
function constructedRouteCrossesCell(map,x,y){
 // Deduplication is not needed: this is a yes/no footprint check.
 return ['royalRoads','completedRoads','outpostRoads'].some(field=>
  (map?.[field]||[]).some(route=>occupiedByRoute(route,x,y)));
}
function blockedConstructionCell(map,x,y,{includeNatural=true}={}){
 const id=x+','+y;
 if(id===map.castle.x+','+map.castle.y)return true;
 if((map.industry?.buildings||[]).some(b=>b.id===id))return true;
 if((map.builtSettlements||[]).some(b=>b.id===id))return true;
 if((map.outposts||[]).some(post=>post.id===id))return true;
 if(map.cells?.[id]?.selectedEncounter)return true;
 if(constructedRouteCrossesCell(map,x,y))return true;
 return includeNatural&&naturalPathCrossesCell(map.seed,x,y);
}
export {occupiedByRoute,constructedRouteCrossesCell,blockedConstructionCell};
