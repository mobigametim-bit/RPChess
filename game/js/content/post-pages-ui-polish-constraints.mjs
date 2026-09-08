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
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-source { display:none!important; }

  /* Battle owns the semantic numeric cost; battle.css owns the gold icon via ::before. */
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-mercenary-quote__row--cost strong::before,
  html[data-landscape-ui='1'] .battle-mercenary-quote__row--cost strong::before {
    width:20px!important;
    height:20px!important;
    min-width:20px!important;
    flex:0 0 20px!important;
    background-size:contain!important;
  }
}

@media (orientation:landscape) and (max-width:1180px) {
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

  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army .battle-mercenary-quote,
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army .battle-mercenary-quote__row {
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    box-sizing:border-box!important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army .battle-mercenary-quote { overflow:hidden!important; }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army .battle-mercenary-quote__row > span,
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army .battle-mercenary-quote__row > strong { min-width:0!important; }
}

@media (orientation:landscape) and (max-width:980px) and (max-height:520px) {
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army {
    position:relative!important;
    padding-bottom:48px!important;
    overflow:hidden!important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army .battle-mercenary-quote {
    margin-top:3px!important;
    padding-top:3px!important;
    gap:2px!important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army .battle-mercenary-quote__title {
    margin-bottom:1px!important;
    font-size:6px!important;
    line-height:1!important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army .battle-mercenary-quote__row {
    min-height:19px!important;
    padding:2px 5px!important;
    gap:5px!important;
    font-size:7px!important;
    line-height:1!important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army .battle-mercenary-quote__row strong { font-size:9px!important; }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-army .battle-mercenary-quote__row--cost strong::before {
    width:14px!important;
    height:14px!important;
    min-width:14px!important;
    flex-basis:14px!important;
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
