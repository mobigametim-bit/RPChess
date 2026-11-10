/* Compact, live, read-only kingdom projection for the six responsive main-menu layouts.
 * Reuses the game's parchment, roads and NPC renderers; never mutates the saved run. */
import {readRun} from './run-persistence.mjs';
import {validateKingdomMap,castleLevel} from './kingdom-map-core.mjs?v=20261110-roadgrid-v3';
import {kingdomMapSprite,kingdomEncounterSprite} from './kingdom-map-assets.mjs';
import {commanderPieceArt} from './commander-portraits.mjs';
import {renderParchment,renderParchmentFog} from './kingdom-parchment-app.mjs?v=20261110-menu-resolution';
import {drawKingdomOverlay} from './kingdom-map-overlay.mjs?v=20261110-menu-resolution';
import {animateTravelers,stopTravelers} from './kingdom-traveler-renderer.mjs?v=20261110-menu-resolution';

const TILE=142,MAX_CANVAS=1900;
const menu=document.querySelector('[data-reboot-foundation]');
const stage=menu?.querySelector('[data-main-menu-kingdom]');
let lastKey='',pending=0,installed=false;
function boundsOf(map){
  const ids=new Set([map.castle.x+','+map.castle.y,map.king.x+','+map.king.y,
    ...(map.centralOwnedCells||[]),...(map.outposts||[]).flatMap(post=>post.cells||[]),
    ...Object.keys(map.cells||{}).filter(id=>map.cells[id]?.explored||map.cells[id]?.annexed)]);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const id of ids){
    const parts=String(id).split(','),x=Number(parts[0]),y=Number(parts[1]);
    if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y))continue;
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);
    minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  if(!Number.isFinite(minX))return null;
  const center={x:Math.floor((minX+maxX)/2),y:Math.floor((minY+maxY)/2)};
  let columns=Math.max(9,Math.max(center.x-minX,maxX-center.x)*2+5);
  let rows=Math.max(7,Math.max(center.y-minY,maxY-center.y)*2+5);
  if(columns%2===0)columns++;if(rows%2===0)rows++;
  return {center,columns,rows,left:center.x-Math.floor(columns/2),
    top:center.y-Math.floor(rows/2)};
}
function canvas(className){
  const element=document.createElement('canvas');
  element.className=className;element.setAttribute('aria-hidden','true');
  return element;
}
function site(src,x,y,klass,size){
  if(!src)return null;
  const img=document.createElement('img');
  img.src=src;img.alt='';img.decoding='async';img.loading='lazy';
  img.className=klass;img.style.left=x+'px';img.style.top=y+'px';
  img.style.width=size+'px';img.style.height=size+'px';
  img.setAttribute('aria-hidden','true');
  return img;
}
function fit(){
  if(!stage||stage.hidden||!menu||menu.hidden)return;
  const world=stage.querySelector('[data-main-menu-world]');if(!world)return;
  const availableWidth=Math.max(0,stage.clientWidth-12);
  const availableHeight=Math.max(0,stage.clientHeight-12);
  const scale=Math.min(availableWidth/Number(world.dataset.worldWidth),
    availableHeight/Number(world.dataset.worldHeight));
  if(!Number.isFinite(scale)||scale<=0)return;
  world.style.transform='translate(-50%,-50%) scale('+scale+')';
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
  const b=boundsOf(map);if(!b){clear();return;}
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
  const resolution=Math.min(1,MAX_CANVAS/Math.max(b.columns*TILE,b.rows*TILE));
  const parchment=canvas('mm-kingdom-parchment'),overlay=canvas('mm-kingdom-overlay');
  const actors=canvas('mm-kingdom-actors'),fog=canvas('mm-kingdom-fog');
  world.append(parchment,overlay,actors);
  renderParchment(parchment,{seed:map.seed,view,columns:b.columns,rows:b.rows,map,resolution});
  drawKingdomOverlay(overlay,{map,view,columns:b.columns,rows:b.rows,drawBorder:false,resolution});
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
      add('assets/kingdom-parchment/decor_minor_landmarks/04_watchtower.svg',
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
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(fit).observe(stage);
  addEventListener('resize',fit);
  addEventListener('rpchess:run-updated',schedule);
  addEventListener('rpchess:scene-changed',event=>{
    if(event.detail?.scene==='menu')schedule();
    else {stopTravelers(stage.querySelector('.mm-kingdom-actors'));lastKey='';}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  schedule();
}
export {install,boundsOf};
