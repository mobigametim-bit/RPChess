/* One VK/GamePush sticky banner for quiet RPChess scenes only.
 * The platform SDK renders its native advertisement. We never create a fake
 * clickable banner, move the chessboard, or show ads over combat/dialogs. */
import {platform} from '../platform.mjs';

const QUIET_SCENES=Object.freeze({
  'rebootFoundation':'menu',
  'rosterScreen':'roster',
  'settlementScreen':'settlement',
  'kingdomMapScreen':'journey-map',
  'travelChoiceScreen':'journey-choice'
});
let installed=false,observer=null,bodyObserver=null,scheduled=false,wanted=false,currentScene='none';
let lifecycleActive=true,lastAttempt='not-requested',lastResult='idle';
// Rendering, resize and mutations can fire repeatedly on the same scene.
// Never repeat a rejected banner request until scene/provider state changes.
let attemptedScene=null,attemptedProviderState=null;
// A false GamePush result can be temporary after closeSticky() or when ad
// inventory is unavailable. Retry only twice, with backoff, while the exact
// same quiet scene remains active; never poll while a battle is visible.
const STICKY_RETRY_DELAYS_MS=Object.freeze([8000,30000]);
let retryTimer=null,retryCount=0,retryScene=null,retryProviderState=null;
function cancelStickyRetry(){
  if(retryTimer!==null)clearTimeout(retryTimer);
  retryTimer=null;
}
function resetStickyRetry(){
  cancelStickyRetry();
  retryCount=0;retryScene=null;retryProviderState=null;
}
function shouldRetrySticky(status,scene,active,attemptNumber){
  return Boolean(scene)&&!active&&
    (status==='unavailable'||status==='error')&&
    attemptNumber<STICKY_RETRY_DELAYS_MS.length;
}
function queueStickyRetry(scene,providerState){
  if(retryTimer!==null||!shouldRetrySticky(lastResult,scene,
    platform.ads.banner.active,retryCount))return;
  const delay=STICKY_RETRY_DELAYS_MS[retryCount++];
  retryTimer=setTimeout(()=>{
    retryTimer=null;
    // Do not revive an ad above a combat view or a blocking dialog.
    if(chooseStickyScene()!==scene || bannerProviderState()!==providerState ||
      platform.ads.banner.active)return;
    attemptedScene=null;attemptedProviderState=null;
    schedule();
  },delay);
}
let diagnosticPanel=null;
const previewHost=globalThis.location?.hostname==='rpchess-vk-sticky-preview.mobigametim.workers.dev';
const STATUS_TEXT={
  'not-requested':'Запрос ещё не отправлен',
  'sdk-loading-or-not-vk':'SDK загружается или запуск не распознан',
  'gamepush-sticky-unavailable':'GamePush: sticky недоступен в настройках или нет рекламы',
  'gamepush-banner-unavailable':'GamePush отказал в показе',
  'gamepush-error':'Ошибка показа GamePush',
  'gamepush-banner-accepted':'GamePush принял запрос на показ',
  'vk-host-unverified':'Не подтверждено окружение VK Bridge',
  'vk-no-banner-inventory':'ВК: сейчас нет доступных баннеров',
  'vk-bridge-timeout':'ВК не ответил на рекламный запрос',
  'vk-bridge-error':'ВК вернул ошибку',
  'vk-request-failed':'Не удалось выполнить запрос к ВК',
  'vk-banner-rejected':'ВК отказал в показе баннера',
  'vk-banner-accepted':'ВК принял запрос на показ',
  'already-visible':'Баннер уже запрошен',
  'scene-changed':'Экран сменился'
};
function diagnosticSnapshot(){
  const banner=platform.ads.banner.diagnostics;
  return Object.freeze({
    scene:currentScene,
    requested:wanted,
    lifecycleActive,
    result:lastResult,
    ...banner
  });
}
function renderDiagnostics(){
  if(!diagnosticPanel)return;
  const d=diagnosticSnapshot();
  const lines=[
    'ДИАГНОСТИКА STICKY (это не баннер)',
    'Экран: '+d.scene+' | запрос: '+(d.requested?'да':'нет'),
    'Провайдер: '+d.selectedBackend+' | GP: '+d.gpStatus,
    'GamePush sticky доступен: '+(d.gpStickyAvailable?'да':'нет'),
    'ВК подтверждён: '+(d.vkHostConfirmed?'да':'нет'),
    'Попыток показа: '+d.attempts+' | результат: '+d.result,
    'Повтор после отказа: '+(retryTimer!==null?'запланирован':retryCount>=STICKY_RETRY_DELAYS_MS.length?'лимит исчерпан':'нет'),
    'Причина: '+(STATUS_TEXT[d.reason]||d.reason),
    'Фото этой панели поможет найти проблему'
  ];
  diagnosticPanel.textContent=lines.join('\n');
}
function installDiagnostics(){
  if(!previewHost||diagnosticPanel||!document.body)return;
  diagnosticPanel=document.createElement('pre');
  diagnosticPanel.dataset.rpchessBannerDiagnostics='';
  diagnosticPanel.setAttribute('role','status');
  diagnosticPanel.style.cssText=[
    'position:fixed','left:10px','top:58px','z-index:2147482000',
    'padding:10px','border:1px solid #ba9554','border-radius:6px',
    'background:rgba(8,12,16,.94)','color:#f5d8a1',
    'font:12px/1.5 monospace','white-space:pre-wrap',
    'max-width:min(380px,92vw)','pointer-events:none'
  ].join(';');
  document.body.appendChild(diagnosticPanel);
  renderDiagnostics();
}

function overlayOpen(){
  return Boolean(document.querySelector(
    '.reboot-modal:not([hidden]), .arena-dialog:not([hidden]), '+
    '[data-player-identity-modal]:not([hidden]), [data-artifact-choice-modal]:not([hidden]), '+
    '[data-starvation-modal]:not([hidden]), [data-wd-payment]:not([hidden])'
  ));
}
function chooseStickyScene(){
  if(document.hidden||!lifecycleActive||overlayOpen())return null;
  if(document.querySelector('[data-game-loading]:not([hidden])'))return null;
  // A low horizontal viewport does not leave enough room for a bottom ad.
  // Keep a shown banner from oscillating when VK resizes the viewport.
  const h=globalThis.innerHeight||document.documentElement?.clientHeight||0;
  const w=globalThis.innerWidth||document.documentElement?.clientWidth||0;
  if(h<620 && (!platform.ads.banner.active||h<510) && w>h)return null;
  const active=[...document.querySelectorAll('#app > main:not([hidden])')];
  if(active.length!==1)return null;
  const screen=active[0];
  if(screen.dataset.arenaScreen!==undefined){
    const catalog=screen.querySelector('[data-arena-catalog]');
    const battle=screen.querySelector('[data-arena-battle]');
    return catalog&&!catalog.hidden&&(!battle||battle.hidden)?'arena-catalog':null;
  }
  for(const [key,scene] of Object.entries(QUIET_SCENES)){
    if(screen.dataset[key]!==undefined)return scene;
  }
  return null;
}
function bannerProviderState(){
  const d=platform.ads.banner.diagnostics;
  return [d.selectedBackend,d.gpStatus,d.gpStickyAvailable?'1':'0',
    d.vkHostConfirmed?'1':'0'].join('|');
}
function shouldAttemptBanner(scene,providerState,wasScene,wasProviderState,active){
  return Boolean(scene) && !active &&
    (scene!==wasScene||providerState!==wasProviderState);
}
async function reconcile(){
  const scene=chooseStickyScene();
  currentScene=scene||'none';
  const allow=Boolean(scene);
  renderDiagnostics();
  if(!allow){
    resetStickyRetry();
    attemptedScene=null;attemptedProviderState=null;
    if(wanted||platform.ads.banner.active){
      wanted=false;
      await platform.ads.banner.hide();
    }
    lastAttempt='hidden';lastResult='hidden';
    renderDiagnostics();
    return;
  }
  const providerState=bannerProviderState();
  if(retryScene!==scene||retryProviderState!==providerState){
    resetStickyRetry();
    retryScene=scene;retryProviderState=providerState;
  }
  if(!shouldAttemptBanner(scene,providerState,attemptedScene,
    attemptedProviderState,platform.ads.banner.active))return;
  // Set before await so overlapping scene/resize callbacks cannot queue
  // duplicate show requests for the same provider state.
  attemptedScene=scene;attemptedProviderState=providerState;
  wanted=true;
  try{
    const result=await platform.ads.banner.show();
    lastResult=result?.status||'unknown';
    lastAttempt=platform.ads.banner.diagnostics.reason;
  }catch(error){
    lastResult='error';lastAttempt='unexpected-error';
    console.warn('[RPChess] sticky banner show failed',error);
  }
  if(lastResult==='shown')cancelStickyRetry();
  else if(chooseStickyScene()===scene&&bannerProviderState()===providerState)
    queueStickyRetry(scene,providerState);
  renderDiagnostics();
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  const run=()=>{
    scheduled=false;
    void reconcile().catch(error=>console.warn('[RPChess] sticky banner state error',error));
  };
  if(typeof globalThis.requestAnimationFrame==='function')globalThis.requestAnimationFrame(run);
  else queueMicrotask(run);
}
function installStickyBanner(){
  if(installed||!globalThis.document?.body)return;
  installed=true;
  installDiagnostics();
  // Hidden toggles track every top-level scene and the game's modal overlays.
  // Watching only the body's class prevents repaint-heavy board DOM mutations
  // from triggering repeated calls to the native ad provider.
  observer=new MutationObserver(schedule);
  observer.observe(document.body,{attributes:true,subtree:true,attributeFilter:['hidden']});
  bodyObserver=new MutationObserver(schedule);
  bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  platform.lifecycle.subscribe(({active})=>{
    lifecycleActive=active;schedule();
  });
  globalThis.addEventListener('rpchess:gamepush-status',schedule);
  globalThis.addEventListener('rpchess:vk-ad-host-verified',schedule);
  globalThis.addEventListener('resize',schedule);
  globalThis.addEventListener('pagehide',()=>{
    resetStickyRetry();wanted=false;void platform.ads.banner.hide();
  });
  globalThis.RPChessStickyBanner=Object.freeze({
    get diagnostics(){return diagnosticSnapshot();}
  });
  schedule();
}

export {chooseStickyScene,shouldAttemptBanner,shouldRetrySticky,installStickyBanner};
