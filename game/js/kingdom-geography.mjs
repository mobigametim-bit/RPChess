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
export {roadDrift,riverDrift,naturalRoadY,naturalRiverX,nearestNaturalRoad,
 nearestNaturalRiver,naturalPathAt,riverbankAt,constructionPathAt};
