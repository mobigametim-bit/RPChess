/* Optional atlas-style presentation only. No changes to kingdom-map gameplay.
 * Visible world is generated in cacheable 4x4-cell chunks by world coordinates.
 * The 112 artist SVGs are used lazily if assets/kingdom-parchment is installed;
 * the pure Canvas fallback keeps this experimental renderer testable on its own.
 */
import {PARCHMENT_TILE,PARCHMENT_CHUNK_CELLS,randomAt,noise2D,terrainAt,pickSprite} from './kingdom-parchment-core.mjs';

const CHUNK_PX=PARCHMENT_TILE*PARCHMENT_CHUNK_CELLS;
const chunkCache=new Map(),spriteCache=new Map();
const MAX_CHUNKS=18,MAX_SPRITES=36;
let assetProbe=null,assetsReady=null,latest=null;

function probeArt(){
 if(assetProbe||typeof Image==='undefined')return;
 assetProbe=new Image();
 assetProbe.onload=()=>{assetsReady=true;latest?.();};
 assetProbe.onerror=()=>{assetsReady=false;latest?.();};
 assetProbe.src='assets/kingdom-parchment/forest_clusters/01_small_grove.svg';
}
function getArt(src,repaint){
 if(assetsReady!==true)return null;
 let entry=spriteCache.get(src);
 if(entry){spriteCache.delete(src);spriteCache.set(src,entry);return entry.ready?entry.image:null;}
 if(spriteCache.size>=MAX_SPRITES)spriteCache.delete(spriteCache.keys().next().value);
 const image=new Image();entry={image,ready:false};spriteCache.set(src,entry);
 image.onload=()=>{entry.ready=true;repaint();};
 image.onerror=()=>{entry.ready=false;};
 image.src=src;
 return null;
}
function makeChunk(seed,cx,cy){
 const key=seed+':'+cx+':'+cy;
 if(chunkCache.has(key)){
  const hit=chunkCache.get(key);chunkCache.delete(key);chunkCache.set(key,hit);return hit;
 }
 const size=CHUNK_PX/4;
 const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx)return canvas;
 const pixels=ctx.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const wx=(cx*CHUNK_PX+(x+.5)*4)/PARCHMENT_TILE;
  const wy=(cy*CHUNK_PX+(y+.5)*4)/PARCHMENT_TILE;
  const terrain=terrainAt(seed,wx,wy);
  const veins=noise2D(seed,wx*2.9,wy*2.9,'paper')-.5;
  const flecks=randomAt(seed,Math.floor(wx*20),Math.floor(wy*20),'flecks')-.5;
  const offset=Math.round(veins*23+flecks*9);
  const tint=terrain.kind==='forest'?[-13,1,-16]:
             terrain.kind==='mountain'?[-16,-17,-21]:
             terrain.kind==='hill'?[-6,-8,-12]:[0,0,0];
  const pos=(y*size+x)*4;
  pixels.data[pos]=Math.max(0,Math.min(255,215+offset+tint[0]));
  pixels.data[pos+1]=Math.max(0,Math.min(255,196+offset+tint[1]));
  pixels.data[pos+2]=Math.max(0,Math.min(255,154+offset+tint[2]));
  pixels.data[pos+3]=255;
 }
 ctx.putImageData(pixels,0,0);
 if(chunkCache.size>=MAX_CHUNKS)chunkCache.delete(chunkCache.keys().next().value);
 chunkCache.set(key,canvas);return canvas;
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
function drawTerrainSymbols(ctx,seed,left,top,width,height,repaint){
 const step=3; // Fewer heavy vector pictures: approximately one stamp per 3x3 cells.
 const minX=Math.floor((left-2)/step),maxX=Math.ceil((left+width+2)/step);
 const minY=Math.floor((top-2)/step),maxY=Math.ceil((top+height+2)/step);
 for(let yi=minY;yi<=maxY;yi++)for(let xi=minX;xi<=maxX;xi++){
  const gx=xi*step+1.15+randomAt(seed,xi,yi,'sx')*.7;
  const gy=yi*step+1.15+randomAt(seed,xi,yi,'sy')*.7;
  const terrain=terrainAt(seed,gx,gy);
  const kind=terrain.kind==='forest'?'forest_clusters':
             terrain.kind==='mountain'?'mountain_clusters':'hills_rocks';
  if(terrain.kind==='plain'&&randomAt(seed,xi,yi,'skip')>.34)continue;
  const size=(1.65+randomAt(seed,xi,yi,'scale')*.9)*PARCHMENT_TILE;
  const x=(gx-left)*PARCHMENT_TILE,y=(gy-top)*PARCHMENT_TILE;
  const path=pickSprite(seed,kind,xi,yi);
  const art=getArt(path,repaint);
  ctx.save();ctx.globalAlpha=.72;
  if(art)ctx.drawImage(art,x-size/2,y-size/2,size,size);
  else fallbackSymbol(ctx,kind,x,y,size,seed+':'+xi+':'+yi);
  ctx.restore();
 }
}
function drawWaterRoads(ctx,seed,left,top,width,height){
 const toLocalX=x=>(x-left)*PARCHMENT_TILE;
 const toLocalY=y=>(y-top)*PARCHMENT_TILE;
 const riverDrift=randomAt(seed,1,1,'river')*12;
 const lower=Math.floor((left-riverDrift-12)/17)-1;
 const upper=Math.ceil((left+width-riverDrift+12)/17)+1;
 for(let river=lower;river<=upper;river++){
  const center=river*17+riverDrift;
  ctx.beginPath();
  for(let y=top-1;y<=top+height+1;y+=.16){
   const x=center+Math.sin(y*.21+river*1.7)*2.15+Math.sin(y*.79+river*.3)*.55;
   const px=toLocalX(x),py=toLocalY(y);
   if(y===top-1)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }
  ctx.lineWidth=14;ctx.strokeStyle='#b7a78c';ctx.stroke();
  ctx.lineWidth=9;ctx.strokeStyle='#849a9e';ctx.stroke();
  ctx.lineWidth=2;ctx.strokeStyle='#c8d0ba';ctx.stroke();
 }
 const roadDrift=randomAt(seed,1,1,'road')*8;
 const first=Math.floor((top-roadDrift-8)/12)-1,last=Math.ceil((top+height-roadDrift+8)/12)+1;
 for(let road=first;road<=last;road++){
  const center=road*12+roadDrift;
  ctx.beginPath();
  for(let x=left-1;x<=left+width+1;x+=.16){
   const y=center+Math.sin(x*.37+road*2.1)*1.25+Math.sin(x*.83+road)*.18;
   const px=toLocalX(x),py=toLocalY(y);
   if(x===left-1)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }
  ctx.lineWidth=8;ctx.strokeStyle='#b6a17c';ctx.stroke();
  ctx.lineWidth=2.5;ctx.strokeStyle='#746245';ctx.setLineDash([9,7]);ctx.stroke();ctx.setLineDash([]);
 }
}
function drawFog(ctx,map,left,top,width,height){
 const fog=document.createElement('canvas');fog.width=Math.round(width*PARCHMENT_TILE);
 fog.height=Math.round(height*PARCHMENT_TILE);
 const f=fog.getContext('2d');if(!f)return;
 f.fillStyle='rgba(41,40,37,.83)';f.fillRect(0,0,fog.width,fog.height);
 f.globalCompositeOperation='destination-out';
 const cells=map?.cells||{};
 for(const id of Object.keys(cells)){
  const parts=id.split(','),x=Number(parts[0]),y=Number(parts[1]);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<left-2||y<top-2||x>left+width+2||y>top+height+2)continue;
  const cx=(x-left+.5)*PARCHMENT_TILE,cy=(y-top+.5)*PARCHMENT_TILE;
  const radius=PARCHMENT_TILE*1.34;
  const gradient=f.createRadialGradient(cx,cy,PARCHMENT_TILE*.43,cx,cy,radius);
  gradient.addColorStop(0,'rgba(0,0,0,1)');
  gradient.addColorStop(.68,'rgba(0,0,0,.98)');
  gradient.addColorStop(1,'rgba(0,0,0,0)');
  f.fillStyle=gradient;f.fillRect(cx-radius,cy-radius,2*radius,2*radius);
 }
 f.globalCompositeOperation='source-over';
 ctx.drawImage(fog,0,0);
}
function drawBorders(ctx,map,left,top,width,height){
 const cells=map?.cells||{};
 ctx.save();ctx.lineWidth=2.5;ctx.strokeStyle='rgba(146,109,46,.86)';ctx.setLineDash([10,6]);
 for(const id of Object.keys(cells)){
  const cell=cells[id];if(!cell?.annexed)continue;
  const [x,y]=id.split(',').map(Number);
  if(x<left-1||x>left+width+1||y<top-1||y>top+height+1)continue;
  const a=(x-left)*PARCHMENT_TILE,b=(y-top)*PARCHMENT_TILE,t=PARCHMENT_TILE;
  const sides=[['n',0,-1],['e',1,0],['s',0,1],['w',-1,0]];
  for(const [side,dx,dy] of sides){
   if(cells[(x+dx)+','+(y+dy)]?.annexed)continue;
   ctx.beginPath();
   if(side==='n'){ctx.moveTo(a,b);ctx.quadraticCurveTo(a+t*.43,b-4,a+t,b);}
   else if(side==='e'){ctx.moveTo(a+t,b);ctx.quadraticCurveTo(a+t+4,b+t*.55,a+t,b+t);}
   else if(side==='s'){ctx.moveTo(a,b+t);ctx.quadraticCurveTo(a+t*.5,b+t+4,a+t,b+t);}
   else{ctx.moveTo(a,b);ctx.quadraticCurveTo(a-4,b+t*.5,a,b+t);}
   ctx.stroke();
  }
 }
 ctx.restore();
}
function renderParchment(canvas,{seed,view,columns,rows,map}){
 if(!canvas)return;
 probeArt();
 const width=columns*PARCHMENT_TILE,height=rows*PARCHMENT_TILE;
 if(canvas.width!==width)canvas.width=width;
 if(canvas.height!==height)canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const left=view.x-Math.floor(columns/2),top=view.y-Math.floor(rows/2);
 latest=()=>{if(canvas.isConnected)renderParchment(canvas,{seed,view,columns,rows,map});};
 ctx.clearRect(0,0,width,height);
 const xMin=Math.floor(left/PARCHMENT_CHUNK_CELLS),xMax=Math.floor((left+columns)/PARCHMENT_CHUNK_CELLS);
 const yMin=Math.floor(top/PARCHMENT_CHUNK_CELLS),yMax=Math.floor((top+rows)/PARCHMENT_CHUNK_CELLS);
 for(let y=yMin;y<=yMax;y++)for(let x=xMin;x<=xMax;x++){
  const chunk=makeChunk(seed,x,y);
  ctx.drawImage(chunk,(x*PARCHMENT_CHUNK_CELLS-left)*PARCHMENT_TILE,
   (y*PARCHMENT_CHUNK_CELLS-top)*PARCHMENT_TILE,CHUNK_PX,CHUNK_PX);
 }
 const repaint=()=>{if(canvas.isConnected)latest?.();};
 drawWaterRoads(ctx,seed,left,top,columns,rows);
 drawTerrainSymbols(ctx,seed,left,top,columns,rows,repaint);
 drawFog(ctx,map,left,top,columns,rows);
 drawBorders(ctx,map,left,top,columns,rows);
}
export {renderParchment};
