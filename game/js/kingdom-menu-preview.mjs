/* Compact, live, read-only kingdom projection for the six responsive main-menu layouts.
 * Reuses the game's parchment, roads and NPC renderers; never mutates the saved run. */
import {readRun} from './run-persistence.mjs';
import {validateKingdomMap} from './kingdom-map-core.mjs?v=20261110-roadgrid-v3';
import {kingdomMapSprite,kingdomEncounterSprite} from './kingdom-map-assets.mjs';
import {PARCHMENT_TILE} from './kingdom-parchment-core.mjs?v=20261111-parchment-png-only-v1';
import {commanderPieceArt} from './commander-portraits.mjs';
import {renderParchment,renderParchmentFog,parchmentAssetsSettled} from './kingdom-parchment-app.mjs?v=20261111-parchment-png-only-v1';
import {drawKingdomOverlay} from './kingdom-map-overlay.mjs?v=20261110-natural-road-layer-v4';
import {animateTravelers,stopTravelers} from './kingdom-traveler-renderer.mjs?v=20261111-npc-floor-v1';

const TILE=142,MAX_CANVAS=1900;
const menu=document.querySelector('[data-reboot-foundation]');
const stage=menu?.querySelector('[data-main-menu-kingdom]');
let lastKey='',pending=0,installed=false;
// The actual kingdom border is OWNED land (not everything scouted). An
// outpost's cells and castle are valid land even if their entries are sparse.
function boundsOf(map){
  const castle=map?.castle;
  if(!castle)return null;
  const ids=new Set([castle.x+','+castle.y,
    ...(map.centralOwnedCells||[]),
    ...(map.outposts||[]).flatMap(post=>[post.id,...(post.cells||[])]),
    ...Object.entries(map.cells||{}).filter(([,cell])=>cell?.annexed).map(([id])=>id)]);
  let minX=castle.x,maxX=castle.x,minY=castle.y,maxY=castle.y;
  for(const id of ids){
    const parts=String(id).split(','),x=Number(parts[0]),y=Number(parts[1]);
    if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y))continue;
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);
    minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  return {minX,maxX,minY,maxY,castle:{x:castle.x,y:castle.y}};
}

// The background stage remains 100% of the menu. Only the CAMERA focuses the
// explored-kingdom artwork into the user-marked region above the icon dock and
// strictly to the left of the Chronicle. The focus is measured, never hardcoded
// to a particular 1920x1080 screenshot.
function focusRegion(){
  const stageRect=stage.getBoundingClientRect();
  const layout=menu.querySelector('.reboot-menu-screen__layout')?.getBoundingClientRect();
  const dock=menu.querySelector('.reboot-menu-actions')?.getBoundingClientRect();
  const flag=menu.querySelector('[data-chronicle-panel]:not([hidden])')?.getBoundingClientRect();
  const landscape=matchMedia('(orientation: landscape)').matches;
  const gutter=Math.max(12,Math.min(24,stageRect.width*.025));
  const left=landscape&&layout?Math.max(gutter,layout.left-stageRect.left):gutter;
  const right=landscape&&flag&&flag.left>stageRect.left+left+96
    ?Math.min(stageRect.width-gutter,flag.left-stageRect.left-24)
    :stageRect.width-gutter;
  const top=Math.max(12,Math.min(22,stageRect.height*.018));
  let bottom=dock?dock.top-stageRect.top-12:stageRect.height*.75;
  if(bottom-top<96)bottom=Math.min(stageRect.height-12,top+Math.max(96,stageRect.height*.33));
  return {left,right:Math.max(left+96,right),top,
    bottom:Math.max(top+96,bottom),
    centerX:(left+Math.max(left+96,right))/2,
    centerY:(top+Math.max(top+96,bottom))/2,
    width:Math.max(96,right-left),
    height:Math.max(96,bottom-top)};
}

function cameraFor(map){
  const territory=boundsOf(map);
  if(!territory)return null;
  const focus=focusRegion();
  const castle=territory.castle;
  // Include the full perimeter of EACH border cell, not just its center.
  // Symmetric distance is necessary because the castle must remain centered.
  const maxX=Math.max(castle.x-territory.minX,territory.maxX-castle.x)+.5;
  const maxY=Math.max(castle.y-territory.minY,territory.maxY-castle.y)+.5;
  const padding=Math.min(18,Math.max(7,Math.min(focus.width,focus.height)*.025));
  const scale=Math.max(.0001,Math.min(
    (focus.width/2-padding)/(maxX*TILE),
    (focus.height/2-padding)/(maxY*TILE)));
  const stageWidth=stage.clientWidth,stageHeight=stage.clientHeight;
  // Fill the WHOLE menu with surrounding parchment even though the center and
  // scale are now determined exclusively by the much smaller kingdom focus.
  const radiusX=Math.max(focus.centerX,stageWidth-focus.centerX)/(scale*TILE);
  const radiusY=Math.max(focus.centerY,stageHeight-focus.centerY)/(scale*TILE);
  const halfColumns=Math.max(4,Math.ceil(radiusX+1));
  const halfRows=Math.max(3,Math.ceil(radiusY+1));
  const columns=halfColumns*2+1,rows=halfRows*2+1;
  return {focus,scale,territory,center:castle,columns,rows,
    left:castle.x-halfColumns,top:castle.y-halfRows};
}
function canvas(className){
  const element=document.createElement('canvas');
  element.className=className;element.setAttribute('aria-hidden','true');
  return element;
}
function site(src,x,y,klass,size){
  if(!src)return null;
  const img=document.createElement('img');
  img.src=src;img.alt='';img.decoding='async';img.loading='eager';
  img.className=klass;img.style.left=x+'px';img.style.top=y+'px';
  img.style.width=size+'px';img.style.height=size+'px';
  img.setAttribute('aria-hidden','true');
  return img;
}
function fit(){
  if(!stage||stage.hidden||!menu||menu.hidden)return;
  const world=stage.querySelector('[data-main-menu-world]');if(!world)return;
  const map=readRun()?.kingdomMap;
  if(!map||!validateKingdomMap(map))return;
  const camera=cameraFor(map);
  if(!camera)return;
  const {focus,scale,territory}=camera;
  // CSS transforms apply about the top-left. The world center is EXACTLY
  // the Castle because camera.center is pinned to map.castle.
  const x=focus.centerX-Number(world.dataset.worldWidth)*scale/2;
  const y=focus.centerY-Number(world.dataset.worldHeight)*scale/2;
  world.style.left='0px';world.style.top='0px';
  world.style.transformOrigin='top left';
  world.style.transform='translate('+x+'px, '+y+'px) scale('+scale+')';
  stage.dataset.kingdomScale=String(scale);
  stage.dataset.kingdomFocus=JSON.stringify(focus);
  stage.dataset.kingdomTerritory=JSON.stringify(territory);
}
function clear(){
  if(!stage)return;
  stopTravelers(stage.querySelector('.mm-kingdom-actors'));
  stage.replaceChildren();stage.hidden=true;lastKey='';
  menu?.classList.remove('mm-has-kingdom');
}
function render(){
  if(!stage||!menu||menu.hidden)return;
  const run=readRun(),map=run?.kingdomMap;
  if(!run||run.ended||!validateKingdomMap(map)){clear();return;}
  // Reveal the stage before geometry reads: [hidden] has zero dimensions.
  // The active menu class also reserves the portrait focus area.
  stage.hidden=false;
  menu.classList.add('mm-has-kingdom');
  const b=cameraFor(map);
  if(!b){clear();return;}
  const owned=(map.centralOwnedCells||[]).length;
  const signature=[run.id,run.savedAt||run.updatedAt||'',map.day||0,map.king.x,map.king.y,
    Object.keys(map.cells||{}).length,owned,b.columns,b.rows].join(':');
  if(signature===lastKey&&stage.firstElementChild){fit();return;}
  lastKey=signature;stage.hidden=false;
  menu.classList.add('mm-has-kingdom');
  const world=document.createElement('div');world.className='mm-kingdom-world';
  world.dataset.mainMenuWorld='';world.dataset.worldWidth=String(b.columns*TILE);
  world.dataset.worldHeight=String(b.rows*TILE);
  world.style.width=(b.columns*TILE)+'px';
  world.style.height=(b.rows*TILE)+'px';
  const view=b.center;
  const resolution=Math.min(1,MAX_CANVAS/Math.max(b.columns*PARCHMENT_TILE,b.rows*PARCHMENT_TILE));
  const parchment=canvas('mm-kingdom-parchment'),overlay=canvas('mm-kingdom-overlay');
  const actors=canvas('mm-kingdom-actors'),fog=canvas('mm-kingdom-fog');
  world.append(parchment,overlay,actors);
  renderParchment(parchment,{seed:map.seed,view,columns:b.columns,rows:b.rows,map,resolution});
  drawKingdomOverlay(overlay,{map,view,columns:b.columns,rows:b.rows,drawBorder:false,drawRoads:false,resolution});
  animateTravelers(actors,{map,view,columns:b.columns,rows:b.rows,parchment:true,resolution});
  const items=document.createElement('div');items.className='mm-kingdom-items';
  const add=(src,point,klass,size)=>{
    const image=site(src,(point.x-b.left+.5)*TILE,(point.y-b.top+.5)*TILE,klass,size);
    if(image)items.append(image);
  };
  add(kingdomMapSprite('castle',map.castle.raceTag),map.castle,'mm-kingdom-site',TILE*.73);
  for(const [id,cell] of Object.entries(map.cells||{})){
    if(!cell?.explored||!cell.selectedEncounter||id===map.castle.x+','+map.castle.y)continue;
    const [x,y]=id.split(',').map(Number);
    if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    const choice=cell.selectedEncounter;
    add(kingdomMapSprite(choice.type,choice.raceTag||choice.enemyRaceTag,
      choice.visualRaceTag||choice.seed||choice.id),{x,y},'mm-kingdom-site',TILE*.73);
    if(['battle','skirmish','caravan'].includes(choice.type)&&
      (cell.status!=='completed'||cell.respawnReady===true)){
      const defender=kingdomEncounterSprite(choice);
      add(defender,{x,y},'mm-kingdom-defender',TILE*.52);
    }
  }
  for(const post of map.outposts||[]){
    const [x,y]=String(post.id||'').split(',').map(Number);
    if(Number.isSafeInteger(x)&&Number.isSafeInteger(y)&&map.cells?.[post.id]?.explored)
      add('assets/kingdom-parchment/decor_minor_landmarks/04_watchtower.png',
        {x,y},'mm-kingdom-site',TILE*.73);
  }
  world.append(items);
  world.append(fog);
  renderParchmentFog(fog,{view,columns:b.columns,rows:b.rows,map,resolution});
  const king=site(commanderPieceArt(run.commanderId,'w'),
    (map.king.x-b.left+.5)*TILE,(map.king.y-b.top+.5)*TILE,'mm-kingdom-king',92);
  if(king)world.append(king);
  stage.replaceChildren(world);
  stage.dataset.kingdomRunId=String(run.id);
  stage.dataset.kingdomColumns=String(b.columns);
  stage.dataset.kingdomRows=String(b.rows);
  requestAnimationFrame(fit);
}
function schedule(){
  if(pending)return;
  pending=requestAnimationFrame(()=>{pending=0;render();});
}
function install(){
  if(installed||!stage||!menu)return;installed=true;
  if(typeof MutationObserver!=='undefined'){
    new MutationObserver(()=>{if(menu.hidden){stopTravelers(stage.querySelector('.mm-kingdom-actors'));lastKey='';return;}schedule();})
      .observe(menu,{attributes:true,attributeFilter:['hidden']});
  }
  // Recompute world limits on orientation and parent-size changes.
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(schedule).observe(stage);
  addEventListener('resize',schedule);
  addEventListener('rpchess:run-updated',schedule);
  addEventListener('rpchess:scene-changed',event=>{
    if(event.detail?.scene==='menu')schedule();
    else {stopTravelers(stage.querySelector('.mm-kingdom-actors'));lastKey='';}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  schedule();
}
function hasActiveKingdom(){
 const run=readRun();
 return Boolean(run&&!run.ended&&validateKingdomMap(run.kingdomMap));
}
function texturesSettled(){
 if(!hasActiveKingdom())return true;
 if(stage?.hidden||!stage.querySelector('[data-main-menu-world]'))return false;
 const images=[...stage.querySelectorAll('img')];
 return parchmentAssetsSettled(stage.querySelector('.mm-kingdom-parchment')) &&
  images.every(img=>img.complete&&img.naturalWidth>0);
}
// Wait only for textures visible on the current finite menu projection,
// never for the infinite unexplored world.
async function waitForTextures(){
 install();
 if(!menu||menu.hidden)return;
 const started=Date.now();
 while(Date.now()-started<17000){
  if(menu.hidden)return;
  render();
  if(texturesSettled()){
   await Promise.allSettled([...stage.querySelectorAll('img')].map(img=>img.decode?.()||Promise.resolve()));
   await new Promise(resolve=>requestAnimationFrame(resolve));
   if(texturesSettled())return;
  }
  await new Promise(resolve=>setTimeout(resolve,80));
 }
 console.warn('[RPChess] Menu parchment texture wait timed out; allowing gameplay');
}
globalThis.RPChessMenuPreview=Object.freeze({
 needsTextureWait:()=>Boolean(menu&&!menu.hidden&&!texturesSettled()),waitForTextures
});
export {install,boundsOf,waitForTextures};
