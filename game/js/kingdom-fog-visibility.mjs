/* Shared parchment fog visibility for Journey, menu projection and province silhouettes.
 * Pure state inspection; never marks explored or changes an encounter. */
import {VISUAL} from './kingdom-world-config.mjs?v=20261113-opaque-terrain-v1';
const FOG_SHOULDER=.68,FOG_SHOULDER_ALPHA=.98,FOG_EVENT_CLEARANCE=.75;
function fogRevealAtDistance(distance){
 const radius=VISUAL.fogRadius;
 if(!(radius>0)||distance>=radius)return 0;
 const inner=Math.min(radius*.9,VISUAL.fogInner);
 if(distance<=inner)return 1;
 const shoulder=radius*FOG_SHOULDER;
 if(distance<shoulder)return 1-(1-FOG_SHOULDER_ALPHA)*(distance-inner)/(shoulder-inner);
 return FOG_SHOULDER_ALPHA*(radius-distance)/(radius-shoulder);
}
function visibleThroughFog(map,point){
 if(!map||!point||!Number.isSafeInteger(point.x)||!Number.isSafeInteger(point.y))return false;
 const {x,y}=point,id=x+','+y;
 if(map.cells?.[id]?.explored===true||map.castle?.x===x&&map.castle?.y===y)return true;
 const range=Math.ceil(VISUAL.fogRadius);
 let remaining=1;
 for(let dy=-range;dy<=range;dy++)for(let dx=-range;dx<=range;dx++){
  const cx=x+dx,cy=y+dy;
  if(!(map.castle?.x===cx&&map.castle?.y===cy)&&
     map.cells?.[cx+','+cy]?.explored!==true)continue;
  const reveal=fogRevealAtDistance(Math.hypot(dx,dy));
  if(!reveal)continue;
  remaining*=1-reveal;
  if(1-remaining>=FOG_EVENT_CLEARANCE)return true;
 }
 return false;
}
export {FOG_SHOULDER,FOG_SHOULDER_ALPHA,FOG_EVENT_CLEARANCE,visibleThroughFog};
