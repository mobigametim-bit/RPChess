/* Optional parchment atlas: an optimized, seamless author-provided ground tile.
 * The existing nature SVGs, world rivers and fog remain separate layers.
 */
import {PARCHMENT_TILE,randomAt,terrainAt,pickSprite,hash32} from './kingdom-parchment-core.mjs?v=20261111-parchment-png-only-v1';
import {VISUAL} from './kingdom-world-config.mjs?v=20261113-opaque-terrain-v1';
import {biomeAt,landmarkAt} from './kingdom-world-core.mjs';
import {roadYAt,riverXAt,closestRiver} from './kingdom-geography.mjs';
import {drawKingdomRoads} from './kingdom-map-overlay.mjs?v=20261112-province-colors-v1';

const PAPER_TILE_SRC='assets/kingdom-parchment/parchment_tile_256.webp',PAPER_TILE_SIZE=256;
const spriteCache=new Map();
const MAX_SPRITES=128; // 112 PNG atlas assets can coexist without reload churn.
let assetProbe=null,assetsReady=null,latest=null,redrawQueued=false;
let extraManifestRequested=false,extraManifestSettled=false;
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
    extraGroups[kind]=names.filter(file=>/\.png$/i.test(file))
      .map(file=>'assets/kingdom-parchment/'+folder+'/'+file);
   }
   queueRedraw();
  })
  .catch(()=>{}) // Old builds without optional groups remain playable.
   .finally(()=>{extraManifestSettled=true;queueRedraw();});
}
function extraSprite(seed,group,x,y,salt='sprite'){
 const names=extraGroups[group]||[];
 const kind=group==='marsh'?'marsh_wasteland_optional':'decor_minor_landmarks';
 return names.length?names[hash32(seed+':'+kind+':'+x+':'+y+':'+salt)%names.length]:null;
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
 assetProbe.src='assets/kingdom-parchment/forest_clusters/01_small_grove.png';
}
function getArt(src,repaint){
 if(assetsReady!==true)return null;
 let entry=spriteCache.get(src);
 if(entry){spriteCache.delete(src);spriteCache.set(src,entry);return entry.ready?entry.image:null;}
 if(spriteCache.size>=MAX_SPRITES)spriteCache.delete(spriteCache.keys().next().value);
 const image=new Image();entry={image,ready:false,failed:false};spriteCache.set(src,entry);
 image.onload=()=>{entry.ready=true;queueRedraw();};
 image.onerror=()=>{entry.failed=true;queueRedraw();};
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
 if(!src)return false;
 const art=getArt(src,repaint);if(!art)return false;
 ctx.save();ctx.globalAlpha=alpha;
 // Pre-rendered pixel art must not be blurred on canvas zoom/repaint.
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(art,x,y,width,height);ctx.restore();
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
   if(map?.cells?.[wx+','+wy]?.explored||wx===0&&wy===0)continue;
   const size=PARCHMENT_TILE*2.7;
   const px=(wx-left)*PARCHMENT_TILE-size/2,py=(wy-top)*PARCHMENT_TILE-size/2;
   drawVector(ctx,pickSprite(seed,'fog_of_war_shapes',x,y),px,py,size,size,VISUAL.fogInkOpacity,repaint);
  }
}
function drawLegacyOptionalNature(ctx,seed,left,top,width,height,map,repaint){
 // Exact Atlas Lab v6 distribution: 3.6-world-unit cells; independently
 // scattered marsh and decorative landmark SVGs. No scouting '?' markers.
 const step=3.6;
 for(let yi=Math.floor(top/step)-1;yi<=Math.ceil((top+height)/step);yi++)
  for(let xi=Math.floor(left/step)-1;xi<=Math.ceil((left+width)/step);xi++){
   const x=xi*step+randomAt(seed,xi,yi,'extra-x')*step;
   const y=yi*step+randomAt(seed,xi,yi,'extra-y')*step;
   const t=terrainAt(seed,x,y);
   if(t.wet>VISUAL.marshWetThreshold&&t.elevation<.59){
    const count=Math.min(3,Math.ceil(VISUAL.marshDensity));
    for(let i=0;i<count;i++){
     if(randomAt(seed,xi,yi,'marsh'+i)>=Math.min(1,VISUAL.marshDensity-i))continue;
     const dx=(randomAt(seed,xi,yi,'mx'+i)-.5)*step*.7;
     const dy=(randomAt(seed,xi,yi,'my'+i)-.5)*step*.7;
     const size=PARCHMENT_TILE*VISUAL.marshSize;
     const src=extraSprite(seed,'marsh',xi,yi,'marsh'+i);
     drawVector(ctx,src,(x+dx-left)*PARCHMENT_TILE-size/2,
      (y+dy-top)*PARCHMENT_TILE-size/2,size,size,VISUAL.marshOpacity,repaint);
    }
   }
   if(randomAt(seed,xi,yi,'landmark')<VISUAL.landmarkDensity){
    const size=PARCHMENT_TILE*VISUAL.landmarkSize;
    const src=extraSprite(seed,'landmarks',xi,yi);
    drawVector(ctx,src,(x-left)*PARCHMENT_TILE-size/2,
     (y-top)*PARCHMENT_TILE-size/2,size,size,VISUAL.landmarkOpacity,repaint);
   }
  }
}
// v6+ uses actual cell biome and landmark IDs; v5 saves keep historical art.
const MARSH_IDS=new Set(['01','02','03','04','05','06','13','14','16']);
const WASTELAND_IDS=new Set(['07','08','09','10','11','12','15']);
function biomeExtraSprite(seed,biome,x,y,salt){
 const allowed=biome==='marsh'?MARSH_IDS:WASTELAND_IDS;
 const items=extraGroups.marsh.filter(src=>allowed.has(src.split('/').pop().slice(0,2)));
 return items.length?items[hash32(seed+':'+biome+':'+x+':'+y+':'+salt)%items.length]:null;
}
function drawOptionalNature(ctx,seed,left,top,width,height,map,repaint){
 if((map?.worldGeneratorVersion||5)<=5)
  return drawLegacyOptionalNature(ctx,seed,left,top,width,height,map,repaint);
 const step=3.6;
 for(let yi=Math.floor(top/step)-1;yi<=Math.ceil((top+height)/step);yi++)
  for(let xi=Math.floor(left/step)-1;xi<=Math.ceil((left+width)/step);xi++){
   const x=xi*step+randomAt(seed,xi,yi,'extra-x')*step;
   const y=yi*step+randomAt(seed,xi,yi,'extra-y')*step;
   const biome=biomeAt(seed,Math.floor(x),Math.floor(y));
   if(biome!=='marsh'&&biome!=='wasteland')continue;
   const density=biome==='marsh'?VISUAL.marshDensity:VISUAL.wastelandDensity;
   for(let i=0;i<Math.min(3,Math.ceil(density));i++){
    if(randomAt(seed,xi,yi,'marsh'+i)>=Math.min(1,density-i))continue;
    const dx=(randomAt(seed,xi,yi,'mx'+i)-.5)*step*.7;
    const dy=(randomAt(seed,xi,yi,'my'+i)-.5)*step*.7;
    const size=PARCHMENT_TILE*VISUAL.marshSize;
    const src=biomeExtraSprite(seed,biome,xi,yi,'marsh'+i);
    drawVector(ctx,src,(x+dx-left)*PARCHMENT_TILE-size/2,
     (y+dy-top)*PARCHMENT_TILE-size/2,size,size,VISUAL.marshOpacity,repaint);
   }
  }
 for(let y=Math.floor(top)-1;y<=Math.ceil(top+height);y++)
  for(let x=Math.floor(left)-1;x<=Math.ceil(left+width);x++){
   const landmark=landmarkAt(seed,x,y,{worldGeneratorVersion:6});
   if(!landmark)continue;
   const src=extraGroups.landmarks.find(file=>file.endsWith('/'+landmark+'.png'));
   if(!src)continue;
   const size=PARCHMENT_TILE*VISUAL.landmarkSize;
   let px=x+.5,py=y+.5;
   if(landmark.endsWith('_bridge')){
    const river=closestRiver(seed,px,py);
    if(river.distance<=1)px=river.coordinate;
   }
   drawVector(ctx,src,(px-left)*PARCHMENT_TILE-size/2,
    (py-top)*PARCHMENT_TILE-size/2,size,size,VISUAL.landmarkOpacity,repaint);
  }
}
function fallbackSymbol(ctx,kind,x,y,size,seed){
 ctx.save();ctx.translate(x,y);
 const scale=size/128;ctx.scale(scale,scale);
 ctx.lineWidth=1.7;ctx.strokeStyle='#564a35';ctx.globalAlpha=1;
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
function drawWaterRoads(ctx,seed,left,top,width,height,map=null){
 const toLocalX=x=>(x-left)*PARCHMENT_TILE;
 const toLocalY=y=>(y-top)*PARCHMENT_TILE;
 const riverDrift=randomAt(seed,1,1,'river')*Math.max(1,VISUAL.riverSpacing)*(12/17);
 const lower=Math.floor((left-riverDrift-12)/VISUAL.riverSpacing)-1;
 const upper=Math.ceil((left+width-riverDrift+12)/VISUAL.riverSpacing)+1;
 ctx.save();ctx.globalAlpha=VISUAL.riverOpacity;
 for(let river=lower;river<=upper;river++){
  const center=river*VISUAL.riverSpacing+riverDrift;
  ctx.beginPath();
  for(let y=top-1,first=true;y<=top+height+1;y+=.16){
   const x=(map?.worldGeneratorVersion||5)>=6?riverXAt(seed,river,y):
    center+Math.sin(y*.21+river*1.7)*2.15*VISUAL.riverCurve+Math.sin(y*.79+river*.3)*.55;
   const px=toLocalX(x),py=toLocalY(y);
   if(first){ctx.moveTo(px,py);first=false;}else ctx.lineTo(px,py);
  }
  ctx.lineWidth=14*VISUAL.riverWidth;ctx.strokeStyle='#b7a78c';ctx.stroke();
  ctx.lineWidth=9*VISUAL.riverWidth;ctx.strokeStyle='#849a9e';ctx.stroke();
  ctx.lineWidth=2*VISUAL.riverWidth;ctx.strokeStyle='#c8d0ba';ctx.stroke();
 }
 ctx.restore();
 const roadDrift=randomAt(seed,1,1,'road')*Math.max(1,VISUAL.roadSpacing)*(8/12);
 const first=Math.floor((top-roadDrift-8)/VISUAL.roadSpacing)-1;
 const last=Math.ceil((top+height-roadDrift+8)/VISUAL.roadSpacing)+1;
 ctx.save();ctx.globalAlpha=VISUAL.roadOpacity;
 for(let road=first;road<=last;road++){
  const center=road*VISUAL.roadSpacing+roadDrift;
  ctx.beginPath();
  for(let x=left-1,firstPoint=true;x<=left+width+1;x+=.16){
   const y=(map?.worldGeneratorVersion||5)>=6?roadYAt(seed,road,x):
    center+Math.sin(x*.37+road*2.1)*1.25*VISUAL.roadCurve+Math.sin(x*.83+road)*.18;
   const px=toLocalX(x),py=toLocalY(y);
   if(firstPoint){ctx.moveTo(px,py);firstPoint=false;}else ctx.lineTo(px,py);
  }
  ctx.lineWidth=8*VISUAL.roadWidth;ctx.strokeStyle='#b6a17c';ctx.stroke();
  ctx.lineWidth=2.5*VISUAL.roadWidth;ctx.strokeStyle='#746245';ctx.setLineDash([9,7]);ctx.stroke();ctx.setLineDash([]);
 }
 ctx.restore();
}
function drawTerrainSymbols(ctx,seed,left,top,width,height,repaint,map=null){
 // Mirror Atlas Lab v6 drawNature(), including multiple stamps per node,
 // independent shifts, sprite salts, scale variation and biome mapping.
 const step=VISUAL.stampSpacing;
 const minX=Math.floor((left-3)/step),maxX=Math.ceil((left+width+3)/step);
 const minY=Math.floor((top-3)/step),maxY=Math.ceil((top+height+3)/step);
 for(let yi=minY;yi<=maxY;yi++)for(let xi=minX;xi<=maxX;xi++){
  const gx=xi*step+step*.38+randomAt(seed,xi,yi,'sx')*step*.24;
  const gy=yi*step+step*.38+randomAt(seed,xi,yi,'sy')*step*.24;
  const t=terrainAt(seed,gx,gy);
  const semantic=(map?.worldGeneratorVersion||5)>=6?
   biomeAt(seed,Math.floor(gx),Math.floor(gy)):t.kind;
  const kind=semantic==='forest'?'forest_clusters':
   semantic==='mountain'?'mountain_clusters':'hills_rocks';
  const density=semantic==='marsh'||semantic==='wasteland'?0:
   semantic==='forest'?VISUAL.forestDensity:
   semantic==='mountain'?VISUAL.mountainDensity:
   (semantic==='hill'||semantic==='hills')?VISUAL.hillDensity:VISUAL.plainDensity;
  for(let i=0;i<Math.min(4,Math.ceil(density));i++){
   if(randomAt(seed,xi,yi,'density'+i)>Math.min(1,density-i))continue;
   const jx=i===0?0:(randomAt(seed,xi,yi,'jx'+i)-.5)*step*.8;
   const jy=i===0?0:(randomAt(seed,xi,yi,'jy'+i)-.5)*step*.8;
   const size=PARCHMENT_TILE*(VISUAL.stampSize+
    (randomAt(seed,xi,yi,'scale'+i)-.5)*VISUAL.sizeVariation*2);
   const x=(gx+jx-left)*PARCHMENT_TILE,y=(gy+jy-top)*PARCHMENT_TILE;
   const src=pickSprite(seed,kind,xi,yi,'art'+i);
   const art=getArt(src,repaint);
   ctx.save();ctx.globalAlpha=VISUAL.stampOpacity;
   if(art)ctx.drawImage(art,x-size/2,y-size/2,size,size);
   else if(!src)fallbackSymbol(ctx,kind,x,y,size,seed+':'+xi+':'+yi+':'+i);
   ctx.restore();
  }
 }
}
function ownedIds(map){
 const ids=new Set(map?.centralOwnedCells||[]);
 if(map?.castle)ids.add(map.castle.x+','+map.castle.y);
 for(const post of map?.outposts||[])for(const id of post.cells||[])ids.add(id);
 for(const [id,cell] of Object.entries(map?.cells||{}))if(cell.annexed)ids.add(id);
 for(const id of map?.battleConqueredCells||[])ids.add(id);
 return ids;
}
// Use the SAME radial stops as drawFog() when deciding whether an encounter's
// cell center is readable. This is a visual test only: it never changes
// explored (visited), encounter status, the calendar or the saved world seed.
const FOG_SHOULDER=.68,FOG_SHOULDER_ALPHA=.98;
const FOG_EVENT_CLEARANCE=.75;
function fogRevealAtDistance(distance){
 const radius=VISUAL.fogRadius;
 if(!(radius>0)||distance>=radius)return 0;
 const inner=Math.min(radius*.9,VISUAL.fogInner);
 if(distance<=inner)return 1;
 const shoulder=radius*FOG_SHOULDER;
 if(distance<shoulder)return 1-(1-FOG_SHOULDER_ALPHA)*(distance-inner)/(shoulder-inner);
 return FOG_SHOULDER_ALPHA*(radius-distance)/(radius-shoulder);
}
// A tile is visibly scouted once its CENTER has at least 75% of the fog
// cleared by existing visited centers. Several overlapping gradients combine
// exactly like Canvas destination-out. Red Battle provinces do NOT count as
// scouting centers even though their political silhouette is visible.
function visibleThroughFog(map,point){
 if(!map||!point||!Number.isSafeInteger(point.x)||!Number.isSafeInteger(point.y))return false;
 const {x,y}=point,id=x+','+y;
 if(map.cells?.[id]?.explored===true||map.castle?.x===x&&map.castle?.y===y)return true;
 const range=Math.ceil(VISUAL.fogRadius);
 let remaining=1;
 for(let dy=-range;dy<=range;dy++)for(let dx=-range;dx<=range;dx++){
  const cx=x+dx,cy=y+dy;
  if(!(map.castle?.x===cx&&map.castle?.y===cy) &&
     map.cells?.[cx+','+cy]?.explored!==true)continue;
  const reveal=fogRevealAtDistance(Math.hypot(dx,dy));
  if(!reveal)continue;
  remaining*=1-reveal;
  if(1-remaining>=FOG_EVENT_CLEARANCE)return true;
 }
 return false;
}
function drawFog(ctx,map,left,top,width,height,resolution=1){
 const fog=document.createElement('canvas');fog.width=Math.round(width*PARCHMENT_TILE*resolution);
 fog.height=Math.round(height*PARCHMENT_TILE*resolution);
 const f=fog.getContext('2d');if(!f)return;
 f.setTransform(resolution,0,0,resolution,0,0);
 f.fillStyle='rgba(41,40,37,'+VISUAL.fogOpacity+')';
 f.fillRect(0,0,width*PARCHMENT_TILE,height*PARCHMENT_TILE);
 f.globalCompositeOperation='destination-out';
 const cells=map?.cells||{};
 for(const id of Object.keys(cells)){
   if(!cells[id]?.explored&&id!=='0,0')continue;
  const parts=id.split(','),x=Number(parts[0]),y=Number(parts[1]);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<left-2||y<top-2||x>left+width+2||y>top+height+2)continue;
  const cx=(x-left+.5)*PARCHMENT_TILE,cy=(y-top+.5)*PARCHMENT_TILE;
  const radius=PARCHMENT_TILE*VISUAL.fogRadius;
  const gradient=f.createRadialGradient(cx,cy,Math.min(radius*.9,PARCHMENT_TILE*VISUAL.fogInner),cx,cy,radius);
  gradient.addColorStop(0,'rgba(0,0,0,1)');
  gradient.addColorStop(FOG_SHOULDER,'rgba(0,0,0,'+FOG_SHOULDER_ALPHA+')');
  gradient.addColorStop(1,'rgba(0,0,0,0)');
  f.fillStyle=gradient;f.fillRect(cx-radius,cy-radius,2*radius,2*radius);
 }
 // The same polygon is visible before and after Battle victory; scouting its
 // defender exposes political borders but leaves other encounter icons hidden.
 const political=ownedIds(map);
 for(const province of map?.battleTerritories||[])
  if(map?.cells?.[province.id]?.explored===true)
   for(const id of province.cells||[])political.add(id);
 f.fillStyle='#000';
 for(const id of political){
  const [x,y]=id.split(',').map(Number);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<left-1||y<top-1||x>left+width||y>top+height)continue;
  f.fillRect((x-left)*PARCHMENT_TILE,(y-top)*PARCHMENT_TILE,PARCHMENT_TILE,PARCHMENT_TILE);
 }
 f.globalCompositeOperation='source-over';
 ctx.drawImage(fog,0,0,width*PARCHMENT_TILE,height*PARCHMENT_TILE);
}
function renderParchment(canvas,{seed,view,columns,rows,map,resolution=1,detailCanvas=null}){
 if(!canvas)return;
 probeArt();
 requestExtraManifest();
 // Observable renderer state for acceptance tests: the SVG probe, not the
 // browser's bounded resource-timing buffer, determines whether real art loaded.
 canvas.dataset.parchmentArt=assetsReady===true?'loaded':
  assetsReady===false?'missing':'loading';
 const width=columns*PARCHMENT_TILE,height=rows*PARCHMENT_TILE;
 if(canvas.width!==Math.round(width*resolution))canvas.width=Math.round(width*resolution);
 if(canvas.height!==Math.round(height*resolution))canvas.height=Math.round(height*resolution);
 const ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.setTransform(resolution,0,0,resolution,0,0);
 const left=view.x-Math.floor(columns/2),top=view.y-Math.floor(rows/2);
 latest=()=>{if(canvas.isConnected)renderParchment(canvas,{seed,view,columns,rows,map,resolution,detailCanvas});};
 ctx.clearRect(0,0,width,height);
 const repaint=()=>{if(canvas.isConnected)latest?.();};
 canvas.dataset.parchmentTexture=drawTiledPaper(ctx,left,top,columns,rows,repaint)?'loaded':'loading';
 drawBasePatches(ctx,seed,left,top,columns,rows,repaint);
 // Territory paint lives on an independent canvas above parchment, while ALL
 // road/water/nature strokes are kept on a separate foreground terrain canvas.
 // No political ink can wash out roads, vegetation or map objects.
 const features=detailCanvas||canvas;
 if(detailCanvas){
  if(features.width!==Math.round(width*resolution))features.width=Math.round(width*resolution);
  if(features.height!==Math.round(height*resolution))features.height=Math.round(height*resolution);
 }
 const detailCtx=detailCanvas?features.getContext('2d'):ctx;
 if(!detailCtx)return;
 if(detailCanvas){
  detailCtx.setTransform(resolution,0,0,resolution,0,0);
  detailCtx.clearRect(0,0,width,height);
 }
 drawWaterRoads(detailCtx,seed,left,top,columns,rows,map);
 canvas.dataset.playerRoadSegments=String(drawKingdomRoads(detailCtx,{map,view,columns,rows}));
 canvas.dataset.roadLayer=detailCanvas?'terrain-details':'terrain';
 drawTerrainSymbols(detailCtx,seed,left,top,columns,rows,repaint,map);
 drawOptionalNature(detailCtx,seed,left,top,columns,rows,map,repaint);
 drawFogInk(detailCtx,seed,left,top,columns,rows,map,repaint);
 // Opaque fog still lives in its own upper canvas, above concealed site sprites.

}
function renderParchmentFog(canvas,{view,columns,rows,map,resolution=1}){
 if(!canvas||!view||!map)return;
 const width=columns*PARCHMENT_TILE,height=rows*PARCHMENT_TILE;
 if(canvas.width!==Math.round(width*resolution))canvas.width=Math.round(width*resolution);
 if(canvas.height!==Math.round(height*resolution))canvas.height=Math.round(height*resolution);
 const ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.setTransform(resolution,0,0,resolution,0,0);
 ctx.clearRect(0,0,width,height);
 drawFog(ctx,map,view.x-Math.floor(columns/2),view.y-Math.floor(rows/2),columns,rows,resolution);
}
// Canvas textures are loaded asynchronously, outside the regular IMG/CSS gate.
function parchmentAssetsSettled(canvas){
 return Boolean(canvas && assetsReady !== null && extraManifestSettled &&
  canvas.dataset.parchmentTexture === 'loaded' && !redrawQueued &&
  [...spriteCache.values()].every(entry=>entry.ready||entry.failed));
}
export {renderParchment,renderParchmentFog,drawWaterRoads,parchmentAssetsSettled,visibleThroughFog};
