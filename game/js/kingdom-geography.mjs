/* Canonical natural-road / river geometry shared by terrain, encounters, NPCs and industry.
 * Version 6 deliberately keeps the existing visible Canvas geometry, so upgrading
 * world logic does not relocate already drawn roads or rivers.
 * Version 5 encounter positions remain available for saved worlds. */
import {VISUAL} from './kingdom-world-config.mjs';
import {randomAt} from './kingdom-parchment-core.mjs';

function roadDrift(seed,settings=VISUAL){
 const spacing=Math.max(1,settings.roadSpacing);
 return randomAt(seed,1,1,'road')*spacing*(8/12);
}
function riverDrift(seed,settings=VISUAL){
 const spacing=Math.max(1,settings.riverSpacing);
 return randomAt(seed,1,1,'river')*spacing*(12/17);
}
function naturalRoadY(seed,index,x,settings=VISUAL){
 const step=Math.max(1,settings.roadSpacing);
 return index*step+roadDrift(seed,settings)+
   Math.sin(x*.37+index*2.1)*1.25*settings.roadCurve+
   Math.sin(x*.83+index)*.18;
}
function naturalRiverX(seed,index,y,settings=VISUAL){
 const step=Math.max(1,settings.riverSpacing);
 return index*step+riverDrift(seed,settings)+
   Math.sin(y*.21+index*1.7)*2.15*settings.riverCurve+
   Math.sin(y*.79+index*.3)*.55;
}
function nearestNaturalRoad(seed,x,y,settings=VISUAL){
 const step=Math.max(1,settings.roadSpacing),mid=Math.round((y-roadDrift(seed,settings))/step);
 const radius=Math.max(3,Math.ceil((1.25*Math.abs(settings.roadCurve)+.18+1)/step)+2);
 let index=mid,distance=Infinity;
 for(let i=mid-radius;i<=mid+radius;i++){
  const d=Math.abs(naturalRoadY(seed,i,x,settings)-y);
  if(d<distance){distance=d;index=i;}
 }
 return {index,distance};
}
function nearestNaturalRiver(seed,x,y,settings=VISUAL){
 const step=Math.max(1,settings.riverSpacing),mid=Math.round((x-riverDrift(seed,settings))/step);
 const radius=Math.max(3,Math.ceil((2.15*Math.abs(settings.riverCurve)+.55+1)/step)+2);
 let index=mid,distance=Infinity;
 for(let i=mid-radius;i<=mid+radius;i++){
  const d=Math.abs(naturalRiverX(seed,i,y,settings)-x);
  if(d<distance){distance=d;index=i;}
 }
 return {index,distance};
}
function naturalPathAt(seed,x,y,{settings=VISUAL,roads=true}={}){
 if(!roads)return {road:false,river:false};
 return {road:nearestNaturalRoad(seed,x,y,settings).distance<.8,
         river:nearestNaturalRiver(seed,x,y,settings).distance<.7};
}
function riverbankAt(seed,x,y,settings=VISUAL){
 return nearestNaturalRiver(seed,x+.5,y+.5,settings).distance<=.48;
}
function constructionPathAt(seed,x,y,settings=VISUAL){
 const px=x+.5,py=y+.5;
 return {road:nearestNaturalRoad(seed,px,py,settings).distance<.8,
         river:nearestNaturalRiver(seed,px,py,settings).distance<.7};
}
// These cubic Bezier controls match the actual painted stone roads.
function pavedRoadPoint(edge,t){
 const a=String(edge?.from||'').split(',').map(Number);
 const b=String(edge?.to||'').split(',').map(Number);
 if(a.length!==2||b.length!==2||![...a,...b,edge?.bend].every(Number.isFinite))return null;
 const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
 if(!len)return null;
 const x0=a[0]+.5,y0=a[1]+.5,x3=b[0]+.5,y3=b[1]+.5;
 const nx=-dy/len,ny=dx/len,offset=edge.bend;
 const x1=x0+dx*.32+nx*offset,y1=y0+dy*.32+ny*offset;
 const x2=x0+dx*.68-nx*offset*.45,y2=y0+dy*.68-ny*offset*.45;
 const u=1-t;
 return {x:u*u*u*x0+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3,
         y:u*u*u*y0+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3};
}
function pavedRoadCells(edge){
 const start=pavedRoadPoint(edge,0),end=pavedRoadPoint(edge,1);
 if(!start||!end)return [];
 const len=Math.hypot(end.x-start.x,end.y-start.y)+Math.abs(edge.bend||0)*2;
 const steps=Math.min(8192,Math.max(4,Math.ceil(len*8)));
 const cells=new Set();
 for(let i=0;i<=steps;i++){
  const p=pavedRoadPoint(edge,i/steps);if(!p)continue;
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
   const x=Math.floor(p.x)+dx,y=Math.floor(p.y)+dy;
   // Building footprint includes at least .4 cell from its center.
   if(Math.abs(p.x-x-.5)<.55&&Math.abs(p.y-y-.5)<.55)cells.add(x+','+y);
  }
 }
 return [...cells];
}
export {roadDrift,riverDrift,naturalRoadY,naturalRiverX,nearestNaturalRoad,
 nearestNaturalRiver,naturalPathAt,riverbankAt,constructionPathAt,pavedRoadPoint,pavedRoadCells};
