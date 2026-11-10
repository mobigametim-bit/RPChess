import { readRun, writeRun } from './run-persistence.mjs';
import { TRAVEL_SUPPLY_COST, applyTravelSupplyCost, combatGoldReward } from './resources-core.mjs';
import { hasPendingStarvation, resolveStarvation } from './starvation-core.mjs';
import { PLAYABLE_TRAVEL_TYPES, FLAVOR_POOLS, TRAVEL_CHOICE_COUNT, canSelectTravelChoice, createTravelChoices, isTravelChoice, hasHealthySkirmishCompanion } from './travel-choice-core.mjs';
import { beginEncounter, cancelEncounterBeforeStart } from './kingdom-map-core.mjs?v=20261110-starvation-guard-v1';
import { starsText } from './encounter-difficulty.mjs';
import { readPlayerRating, threatStarsForPower } from './player-rating.mjs';
import { puzzleBaseGold } from './puzzles/puzzle-core.mjs';
import { subscribe, t, translateLegacy, currentLanguage } from './i18n.mjs';
import { commanderPortrait, commanderTitle } from './commander-portraits.mjs';

const ROUTE_ICONS=Object.freeze({caravan:'assets/doctrines/cavalry/emblem.png',skirmish:'generated_assets/node_battle.png',battle:'generated_assets/node_elite.png',event:'generated_assets/node_story.png',settlement:'generated_assets/node_shop.png',puzzle:'generated_assets/node_training.png'});
const GOLD_ICON='generated_assets/reward_gold.png';
const SUPPLIES_ICON='generated_assets/reward_supplies.png';
const OWNER_STYLE_HREF='css/travel-choice-compact.css';
let screen=null,activeRun=null,routing=false;
function audio(){return globalThis.RPChessRebootAudio;}
function contentText(value){return translateLegacy(String(value||''));}
function resourceIcon(src,className){const image=document.createElement('img');image.src=src;image.alt='';image.draggable=false;image.className=className;image.setAttribute('aria-hidden','true');return image;}
function ensureOwnerStylesheet(){if(document.querySelector('link[data-travel-choice-owner-style]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=OWNER_STYLE_HREF;link.dataset.travelChoiceOwnerStyle='';document.head?.append(link);}
function ensureScreen(){
  if(screen)return screen;
  const app=document.querySelector('#app');if(!app)return null;
  screen=document.createElement('main');screen.className='travel-choice-screen';screen.dataset.travelChoiceScreen='';screen.hidden=true;
  screen.innerHTML=`<div class="travel-choice-shell"><header class="travel-choice-topbar travel-choice-topbar--command"><div class="travel-choice-heading"><h1 data-travel-week></h1></div><div class="travel-choice-commandbar" data-travel-commandbar><img class="travel-choice-run-portrait" data-travel-run-portrait alt=""><div class="travel-choice-mobile-stats"><div class="travel-player-rating" data-travel-player-rating><div class="travel-player-rating__row"><span data-travel-power-label></span><strong data-travel-power>500</strong></div><div class="travel-player-rating__row travel-player-rating__row--threat"><span data-travel-threat-label></span><strong data-travel-player-threat>★</strong></div></div><div class="travel-choice-inline-resources" data-travel-inline-resources><span class="travel-choice-inline-resource travel-choice-inline-resource--gold"><img class="travel-choice-inline-resource__icon" src="${GOLD_ICON}" alt="" aria-hidden="true"><strong data-travel-inline-gold>0</strong></span><span class="travel-choice-inline-resource travel-choice-inline-resource--supplies"><img class="travel-choice-inline-resource__icon" src="${SUPPLIES_ICON}" alt="" aria-hidden="true"><strong data-travel-inline-supplies>0</strong></span></div></div><div class="travel-choice-topbar__actions"><button class="reboot-button reboot-button--primary" type="button" data-travel-roster></button><button class="reboot-button reboot-button--primary" type="button" data-travel-settings></button><button class="reboot-button reboot-button--primary" type="button" data-travel-menu></button></div></div></header><section class="travel-choice-routes" data-travel-routes></section></div>`;
  app.append(screen);
  applyStaticCopy();
  screen.querySelector('[data-travel-roster]')?.addEventListener('click',openRoster);
  screen.querySelector('[data-travel-settings]')?.addEventListener('click',()=>{audio()?.click?.();globalThis.RPChessOpenSettings?.();});
  screen.querySelector('[data-travel-menu]')?.addEventListener('click',()=>{if(routing)return;hideTravel();globalThis.RPChessRoster?.returnToMenu?.();});
  return screen;
}
function applyStaticCopy(){if(!screen)return;screen.setAttribute('aria-label',t('travel.ariaLabel'));const rating=screen.querySelector('[data-travel-player-rating]'),powerLabel=screen.querySelector('[data-travel-power-label]'),threatLabel=screen.querySelector('[data-travel-threat-label]'),resources=screen.querySelector('[data-travel-inline-resources]'),gold=screen.querySelector('.travel-choice-inline-resource--gold'),supplies=screen.querySelector('.travel-choice-inline-resource--supplies'),roster=screen.querySelector('[data-travel-roster]'),settings=screen.querySelector('[data-travel-settings]'),menuButton=screen.querySelector('[data-travel-menu]'),routes=screen.querySelector('[data-travel-routes]');if(rating)rating.setAttribute('aria-label',t('travel.ratingAria'));if(powerLabel)powerLabel.textContent=t('travel.power');if(threatLabel)threatLabel.textContent=t('travel.threat');if(resources)resources.setAttribute('aria-label',t('resources.ariaLabel'));if(gold)gold.setAttribute('aria-label',t('travel.goldAria'));if(supplies)supplies.setAttribute('aria-label',t('travel.suppliesAria'));if(roster)roster.textContent=t('travel.roster');if(settings)settings.textContent=t('travel.settings');if(menuButton)menuButton.textContent=t('menu.actionsLabel');if(routes)routes.setAttribute('aria-label',t('travel.routesAria'));}
function hideAllScenes(){for(const main of document.querySelectorAll('#app > main'))main.hidden=true;document.body.classList.remove('roster-active','skirmish-active','battle-active','classic-chess-active','settlement-active','starvation-active','events-active','puzzles-active','travel-choice-active');}
function showTravel(){const root=ensureScreen();if(!root)return;hideAllScenes();root.hidden=false;document.body.classList.add('travel-choice-active');window.scrollTo({top:0,behavior:'auto'});globalThis.RPChessResources?.render?.();}
function hideTravel(){if(screen)screen.hidden=true;document.body.classList.remove('travel-choice-active');}
function validStoredChoices(run){return Array.isArray(run?.currentTravelChoices)&&run.currentTravelChoices.length===TRAVEL_CHOICE_COUNT&&run.currentTravelChoices.every(choice=>isTravelChoice(choice)&&PLAYABLE_TRAVEL_TYPES.includes(choice.type)&&choice.difficultyModel==='power-v1');}
function ensureChoices(run){if(validStoredChoices(run))return run;const step=(Number.isInteger(run?.journeyStep)?run.journeyStep:0)+1,power=readPlayerRating().power;return writeRun({...run,currentTravelChoices:createTravelChoices({runId:run.id,step,playerPower:power}),activeTravelChoice:null});}
function travelCost(noSupplies){const cost=document.createElement('span');cost.className='travel-choice-card__cost';cost.classList.toggle('is-empty',noSupplies);const amount=document.createElement('span');amount.className='travel-choice-card__cost-amount';amount.textContent=`-${TRAVEL_SUPPLY_COST}`;cost.append(amount,resourceIcon(SUPPLIES_ICON,'travel-choice-card__cost-icon'));const warning=t(noSupplies?'travel.costStarvation':'travel.cost',{cost:TRAVEL_SUPPLY_COST});cost.setAttribute('aria-label',warning);cost.title=warning;return cost;}
function victoryReward(choice){if(choice.type==='puzzle')return puzzleBaseGold(choice.stars);const playerColor=choice.playerColor==='b'?'b':'w';return combatGoldReward({encounterType:choice.type,stars:choice.stars,playerColor,status:{over:true,type:'checkmate',winner:playerColor}});}
function rewardPreview(choice){if(choice.type==='caravan'){const reward=document.createElement('small');reward.className='travel-choice-card__reward';reward.textContent='???';reward.setAttribute('aria-label',t('caravan.hiddenReward'));return reward;}const reward=document.createElement('small');reward.className='travel-choice-card__reward';const value=victoryReward(choice);reward.setAttribute('aria-label',t('travel.rewardAria',{reward:value}));const amount=document.createElement('strong');amount.className='travel-choice-card__reward-amount';amount.textContent=`+${value}`;reward.append(amount,resourceIcon(GOLD_ICON,'travel-choice-card__reward-icon'));return reward;}
function choiceMeta(choice,noSupplies){
  const cost=travelCost(noSupplies);
  if(choice.type==='settlement'){const meta=document.createElement('span');meta.className='travel-choice-card__safe';const services=document.createElement('small');services.textContent=t('travel.settlementServices');meta.append(services,cost);return meta;}
  if(choice.type==='skirmish'||choice.type==='battle'||choice.type==='puzzle'||choice.type==='caravan'){
    const meta=document.createElement('span');meta.className='travel-choice-card__threat';
    const stars=document.createElement('strong');stars.textContent=starsText(choice.stars);
    meta.append(stars,cost,rewardPreview(choice));
    return meta;
  }
  const meta=document.createElement('span');meta.className='travel-choice-card__meta travel-choice-card__meta--cost-only';meta.append(cost);return meta;
}
function applyChoiceAvailability(button,choice,run){const eligibility=canSelectTravelChoice(run,choice),locked=!eligibility.ok;button.disabled=locked;button.setAttribute('aria-disabled',locked?'true':'false');button.classList.toggle('is-skirmish-unavailable',eligibility.reason==='skirmish_requires_companion');if(eligibility.reason==='skirmish_requires_companion')button.title=t('travel.skirmishUnavailable');else button.removeAttribute('title');return eligibility;}
function routeCard(choice){
  const button=document.createElement('button');button.type='button';button.className=`travel-choice-card travel-choice-card--${choice.type}`;button.dataset.travelChoice=choice.id;button.dataset.travelType=choice.type;button.dataset.travelStars=String(choice.stars);
  const noSupplies=(activeRun?.supplies||0)<TRAVEL_SUPPLY_COST;
  const visual=document.createElement('span');visual.className='travel-choice-card__visual';
  const glow=document.createElement('span');glow.className='travel-choice-card__glow';
  const icon=document.createElement('img');icon.className='travel-choice-card__icon';icon.src=ROUTE_ICONS[choice.type]||ROUTE_ICONS.skirmish;icon.alt='';
  const overlay=document.createElement('span');overlay.className='travel-choice-card__overlay';
  const type=document.createElement('strong');type.className='travel-choice-card__type';type.textContent=t(`travel.type.${choice.type}`);
  overlay.append(type,choiceMeta(choice,noSupplies));visual.append(glow,icon,overlay);
  const body=document.createElement('span');body.className='travel-choice-card__body';const flavor=document.createElement('span');flavor.className='travel-choice-card__flavor';flavor.textContent=choice.type==='caravan'?t(`caravan.flavor.${Math.max(0,FLAVOR_POOLS.caravan.indexOf(choice.flavor))}`):contentText(choice.flavor);body.append(flavor);
  button.append(visual,body);applyChoiceAvailability(button,choice,activeRun);button.addEventListener('click',()=>chooseChoice(choice,button));return button;
}
function renderPortrait(){if(!screen||!activeRun)return;const portrait=screen.querySelector('[data-travel-run-portrait]');const rating=screen.querySelector('[data-travel-player-rating]');if(!portrait||!rating)return;const source=commanderPortrait(activeRun.commanderId);portrait.src=source;portrait.alt=commanderTitle(activeRun.commanderId,currentLanguage());rating.style.setProperty('--travel-commander-portrait',`url("${new URL(source,document.baseURI).href}")`);}
function renderRating(){if(!screen)return;const profile=readPlayerRating(),stars=threatStarsForPower(profile.power);const power=screen.querySelector('[data-travel-power]'),threat=screen.querySelector('[data-travel-player-threat]');if(power)power.textContent=String(profile.power);if(threat){threat.textContent=starsText(stars);threat.setAttribute('aria-label',t('travel.threatAria',{stars}));}}
function renderResources(){if(!screen||!activeRun)return;const gold=screen.querySelector('[data-travel-inline-gold]'),supplies=screen.querySelector('[data-travel-inline-supplies]');if(gold)gold.textContent=String(activeRun.gold??0);if(supplies)supplies.textContent=String(activeRun.supplies??0);screen.querySelector('.travel-choice-inline-resource--supplies')?.classList.toggle('is-empty',Number(activeRun.supplies||0)<=0);}
function renderChoices(){if(!screen||!activeRun)return;applyStaticCopy();const week=(Number.isInteger(activeRun.journeyStep)?activeRun.journeyStep:0)+1;screen.querySelector('[data-travel-week]').textContent=t('travel.week',{week});renderPortrait();renderRating();renderResources();const routes=screen.querySelector('[data-travel-routes]');routes.replaceChildren();for(const choice of activeRun.currentTravelChoices||[])routes.append(routeCard(choice));globalThis.dispatchEvent(new CustomEvent('rpchess:travel-rendered',{detail:{runId:activeRun.id,week}}));}
function combatCount(run,choice){if(choice?.type==='caravan')return run?.caravanCount||0;if(choice?.type==='battle')return run?.battleCount||0;if(choice?.type==='skirmish')return run?.skirmishCount||0;return null;}
function dispatchEncounter(choice){if(!choice.kingdomCell&&['skirmish','battle','caravan'].includes(choice.type))showTravel();else hideTravel();const detail={source:'travel-choice',runId:activeRun?.id||null,choice};if(choice.type==='skirmish'||choice.type==='battle')globalThis.RPChessTravelEncounterOverride=choice;else delete globalThis.RPChessTravelEncounterOverride;if(choice.type==='caravan')return globalThis.dispatchEvent(new CustomEvent('rpchess:caravan-open',{detail}));if(choice.type==='skirmish')return globalThis.dispatchEvent(new CustomEvent('rpchess:skirmish-open',{detail}));if(choice.type==='battle')return globalThis.dispatchEvent(new CustomEvent('rpchess:battle-open',{detail}));if(choice.type==='settlement')return globalThis.dispatchEvent(new CustomEvent('rpchess:settlement-open',{detail}));if(choice.type==='event')return globalThis.dispatchEvent(new CustomEvent('rpchess:event-open',{detail}));if(choice.type==='puzzle')return globalThis.dispatchEvent(new CustomEvent('rpchess:puzzle-open',{detail}));throw new Error(`Unknown Travel Choice encounter type: ${choice.type}`);}
// One gate for first entry, restored saves and the starvation Continue action.
 // Commit the fight only AFTER hunger has been resolved and acknowledged.
function proceedToEncounter(choice){
 activeRun=readRun()||activeRun;
 if(!activeRun||activeRun.ended||hasPendingStarvation(activeRun)||
    activeRun.activeTravelChoice?.id!==choice?.id)return false;
 if(choice.type==='skirmish'&&!hasHealthySkirmishCompanion(activeRun)){
  const map=activeRun.kingdomMap,id=choice.kingdomCell;
  if(id&&map?.pendingCell===id){
   const canceled=cancelEncounterBeforeStart(map,id);
   if(!canceled.ok)return false;
   activeRun=writeRun({...activeRun,activeTravelChoice:null,kingdomMap:canceled.map});
   globalThis.RPChessKingdomMap?.open?.({detail:{source:'skirmish-insufficient-force'}});
  }else{
   // Legacy three-card route: never open an illegal King-only skirmish.
   activeRun=ensureChoices(writeRun({...activeRun,activeTravelChoice:null,currentTravelChoices:null}));
   renderChoices();showTravel();
  }
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated',
    {detail:{source:'skirmish-insufficient-force'}}));
  return false;
 }
 if(choice.type==='settlement'&&choice.kingdomCell){
  const map=activeRun.kingdomMap,id=choice.kingdomCell,cell=map?.cells?.[id];
  const king=map?.king;
  // A completed Settlement can be revisited without pendingCell, travel
  // billing, or mutating its completed receipt. Also handles restored saves.
  if(!map?.pendingCell&&cell?.status==='completed'&&
     cell.selectedEncounter?.id===choice.id&&
     king&&id===king.x+','+king.y){
    dispatchEncounter(choice);
    return true;
  }
 }
 if(choice.kingdomCell){
  const map=activeRun.kingdomMap,id=choice.kingdomCell;
  if(map?.pendingCell!==id||map.cells?.[id]?.selectedEncounter?.id!==choice.id)return false;
  if(map.cells[id].status==='revealed'){
   const beginning=beginEncounter(map,id);
   if(!beginning.ok)return false;
   activeRun=writeRun({...activeRun,kingdomMap:beginning.map});
  }else if(map.cells[id].status!=='in_progress')return false;
 }
 dispatchEncounter(choice);
 return true;
}
function showPendingStarvation(){if(!activeRun||!hasPendingStarvation(activeRun))return false;hideTravel();return Boolean(globalThis.RPChessStarvation?.open?.(activeRun));}
function chooseChoice(choice,button){if(routing)return;const current=readRun();if(!current||current.ended||current.activeTravelChoice)return;if(!validStoredChoices(current)||!current.currentTravelChoices.some(item=>item.id===choice.id))return;if(!canSelectTravelChoice(current,choice).ok){activeRun=current;renderChoices();return;}routing=true;for(const card of screen?.querySelectorAll('[data-travel-choice]')||[])card.disabled=true;button?.classList.add('is-chosen');audio()?.click?.();const payment=applyTravelSupplyCost(current),count=combatCount(current,choice);let activeChoice={...choice,...(Number.isInteger(count)?{combatCountAtSelection:count}:{}),supplyCostAtSelection:payment.requested,supplyPaid:payment.paid},nextRun={...payment.run,journeyStep:choice.step,currentTravelChoices:null,activeTravelChoice:activeChoice};const starvation=resolveStarvation(nextRun,activeChoice);nextRun=starvation.run;activeChoice=starvation.choice;activeRun=writeRun(nextRun);globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));globalThis.RPChessResources?.showChange?.(payment.paid>0?{suppliesDelta:-payment.paid,labelKey:'travel.change.travel'}:{labelKey:'travel.change.starvation'});setTimeout(()=>{routing=false;if(showPendingStarvation())return;if(activeRun?.ended)return;proceedToEncounter(activeChoice);},document.documentElement.dataset.reducedMotion==='1'?0:180);}
function startMapEncounter(choice,kingdomMap){
 if(routing||!choice?.kingdomCell)return false;
 const current=readRun(),id=choice.kingdomCell;
 if(!current||current.ended||current.activeTravelChoice||current.kingdomMap?.pendingCell!==id||
    kingdomMap?.cells?.[id]?.status!=='revealed'||kingdomMap.cells[id].selectedEncounter?.id!==choice.id)return false;
 routing=true;
 // Arrival now spends the Supply on each non-owned step. Existing saves and
 // direct encounter-entry tests without a charged step retain legacy billing.
 const entry=kingdomMap.cells[id];
 const payment=entry.stepSuppliesCharged===true?
  {run:current,requested:entry.stepSuppliesRequested||0,paid:entry.stepSuppliesPaid||0}:
  applyTravelSupplyCost(current);
 const count=combatCount(current,choice);
 let activeChoice={...choice,...(Number.isInteger(count)?{combatCountAtSelection:count}:{}),
  supplyCostAtSelection:payment.requested,supplyPaid:payment.paid};
 let next={...payment.run,kingdomMap,journeyStep:Math.max(current.journeyStep||0,choice.step),
   currentTravelChoices:null,activeTravelChoice:activeChoice};
 const starvation=resolveStarvation(next,activeChoice);
 next=starvation.run;activeChoice=starvation.choice;
 activeRun=writeRun(next);
 globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated',{detail:{source:'kingdom-encounter-start'}}));
 if(entry.stepSuppliesCharged!==true)
  globalThis.RPChessResources?.showChange?.(payment.paid>0?
   {suppliesDelta:-payment.paid,labelKey:'travel.change.travel'}:{labelKey:'travel.change.starvation'});
 routing=false;
 if(showPendingStarvation())return true;
 if(activeRun?.ended)return true;
 proceedToEncounter(activeChoice);
 return true;
}
function resumeMapEncounter(choice){
 activeRun=readRun();
 if(!activeRun||activeRun.activeTravelChoice?.id!==choice.id)return false;
 return proceedToEncounter(choice);
}
function aftermathEncounterType(source){if(source==='skirmish-aftermath')return'skirmish';if(source==='battle-aftermath')return'battle';return null;}
function recoverAftermathRoute(run,source){const expected=aftermathEncounterType(source);if(!expected||run?.activeTravelChoice?.type!==expected)return run;return writeRun({...run,activeTravelChoice:null,currentTravelChoices:null});}
function openTravel(event){routing=false;activeRun=readRun();if(!activeRun)return;const source=event?.detail?.source||null;activeRun=recoverAftermathRoute(activeRun,source);if(showPendingStarvation()||activeRun.ended)return;if(isTravelChoice(activeRun.activeTravelChoice)&&PLAYABLE_TRAVEL_TYPES.includes(activeRun.activeTravelChoice.type)){proceedToEncounter(activeRun.activeTravelChoice);return;}if((typeof location!=='undefined'&&new URLSearchParams(location.search).has('legacy_travel'))||
    globalThis.sessionStorage?.getItem('rpchess.test.legacyTravel')==='1'){
  activeRun=ensureChoices(activeRun);renderChoices();showTravel();return;
 }
 void import('./kingdom-map-app.mjs?v=20261111-settlement-services-v1').then(mod=>mod.openMap(event))
  .catch(error=>{console.error('[RPChess] Kingdom map could not load',error);
   activeRun=ensureChoices(activeRun);renderChoices();showTravel();});
}
function openRoster(){if(routing)return;audio()?.click?.();hideTravel();globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue'));}
function activeChoiceCompleted(run){const choice=run?.activeTravelChoice;if(!isTravelChoice(choice)||!['skirmish','battle'].includes(choice.type)||!Number.isInteger(choice.combatCountAtSelection))return false;return combatCount(run,choice)>choice.combatCountAtSelection;}
function applyAftermathTravelLabels(){const a=document.querySelector('[data-aftermath-continue]'),b=document.querySelector('[data-battle-continue]');if(a)a.textContent=t('travel.continue');if(b)b.textContent=t('travel.continue');}
function syncCombatCompletion(){activeRun=readRun();if(!activeRun)return;if(activeChoiceCompleted(activeRun)){activeRun=writeRun({...activeRun,activeTravelChoice:null});queueMicrotask(applyAftermathTravelLabels);}}
function continueAfterStarvation(){activeRun=readRun();const choice=activeRun?.activeTravelChoice;if(!activeRun||activeRun.ended||!isTravelChoice(choice)||choice.starvationAcknowledged!==true)return;proceedToEncounter(choice);}
ensureOwnerStylesheet();ensureScreen();applyAftermathTravelLabels();addEventListener('rpchess:travel-open',openTravel);addEventListener('rpchess:combat-completed',syncCombatCompletion);addEventListener('rpchess:resources-updated',()=>{if(screen&&!screen.hidden){activeRun=readRun()||activeRun;renderChoices();}});addEventListener('rpchess:starvation-continue',continueAfterStarvation);addEventListener('rpchess:power-updated',()=>{if(screen&&!screen.hidden)renderRating();});subscribe(()=>{applyStaticCopy();applyAftermathTravelLabels();if(screen&&!screen.hidden&&activeRun&&!activeRun.ended&&!activeRun.activeTravelChoice)renderChoices();});globalThis.RPChessTravelChoice=Object.freeze({open:openTravel,openRoster,recoverAftermathRoute,startMapEncounter,resumeMapEncounter,get run(){return activeRun;},get choices(){return[...(activeRun?.currentTravelChoices||[])];},get activeChoice(){return activeRun?.activeTravelChoice||null;}});
