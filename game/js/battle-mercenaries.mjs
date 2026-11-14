import { readRun, writeRun } from './run-persistence.mjs';
import { validateBattleSelection, SLOT_CAPACITY } from './battle-core.mjs';
import { subscribe, t, currentLanguage } from './i18n.mjs';
import {armyCandidates} from './kingdom-army-core.mjs';
import {boardRacePiecePath} from './race-assets.mjs';
import {DEFAULT_KINGDOM_ECONOMY as K} from './kingdom-economy-config.mjs';

const MERCENARY_COSTS=Object.freeze({...K.mercenaries.goldCost});
const RESERVE_REPLACEMENT_COSTS=Object.freeze({...K.mercenaries.reserveReplacementGold});
const SUPPLY_GOLD_VALUE=K.mercenaries.supplyGoldValue;

function countSelectedTypes(roster = [], selectedIds = []) {
  const selected = new Set(selectedIds);
  const counts = { king:0, queen:0, rook:0, bishop:0, knight:0, pawn:0 };
  for (const character of roster) if (selected.has(character.id) && counts[character.pieceType] !== undefined) counts[character.pieceType] += 1;
  return counts;
}

function healthyReserveCounts(roster = [], selectedIds = []) {
  const selected = new Set(selectedIds);
  const counts = { queen:0, rook:0, bishop:0, knight:0, pawn:0 };
  for (const character of roster) {
    if (character.isRunKing || character.isArmyRecruit || character.status !== 'healthy' || selected.has(character.id)) continue;
    if (counts[character.pieceType] !== undefined) counts[character.pieceType] += 1;
  }
  return counts;
}

function mercenaryCounts(roster = [], selectedIds = []) {
  const selected = countSelectedTypes(roster, selectedIds);
  return {
    queen:Math.max(0,SLOT_CAPACITY.queen-selected.queen),
    rook:Math.max(0,SLOT_CAPACITY.rook-selected.rook),
    bishop:Math.max(0,SLOT_CAPACITY.bishop-selected.bishop),
    knight:Math.max(0,SLOT_CAPACITY.knight-selected.knight),
    pawn:Math.max(0,SLOT_CAPACITY.pawn-selected.pawn)
  };
}

function mercenaryGoldCost(counts = {}) {
  return Object.entries(MERCENARY_COSTS).reduce((sum,[piece,cost])=>sum+(Number(counts[piece])||0)*cost,0);
}

function mercenaryQuote(roster = [], selectedIds = []) {
  const counts = mercenaryCounts(roster, selectedIds);
  const reserve = healthyReserveCounts(roster, selectedIds);
  const reserveReplacementCounts = {};
  const baseCounts = {};
  let reserveReplacementCount = 0, reserveReplacementCost = 0, baseCost = 0;
  for (const pieceType of ['queen','rook','bishop','knight','pawn']) {
    const premiumCount = Math.min(counts[pieceType] || 0, reserve[pieceType] || 0);
    const baseCount = Math.max(0,(counts[pieceType] || 0)-premiumCount);
    reserveReplacementCounts[pieceType]=premiumCount;
    baseCounts[pieceType]=baseCount;
    reserveReplacementCount+=premiumCount;
    reserveReplacementCost+=premiumCount*RESERVE_REPLACEMENT_COSTS[pieceType];
    baseCost+=baseCount*MERCENARY_COSTS[pieceType];
  }
  return {
    counts,
    baseCounts,
    reserveReplacementCounts,
    totalCount:Object.values(counts).reduce((sum,count)=>sum+count,0),
    reserveReplacementCount,
    baseCost,
    reserveReplacementCost,
    totalCost:baseCost+reserveReplacementCost
  };
}

function spendForMercenaries(run, totalCost) {
  const gold=Math.max(0,Number(run?.gold)||0),supplies=Math.max(0,Number(run?.supplies)||0);
  const chargedGold=Math.min(gold,totalCost),remaining=Math.max(0,totalCost-chargedGold),requiredSupplies=Math.ceil(remaining/SUPPLY_GOLD_VALUE),chargedSupplies=Math.min(supplies,requiredSupplies),coveredValue=chargedGold+chargedSupplies*SUPPLY_GOLD_VALUE,unpaidValue=Math.max(0,totalCost-coveredValue);
  return { chargedGold, chargedSupplies, unpaidValue, casualtyDebt:unpaidValue>0 };
}

function chargeBattleMercenaries(run,{roster=run?.roster||[],selectedIds=[],encounterId='',battleCountAtCharge=run?.battleCount||0,combatType='battle'}={}) {
  if (!run) return { run, chargedGold:0, chargedSupplies:0, contract:null };
  const existing=run.battleMercenaryContract;
  if (existing?.encounterId===encounterId) return { run, chargedGold:0, chargedSupplies:0, contract:existing };
  const quote=mercenaryQuote(roster,selectedIds),payment=spendForMercenaries(run,quote.totalCost);
  const contract={
    encounterId,combatType,
    totalCost:quote.totalCost,
    totalCount:quote.totalCount,
    counts:quote.counts,
    baseCounts:quote.baseCounts,
    reserveReplacementCounts:quote.reserveReplacementCounts,
    reserveReplacementCount:quote.reserveReplacementCount,
    reserveReplacementCost:quote.reserveReplacementCost,
    chargedGold:payment.chargedGold,
    chargedSupplies:payment.chargedSupplies,
    unpaidValue:payment.unpaidValue,
    casualtyDebt:payment.casualtyDebt,
    battleCountAtCharge,
    settled:false
  };
  return {
    run:{...run,gold:Math.max(0,(Number(run.gold)||0)-payment.chargedGold),supplies:Math.max(0,(Number(run.supplies)||0)-payment.chargedSupplies),battleMercenaryContract:contract},
    chargedGold:payment.chargedGold,
    chargedSupplies:payment.chargedSupplies,
    contract
  };
}

function deterministicMercenaryCasualty(roster = [], contract = {}) {
  const candidates=roster.filter((character)=>!character.isRunKing&&character.status!=='dead');
  if (!candidates.length) return null;
  candidates.sort((a,b)=>{
    const aW=a.status==='wounded'?0:1,bW=b.status==='wounded'?0:1;
    if(aW!==bW)return aW-bW;
    const priority={pawn:0,knight:1,bishop:2,rook:3,queen:4,king:5};
    const pd=(priority[a.pieceType]??9)-(priority[b.pieceType]??9);
    return pd||String(a.id).localeCompare(String(b.id));
  });
  return candidates[0];
}

function resolveBattleMercenaryDebt(run) {
  const contract=run?.battleMercenaryContract;
  if(!run||!contract||contract.settled)return{run,resolved:false,casualty:null};
  const progress=contract.combatType==='caravan'?run.caravanCount:run.battleCount;
  if((Number(progress)||0)<=Number(contract.battleCountAtCharge||0))return{run,resolved:false,casualty:null};
  let next={...run},casualty=null;
  if(contract.casualtyDebt&&!run.ended){
    casualty=deterministicMercenaryCasualty(run.roster,contract);
    if(casualty)next={...next,roster:run.roster.map((character)=>character.id===casualty.id?{...character,status:'dead'}:character)};
  }
  const payment={...contract,settled:true,casualtyId:casualty?.id||null};
  next={...next,battleMercenaryContract:null,lastBattle:next.lastBattle?{...next.lastBattle,mercenaryPayment:payment}:next.lastBattle};
  return{run:next,resolved:true,casualty};
}

function paymentParts(charged) {
  const pieces=[];
  if(charged.chargedGold)pieces.push(t('battle.mercenary.payment.gold',{amount:charged.chargedGold}));
  if(charged.chargedSupplies)pieces.push(t(charged.chargedSupplies===1?'battle.mercenary.payment.supplyOne':'battle.mercenary.payment.supplyMany',{amount:charged.chargedSupplies}));
  return pieces;
}

let refreshPaymentToast = () => {};
function paymentToast(charged) {
  if(!charged?.contract)return;
  const root=document.createElement('div');
  root.className='battle-toast';
  const renderCopy=()=>{
    const payment=paymentParts(charged).join(' + ')||t('battle.mercenary.payment.none');
    root.textContent=t(charged.contract.casualtyDebt?'battle.mercenary.payment.debt':'battle.mercenary.payment.paid',{payment});
  };
  refreshPaymentToast=renderCopy;renderCopy();
  document.body.append(root);setTimeout(()=>{root.remove();if(refreshPaymentToast===renderCopy)refreshPaymentToast=()=>{};},4200);
}

// Battle reserve replacement uses its separately configurable per-piece Gold tariff (not healing prices).
function renderBattlePrepQuote() {
  const screen = document.querySelector('[data-battle-screen]');
  // Caravan uses the same paid mercenary offer as regular Battle.
  const run = readRun();
  const selectedIds = globalThis.RPChessBattle?.selectedIds || [];
  if (!screen || !run || run.ended) return;
  const complete=[...run.roster,...armyCandidates(run)];
  const validation = validateBattleSelection(complete, selectedIds);
  const quote = mercenaryQuote(complete, selectedIds);
  const personalizedCount = validation.ok ? validation.members.length : selectedIds.length;
  const army = screen.querySelector('.battle-army');
  const participants = screen.querySelector('[data-battle-participants]');
  if (!army) return;

  let root = screen.querySelector('[data-battle-mercenary-quote]');
  if (!root) {
    root = document.createElement('div');
    root.className = 'battle-mercenary-quote';
    root.dataset.battleMercenaryQuote = '';
    if (participants?.parentNode === army) participants.insertAdjacentElement('afterend', root);
    else army.append(root);
  }
  root.innerHTML = `
    <div class="battle-mercenary-quote__title"></div>
    <div class="battle-mercenary-quote__row"><span></span><strong>${personalizedCount}</strong></div>
    <div class="battle-mercenary-quote__row"><span></span><strong>${quote.totalCount}</strong></div>
    <div class="battle-mercenary-quote__row battle-mercenary-quote__row--cost"><span></span><strong>${quote.totalCost}</strong></div>`;
  root.querySelector('.battle-mercenary-quote__title').textContent=t('battle.mercenary.quoteTitle');
  const labels=root.querySelectorAll('.battle-mercenary-quote__row>span');
  if(labels[0])labels[0].textContent=t('battle.mercenary.namedHeroes');
  if(labels[1])labels[1].textContent=t('battle.mercenary.count');
  if(labels[2])labels[2].textContent=t('battle.mercenary.hireCost');
  screen.dataset.battleMercenaryCost = String(quote.totalCost);
}

/* The prior capture handler silently spent Gold on Start. All paid hires
 * now pass through this explicit shared dialog, including Caravan. */
const OFFER_COPY={
 ru:{offer:'«Мы к вашим услугам, Ваше Величество! За подходящую плату, конечно...»',
  tutorial:'«Ваше Величество! Если для Битвы не хватает фигур, орки-наёмники помогут закрыть бреши в строю. Но не злоупотребляйте: их услуги стоят золота и припасов!»',
  tip:'При нехватке золота остаток оплачивается припасами. Наёмники участвуют только в одной партии.',
  approve:'Подтвердить найм',refuse:'Отказаться',gotIt:'Понятно',
  gold:'Золото',supplies:'Припасы',unpaid:'Недостаточно оплаты — наёмники потребуют долг.'},
 en:{offer:'“At your service, Your Majesty! For a suitable fee, of course...”',
  tutorial:'“Your Majesty! When you lack enough pieces for Battle, Orc mercenaries can fill the ranks. But do not rely on them too often: they charge Gold and Supplies!”',
  tip:'When Gold runs short, the remainder is paid in Supplies. Mercenaries serve for one match only.',
  approve:'Confirm hire',refuse:'Decline',gotIt:'Understood',
  gold:'Gold',supplies:'Supplies',unpaid:'Not fully paid — mercenaries will demand the debt.'}
};
const MERCENARY_PIECES=['queen','rook','bishop','knight','pawn'];
let consentContext=null,hireOverlay=null;
function ensureHireOverlay(){
 if(hireOverlay)return hireOverlay;
 if(!document.querySelector('[data-mercenary-hire-style]')){
  const link=document.createElement('link');link.rel='stylesheet';
  link.href='css/battle-mercenary-dialog.css?v=20261114-approved-ui-v1';
  link.dataset.mercenaryHireStyle='';document.head.append(link);
 }
 hireOverlay=document.createElement('div');hireOverlay.className='rpchess-mercenary-modal';
 hireOverlay.dataset.mercenaryHireOverlay='';
 hireOverlay.innerHTML='<div class="rpchess-mercenary-layout">'+
  '<img class="rpchess-mercenary-portrait" alt="" data-mercenary-portrait>'+
  '<section class="rpchess-mercenary-panel" role="dialog" aria-modal="true">'+
  '<h2 class="rpchess-mercenary-title" data-mercenary-title></h2>'+
  '<div class="rpchess-mercenary-tip"><span class="rpchess-mercenary-dot" aria-hidden="true"></span>'+
  '<div data-mercenary-copy></div></div>'+
  '<div class="rpchess-mercenary-actions" data-mercenary-actions></div>'+
  '</section></div>';
 document.body.append(hireOverlay);
 hireOverlay.addEventListener('click',event=>{
  const button=event.target.closest('[data-mercenary-action]');
  if(!button||!consentContext)return;
  const action=button.dataset.mercenaryAction;
  if(action==='learn'){
   const run=readRun();
   if(run?.id===consentContext.runId)writeRun({...run,mercenaryTutorialSeen:true});
   displayHireOffer();
   return;
  }
  const saved=consentContext;
  consentContext=null;hireOverlay.hidden=true;
  if(action==='no'){
   saved.onDecline?.();
   return;
  }
  if(action!=='yes')return;
  const run=readRun();
  if(!run||run.ended||run.id!==saved.runId)return;
  const charged=chargeBattleMercenaries(run,{
   roster:saved.roster,selectedIds:saved.selectedIds,encounterId:saved.encounterId,
   combatType:saved.combatType,
   battleCountAtCharge:saved.combatType==='caravan'?(run.caravanCount||0):(run.battleCount||0)
  });
  let result=charged.run;
  // Consent is final: never leave the reversal snapshot in a started combat.
  const id=result.kingdomMap?.pendingCell,cell=result.kingdomMap?.cells?.[id];
  if(cell?.mercenaryEntryRollback){
   const {mercenaryEntryRollback,...clean}=cell;
   result={...result,kingdomMap:{...result.kingdomMap,cells:{
    ...result.kingdomMap.cells,[id]:clean}}};
  }
  writeRun(result);
  globalThis.dispatchEvent(new CustomEvent('rpchess:resources-updated',
   {detail:{source:'mercenary-accepted'}}));
  saved.onAccept?.();
 });
 return hireOverlay;
}
function hireCopy(){return OFFER_COPY[currentLanguage()==='en'?'en':'ru'];}
function hireButton(action,label,title){
 const btn=document.createElement('button');
 btn.type='button';btn.dataset.mercenaryAction=action;btn.textContent=label;
 btn.title=title;btn.setAttribute('aria-label',title);
 if(action==='learn')btn.classList.add('is-continue');
 return btn;
}
function showHireTutorial(){
 const root=ensureHireOverlay(),copy=hireCopy();
 root.hidden=false;root.querySelector('[data-mercenary-portrait]').src='assets/ui/jester-patrick.webp';
 root.querySelector('[data-mercenary-title]').textContent=copy.tutorial;
 root.querySelector('[data-mercenary-copy]').textContent=copy.tip;
 const actions=root.querySelector('[data-mercenary-actions]');
 actions.replaceChildren(hireButton('learn',copy.gotIt,copy.gotIt));
 actions.querySelector('button').focus();
}
function displayHireOffer(){
 const state=consentContext;if(!state)return;
 const root=ensureHireOverlay(),copy=hireCopy();
 root.hidden=false;
 root.querySelector('[data-mercenary-portrait]').src='assets/ui/orc-mercenary-recruiter.webp';
 root.querySelector('[data-mercenary-title]').textContent=copy.offer;
 const wrap=root.querySelector('[data-mercenary-copy]');
 wrap.replaceChildren();
 const row=document.createElement('div');row.className='rpchess-mercenary-roster';
 const addSign=(txt)=>{const span=document.createElement('span');span.className='rpchess-mercenary-plus';span.textContent=txt;row.append(span);};
 let count=0;
 for(const type of MERCENARY_PIECES){
  const n=state.quote.counts[type]||0;if(!n)continue;
  if(count++)addSign('+');
  const item=document.createElement('span');item.className='rpchess-mercenary-piece';
  const image=document.createElement('img');image.src=boardRacePiecePath('orcs',type,'w');image.alt=type;
  const number=document.createElement('strong');number.textContent=n>1?'×'+n:'';
  item.append(image,number);row.append(item);
 }
 addSign('=');
 for(const [i,[amount,imageSrc,label]] of [
  [state.payment.chargedGold,'generated_assets/reward_gold.png',copy.gold],
  [state.payment.chargedSupplies,'generated_assets/reward_supplies.png',copy.supplies]
 ].entries()){
  if(i)addSign('+');
  const part=document.createElement('span');part.className='rpchess-mercenary-cost';
  const value=document.createElement('strong');value.textContent=String(amount);
  const image=document.createElement('img');image.src=imageSrc;image.alt=label;
  part.append(value,image);row.append(part);
 }
 wrap.append(row);
 if(state.payment.unpaidValue>0){
  const notice=document.createElement('p');notice.textContent=copy.unpaid;
  wrap.append(notice);
 }
 const actions=root.querySelector('[data-mercenary-actions]');
 actions.replaceChildren(hireButton('no','✕',copy.refuse),hireButton('yes','✓',copy.approve));
 actions.querySelector('[data-mercenary-action="yes"]').focus();
}
function requestMercenaryConsent({combatType='battle',roster=[],selectedIds=[],encounterId='',onAccept=null,onDecline=null}={}){
 const run=readRun();
 if(!run||run.ended||!encounterId)return false;
 if(run.battleMercenaryContract?.encounterId===encounterId)return false;
 const quote=mercenaryQuote(roster,selectedIds);
 if(!quote.totalCount)return false;
 if(consentContext)return true;
 consentContext={runId:run.id,combatType,roster,selectedIds:[...selectedIds],
  encounterId,quote,payment:spendForMercenaries(run,quote.totalCost),
  onAccept,onDecline};
 if(run.mercenaryTutorialSeen===true)displayHireOffer();
 else showHireTutorial();
 return true;
}

function handleBattleSelectionRefresh(event) {
  if (!event.target?.closest?.('[data-battle-character],[data-battle-participant]')) return;
  setTimeout(renderBattlePrepQuote, 0);
}

if (typeof document !== 'undefined') {
  renderBattlePrepQuote();
  document.addEventListener('click', handleBattleSelectionRefresh);
  globalThis.addEventListener?.('rpchess:battle-open', () => setTimeout(renderBattlePrepQuote, 0));
  globalThis.addEventListener?.('rpchess:caravan-open', () => setTimeout(renderBattlePrepQuote, 0));
  subscribe(renderBattlePrepQuote);
  subscribe(()=>refreshPaymentToast());
}

globalThis.RPChessBattleMercenaries = Object.freeze({
  MERCENARY_COSTS,
  RESERVE_REPLACEMENT_COSTS,
  SUPPLY_GOLD_VALUE,
  mercenaryCounts,
  healthyReserveCounts,
  mercenaryGoldCost,
  mercenaryQuote,
  requestMercenaryConsent,
  chargeBattleMercenaries,
  deterministicMercenaryCasualty,
  resolveBattleMercenaryDebt
});

export { MERCENARY_COSTS, RESERVE_REPLACEMENT_COSTS, SUPPLY_GOLD_VALUE, mercenaryCounts, healthyReserveCounts, mercenaryGoldCost, mercenaryQuote, requestMercenaryConsent, chargeBattleMercenaries, deterministicMercenaryCasualty, resolveBattleMercenaryDebt };
