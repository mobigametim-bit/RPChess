/* Journey's infinite kingdom map presentation. Existing encounter owners remain intact. */
import {readRun,writeRun} from './run-persistence.mjs';
import {readPlayerRating} from './player-rating.mjs';
import {commanderPieceArt,commanderById} from './commander-portraits.mjs';
import {raceBoardTiles,boardRacePiecePath,hashString,RACE_TAGS} from './race-assets.mjs';
import {difficultyForStars,starsText} from './encounter-difficulty.mjs';
import {TRAVEL_SUPPLY_COST,combatGoldReward,applyTravelSupplyCost} from './resources-core.mjs';
import {puzzleBaseGold} from './puzzles/puzzle-core.mjs';
import {gloryForRun} from './chronicle-core.mjs';
import {ARENA_KEY,SHARD_ICON,normalizeArena,arenaSummary,addEvent,spendingTime,
 KINGDOM_OUTPOST_SHARD_COST} from './arena-core.mjs?v=20261109-kingdom-economy-v7';
import {platform} from './platform.mjs';
import {PIECE_TYPES,PIECE_LABELS,DEFAULT_KINGDOM_ECONOMY,recruitTypeForLevel} from './kingdom-economy-config.mjs';
import {buyCastleRecruit,addArmyRecruits} from './kingdom-army-core.mjs';
import {createSettlementState} from './settlement-core.mjs';
import {FLAVOR_POOLS} from './travel-choice-core.mjs';
import {isUnprotectedBanditAmbush,resolveUnprotectedBanditAmbush} from './kingdom-bandit-core.mjs';
import {captureMercenaryEntry,rollbackMercenaryEntry} from './kingdom-entry-rollback.mjs';
import {translateLegacy} from './i18n.mjs';
import {commanderPortrait,commanderTitle} from './commander-portraits.mjs';
import {kingdomMapSprite,kingdomEncounterSprite} from './kingdom-map-assets.mjs';
import {renderParchment,renderParchmentFog,visibleThroughFog} from './kingdom-parchment-app.mjs?v=20261114-fog-events-v1';
import {drawKingdomOverlay} from './kingdom-map-overlay.mjs?v=20261112-province-colors-v1';
import {animateTravelers,stopTravelers} from './kingdom-traveler-renderer.mjs?v=20261111-npc-floor-v1';
import {industrySprite,industrySpriteIndex,industryYield,industryLevel,industryPending,collectIndustry,BUILDING_TYPES} from './kingdom-industry-core.mjs';
import {worldAt} from './kingdom-world-core.mjs';
import {ATLAS_VIEW} from './kingdom-world-config.mjs?v=20261109-atlas-visual5';
import {subscribe,currentLanguage,t} from './i18n.mjs';
import {runtimeT} from '../localization/runtime-ui.mjs';
import {createKingdomMap,validateKingdomMap,updatePeak,randomEncounter,enterCell,
 finishEncounter,matchesCombatReceipt,migrateKingdomMap,territoryCapacity,playerTerritoryCount,castleLevel,revealAround,
 collectProduction,canBuildOutpost,buildOutpost,canBuildSettlement,buildSettlement,
 romanForStars,keyOf,adjacent,shortestKingRoute,acknowledgeReturn,isOwned,borderEdges,weekForDay} from './kingdom-map-core.mjs?v=20261112-province-colors-v1';

const COPY={
 ru:{day:'День',shards:'Осколки чести',castle:'Замок',supply:'Припасы',power:'Мощь',points:'Очки присоединения',
   hidden:'Неизведанная территория',empty:'Местность',safeTerrain:'',annex:'Присоединить · 1 очко',annexed:'В составе королевства',
   complete:'Пройдена',failed:'Неудача — повторная попытка',inProgress:'Встреча продолжается',
   return:'К отряду',reveal:'Открыта встреча',entry:'Начинается',services:'Услуги поселения',
   pending:'Открываю путь…',level:'Уровень',unavailable:'Недоступно для присоединения',lands:'Владения',
   discover:'',congrat:'Замок получил уровень',
   buildOutpost:'Построить аванпост',earn:'Добыть',onArena:'на Арене',arenaUnavailable:'Арена пока недоступна',outpost:'Аванпост',outpostDetail:'Удалённое владение королевства',
   outpostNeed:'Недостаточно осколков чести',outpostBuilt:'Аванпост построен',
   moveKing:'Перетащите короля для перемещения',collect:'Собрать',battleReady:'Защитник вернулся. Войди в клетку для нового боя.',
   needCompanion:'Стычка отложена: нужен хотя бы один боец помимо короля. Пополните отряд.',

   productionSite:'Строится',productionWeekly:'за неделю',productionSupplies:'припасов',productionGold:'золота',
 zoomGroup:'Масштаб карты',zoomIn:'Увеличить масштаб',zoomOut:'Уменьшить масштаб',zoomReset:'Сбросить масштаб карты'},
 en:{day:'Day',shards:'Honor shards',castle:'Castle',supply:'Supplies',power:'Power',points:'Annexation points',
   hidden:'Unexplored territory',empty:'Terrain',safeTerrain:'',annex:'Annex · 1 point',annexed:'Part of your kingdom',
   complete:'Cleared',failed:'Failed — retry encounter',inProgress:'Encounter in progress',
   return:'Squad',reveal:'Encounter discovered',entry:'Entering',services:'Settlement services',
   pending:'Exploring…',level:'Level',unavailable:'Cannot annex yet',lands:'Territory',
   discover:'',congrat:'Castle reached level',
   buildOutpost:'Build outpost',earn:'Earn',onArena:'in Arena',arenaUnavailable:'Arena is not available yet',outpost:'Outpost',outpostDetail:'A remote kingdom holding',
   outpostNeed:'Not enough Honor shards',outpostBuilt:'Outpost constructed',
   moveKing:'Drag the king to move',collect:'Collect',battleReady:'Defender returned. Enter the cell for a rematch.',
   needCompanion:'Skirmish postponed: recruit at least one fighter besides your King.',

   productionSite:'Under construction',productionWeekly:'per week',productionSupplies:'Supplies',productionGold:'Gold',
 zoomGroup:'Map zoom',zoomIn:'Zoom in',zoomOut:'Zoom out',zoomReset:'Reset map zoom'}
};
const INDUSTRY_NAMES=Object.freeze({
 ru:{farm:'Ферма',pasture:'Пастбище',fishing_pier:'Рыбацкий причал',
  hunting_lodge:'Охотничий домик',gold_mine:'Золотая шахта',
  stone_quarry:'Каменоломня',sawmill:'Лесопилка',oasis:'Оазис'},
 en:{farm:'Farm',pasture:'Pasture',fishing_pier:'Fishing pier',
  hunting_lodge:'Hunting lodge',gold_mine:'Gold mine',
  stone_quarry:'Stone quarry',sawmill:'Sawmill',oasis:'Oasis'}
});
function industryName(kind){return INDUSTRY_NAMES[lang()==='en'?'en':'ru'][kind]||kind;}
const TERRAIN_NAMES=Object.freeze({
 ru:{forest:'Лес',mountain:'Горы',hills:'Холмы',plains:'Равнина',
  marsh:'Болото',wasteland:'Пустоши'},
 en:{forest:'Forest',mountain:'Mountains',hills:'Hills',plains:'Plains',
  marsh:'Marsh',wasteland:'Wasteland'}
});
function terrainName(biome){return TERRAIN_NAMES[lang()==='en'?'en':'ru'][biome]||tr('empty');}
// Atlas view scales the original 142px logical tiles to an interactive 87px default.
const MAP_LAYOUT=Object.freeze({cellPx:142,eventScalePercent:73,kingPx:92,inspectorWidthPercent:25});
const MIN_COLUMNS=9,MIN_ROWS=7;
// New storage key applies the author-approved 57px default on upgrade; subsequent manual zoom persists.
const ZOOM_KEY='rpchess.kingdom.zoom.v3',ZOOM_MIN=55,ZOOM_MAX=220;
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
 if(e.target.closest('.km-zoom-controls,.km-king-drag-handle,.km-production-marker'))return;
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
 if(!screen||screen.hidden||e.target.closest('.km-zoom-controls'))return;
 e.preventDefault();
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?400:1);
 updateZoom(zoomPx*Math.exp(-delta*.0015));
}

const REVEAL_MS=680,MOVE_MS=460,FLAVOR_MS=2600,DISCOVERY_WAIT_MS=4050,RESOURCE_FX_MS=2600;
const GOLD_ICON='generated_assets/reward_gold.png';
const SUPPLIES_ICON='generated_assets/reward_supplies.png';
const OUTPOST_ACTION_ICON='assets/ui/build_outpost_128.png';
const SETTLEMENT_ACTION_ICON='assets/ui/build_settlement_128.png';
const ARENA_ACTION_ICON='assets/ui/main-menu-arena.png';
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
 if(['kingdom-outpost','kingdom-settlement'].includes(event.kind)&&summary.balance<event.amount)return false;
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
 details.append(title,level);
 const recruitment=document.createElement('div');recruitment.className='km-castle-recruits';
 const heading=document.createElement('h4');heading.textContent=lang()==='en'?'Recruit for the army':'Найм рекрутов';recruitment.append(heading);
 const run=readRun(),gold=run?.gold??0;
 const typeCounts=Object.fromEntries(PIECE_TYPES.map(type=>[type,0]));
 for(const entry of run?.army||[])if(PIECE_TYPES.includes(entry?.pieceType)&&
   Number.isSafeInteger(entry.count)&&entry.count>0)
  typeCounts[entry.pieceType]+=entry.count;
 for(const type of PIECE_TYPES){
  const price=DEFAULT_KINGDOM_ECONOMY.castle.recruitGold[type];
  const row=document.createElement('div');row.className='km-castle-recruit';
  const label=lang()==='en'?({pawn:'Pawn',knight:'Knight',bishop:'Bishop',rook:'Rook',queen:'Queen'}[type]):PIECE_LABELS[type];
  const buy=document.createElement('button');buy.type='button';buy.dataset.kingdomCastleHire=type;
  buy.disabled=gold<price||map.king.x!==map.castle.x||map.king.y!==map.castle.y;
  buy.setAttribute('aria-disabled',String(buy.disabled));
  buy.setAttribute('aria-label',(lang()==='en'?'Hire ':'Нанять ')+label+
    (lang()==='en'?', owned ':', в наличии ')+typeCounts[type]+
    (lang()==='en'?', cost ':', стоимость ')+price+' '+(lang()==='en'?'gold':'золота'));
  buy.title=buy.getAttribute('aria-label');
  const piece=document.createElement('img');piece.className='km-castle-recruit__piece';
  piece.src=boardRacePiecePath(race,type,'w');piece.alt=label;
  piece.title=label;piece.loading='lazy';piece.decoding='async';
  piece.setAttribute('aria-hidden','true');
  const owned=document.createElement('span');owned.className='km-castle-recruit__count';
  owned.dataset.kingdomArmyCount=type;owned.textContent='×'+typeCounts[type];
  const amount=document.createElement('strong');amount.textContent=String(price);
  const coin=document.createElement('img');coin.className='km-castle-recruit__gold';
  coin.src=GOLD_ICON;coin.alt='';coin.setAttribute('aria-hidden','true');coin.decoding='async';
  buy.append(piece,owned,amount,coin);
  row.append(buy);recruitment.append(row);
 }
 details.append(recruitment);visual.append(icon);card.append(visual,details);return card;
}
function routeCard(choice,run,cell,canVisitSettlement=false){
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
 details.append(name,status,stats);
 // Keep the original Settlement visit action inside its card, not as a
 // floating text button below the card. Only the King's cleared Settlement
 // can offer this free revisit (the old visibility contract).
 if(completed&&choice.type==='settlement'&&canVisitSettlement){
  card.classList.add('km-route-card--visitable-settlement');
  const entrance=document.createElement('button');
  entrance.type='button';entrance.className='km-route-card__settlement-entrance';
  entrance.dataset.kingdomServices='';
  entrance.setAttribute('aria-label',tr('services'));
  entrance.title=tr('services');
  const entranceIcon=document.createElement('img');
  entranceIcon.src='assets/ui/settlement_entrance_64x64.png';
  entranceIcon.alt='';entranceIcon.setAttribute('aria-hidden','true');
  entrance.append(entranceIcon);details.append(entrance);
 }
 visual.append(icon);
 if(defender)visual.append(defender);
 card.append(visual,details);return card;
}
function tr(k){return COPY[lang()][k]||k;}
function report(text){const node=screen?.querySelector('[data-kingdom-toast]');if(!node)return;
 node.textContent=text;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.hidden=true},2400);}
function cssReady(){
 if(document.querySelector('[data-kingdom-style]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='css/kingdom-map.css?v=20261114-polish-ten-v1';link.dataset.kingdomStyle='';
 link.addEventListener('load',()=>{if(screen&&!screen.hidden)render();});
 document.head.append(link);
}
function screenReady(){
 if(screen)return screen;
 cssReady();screen=document.createElement('main');screen.className='kingdom-map-screen';
 screen.dataset.kingdomMapScreen='';screen.hidden=true;
 screen.innerHTML=`<div class="km-shell">
 <header class="km-header">
 <div class="km-heading"><div class="km-heading-lines"><div class="km-player-name" data-kingdom-player-name></div><h1 data-kingdom-day></h1></div><span class="km-heading-glory" data-kingdom-heading-glory><img src="${GLORY_ICON}" alt="" aria-hidden="true"><strong data-kingdom-heading-glory-value></strong></span></div>
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
 <button class="km-inspector-action" type="button" data-kingdom-outpost hidden></button>
 <button class="km-inspector-action" type="button" data-kingdom-build-settlement hidden></button>
 <button class="km-inspector-action km-inspector-action--arena" type="button" data-kingdom-earn-shards hidden></button></div>
 <p class="km-hint" data-kingdom-hint></p></aside></section></div>`;
 screen.style.setProperty('--km-event-size-px',(MAP_LAYOUT.cellPx*MAP_LAYOUT.eventScalePercent/100)+'px');
 screen.style.setProperty('--km-king-px',MAP_LAYOUT.kingPx+'px');
 screen.style.setProperty('--km-inspector-width',MAP_LAYOUT.inspectorWidthPercent+'%');
 (document.querySelector('#app')||document.body).append(screen);
 screen.querySelector('[data-kingdom-roster]').addEventListener('click',()=>{hideMap();globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue'));});
 screen.querySelector('[data-kingdom-settings]').addEventListener('click',()=>globalThis.RPChessOpenSettings?.());
 screen.querySelector('[data-kingdom-menu]').addEventListener('click',()=>{hideMap();globalThis.RPChessRoster?.returnToMenu?.();});
 // No manual annex clicks: the growing border follows persistent Power and wins.
 screen.addEventListener('click',event=>{
  // Route cards are replaced when a map tile changes. Delegate the entrance
  // click so it keeps the same behavior without retaining detached buttons.
  const entrance=event.target.closest('[data-kingdom-services]');
  if(entrance&&screen.contains(entrance)){
   event.preventDefault();void visitSettlement();return;
  }
  const btn=event.target.closest('[data-kingdom-castle-hire]');
  if(btn&&screen.contains(btn))hireCastleUnit(btn.dataset.kingdomCastleHire);
 });
 screen.querySelector('[data-kingdom-outpost]').addEventListener('click',constructOutpost);
 screen.querySelector('[data-kingdom-build-settlement]').addEventListener('click',constructSettlement);
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
 return screen;
}
function stopTimers(){
 stopTravelers();
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
     [4,5,6].includes(run.kingdomMap.worldGeneratorVersion)){
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
function showBanditOutcome(kind){
 if(!screen)return;
 let overlay=screen.querySelector('[data-kingdom-bandit-overlay]');
 if(!overlay){
  overlay=document.createElement('div');overlay.className='km-bandit-overlay';
  overlay.dataset.kingdomBanditOverlay='';
  overlay.innerHTML='<section class="km-bandit-card" role="dialog" aria-modal="true" aria-labelledby="km-bandit-title">'+
   '<h2 id="km-bandit-title" data-kingdom-bandit-title></h2>'+
   '<div class="km-bandit-tip"><span class="km-bandit-tip-dot" aria-hidden="true"></span>'+
   '<div data-kingdom-bandit-copy></div></div>'+
   '<button type="button" class="reboot-button reboot-button--primary" data-kingdom-bandit-continue></button>'+
   '</section>';
  screen.append(overlay);
  overlay.querySelector('[data-kingdom-bandit-continue]').addEventListener('click',()=>{
   const fatal=overlay.dataset.result==='murdered';
   overlay.remove();
   if(fatal){
    const current=readRun();
    if(!globalThis.RPChessEndlessRun?.open?.(current))
      globalThis.dispatchEvent(new CustomEvent('rpchess:run-end',{detail:{run:current}}));
   }else{
    render();
    globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated',{detail:{source:'kingdom-bandit-robbery'}}));
   }
  });
 }
 overlay.dataset.result=kind;
 overlay.querySelector('[data-kingdom-bandit-title]').textContent=kind==='murdered'?
  (lang()==='en'?'Bandits attacked':'Разбойники напали'):
  (lang()==='en'?'The bandits robbed you':'Вас ограбили разбойники');
 overlay.querySelector('[data-kingdom-bandit-copy]').textContent=kind==='murdered'?
  (lang()==='en'?'The King had no defenders and could not pay the bandits. His journey ends here.':
   'Король остался без защитников и не смог расплатиться с разбойниками. Его путешествие окончено.'):
  (lang()==='en'?'The bandits took everything except 10 Gold and 10 Supplies. The King survived.':
   'Разбойники забрали добычу, оставив королю 10 золота и 10 припасов. Король выжил.');
 overlay.querySelector('[data-kingdom-bandit-continue]').textContent=kind==='murdered'?
  (lang()==='en'?'Results':'К итогам'):(lang()==='en'?'Continue':'Продолжить');
 overlay.querySelector('[data-kingdom-bandit-continue]').focus();
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
  // Bandits ambush an unprotected King on arrival. This is NOT a chess
  // encounter: no mercenary charge, no false victory and no conquest award.
  if(isUnprotectedBanditAmbush(current)){
   const outcome=resolveUnprotectedBanditAmbush(current);
   if(!outcome.ok)return;
   writeRun(outcome.run);render();showBanditOutcome(outcome.kind);
   return;
  }
  // Snapshot the balance but DO NOT begin the encounter here. Starvation
  // resolves and is acknowledged first, before the combat owner can open.
  const staged={...current.kingdomMap,cells:{...current.kingdomMap.cells,
   [id]:{...currentCell,resourceSnapshot:{
    gold:current.gold||0,supplies:current.supplies||0,shards:honorShards()}}}};
  const launched=globalThis.RPChessTravelChoice?.startMapEncounter?.(currentCell.selectedEncounter,staged);
  // A refused skirmish returns immediately to the Kingdom map; do not hide it.
  if(launched&&readRun()?.activeTravelChoice)hideMap();
  else if(!launched)report(tr('inProgress'));
 },Math.max(0,expires-Date.now()));
}
function kingArt(run){return commanderPieceArt(run.commanderId,'w');}
function fitDayHeading(dayNode){
 const heading=dayNode?.parentElement;
 if(!heading)return;
 // Always recompute from CSS so a narrow layout never permanently shrinks
 // the heading when the viewport grows again.
 dayNode.style.fontSize='';
 const style=getComputedStyle(dayNode),parent=getComputedStyle(heading);
 const max=parseFloat(style.fontSize)||25;
 const usable=Math.max(10,heading.clientWidth-(parseFloat(parent.paddingLeft)||0)-
  (parseFloat(parent.paddingRight)||0));
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 if(!ctx)return;
 ctx.font=style.fontWeight+' '+max+'px '+style.fontFamily;
 const natural=ctx.measureText(dayNode.textContent).width;
 if(natural>usable)dayNode.style.fontSize=Math.max(9,Math.floor(max*usable/natural*.97))+'px';
 // A font loaded after the initial measurement may have wider glyphs than
 // canvas estimated. Compare actual layout boxes and shrink until no digits
 // are clipped inside the fixed-width heading (including mobile landscape).
 let size=parseFloat(getComputedStyle(dayNode).fontSize)||max;
 while(size>9&&dayNode.scrollWidth>dayNode.clientWidth+1){
  size=Math.max(9,size-1);
  dayNode.style.fontSize=size+'px';
 }
}
function render(){
 const run=readRun();if(!run||!validateKingdomMap(run.kingdomMap)||!screen||screen.hidden)return;
 const map=run.kingdomMap;const view=camera||map.king;
 const parchment=true;
 screen.classList.add('km-parchment-mode');
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
 const dayNode=screen.querySelector('[data-kingdom-day]');
 const nameNode=screen.querySelector('[data-kingdom-player-name]');
 nameNode.textContent=run.playerName||(lang()==='en'?'Ruler':'Правитель');
 dayNode.textContent=tr('day')+' '+(map.day||1);
 fitDayHeading(nameNode);fitDayHeading(dayNode);
 if(document.fonts?.status==='loading')void document.fonts.ready.then(()=>{
  if(dayNode.isConnected){fitDayHeading(nameNode);fitDayHeading(dayNode);}
 });
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
 const glory=String(gloryForRun(run.journeyStep,power));
 screen.querySelector('[data-kingdom-glory]').textContent=glory;
 screen.querySelector('[data-kingdom-heading-glory-value]').textContent=glory;
 const gloryLabel=runtimeT(currentLanguage(),'chronicle.glory');
 const headingGlory=screen.querySelector('[data-kingdom-heading-glory]');
 headingGlory.title=gloryLabel;headingGlory.setAttribute('aria-label',gloryLabel);
 screen.querySelector('[data-kingdom-points]').textContent=String(playerTerritoryCount(map));
 screen.querySelector('[data-kingdom-shards]').textContent=String(honorShards());
 const cells=document.createDocumentFragment(),productions=document.createDocumentFragment();
 const tileUrls=new Map(); // Reuse resolved CSS URLs across the visible grid.
 const outpostCenters=new Set((map.outposts||[]).map(post=>post.id));
 const industrySites=new Map((map.industry?.buildings||[]).map(site=>[site.id,site]));
 const industryWeek=weekForDay(map.day);
 for(let row=-CENTER_Y;row<HEIGHT-CENTER_Y;row++)
  for(let col=-CENTER_X;col<WIDTH-CENTER_X;col++){
   const point={x:view.x+col,y:view.y+row},id=keyOf(point.x,point.y);
   const cell=map.cells[id],isCastle=id===keyOf(map.castle.x,map.castle.y);
   const owned=isOwned(map,point);
   const visible=Boolean(isCastle||owned||visibleThroughFog(map,point));
   // A Skirmish is a concealed bandit ambush until the king actually enters.
   const encounterKnown=visible&&!(cell?.selectedEncounter?.type==='skirmish'&&cell.explored!==true);
   const within=adjacent(visualKing,point),here=id===keyOf(visualKing.x,visualKing.y);
   const edges=owned?borderEdges(map,point):[];
   const btn=document.createElement('button');btn.type='button';btn.dataset.kingdomCell=id;
   const light=(point.x+point.y)%2===0;
   btn.setAttribute('role','gridcell');btn.className='km-cell'+
    (light?' km-cell--light':' km-cell--dark')+
    (!visible?' km-cell--fog':' km-cell--terrain'+(encounterKnown&&cell?.status?' km-cell--'+cell.status:''))+
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
    let tileUrl=tileUrls.get(tile);if(!tileUrl){tileUrl=new URL(tile,document.baseURI).href;tileUrls.set(tile,tileUrl);}
    btn.style.backgroundImage='url("'+tileUrl+'")';
   }
   btn.setAttribute('aria-label',isCastle?tr('castle'):encounterKnown&&cell?.selectedEncounter?
    t('travel.type.'+cell.selectedEncounter.type):cell?.type==='empty'?terrainName(cell.biome||worldAt(map.seed,point.x,point.y).biome):tr('hidden'));
   // Only a visibly cleared fog center exposes a stored encounter, without walking
   // onto it. Enemy province borders alone never reveal its interior events.
   if(isCastle&&cell){
    const mark=document.createElement('img');mark.className='km-object km-object--castle';
    mark.src=kingdomMapSprite('castle',map.castle.raceTag);mark.alt='';mark.loading='lazy';btn.append(mark);
    const level=document.createElement('small');level.className='km-level';level.textContent=['','I','II','III','IV','V'][castleLevel(map.peakKingPower)];btn.append(level);}
   else if(visible&&cell){
    const choice=cell.selectedEncounter;
    if(choice&&encounterKnown){
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
     // Scouted but unvisited events carry a small corner question mark.
     if(cell.explored!==true){
      const unknown=document.createElement('span');unknown.className='km-scout-question';
      unknown.textContent='?';unknown.setAttribute('aria-hidden','true');btn.append(unknown);
     }
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
    tower.src='assets/kingdom-parchment/decor_minor_landmarks/04_watchtower.png';
    tower.alt='';tower.loading='lazy';btn.append(tower);
   }
   const industrySite=industrySites.get(id);
   if(visible&&industrySite){
    const building=document.createElement('span');
    building.className='km-object km-object--industry'+(industrySite.builtWeek>=industryWeek?' km-object--building-site':'');
    building.style.backgroundImage='url("'+industrySprite()+'")';
    building.style.backgroundPosition=(industrySpriteIndex(industrySite,industryWeek)*12.5)+'% center';
    building.setAttribute('aria-hidden','true');
    btn.dataset.kingdomIndustry=industrySite.kind;
    btn.dataset.kingdomIndustryStage=industrySite.builtWeek>=industryWeek?'building':'complete';
    btn.append(building);
    const marker=document.createElement('small');marker.className='km-industry-level';
    marker.textContent=industrySite.builtWeek>=industryWeek?'…':
      ['','I','II','III','IV','V'][industryLevel(map)];
    btn.append(marker);
    btn.setAttribute('aria-label',industryName(industrySite.kind));
    // Share existing floating collection UX with travel-event production.
    // New sites become ready after their first completed weekly cycle.
    const ready=industryPending(map,id);
    if(ready&&owned){
     const pickup=document.createElement('button');
     pickup.type='button';pickup.className='km-production-marker';
     pickup.dataset.kingdomCollect=id;
     pickup.dataset.kingdomIndustryCollect=id;
     pickup.dataset.productionKind=ready.kind;
     pickup.style.left=((col+CENTER_X+.62)*100/WIDTH)+'%';
     pickup.style.top=((row+CENTER_Y+.13)*100/HEIGHT)+'%';
     const resourceIcon=document.createElement('img');
     resourceIcon.src=ready.kind==='gold'?GOLD_ICON:SUPPLIES_ICON;
     resourceIcon.alt='';
     const amount=document.createElement('strong');amount.textContent=String(ready.amount);
     pickup.append(resourceIcon,amount);
     pickup.setAttribute('aria-label',tr('collect')+': '+
      (ready.kind==='gold'?tr('productionGold'):tr('productionSupplies'))+' '+ready.amount);
     productions.append(pickup);
    }
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
 stopTravelers();
 world.replaceChildren(cells);
 if(parchment){
  const atlas=document.createElement('canvas');atlas.className='km-parchment-canvas';
  atlas.dataset.kingdomParchment='';atlas.setAttribute('aria-hidden','true');
  world.prepend(atlas);
 }
 const overlay=document.createElement('canvas');overlay.className='km-kingdom-overlay';
 overlay.dataset.kingdomOverlay='';overlay.setAttribute('aria-hidden','true');
 world.append(overlay);
 // Paper < political tint and both sets of borders < roads/nature < sites.
 // The transparent foreground canvas prevents borders from painting over
 // water, paving, natural landmarks, pieces and resource markers.
 if(parchment){
  const details=document.createElement('canvas');details.className='km-parchment-details';
  details.dataset.kingdomTerrainDetails='';details.setAttribute('aria-hidden','true');
  world.append(details);
  renderParchment(world.querySelector('.km-parchment-canvas'),
   {seed:map.seed,view,columns:WIDTH,rows:HEIGHT,map,detailCanvas:details});
 }
 drawKingdomOverlay(overlay,{map,view,columns:WIDTH,rows:HEIGHT,drawBorder:true,drawRoads:!parchment});
  // One independent, noninteractive animation layer: no run state writes.
  const travelers=document.createElement('canvas');travelers.className='km-travelers-layer';
  travelers.dataset.kingdomTravelers='';travelers.setAttribute('aria-hidden','true');
  world.append(travelers);
  animateTravelers(travelers,{map,view,columns:WIDTH,rows:HEIGHT,parchment});
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
 const knownChosen=chosen&&
  !(chosen.selectedEncounter?.type==='skirmish'&&chosen.explored!==true)&&
  (isOwned(map,selected)||visibleThroughFog(map,parsePoint(selected)))?chosen:null;
 const info=knownChosen||(!chosen?current:null);
 const castleSelected=(selected||keyOf(map.king.x,map.king.y))===keyOf(map.castle.x,map.castle.y);
 const selectedId=selected||keyOf(map.king.x,map.king.y);
 const slot=screen.querySelector('[data-kingdom-route-slot]');
 const summary=screen.querySelector('[data-kingdom-summary]');
 const activeChoice=Boolean(info?.selectedEncounter);
 slot.hidden=!(activeChoice||castleSelected);summary.hidden=Boolean(activeChoice||castleSelected);
 if(castleSelected)slot.replaceChildren(castleCard(map));
 else if(activeChoice)slot.replaceChildren(routeCard(info.selectedEncounter,run,info,
  Boolean(knownChosen&&selectedId===keyOf(map.king.x,map.king.y)&&
   knownChosen.status==='completed'&&knownChosen.selectedEncounter?.type==='settlement')));
 else{
  slot.replaceChildren();
  const industrySite=industrySites.get(selectedId);
  const industryBuilding=industrySite&&BUILDING_TYPES[industrySite.kind];
  const industryActive=Boolean(industryBuilding&&industrySite.builtWeek<industryWeek);
  const weeklyYield=industryBuilding?industryYield(industrySite,map):null;
  const industryDetail=industrySite?(industryActive?
   tr('level')+' '+['','I','II','III','IV','V'][industryLevel(map)]+' · +'+weeklyYield.amount+' '+
    tr(weeklyYield.kind==='gold'?'productionGold':'productionSupplies')+' '+tr('productionWeekly'):
   tr('productionSite')):null;
  const header=(map.outposts||[]).some(p=>p.id===(selected||keyOf(map.king.x,map.king.y)))?tr('outpost'):info?.type==='castle'?tr('castle'):
   info?.type==='empty'?terrainName(info.biome||worldAt(map.seed,...selectedId.split(',').map(Number)).biome):info?.selectedEncounter?t('travel.type.'+info.selectedEncounter.type):tr('hidden');
  const description=(map.outposts||[]).some(p=>p.id===(selected||keyOf(map.king.x,map.king.y)))?tr('outpostDetail'):info?.type==='castle'?tr('level')+' '+['','I','II','III','IV','V'][castleLevel(map.peakKingPower)]:
   info?.type==='empty'?'':
   info?.status==='completed'?tr('complete'):tr('discover');
  screen.querySelector('[data-kingdom-inspector-title]').textContent=
   industrySite?industryName(industrySite.kind):header;
  screen.querySelector('[data-kingdom-inspector-text]').textContent=industryDetail??description;
 }
 const ann=screen.querySelector('[data-kingdom-annex]'),outpost=screen.querySelector('[data-kingdom-outpost]'),earn=screen.querySelector('[data-kingdom-earn-shards]'),settlementBuild=screen.querySelector('[data-kingdom-build-settlement]');
 const id=selectedId;
 const selectedPoint=parsePoint(id);
 ann.hidden=true; // Annexation is now automatic; keep the legacy button inert.
 const canPlaceSettlement=Boolean(selectedPoint&&canBuildSettlement(map,selectedPoint));
 const ownSettlement=Boolean(selectedPoint&&isOwned(map,selectedPoint));
 const costs=settlementPrice(ownSettlement);
 settlementBuild.hidden=!canPlaceSettlement;
 settlementBuild.replaceChildren(actionArtwork(SETTLEMENT_ACTION_ICON),
  actionPrices([[costs.gold,GOLD_ICON],[costs.shards,SHARD_ICON]]));
 settlementBuild.setAttribute('aria-label',actionLabel('settlement',costs));
 settlementBuild.disabled=!canPlaceSettlement||(run.gold||0)<costs.gold||honorShards()<costs.shards;
 settlementBuild.setAttribute('aria-disabled',String(settlementBuild.disabled));
 settlementBuild.title=settlementBuild.disabled?(lang()==='en'?'Not enough resources':'Недостаточно ресурсов'):
  lang()==='en'?(ownSettlement?'Inside your kingdom':'Outside your kingdom'):(ownSettlement?'Внутри владений':'Вне владений');
 const buildable=Boolean(selectedPoint&&canBuildOutpost(map,selectedPoint));
 const needsShards=honorShards()<KINGDOM_OUTPOST_SHARD_COST;
 outpost.hidden=!buildable;
 outpost.replaceChildren(actionArtwork(OUTPOST_ACTION_ICON),
  actionPrices([[KINGDOM_OUTPOST_SHARD_COST,SHARD_ICON]]));
 outpost.setAttribute('aria-label',actionLabel('outpost',{shards:KINGDOM_OUTPOST_SHARD_COST}));
 outpost.disabled=!buildable||needsShards;
 outpost.setAttribute('aria-disabled',String(outpost.disabled));
 outpost.title=needsShards?tr('outpostNeed'):tr('buildOutpost');
 earn.hidden=!buildable||!needsShards;
 earn.replaceChildren(actionArtwork(ARENA_ACTION_ICON,true));
 earn.title=tr('earn')+' '+tr('shards')+' '+tr('onArena');
 earn.setAttribute('aria-label',earn.title);
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
 const run=readRun();
 if(!run||run.ended||run.activeTravelChoice||run.kingdomMap?.pendingCell)return;
 const industry=collectIndustry(run.kingdomMap,id);
 if(industry.ok){
  const next={...run,kingdomMap:industry.map,
   ...(industry.kind==='gold'?{gold:run.gold+industry.amount}:{}),
   ...(industry.kind==='supplies'?{supplies:run.supplies+industry.amount}:{})};
  writeRun(next);showEconomyBurst(id,industry.kind,industry.amount);
  selected=id;render();
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated',{detail:{source:'kingdom-industry-collected'}}));
  globalThis.dispatchEvent(new CustomEvent('rpchess:kingdom-production-collected'));
  return;
 }
 const item=run.kingdomMap?.cells?.[id]?.production;
 if(!item)return;
 if(item.kind==='battle'){
  const acknowledged=acknowledgeReturn(run.kingdomMap,id);
  if(!acknowledged.ok)return;
  writeRun({...run,kingdomMap:acknowledged.map});
  selected=id;render();return; // The already visible defender is the notification.
 }
 const result=collectProduction(run.kingdomMap,id);if(!result.ok)return;
 if(result.kind==='recruits'){
  const route=run.kingdomMap.cells[id]?.selectedEncounter;
  if(route?.type!=='skirmish')return;
  const tag=route.raceTag||route.enemyRaceTag;
  const raceTag=RACE_TAGS.includes(tag)?tag:run.kingdomMap.castle.raceTag;
  const level=['I','II','III','IV','V'].indexOf(romanForStars(route.stars))+1;
  const pieceType=recruitTypeForLevel(level,run.kingdomMap.seed+':'+id+':'+item.week);
  const gain=addArmyRecruits(run,{raceTag,pieceType,count:result.amount,
    receiptId:'kingdom:'+run.id+':'+result.receiptId});
  if(!gain.ok)return;
  writeRun({...gain.run,kingdomMap:result.map});
  selected=id;render();
  report((lang()==='en'?'Free recruit: ':'Бесплатный рекрут: ')+
    (lang()==='en'?pieceType:PIECE_LABELS[pieceType])+' ×'+result.amount);
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated',{detail:{source:'skirmish-production'}}));
  globalThis.dispatchEvent(new CustomEvent('rpchess:kingdom-production-collected'));
  return;
 }

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
 globalThis.dispatchEvent(new CustomEvent('rpchess:kingdom-production-collected'));
}
function shardIcon(){
 const icon=document.createElement('img');
 icon.src=SHARD_ICON;icon.alt='';icon.className='km-shard-inline';
 icon.setAttribute('aria-hidden','true');return icon;
}
function actionArtwork(src,arena=false){
 const art=document.createElement('span');art.className='km-action-art'+(arena?' km-action-art--arena':'');
 const image=document.createElement('img');image.src=src;image.alt='';image.className='km-action-illustration';
 image.setAttribute('aria-hidden','true');art.append(image);
 if(arena){
  // Center the existing Honor Shard on the main-menu Arena shield.
  const badge=shardIcon();badge.classList.add('km-arena-shard');art.append(badge);
 }
 return art;
}
function actionPrices(prices){
 const list=document.createElement('span');list.className='km-action-prices';
 for(const [amount,currency] of prices){
  const row=document.createElement('span');row.className='km-action-price';
  const value=document.createElement('strong');value.textContent=String(amount);
  const icon=currency===SHARD_ICON?shardIcon():document.createElement('img');
  icon.src=currency;icon.alt='';icon.setAttribute('aria-hidden','true');
  icon.classList.add('km-action-price__icon');
  row.append(value,icon);list.append(row);
 }
 return list;
}
function actionLabel(kind,price){
 const english=lang()==='en';
 if(kind==='outpost')return (english?'Build outpost: ':'Построить аванпост: ')+price.shards+
  (english?' Honor shards':' осколков чести');
 return (english?'Build settlement: ':'Построить поселение: ')+price.gold+
  (english?' Gold, ':' золота, ')+price.shards+(english?' Honor shards':' осколков чести');
}
function goToArena(){
 const arena=globalThis.RPChessArena;
 if(typeof arena?.enter!=='function'){report(tr('arenaUnavailable'));return;}
 hideMap();arena.enter();
}
function settlementPrice(owned){
 const b=DEFAULT_KINGDOM_ECONOMY.building;
 return owned?{gold:b.settlementOwnedGold,shards:b.settlementOwnedShards}:
  {gold:b.settlementForeignGold,shards:b.settlementForeignShards};
}
// Resource changes need not rebuild the grid, SVG/canvas layers or inspector cards.
function refreshEconomyControls(){
 if(!screen||screen.hidden)return;
 const run=readRun(),map=run?.kingdomMap;if(!run||!map)return;
 const gold=Math.max(0,Number(run.gold)||0),shards=honorShards();
 const goldHud=screen.querySelector('[data-kingdom-gold]'),shardHud=screen.querySelector('[data-kingdom-shards]');
 if(goldHud)goldHud.textContent=String(gold);
 if(shardHud)shardHud.textContent=String(shards);
 for(const button of screen.querySelectorAll('[data-kingdom-castle-hire]')){
  const price=DEFAULT_KINGDOM_ECONOMY.castle.recruitGold[button.dataset.kingdomCastleHire];
  button.disabled=!Number.isSafeInteger(price)||gold<price;
  button.setAttribute('aria-disabled',String(button.disabled));
 }
 const target=screen.querySelector('[data-kingdom-build-settlement]');
 const outpost=screen.querySelector('[data-kingdom-outpost]');
 const earn=screen.querySelector('[data-kingdom-earn-shards]');
 const point=parsePoint(selected||keyOf(map.king.x,map.king.y));
 if(target){
  const place=Boolean(point&&canBuildSettlement(map,point));
  const owned=Boolean(point&&isOwned(map,point)),price=settlementPrice(owned);
  target.disabled=!place||gold<price.gold||shards<price.shards;
  target.setAttribute('aria-disabled',String(target.disabled));
  target.title=actionLabel('settlement',price)+(target.disabled?
   (lang()==='en'?' (not enough resources)':' (недостаточно ресурсов)'):'');
  target.setAttribute('aria-label',target.title);
 }
 if(outpost){
  const place=Boolean(point&&canBuildOutpost(map,point)),needs=shards<KINGDOM_OUTPOST_SHARD_COST;
  outpost.disabled=!place||needs;
  outpost.setAttribute('aria-disabled',String(outpost.disabled));
  outpost.title=actionLabel('outpost',{shards:KINGDOM_OUTPOST_SHARD_COST})+
   (needs?(lang()==='en'?' (not enough shards)':' (недостаточно осколков)'):'');
  outpost.setAttribute('aria-label',outpost.title);
  if(earn)earn.hidden=!place||!needs;
 }
}
function constructSettlement(){
 const run=readRun(),map=run?.kingdomMap,point=parsePoint(selected);
 if(!run||run.ended||!map||!point||!canBuildSettlement(map,point))return;
 const owned=isOwned(map,point),price=settlementPrice(owned);
 if(run.gold<price.gold||honorShards()<price.shards){
  report(lang()==='en'?'Not enough resources':'Недостаточно ресурсов');return;
 }
 const id=keyOf(point.x,point.y);
 const receiptId='kingdom:settlement:'+hashString(run.id).toString(36)+':'+id.replace(',','_');
 const result=buildSettlement(map,point,receiptId,{...price,raceTag:map.castle.raceTag});
 if(!result.ok)return;
 const settlementState=createSettlementState(run,result.encounter);
 // Honor Shards are handled by the global Arena ledger; purchase has a stable receipt.
 const accepted=shardTransaction({id:receiptId,kind:'kingdom-settlement',
   runId:run.id,cellId:id,tier:owned?'owned':'foreign',amount:price.shards});
 if(!accepted){report(lang()==='en'?'Not enough Honor Shards':'Недостаточно осколков чести');return;}
 result.map.cells[id]={...result.map.cells[id],settlementState};
 writeRun({...run,gold:run.gold-price.gold,kingdomMap:result.map});
 selected=id;render();
 report(lang()==='en'?'Settlement established':'Поселение построено');
 globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated',{detail:{source:'kingdom-settlement'}}));
}
function hireCastleUnit(pieceType){
 const run=readRun(),map=run?.kingdomMap;
 if(!run||run.ended||!map||!PIECE_TYPES.includes(pieceType)||map.pendingCell||
    selected!==keyOf(map.castle.x,map.castle.y)||
    map.king.x!==map.castle.x||map.king.y!==map.castle.y)return;
 const id='castle:'+run.id+':'+pieceType+':'+Date.now()+':'+Math.random().toString(36).slice(2);
 const result=buyCastleRecruit(run,{raceTag:map.castle.raceTag,pieceType,receiptId:id});
 if(!result.ok){report(lang()==='en'?'Not enough gold':'Недостаточно золота');return;}
 writeRun(result.run);render();
 report((lang()==='en'?'Recruited: ':'Нанят: ')+(lang()==='en'?pieceType:PIECE_LABELS[pieceType]));
 globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated',{detail:{source:'castle-recruit'}}));
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
 // An outpost annexes neighboring squares that have not been visited yet.
 // Materialize visible territory before re-rendering, without visiting it.
 const revealed=revealAround(candidate.map,run,readPlayerRating().power);
 writeRun({...run,kingdomMap:revealed});
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
 const entryType=nextMap.cells[id]?.selectedEncounter?.type;
 if(entered.kind!=='walk'&&['battle','caravan'].includes(entryType))
  nextMap.cells[id]={...nextMap.cells[id],mercenaryEntryRollback:captureMercenaryEntry(run,point)};
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
function rejectMercenaryEntry(){
 const current=readRun(),reverted=rollbackMercenaryEntry(current);
 if(!reverted.ok)return false;
 clearTimeout(launchTimer);clearTimeout(flightTimer);routeQueue=[];
 movement=null;flavorBurst=null;
 writeRun(reverted.run);
 globalThis.RPChessResources?.render?.();
 openMap({detail:{source:'mercenary-refused'}});
 return true;
}
function onCell(event){
 const target=event.target.closest('[data-kingdom-cell]');
 if(!target||!screen||screen.hidden)return;
 const run=readRun(),map=run?.kingdomMap,id=target.dataset.kingdomCell;
 if(!map||map.pendingCell||pinch||Date.now()<ignoreCellClicksUntil)return;
 selected=id;
 render(); // A single click is inspection only, regardless of distance.
 if(id===keyOf(map.castle.x,map.castle.y))
  globalThis.dispatchEvent(new CustomEvent('rpchess:kingdom-castle-inspected'));
}
let settlementOpening=false;
async function visitSettlement(){
 if(settlementOpening)return;
 const run=readRun(),id=keyOf(run?.kingdomMap?.king?.x,run?.kingdomMap?.king?.y);
 const cell=run?.kingdomMap?.cells?.[id];
 if(!cell||cell.status!=='completed'||cell.selectedEncounter?.type!=='settlement'||run.activeTravelChoice)return;
 settlementOpening=true;
 const button=screen?.querySelector('[data-kingdom-services]');
 if(button)button.disabled=true;
 let committed=false;
 try{
  // A completed Settlement is a free revisit, NOT a pending map encounter.
  // Load the owner BEFORE changing the save or hiding the Kingdom map.
  await import('./settlement-app.mjs');
  const latest=readRun(),current=latest?.kingdomMap?.cells?.[id];
  if(!latest||latest.ended||latest.id!==run.id||latest.activeTravelChoice||
     !screen||screen.hidden||current?.status!=='completed'||
     current.selectedEncounter?.id!==cell.selectedEncounter.id)return;
  const owner=globalThis.RPChessSettlement;
  if(!owner?.open)throw new Error('Settlement scene owner is unavailable');
  const saved=writeRun({...latest,activeTravelChoice:current.selectedEncounter,
   currentSettlement:current.settlementState||null});
  committed=true;
  owner.open({detail:{source:'kingdom-services',runId:saved.id,choice:current.selectedEncounter}});
  if(document.querySelector('[data-settlement-screen]')?.hidden!==false)
   throw new Error('Settlement scene did not become active');
  hideMap();
 }catch(error){
  console.error('[RPChess] Settlement services could not open',error);
  // Never strand a save on an invisible scene after a failed revisit.
  const latest=readRun();
  if(committed&&latest?.id===run.id&&
     latest.activeTravelChoice?.id===cell.selectedEncounter.id)
   writeRun({...latest,activeTravelChoice:null,currentSettlement:run.currentSettlement||null});
  showMap();render();
  report(lang()==='en'?'Settlement services could not open. Try again.':
   'Не удалось открыть услуги поселения. Повторите попытку.');
 }finally{
  settlementOpening=false;
  if(button)button.disabled=false;
 }
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
 globalThis.dispatchEvent(new CustomEvent('rpchess:kingdom-map-shown',{detail:{runId:run.id}}));
 if(event?.detail?.source==='skirmish-insufficient-force')report(tr('needCompanion'));
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
addEventListener('rpchess:arena-updated',refreshEconomyControls);
addEventListener('rpchess:run-updated',refreshEconomyControls);
addEventListener('rpchess:scene-changed',e=>{if(e.detail?.scene==='menu'||e.detail?.scene==='roster')hideMap();});
subscribe(()=>{if(screen&&!screen.hidden)render();});
globalThis.RPChessKingdomMap=Object.freeze({open:openMap,hide:hideMap,get map(){return readRun()?.kingdomMap||null;},get zoom(){return zoomPx;}});
export {openMap};
