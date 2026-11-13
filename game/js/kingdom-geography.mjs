/* Canonical continuous natural geography for Kingdom v6+.
 * Renderer, simulation, industry and road walkers must use identical curves.
 * Legacy v5 gameplay path flags remain in kingdom-world-core.mjs.
 */
import {VISUAL} from './kingdom-world-config.mjs';
import {randomAt} from './kingdom-parchment-core.mjs';

function roadDrift(seed,config=VISUAL){
 return randomAt(seed,1,1,'road')*Math.max(1,config.roadSpacing)*(8/12);
}
function riverDrift(seed,config=VISUAL){
 return randomAt(seed,1,1,'river')*Math.max(1,config.riverSpacing)*(12/17);
}
function roadYAt(seed,index,x,config=VISUAL){
 return index*Math.max(1,config.roadSpacing)+roadDrift(seed,config)+
  config.roadCurve*(Math.sin(x*.37+index*2.1)*1.25+Math.sin(x*.83+index)*.18);
}
function riverXAt(seed,index,y,config=VISUAL){
 return index*Math.max(1,config.riverSpacing)+riverDrift(seed,config)+
  config.riverCurve*(Math.sin(y*.21+index*1.7)*2.15+Math.sin(y*.79+index*.3)*.55);
}
function closestRoad(seed,x,y,config=VISUAL){
 const step=Math.max(1,config.roadSpacing),base=Math.round((y-roadDrift(seed,config))/step);
 const extra=Math.ceil(Math.abs(config.roadCurve)*1.43/step)+2;
 let distance=Infinity,coordinate=null,index=null;
 for(let i=base-extra;i<=base+extra;i++){
  const at=roadYAt(seed,i,x,config),d=Math.abs(y-at);
  if(d<distance){distance=d;coordinate=at;index=i;}
 }
 return {distance,coordinate,index};
}
function closestRiver(seed,x,y,config=VISUAL){
 const step=Math.max(1,config.riverSpacing),base=Math.round((x-riverDrift(seed,config))/step);
 const extra=Math.ceil(Math.abs(config.riverCurve)*2.7/step)+2;
 let distance=Infinity,coordinate=null,index=null;
 for(let i=base-extra;i<=base+extra;i++){
  const at=riverXAt(seed,i,y,config),d=Math.abs(x-at);
  if(d<distance){distance=d;coordinate=at;index=i;}
 }
 return {distance,coordinate,index};
}
function naturalPathAt(seed,x,y,{roads=true,config=VISUAL}={}){
 if(!roads)return {road:false,river:false};
 return {road:closestRoad(seed,x,y,config).distance<.8,
  river:closestRiver(seed,x,y,config).distance<.7};
}
// Does a drawn natural line cross this tile (not merely its centre)?
function naturalTileOccupancy(seed,x,y,{roads=true,config=VISUAL}={}){
 if(!roads)return {road:false,river:false};
 let road=false,river=false;
 for(let i=0;i<=8;i++){
  const atX=x+i/8,atY=y+i/8;
  const r=closestRoad(seed,atX,y+.5,config);
  // Re-evaluate all line indices at each sample, including curve crossings.
  const rr=closestRoad(seed,atX,Math.min(y+1,Math.max(y,r.coordinate??y)),config);
  if(rr.distance<.52)road=true;
  const w=closestRiver(seed,x+.5,atY,config);
  const ww=closestRiver(seed,Math.min(x+1,Math.max(x,w.coordinate??x)),atY,config);
  if(ww.distance<.52)river=true;
  if(road&&river)break;
 }
 return {road,river};
}
export {roadDrift,riverDrift,roadYAt,riverXAt,closestRoad,closestRiver,naturalPathAt,naturalTileOccupancy};
