import { readRun, writeRun } from './run-persistence.mjs';
import { applyGoldReward, combatGoldReward } from './resources-core.mjs';
import { subscribe, t } from './i18n.mjs';

const GOLD_ICON='generated_assets/reward_gold.png';
const SUPPLIES_ICON='generated_assets/reward_supplies.png';

let hud = null;
let toast = null;
let toastTimer = null;
let settling = false;
let renderQueued = false;
let rewardRenderQueued = false;

function activeRunSceneVisible() {
  const visible = [...document.querySelectorAll('#app > main')].find((main) => !main.hidden);
  return Boolean(visible && !visible.hasAttribute('data-reboot-foundation'));
}

function ensureHud() {
  if (hud) return hud;
  hud = document.createElement('aside');
  hud.className = 'resource-hud';
  hud.dataset.resourceHud = '';
  hud.hidden = true;
  hud.innerHTML = `
    <div class="resource-chip resource-chip--gold" data-resource-gold-chip>
      <img src="${GOLD_ICON}" alt="" aria-hidden="true">
      <span data-resource-gold-label></span><strong data-resource-gold>0</strong>
    </div>
    <div class="resource-chip resource-chip--supplies" data-resource-supplies-chip>
      <span class="resource-chip__supply-icon" aria-hidden="true"><img class="resource-chip__supply-image" src="${SUPPLIES_ICON}" alt=""></span>
      <span data-resource-supplies-label></span><strong data-resource-supplies>0</strong>
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
  root.setAttribute('aria-label', t('resources.ariaLabel'));
  const goldLabel=root.querySelector('[data-resource-gold-label]');
  const suppliesLabel=root.querySelector('[data-resource-supplies-label]');
  if(goldLabel)goldLabel.textContent=t('resources.gold');
  if(suppliesLabel)suppliesLabel.textContent=t('resources.supplies');
  root.hidden = !run || !activeRunSceneVisible();
  if (!run) return;
  const gold = root.querySelector('[data-resource-gold]');
  const supplies = root.querySelector('[data-resource-supplies]');
  if (gold) gold.textContent = String(run.gold);
  if (supplies) supplies.textContent = String(run.supplies);
  root.querySelector('[data-resource-supplies-chip]')?.classList.toggle('is-empty', run.supplies === 0);
}

function scheduleRender() {
  if(renderQueued)return;
  renderQueued=true;
  queueMicrotask(()=>{renderQueued=false;render();});
}

function showChange({ goldDelta = 0, suppliesDelta = 0, label = '' } = {}) {
  const root = ensureToast();
  const parts = [];
  if (goldDelta) parts.push(`${goldDelta > 0 ? '+' : ''}${goldDelta} ${t('resources.goldDelta')}`);
  if (suppliesDelta) parts.push(`${suppliesDelta > 0 ? '+' : ''}${suppliesDelta} ${t('resources.suppliesDelta')}`);
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
  const rewardText = gold > 0 ? `+${gold} ${t('resources.goldDelta')}` : '';
  reward.hidden = gold <= 0;
  if (rewardText) reward.dataset.resourceCombatRewardText = rewardText;
  else delete reward.dataset.resourceCombatRewardText;
  reward.innerHTML = gold > 0
    ? `<img src="${GOLD_ICON}" alt=""><span>${t('resources.reward')}</span><strong>${rewardText}</strong>`
    : '';
}

function clearCombatReward(root) {
  root?.querySelector('[data-resource-combat-reward]')?.remove();
}

function statusFromRecord(record) {
  return { over:true, type:record?.result || 'unknown', winner:record?.winner || null };
}

function renderLastCombatRewards(run = readRun()) {
  if (!run) return;
  renderCombatReward(document.querySelector('[data-skirmish-aftermath]'), run.lastSkirmish?.goldReward || 0);
  renderCombatReward(document.querySelector('[data-battle-aftermath]'), run.lastBattle?.goldReward || 0);
}

function scheduleCombatRewardRender() {
  if(rewardRenderQueued)return;
  rewardRenderQueued=true;
  requestAnimationFrame(()=>{
    rewardRenderQueued=false;
    renderLastCombatRewards();
  });
}

function settleCombatRewards() {
  if (settling) return false;
  const run = readRun();
  if (!run) return false;
  const rewarded = run.resourceRewards || { skirmishCount: run.skirmishCount || 0, battleCount: run.battleCount || 0 };
  const pendingSkirmish = (run.skirmishCount || 0) > rewarded.skirmishCount;
  const pendingBattle = (run.battleCount || 0) > rewarded.battleCount;
  if (!pendingSkirmish && !pendingBattle) return false;

  settling = true;
  try {
    let next = { ...run };
    let totalReward = 0;
    const nextRewarded = { ...rewarded };

    if (pendingSkirmish) {
      const reward = run.ended ? 0 : combatGoldReward({
        encounterType:'skirmish', stars:run.lastSkirmish?.encounterStars,
        status:statusFromRecord(run.lastSkirmish), playerColor:run.lastSkirmish?.playerColor || 'w'
      });
      next = applyGoldReward(next, reward);
      next.lastSkirmish = { ...(next.lastSkirmish || {}), goldReward: reward };
      nextRewarded.skirmishCount = run.skirmishCount || 0;
      totalReward += reward;
    }

    if (pendingBattle) {
      const reward = run.ended ? 0 : combatGoldReward({
        encounterType:'battle', stars:run.lastBattle?.encounterStars,
        status:statusFromRecord(run.lastBattle), playerColor:run.lastBattle?.playerColor || 'w'
      });
      next = applyGoldReward(next, reward);
      next.lastBattle = { ...(next.lastBattle || {}), goldReward: reward };
      nextRewarded.battleCount = run.battleCount || 0;
      totalReward += reward;
    }

    next.resourceRewards = nextRewarded;
    writeRun(next);
    if (totalReward > 0) showChange({ goldDelta: totalReward, label: t('resources.combatReward') });
    globalThis.dispatchEvent(new CustomEvent('rpchess:resources-updated', { detail: { source:'combat-reward', goldReward: totalReward } }));
    return true;
  } finally {
    settling = false;
  }
}

function syncState() {
  settleCombatRewards();
  scheduleRender();
  scheduleCombatRewardRender();
}

if (!document.querySelector('[data-resources-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/resources.css?v=20260908-owner-1';
  link.dataset.resourcesCss = '';
  document.head.append(link);
}

ensureHud();
for(const eventName of ['rpchess:run-updated','rpchess:run-new','rpchess:run-continue'])addEventListener(eventName,syncState);
for(const eventName of ['rpchess:travel-open','rpchess:skirmish-open','rpchess:battle-open','rpchess:settlement-open','rpchess:event-open','rpchess:starvation-open','rpchess:puzzle-open','rpchess:scene-changed'])addEventListener(eventName,scheduleRender);
addEventListener('rpchess:resources-updated',()=>{scheduleRender();scheduleCombatRewardRender();});
subscribe(()=>{scheduleRender();scheduleCombatRewardRender();});
render();

globalThis.RPChessResources = Object.freeze({
  render,
  scheduleRender,
  showChange,
  renderCombatReward,
  clearCombatReward,
  settleCombatRewards,
  get run() { return readRun(); }
});