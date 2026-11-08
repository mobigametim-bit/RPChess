/* Journey's infinite kingdom map presentation. Existing encounter owners remain intact. */
import {readRun,writeRun} from './run-persistence.mjs';
import {readPlayerRating} from './player-rating.mjs';
import {commanderPieceArt,commanderById} from './commander-portraits.mjs';
import {raceBoardTiles} from './race-assets.mjs';
import {difficultyForStars} from './encounter-difficulty.mjs';
import {kingdomMapSprite} from './kingdom-map-assets.mjs';
import {subscribe,currentLanguage,t} from './i18n.mjs';
import {createKingdomMap,validateKingdomMap,updatePeak,randomEncounter,enterCell,
 beginEncounter,finishEncounter,matchesCombatReceipt,annexCell,canAnnex,pointsAvailable,castleLevel,
 romanForStars,keyOf,adjacent,borderEdges} from './kingdom-map-core.mjs';

const COPY={
 ru:{title:'Карта королевства',castle:'Замок',supply:'Припасы',power:'Мощь',points:'Очки присоединения',
   hidden:'Неизведанная территория',annex:'Присоединить · 1 очко',annexed:'В составе королевства',
   complete:'Пройдена',failed:'Неудача — повторная попытка',inProgress:'Встреча продолжается',
   return:'К отряду',reveal:'Открыта встреча',entry:'Начинается',services:'Услуги поселения',
   pending:'Открываю путь…',level:'Уровень',unavailable:'Недоступно для присоединения',
   discover:'Выбери соседнюю клетку, чтобы исследовать её',congrat:'Замок получил уровень',
   empty:'Открывайте территорию, чтобы основать королевство'},
 en:{title:'Kingdom Map',castle:'Castle',supply:'Supplies',power:'Power',points:'Annexation points',
   hidden:'Unexplored territory',annex:'Annex · 1 point',annexed:'Part of your kingdom',
   complete:'Cleared',failed:'Failed — retry encounter',inProgress:'Encounter in progress',
   return:'Squad',reveal:'Encounter discovered',entry:'Entering',services:'Settlement services',
   pending:'Exploring…',level:'Level',unavailable:'Cannot annex yet',
   discover:'Select an adjacent tile to explore',congrat:'Castle reached level',
   empty:'Explore the realm to found a kingdom'}
};
const WIDTH=9,HEIGHT=7,CENTER_X=4,CENTER_Y=3;
// The camera is independent of the king: keep world cells stationary when he
// moves inside the viewport. Only pan after he reaches its inner edge.
let screen=null,selected=null,movement=null,camera=null,flightTimer=null,launchTimer=null,runId=null,toastTimer=null;
function followCamera(point){
 if(!camera)camera={...point};
 // With 2x zoom, follow vertically each step so the next row remains clickable.
 const limitX=1,limitY=0;
 if(point.x-camera.x>limitX)camera.x=point.x-limitX;
 else if(point.x-camera.x < -limitX)camera.x=point.x+limitX;
 if(point.y-camera.y>limitY)camera.y=point.y-limitY;
 else if(point.y-camera.y < -limitY)camera.y=point.y+limitY;
}
function lang(){return currentLanguage()==='en'?'en':'ru';}
function tr(k){return COPY[lang()][k]||k;}
function report(text){const node=screen?.querySelector('[data-kingdom-toast]');if(!node)return;
 node.textContent=text;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.hidden=true},2400);}
function cssReady(){
 if(document.querySelector('[data-kingdom-style]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='css/kingdom-map.css?v=20261108-terrain-c1';link.dataset.kingdomStyle='';
 document.head.append(link);
}
function screenReady(){
 if(screen)return screen;
 cssReady();screen=document.createElement('main');screen.className='kingdom-map-screen';
 screen.dataset.kingdomMapScreen='';screen.hidden=true;
 screen.innerHTML='<div class="km-shell"><header class="km-header">'+
 '<div class="km-heading"><small>RPCHESS · JOURNEY</small><h1 data-kingdom-title></h1></div>'+
 '<div class="km-stat" data-kingdom-power></div><div class="km-stat" data-kingdom-supplies></div>'+
 '<div class="km-stat km-stat--points" data-kingdom-points></div>'+
 '<button class="km-back" data-kingdom-roster type="button"></button></header>'+
 '<section class="km-layout"><div class="km-map-frame">'+
 '<div class="km-world" data-kingdom-world role="grid" aria-label="Kingdom chess map"></div>'+
 '<div class="km-toast" data-kingdom-toast role="status" hidden></div></div>'+
 '<aside class="km-inspector"><h2 data-kingdom-inspector-title></h2>'+
 '<p data-kingdom-inspector-text></p><div class="km-inspector-buttons">'+
 '<button type="button" data-kingdom-annex hidden></button>'+
 '<button type="button" data-kingdom-services hidden></button></div>'+
 '<p class="km-hint" data-kingdom-hint></p></aside></section></div>';
 (document.querySelector('#app')||document.body).append(screen);
 screen.querySelector('[data-kingdom-roster]').addEventListener('click',()=>{hideMap();globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue'));});
 screen.querySelector('[data-kingdom-annex]').addEventListener('click',claim);
 screen.querySelector('[data-kingdom-services]').addEventListener('click',visitSettlement);
 screen.querySelector('[data-kingdom-world]').addEventListener('click',onCell);
 return screen;
}
function stopTimers(){clearTimeout(flightTimer);clearTimeout(launchTimer);flightTimer=null;launchTimer=null;}
function hideMap(){stopTimers();if(screen)screen.hidden=true;document.body.classList.remove('kingdom-map-active');}
function showMap(){
 screenReady();
 for(const main of document.querySelectorAll('#app > main'))main.hidden=true;
 document.body.classList.remove('travel-choice-active','roster-active','skirmish-active',
  'battle-active','settlement-active','events-active','puzzles-active');
 screen.hidden=false;document.body.classList.add('kingdom-map-active');
 window.scrollTo({top:0,behavior:'auto'});
 globalThis.RPChessResources?.render?.();
}
function ensureMap(run){
 const power=readPlayerRating().power;
 // Race comes from the stable named commander ID, never from the old castle placeholder.
 const race=commanderById(run.commanderId).raceTag;
 if(validateKingdomMap(run.kingdomMap)&&run.kingdomMap.seed===run.id){
  const peaked=updatePeak(run.kingdomMap,power);
  const map=peaked.castle.raceTag===race?peaked:
   {...peaked,castle:{...peaked.castle,raceTag:race}};
  return map===run.kingdomMap?run:writeRun({...run,kingdomMap:map});
 }
 return writeRun({...run,kingdomMap:createKingdomMap(run,power,race)});
}
function encounterResult(run,source,choice){
 if(!choice)return null;
 if(choice.type==='event'){
  if(source==='event-complete'||(['battle-aftermath','skirmish-aftermath'].includes(source)&&!run.currentEvent))
   return {success:true};
  return null;
 }
 if(choice.type==='settlement')return source==='settlement-complete'?{success:true}:null;
 if(choice.type==='puzzle'){
  const last=run.lastPuzzle;
  return last?.routeId===choice.id?{success:last.result==='solved'}:null;
 }
 const last=choice.type==='battle'?run.lastBattle:choice.type==='skirmish'?run.lastSkirmish:run.lastCaravan;
 if(!matchesCombatReceipt(choice,last))return null;
 const success=last.result==='checkmate'&&last.winner===last.playerColor;
 return {success,opponentPower:choice.type==='battle'?
  difficultyForStars(last.encounterStars||choice.stars).elo:0};
}
function settleIfReturned(run,source){
 const map=run.kingdomMap,id=map.pendingCell;
 if(!id||map.cells[id]?.status!=='in_progress')return run;
 const cell=map.cells[id];
 if(run.activeTravelChoice?.id===cell.selectedEncounter?.id)return run;
 const outcome=encounterResult(run,source,cell.selectedEncounter);
 if(!outcome)return run;
 const finished=finishEncounter(map,id,outcome);
 if(!finished.ok)return run;
 return writeRun({...run,kingdomMap:finished.map});
}
function schedulePending(run){
 const map=run.kingdomMap,id=map?.pendingCell;
 const cell=map?.cells?.[id];
 if(!cell||cell.status!=='revealed'||!screen||screen.hidden)return;
 const expires=cell.revealUntil||Date.now();
 clearTimeout(launchTimer);
 launchTimer=setTimeout(()=>{
  launchTimer=null;
  const current=readRun();
  if(!current||current.id!==runId||current.ended||current.activeTravelChoice)return;
  const currentCell=current.kingdomMap?.cells?.[id];
  if(current.kingdomMap?.pendingCell!==id||currentCell?.status!=='revealed')return;
  const beginning=beginEncounter(current.kingdomMap,id);
  if(!beginning.ok)return;
  const launched=globalThis.RPChessTravelChoice?.startMapEncounter?.(currentCell.selectedEncounter,beginning.map);
  if(launched)hideMap();
  else report(tr('inProgress'));
 },Math.max(0,expires-Date.now()));
}
function kingArt(run){return commanderPieceArt(run.commanderId,'w');}
function render(){
 const run=readRun();if(!run||!validateKingdomMap(run.kingdomMap)||!screen||screen.hidden)return;
 const map=run.kingdomMap;const view=camera||map.king;
 const world=screen.querySelector('[data-kingdom-world]');
 screen.querySelector('[data-kingdom-title]').textContent=tr('title');
 screen.querySelector('[data-kingdom-roster]').textContent=tr('return');
 screen.querySelector('[data-kingdom-power]').textContent=tr('power')+': '+readPlayerRating().power;
 screen.querySelector('[data-kingdom-supplies]').textContent=tr('supply')+': '+run.supplies;
 screen.querySelector('[data-kingdom-points]').textContent=tr('points')+': '+pointsAvailable(map);
 const cells=document.createDocumentFragment();
 for(let row=-CENTER_Y;row<HEIGHT-CENTER_Y;row++)
  for(let col=-CENTER_X;col<WIDTH-CENTER_X;col++){
   const point={x:view.x+col,y:view.y+row},id=keyOf(point.x,point.y);
   const cell=map.cells[id],isCastle=id===keyOf(map.castle.x,map.castle.y);
   const within=adjacent(map.king,point),here=id===keyOf(map.king.x,map.king.y);
   const edges=cell?.annexed?borderEdges(map,point):[];
   const btn=document.createElement('button');btn.type='button';btn.dataset.kingdomCell=id;
   const light=(point.x+point.y)%2===0;
   btn.setAttribute('role','gridcell');btn.className='km-cell'+
    (light?' km-cell--light':' km-cell--dark')+
    (!cell?' km-cell--fog':' km-cell--terrain km-cell--'+cell.status)+
    (cell?.annexed?' km-cell--annexed':'')+(within?' km-cell--adjacent':'')+
    (selected===id?' km-cell--selected':'')+(here?' km-cell--here':'')+
    edges.map(edge=>' km-edge-'+edge).join('');
   btn.style.setProperty('--km-index',String(row+3));
   if(cell){
    const race=isCastle?map.castle.raceTag:cell.selectedEncounter?.raceTag||cell.selectedEncounter?.enemyRaceTag;
    const tiles=raceBoardTiles(race);
    // Mixed/no-race events keep the neutral chessboard instead of masquerading as humans.
    const tile=tiles?(light?tiles.light:tiles.dark):
      'assets/boards/neutral/tile_'+(light?'light':'dark')+'.png';
    btn.style.setProperty('--km-tile-image','url("'+tile+'")');
   }
   btn.setAttribute('aria-label',isCastle?tr('castle'):cell?.selectedEncounter?
    t('travel.type.'+cell.selectedEncounter.type):tr('hidden'));
   if(!cell){const mark=document.createElement('strong');mark.textContent='?';mark.className='km-fog-mark';btn.append(mark);}
   else if(isCastle){
    const mark=document.createElement('img');mark.className='km-object km-object--castle';
    mark.src=kingdomMapSprite('castle',map.castle.raceTag);mark.alt='';mark.loading='lazy';btn.append(mark);
    const level=document.createElement('small');level.className='km-level';level.textContent=['','I','II','III','IV','V'][castleLevel(map.peakKingPower)];btn.append(level);}
   else{
    const choice=cell.selectedEncounter;
    if(choice){
     const img=document.createElement('img');img.className='km-object';
     img.src=kingdomMapSprite(choice.type,choice.raceTag||choice.enemyRaceTag);img.alt='';img.loading='lazy';
     btn.append(img);
     const lvl=document.createElement('small');lvl.className='km-level';lvl.textContent=romanForStars(choice.stars);btn.append(lvl);
    }
    if(cell.status==='failed'){const flag=document.createElement('span');flag.className='km-failure';flag.textContent='!';btn.append(flag);}
   }
   cells.append(btn);
  }
 world.replaceChildren(cells);
 const avatar=document.createElement('img');avatar.className='km-king'+(movement?' km-king--moving':'');
 avatar.src=kingArt(run);avatar.alt='';avatar.setAttribute('aria-hidden','true');
 // The king is not zoomed. Retain its pre-change physical size rather than
 // halving an enlarged cell (which varies with the map frame aspect ratio).
 const bounds=screen.querySelector('.km-map-frame').getBoundingClientRect();
 const oldTile=Math.min((bounds.width-4)/WIDTH,(bounds.height-4)/HEIGHT);
 avatar.style.width=oldTile+'px';avatar.style.height=oldTile+'px';
 // Position the king at the chosen cell's visual center, not at the camera
 // center. Inline coordinates override the CSS fallback for initial loads.
 avatar.style.left=((map.king.x-view.x+CENTER_X+.5)*100/WIDTH)+'%';
 avatar.style.top=((map.king.y-view.y+CENTER_Y+.5)*100/HEIGHT)+'%';
 if(movement){
  // Animation traverses one NEW cell even though the king keeps its old size.
  const cellBounds=world.querySelector('.km-cell').getBoundingClientRect();
  avatar.style.setProperty('--km-from-x',(movement.x-map.king.x)*cellBounds.width+'px');
  avatar.style.setProperty('--km-from-y',(movement.y-map.king.y)*cellBounds.height+'px');
 }
 world.append(avatar);
 const chosen=selected?map.cells[selected]:null;
 const current=map.cells[keyOf(map.king.x,map.king.y)];
 const info=chosen||current;
 const header=info?.type==='castle'?tr('castle'):info?.selectedEncounter?t('travel.type.'+info.selectedEncounter.type):tr('hidden');
 const text=info?.type==='castle'?tr('level')+' '+['','I','II','III','IV','V'][castleLevel(map.peakKingPower)]:
  info?.status==='failed'?tr('failed'):info?.status==='completed'?tr('complete'):
  info?.status==='revealed'?tr('reveal'):info?.status==='in_progress'?tr('inProgress'):tr('discover');
 screen.querySelector('[data-kingdom-inspector-title]').textContent=header;
 screen.querySelector('[data-kingdom-inspector-text]').textContent=text;
 const ann=screen.querySelector('[data-kingdom-annex]'),services=screen.querySelector('[data-kingdom-services]');
 const id=selected||keyOf(map.king.x,map.king.y);
 const selectedPoint=parsePoint(id);
 ann.hidden=!selectedPoint||!canAnnex(map,selectedPoint);ann.textContent=tr('annex');
 services.hidden=!(id===keyOf(map.king.x,map.king.y)&&chosen?.status==='completed'&&chosen.selectedEncounter?.type==='settlement');
 services.textContent=tr('services');
 screen.querySelector('[data-kingdom-hint]').textContent=map.pendingCell?tr('pending'):tr('discover');
}
function parsePoint(id){if(!/^-?\d+,-?\d+$/.test(id||''))return null;const [x,y]=id.split(',').map(Number);return {x,y};}
function onCell(event){
 const target=event.target.closest('[data-kingdom-cell]');
 if(!target||!screen||screen.hidden)return;
 const run=readRun(),map=run?.kingdomMap,id=target.dataset.kingdomCell,point=parsePoint(id);
 if(!point||!map||map.pendingCell)return;
 selected=id;
 if(!adjacent(map.king,point)){render();return;}
 const encounter=!map.cells[id]?
  randomEncounter(run,point,readPlayerRating().power):null;
 const entered=enterCell(map,point,encounter);
 if(!entered.ok){render();return;}
 movement={...map.king};
 const nextMap=entered.map;
 followCamera(nextMap.king);
 if(entered.kind!=='walk'){
  const delay=entered.kind==='discover'?2450:700;
  nextMap.cells[id]={...nextMap.cells[id],revealUntil:Date.now()+delay};
 }
 writeRun({...run,kingdomMap:nextMap});
 render();
 clearTimeout(flightTimer);
 flightTimer=setTimeout(()=>{movement=null;render();},450);
 if(entered.kind!=='walk')schedulePending(readRun());
}
function claim(){
 const run=readRun(),point=parsePoint(selected);
 if(!run||!point)return;
 const r=annexCell(run.kingdomMap,point);
 if(!r.ok)return;
 writeRun({...run,kingdomMap:r.map});globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated',{detail:{source:'kingdom-annex'}}));
 render();
}
function visitSettlement(){
 const run=readRun(),id=keyOf(run?.kingdomMap?.king?.x,run?.kingdomMap?.king?.y);
 const cell=run?.kingdomMap?.cells?.[id];
 if(!cell||cell.status!=='completed'||cell.selectedEncounter?.type!=='settlement'||run.activeTravelChoice)return;
 const restored={...run,activeTravelChoice:cell.selectedEncounter,currentSettlement:cell.settlementState||null};
 writeRun(restored);hideMap();
 globalThis.RPChessTravelChoice?.resumeMapEncounter?.(cell.selectedEncounter);
}
function openMap(event){
 let run=readRun();if(!run||run.ended)return;
 run=ensureMap(run);
 if(runId!==run.id||!camera)camera={...run.kingdomMap.king};
 runId=run.id;
 run=settleIfReturned(run,event?.detail?.source||'');
 followCamera(run.kingdomMap.king);
 showMap();
 selected=keyOf(run.kingdomMap.king.x,run.kingdomMap.king.y);
 movement=null;render();schedulePending(run);
}
function syncPower(){
 const run=readRun();if(!run||run.ended||!validateKingdomMap(run.kingdomMap))return;
 const previous=castleLevel(run.kingdomMap.peakKingPower);
 const updated=updatePeak(run.kingdomMap,readPlayerRating().power);
 if(updated===run.kingdomMap)return;
 writeRun({...run,kingdomMap:updated});
 if(screen&&!screen.hidden){
  render();
  const level=castleLevel(updated.peakKingPower);
  if(level>previous)report(tr('congrat')+' '+['','I','II','III','IV','V'][level]+'!');
 }
}
addEventListener('rpchess:power-updated',syncPower);
addEventListener('rpchess:scene-changed',e=>{if(e.detail?.scene==='menu'||e.detail?.scene==='roster')hideMap();});
subscribe(()=>{if(screen&&!screen.hidden)render();});
globalThis.RPChessKingdomMap=Object.freeze({open:openMap,hide:hideMap,get map(){return readRun()?.kingdomMap||null;}});
export {openMap};
