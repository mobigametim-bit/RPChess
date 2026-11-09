/* Journey's infinite kingdom map presentation. Existing encounter owners remain intact. */
import {readRun,writeRun} from './run-persistence.mjs';
import {readPlayerRating} from './player-rating.mjs';
import {commanderPieceArt,commanderById} from './commander-portraits.mjs';
import {raceBoardTiles,hashString} from './race-assets.mjs';
import {difficultyForStars,starsText} from './encounter-difficulty.mjs';
import {TRAVEL_SUPPLY_COST,combatGoldReward,applyTravelSupplyCost} from './resources-core.mjs';
import {puzzleBaseGold} from './puzzles/puzzle-core.mjs';
import {gloryForRun} from './chronicle-core.mjs';
import {ARENA_KEY,SHARD_ICON,normalizeArena,arenaSummary,addEvent,spendingTime,
 KINGDOM_OUTPOST_SHARD_COST} from './arena-core.mjs?v=20261109-kingdom-economy-v7';
import {platform} from './platform.mjs';
import {FLAVOR_POOLS} from './travel-choice-core.mjs';
import {translateLegacy} from './i18n.mjs';
import {commanderPortrait,commanderTitle} from './commander-portraits.mjs';
import {kingdomMapSprite,kingdomEncounterSprite} from './kingdom-map-assets.mjs';
import {PARCHMENT_MODE_KEY} from './kingdom-parchment-core.mjs';
import {renderParchment,renderParchmentFog} from './kingdom-parchment-app.mjs?v=20261110-fog';
import {drawKingdomOverlay} from './kingdom-map-overlay.mjs?v=20261109-kingdom-feedback1';
import {ATLAS_VIEW} from './kingdom-world-config.mjs?v=20261109-atlas-visual5';
import {subscribe,currentLanguage,t} from './i18n.mjs';
import {runtimeT} from '../localization/runtime-ui.mjs';
import {createKingdomMap,validateKingdomMap,updatePeak,randomEncounter,enterCell,
 beginEncounter,finishEncounter,matchesCombatReceipt,migrateKingdomMap,territoryCapacity,castleLevel,revealAround,
 collectProduction,canBuildOutpost,buildOutpost,
 romanForStars,keyOf,adjacent,shortestKingRoute,acknowledgeReturn,isOwned,borderEdges} from './kingdom-map-core.mjs?v=20261109-kingdom-feedback1';

const COPY={
 ru:{classicMap:'Классика',parchmentMap:'Пергамент',switchMap:'Оформление карты',day:'День',shards:'Осколки чести',castle:'Замок',supply:'Припасы',power:'Мощь',points:'Очки присоединения',
   hidden:'Неизведанная территория',empty:'Спокойная местность',safeTerrain:'Здесь нет дорожного события.',annex:'Присоединить · 1 очко',annexed:'В составе королевства',
   complete:'Пройдена',failed:'Неудача — повторная попытка',inProgress:'Встреча продолжается',
   return:'К отряду',reveal:'Открыта встреча',entry:'Начинается',services:'Услуги поселения',
   pending:'Открываю путь…',level:'Уровень',unavailable:'Недоступно для присоединения',lands:'Владения',
   discover:'',congrat:'Замок получил уровень',
   buildOutpost:'Построить аванпост',earn:'Добыть',onArena:'на Арене',arenaUnavailable:'Арена пока недоступна',outpost:'Аванпост',outpostDetail:'Удалённое владение королевства',
   outpostNeed:'Недостаточно осколков чести',outpostBuilt:'Аванпост построен',
   moveKing:'Перетащите короля для перемещения',collect:'Собрать',battleReady:'Защитник вернулся. Войди в клетку для нового боя.',
   recruitsReady:'Рекруты готовы. Система найма появится в следующем этапе.',
   empty:'Открывайте территорию, чтобы основать королевство',
   completedDetail:'Место освоено. Можно вернуться сюда в любой момент.',zoomGroup:'Масштаб карты',zoomIn:'Увеличить масштаб',zoomOut:'Уменьшить масштаб',zoomReset:'Сбросить масштаб карты'},
 en:{classicMap:'Classic',parchmentMap:'Parchment',switchMap:'Map appearance',day:'Day',shards:'Honor shards',castle:'Castle',supply:'Supplies',power:'Power',points:'Annexation points',
   hidden:'Unexplored territory',empty:'Quiet terrain',safeTerrain:'No encounter at this location.',annex:'Annex · 1 point',annexed:'Part of your kingdom',
   complete:'Cleared',failed:'Failed — retry encounter',inProgress:'Encounter in progress',
   return:'Squad',reveal:'Encounter discovered',entry:'Entering',services:'Settlement services',
   pending:'Exploring…',level:'Level',unavailable:'Cannot annex yet',lands:'Territory',
   discover:'',congrat:'Castle reached level',
   buildOutpost:'Build outpost',earn:'Earn',onArena:'in Arena',arenaUnavailable:'Arena is not available yet',outpost:'Outpost',outpostDetail:'A remote kingdom holding',
   outpostNeed:'Not enough Honor shards',outpostBuilt:'Outpost constructed',
   moveKing:'Drag the king to move',collect:'Collect',battleReady:'Defender returned. Enter the cell for a rematch.',
   recruitsReady:'Recruits are ready. Hiring will be added in the next stage.',
   empty:'Explore the realm to found a kingdom',
   completedDetail:'This location is cleared. You can return at any time.',zoomGroup:'Map zoom',zoomIn:'Zoom in',zoomOut:'Zoom out',zoomReset:'Reset map zoom'}
};
// Atlas view scales the original 142px logical tiles to an interactive 87px default.
const MAP_LAYOUT=Object.freeze({cellPx:142,eventScalePercent:73,kingPx:92,inspectorWidthPercent:25});
const MIN_COLUMNS=9,MIN_ROWS=7;
// Adopt the new authored default once, while continuing to persist manual zoom.
const ZOOM_KEY='rpchess.kingdom.zoom.v2',ZOOM_MIN=55,ZOOM_MAX=220;
function clampZoom(value){return Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,Math.round(value)));}
function savedZoom(){
 try{const raw=localStorage.getItem(ZOOM_KEY);return raw===null?ATLAS_VIEW.zoom:
  Number.isFinite(Number(raw))?clampZoom(Number(raw)):ATLAS_VIEW.zoom;}
 catch{return ATLAS_VIEW.zoom;}
}
let zoomPx=savedZoom(),zoomFrame=0,ignoreCellClicksUntil=0,pinch=null;
let pan=null,kingDrag=null,routeQueue=[];
const activeTouches=new Map();
function updateZoom(value){
 const next=clampZoom(value);if(next===zoomPx)return;
 zoomPx=next;try{localStorage.setItem(ZOOM_KEY,String(zoomPx));}catch{}
 if(!zoomFrame)zoomFrame=requestAnimationFrame(()=>{
  zoomFrame=0;if(screen&&!screen.hidden)render();
 });
}
function touchDistance(){
 const p=[...activeTouches.values()];return p.length>=2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0;
}
function zoomPointerDown(e){
 if(e.target.closest('.km-zoom-controls,.km-map-skin-switch,.km-king-drag-handle,.km-production-marker'))return;
 if(e.pointerType==='touch'){
  activeTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(activeTouches.size===2){
   pinch={distance:Math.max(1,touchDistance()),zoom:zoomPx};
   pan=null;screen?.querySelector('.km-world')?.style.removeProperty('translate');
   for(const id of activeTouches.keys())try{e.currentTarget.setPointerCapture(id);}catch{}
   ignoreCellClicksUntil=Date.now()+650;
   return;
  }
 }else if(e.button!==0)return;
 pan={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0,moved:false};
 // Do not capture a simple click; otherwise it retargets the cell's click to
 // the frame and the inspector never gets to display its route card.
}
function zoomPointerMove(e){
 if(kingDrag)return; // The stable frame owns an active king drag, not a map pan.
 if(e.pointerType==='touch'&&activeTouches.has(e.pointerId)){
  activeTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&activeTouches.size>=2){
   e.preventDefault();ignoreCellClicksUntil=Date.now()+650;
   updateZoom(pinch.zoom*touchDistance()/pinch.distance);
   return;
  }
 }
 if(!pan||pan.id!==e.pointerId||pinch)return;
 pan.dx=e.clientX-pan.x;pan.dy=e.clientY-pan.y;
 if(Math.hypot(pan.dx,pan.dy)>8&&!pan.moved){
  pan.moved=true;
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
 }
 if(!pan.moved)return;
 e.preventDefault();ignoreCellClicksUntil=Date.now()+650;
 const frame=screen?.querySelector('.km-map-frame'),world=screen?.querySelector('.km-world');
 frame?.classList.add('km-is-panning');
 if(world)world.style.translate=pan.dx+'px '+pan.dy+'px';
}
function zoomPointerEnd(e){
 if(kingDrag)return; // The king pointerup handler on this same frame finishes it.
 if(e.pointerType==='touch'){
  if(pinch)ignoreCellClicksUntil=Date.now()+650;
  activeTouches.delete(e.pointerId);
  if(activeTouches.size<2)pinch=null;
 }
 if(!pan||pan.id!==e.pointerId)return;
 const finished=pan;pan=null;
 screen?.querySelector('.km-map-frame')?.classList.remove('km-is-panning');
 const world=screen?.querySelector('.km-world');if(world)world.style.translate='';
 if(finished.moved){
  ignoreCellClicksUntil=Date.now()+650;
  if(!camera){const run=readRun();camera={...(run?.kingdomMap?.king||{x:0,y:0})};}
  camera.x-=Math.round(finished.dx/zoomPx);
  camera.y-=Math.round(finished.dy/zoomPx);
  if(screen&&!screen.hidden)render();
 }
}
function kingPointerDown(e){
 if(e.button!==0&&e.pointerType!=='touch')return;
 const run=readRun();
 if(!run?.kingdomMap||run.kingdomMap.pendingCell||routeQueue.length||movement)return;
 e.stopPropagation();e.preventDefault();
 kingDrag={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0};
 // render() replaces the king handle during navigation/animation. Capturing
 // on that ephemeral node loses pointerup. The frame survives every render.
 const frame=screen?.querySelector('.km-map-frame');
 try{frame?.setPointerCapture(e.pointerId);}catch{}
 e.currentTarget.classList.add('is-dragging');
 screen?.querySelector('.km-king-drag-aura')?.classList.add('is-active');
}
function kingPointerMove(e){
 if(!kingDrag||e.pointerId!==kingDrag.id)return;
 e.preventDefault();e.stopPropagation();
 kingDrag.dx=e.clientX-kingDrag.x;kingDrag.dy=e.clientY-kingDrag.y;
 const avatar=screen?.querySelector('.km-king');
 const aura=screen?.querySelector('.km-king-drag-aura');
 if(avatar){
  const scale=zoomPx/MAP_LAYOUT.cellPx;
  const dragTransform='translate(calc(-50% + '+(kingDrag.dx/scale)+'px),calc(-50% + '+(kingDrag.dy/scale)+'px))';
  avatar.style.transform=dragTransform;
  if(aura)aura.style.transform=dragTransform;
 }
}
function kingPointerEnd(e){
 if(!kingDrag||e.pointerId!==kingDrag.id)return;
 e.preventDefault();e.stopPropagation();
 const gesture=kingDrag;kingDrag=null;
 screen?.querySelector('.km-king-drag-handle')?.classList.remove('is-dragging');
 const aura=screen?.querySelector('.km-king-drag-aura');
 if(aura){aura.classList.remove('is-active');aura.style.transform='';}
 const avatar=screen?.querySelector('.km-king');if(avatar)avatar.style.transform='';
 try{e.currentTarget.releasePointerCapture?.(e.pointerId);}catch{}
 if(e.type==='pointercancel'||Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)<12)return;
 // Hit-test world tile geometry, not elementFromPoint(): the revealed
 // encounter art, overlays and temporary selection layers can cover a tile
 // without changing its actual destination. This also handles mobile touch.
 const destination=[...(screen?.querySelectorAll('[data-kingdom-cell]')||[])].find(el=>{
  const r=el.getBoundingClientRect();
  return e.clientX>=r.left&&e.clientX<r.right&&e.clientY>=r.top&&e.clientY<r.bottom;
 });
 ignoreCellClicksUntil=Date.now()+500;
 const point=parsePoint(destination?.dataset.kingdomCell);
 if(point)startKingRoute(point);
}
function zoomWheel(e){
 if(!screen||screen.hidden||e.target.closest('.km-zoom-controls,.km-map-skin-switch'))return;
 e.preventDefault();
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?400:1);
 updateZoom(zoomPx*Math.exp(-delta*.0015));
}

const REVEAL_MS=680,MOVE_MS=460,FLAVOR_MS=2600,DISCOVERY_WAIT_MS=4050,RESOURCE_FX_MS=2600;
const GOLD_ICON='generated_assets/reward_gold.png';
const SUPPLIES_ICON='generated_assets/reward_supplies.png';
// Reuse Arena's canonical Power icon; already included in the optimized build.
const POWER_ICON='generated_assets/node_battle.png';
const GLORY_ICON='assets/relics/banner_nine.png';
const ANNEX_ICON='assets/relics/diplomat_seal.png';
const ROUTE_ICONS=Object.freeze({caravan:'assets/doctrines/cavalry/emblem.png',
 skirmish:'generated_assets/node_battle.png',battle:'generated_assets/node_elite.png',
 settlement:'generated_assets/node_shop.png',
 puzzle:'generated_assets/node_training.png'});
// Honor shards are persistent Arena currency, not a resource on the Journey run.
function readShardLedger(){
 try{return normalizeArena(JSON.parse(platform.storage.local?.getItem(ARENA_KEY)||'null'));}
 catch{return normalizeArena(null);}
}
function shardTransaction(event){
 const old=readShardLedger(),summary=arenaSummary(old);
 if(summary.applied.has(event.id))return true;
 if(event.kind==='kingdom-outpost'&&summary.balance<event.amount)return false;
 const next=addEvent(old,{...event,at:spendingTime(old)});
 if(!arenaSummary(next).applied.has(event.id))return false;
 try{platform.storage.local?.setItem(ARENA_KEY,JSON.stringify(next));}catch{return false;}
 globalThis.dispatchEvent(new CustomEvent('rpchess:arena-updated'));
 return true;
}
function honorShards(){
 try{return arenaSummary(normalizeArena(JSON.parse(platform.storage.local?.getItem(ARENA_KEY)||'null'))).balance;}
 catch{return 0;}
}
function oddCoverCount(pixels,minimum,cellPixels=zoomPx){
 const count=Math.max(minimum,Math.ceil((pixels+2)/cellPixels));
 return count%2===0?count+1:count;
}
// The camera is independent of the king: keep world cells stationary when he
// moves inside the viewport. Only pan after he reaches its inner edge.
let screen=null,selected=null,movement=null,camera=null,flightTimer=null,launchTimer=null,runId=null,toastTimer=null,flavorBurst=null,flavorTimer=null;
let resourceBurst=null,resourceTimer=null;
function followCamera(point){
 if(!camera)camera={...point};
 // With 2x zoom, follow vertically each step so the next row remains clickable.
 const limitX=1,limitY=0;
 if(point.x-camera.x>limitX)camera.x=point.x-limitX;
 else if(point.x-camera.x < -limitX)camera.x=point.x+limitX;
 if(point.y-camera.y>limitY)camera.y=point.y-limitY;
 else if(point.y-camera.y < -limitY)camera.y=point.y+limitY;
}
function mapSkin(){
 try{
  const saved=localStorage.getItem(PARCHMENT_MODE_KEY);
  if(saved==='classic'||saved==='parchment')return saved;
  // Explicit preview URL enables the experiment without changing old saves.
  if(new URLSearchParams(location.search).get('parchment')==='1')return 'parchment';
 }catch{}
 return 'classic';
}
function setMapSkin(value){
 try{localStorage.setItem(PARCHMENT_MODE_KEY,value);}catch{}
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
function castleCard(map){
 const race=map.castle.raceTag||'humans',seed=map.seed+':castle';
 const card=document.createElement('article');card.className='km-route-card km-route-card--castle';
 card.dataset.kingdomCastleCard=race;
 const visual=document.createElement('div');visual.className='km-route-card__visual';
 const backdrop=globalThis.RPChessSceneVisuals?.backdropPath?.(seed,race)||
  'generated_assets/scene_campaign.webp';
 visual.style.setProperty('--km-card-backdrop','url("'+new URL(backdrop,document.baseURI).href+'")');
 const icon=document.createElement('img');icon.className='km-route-card__icon';
 icon.src=kingdomMapSprite('castle',race);icon.alt='';icon.setAttribute('aria-hidden','true');
 const details=document.createElement('div');details.className='km-route-card__details';
 const title=document.createElement('h3');title.textContent=tr('castle');
 const level=document.createElement('span');level.className='km-route-card__status';
 level.textContent=tr('level')+' '+['','I','II','III','IV','V'][castleLevel(map.peakKingPower)];
 details.append(title,level);visual.append(icon);card.append(visual,details);return card;
}
function routeCard(choice,run,cell){
 // Uses the Travel scene's canonical type, star, supply and reward rules.
 // Intentionally omits flavor; this will fly out of the entered map tile.
 const card=document.createElement('article');card.className='km-route-card km-route-card--'+choice.type;
 card.dataset.kingdomRouteCard=choice.id;card.dataset.kingdomRouteStatus=cell.status;
 const visual=document.createElement('div');visual.className='km-route-card__visual';
 visual.style.setProperty('--km-card-backdrop','url("'+new URL(routeBackdrop(choice),document.baseURI).href+'")');
 const combat=['battle','skirmish','caravan'].includes(choice.type);
 const completed=cell.status==='completed';
 const defenderActive=!completed||cell.respawnReady===true;
 const siteArt=kingdomMapSprite(choice.type,choice.raceTag||choice.enemyRaceTag,
  choice.visualRaceTag||choice.seed||choice.id);
 const icon=document.createElement('img');icon.className='km-route-card__icon';
 // The location remains visible behind the racial defender, like the king
 // layered over map sites. Unrelated encounter cards keep their prior art.
 icon.src=siteArt||(ROUTE_ICONS[choice.type]||ROUTE_ICONS.puzzle);
 icon.alt='';icon.setAttribute('aria-hidden','true');
 const defenderArt=combat?kingdomEncounterSprite(choice):null;
 let defender=null;
 if(defenderActive&&defenderArt&&defenderArt!==siteArt){
  defender=document.createElement('img');defender.className='km-route-card__defender';
  defender.src=defenderArt;defender.alt='';defender.setAttribute('aria-hidden','true');
 }
 const details=document.createElement('div');details.className='km-route-card__details';
 const name=document.createElement('h3');name.textContent=t('travel.type.'+choice.type);
 const status=document.createElement('span');status.className='km-route-card__status';
 status.textContent=completed?tr('complete'):cell.status==='failed'?tr('failed'):
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
 if(completed){
  card.classList.add('km-route-card--completed');
  const note=document.createElement('span');note.className='km-route-card__cleared';
  note.textContent=tr('completedDetail');stats.append(note);
 }else{
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
 }
 details.append(name,status,stats);visual.append(icon);
 if(defender)visual.append(defender);
 card.append(visual,details);return card;
}
function tr(k){return COPY[lang()][k]||k;}
function report(text){const node=screen?.querySelector('[data-kingdom-toast]');if(!node)return;
 node.textContent=text;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.hidden=true},2400);}
function cssReady(){
 if(document.querySelector('[data-kingdom-style]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='css/kingdom-map.css?v=20261109-kingdom-feedback1';link.dataset.kingdomStyle='';
 link.addEventListener('load',()=>{if(screen&&!screen.hidden)render();});
 document.head.append(link);
}
function screenReady(){
 if(screen)return screen;
 cssReady();screen=document.createElement('main');screen.className='kingdom-map-screen';
 screen.dataset.kingdomMapScreen='';screen.hidden=true;
 screen.innerHTML=`<div class="km-shell">
 <header class="km-header">
 <div class="km-heading"><h1 data-kingdom-day></h1></div>
 <div class="km-commandbar">
 <div class="km-commander-meta"><img class="km-commander-portrait" data-kingdom-portrait alt=""></div>
 <div class="km-resource-group">
 <span class="km-resource km-resource--power"><img src="${POWER_ICON}" alt="" aria-hidden="true"><strong data-kingdom-power></strong></span>
 <span class="km-resource km-resource--gold"><img src="${GOLD_ICON}" alt="" aria-hidden="true"><strong data-kingdom-gold></strong></span>
 <span class="km-resource km-resource--supplies"><img src="${SUPPLIES_ICON}" alt="" aria-hidden="true"><strong data-kingdom-supplies></strong></span>
 <span class="km-resource km-resource--glory"><img src="${GLORY_ICON}" alt="" aria-hidden="true"><strong data-kingdom-glory></strong></span>
 <span class="km-resource km-resource--points"><img src="${ANNEX_ICON}" alt="" aria-hidden="true"><strong data-kingdom-points></strong></span>
 <span class="km-resource km-resource--shards"><img src="${SHARD_ICON}" alt="" aria-hidden="true"><strong data-kingdom-shards></strong></span>
 </div>
 <div class="km-actions">
  <button class="reboot-button reboot-button--primary km-back" data-kingdom-roster type="button"></button>
  <button class="reboot-button reboot-button--primary" data-kingdom-settings type="button"></button>
  <button class="reboot-button reboot-button--primary" data-kingdom-menu type="button"></button>
 </div></div></header>
 <section class="km-layout"><div class="km-map-frame">
 <button type="button" class="km-map-skin-switch" data-kingdom-skin-switch></button>
 <div class="km-zoom-controls" role="group" aria-label="Map zoom">
  <button type="button" data-kingdom-zoom-out aria-label="Zoom out">−</button>
  <button type="button" data-kingdom-zoom-reset aria-label="Reset map zoom"><span data-kingdom-zoom-value></span></button>
  <button type="button" data-kingdom-zoom-in aria-label="Zoom in">+</button>
 </div>
 <div class="km-world" data-kingdom-world role="grid" aria-label="Kingdom chess map"></div>
 <div class="km-toast" data-kingdom-toast role="status" hidden></div></div>
 <aside class="km-inspector"><div class="km-route-slot" data-kingdom-route-slot hidden></div>
 <div class="km-inspector-summary" data-kingdom-summary>
 <h2 data-kingdom-inspector-title></h2><p data-kingdom-inspector-text></p></div>
 <div class="km-inspector-buttons"><button type="button" data-kingdom-annex hidden></button>
 <button type="button" data-kingdom-services hidden></button>
 <button type="button" data-kingdom-outpost hidden></button>
 <button type="button" data-kingdom-earn-shards hidden></button></div>
 <p class="km-hint" data-kingdom-hint></p></aside></section></div>`;
 screen.style.setProperty('--km-event-size-px',(MAP_LAYOUT.cellPx*MAP_LAYOUT.eventScalePercent/100)+'px');
 screen.style.setProperty('--km-king-px',MAP_LAYOUT.kingPx+'px');
 screen.style.setProperty('--km-inspector-width',MAP_LAYOUT.inspectorWidthPercent+'%');
 (document.querySelector('#app')||document.body).append(screen);
 screen.querySelector('[data-kingdom-roster]').addEventListener('click',()=>{hideMap();globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue'));});
 screen.querySelector('[data-kingdom-settings]').addEventListener('click',()=>globalThis.RPChessOpenSettings?.());
 screen.querySelector('[data-kingdom-menu]').addEventListener('click',()=>{hideMap();globalThis.RPChessRoster?.returnToMenu?.();});
 // No manual annex clicks: the growing border follows persistent Power and wins.
 screen.querySelector('[data-kingdom-services]').addEventListener('click',visitSettlement);
 screen.querySelector('[data-kingdom-outpost]').addEventListener('click',constructOutpost);
 screen.querySelector('[data-kingdom-earn-shards]').addEventListener('click',goToArena);
 screen.querySelector('[data-kingdom-world]').addEventListener('click',onWorldClick);
 const frame=screen.querySelector('.km-map-frame');
 frame.addEventListener('wheel',zoomWheel,{passive:false});
 frame.addEventListener('pointerdown',zoomPointerDown);
 frame.addEventListener('pointermove',zoomPointerMove);
 frame.addEventListener('pointerup',zoomPointerEnd);
 frame.addEventListener('pointercancel',zoomPointerEnd);
 frame.addEventListener('pointermove',kingPointerMove);
 frame.addEventListener('pointerup',kingPointerEnd);
 frame.addEventListener('pointercancel',kingPointerEnd);
 screen.querySelector('[data-kingdom-zoom-out]').addEventListener('click',()=>updateZoom(zoomPx-12));
 screen.querySelector('[data-kingdom-zoom-in]').addEventListener('click',()=>updateZoom(zoomPx+12));
 screen.querySelector('[data-kingdom-zoom-reset]').addEventListener('click',()=>updateZoom(ATLAS_VIEW.zoom));
 screen.querySelector('[data-kingdom-skin-switch]').addEventListener('click',()=>{
  setMapSkin(mapSkin()==='parchment'?'classic':'parchment');render();
 });
 return screen;
}
function stopTimers(){
 routeQueue=[];pan=null;kingDrag=null;
 clearTimeout(flightTimer);clearTimeout(launchTimer);clearTimeout(flavorTimer);clearTimeout(resourceTimer);
 resourceBurst=null;resourceTimer=null;
 flightTimer=null;launchTimer=null;flavorTimer=null;movement=null;flavorBurst=null;
}
function hideMap(){stopTimers();activeTouches.clear();pinch=null;if(screen)screen.hidden=true;document.body.classList.remove('kingdom-map-active');}
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
 if(validateKingdomMap(run.kingdomMap)&&
     (run.kingdomMap.seed===run.id||run.kingdomMap.seed.startsWith(run.id+':castle-biome:'))&&
     [4,5].includes(run.kingdomMap.worldGeneratorVersion)){
  const peaked=updatePeak(migrateKingdomMap(run.kingdomMap,run),power);
  const map=peaked.castle.raceTag===race?peaked:
   {...peaked,castle:{...peaked.castle,raceTag:race}};
  const revealed=revealAround(map,run,power);
  return revealed===run.kingdomMap?run:writeRun({...run,kingdomMap:revealed});
 }
 const fresh=createKingdomMap(run,power,race);
 return writeRun({...run,kingdomMap:revealAround(fresh,run,power)});
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
 return {success,opponentPower:['battle','skirmish','caravan'].includes(choice.type)?
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
 const baseline=cell.resourceSnapshot;
 if(baseline){
  const current=[['gold',GOLD_ICON,run.gold],['supplies',SUPPLIES_ICON,run.supplies],
   ['shards',SHARD_ICON,honorShards()]];
  const changes=current.map(([kind,icon,value])=>({kind,icon,
   delta:(Number(value)||0)-(Number(baseline[kind])||0)})).filter(item=>item.delta!==0);
  if(changes.length){
   resourceBurst={id,changes};clearTimeout(resourceTimer);
   resourceTimer=setTimeout(()=>{resourceBurst=null;
    if(screen&&!screen.hidden)render();},RESOURCE_FX_MS);
  }
 }
 // A transient pre-encounter balance should never accumulate in the run save.
 const {resourceSnapshot,...cleanCell}=finished.map.cells[id];
 finished.map.cells[id]=cleanCell;
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
  beginning.map.cells[id]={...beginning.map.cells[id],resourceSnapshot:{
   gold:current.gold||0,supplies:current.supplies||0,shards:honorShards()}};
  const launched=globalThis.RPChessTravelChoice?.startMapEncounter?.(currentCell.selectedEncounter,beginning.map);
  if(launched)hideMap();
  else report(tr('inProgress'));
 },Math.max(0,expires-Date.now()));
}
function kingArt(run){return commanderPieceArt(run.commanderId,'w');}
function render(){
 const run=readRun();if(!run||!validateKingdomMap(run.kingdomMap)||!screen||screen.hidden)return;
 const map=run.kingdomMap;const view=camera||map.king;
 const parchment=mapSkin()==='parchment';
 screen.classList.toggle('km-parchment-mode',parchment);
 const skinSwitch=screen.querySelector('[data-kingdom-skin-switch]');
 skinSwitch.textContent=tr('switchMap')+': '+tr(parchment?'parchmentMap':'classicMap');
 skinSwitch.title=tr('switchMap');
 skinSwitch.setAttribute('aria-pressed',String(parchment));
 const visualKing=movement?.phase==='reveal'?movement:map.king;
 const world=screen.querySelector('[data-kingdom-world]');
 world.dataset.kingdomMotion=movement?.phase||'idle';
 const frame=screen.querySelector('.km-map-frame').getBoundingClientRect();
 screen.querySelector('[data-kingdom-zoom-value]').textContent=zoomPx+' px';
 screen.querySelector('.km-zoom-controls').setAttribute('aria-label',tr('zoomGroup'));
 for(const [selector,key] of [
  ['[data-kingdom-zoom-reset]','zoomReset'],
  ['[data-kingdom-zoom-out]','zoomOut'],
  ['[data-kingdom-zoom-in]','zoomIn']
 ]){
  const button=screen.querySelector(selector);button.title=tr(key);
  button.setAttribute('aria-label',tr(key));
 }
 const scale=zoomPx/MAP_LAYOUT.cellPx;
 world.style.transform=`translate(-50%,-50%) scale(${scale})`;
 world.dataset.mapZoom=String(zoomPx);
 const WIDTH=oddCoverCount(frame.width,MIN_COLUMNS);
 const HEIGHT=oddCoverCount(frame.height,MIN_ROWS);
 const CENTER_X=Math.floor(WIDTH/2),CENTER_Y=Math.floor(HEIGHT/2);
 // The Atlas zoom sets the physical square size; all map art retains its proportions.
 world.style.width=(WIDTH*MAP_LAYOUT.cellPx)+'px';
 world.style.height=(HEIGHT*MAP_LAYOUT.cellPx)+'px';
 world.style.gridTemplateColumns=`repeat(${WIDTH},${MAP_LAYOUT.cellPx}px)`;
 world.style.gridTemplateRows=`repeat(${HEIGHT},${MAP_LAYOUT.cellPx}px)`;
 const power=readPlayerRating().power;
 // Independent in-game calendar: one new cell or completed meaningful encounter = one day.
 screen.querySelector('[data-kingdom-day]').textContent=tr('day')+' '+(map.day||1);
 screen.querySelector('[data-kingdom-roster]').textContent=t('travel.roster');
 screen.querySelector('[data-kingdom-settings]').textContent=t('travel.settings');
 screen.querySelector('[data-kingdom-menu]').textContent=t('menu.actionsLabel');
 const portrait=screen.querySelector('[data-kingdom-portrait]');
 portrait.src=commanderPortrait(run.commanderId);
 portrait.alt=commanderTitle(run.commanderId,currentLanguage());
 screen.querySelector('[data-kingdom-power]').textContent=String(power);
 screen.querySelector('[data-kingdom-gold]').textContent=String(run.gold??0);
 screen.querySelector('[data-kingdom-supplies]').textContent=String(run.supplies??0);
 for(const [selector,label] of [
  ['.km-resource--power',t('travel.power')],
  ['.km-resource--gold',t('travel.goldAria')],
  ['.km-resource--supplies',t('travel.suppliesAria')],
  ['.km-resource--glory',runtimeT(currentLanguage(),'chronicle.glory')],
  ['.km-resource--points',tr('lands')],
  ['.km-resource--shards',tr('shards')]
 ]){const item=screen.querySelector(selector);item.title=label;item.setAttribute('aria-label',label);}
 screen.querySelector('[data-kingdom-glory]').textContent=String(gloryForRun(run.journeyStep,power));
 screen.querySelector('[data-kingdom-points]').textContent=Math.max(0,(map.centralOwnedCells||[]).length-1)+'/'+territoryCapacity(map);
 screen.querySelector('[data-kingdom-shards]').textContent=String(honorShards());
 const cells=document.createDocumentFragment(),productions=document.createDocumentFragment();
 const outpostCenters=new Set((map.outposts||[]).map(post=>post.id));
 for(let row=-CENTER_Y;row<HEIGHT-CENTER_Y;row++)
  for(let col=-CENTER_X;col<WIDTH-CENTER_X;col++){
   const point={x:view.x+col,y:view.y+row},id=keyOf(point.x,point.y);
   const cell=map.cells[id],isCastle=id===keyOf(map.castle.x,map.castle.y);
    const visible=Boolean(isCastle||cell?.explored);
   const within=adjacent(visualKing,point),here=id===keyOf(visualKing.x,visualKing.y);
   const owned=isOwned(map,point);
   const edges=owned?borderEdges(map,point):[];
   const btn=document.createElement('button');btn.type='button';btn.dataset.kingdomCell=id;
   const light=(point.x+point.y)%2===0;
   btn.setAttribute('role','gridcell');btn.className='km-cell'+
    (light?' km-cell--light':' km-cell--dark')+
    (!visible?' km-cell--fog':' km-cell--terrain km-cell--'+cell.status)+
    (owned?' km-cell--annexed':'')+(within?' km-cell--adjacent':'')+
    (selected===id?' km-cell--selected':'')+(here?' km-cell--here':'')+
    (movement?.phase==='reveal'&&selected===id?' km-cell--opening':'')+
    (flavorBurst?.id===id?' km-cell--story':'')+
    edges.map(edge=>' km-edge-'+edge).join('');
   btn.style.setProperty('--km-index',String(row+3));
   if(visible&&cell){
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
   btn.setAttribute('aria-label',isCastle?tr('castle'):visible&&cell?.selectedEncounter?
    t('travel.type.'+cell.selectedEncounter.type):cell?.type==='empty'?tr('empty'):tr('hidden'));
   // Outside scouting range: fog only, with no mystery punctuation or encounter placeholder.
   // Once scouted, the stored encounter SVG is drawn immediately on its revealed cell.
   if(isCastle&&cell){
    const mark=document.createElement('img');mark.className='km-object km-object--castle';
    mark.src=kingdomMapSprite('castle',map.castle.raceTag);mark.alt='';mark.loading='lazy';btn.append(mark);
    const level=document.createElement('small');level.className='km-level';level.textContent=['','I','II','III','IV','V'][castleLevel(map.peakKingPower)];btn.append(level);}
   else if(visible&&cell){
    const choice=cell.selectedEncounter;
    if(choice){
     // The encounter SVG is the site itself. Its defending chess piece is a
     // separate foreground element (just as our king moves over map assets).
     const siteArt=kingdomMapSprite(choice.type,choice.raceTag||choice.enemyRaceTag,
      choice.visualRaceTag||choice.seed||choice.id);
     const img=document.createElement('img');img.className='km-object km-object--site';
     img.src=siteArt;img.alt='';img.loading='lazy';btn.append(img);
     if(['battle','skirmish','caravan'].includes(choice.type)&&
        (cell.status!=='completed'||cell.respawnReady===true)){
      const defenderArt=kingdomEncounterSprite(choice);
      if(defenderArt&&defenderArt!==siteArt){
       const guard=document.createElement('img');
       guard.className='km-object km-object--defender';
       guard.src=defenderArt;guard.alt='';guard.loading='lazy';btn.append(guard);
      }
     }
     const lvl=document.createElement('small');lvl.className='km-level';lvl.textContent=romanForStars(choice.stars);btn.append(lvl);
    }
    if(cell.status==='failed'){const flag=document.createElement('span');flag.className='km-failure';flag.textContent='!';btn.append(flag);}
   }
   if(resourceBurst?.id===id){
    const group=document.createElement('span');group.className='km-resource-bursts';
    group.setAttribute('role','status');
    resourceBurst.changes.forEach((change,index)=>{
     const burst=document.createElement('span');burst.className='km-resource-burst';
     burst.style.setProperty('--km-fx-delay',(index*.17)+'s');
     const icon=document.createElement('img');icon.src=change.icon;icon.alt='';
     const label=document.createElement('strong');
     label.textContent=(change.delta>0?'+':'')+change.delta;
     burst.append(icon,label);group.append(burst);
    });
    btn.append(group);
   }
   if(visible&&outpostCenters.has(id)){
    const tower=document.createElement('img');tower.className='km-object km-object--outpost';
    tower.src='assets/kingdom-parchment/decor_minor_landmarks/04_watchtower.svg';
    tower.alt='';tower.loading='lazy';btn.append(tower);
   }
   if(visible&&cell?.production&&owned&&cell.status==='completed'){
    const item=cell.production,marker=document.createElement('button');
    marker.type='button';marker.className='km-production-marker';
    marker.dataset.kingdomCollect=id;marker.dataset.productionKind=item.kind;
    marker.style.left=((col+CENTER_X+.62)*100/WIDTH)+'%';
    marker.style.top=((row+CENTER_Y+.13)*100/HEIGHT)+'%';
    const resourceIcon={gold:GOLD_ICON,supplies:SUPPLIES_ICON,shards:SHARD_ICON,
      battle:ROUTE_ICONS.battle,recruits:'generated_assets/node_training.png'}[item.kind];
    const icon=document.createElement('img');icon.src=resourceIcon;icon.alt='';
    const amount=document.createElement('strong');
    amount.textContent=['battle','recruits'].includes(item.kind)?'!':String(item.amount);
    marker.append(icon,amount);
    marker.setAttribute('aria-label',tr('collect')+': '+item.kind+' '+item.amount);
    productions.append(marker);
   }
   if(flavorBurst?.id===id){
    const fly=document.createElement('span');fly.className='km-flavor-flyout';
    fly.setAttribute('role','status');fly.textContent=flavorBurst.text;
    btn.append(fly);
   }
   cells.append(btn);
  }
 world.replaceChildren(cells);
 if(parchment){
  const atlas=document.createElement('canvas');atlas.className='km-parchment-canvas';
  atlas.dataset.kingdomParchment='';atlas.setAttribute('aria-hidden','true');
  world.prepend(atlas);
  renderParchment(atlas,{seed:map.seed,view,columns:WIDTH,rows:HEIGHT,map});
 }
 const overlay=document.createElement('canvas');overlay.className='km-kingdom-overlay';
 overlay.dataset.kingdomOverlay='';overlay.setAttribute('aria-hidden','true');
 world.append(overlay);
 drawKingdomOverlay(overlay,{map,view,columns:WIDTH,rows:HEIGHT});
  if(parchment){
   const fog=document.createElement('canvas');fog.className='km-parchment-fog';
   fog.dataset.kingdomFog='';fog.setAttribute('aria-hidden','true');
   world.append(fog);renderParchmentFog(fog,{view,columns:WIDTH,rows:HEIGHT,map});
  }
 world.append(productions);
 const avatar=document.createElement('img');avatar.className='km-king'+(movement?.phase==='moving'?' km-king--moving':'');
 avatar.src=kingArt(run);avatar.alt='';avatar.setAttribute('aria-hidden','true');
 // King image dimensions stay independent of the tile scale.
 avatar.style.width=MAP_LAYOUT.kingPx+'px';avatar.style.height=MAP_LAYOUT.kingPx+'px';
 // Position the king at the chosen cell's visual center, not at the camera
 // center. Inline coordinates override the CSS fallback for initial loads.
 const avatarPoint=movement?.phase==='reveal'?movement:map.king;
 avatar.style.left=((avatarPoint.x-view.x+CENTER_X+.5)*100/WIDTH)+'%';
 avatar.style.top=((avatarPoint.y-view.y+CENTER_Y+.5)*100/HEIGHT)+'%';
 if(movement?.phase==='moving'){
  // In-world movement remains 142 logical pixels, scaled with the entire map.
  avatar.style.setProperty('--km-from-x',(movement.x-map.king.x)*MAP_LAYOUT.cellPx+'px');
  avatar.style.setProperty('--km-from-y',(movement.y-map.king.y)*MAP_LAYOUT.cellPx+'px');
 }
 const dragAura=document.createElement('img');dragAura.className='km-king-drag-aura';
 dragAura.src='assets/vfx/aura_white.png';dragAura.alt='';
 dragAura.setAttribute('aria-hidden','true');
 dragAura.style.left=avatar.style.left;dragAura.style.top=avatar.style.top;
 if(kingDrag){
  const scale=zoomPx/MAP_LAYOUT.cellPx;
  dragAura.classList.add('is-active');
  dragAura.style.transform='translate(calc(-50% + '+(kingDrag.dx/scale)+'px),calc(-50% + '+(kingDrag.dy/scale)+'px))';
 }
 world.append(dragAura);
 world.append(avatar);
 const kingHandle=document.createElement('button');
 kingHandle.type='button';kingHandle.className='km-king-drag-handle';
 kingHandle.dataset.kingdomKingHandle='';
 kingHandle.setAttribute('aria-label',tr('moveKing'));
 // A new drag cannot be accepted while the previous king step is animating.
 // Expose the state visibly and to browser tests instead of silently dropping it.
 kingHandle.disabled=Boolean(movement||routeQueue.length||map.pendingCell);
 kingHandle.style.left=avatar.style.left;kingHandle.style.top=avatar.style.top;
 kingHandle.addEventListener('pointerdown',kingPointerDown);
 // Move and up handlers live on the persistent map frame (screenReady).
 world.append(kingHandle);
 const chosen=selected?map.cells[selected]:null;
 const current=map.cells[keyOf(map.king.x,map.king.y)];
 const knownChosen=chosen&&(selected===keyOf(map.castle.x,map.castle.y)||chosen.explored)?chosen:null;
 const info=knownChosen||(!chosen?current:null);
 const castleSelected=(selected||keyOf(map.king.x,map.king.y))===keyOf(map.castle.x,map.castle.y);
 const slot=screen.querySelector('[data-kingdom-route-slot]');
 const summary=screen.querySelector('[data-kingdom-summary]');
 const activeChoice=Boolean(info?.selectedEncounter);
 slot.hidden=!(activeChoice||castleSelected);summary.hidden=Boolean(activeChoice||castleSelected);
 if(castleSelected)slot.replaceChildren(castleCard(map));
 else if(activeChoice)slot.replaceChildren(routeCard(info.selectedEncounter,run,info));
 else{
  slot.replaceChildren();
  const header=(map.outposts||[]).some(p=>p.id===(selected||keyOf(map.king.x,map.king.y)))?tr('outpost'):info?.type==='castle'?tr('castle'):
   info?.type==='empty'?tr('empty'):info?.selectedEncounter?t('travel.type.'+info.selectedEncounter.type):tr('hidden');
  const description=(map.outposts||[]).some(p=>p.id===(selected||keyOf(map.king.x,map.king.y)))?tr('outpostDetail'):info?.type==='castle'?tr('level')+' '+['','I','II','III','IV','V'][castleLevel(map.peakKingPower)]:
   info?.type==='empty'?tr('safeTerrain'):
   info?.status==='completed'?tr('complete'):tr('discover');
  screen.querySelector('[data-kingdom-inspector-title]').textContent=header;
  screen.querySelector('[data-kingdom-inspector-text]').textContent=description;
 }
 const ann=screen.querySelector('[data-kingdom-annex]'),services=screen.querySelector('[data-kingdom-services]'),outpost=screen.querySelector('[data-kingdom-outpost]'),earn=screen.querySelector('[data-kingdom-earn-shards]');
 const id=selected||keyOf(map.king.x,map.king.y);
 const selectedPoint=parsePoint(id);
 ann.hidden=true; // Annexation is now automatic; keep the legacy button inert.
 const buildable=Boolean(selectedPoint&&canBuildOutpost(map,selectedPoint));
 const needsShards=honorShards()<KINGDOM_OUTPOST_SHARD_COST;
 outpost.hidden=!buildable;
 outpost.replaceChildren(document.createTextNode(tr('buildOutpost')+' · '+KINGDOM_OUTPOST_SHARD_COST+' '),shardIcon());
 outpost.disabled=needsShards;
 outpost.title=needsShards?tr('outpostNeed'):tr('buildOutpost');
 earn.hidden=!buildable||!needsShards;
 earn.replaceChildren(document.createTextNode(tr('earn')+' '),shardIcon(),
  document.createTextNode(' '+tr('onArena')));
 earn.title=tr('earn')+' '+tr('shards')+' '+tr('onArena');
 services.hidden=!(id===keyOf(map.king.x,map.king.y)&&knownChosen?.status==='completed'&&knownChosen.selectedEncounter?.type==='settlement');
 services.textContent=tr('services');
 const hint=screen.querySelector('[data-kingdom-hint]');
 hint.hidden=!map.pendingCell;
 hint.textContent=map.pendingCell?tr('pending'):'';
}
function parsePoint(id){if(!/^-?\d+,-?\d+$/.test(id||''))return null;const [x,y]=id.split(',').map(Number);return {x,y};}
function onWorldClick(event){
 const marker=event.target.closest('[data-kingdom-collect]');
 if(marker){event.preventDefault();event.stopPropagation();
  claimWeekly(marker.dataset.kingdomCollect);return;}
 onCell(event);
}
function showEconomyBurst(id,kind,amount){
 const icon={gold:GOLD_ICON,supplies:SUPPLIES_ICON,shards:SHARD_ICON}[kind];
 if(!icon)return;
 resourceBurst={id,changes:[{kind,icon,delta:amount}]};
 clearTimeout(resourceTimer);
 resourceTimer=setTimeout(()=>{resourceBurst=null;
  if(screen&&!screen.hidden)render();},RESOURCE_FX_MS);
}
function claimWeekly(id){
 const run=readRun(),item=run?.kingdomMap?.cells?.[id]?.production;
 if(!run||run.ended||run.activeTravelChoice||run.kingdomMap?.pendingCell||!item)return;
 if(item.kind==='battle'){
  const acknowledged=acknowledgeReturn(run.kingdomMap,id);
  if(!acknowledged.ok)return;
  writeRun({...run,kingdomMap:acknowledged.map});
  selected=id;render();return; // The already visible defender is the notification.
 }
 if(item.kind==='recruits'){
  selected=id;render();report(tr('recruitsReady'));return;
 }
 const result=collectProduction(run.kingdomMap,id);if(!result.ok)return;
 if(result.kind==='shards'){
  const receiptId='kingdom:production:'+hashString(run.id+':'+result.receiptId).toString(36);
  if(!shardTransaction({id:receiptId,kind:'kingdom-production',
   runId:run.id,productionId:result.receiptId,amount:result.amount})){
   report(tr('outpostNeed'));return;
  }
 }
 const next={...run,kingdomMap:result.map,
  ...(result.kind==='gold'?{gold:run.gold+result.amount}:{}),
  ...(result.kind==='supplies'?{supplies:run.supplies+result.amount}:{})};
 writeRun(next);showEconomyBurst(id,result.kind,result.amount);render();
}
function shardIcon(){
 const icon=document.createElement('img');
 icon.src=SHARD_ICON;icon.alt='';icon.className='km-shard-inline';
 icon.setAttribute('aria-hidden','true');return icon;
}
function goToArena(){
 const arena=globalThis.RPChessArena;
 if(typeof arena?.enter!=='function'){report(tr('arenaUnavailable'));return;}
 hideMap();arena.enter();
}
function constructOutpost(){
 const run=readRun(),point=parsePoint(selected);
 if(!run||run.ended||!point||!canBuildOutpost(run.kingdomMap,point))return;
 const id=keyOf(point.x,point.y);
 const receiptId='kingdom:outpost:'+hashString(run.id).toString(36)+':'+id.replace(',','_');
 const candidate=buildOutpost(run.kingdomMap,point,receiptId);
 if(!candidate.ok)return;
 if(!shardTransaction({id:receiptId,kind:'kingdom-outpost',
    runId:run.id,cellId:id,amount:KINGDOM_OUTPOST_SHARD_COST})){
  report(tr('outpostNeed'));return;
 }
 writeRun({...run,kingdomMap:candidate.map});
 render();report(tr('outpostBuilt'));
}
function startKingRoute(point){
 const run=readRun(),map=run?.kingdomMap;
 if(!map||map.pendingCell||movement||!point)return;
 routeQueue=shortestKingRoute(map,point);
 if(!routeQueue.length)return;
 selected=keyOf(point.x,point.y);
 advanceKingRoute();
}
function advanceKingRoute(){
 if(!routeQueue.length)return;
 const point=routeQueue.shift();
 moveKingOneStep(point);
}
function moveKingOneStep(point){
 const run=readRun(),map=run?.kingdomMap,id=keyOf(point.x,point.y);
 if(!run||!map||map.pendingCell||!adjacent(map.king,point)){routeQueue=[];return;}
 selected=id;
 const encounter=!map.cells[id]?randomEncounter(run,point,readPlayerRating().power):null;
 const entered=enterCell(map,point,encounter);
 if(!entered.ok){routeQueue=[];render();return;}
 const payment=isOwned(map,point)?{run,paid:0,requested:0}:
  applyTravelSupplyCost(run,TRAVEL_SUPPLY_COST);
 const nextMap=revealAround(entered.map,run,readPlayerRating().power);
 const from={...map.king},to={...nextMap.king};
 const reduced=document.documentElement.dataset.reducedMotion==='1';
 const discovering=entered.kind==='discover';
 if(entered.kind!=='walk'){
  routeQueue=[]; // Never auto-run through an encounter or its defeat.
  const delay=discovering?DISCOVERY_WAIT_MS:3300;
  nextMap.cells[id]={...nextMap.cells[id],revealUntil:Date.now()+delay};
 }
 // Record the actual arrival charge. Encounter dispatch MUST NOT charge again.
 nextMap.cells[id]={...nextMap.cells[id],stepSuppliesCharged:true,
  stepSuppliesPaid:payment.paid,stepSuppliesRequested:payment.requested};
 clearTimeout(flightTimer);clearTimeout(flavorTimer);flavorBurst=null;
 writeRun({...payment.run,kingdomMap:nextMap});
 if(payment.paid>0)globalThis.RPChessResources?.showChange?.({
  suppliesDelta:-payment.paid,labelKey:'travel.change.travel'});
 const finishStep=()=>{
  movement=null;
  if(entered.kind!=='walk'){
   const narrative=storyText(nextMap.cells[id]?.selectedEncounter);
   if(narrative){
    flavorBurst={id,text:narrative};
    flavorTimer=setTimeout(()=>{flavorBurst=null;if(screen&&!screen.hidden)render();},FLAVOR_MS);
   }
  }
  if(screen&&!screen.hidden&&runId===run.id){render();if(entered.kind==='walk')advanceKingRoute();}
 };
 const moveKing=()=>{
  if(!screen||screen.hidden||runId!==run.id)return;
  followCamera(to);
  if(reduced){finishStep();return;}
  movement={...from,phase:'moving'};render();
  flightTimer=setTimeout(finishStep,MOVE_MS);
 };
 if(discovering){
  movement={...from,phase:'reveal'};render();
  flightTimer=setTimeout(moveKing,reduced?80:REVEAL_MS);
 }else moveKing();
 if(entered.kind!=='walk')schedulePending(readRun());
}
function onCell(event){
 const target=event.target.closest('[data-kingdom-cell]');
 if(!target||!screen||screen.hidden)return;
 const run=readRun(),map=run?.kingdomMap,id=target.dataset.kingdomCell;
 if(!map||map.pendingCell||pinch||Date.now()<ignoreCellClicksUntil)return;
 selected=id;
 render(); // A single click is inspection only, regardless of distance.
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
 // A saved reveal can be resumed without replaying a misleading in-flight king.
 clearTimeout(flightTimer);clearTimeout(flavorTimer);
 movement=null;flavorBurst=null;
 if(runId!==run.id||!camera)camera={...run.kingdomMap.king};
 runId=run.id;
 const previousPending=run.kingdomMap?.pendingCell;
 run=settleIfReturned(run,event?.detail?.source||'');
 followCamera(run.kingdomMap.king);
 showMap();
 // On defeat the king retreats, but the failed route remains selected
 // so the canonical card is still shown for a future retry.
 selected=previousPending&&run.kingdomMap.cells[previousPending]?.status==='failed'?
  previousPending:keyOf(run.kingdomMap.king.x,run.kingdomMap.king.y);
 render();schedulePending(run);
}
function syncPower(){
 const run=readRun();if(!run||run.ended||!validateKingdomMap(run.kingdomMap))return;
 const previous=castleLevel(run.kingdomMap.peakKingPower);
 const updated=updatePeak(migrateKingdomMap(run.kingdomMap,run),readPlayerRating().power);
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
addEventListener('rpchess:arena-updated',()=>{if(screen&&!screen.hidden)render();});
addEventListener('rpchess:scene-changed',e=>{if(e.detail?.scene==='menu'||e.detail?.scene==='roster')hideMap();});
subscribe(()=>{if(screen&&!screen.hidden)render();});
globalThis.RPChessKingdomMap=Object.freeze({open:openMap,hide:hideMap,get map(){return readRun()?.kingdomMap||null;},get zoom(){return zoomPx;}});
export {openMap};
