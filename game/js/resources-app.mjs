import { readRun, writeRun } from './run-persistence.mjs';
import { applyGoldReward, combatGoldReward } from './resources-core.mjs';

let hud = null;
let toast = null;
let toastTimer = null;
let settling = false;

function activeRunSceneVisible() {
  const visible = [...document.querySelectorAll('#app > main')].find((main) => !main.hidden);
  return Boolean(visible && !visible.hasAttribute('data-reboot-foundation'));
}

function ensureHud() {
  if (hud) return hud;
  hud = document.createElement('aside');
  hud.className = 'resource-hud';
  hud.dataset.resourceHud = '';
  hud.setAttribute('aria-label', 'Ресурсы текущего забега');
  hud.hidden = true;
  hud.innerHTML = `
    <div class="resource-chip resource-chip--gold" data-resource-gold-chip>
      <img src="generated_assets/reward_gold.png" alt="">
      <span>ЗОЛОТО</span><strong data-resource-gold>0</strong>
    </div>
    <div class="resource-chip resource-chip--supplies" data-resource-supplies-chip>
      <span class="resource-chip__supply-icon" aria-hidden="true">◆</span>
      <span>ПРИПАСЫ</span><strong data-resource-supplies>0</strong>
    </div>`;
  document.body.append(hud);
  return hud;
}

function ensureToast() {
  if (toast) return toast;
  toast = document.createElement('div');
  toast.className = 'resource-toast';
  toast.dataset.resourceToast = '';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.hidden = true;
  document.body.append(toast);
  return toast;
}

function render() {
  const root = ensureHud();
  const run = readRun();
  root.hidden = !run || !activeRunSceneVisible();
  if (!run) return;
  const gold = root.querySelector('[data-resource-gold]');
  const supplies = root.querySelector('[data-resource-supplies]');
  if (gold) gold.textContent = String(run.gold);
  if (supplies) supplies.textContent = String(run.supplies);
  root.querySelector('[data-resource-supplies-chip]')?.classList.toggle('is-empty', run.supplies === 0);
}

function showChange({ goldDelta = 0, suppliesDelta = 0, label = '' } = {}) {
  const root = ensureToast();
  const parts = [];
  if (goldDelta) parts.push(`${goldDelta > 0 ? '+' : ''}${goldDelta} ЗОЛОТА`);
  if (suppliesDelta) parts.push(`${suppliesDelta > 0 ? '+' : ''}${suppliesDelta} ПРИПАС`);
  root.textContent = [label, ...parts].filter(Boolean).join(' · ');
  root.hidden = !root.textContent;
  clearTimeout(toastTimer);
  if (!root.hidden) toastTimer = setTimeout(() => { root.hidden = true; }, 2600);
}

function renderCombatReward(root, amount) {
  if (!root) return;
  let reward = root.querySelector('[data-resource-combat-reward]');
  if (!reward) {
    reward = document.createElement('div');
    reward.className = 'resource-combat-reward';
    reward.dataset.resourceCombatReward = '';
    const button = root.querySelector('button');
    if (button?.parentNode) button.parentNode.insertBefore(reward, button);
    else root.append(reward);
  }
  const gold = Number.isInteger(amount) && amount > 0 ? amount : 0;
  const rewardText = gold > 0 ? `+${gold} ЗОЛОТА` : '';
  reward.hidden = gold <= 0;
  if (rewardText) reward.dataset.resourceCombatRewardText = rewardText;
  else delete reward.dataset.resourceCombatRewardText;
  reward.innerHTML = gold > 0
    ? `<img src="generated_assets/reward_gold.png" alt=""><span>НАГРАДА</span><strong>${rewardText}</strong>`
    : '';
}

function clearCombatReward(root) {
  root?.querySelector('[data-resource-combat-reward]')?.remove();
}

function statusFromRecord(record) {
  return {
    over: true,
    type: record?.result || 'unknown',
    winner: record?.winner || null
  };
}

function renderLastCombatRewards(run = readRun()) {
  if (!run) return;
  renderCombatReward(document.querySelector('[data-skirmish-aftermath]'), run.lastSkirmish?.goldReward || 0);
  renderCombatReward(document.querySelector('[data-battle-aftermath]'), run.lastBattle?.goldReward || 0);
}

function settleCombatRewards() {
  if (settling) return;
  const run = readRun();
  if (!run) return;
  const rewarded = run.resourceRewards || { skirmishCount: run.skirmishCount || 0, battleCount: run.battleCount || 0 };
  const pendingSkirmish = (run.skirmishCount || 0) > rewarded.skirmishCount;
  const pendingBattle = (run.battleCount || 0) > rewarded.battleCount;
  if (!pendingSkirmish && !pendingBattle) {
    setTimeout(() => renderLastCombatRewards(run), 0);
    return;
  }

  settling = true;
  let next = { ...run };
  let totalReward = 0;
  const nextRewarded = { ...rewarded };

  if (pendingSkirmish) {
    const reward = run.ended ? 0 : combatGoldReward({
      encounterType: 'skirmish',
      stars: run.lastSkirmish?.encounterStars,
      status: statusFromRecord(run.lastSkirmish),
      playerColor: run.lastSkirmish?.playerColor || 'w'
    });
    next = applyGoldReward(next, reward);
    next.lastSkirmish = { ...(next.lastSkirmish || {}), goldReward: reward };
    nextRewarded.skirmishCount = run.skirmishCount || 0;
    totalReward += reward;
  }

  if (pendingBattle) {
    const reward = run.ended ? 0 : combatGoldReward({
      encounterType: 'battle',
      stars: run.lastBattle?.encounterStars,
      status: statusFromRecord(run.lastBattle),
      playerColor: run.lastBattle?.playerColor || 'w'
    });
    next = applyGoldReward(next, reward);
    next.lastBattle = { ...(next.lastBattle || {}), goldReward: reward };
    nextRewarded.battleCount = run.battleCount || 0;
    totalReward += reward;
  }

  next.resourceRewards = nextRewarded;
  const saved = writeRun(next);
  settling = false;
  render();
  setTimeout(() => renderLastCombatRewards(saved), 0);
  if (totalReward > 0) showChange({ goldDelta: totalReward, label: 'НАГРАДА ЗА БОЙ' });
  globalThis.dispatchEvent(new CustomEvent('rpchess:resources-updated', { detail: { goldReward: totalReward } }));
}

function syncSoon() {
  settleCombatRewards();
  queueMicrotask(render);
  setTimeout(render, 0);
}

if (!document.querySelector('[data-resources-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/resources.css?v=20260827-resources-1';
  link.dataset.resourcesCss = '';
  document.head.append(link);
}

ensureHud();
addEventListener('rpchess:run-updated', syncSoon);
addEventListener('rpchess:run-new', syncSoon);
addEventListener('rpchess:run-continue', syncSoon);
addEventListener('rpchess:travel-open', syncSoon);
addEventListener('rpchess:resources-updated', () => { render(); setTimeout(renderLastCombatRewards, 0); });
document.addEventListener('click', () => setTimeout(render, 0));
if (typeof MutationObserver !== 'undefined') {
  new MutationObserver(render).observe(document.querySelector('#app') || document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden'],
    childList: true
  });
}
render();

globalThis.RPChessResources = Object.freeze({
  render,
  showChange,
  renderCombatReward,
  clearCombatReward,
  settleCombatRewards,
  get run() { return readRun(); }
});