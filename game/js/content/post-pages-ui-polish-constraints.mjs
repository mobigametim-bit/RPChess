const MARKER='data-post-pages-ui-polish-constraints';
const COMBAT_CLASS='post-pages-run-combat-active';

function combatActive(){
  const classic=document.querySelector('[data-classic-screen]');
  return Boolean(classic&&!classic.hidden&&(globalThis.RPChessBattle?.battlePlan||globalThis.RPChessSkirmish?.battlePlan));
}

function syncCombatConstraintState(){
  document.body?.classList.toggle(COMBAT_CLASS,combatActive());
}

let stateQueued=false;
function scheduleCombatConstraintState(){
  if(stateQueued)return;
  stateQueued=true;
  queueMicrotask(()=>{
    stateQueued=false;
    syncCombatConstraintState();
  });
}

function ensureConstraints(){
  if(document.querySelector(`[${MARKER}]`))return;
  const style=document.createElement('style');
  style.setAttribute(MARKER,'');
  style.textContent=`
@media (orientation:landscape) {
  /* The accepted Training information frame contains only objective/stars, condition,
     attempts and the current gold reward. Source credit remains in repository notices. */
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-source { display:none!important; }
}

@media (orientation:landscape) and (max-width:1180px) {
  /* Left-rail panels use viewport-derived width instead of percentage sizing. The rail itself is
     exactly (100vw - 100dvh), so this guarantees a real visual gutter before the edge-to-edge board. */
  html[data-landscape-ui='1'] body.${COMBAT_CLASS} .classic-party-panel {
    width:calc(100vw - 100dvh - 24px)!important;
    max-width:calc(100vw - 100dvh - 24px)!important;
    min-width:0!important;
    box-sizing:border-box!important;
    justify-self:start!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-layout>.puzzle-panel:first-child {
    width:calc(100vw - 100dvh - 24px)!important;
    max-width:calc(100vw - 100dvh - 24px)!important;
    min-width:0!important;
    box-sizing:border-box!important;
    justify-self:start!important;
  }
}
`;
  document.head.append(style);
}

function install(){
  ensureConstraints();
  syncCombatConstraintState();
  for(const name of ['rpchess:skirmish-open','rpchess:battle-open','rpchess:run-updated','rpchess:run-continue']){
    addEventListener(name,scheduleCombatConstraintState);
  }
  document.addEventListener('click',(event)=>{
    const target=event.target instanceof Element?event.target:null;
    if(target?.closest('[data-skirmish-start],[data-battle-start],[data-aftermath-continue],[data-battle-continue]'))scheduleCombatConstraintState();
  },true);
  addEventListener('resize',scheduleCombatConstraintState,{passive:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();

export { ensureConstraints, syncCombatConstraintState };
