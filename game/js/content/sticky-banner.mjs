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
let installed=false,observer=null,scheduled=false,wanted=false,currentScene='none';
let lifecycleActive=true;

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
async function reconcile(){
  const scene=chooseStickyScene();
  currentScene=scene||'none';
  const allow=Boolean(scene);
  if(!allow){
    if(wanted||platform.ads.banner.active){
      wanted=false;
      await platform.ads.banner.hide();
    }
    return;
  }
  if(wanted && platform.ads.banner.active)return;
  wanted=true;
  try{await platform.ads.banner.show();}
  catch(error){console.warn('[RPChess] sticky banner show failed',error);}
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
  // Hidden toggles track every top-level scene and the game's modal overlays.
  // Watching only the body's class prevents repaint-heavy board DOM mutations
  // from triggering repeated calls to the native ad provider.
  observer=new MutationObserver(schedule);
  observer.observe(document.body,{attributes:true,subtree:true,attributeFilter:['hidden']});
  observer.observe(document.body,{attributes:true,attributeFilter:['class']});
  platform.lifecycle.subscribe(({active})=>{
    lifecycleActive=active;schedule();
  });
  globalThis.addEventListener('rpchess:gamepush-status',schedule);
  globalThis.addEventListener('resize',schedule);
  globalThis.addEventListener('pagehide',()=>{wanted=false;void platform.ads.banner.hide();});
  globalThis.RPChessStickyBanner=Object.freeze({
    get diagnostics(){return Object.freeze({
      scene:currentScene,
      requested:wanted,
      active:platform.ads.banner.active,
      backend:platform.ads.banner.backend
    });}
  });
  schedule();
}

export {chooseStickyScene,installStickyBanner};
