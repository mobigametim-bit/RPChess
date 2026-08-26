import { RunSelectionClient, createRunSelectionTransport } from './run-selection-client.mjs';
import { RunSelectionPresenter } from './run-selection-presenter.mjs';
import { RuntimeCommandClient, createLocalRuntimeTransport } from './runtime-command-client.mjs';
import { VerticalSlicePresenter } from './vertical-slice-presenter.mjs';
import { COMMANDERS, commanderById } from './approved-shell-data.mjs';
import { readAudioSettings, VerticalSliceAudio } from './vertical-slice-audio.mjs';

const PROGRESS_KEY = 'rpchess.approved-shell.progress.v1';
const INSTALL_KEY = Symbol.for('rpchess.explicit-run-setup-installed');

function safeStorage() { try { return globalThis.localStorage || null; } catch (_error) { return null; } }
function readProgress(storage) {
  try {
    const raw = JSON.parse(storage?.getItem?.(PROGRESS_KEY) || '{}') || {};
    return {
      unlockPoints:Math.max(0, Number(raw.unlockPoints || 0)),
      victories:Math.max(0, Number(raw.victories || 0)),
      discoveries:Math.max(0, Number(raw.discoveries || 0)),
      milestones:{ ...(raw.milestones || {}) },
      lastProfileId:/^profile-[123]$/.test(raw.lastProfileId) ? raw.lastProfileId : 'profile-1',
      lastCommanderId:COMMANDERS.some((item)=>item.id===raw.lastCommanderId) ? raw.lastCommanderId : 'warlord'
    };
  } catch (_error) {
    return { unlockPoints:0, victories:0, discoveries:0, milestones:{}, lastProfileId:'profile-1', lastCommanderId:'warlord' };
  }
}
function writeProgress(storage, progress) {
  try { storage?.setItem?.(PROGRESS_KEY, JSON.stringify(progress)); return true; }
  catch (_error) { return false; }
}
function addDiscovery(storage, progress, milestone, amount=1) {
  if (!milestone || progress.milestones?.[milestone]) return progress;
  const next={ ...progress, unlockPoints:progress.unlockPoints+amount, discoveries:progress.discoveries+amount, milestones:{ ...progress.milestones, [milestone]:true } };
  writeProgress(storage,next);
  return next;
}
function setTextIfChanged(node, value) { if (node && node.textContent !== value) node.textContent = value; }
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
function decorateCommanderScreen(root=document) {
  const launch=root.querySelector?.('[data-launch-commander]');
  if (!launch) return;
  // The approved commander module owns the screen heading/subheading. Do not mutate
  // those nodes here: both modules observe child-list changes and competing copy
  // creates a synchronous MutationObserver feedback loop that freezes the UI.
  setTextIfChanged(launch,'К ВЫБОРУ КОРОЛЯ И ДОКТРИНЫ');
  const labels=[...root.querySelectorAll('.rpa-loadout small')];
  setTextIfChanged(labels[0],'Рекомендованный король');
  setTextIfChanged(labels[1],'Рекомендованная доктрина');
}
function polishSelection(root) {
  const main=root.querySelector('.rprs');
  if (!main) return;
  main.classList.add('rprs--production-closure');
  const heroes=root.querySelector('section[aria-labelledby="rprs-heroes"]');
  if (heroes) heroes.hidden=true;
  setTextIfChanged(root.querySelector('.rprs__counter'),'Следом: драфт из 3 героев');
  setTextIfChanged(root.querySelector('#rprs-kings'),'1. Выберите короля');
  setTextIfChanged(root.querySelector('#rprs-doctrines'),'2. Выберите доктрину');
  for (const button of root.querySelectorAll('[data-select-king]')) if (button.dataset.kingId!==button.dataset.selectKing) button.dataset.kingId=button.dataset.selectKing;
  for (const button of root.querySelectorAll('[data-select-doctrine]')) if (button.dataset.doctrineId!==button.dataset.selectDoctrine) button.dataset.doctrineId=button.dataset.selectDoctrine;
  setTextIfChanged(root.querySelector('[data-lock-selection]'),'ПОДТВЕРДИТЬ И ПЕРЕЙТИ К СТАРТОВОМУ РОСТЕРУ');
}
function createProgressObserver(storage, profileId, audio) {
  let progress=readProgress(storage);
  let previous=null;
  return (snapshot)=>{
    audio.observe(snapshot);
    const nodeType=snapshot.currentNode?.type;
    const nodeId=snapshot.currentNode?.id || snapshot.currentNode?.contentId || snapshot.transcriptLength;
    if (snapshot.status==='reward' && previous?.status!=='reward' && ['event','service','shop','treasure'].includes(nodeType)) {
      progress=addDiscovery(storage,progress,`${profileId}:discovery:${nodeId}`,1);
    }
    if (snapshot.status==='complete' && previous?.status!=='complete') {
      const milestone=`${profileId}:victory:${snapshot.seed}`;
      if (!progress.milestones?.[milestone]) {
        const next=addDiscovery(storage,progress,milestone,1);
        progress={ ...next, victories:next.victories+1 };
        writeProgress(storage,progress);
      }
    }
    previous=snapshot;
  };
}
function mountProductionRuntime(root, selectionHost, context={}) {
  const runtimeHost=selectionHost.getRuntimeHost();
  if (!runtimeHost) throw new Error('explicit run setup did not produce a runtime host');
  const heroOffers=runtimeHost.getState()?.stageB?.draft?.heroOffers || [];
  if (heroOffers.length!==3) throw new Error('fresh Iron Marches run must materialize exactly three Stage B hero offers');
  root.replaceChildren();
  const storage=context.storage ?? safeStorage();
  const audio=new VerticalSliceAudio({ storage });
  audio.applySettings(readAudioSettings(storage));
  audio.activate();
  const observeProgress=createProgressObserver(storage,context.profileId || 'profile-1',audio);
  const runtimeClient=new RuntimeCommandClient({ transport:createLocalRuntimeTransport(runtimeHost), snapshot:runtimeHost.getSnapshot() });
  runtimeClient.addEventListener('snapshot',(event)=>observeProgress(event.detail));
  const presenter=new VerticalSlicePresenter({ root, client:runtimeClient });
  observeProgress(runtimeHost.getSnapshot());
  globalThis.RPChessVerticalSlice=Object.freeze({ selectionHost,runtimeHost,runtimeClient,presenter,audio,explicitSetup:true });
  root.dispatchEvent(new CustomEvent('rpchess:explicit-run-ready',{ bubbles:true,detail:{ snapshot:runtimeHost.getSnapshot() } }));
}
async function beginExplicitSetup(button) {
  const root=document.getElementById('app');
  const runtimeApi=globalThis.RPChessRuntime;
  if (!root || !runtimeApi?.createBrowserRunSelectionHost) throw new Error('production browser runtime is unavailable');
  const storage=safeStorage();
  const progress=readProgress(storage);
  const selectedCommanderId=root.querySelector('[data-commander-id][aria-pressed="true"]')?.dataset.commanderId || progress.lastCommanderId || 'warlord';
  const commander=commanderById(selectedCommanderId);
  if (!commander) throw new Error('selected commander is unavailable');
  const seedInput=Number(root.querySelector('[data-world-seed]')?.value);
  const options=launchOptions();
  const seed=Number.isFinite(seedInput) && seedInput>0 ? Math.floor(seedInput) : options.seed;
  const profileId=button.dataset.profileId || progress.lastProfileId || 'profile-1';
  writeProgress(storage,{ ...progress,lastProfileId:profileId,lastCommanderId:selectedCommanderId });
  const availableHeroIds=COMMANDERS.map((entry)=>entry.heroId);
  const selectionHost=runtimeApi.createBrowserRunSelectionHost({ seed,profileId,forceNew:true,stageB:true,storage,deviceId:'rpchess-browser-v2',language:options.language,aiProfile:options.aiProfile,autoSave:options.autoSave,heroLimit:1,minimumHeroes:1,availableHeroIds });
  // Run selection needs one bootstrap hero identity. It is only the commander's preference;
  // Stage B still materializes three deterministic offers and the player picks the actual hero.
  await selectionHost.dispatch({ type:'ToggleHero',heroId:commander.heroId });
  const client=new RunSelectionClient({ transport:createRunSelectionTransport(selectionHost),snapshot:selectionHost.getSnapshot() });
  const selectionPresenter=new RunSelectionPresenter({ root,client,onReady:()=>mountProductionRuntime(root,selectionHost,{storage,profileId}) });
  client.addEventListener('snapshot',()=>queueMicrotask(()=>polishSelection(root)));
  selectionPresenter.mount();
  polishSelection(root);
  globalThis.RPChessRunSetup=Object.freeze({ selectionHost,client,presenter:selectionPresenter,preferredHeroId:commander.heroId,profileId,seed });
}
function installExplicitRunSetup() {
  if (globalThis[INSTALL_KEY]) return;
  globalThis[INSTALL_KEY]=true;
  const observer=new MutationObserver(()=>decorateCommanderScreen(document));
  observer.observe(document.documentElement,{ childList:true,subtree:true });
  decorateCommanderScreen(document);
  document.addEventListener('click',(event)=>{
    const button=event.target.closest?.('[data-launch-commander]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    beginExplicitSetup(button).catch((error)=>{
      const root=document.getElementById('app');
      if (root) root.innerHTML=`<main class="rpa-menu"><section class="rpa-panel rpa-menu__status" role="alert"><h2>Не удалось подготовить поход</h2><p>${String(error?.message || error).replace(/[&<>]/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]))}</p><button class="rpa-button rpa-button--primary" type="button" onclick="location.reload()">Вернуться в меню</button></section></main>`;
    });
  },true);
}
if (typeof document!=='undefined') installExplicitRunSetup();
export { readProgress,writeProgress,createProgressObserver,decorateCommanderScreen,polishSelection,beginExplicitSetup,installExplicitRunSetup };