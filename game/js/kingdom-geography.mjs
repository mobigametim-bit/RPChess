/* Single source of truth for visible natural road/river geometry.
 * The painter, world influences, NPCs and builders share these curves.
 * Coordinates and hashes are world-anchored and independent of viewport order.
 */
import {VISUAL} from './kingdom-world-config.mjs';
import {randomAt} from './kingdom-parchment-core.mjs';

const roadDrift=(seed,settings=VISUAL)=>
 randomAt(seed,1,1,'road')*Math.max(1,settings.roadSpacing)*(8/12);
const riverDrift=(seed,settings=VISUAL)=>
 randomAt(seed,1,1,'river')*Math.max(1,settings.riverSpacing)*(12/17);
function roadY(seed,index,x,settings=VISUAL){
 return index*Math.max(1,settings.roadSpacing)+roadDrift(seed,settings)+
  Math.sin(x*.37+index*2.1)*1.25*settings.roadCurve+
  Math.sin(x*.83+index)*.18*settings.roadCurve;
}
function riverX(seed,index,y,settings=VISUAL){
 return index*Math.max(1,settings.riverSpacing)+riverDrift(seed,settings)+
  Math.sin(y*.21+index*1.7)*2.15*settings.riverCurve+
  Math.sin(y*.79+index*.3)*.55;
}
function nearestNaturalPaths(seed,x,y,settings=VISUAL){
 const roadStep=Math.max(1,settings.roadSpacing),riverStep=Math.max(1,settings.riverSpacing);
 const roadCenter=Math.round((y-roadDrift(seed,settings))/roadStep);
 const riverCenter=Math.round((x-riverDrift(seed,settings))/riverStep);
 // Bound by the maximum possible bend; nearest baseline alone is insufficient.
 const roadRange=Math.ceil((1.25+.18)*Math.abs(settings.roadCurve)/roadStep)+2;
 const riverRange=Math.ceil((2.15*Math.abs(settings.riverCurve)+.55)/riverStep)+2;
 let roadDistance=Infinity,riverDistance=Infinity,roadIndex=null,riverIndex=null;
 for(let i=roadCenter-roadRange;i<=roadCenter+roadRange;i++){
  const d=Math.abs(roadY(seed,i,x,settings)-y);
  if(d<roadDistance){roadDistance=d;roadIndex=i;}
 }
 for(let i=riverCenter-riverRange;i<=riverCenter+riverRange;i++){
  const d=Math.abs(riverX(seed,i,y,settings)-x);
  if(d<riverDistance){riverDistance=d;riverIndex=i;}
 }
 return {road:roadDistance<.8,river:riverDistance<.7,
  roadDistance,riverDistance,roadIndex,riverIndex};
}
function naturalPathCrossesCell(seed,x,y,{roads=true,rivers=true}={},settings=VISUAL){
 // Sample across the area occupied by a building, not just its centre.
 for(let dy=.15;dy<=.85;dy+=.175)for(let dx=.15;dx<=.85;dx+=.175){
  const p=nearestNaturalPaths(seed,x+dx,y+dy,settings);
  if(roads&&p.roadDistance<.17||rivers&&p.riverDistance<.17)return true;
 }
 return false;
}
export {roadDrift,riverDrift,roadY,riverX,nearestNaturalPaths,naturalPathCrossesCell};
