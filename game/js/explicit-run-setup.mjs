import { RunSelectionClient, createRunSelectionTransport } from './run-selection-client.mjs';
import { RunSelectionPresenter } from './run-selection-presenter.mjs';
import { RuntimeCommandClient, createLocalRuntimeTransport } from './runtime-command-client.mjs';
import { VerticalSlicePresenter } from './vertical-slice-presenter.mjs';
import { COMMANDERS, commanderById } from './approved-shell-data.mjs';

const PROGRESS_KEY = 'rpchess.approved-shell.progress.v1';
const INSTALL_KEY = Symbol.for('rpchess.explicit-run-setup-installed');

function safeStorage() { try { return globalThis.localStorage || null; } catch (_error) { return null; } }
function readProgress(storage) {
  try { return JSON.parse(storage?.getItem?.(PROGRESS_KEY) || '{}') || {}; }
  catch (_error) { return {}; }
}
function setTextIfChanged(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}
function launchOptions() {
  const params = new URLSearchParams(globalThis.location?.search || '');
  const requestedSeed = Number(params.get('seed'));
  return {
    seed:Number.isFinite(requestedSeed) && requestedSeed > 0 ? Math.floor(requestedSeed) : 9042,
    aiProfile:['apprentice','tactician','warlord'].includes(params.get('ai')) ? params.get('ai') : 'apprentice',
    autoSave:params.get('autosave') !== '0',
    language:params.get('lang') === 'en' ? 'en' : 'ru'
  };
}
function decorateCommanderScreen(root = document) {
  const launch = root.querySelector?.('[data-launch-commander]');
  if (!launch) return;
  setTextIfChanged(launch, 'К ВЫБОРУ КОРОЛЯ И ДОКТРИНЫ');
  const heading = root.querySelector('.rpa-screen-header p');
  setTextIfChanged(heading, 'Командир задаёт рекомендованный стиль похода. Короля и доктрину вы подтвердите отдельно, а героя выберете из трёх вариантов стартового драфта.');
  const loadoutLabels = [...root.querySelectorAll('.rpa-loadout small')];
  setTextIfChanged(loadoutLabels[0], 'Рекомендованный король');
  setTextIfChanged(loadoutLabels[1], 'Рекомендованная доктрина');
}
function polishSelection(root) {
  const main = root.querySelector('.rprs');
  if (!main) return;
  main.classList.add('rprs--production-closure');
  const heroes = root.querySelector('section[aria-labelledby="rprs-heroes"]');
  if (heroes) heroes.hidden = true;
  const counter = root.querySelector('.rprs__counter');
  setTextIfChanged(counter, 'Следом: драфт из 3 героев');
  const kingHeading = root.querySelector('#rprs-kings');
  setTextIfChanged(kingHeading, '1. Выберите короля');
  const doctrineHeading = root.querySelector('#rprs-doctrines');
  setTextIfChanged(doctrineHeading, '2. Выберите доктрину');
  for (const button of root.querySelectorAll('[data-select-king]')) {
    if (button.dataset.kingId !== button.dataset.selectKing) button.dataset.kingId = button.dataset.selectKing;
  }
  for (const button of root.querySelectorAll('[data-select-doctrine]')) {
    if (button.dataset.doctrineId !== button.dataset.selectDoctrine) button.dataset.doctrineId = button.dataset.selectDoctrine;
  }
  const launch = root.querySelector('[data-lock-selection]');
  setTextIfChanged(launch, 'ПОДТВЕРДИТЬ И ПЕРЕЙТИ К СТАРТОВОМУ РОСТЕРУ');
}
function mountProductionRuntime(root, selectionHost) {
  const runtimeHost = selectionHost.getRuntimeHost();
  if (!runtimeHost) throw new Error('explicit run setup did not produce a runtime host');
  const heroOffers = runtimeHost.getState()?.stageB?.draft?.heroOffers || [];
  if (heroOffers.length !== 3) throw new Error('fresh Iron Marches run must materialize exactly three Stage B hero offers');
  root.replaceChildren();
  const runtimeClient = new RuntimeCommandClient({ transport:createLocalRuntimeTransport(runtimeHost), snapshot:runtimeHost.getSnapshot() });
  const presenter = new VerticalSlicePresenter({ root, client:runtimeClient });
  globalThis.RPChessVerticalSlice = Object.freeze({ selectionHost, runtimeHost, runtimeClient, presenter, explicitSetup:true });
  root.dispatchEvent(new CustomEvent('rpchess:explicit-run-ready', { bubbles:true, detail:{ snapshot:runtimeHost.getSnapshot() } }));
}
async function beginExplicitSetup(button) {
  const root = document.getElementById('app');
  const runtimeApi = globalThis.RPChessRuntime;
  if (!root || !runtimeApi?.createBrowserRunSelectionHost) throw new Error('production browser runtime is unavailable');
  const storage = safeStorage();
  const progress = readProgress(storage);
  const selectedCommanderId = root.querySelector('[data-commander-id][aria-pressed="true"]')?.dataset.commanderId || progress.lastCommanderId || 'warlord';
  const commander = commanderById(selectedCommanderId);
  if (!commander) throw new Error('selected commander is unavailable');
  const seedInput = Number(root.querySelector('[data-world-seed]')?.value);
  const options = launchOptions();
  const seed = Number.isFinite(seedInput) && seedInput > 0 ? Math.floor(seedInput) : options.seed;
  const profileId = button.dataset.profileId || progress.lastProfileId || 'profile-1';
  const availableHeroIds = COMMANDERS.map((entry)=>entry.heroId);
  const selectionHost = runtimeApi.createBrowserRunSelectionHost({
    seed, profileId, forceNew:true, stageB:true, storage, deviceId:'rpchess-browser-v2',
    language:options.language, aiProfile:options.aiProfile, autoSave:options.autoSave,
    heroLimit:1, minimumHeroes:1, availableHeroIds
  });
  // Run selection currently requires one preferred hero to bootstrap the production army.
  // That preference is not the player-facing hero choice: Stage B materializes three
  // deterministic offers from the full catalog and the player picks one there.
  await selectionHost.dispatch({ type:'ToggleHero', heroId:commander.heroId });

  const client = new RunSelectionClient({ transport:createRunSelectionTransport(selectionHost), snapshot:selectionHost.getSnapshot() });
  const selectionPresenter = new RunSelectionPresenter({ root, client, onReady:()=>mountProductionRuntime(root, selectionHost) });
  client.addEventListener('snapshot', ()=>queueMicrotask(()=>polishSelection(root)));
  selectionPresenter.mount();
  polishSelection(root);
  globalThis.RPChessRunSetup = Object.freeze({ selectionHost, client, presenter:selectionPresenter, preferredHeroId:commander.heroId, profileId, seed });
}

function installExplicitRunSetup() {
  if (globalThis[INSTALL_KEY]) return;
  globalThis[INSTALL_KEY] = true;
  const observer = new MutationObserver(()=>decorateCommanderScreen(document));
  observer.observe(document.documentElement, { childList:true, subtree:true });
  decorateCommanderScreen(document);
  document.addEventListener('click', (event)=>{
    const button = event.target.closest?.('[data-launch-commander]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    beginExplicitSetup(button).catch((error)=>{
      const root = document.getElementById('app');
      if (root) root.innerHTML = `<main class="rpa-menu"><section class="rpa-panel rpa-menu__status" role="alert"><h2>Не удалось подготовить поход</h2><p>${String(error?.message || error).replace(/[&<>]/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]))}</p><button class="rpa-button rpa-button--primary" type="button" onclick="location.reload()">Вернуться в меню</button></section></main>`;
    });
  }, true);
}

if (typeof document !== 'undefined') installExplicitRunSetup();

export { decorateCommanderScreen, polishSelection, beginExplicitSetup, installExplicitRunSetup };