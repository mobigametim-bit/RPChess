import { readRun } from './run-persistence.mjs';
import { starsText } from './encounter-difficulty.mjs';
import {
  combatResultScore,
  opponentEloForStars,
  ratedOutcomeKind,
  ratingReceipt,
  readPlayerRating,
  settlePlayerRating,
  threatStarsForPower
} from './player-rating.mjs';

if (!document.querySelector('[data-player-rating-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/player-rating.css?v=20260830-power-1';
  link.dataset.playerRatingCss = '';
  document.head.append(link);
}

function skirmishReceiptId(run) {
  const last = run?.lastSkirmish;
  if (!run?.id || !last?.encounterId || !Number.isInteger(run.skirmishCount)) return null;
  return `${run.id}:skirmish:${run.skirmishCount}:${last.encounterId}`;
}
function battleReceiptId(run) {
  const last = run?.lastBattle;
  if (!run?.id || !last?.encounterId || !Number.isInteger(run.battleCount)) return null;
  return `${run.id}:battle:${run.battleCount}:${last.encounterId}`;
}
function puzzleReceiptId(run) {
  const state = run?.currentPuzzle;
  if (!run?.id || !state?.resolved || !state.routeId || !state.puzzleId) return null;
  return `${run.id}:puzzle:${state.routeId}:${state.puzzleId}`;
}

function settleCombat(run, kind) {
  const last = kind === 'skirmish' ? run?.lastSkirmish : run?.lastBattle;
  const receiptId = kind === 'skirmish' ? skirmishReceiptId(run) : battleReceiptId(run);
  if (!receiptId || !last || !Number.isInteger(last.encounterStars)) return null;
  const result = combatResultScore({ type:last.result, winner:last.winner }, last.playerColor || 'w');
  return settlePlayerRating({ receiptId, opponentElo:opponentEloForStars(last.encounterStars), result }).receipt;
}
function settlePuzzle(run) {
  const state = run?.currentPuzzle;
  const receiptId = puzzleReceiptId(run);
  if (!receiptId || !state) return null;
  return settlePlayerRating({ receiptId, opponentElo:opponentEloForStars(state.stars), result:state.result === 'solved' ? 1 : 0 }).receipt;
}

function settleCurrentRatedOutcome(run = readRun()) {
  if (!run) return null;
  const kind = ratedOutcomeKind(run);
  if (kind === 'puzzle') return settlePuzzle(run);
  if (kind === 'battle' || kind === 'skirmish') return settleCombat(run, kind);
  return null;
}

function resultMarkup(receipt) {
  if (!receipt) return '';
  const sign = receipt.delta > 0 ? '+' : '';
  const cls = receipt.delta > 0 ? 'is-positive' : receipt.delta < 0 ? 'is-negative' : '';
  const beforeThreat = threatStarsForPower(receipt.before);
  const afterThreat = threatStarsForPower(receipt.after);
  const threatChanged = beforeThreat !== afterThreat
    ? `<div class="power-result__threat">УГРОЗА ${starsText(beforeThreat)} → ${starsText(afterThreat)}</div>`
    : '';
  return `<span class="power-result__label">МОЩЬ</span><strong class="power-result__value">${receipt.before} → ${receipt.after}</strong><strong class="power-result__delta ${cls}">${sign}${receipt.delta}</strong>${threatChanged}`;
}
function ensureResult(container, before) {
  if (!container) return null;
  let root = container.querySelector(':scope > [data-power-result]');
  if (!root) {
    root = document.createElement('div');
    root.className = 'power-result';
    root.dataset.powerResult = '';
    if (before?.parentNode === container) container.insertBefore(root, before);
    else container.append(root);
  }
  return root;
}
function paint(root, receipt) {
  if (!root || !receipt) return;
  const markup = resultMarkup(receipt);
  if (root.innerHTML !== markup) root.innerHTML = markup;
  if (root.hidden) root.hidden = false;
}
function renderCombatResult(run, kind) {
  const last = kind === 'skirmish' ? run?.lastSkirmish : run?.lastBattle;
  const receiptId = kind === 'skirmish' ? skirmishReceiptId(run) : battleReceiptId(run);
  if (!last || !receiptId) return;
  const receipt = ratingReceipt(receiptId);
  if (!receipt) return;
  const selector = kind === 'skirmish' ? '[data-skirmish-aftermath]' : '[data-battle-aftermath]';
  const screen = document.querySelector(selector);
  const panel = screen?.querySelector(kind === 'skirmish' ? '.skirmish-aftermath-panel' : '.battle-aftermath-panel');
  const button = screen?.querySelector(kind === 'skirmish' ? '[data-aftermath-continue]' : '[data-battle-continue]');
  paint(ensureResult(panel, button), receipt);
}
function renderPuzzleResult(run) {
  const receiptId = puzzleReceiptId(run);
  if (!receiptId) return;
  const receipt = ratingReceipt(receiptId);
  const outcome = document.querySelector('[data-puzzle-outcome]');
  const button = outcome?.querySelector('[data-puzzle-continue]');
  paint(ensureResult(outcome, button), receipt);
}
function renderPowerResults(run = readRun()) {
  if (!run) return;
  renderCombatResult(run, 'skirmish');
  renderCombatResult(run, 'battle');
  renderPuzzleResult(run);
}
function sync() {
  const run = readRun();
  if (!run) return;
  settleCurrentRatedOutcome(run);
  queueMicrotask(() => renderPowerResults(readRun() || run));
}

addEventListener('rpchess:run-updated', sync);
addEventListener('rpchess:power-updated', () => queueMicrotask(() => renderPowerResults()));
if (typeof MutationObserver !== 'undefined') {
  new MutationObserver(() => renderPowerResults()).observe(document.querySelector('#app') || document.body, {
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:['hidden']
  });
}

globalThis.RPChessPower = Object.freeze({
  read:readPlayerRating,
  settle:settleCurrentRatedOutcome,
  render:renderPowerResults,
  threatStarsForPower
});