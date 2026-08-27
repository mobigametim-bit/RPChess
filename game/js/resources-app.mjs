import { readRun } from './run-persistence.mjs';

let hud = null;
let toast = null;
let toastTimer = null;

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
  reward.hidden = gold <= 0;
  reward.innerHTML = gold > 0
    ? `<img src="generated_assets/reward_gold.png" alt=""><span>НАГРАДА</span><strong>+${gold} ЗОЛОТА</strong>`
    : '';
}

function clearCombatReward(root) {
  root?.querySelector('[data-resource-combat-reward]')?.remove();
}

function syncSoon() {
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
  get run() { return readRun(); }
});
