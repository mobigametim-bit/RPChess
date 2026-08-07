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
function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash >>> 0;
}
function deterministicHeroOfferIds(seed, heroes, preferredHeroId) {
  const available = (heroes || []).map((entry)=>entry.id).filter(Boolean);
  const preferred = available.includes(preferredHeroId) ? [preferredHeroId] : [];
  return [...preferred, ...available.filter((id)=>id!==preferredHeroId).sort((a,b)=>fnv1a(`${seed}:${a}:hero-draft`)-fnv1a(`${seed}:${b}:hero-draft`) || a.localeCompare(b))].slice(0,3);
}
function launchOptions() {
  const params = new URLSearchParams(globalThis.location?.search || '');
  return {
    aiProfile:['apprentice','tactician','warlord'].includes(params.get('ai')) ? params.get('ai') : 'apprentice',
    autoSave:params.get('autosave') !== '0',
    language:params.get('lang') === 'en' ? 'en' : 'ru'
  };
}
function decorateCommanderScreen(root = document) {
  const launch = root.querySelector?.('[data-launch-commander]');
  if (!launch) return;
  launch.textContent = 'К ВЫБОРУ КОРОЛЯ И ДОКТРИНЫ';
  const heading = root.querySelector('.rpa-screen-header p');
  if (heading) heading.textContent = 'Командир задаёт рекомендованный стиль похода. Короля и доктрину вы подтвердите отдельно, а три героя для стартового драфта материализуются из seed.';
  const loadoutLabels = [...root.querySelectorAll('.rpa-loadout small')];
  if (loadoutLabels[0]) loadoutLabels[0].textContent = 'Рекомендованный король';
  if (loadoutLabels[1]) loadoutLabels[1].textContent = 'Рекомендованная доктрина';
}
function polishSelection(root, offerIds) {
  const main = root.querySelector('.rprs');
  if (!main) return;
  main.classList.add('rprs--production-closure');
  const heroes = root.querySelector('section[aria-labelledby="rprs-heroes"]');
  if (heroes) heroes.hidden = true;
  const counter = root.querySelector('.rprs__counter');
  if (counter) counter.textContent = `Герои для драфта: ${offerIds.length}`;
  const kingHeading = root.querySelector('#rprs-kings');
  if (kingHeading) kingHeading.textContent = '1. Выберите короля';
  const doctrineHeading = root.querySelector('#rprs-doctrines');
  if (doctrineHeading) doctrineHeading.textContent = '2. Выберите доктрину';
  for (const button of root.querySelectorAll('[data-select-king]')) button.dataset.kingId = button.dataset.selectKing;
  for (const button of root.querySelectorAll('[data-select-doctrine]')) button.dataset.doctrineId = button.dataset.selectDoctrine;
  const launch = root.querySelector('[data-lock-selection]');
  if (launch) launch.textContent = 'ПОДТВЕРДИТЬ И ПЕРЕЙТИ К СТАРТОВОМУ РОСТЕРУ';
}
function mountProductionRuntime(root, selectionHost) {
  const runtimeHost = selectionHost.getRuntimeHost();
  if (!runtimeHost) throw new Error('explicit run setup did not produce a runtime host');
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
  const seedInput = Number(root.querySelector('[data-world-seed]')?.value);
  const seed = Number.isFinite(seedInput) && seedInput > 0 ? Math.floor(seedInput) : 9042;
  const profileId = button.dataset.profileId || progress.lastProfileId || 'profile-1';
  const options = launchOptions();
  const availableHeroIds = COMMANDERS.map((entry)=>entry.heroId);
  const selectionHost = runtimeApi.createBrowserRunSelectionHost({
    seed, profileId, forceNew:true, stageB:true, storage, deviceId:'rpchess-browser-v2',
    language:options.language, aiProfile:options.aiProfile, autoSave:options.autoSave,
    heroLimit:3, minimumHeroes:3, availableHeroIds
  });
  const initialHeroes = selectionHost.getSnapshot().selection.heroes;
  const offerIds = deterministicHeroOfferIds(seed, initialHeroes, commander.heroId);
  if (offerIds.length !== 3) throw new Error('fresh Iron Marches run must materialize exactly three hero offers');
  for (const heroId of offerIds) await selectionHost.dispatch({ type:'ToggleHero', heroId });

  const client = new RunSelectionClient({ transport:createRunSelectionTransport(selectionHost), snapshot:selectionHost.getSnapshot() });
  const selectionPresenter = new RunSelectionPresenter({ root, client, onReady:()=>mountProductionRuntime(root, selectionHost) });
  client.addEventListener('snapshot', ()=>queueMicrotask(()=>polishSelection(root, offerIds)));
  selectionPresenter.mount();
  polishSelection(root, offerIds);
  globalThis.RPChessRunSetup = Object.freeze({ selectionHost, client, presenter:selectionPresenter, heroOfferIds:Object.freeze(offerIds.slice()), profileId, seed });
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

export { fnv1a, deterministicHeroOfferIds, decorateCommanderScreen, polishSelection, beginExplicitSetup, installExplicitRunSetup };
