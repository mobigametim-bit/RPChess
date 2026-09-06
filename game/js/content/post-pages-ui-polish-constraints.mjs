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
  /* Run-combat is structurally identified once its move log is folded into the information panel.
     Reserve a fixed visual gutter before the edge-to-edge board while preserving Classic Chess. */
  html[data-landscape-ui='1'] .classic-party-panel:has(> .classic-panel--moves) {
    width:calc(100vw - 100dvh - 32px)!important;
    max-width:calc(100vw - 100dvh - 32px)!important;
    min-width:0!important;
    margin-left:8px!important;
    margin-right:0!important;
    box-sizing:border-box!important;
    justify-self:start!important;
    transform:none!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-layout>.puzzle-panel:first-child {
    width:calc(100vw - 100dvh - 32px)!important;
    max-width:calc(100vw - 100dvh - 32px)!important;
    min-width:0!important;
    box-sizing:border-box!important;
    justify-self:start!important;
  }
}

@media (orientation:landscape) and (max-width:980px) and (max-height:520px) {
  /* The canonical Battle runtime moves the real start button into the army panel.
     Pin that same control to the bottom of the compact panel so it cannot fall below
     the fixed-height phone viewport while the six roster cards remain fully visible. */
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army {
    position:relative!important;
    padding-bottom:48px!important;
    overflow:hidden!important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army > [data-battle-start] {
    position:absolute!important;
    z-index:8!important;
    left:8px!important;
    right:8px!important;
    bottom:8px!important;
    width:auto!important;
    min-height:34px!important;
    margin:0!important;
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
