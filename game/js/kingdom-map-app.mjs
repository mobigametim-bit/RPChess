/* Journey's infinite kingdom map presentation. Existing encounter owners remain intact. */
import {readRun,writeRun} from './run-persistence.mjs';
import {readPlayerRating} from './player-rating.mjs';
import {commanderPieceArt,commanderById} from './commander-portraits.mjs';
import {raceBoardTiles} from './race-assets.mjs';
import {difficultyForStars,starsText} from './encounter-difficulty.mjs';
import {TRAVEL_SUPPLY_COST,combatGoldReward} from './resources-core.mjs';
import {puzzleBaseGold} from './puzzles/puzzle-core.mjs';
import {gloryForRun} from './chronicle-core.mjs';
import {FLAVOR_POOLS} from './travel-choice-core.mjs';
import {translateLegacy} from './i18n.mjs';
import {commanderPortrait,commanderTitle} from './commander-portraits.mjs';
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
// Accepted visual-tuner preset. Fixed cell dimensions with a responsive virtual grid.
const MAP_LAYOUT=Object.freeze({cellPx:142,eventScalePercent:73,kingPx:92,inspectorWidthPercent:25});
const MIN_COLUMNS=9,MIN_ROWS=7;
const REVEAL_MS=680,MOVE_MS=460,FLAVOR_MS=2600,DISCOVERY_WAIT_MS=4050;
const GOLD_ICON='generated_assets/reward_gold.png';
const SUPPLIES_ICON='generated_assets/reward_supplies.png';
const ROUTE_ICONS=Object.freeze({caravan:'assets/doctrines/cavalry/emblem.png',
 skirmish:'generated_assets/node_battle.png',battle:'generated_assets/node_elite.png',
 event:'generated_assets/node_story.png',settlement:'generated_assets/node_shop.png',
 puzzle:'generated_assets/node_training.png'});
function oddCoverCount(pixels,minimum){
 const count=Math.max(minimum,Math.ceil(pixels/MAP_LAYOUT.cellPx));
 return count%2===0?count+1:count;
}
// The camera is independent of the king: keep world cells stationary when he
// moves inside the viewport. Only pan after he reaches its inner edge.
let screen=null,selected=null,movement=null,camera=null,flightTimer=null,launchTimer=null,runId=null,toastTimer=null,flavorBurst=null,flavorTimer=null;
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
function storyText(choice){
 if(!choice)return '';
 if(choice.type==='caravan')return t('caravan.flavor.'+Math.max(0,FLAVOR_POOLS.caravan.indexOf(choice.flavor)));
 return translateLegacy(String(choice.flavor||''));
}
function routeBackdrop(choice){
 const renderer=globalThis.RPChessSceneVisuals;
 if(choice?.type==='puzzle')return 'generated_assets/splash_poster.webp';
 if(!renderer?.backdropPath)return 'generated_assets/scene_campaign.webp';
 const seed=choice.seed||choice.id;
 if(choice.type==='event')return renderer.backdropPath(seed,null,{generic:true});
 if(choice.type==='settlement')return renderer.backdropPath(seed);
 return renderer.backdropPath(seed,choice.enemyRaceTag||null);
}
function resourceBadge(ariaLabel,imagePath,value){
 const container=document.createElement('span');container.className='km-route-resource';
 container.setAttribute('aria-label',ariaLabel);
 const amount=document.createElement('strong');amount.textContent=String(value);
 const icon=document.createElement('img');icon.src=imagePath;icon.alt='';icon.setAttribute('aria-hidden','true');
 container.append(amount,icon);return container;
}
function routeCard(choice,run,cell){
 // Uses the Travel scene's canonical type, star, supply and reward rules.
 // Intentionally omits flavor; this will fly out of the entered map tile.
 const card=document.createElement('article');card.className='km-route-card km-route-card--'+choice.type;
 card.dataset.kingdomRouteCard=choice.id;card.dataset.kingdomRouteStatus=cell.status;
 const visual=document.createElement('div');visual.className='km-route-card__visual';
 visual.style.setProperty('--km-card-backdrop','url("'+new URL(routeBackdrop(choice),document.baseURI).href+'")');
 const icon=document.createElement('img');icon.className='km-route-card__icon';
 icon.src=ROUTE_ICONS[choice.type]||ROUTE_ICONS.event;icon.alt='';icon.setAttribute('aria-hidden','true');
 const details=document.createElement('div');details.className='km-route-card__details';
 const name=document.createElement('h3');name.textContent=t('travel.type.'+choice.type);
 const status=document.createElement('span');status.className='km-route-card__status';
 status.textContent=cell.status==='failed'?tr('failed'):
  cell.status==='in_progress'?tr('inProgress'):tr('reveal');
 const stats=document.createElement('div');stats.className='km-route-card__stats';
 if(['battle','skirmish','caravan','puzzle'].includes(choice.type)){
  const stars=document.createElement('span');stars.className='km-route-card__stars';
  stars.textContent=starsText(choice.stars);
  stars.setAttribute('aria-label',t('travel.threatAria',{stars:choice.stars}));
  stats.append(stars);
 }
 if(choice.type==='settlement'){
  const services=document.createElement('span');services.className='km-route-card__service';
  services.textContent=t('travel.settlementServices');stats.append(services);
 }
 const cost=resourceBadge(t('travel.cost',{cost:TRAVEL_SUPPLY_COST}),SUPPLIES_ICON,'-'+TRAVEL_SUPPLY_COST);
 cost.classList.toggle('is-empty',(run.supplies||0)<TRAVEL_SUPPLY_COST);stats.append(cost);
 if(choice.type==='caravan'){
  const reward=document.createElement('span');reward.className='km-route-card__mystery';
  reward.textContent='???';reward.setAttribute('aria-label',t('caravan.hiddenReward'));stats.append(reward);
 }else if(['battle','skirmish','puzzle'].includes(choice.type)){
  const playerColor=choice.playerColor==='b'?'b':'w';
  const amount=choice.type==='puzzle'?puzzleBaseGold(choice.stars):
   combatGoldReward({encounterType:choice.type,stars:choice.stars,playerColor,
    status:{over:true,type:'checkmate',winner:playerColor}});
  stats.append(resourceBadge(t('travel.rewardAria',{reward:amount}),GOLD_ICON,'+'+amount));
 }
 details.append(name,status,stats);visual.append(icon);card.append(visual,details);return card;
}
function tr(k){return COPY[lang()][k]||k;}
function report(text){const node=screen?.querySelector('[data-kingdom-toast]');if(!node)return;
 node.textContent=text;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.hidden=true},2400);}
function cssReady(){
 if(document.querySelector('[data-kingdom-style]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='css/kingdom-map.css?v=20261108-map-card-b1';link.dataset.kingdomStyle='';
 link.addEventListener('load',()=>{if(screen&&!screen.hidden)render();});
 document.head.append(link);
}
function screenReady(){
 if(screen)return screen;
 cssReady();screen=document.createElement('main');screen.className='kingdom-map-screen';
 screen.dataset.kingdomMapScreen='';screen.hidden=true;
 screen.innerHTML=`<div class="km-shell">
 <header class="km-header travel-choice-topbar--command">
 <div class="km-heading"><small>RPCHESS · JOURNEY</small><h1 data-kingdom-title></h1></div>
 <div class="km-commandbar">
 <img class="km-commander-portrait" data-kingdom-portrait alt="">
 <div class="km-power-group">
 <span><small data-kingdom-power-label></small><strong data-kingdom-power></strong></span>
 <span><small data-kingdom-threat-label></small><strong data-kingdom-threat></strong></span>
 </div>
 <div class="km-resource-group">
 <span class="km-resource km-resource--gold"><img src="${GOLD_ICON}" alt=""><strong data-kingdom-gold></strong></span>
 <span class="km-resource km-resource--supplies"><img src="${SUPPLIES_ICON}" alt=""><strong data-kingdom-supplies></strong></span>
 <span class="km-resource km-resource--glory">
  <svg class="km-glory-icon" viewBox="0 0 32 32" aria-hidden="true" fill="none">
  <path d="M9 5h14v7c0 6-3.1 10-7 10S9 18 9 12V5Z" fill="#cfaa57" stroke="#ffdf92" stroke-width="1.7"/>
  <path d="M9 8H5c0 6 2 9 6 9M23 8h4c0 6-2 9-6 9" stroke="#ffdf92" stroke-width="2" stroke-linecap="round"/>
  <path d="m16 8 1.7 3.5 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5L16 8Z" fill="#4b351b"/>
  <path d="M16 22v5m-6 2h12" stroke="#ffdf92" stroke-width="2.4" stroke-linecap="round"/>
  </svg><strong data-kingdom-glory></strong>
 </span>
 <span class="km-resource km-resource--points"><small data-kingdom-points-label></small><strong data-kingdom-points></strong></span>
 </div>
 <div class="km-actions">
  <button class="reboot-button reboot-button--primary km-back" data-kingdom-roster type="button"></button>
  <button class="reboot-button reboot-button--primary" data-kingdom-settings type="button"></button>
  <button class="reboot-button reboot-button--primary" data-kingdom-menu type="button"></button>
 </div></div></header>
 <section class="km-layout"><div class="km-map-frame">
 <div class="km-world" data-kingdom-world role="grid" aria-label="Kingdom chess map"></div>
 <div class="km-toast" data-kingdom-toast role="status" hidden></div></div>
 <aside class="km-inspector"><div class="km-route-slot" data-kingdom-route-slot hidden></div>
 <div class="km-inspector-summary" data-kingdom-summary>
 <h2 data-kingdom-inspector-title></h2><p data-kingdom-inspector-text></p></div>
 <div class="km-inspector-buttons"><button type="button" data-kingdom-annex hidden></button>
 <button type="button" data-kingdom-services hidden></button></div>
 <p class="km-hint" data-kingdom-hint></p></aside></section></div>`;
 screen.style.setProperty('--km-event-size-px',(MAP_LAYOUT.cellPx*MAP_LAYOUT.eventScalePercent/100)+'px');
 screen.style.setProperty('--km-king-px',MAP_LAYOUT.kingPx+'px');
 screen.style.setProperty('--km-inspector-width',MAP_LAYOUT.inspectorWidthPercent+'%');
 (document.querySelector('#app')||document.body).append(screen);
 screen.querySelector('[data-kingdom-roster]').addEventListener('click',()=>{hideMap();globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue'));});
 screen.querySelector('[data-kingdom-settings]').addEventListener('click',()=>globalThis.RPChessOpenSettings?.());
 screen.querySelector('[data-kingdom-menu]').addEventListener('click',()=>{hideMap();globalThis.RPChessRoster?.returnToMenu?.();});
 screen.querySelector('[data-kingdom-annex]').addEventListener('click',claim);
 screen.querySelector('[data-kingdom-services]').addEventListener('click',visitSettlement);
 screen.querySelector('[data-kingdom-world]').addEventListener('click',onCell);
 return screen;
}
function stopTimers(){
 clearTimeout(flightTimer);clearTimeout(launchTimer);clearTimeout(flavorTimer);
 flightTimer=null;launchTimer=null;flavorTimer=null;movement=null;flavorBurst=null;
}
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
 const frame=screen.querySelector('.km-map-frame').getBoundingClientRect();
 const WIDTH=oddCoverCount(frame.width,MIN_COLUMNS);
 const HEIGHT=oddCoverCount(frame.height,MIN_ROWS);
 const CENTER_X=Math.floor(WIDTH/2),CENTER_Y=Math.floor(HEIGHT/2);
 // 142px squares; virtual grid expands to cover every edge without stretching.
 world.style.width=(WIDTH*MAP_LAYOUT.cellPx)+'px';
 world.style.height=(HEIGHT*MAP_LAYOUT.cellPx)+'px';
 world.style.gridTemplateColumns=`repeat(${WIDTH},${MAP_LAYOUT.cellPx}px)`;
 world.style.gridTemplateRows=`repeat(${HEIGHT},${MAP_LAYOUT.cellPx}px)`;
 const power=readPlayerRating().power;
 screen.querySelector('[data-kingdom-title]').textContent=tr('title');
 screen.querySelector('[data-kingdom-roster]').textContent=t('travel.roster');
 screen.querySelector('[data-kingdom-settings]').textContent=t('travel.settings');
 screen.querySelector('[data-kingdom-menu]').textContent=t('menu.actionsLabel');
 const portrait=screen.querySelector('[data-kingdom-portrait]');
 portrait.src=commanderPortrait(run.commanderId);
 portrait.alt=commanderTitle(run.commanderId,currentLanguage());
 screen.querySelector('[data-kingdom-power-label]').textContent=t('travel.power');
 screen.querySelector('[data-kingdom-power]').textContent=String(power);
 screen.querySelector('[data-kingdom-threat-label]').textContent=t('travel.threat');
 screen.querySelector('[data-kingdom-threat]').textContent=starsText(Math.max(1,Math.min(12,Math.floor((power-400)/200)+1)));
 screen.querySelector('[data-kingdom-gold]').textContent=String(run.gold??0);
 screen.querySelector('[data-kingdom-supplies]').textContent=String(run.supplies??0);
 screen.querySelector('.km-resource--glory').title=t('chronicle.glory');
 screen.querySelector('[data-kingdom-glory]').textContent=String(gloryForRun(run.journeyStep,power));
 screen.querySelector('[data-kingdom-points-label]').textContent=tr('points');
 screen.querySelector('[data-kingdom-points]').textContent=String(pointsAvailable(map));
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
    (movement?.phase==='reveal'&&selected===id?' km-cell--opening':'')+
    edges.map(edge=>' km-edge-'+edge).join('');
   btn.style.setProperty('--km-index',String(row+3));
   if(cell){
    const race=isCastle?map.castle.raceTag:cell.selectedEncounter?.raceTag||cell.selectedEncounter?.enemyRaceTag;
    const tiles=raceBoardTiles(race);
    // Mixed/no-race events keep the neutral chessboard instead of masquerading as humans.
    const tile=tiles?(light?tiles.light:tiles.dark):
      'assets/boards/neutral/tile_'+(light?'light':'dark')+'.png';
    // CSS custom properties with relative url(...) resolve from the CSS file
    // (/css/), not the document (/). Resolve the runtime asset against the
    // document base explicitly so preview root and GitHub Pages /RPChess/ work.
    btn.style.backgroundImage='url("'+new URL(tile,document.baseURI).href+'")';
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
   if(flavorBurst?.id===id){
    const fly=document.createElement('span');fly.className='km-flavor-flyout';
    fly.setAttribute('role','status');fly.textContent=flavorBurst.text;
    btn.append(fly);
   }
   cells.append(btn);
  }
 world.replaceChildren(cells);
 const avatar=document.createElement('img');avatar.className='km-king'+(movement?' km-king--moving':'');
 avatar.src=kingArt(run);avatar.alt='';avatar.setAttribute('aria-hidden','true');
 // King image dimensions stay independent of the tile scale.
 avatar.style.width=MAP_LAYOUT.kingPx+'px';avatar.style.height=MAP_LAYOUT.kingPx+'px';
 // Position the king at the chosen cell's visual center, not at the camera
 // center. Inline coordinates override the CSS fallback for initial loads.
 const avatarPoint=movement?.phase==='reveal'?movement:map.king;
 avatar.style.left=((avatarPoint.x-view.x+CENTER_X+.5)*100/WIDTH)+'%';
 avatar.style.top=((avatarPoint.y-view.y+CENTER_Y+.5)*100/HEIGHT)+'%';
 if(movement?.phase==='moving'){
  // Movement always covers one fixed-size 142px tile.
  avatar.style.setProperty('--km-from-x',(movement.x-map.king.x)*MAP_LAYOUT.cellPx+'px');
  avatar.style.setProperty('--km-from-y',(movement.y-map.king.y)*MAP_LAYOUT.cellPx+'px');
 }
 world.append(avatar);
 const chosen=selected?map.cells[selected]:null;
 const current=map.cells[keyOf(map.king.x,map.king.y)];
 const info=chosen||current;
 const slot=screen.querySelector('[data-kingdom-route-slot]');
 const summary=screen.querySelector('[data-kingdom-summary]');
 const activeChoice=info?.status!=='completed'&&info?.selectedEncounter;
 slot.hidden=!activeChoice;summary.hidden=Boolean(activeChoice);
 if(activeChoice)slot.replaceChildren(routeCard(info.selectedEncounter,run,info));
 else{
  slot.replaceChildren();
  const header=info?.type==='castle'?tr('castle'):
   info?.selectedEncounter?t('travel.type.'+info.selectedEncounter.type):tr('hidden');
  const description=info?.type==='castle'?tr('level')+' '+['','I','II','III','IV','V'][castleLevel(map.peakKingPower)]:
   info?.status==='completed'?tr('complete'):tr('discover');
  screen.querySelector('[data-kingdom-inspector-title]').textContent=header;
  screen.querySelector('[data-kingdom-inspector-text]').textContent=description;
 }
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
addEventListener('resize',()=>{if(screen&&!screen.hidden)render();});
addEventListener('rpchess:power-updated',syncPower);
addEventListener('rpchess:scene-changed',e=>{if(e.detail?.scene==='menu'||e.detail?.scene==='roster')hideMap();});
subscribe(()=>{if(screen&&!screen.hidden)render();});
globalThis.RPChessKingdomMap=Object.freeze({open:openMap,hide:hideMap,get map(){return readRun()?.kingdomMap||null;}});
export {openMap};
