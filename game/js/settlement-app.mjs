import { PIECE_GLYPHS, PIECE_LABELS } from './roster-data.mjs';
import { readRun, writeRun } from './run-persistence.mjs';
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

let screen = null;
let activeRun = null;
let busy = false;

function audio() { return globalThis.RPChessRebootAudio; }

function ensureCss() {
  if (document.querySelector('[data-settlement-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/settlement.css?v=20260827-settlement-1';
  link.dataset.settlementCss = '';
  document.head.append(link);
}

function ensureScreen() {
  if (screen) return screen;
  const app = document.querySelector('#app');
  if (!app) return null;
  ensureCss();
  screen = document.createElement('main');
  screen.className = 'settlement-screen';
  screen.dataset.settlementScreen = '';
  screen.setAttribute('aria-label', 'Поселение');
  screen.hidden = true;
  screen.innerHTML = `
    <div class="settlement-shell">
      <header class="settlement-topbar">
        <img class="settlement-logo" src="generated_assets/title_wordmark.png" alt="RPChess">
      </header>
      <header class="settlement-heading">
        <div class="reboot-eyebrow">БЕЗОПАСНАЯ ОСТАНОВКА</div>
        <h1>Поселение</h1>
        <p>Здесь можно привести отряд в порядок перед следующей дорогой.</p>
      </header>
      <div class="settlement-services">
        <section class="settlement-service ui-panel-safe" aria-labelledby="settlement-healer-title">
          <div class="settlement-service__icon" aria-hidden="true">✚</div>
          <div class="reboot-eyebrow">ЗНАХАРКА</div>
          <h2 id="settlement-healer-title">Знахарка</h2>
          <p class="settlement-service__intro">Тяжело раненые бойцы могут вернуться в строй за золото.</p>
          <div class="settlement-healer-list" data-settlement-healer-list></div>
        </section>
        <section class="settlement-service settlement-service--tavern ui-panel-safe" aria-labelledby="settlement-tavern-title">
          <div class="settlement-service__icon" aria-hidden="true">♙</div>
          <div class="reboot-eyebrow">ТАВЕРНА</div>
          <h2 id="settlement-tavern-title">Таверна</h2>
          <p class="settlement-service__intro">Три путника готовы присоединиться к походу. Предложения этого поселения не меняются.</p>
          <div class="settlement-recruits" data-settlement-recruits></div>
        </section>
        <section class="settlement-service ui-panel-safe" aria-labelledby="settlement-supplies-title">
          <div class="settlement-service__icon" aria-hidden="true">◆</div>
          <div class="reboot-eyebrow">СНАБЖЕНИЕ</div>
          <h2 id="settlement-supplies-title">Рынок</h2>
          <p class="settlement-service__intro">Запасы ограничены, но каждый купленный припас остаётся с отрядом.</p>
          <div class="settlement-supply-card" data-settlement-supply-card></div>
        </section>
      </div>
      <footer class="settlement-footer">
        <p>Выход из поселения не расходует дополнительный припас.</p>
        <button class="reboot-button reboot-button--primary settlement-continue" type="button" data-settlement-continue>Продолжить путь</button>
      </footer>
    </div>`;
  app.append(screen);

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
  return `<span class="settlement-price"><img src="generated_assets/reward_gold.png" alt="">${amount}</span>`;
}

function renderHealer() {
  const root = screen?.querySelector('[data-settlement-healer-list]');
  if (!root || !activeRun) return;
  root.replaceChildren();
  const wounded = activeRun.roster.filter((character) => character.status === 'wounded' && !character.isRunKing && Number.isInteger(healCost(character)));
  if (!wounded.length) {
    const empty = document.createElement('p');
    empty.className = 'settlement-empty';
    empty.textContent = 'Все бойцы готовы к пути.';
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
      <div class="settlement-heal-row__action">${goldMarkup(price)}<button class="reboot-button reboot-button--primary" type="button" data-settlement-heal="${character.id}" ${activeRun.gold < price ? 'disabled' : ''}>Лечить</button></div>`;
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
        <p>${candidate.description}</p>
        <div class="settlement-recruit__footer">${goldMarkup(price)}<button class="reboot-button reboot-button--primary" type="button" data-settlement-recruit="${candidate.id}" ${alreadyPresent || activeRun.gold < price ? 'disabled' : ''}>${alreadyPresent ? 'В отряде' : 'Нанять'}</button></div>
      </div>`;
    root.append(card);
  }
}

function renderSupply() {
  const root = screen?.querySelector('[data-settlement-supply-card]');
  if (!root || !activeRun?.currentSettlement) return;
  const stock = activeRun.currentSettlement.supplyStock;
  root.innerHTML = `
    <div class="settlement-supply-card__stock"><span>ОСТАЛОСЬ</span><strong data-settlement-supply-stock>${stock} / 4</strong></div>
    <div class="settlement-supply-card__price">${goldMarkup(SETTLEMENT_SUPPLY_PRICE)}<span>за 1 припас</span></div>
    <button class="reboot-button reboot-button--primary" type="button" data-settlement-buy-supply ${stock <= 0 || activeRun.gold < SETTLEMENT_SUPPLY_PRICE ? 'disabled' : ''}>${stock <= 0 ? 'Распродано' : 'Купить припас'}</button>`;
}

function renderSettlement() {
  if (!screen || !activeRun) return;
  renderHealer();
  renderRecruits();
  renderSupply();
  globalThis.RPChessResources?.render?.();
}

function persistResult(result, toast) {
  if (!result?.success) return false;
  activeRun = writeRun(result.run);
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
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
    changed = persistResult(result, { goldDelta: -result.spent, label: result.success ? 'ЛЕЧЕНИЕ' : '' });
  } else if (recruitButton) {
    const result = applyRecruitment(activeRun, recruitButton.dataset.settlementRecruit);
    changed = persistResult(result, { goldDelta: -result.spent, label: result.success ? 'НОВЫЙ БОЕЦ' : '' });
  } else if (supplyButton) {
    const result = applySupplyPurchase(activeRun);
    changed = persistResult(result, { goldDelta: -result.spent, suppliesDelta: result.suppliesAdded, label: result.success ? 'СНАБЖЕНИЕ' : '' });
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
    globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
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
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
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

globalThis.RPChessSettlement = Object.freeze({
  open: openSettlement,
  continuePath,
  render: renderSettlement,
  get run() { return activeRun; }
});
