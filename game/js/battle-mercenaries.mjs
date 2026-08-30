import { readRun, writeRun } from './run-persistence.mjs';
import { SLOT_CAPACITY, selectedTypeCounts, validateBattleSelection } from './battle-core.mjs';

const SUPPLY_GOLD_VALUE = 10;
const MERCENARY_COSTS = Object.freeze({ pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 });
const MERCENARY_TYPES = Object.freeze(['queen', 'rook', 'bishop', 'knight', 'pawn']);

function safeInteger(value) { return Number.isInteger(value) && value >= 0 ? value : 0; }
function hashSeed(input) { let h=2166136261; for(const c of String(input)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }

function mercenaryCounts(roster = [], selectedIds = []) {
  const named = selectedTypeCounts(roster, selectedIds);
  return Object.freeze(Object.fromEntries(MERCENARY_TYPES.map((pieceType) => [pieceType, Math.max(0, (SLOT_CAPACITY[pieceType] || 0) - (named[pieceType] || 0))])));
}

function mercenaryGoldCost(roster = [], selectedIds = []) {
  const counts = mercenaryCounts(roster, selectedIds);
  return MERCENARY_TYPES.reduce((sum, pieceType) => sum + (counts[pieceType] * MERCENARY_COSTS[pieceType]), 0);
}

function mercenaryQuote(roster = [], selectedIds = []) {
  const counts = mercenaryCounts(roster, selectedIds);
  const totalCost = MERCENARY_TYPES.reduce((sum, pieceType) => sum + (counts[pieceType] * MERCENARY_COSTS[pieceType]), 0);
  const totalCount = MERCENARY_TYPES.reduce((sum, pieceType) => sum + counts[pieceType], 0);
  return Object.freeze({ counts, totalCost, totalCount });
}

function samePendingContract(contract, encounterId, battleCountAtCharge) {
  return Boolean(contract && contract.encounterId === encounterId && contract.battleCountAtCharge === battleCountAtCharge && !contract.settled);
}

function chargeBattleMercenaries(run, { roster = run?.roster || [], selectedIds = [], encounterId = '', battleCountAtCharge = run?.battleCount || 0 } = {}) {
  if (!run || !encounterId) return { run, chargedGold: 0, chargedSupplies: 0, contract: null, quote: mercenaryQuote(roster, selectedIds) };
  const quote = mercenaryQuote(roster, selectedIds);
  const previous = samePendingContract(run.battleMercenaryContract, encounterId, battleCountAtCharge) ? run.battleMercenaryContract : null;
  const totalCost = Math.max(safeInteger(previous?.totalCost), quote.totalCost);
  const previousGoldPaid = safeInteger(previous?.goldPaid);
  const previousSuppliesPaid = safeInteger(previous?.suppliesPaid);
  const previousCoverage = previousGoldPaid + (previousSuppliesPaid * SUPPLY_GOLD_VALUE);
  const outstanding = Math.max(0, totalCost - previousCoverage);
  const chargedGold = Math.min(safeInteger(run.gold), outstanding);
  const afterGold = Math.max(0, outstanding - chargedGold);
  const suppliesNeeded = afterGold > 0 ? Math.ceil(afterGold / SUPPLY_GOLD_VALUE) : 0;
  const chargedSupplies = Math.min(safeInteger(run.supplies), suppliesNeeded);
  const goldPaid = previousGoldPaid + chargedGold;
  const suppliesPaid = previousSuppliesPaid + chargedSupplies;
  const coverage = goldPaid + (suppliesPaid * SUPPLY_GOLD_VALUE);
  const unpaidValue = Math.max(0, totalCost - coverage);
  const casualtyDebt = Boolean(previous?.casualtyDebt || unpaidValue > 0);
  const contract = {
    encounterId,
    battleCountAtCharge,
    selectedIds: [...new Set(selectedIds)],
    mercenaryCounts: quote.counts,
    mercenaryCount: quote.totalCount,
    totalCost,
    goldPaid,
    suppliesPaid,
    unpaidValue,
    casualtyDebt,
    settled: false
  };
  return {
    run: { ...run, gold: safeInteger(run.gold) - chargedGold, supplies: safeInteger(run.supplies) - chargedSupplies, battleMercenaryContract: contract },
    chargedGold,
    chargedSupplies,
    contract,
    quote
  };
}

function casualtyCandidates(roster = []) {
  const living = roster.filter((character) => character && !character.isRunKing && character.status !== 'dead');
  const wounded = living.filter((character) => character.status === 'wounded');
  const healthy = living.filter((character) => character.status === 'healthy');
  return wounded.length ? wounded : healthy;
}

function deterministicMercenaryCasualty(roster = [], seed = '') {
  const candidates = casualtyCandidates(roster).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (!candidates.length) return null;
  return candidates[hashSeed(`${seed}:mercenary-casualty`) % candidates.length];
}

function resolveBattleMercenaryDebt(run) {
  const contract = run?.battleMercenaryContract;
  if (!run || !contract || contract.settled || !Number.isInteger(contract.battleCountAtCharge) || (run.battleCount || 0) <= contract.battleCountAtCharge) {
    return { run, resolved: false, casualty: null };
  }
  const payment = {
    mercenaryCount: safeInteger(contract.mercenaryCount),
    totalCost: safeInteger(contract.totalCost),
    goldPaid: safeInteger(contract.goldPaid),
    suppliesPaid: safeInteger(contract.suppliesPaid),
    unpaidValue: safeInteger(contract.unpaidValue),
    casualtyDebt: Boolean(contract.casualtyDebt)
  };
  if (run.ended || !contract.casualtyDebt) {
    return {
      run: { ...run, battleMercenaryContract: null, lastBattle: { ...(run.lastBattle || {}), mercenaryPayment: payment, mercenaryCasualtyId: null } },
      resolved: true,
      casualty: null
    };
  }
  const casualty = deterministicMercenaryCasualty(run.roster || [], contract.encounterId);
  if (!casualty) {
    return {
      run: { ...run, battleMercenaryContract: null, lastBattle: { ...(run.lastBattle || {}), mercenaryPayment: payment, mercenaryCasualtyId: null, mercenaryCasualtyUnresolved: true } },
      resolved: true,
      casualty: null
    };
  }
  return {
    run: {
      ...run,
      roster: (run.roster || []).map((character) => character.id === casualty.id ? { ...character, status: 'dead' } : character),
      battleMercenaryContract: null,
      lastBattle: { ...(run.lastBattle || {}), mercenaryPayment: payment, mercenaryCasualtyId: casualty.id, mercenaryCasualtyName: casualty.name }
    },
    resolved: true,
    casualty
  };
}

function paymentToast(result) {
  const debt = Boolean(result?.contract?.casualtyDebt);
  const label = debt ? 'НАЁМНИКИ · НЕ ХВАТИЛО РЕСУРСОВ — ПОСЛЕ БИТВЫ ПОГИБНЕТ ОДИН ГЕРОЙ' : 'НАЁМНИКИ';
  setTimeout(() => globalThis.RPChessResources?.showChange?.({ goldDelta: -safeInteger(result?.chargedGold), suppliesDelta: -safeInteger(result?.chargedSupplies), label }), 80);
}

function normalizeBattleCopy() {
  const army = document.querySelector('[data-battle-screen] .battle-army');
  const eyebrow = army?.querySelector('.reboot-eyebrow');
  const note = army?.querySelector('.battle-section-head > span');
  if (eyebrow) eyebrow.textContent = 'НАЁМНИКИ';
  if (note) note.textContent = 'Персональные бойцы заменяют Наёмников того же типа.';
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
  normalizeBattleCopy();
  document.addEventListener('click', handleBattleStartCapture, true);
  globalThis.addEventListener?.('rpchess:battle-open', () => setTimeout(normalizeBattleCopy, 0));
  globalThis.addEventListener?.('rpchess:run-updated', settlePendingDebtSoon);
  setTimeout(settlePendingDebtSoon, 0);
}

globalThis.RPChessBattleMercenaries = Object.freeze({
  MERCENARY_COSTS,
  SUPPLY_GOLD_VALUE,
  mercenaryCounts,
  mercenaryGoldCost,
  mercenaryQuote,
  chargeBattleMercenaries,
  deterministicMercenaryCasualty,
  resolveBattleMercenaryDebt
});

export { MERCENARY_COSTS, SUPPLY_GOLD_VALUE, mercenaryCounts, mercenaryGoldCost, mercenaryQuote, chargeBattleMercenaries, deterministicMercenaryCasualty, resolveBattleMercenaryDebt };
