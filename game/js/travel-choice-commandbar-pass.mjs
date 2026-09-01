import { readRun } from './run-persistence.mjs';
import { TRAVEL_SUPPLY_COST } from './resources-core.mjs';

const GOLD_ICON = 'generated_assets/reward_gold.png';
const SUPPLIES_ICON = 'generated_assets/node_shop.png';
let queued = false;

function ensureCss() {
  if (document.querySelector('[data-travel-commandbar-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/travel-choice-commandbar-pass.css?v=20260901-1';
  link.dataset.travelCommandbarCss = '';
  document.head.append(link);
}

function resourceImage(src, className) {
  const image = document.createElement('img');
  image.src = src;
  image.alt = '';
  image.draggable = false;
  image.className = className;
  image.setAttribute('aria-hidden', 'true');
  return image;
}

function ensureHeader() {
  const root = document.querySelector('[data-travel-choice-screen]');
  const topbar = root?.querySelector('.travel-choice-topbar');
  const heading = root?.querySelector('.travel-choice-heading');
  const rating = root?.querySelector('[data-travel-player-rating]');
  const actions = root?.querySelector('.travel-choice-topbar__actions');
  if (!root || !topbar || !heading || !rating || !actions) return null;

  root.querySelector('.travel-choice-logo')?.setAttribute('aria-hidden', 'true');
  topbar.classList.add('travel-choice-topbar--command');

  if (heading.parentElement !== topbar) topbar.prepend(heading);

  let commandbar = topbar.querySelector('[data-travel-commandbar]');
  if (!commandbar) {
    commandbar = document.createElement('div');
    commandbar.className = 'travel-choice-commandbar';
    commandbar.dataset.travelCommandbar = '';
    topbar.append(commandbar);
  }

  if (rating.parentElement !== commandbar) commandbar.append(rating);

  let resources = commandbar.querySelector('[data-travel-inline-resources]');
  if (!resources) {
    resources = document.createElement('div');
    resources.className = 'travel-choice-inline-resources';
    resources.dataset.travelInlineResources = '';
    resources.setAttribute('aria-label', 'Ресурсы текущего забега');

    const gold = document.createElement('span');
    gold.className = 'travel-choice-inline-resource travel-choice-inline-resource--gold';
    gold.setAttribute('aria-label', 'Золото');
    gold.append(resourceImage(GOLD_ICON, 'travel-choice-inline-resource__icon'));
    const goldValue = document.createElement('strong');
    goldValue.dataset.travelInlineGold = '';
    goldValue.textContent = '0';
    gold.append(goldValue);

    const supplies = document.createElement('span');
    supplies.className = 'travel-choice-inline-resource travel-choice-inline-resource--supplies';
    supplies.setAttribute('aria-label', 'Припасы');
    supplies.append(resourceImage(SUPPLIES_ICON, 'travel-choice-inline-resource__icon'));
    const suppliesValue = document.createElement('strong');
    suppliesValue.dataset.travelInlineSupplies = '';
    suppliesValue.textContent = '0';
    supplies.append(suppliesValue);

    resources.append(gold, supplies);
    commandbar.append(resources);
  }

  if (actions.parentElement !== commandbar) commandbar.append(actions);
  return root;
}

function syncHeaderResources(root, run = readRun()) {
  if (!root || !run) return;
  const gold = root.querySelector('[data-travel-inline-gold]');
  const supplies = root.querySelector('[data-travel-inline-supplies]');
  if (gold) gold.textContent = String(run.gold ?? 0);
  if (supplies) supplies.textContent = String(run.supplies ?? 0);
  root.querySelector('.travel-choice-inline-resource--supplies')?.classList.toggle('is-empty', Number(run.supplies || 0) <= 0);
}

function normalizeCost(cost, noSupplies) {
  if (!cost) return;
  cost.dataset.travelInlineCost = String(TRAVEL_SUPPLY_COST);
  cost.classList.toggle('is-empty', noSupplies);
  cost.replaceChildren();

  const amount = document.createElement('span');
  amount.className = 'travel-choice-card__cost-amount';
  amount.textContent = `-${TRAVEL_SUPPLY_COST}`;
  const icon = resourceImage(SUPPLIES_ICON, 'travel-choice-card__cost-icon');
  cost.append(amount, icon);

  const warning = noSupplies
    ? `Стоимость пути: ${TRAVEL_SUPPLY_COST} припас. Припасов нет — при переходе сработает голод.`
    : `Стоимость пути: ${TRAVEL_SUPPLY_COST} припас.`;
  cost.setAttribute('aria-label', warning);
  cost.title = warning;
}

function moveCost(card, noSupplies) {
  const cost = card.querySelector('.travel-choice-card__cost');
  if (!cost) return;
  normalizeCost(cost, noSupplies);

  const threat = card.querySelector('.travel-choice-card__threat');
  if (threat) {
    const reward = threat.querySelector('.travel-choice-card__reward, small');
    if (cost.parentElement !== threat || (reward && cost.nextSibling !== reward)) threat.insertBefore(cost, reward || null);
    return;
  }

  const safe = card.querySelector('.travel-choice-card__safe');
  if (safe) {
    if (cost.parentElement !== safe) safe.append(cost);
    return;
  }

  let meta = card.querySelector('.travel-choice-card__meta--cost-only');
  if (!meta) {
    meta = document.createElement('span');
    meta.className = 'travel-choice-card__meta travel-choice-card__meta--cost-only';
    const flavor = card.querySelector('.travel-choice-card__flavor');
    flavor?.parentNode?.insertBefore(meta, flavor);
  }
  if (cost.parentElement !== meta) meta.append(cost);
}

function syncCards(root, run = readRun()) {
  if (!root) return;
  const noSupplies = Number(run?.supplies || 0) < TRAVEL_SUPPLY_COST;
  for (const card of root.querySelectorAll('[data-travel-choice]')) moveCost(card, noSupplies);
}

function sync() {
  const root = ensureHeader();
  if (!root) return;
  const run = readRun();
  syncHeaderResources(root, run);
  syncCards(root, run);
}

function scheduleSync() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    sync();
  });
}

ensureCss();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleSync, { once: true });
else scheduleSync();

addEventListener('rpchess:travel-open', () => queueMicrotask(scheduleSync));
addEventListener('rpchess:run-updated', scheduleSync);
addEventListener('rpchess:resources-updated', scheduleSync);

new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    if (target?.closest?.('[data-travel-choice-screen]')) return scheduleSync();
    for (const node of mutation.addedNodes) {
      if (node instanceof Element && (node.matches?.('[data-travel-choice-screen], [data-travel-choice]') || node.querySelector?.('[data-travel-choice-screen], [data-travel-choice]'))) return scheduleSync();
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });

globalThis.RPChessTravelCommandbarPass = Object.freeze({ sync: scheduleSync });
