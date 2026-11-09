/* Optional parchment atlas: an optimized, seamless author-provided ground tile.
 * The existing nature SVGs, world rivers and fog remain separate layers.
 */
import {PARCHMENT_TILE,randomAt,terrainAt,pickSprite} from './kingdom-parchment-core.mjs';
import {VISUAL} from './kingdom-world-config.mjs?v=20261109-kingdom-parchment-tile-v8';
import {landmarkAt,biomeAt} from './kingdom-world-core.mjs?v=20261109-kingdom-parchment-tile-v8';

const PAPER_TILE_SRC='assets/kingdom-parchment/parchment_tile_256.webp',PAPER_TILE_SIZE=256;
const spriteCache=new Map();
const MAX_SPRITES=128; // 112 vector atlas assets can coexist without reload churn.
let assetProbe=null,assetsReady=null,latest=null,redrawQueued=false;
let extraManifestRequested=false;
const extraGroups={marsh:[],landmarks:[]};
function requestExtraManifest(){
 if(extraManifestRequested)return;
 extraManifestRequested=true;
 fetch('assets/kingdom-parchment/extra-manifest.json')
  .then(res=>res.ok?res.json():{})
  .then(data=>{
   const groups=data?.groups||{};
   // Artist-approved groups only. Never fall back to an unrelated directory:
   // renamed/misplaced sprites must not silently render as marshes.
   for(const [kind,folder] of [
    ['marsh','marsh_wasteland_optional'],
    ['landmarks','decor_minor_landmarks']
   ]){
    const names=Array.isArray(groups[folder])?groups[folder]:[];
    extraGroups[kind]=names.filter(file=>/\.(svg|png)$/i.test(file))
      .map(file=>'assets/kingdom-parchment/'+folder+'/'+file);
   }
   queueRedraw();
  })
  .catch(()=>{}); // Old builds without optional groups remain playable.
}
function extraSprite(seed,group,x,y){
 const names=extraGroups[group]||[];
 return names.length?names[Math.floor(randomAt(seed,x,y,'extra:'+group)*names.length)]:null;
}
function queueRedraw(){
 if(redrawQueued)return;
 redrawQueued=true;
 requestAnimationFrame(()=>{redrawQueued=false;latest?.();});
}

function probeArt(){
 if(assetProbe||typeof Image==='undefined')return;
 assetProbe=new Image();
 assetProbe.onload=()=>{assetsReady=true;queueRedraw();};
 assetProbe.onerror=()=>{assetsReady=false;queueRedraw();};
 assetProbe.src='assets/kingdom-parchment/forest_clusters/01_small_grove.svg';
}
function getArt(src,repaint){
 if(assetsReady!==true)return null;
 let entry=spriteCache.get(src);
 if(entry){spriteCache.delete(src);spriteCache.set(src,entry);return entry.ready?entry.image:null;}
 if(spriteCache.size>=MAX_SPRITES)spriteCache.delete(spriteCache.keys().next().value);
 const image=new Image();entry={image,ready:false};spriteCache.set(src,entry);
 image.onload=()=>{entry.ready=true;queueRedraw();};
 image.onerror=()=>{entry.ready=false;};
 image.src=src;
 return null;
}
function drawTiledPaper(ctx,left,top,width,height,repaint){
 const texture=getArt(PAPER_TILE_SRC,repaint);
 const widthPx=Math.round(width*PARCHMENT_TILE),heightPx=Math.round(height*PARCHMENT_TILE);
 ctx.fillStyle='#d9b77a';ctx.fillRect(0,0,widthPx,heightPx);
 if(!texture)return false;
 // All tiles are aligned to world pixels: panning/zoom never moves their seams.
 const startX=Math.floor(left*PARCHMENT_TILE/PAPER_TILE_SIZE)*PAPER_TILE_SIZE-left*PARCHMENT_TILE;
 const startY=Math.floor(top*PARCHMENT_TILE/PAPER_TILE_SIZE)*PAPER_TILE_SIZE-top*PARCHMENT_TILE;
 for(let y=startY;y<heightPx;y+=PAPER_TILE_SIZE)
  for(let x=startX;x<widthPx;x+=PAPER_TILE_SIZE)
   ctx.drawImage(texture,x,y,PAPER_TILE_SIZE,PAPER_TILE_SIZE);
 return true;
}
function drawVector(ctx,src,x,y,width,height,alpha,repaint){
 const art=getArt(src,repaint);if(!art)return false;
 ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(art,x,y,width,height);ctx.restore();
 return true;
}
function drawBasePatches(ctx,seed,left,top,width,height,repaint){
 // Small, sparse parchment watercolor overlays. World anchored, no tile grid.
 const step=VISUAL.baseSpacing;
 for(let y=Math.floor(top/step)-1;y<=Math.ceil((top+height)/step);y++)
  for(let x=Math.floor(left/step)-1;x<=Math.ceil((left+width)/step);x++){
   const px=(x*step-left+.32)*PARCHMENT_TILE,py=(y*step-top+.15)*PARCHMENT_TILE;
   const size=PARCHMENT_TILE*(2.4+randomAt(seed,x,y,'baseSize')*1.2);
   drawVector(ctx,pickSprite(seed,'parchment_base_variations',x,y),
    px,py,size,size,VISUAL.baseOpacity,repaint);
  }
}
function drawFogInk(ctx,seed,left,top,width,height,map,repaint){
 // Decorative fog shapes belong only in unexplored areas; the gradient mask
 // above still decides what the player is allowed to see.
 const step=6;
 for(let y=Math.floor(top/step);y<=Math.ceil((top+height)/step);y++)
  for(let x=Math.floor(left/step);x<=Math.ceil((left+width)/step);x++){
   const wx=x*step+3,wy=y*step+3;
   if(map?.cells?.[wx+','+wy])continue;
   const size=PARCHMENT_TILE*2.7;
   const px=(wx-left)*PARCHMENT_TILE-size/2,py=(wy-top)*PARCHMENT_TILE-size/2;
   drawVector(ctx,pickSprite(seed,'fog_of_war_shapes',x,y),px,py,size,size,VISUAL.fogInkOpacity,repaint);
  }
}
function drawOptionalNature(ctx,seed,left,top,width,height,map,repaint){
 // The same coordinate seed controls the decorative landmark and encounter.
 const step=3.6/VISUAL.marshDensity;
 for(let iy=Math.floor(top/step)-1;iy<=Math.ceil((top+height)/step);iy++)
  for(let ix=Math.floor(left/step)-1;ix<=Math.ceil((left+width)/step);ix++){
   const wx=ix*step+randomAt(seed,ix,iy,'extra-x')*step;
   const wy=iy*step+randomAt(seed,ix,iy,'extra-y')*step;
   const terrain=terrainAt(seed,wx,wy);
   if(terrain.wet<=VISUAL.marshWetThreshold||terrain.elevation>=VISUAL.hillThreshold)continue;
   if(randomAt(seed,ix,iy,'extra-visible')>.72)continue;
   const src=extraSprite(seed,'marsh',ix,iy);
   if(!src)continue;
   const size=PARCHMENT_TILE*VISUAL.marshSize;
   drawVector(ctx,src,(wx-left)*PARCHMENT_TILE-size/2,
    (wy-top)*PARCHMENT_TILE-size/2,size,size,VISUAL.marshOpacity,repaint);
  }
 for(let y=Math.floor(top);y<top+height;y++)
  for(let x=Math.floor(left);x<left+width;x++){
   const landmark=landmarkAt(seed,x,y);
   if(!landmark)continue;
   const src='assets/kingdom-parchment/decor_minor_landmarks/'+landmark+'.svg';
   const size=PARCHMENT_TILE*VISUAL.landmarkSize;
   drawVector(ctx,src,(x-left+.5)*PARCHMENT_TILE-size/2,
    (y-top+.5)*PARCHMENT_TILE-size/2,size,size,VISUAL.landmarkOpacity,repaint);
  }
}
function fallbackSymbol(ctx,kind,x,y,size,seed){
 ctx.save();ctx.translate(x,y);
 const scale=size/128;ctx.scale(scale,scale);
 ctx.lineWidth=1.7;ctx.strokeStyle='#564a35';ctx.globalAlpha=.85;
 if(kind==='forest_clusters'){
  for(let i=0;i<6;i++){
   const ox=(randomAt(seed,i,2,'tx')-.5)*80,oy=(randomAt(seed,i,8,'ty')-.5)*65;
   ctx.fillStyle='#6f805e';ctx.beginPath();ctx.ellipse(ox,oy,12,9,-.2,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.beginPath();ctx.moveTo(ox,oy+8);ctx.lineTo(ox+1,oy+15);ctx.stroke();
  }
 }else if(kind==='mountain_clusters'){
  ctx.fillStyle='#c3af89';
  for(let i=0;i<3;i++){
   const ox=-38+i*29,height=26+randomAt(seed,i,3,'mtn')*18;
   ctx.beginPath();ctx.moveTo(ox-18,21);ctx.lineTo(ox,-height);ctx.lineTo(ox+19,21);
   ctx.closePath();ctx.fill();ctx.stroke();
   ctx.beginPath();ctx.moveTo(ox,-height);ctx.lineTo(ox+3,9);ctx.stroke();
  }
 }else{
  ctx.strokeStyle='#877658';for(let i=0;i<3;i++){
   ctx.beginPath();ctx.ellipse(-28+i*28,6+i%2*7,17,8,-.1,Math.PI,Math.PI*2);ctx.stroke();
  }
 }
 ctx.restore();
}
// Roads and rivers are drawn as continuous world-coordinate Canvas strokes.
// No road_segments / river_segments assets or sprite-layer overlays are used.
function drawWaterRoads(ctx,seed,left,top,width,height){
 const toLocalX=x=>(x-left)*PARCHMENT_TILE;
 const toLocalY=y=>(y-top)*PARCHMENT_TILE;
 const riverDrift=randomAt(seed,1,1,'river')*12;
 const lower=Math.floor((left-riverDrift-12)/VISUAL.riverSpacing)-1;
 const upper=Math.ceil((left+width-riverDrift+12)/VISUAL.riverSpacing)+1;
 ctx.save();ctx.globalAlpha=VISUAL.riverOpacity;
 for(let river=lower;river<=upper;river++){
  const center=river*VISUAL.riverSpacing+riverDrift;
  ctx.beginPath();
  for(let y=top-1,first=true;y<=top+height+1;y+=.16){
   const x=center+Math.sin(y*.21+river*1.7)*2.15*VISUAL.riverCurve+Math.sin(y*.79+river*.3)*.55;
   const px=toLocalX(x),py=toLocalY(y);
   if(first){ctx.moveTo(px,py);first=false;}else ctx.lineTo(px,py);
  }
  ctx.lineWidth=14*VISUAL.riverWidth;ctx.strokeStyle='#b7a78c';ctx.stroke();
  ctx.lineWidth=9*VISUAL.riverWidth;ctx.strokeStyle='#849a9e';ctx.stroke();
  ctx.lineWidth=2*VISUAL.riverWidth;ctx.strokeStyle='#c8d0ba';ctx.stroke();
 }
 ctx.restore();
 const roadDrift=randomAt(seed,1,1,'road')*8;
 const first=Math.floor((top-roadDrift-8)/VISUAL.roadSpacing)-1;
 const last=Math.ceil((top+height-roadDrift+8)/VISUAL.roadSpacing)+1;
 ctx.save();ctx.globalAlpha=VISUAL.roadOpacity;
 for(let road=first;road<=last;road++){
  const center=road*VISUAL.roadSpacing+roadDrift;
  ctx.beginPath();
  for(let x=left-1,firstPoint=true;x<=left+width+1;x+=.16){
   const y=center+Math.sin(x*.37+road*2.1)*1.25*VISUAL.roadCurve+Math.sin(x*.83+road)*.18;
   const px=toLocalX(x),py=toLocalY(y);
   if(firstPoint){ctx.moveTo(px,py);firstPoint=false;}else ctx.lineTo(px,py);
  }
  ctx.lineWidth=8*VISUAL.roadWidth;ctx.strokeStyle='#b6a17c';ctx.stroke();
  ctx.lineWidth=2.5*VISUAL.roadWidth;ctx.strokeStyle='#746245';ctx.setLineDash([9,7]);ctx.stroke();ctx.setLineDash([]);
 }
 ctx.restore();
}
function drawTerrainSymbols(ctx,seed,left,top,width,height,repaint){
 const step=VISUAL.stampSpacing; // author-approved density, anchored to world coords
 const minX=Math.floor((left-2)/step),maxX=Math.ceil((left+width+2)/step);
 const minY=Math.floor((top-2)/step),maxY=Math.ceil((top+height+2)/step);
 for(let yi=minY;yi<=maxY;yi++)for(let xi=minX;xi<=maxX;xi++){
  const gx=xi*step+1.15+randomAt(seed,xi,yi,'sx')*.7;
  const gy=yi*step+1.15+randomAt(seed,xi,yi,'sy')*.7;
  const terrain=terrainAt(seed,gx,gy);
  const kind=terrain.kind==='forest'?'forest_clusters':
             terrain.kind==='mountain'?'mountain_clusters':'hills_rocks';
  if(biomeAt(seed,gx,gy)==='marsh')continue;
  const density=terrain.kind==='forest'?VISUAL.forestDensity:
   terrain.kind==='mountain'?VISUAL.mountainDensity:
   terrain.kind==='hill'?VISUAL.hillDensity:VISUAL.plainDensity;
  if(randomAt(seed,xi,yi,'skip')>Math.min(1,density))continue;
  const size=VISUAL.stampSize*(.7+randomAt(seed,xi,yi,'scale')*VISUAL.sizeVariation*.5)*PARCHMENT_TILE;
  const x=(gx-left)*PARCHMENT_TILE,y=(gy-top)*PARCHMENT_TILE;
  const path=pickSprite(seed,kind,xi,yi);
  const art=getArt(path,repaint);
  ctx.save();ctx.globalAlpha=VISUAL.stampOpacity;
  if(art)ctx.drawImage(art,x-size/2,y-size/2,size,size);
  else fallbackSymbol(ctx,kind,x,y,size,seed+':'+xi+':'+yi);
  ctx.restore();
 }
}
function drawFog(ctx,map,left,top,width,height){
 const fog=document.createElement('canvas');fog.width=Math.round(width*PARCHMENT_TILE);
 fog.height=Math.round(height*PARCHMENT_TILE);
 const f=fog.getContext('2d');if(!f)return;
 f.fillStyle='rgba(41,40,37,'+VISUAL.fogOpacity+')';f.fillRect(0,0,fog.width,fog.height);
 f.globalCompositeOperation='destination-out';
 const cells=map?.cells||{};
 for(const id of Object.keys(cells)){
  const parts=id.split(','),x=Number(parts[0]),y=Number(parts[1]);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<left-2||y<top-2||x>left+width+2||y>top+height+2)continue;
  const cx=(x-left+.5)*PARCHMENT_TILE,cy=(y-top+.5)*PARCHMENT_TILE;
  const radius=PARCHMENT_TILE*VISUAL.revealRadius;
  const gradient=f.createRadialGradient(cx,cy,PARCHMENT_TILE*.43,cx,cy,radius);
  gradient.addColorStop(0,'rgba(0,0,0,1)');
  gradient.addColorStop(.68,'rgba(0,0,0,.98)');
  gradient.addColorStop(1,'rgba(0,0,0,0)');
  f.fillStyle=gradient;f.fillRect(cx-radius,cy-radius,2*radius,2*radius);
 }
 f.globalCompositeOperation='source-over';
 ctx.drawImage(fog,0,0);
}
function renderParchment(canvas,{seed,view,columns,rows,map}){
 if(!canvas)return;
 probeArt();
 requestExtraManifest();
 // Observable renderer state for acceptance tests: the SVG probe, not the
 // browser's bounded resource-timing buffer, determines whether real art loaded.
 canvas.dataset.parchmentArt=assetsReady===true?'loaded':
  assetsReady===false?'missing':'loading';
 const width=columns*PARCHMENT_TILE,height=rows*PARCHMENT_TILE;
 if(canvas.width!==width)canvas.width=width;
 if(canvas.height!==height)canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const left=view.x-Math.floor(columns/2),top=view.y-Math.floor(rows/2);
 latest=()=>{if(canvas.isConnected)renderParchment(canvas,{seed,view,columns,rows,map});};
 ctx.clearRect(0,0,width,height);
 const repaint=()=>{if(canvas.isConnected)latest?.();};
 canvas.dataset.parchmentTexture=drawTiledPaper(ctx,left,top,columns,rows,repaint)?'loaded':'loading';
 drawBasePatches(ctx,seed,left,top,columns,rows,repaint);
 drawWaterRoads(ctx,seed,left,top,columns,rows);
 drawTerrainSymbols(ctx,seed,left,top,columns,rows,repaint);
 drawOptionalNature(ctx,seed,left,top,columns,rows,map,repaint);
 drawFog(ctx,map,left,top,columns,rows);
 drawFogInk(ctx,seed,left,top,columns,rows,map,repaint);
 // Sovereignty lines now use the shared organic overlay for both map skins.

}
export {renderParchment,drawWaterRoads};
