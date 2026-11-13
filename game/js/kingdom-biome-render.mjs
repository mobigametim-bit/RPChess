/* Visible biome decorations for generator v6. Source SVGs are rasterized to PNG at build. */
import {VISUAL} from './kingdom-world-config.mjs';
import {randomAt,hash32} from './kingdom-parchment-core.mjs';
import {biomeAt,landmarkAt} from './kingdom-world-core.mjs';
const MARSH=Object.freeze(['01_','02_','03_','04_','05_','06_','13_','14_','16_']);
const WASTELAND=Object.freeze(['07_','08_','09_','10_','11_','12_','15_']);
function eligibleBiomeArt(paths,biome){
 const prefixes=biome==='marsh'?MARSH:WASTELAND;
 return paths.filter(path=>prefixes.some(prefix=>path.split('/').pop().startsWith(prefix)));
}
function drawSemanticDecor(ctx,{seed,left,top,width,height,extraGroups,drawVector,tile,repaint}){
 const variants={marsh:eligibleBiomeArt(extraGroups.marsh,'marsh'),
                 wasteland:eligibleBiomeArt(extraGroups.marsh,'wasteland')};
 const step=3.6;
 for(let yi=Math.floor(top/step)-1;yi<=Math.ceil((top+height)/step);yi++)
  for(let xi=Math.floor(left/step)-1;xi<=Math.ceil((left+width)/step);xi++){
   const x=xi*step+randomAt(seed,xi,yi,'extra-x')*step;
   const y=yi*step+randomAt(seed,xi,yi,'extra-y')*step;
   const biome=biomeAt(seed,Math.floor(x),Math.floor(y));
   const names=variants[biome];if(!names?.length)continue;
   const count=Math.min(3,Math.ceil(VISUAL.marshDensity));
   for(let i=0;i<count;i++){
    if(randomAt(seed,xi,yi,'marsh'+i)>=Math.min(1,VISUAL.marshDensity-i))continue;
    const dx=(randomAt(seed,xi,yi,'mx'+i)-.5)*step*.7;
    const dy=(randomAt(seed,xi,yi,'my'+i)-.5)*step*.7;
    const src=names[hash32(seed+':biome-art:'+biome+':'+xi+':'+yi+':marsh'+i)%names.length];
    const size=tile*VISUAL.marshSize;
    drawVector(ctx,src,(x+dx-left)*tile-size/2,(y+dy-top)*tile-size/2,
     size,size,VISUAL.marshOpacity,repaint);
   }
  }
 // Exactly one matching glyph at the center of each semantic landmark cell.
 const landmarks=new Map(extraGroups.landmarks.map(src=>[src.split('/').pop().replace(/\.png$/,''),src]));
 for(let y=Math.floor(top)-1;y<=Math.ceil(top+height);y++)
  for(let x=Math.floor(left)-1;x<=Math.ceil(left+width);x++){
   const id=landmarkAt(seed,x,y,{generatorVersion:6});
   const src=id&&landmarks.get(id);if(!src)continue;
   const size=tile*VISUAL.landmarkSize;
   drawVector(ctx,src,(x+.5-left)*tile-size/2,(y+.5-top)*tile-size/2,
    size,size,VISUAL.landmarkOpacity,repaint);
  }
}
export {MARSH,WASTELAND,eligibleBiomeArt,drawSemanticDecor};