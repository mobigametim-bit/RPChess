/* Five purely decorative 4-frame 64px road walkers.
 * Single atlas/image decode, single view-canvas, no interaction or persistence. */
import {createTravelers,travelerMotion,visibleTraveler} from './kingdom-road-travelers.mjs';
import {PARCHMENT_TILE} from './kingdom-parchment-core.mjs';
const SRC='assets/kingdom-travelers/walkers_64.png';
const FRAMES=4,FRAME_SIDE=64,ANIM_MS=175,DISPLAY_PX=66;
const FRAME_ROWS=Object.freeze({merchant:0,convoy:1,courier:2,patrol:3,builders:4});
let image=null,loading=null,active=null,walkClockMs=0;
function loadAtlas(){
 if(image?.complete&&image.naturalWidth===256&&image.naturalHeight===320)return Promise.resolve(image);
 if(loading)return loading;
 image=new Image();
 image.src=SRC;
 loading=image.decode().then(()=>{
  if(image.naturalWidth!==256||image.naturalHeight!==320)throw Error('Invalid Kingdom traveler atlas dimensions');
  return image;
 }).catch(()=>{loading=null;return null;});
 return loading;
}
function stopTravelers(){
 if(!active)return;
 active.cancelled=true;
 if(active.frame!==null)cancelAnimationFrame(active.frame);
 active=null;
}
function animateTravelers(canvas,{map,view,columns,rows,parchment=true}){
 stopTravelers();
 if(!canvas||!map||!view)return;
 const width=columns*PARCHMENT_TILE,height=rows*PARCHMENT_TILE;
 if(canvas.width!==width)canvas.width=width;
 if(canvas.height!==height)canvas.height=height;
 const ctx=canvas.getContext('2d');
 if(!ctx)return;
 ctx.clearRect(0,0,width,height);
 const walkers=createTravelers(map,{parchment});
 canvas.dataset.walkerCount=String(walkers.length);
 canvas.dataset.decorativeOnly='true';
 canvas.dataset.atlasStatus='loading';
 const controller={cancelled:false,frame:null};
 active=controller;
 if(!walkers.length){canvas.dataset.atlasStatus='idle';return;}
 const left=view.x-Math.floor(columns/2),top=view.y-Math.floor(rows/2);
 const known=map.cells||{},owned=new Set([
  map.castle.x+','+map.castle.y,...(map.centralOwnedCells||[]),
  ...(map.outposts||[]).flatMap(post=>post.cells||[]),
  ...Object.keys(known).filter(id=>known[id]?.annexed)
 ]);
 const checkVisible=(actor,p)=>{
  if(!visibleTraveler(map,actor,p,owned))return false;
  const x=(p.x-left)*PARCHMENT_TILE,y=(p.y-top)*PARCHMENT_TILE;
  return x>=-DISPLAY_PX&&x<=width+DISPLAY_PX&&y>=-DISPLAY_PX&&y<=height+DISPLAY_PX;
 };
 let previousTick=null,lastPaint=0;
 const paint=now=>{
  if(controller.cancelled||active!==controller||!canvas.isConnected)return;
  controller.frame=requestAnimationFrame(paint);
  if(document.hidden){previousTick=null;return;}
  // A shared clock persists across camera pans, zoom and redraws, avoiding
  // repeated sprite teleports. Capping delta also pauses hidden/background time.
  if(previousTick!==null)walkClockMs+=Math.min(120,Math.max(0,now-previousTick));
  previousTick=now;
  if(now-lastPaint<33)return; // Cap this decorative layer to about 30 FPS.
  lastPaint=now;
  const elapsed=walkClockMs/1000,walkingFrame=Math.floor(walkClockMs/ANIM_MS)%FRAMES;
  ctx.clearRect(0,0,width,height);
  ctx.imageSmoothingEnabled=false;
  for(const walker of walkers){
   const motion=travelerMotion(map,walker,elapsed);
   const pos=motion?.position;
   if(!checkVisible(walker,pos))continue;
   const dir=motion.heading<0?-1:1;
   const frame=motion.moving?walkingFrame:0; // Stand still while resting.
   const x=(pos.x-left)*PARCHMENT_TILE,y=(pos.y-top)*PARCHMENT_TILE;
   ctx.save();
   if(dir<0){ctx.translate(x,0);ctx.scale(-1,1);ctx.translate(-x,0);}
   ctx.drawImage(image,frame*FRAME_SIDE,FRAME_ROWS[walker.type]*FRAME_SIDE,
     FRAME_SIDE,FRAME_SIDE,x-DISPLAY_PX/2,y-DISPLAY_PX*.79,DISPLAY_PX,DISPLAY_PX);
   ctx.restore();
  }
 };
 loadAtlas().then(loaded=>{
  if(controller.cancelled||active!==controller)return;
  if(!loaded){canvas.dataset.atlasStatus='missing';return;}
  canvas.dataset.atlasStatus='loaded';
  controller.frame=requestAnimationFrame(paint);
 });
}
export {animateTravelers,stopTravelers,loadAtlas,SRC};
