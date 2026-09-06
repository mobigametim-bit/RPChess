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

  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-mercenary-quote__row--cost strong::before,
  html[data-landscape-ui='1'] .battle-mercenary-quote__row--cost strong::before {
    content:none!important;
    display:none!important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active .post-pages-gold-icon,
  html[data-landscape-ui='1'] .battle-mercenary-quote__row--cost .post-pages-gold-icon {
    width:20px!important;
    height:20px!important;
    min-width:20px!important;
    flex:0 0 20px!important;
    object-fit:contain!important;
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

  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-topbar--command {
    width:100%!important;
    min-width:0!important;
    height:48px!important;
    min-height:48px!important;
    display:grid!important;
    grid-template-columns:max-content minmax(0,1fr)!important;
    grid-template-rows:48px!important;
    align-items:center!important;
    gap:8px!important;
    padding:4px 7px!important;
    margin:0!important;
    overflow:hidden!important;
    box-sizing:border-box!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-heading {
    grid-column:1!important;
    grid-row:1!important;
    align-self:center!important;
    min-width:0!important;
    margin:0!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-heading::after { display:none!important; }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-heading h1 {
    margin:0!important;
    font-size:clamp(18px,2.4vw,28px)!important;
    line-height:1!important;
    white-space:nowrap!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-commandbar {
    grid-column:2!important;
    grid-row:1!important;
    justify-self:stretch!important;
    align-self:center!important;
    width:100%!important;
    min-width:0!important;
    height:40px!important;
    display:grid!important;
    grid-template-columns:36px 110px 92px 142px!important;
    grid-template-rows:40px!important;
    align-items:center!important;
    justify-content:end!important;
    gap:6px!important;
    overflow:hidden!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-run-portrait {
    grid-column:1!important;
    grid-row:1!important;
    width:36px!important;
    height:36px!important;
    min-width:36px!important;
    margin:0!important;
    border:1px solid rgba(216,177,93,.5)!important;
    border-radius:4px!important;
    object-fit:cover!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-player-rating {
    grid-column:2!important;
    grid-row:1!important;
    justify-self:stretch!important;
    align-self:center!important;
    width:110px!important;
    min-width:0!important;
    min-height:0!important;
    height:36px!important;
    display:grid!important;
    align-content:center!important;
    gap:2px!important;
    padding:2px 4px!important;
    border:0!important;
    background:transparent!important;
    transform:none!important;
    box-sizing:border-box!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-player-rating::before {
    content:none!important;
    display:none!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-player-rating__row {
    gap:4px!important;
    min-width:0!important;
    white-space:nowrap!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-player-rating__row span {
    font-size:7px!important;
    letter-spacing:.06em!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-player-rating__row strong { font-size:10px!important; }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-inline-resources {
    grid-column:3!important;
    grid-row:1!important;
    justify-self:stretch!important;
    align-self:center!important;
    width:92px!important;
    min-width:0!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    gap:4px!important;
    transform:none!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-inline-resource {
    min-width:0!important;
    padding:2px 4px!important;
    gap:3px!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-inline-resource__icon {
    width:20px!important;
    height:20px!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-inline-resource strong { font-size:10px!important; }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-topbar__actions {
    grid-column:4!important;
    grid-row:1!important;
    justify-self:stretch!important;
    align-self:center!important;
    width:142px!important;
    min-width:0!important;
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:4px!important;
    flex-wrap:nowrap!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-topbar__actions .reboot-button {
    width:100%!important;
    min-width:0!important;
    min-height:30px!important;
    padding:3px 5px!important;
    font-size:9px!important;
    white-space:nowrap!important;
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
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-topbar--command {
    grid-template-columns:max-content minmax(0,1fr)!important;
    grid-template-rows:48px!important;
    gap:5px!important;
    padding:3px 5px!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-heading h1 { font-size:18px!important; }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-commandbar {
    height:38px!important;
    grid-template-columns:32px 86px 76px 126px!important;
    grid-template-rows:38px!important;
    gap:4px!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-run-portrait {
    width:32px!important;
    height:32px!important;
    min-width:32px!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-player-rating {
    width:86px!important;
    height:32px!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-inline-resources { width:76px!important; }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-inline-resource {
    padding:1px 2px!important;
    gap:2px!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-inline-resource__icon {
    width:17px!important;
    height:17px!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-topbar__actions { width:126px!important; }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-topbar__actions .reboot-button {
    min-height:28px!important;
    padding:2px 3px!important;
    font-size:8px!important;
  }

  /* The three mobile Travel choices use the same vertical card composition as tablet.
     Reset the older phone rule that turns every card itself into a 37/63 horizontal split. */
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-card {
    grid-template-columns:minmax(0,1fr)!important;
    grid-template-rows:minmax(0,1fr) auto!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-card__body {
    height:auto!important;
    min-height:44px!important;
  }

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
  html[data-landscape-ui='1'] body.battle-prep-compact-active .post-pages-gold-icon {
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
