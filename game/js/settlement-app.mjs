import { PIECE_GLYPHS, PIECE_LABELS } from './roster-data.mjs';
import { readRun, writeRun } from './run-persistence.mjs';
import { subscribe, t } from './i18n.mjs';
import { heroNoteForId } from './content/hero-notes.mjs';
import {
  SETTLEMENT_SUPPLY_PRICE,
  applyHealing,
  applyRecruitment,
  applySupplyPurchase,
  completeSettlement,
  createSettlementState,
  healCost,
  recruitCost,
  recruitProfile
} from './settlement-core.mjs';

const GOLD_ICON='generated_assets/reward_gold.png';
const SUPPLIES_ICON='generated_assets/reward_supplies.png';

let screen = null;
let activeRun = null;
let busy = false;

function audio() { return globalThis.RPChessRebootAudio; }

function ensureCss() {
  if (document.querySelector('[data-settlement-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/settlement.css?v=20260908-owner-1';
  link.dataset.settlementCss = '';
  document.head.append(link);
}

function applyStaticCopy() {
  if (!screen) return;
  screen.setAttribute('aria-label', t('settlement.ariaLabel'));
  const values={
    '[data-settlement-kicker]':'settlement.kicker',
    '[data-settlement-title]':'settlement.title',
    '[data-settlement-subtitle]':'settlement.subtitle',
    '[data-settlement-healer-title]':'settlement.healer.title',
    '[data-settlement-healer-intro]':'settlement.healer.intro',
    '[data-settlement-tavern-title]':'settlement.tavern.title',
    '[data-settlement-tavern-intro]':'settlement.tavern.intro',
    '[data-settlement-market-title]':'settlement.market.title',
    '[data-settlement-footer-copy]':'settlement.footer',
    '[data-settlement-continue]':'settlement.continue'
  };
  for(const [selector,key] of Object.entries(values)){
    const node=screen.querySelector(selector);
    if(node)node.textContent=t(key);
  }
}

function ensureScreen() {
  if (screen) return screen;
  const app = document.querySelector('#app');
  if (!app) return null;
  ensureCss();
  screen = document.createElement('main');
  screen.className = 'settlement-screen';
  screen.dataset.settlementScreen = '';
  screen.hidden = true;
  screen.innerHTML = `
    <div class="settlement-shell">
      <header class="settlement-topbar">
        <img class="settlement-logo" src="generated_assets/title_wordmark.png" alt="RPChess">
      </header>
      <header class="settlement-heading">
        <div class="reboot-eyebrow" data-settlement-kicker></div>
        <h1 data-settlement-title></h1>
        <p data-settlement-subtitle></p>
      </header>
      <div class="settlement-services">
        <section class="settlement-service ui-panel-safe" aria-labelledby="settlement-healer-title">
          <div class="settlement-service__icon settlement-service__icon--healer" aria-hidden="true"></div>
          <h2 id="settlement-healer-title" data-settlement-healer-title></h2>
          <p class="settlement-service__intro" data-settlement-healer-intro></p>
          <div class="settlement-healer-list" data-settlement-healer-list></div>
        </section>
        <section class="settlement-service settlement-service--tavern ui-panel-safe" aria-labelledby="settlement-tavern-title">
          <div class="settlement-service__icon settlement-service__icon--tavern" aria-hidden="true"></div>
          <h2 id="settlement-tavern-title" data-settlement-tavern-title></h2>
          <p class="settlement-service__intro" data-settlement-tavern-intro></p>
          <div class="settlement-recruits" data-settlement-recruits></div>
        </section>
        <section class="settlement-service settlement-service--market ui-panel-safe" aria-labelledby="settlement-supplies-title">
          <div class="settlement-service__icon settlement-service__icon--market" aria-hidden="true"></div>
          <h2 id="settlement-supplies-title" data-settlement-market-title></h2>
          <div class="settlement-supply-card" data-settlement-supply-card></div>
        </section>
      </div>
      <footer class="settlement-footer">
        <p data-settlement-footer-copy></p>
        <button class="reboot-button reboot-button--primary settlement-continue" type="button" data-settlement-continue></button>
      </footer>
    </div>`;
  app.append(screen);
  applyStaticCopy();

  screen.querySelector('[data-settlement-continue]')?.addEventListener('click', continuePath);
  screen.addEventListener('click', handleServiceAction);
  return screen;
}

function hideAllScenes() {
  for (const main of document.querySelectorAll('#app > main')) main.hidden = true;
  document.body.classList.remove('roster-active', 'skirmish-active', 'battle-active', 'classic-chess-active', 'travel-choice-active');
}

function showSettlement() {
  const root = ensureScreen();
  if (!root) return;
  hideAllScenes();
  root.hidden = false;
  document.body.classList.add('settlement-active');
  window.scrollTo({ top: 0, behavior: 'auto' });
  globalThis.RPChessResources?.render?.();
}

function hideSettlement() {
  if (screen) screen.hidden = true;
  document.body.classList.remove('settlement-active');
}

function goldMarkup(amount) {
  return `<span class="settlement-price"><img src="${GOLD_ICON}" alt="">${amount}</span>`;
}

function renderHealer() {
  const root = screen?.querySelector('[data-settlement-healer-list]');
  if (!root || !activeRun) return;
  root.replaceChildren();
  const wounded = activeRun.roster.filter((character) => character.status === 'wounded' && !character.isRunKing && Number.isInteger(healCost(character)));
  if (!wounded.length) {
    const empty = document.createElement('p');
    empty.className = 'settlement-empty';
    empty.textContent = t('settlement.healer.empty');
    root.append(empty);
    return;
  }
  for (const character of wounded) {
    const row = document.createElement('article');
    row.className = 'settlement-heal-row';
    const price = healCost(character);
    row.innerHTML = `
      <img src="${character.portrait}" alt="${character.name}">
      <div><strong>${character.name}</strong><span>${PIECE_GLYPHS[character.pieceType] || ''} ${PIECE_LABELS[character.pieceType] || character.pieceType}</span></div>
      <div class="settlement-heal-row__action">${goldMarkup(price)}<button class="reboot-button reboot-button--primary" type="button" data-settlement-heal="${character.id}" ${activeRun.gold < price ? 'disabled' : ''}>${t('settlement.healer.action')}</button></div>`;
    root.append(row);
  }
}

function renderRecruits() {
  const root = screen?.querySelector('[data-settlement-recruits]');
  if (!root || !activeRun?.currentSettlement) return;
  root.replaceChildren();
  for (const candidateId of activeRun.currentSettlement.offers) {
    const candidate = recruitProfile(candidateId);
    if (!candidate) continue;
    const alreadyPresent = activeRun.roster.some((character) => character.id === candidateId);
    const price = recruitCost(candidate);
    const card = document.createElement('article');
    card.className = `settlement-recruit${alreadyPresent ? ' is-hired' : ''}`;
    card.dataset.settlementRecruitCard = candidateId;
    card.innerHTML = `
      <img class="settlement-recruit__portrait" src="${candidate.portrait}" alt="${candidate.name}">
      <div class="settlement-recruit__body">
        <div class="settlement-recruit__head"><strong>${candidate.name}</strong><span>${PIECE_GLYPHS[candidate.pieceType] || ''} ${PIECE_LABELS[candidate.pieceType] || candidate.pieceType}</span></div>
        <small>${candidate.origin}</small>
        <p>${heroNoteForId(candidate.id) || candidate.description}</p>
        <div class="settlement-recruit__footer">${goldMarkup(price)}<button class="reboot-button reboot-button--primary" type="button" data-settlement-recruit="${candidate.id}" ${alreadyPresent || activeRun.gold < price ? 'disabled' : ''}>${alreadyPresent ? t('settlement.tavern.inRoster') : t('settlement.tavern.hire')}</button></div>
      </div>`;
    root.append(card);
  }
}

function renderSupply() {
  const root = screen?.querySelector('[data-settlement-supply-card]');
  if (!root || !activeRun?.currentSettlement) return;
  const stock = activeRun.currentSettlement.supplyStock;
  const disabled = stock <= 0 || activeRun.gold < SETTLEMENT_SUPPLY_PRICE;
  root.innerHTML = `
    <div class="settlement-market-row__product">
      <img class="settlement-market-row__item-icon" src="${SUPPLIES_ICON}" alt="" aria-hidden="true">
      <strong data-settlement-supply-stock>${stock}/4</strong>
      <span class="settlement-market-row__separator">${t('settlement.market.for')}</span>
      <img class="settlement-market-row__gold-icon" src="${GOLD_ICON}" alt="" aria-hidden="true">
      <strong class="settlement-price settlement-market-row__price">${SETTLEMENT_SUPPLY_PRICE}</strong>
    </div>
    <button class="reboot-button reboot-button--primary" type="button" data-settlement-buy-supply ${disabled ? 'disabled' : ''}>${stock <= 0 ? t('settlement.market.soldOut') : t('settlement.market.buy')}</button>`;
}

function renderSettlement() {
  if (!screen || !activeRun) return;
  applyStaticCopy();
  renderHealer();
  renderRecruits();
  renderSupply();
  globalThis.RPChessResources?.render?.();
}

function persistResult(result, toast) {
  if (!result?.success) return false;
  activeRun = writeRun(result.run);
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated', { detail:{ source:'settlement' } }));
  globalThis.dispatchEvent(new CustomEvent('rpchess:settlement-updated'));
  globalThis.RPChessResources?.showChange?.(toast);
  renderSettlement();
  return true;
}

function handleServiceAction(event) {
  if (busy) return;
  const healButton = event.target?.closest?.('[data-settlement-heal]');
  const recruitButton = event.target?.closest?.('[data-settlement-recruit]');
  const supplyButton = event.target?.closest?.('[data-settlement-buy-supply]');
  if (!healButton && !recruitButton && !supplyButton) return;
  activeRun = readRun();
  if (!activeRun || activeRun.ended || activeRun.activeTravelChoice?.type !== 'settlement') return;
  busy = true;
  audio()?.click?.();
  let changed = false;
  if (healButton) {
    const result = applyHealing(activeRun, healButton.dataset.settlementHeal);
    changed = persistResult(result, { goldDelta: -result.spent, label: result.success ? t('resources.healing') : '' });
  } else if (recruitButton) {
    const result = applyRecruitment(activeRun, recruitButton.dataset.settlementRecruit);
    changed = persistResult(result, { goldDelta: -result.spent, label: result.success ? t('resources.newFighter') : '' });
  } else if (supplyButton) {
    const result = applySupplyPurchase(activeRun);
    changed = persistResult(result, { goldDelta: -result.spent, suppliesDelta: result.suppliesAdded, label: result.success ? t('resources.supplyPurchase') : '' });
  }
  if (!changed) renderSettlement();
  busy = false;
}

function openSettlement(event) {
  busy = false;
  activeRun = readRun();
  if (!activeRun || activeRun.ended) return;
  const choice = activeRun.activeTravelChoice || event?.detail?.choice;
  if (!choice || choice.type !== 'settlement') return;
  const state = createSettlementState(activeRun, choice);
  if (!activeRun.currentSettlement || activeRun.currentSettlement.routeId !== state.routeId) {
    activeRun = writeRun({ ...activeRun, currentSettlement: state });
    globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated', { detail:{ source:'settlement-open' } }));
  }
  showSettlement();
  renderSettlement();
}

function continuePath() {
  if (busy) return;
  activeRun = readRun();
  if (!activeRun || activeRun.ended || activeRun.activeTravelChoice?.type !== 'settlement') return;
  busy = true;
  audio()?.click?.();
  const suppliesBefore = activeRun.supplies;
  activeRun = writeRun(completeSettlement(activeRun));
  if (activeRun.supplies !== suppliesBefore) throw new Error('Settlement exit must not spend Supplies');
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated', { detail:{ source:'settlement-complete' } }));
  hideSettlement();
  busy = false;
  globalThis.dispatchEvent(new CustomEvent('rpchess:travel-open', { detail: { source: 'settlement-complete', runId: activeRun.id } }));
}

function syncRun() {
  activeRun = readRun();
  if (!screen || screen.hidden) return;
  if (!activeRun || activeRun.ended || activeRun.activeTravelChoice?.type !== 'settlement') {
    hideSettlement();
    return;
  }
  renderSettlement();
}

ensureScreen();
addEventListener('rpchess:settlement-open', openSettlement);
addEventListener('rpchess:run-updated', syncRun);
subscribe(() => { applyStaticCopy(); if(screen && !screen.hidden) renderSettlement(); });

globalThis.RPChessSettlement = Object.freeze({
  open: openSettlement,
  continuePath,
  render: renderSettlement,
  get run() { return activeRun; }
});