import { readRun, writeRun } from './run-persistence.mjs';
import { validateBattleSelection, SLOT_CAPACITY } from './battle-core.mjs';

const MERCENARY_COSTS = Object.freeze({ pawn:1, knight:3, bishop:3, rook:5, queen:9, king:0 });
const RESERVE_REPLACEMENT_COSTS = Object.freeze({ queen:42, rook:26, bishop:18, knight:18, pawn:10 });
const SUPPLY_GOLD_VALUE = 10;

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
    if (character.isRunKing || character.status !== 'healthy' || selected.has(character.id)) continue;
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

function chargeBattleMercenaries(run,{roster=run?.roster||[],selectedIds=[],encounterId='',battleCountAtCharge=run?.battleCount||0}={}) {
  if (!run) return { run, chargedGold:0, chargedSupplies:0, contract:null };
  const existing=run.battleMercenaryContract;
  if (existing?.encounterId===encounterId) return { run, chargedGold:0, chargedSupplies:0, contract:existing };
  const quote=mercenaryQuote(roster,selectedIds),payment=spendForMercenaries(run,quote.totalCost);
  const contract={
    encounterId,
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
  if((Number(run.battleCount)||0)<=Number(contract.battleCountAtCharge||0))return{run,resolved:false,casualty:null};
  let next={...run},casualty=null;
  if(contract.casualtyDebt&&!run.ended){
    casualty=deterministicMercenaryCasualty(run.roster,contract);
    if(casualty)next={...next,roster:run.roster.map((character)=>character.id===casualty.id?{...character,status:'dead'}:character)};
  }
  const payment={...contract,settled:true,casualtyId:casualty?.id||null};
  next={...next,battleMercenaryContract:null,lastBattle:next.lastBattle?{...next.lastBattle,mercenaryPayment:payment}:next.lastBattle};
  return{run:next,resolved:true,casualty};
}

function paymentToast(charged) {
  if(!charged?.contract)return;
  const root=document.createElement('div');
  root.className='battle-toast';
  const pieces=[];
  if(charged.chargedGold)pieces.push(`${charged.chargedGold} золота`);
  if(charged.chargedSupplies)pieces.push(`${charged.chargedSupplies} припас${charged.chargedSupplies===1?'':'а'}`);
  root.textContent=charged.contract.casualtyDebt?`Наёмники получили всё, что было: ${pieces.join(' + ')||'ничего'}. После Битвы погибнет один именной герой.`:`Наёмники оплачены: ${pieces.join(' + ')||'0'}.`;
  document.body.append(root);setTimeout(()=>root.remove(),4200);
}

function renderBattleLabels() {
  const armyTitle=document.querySelector('.battle-army .battle-section-head h2');
  const armyNote=document.querySelector('.battle-army .battle-section-head>span');
  if (armyTitle) armyTitle.textContent = 'Боевой строй';
  if (armyNote) armyNote.textContent = 'Свободный слот — дешёвый Наёмник. Замена оставленного в резерве здорового героя стоит как его лечение.';
}

function renderBattlePrepQuote() {
  const screen = document.querySelector('[data-battle-screen]');
  const run = readRun();
  const selectedIds = globalThis.RPChessBattle?.selectedIds || [];
  if (!screen || !run || run.ended) return;
  const validation = validateBattleSelection(run.roster, selectedIds);
  const quote = mercenaryQuote(run.roster, selectedIds);
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
    <div class="battle-mercenary-quote__title">СОСТАВ И ОПЛАТА НАЁМНИКОВ</div>
    <div class="battle-mercenary-quote__row"><span>Именные герои</span><strong>${personalizedCount}</strong></div>
    <div class="battle-mercenary-quote__row"><span>Наёмники</span><strong>${quote.totalCount}</strong></div>
    <div class="battle-mercenary-quote__row battle-mercenary-quote__row--cost"><span>Стоимость найма</span><strong>${quote.totalCost} ЗОЛОТА</strong></div>`;

  const actionbar = screen.querySelector('.battle-actionbar');
  const start = screen.querySelector('[data-battle-start]');
  if (actionbar) {
    let actionCost = screen.querySelector('[data-battle-mercenary-action-cost]');
    if (!actionCost) {
      actionCost = document.createElement('div');
      actionCost.className = 'battle-action-cost';
      actionCost.dataset.battleMercenaryActionCost = '';
      if (start?.parentNode === actionbar) actionbar.insertBefore(actionCost, start);
      else actionbar.append(actionCost);
    }
    actionCost.innerHTML = `<span>НАЁМНИКИ</span><strong>${quote.totalCost}</strong>`;
    actionCost.setAttribute('aria-label', `Стоимость Наёмников: ${quote.totalCost} золота`);
  }
  screen.dataset.battleMercenaryCost = String(quote.totalCost);
}

function patchAftermath(casualty) {
  const text = document.querySelector('[data-battle-aftermath-text]');
  if (text) {
    text.textContent = text.textContent.replace('Временная армия распущена', 'Наёмники распущены');
    if (casualty) text.textContent = `${text.textContent} Неоплаченные Наёмники потребовали цену: ${casualty.name} погиб.`;
  }
  if (!casualty) return;
  for (const row of document.querySelectorAll('[data-battle-aftermath] .battle-aftermath-row')) {
    if (row.querySelector('strong')?.textContent === casualty.name) row.remove();
  }
}

function handleBattleStartCapture(event) {
  const button = event.target?.closest?.('[data-battle-start]');
  if (!button || button.disabled) return;
  const battle = globalThis.RPChessBattle;
  const run = readRun();
  const selectedIds = battle?.selectedIds || [];
  const encounterId = battle?.encounter?.id || '';
  if (!run || run.ended || !encounterId) return;
  const validation = validateBattleSelection(run.roster, selectedIds);
  if (!validation.ok) return;
  const charged = chargeBattleMercenaries(run, { roster: run.roster, selectedIds, encounterId, battleCountAtCharge: run.battleCount || 0 });
  writeRun(charged.run);
  globalThis.dispatchEvent(new CustomEvent('rpchess:resources-updated', { detail: { mercenaryPayment: true } }));
  if (charged.chargedGold || charged.chargedSupplies || charged.contract?.casualtyDebt) paymentToast(charged);
}

function handleBattleSelectionRefresh(event) {
  if (!event.target?.closest?.('[data-battle-character],[data-battle-participant]')) return;
  setTimeout(renderBattlePrepQuote, 0);
}

let settlementTimer = null;
function settlePendingDebtSoon() {
  clearTimeout(settlementTimer);
  settlementTimer = setTimeout(() => {
    settlementTimer = null;
    const current = readRun();
    const result = resolveBattleMercenaryDebt(current);
    if (!result.resolved) { patchAftermath(null); return; }
    writeRun(result.run);
    patchAftermath(result.casualty);
    globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated', { detail: { mercenaryDebtSettled: true, casualtyId: result.casualty?.id || null } }));
  }, 0);
}

if (typeof document !== 'undefined') {
  renderBattleLabels();
  renderBattlePrepQuote();
  document.addEventListener('click', handleBattleStartCapture, true);
  document.addEventListener('click', handleBattleSelectionRefresh);
  globalThis.addEventListener?.('rpchess:battle-open', () => setTimeout(() => { renderBattleLabels(); renderBattlePrepQuote(); }, 0));
  globalThis.addEventListener?.('rpchess:run-updated', settlePendingDebtSoon);
  setTimeout(settlePendingDebtSoon, 0);
}

globalThis.RPChessBattleMercenaries = Object.freeze({
  MERCENARY_COSTS,
  RESERVE_REPLACEMENT_COSTS,
  SUPPLY_GOLD_VALUE,
  mercenaryCounts,
  healthyReserveCounts,
  mercenaryGoldCost,
  mercenaryQuote,
  chargeBattleMercenaries,
  deterministicMercenaryCasualty,
  resolveBattleMercenaryDebt
});

export { MERCENARY_COSTS, RESERVE_REPLACEMENT_COSTS, SUPPLY_GOLD_VALUE, mercenaryCounts, healthyReserveCounts, mercenaryGoldCost, mercenaryQuote, chargeBattleMercenaries, deterministicMercenaryCasualty, resolveBattleMercenaryDebt };
