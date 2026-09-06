const MARKER='data-post-pages-ui-review2';
const MOBILE_QUERY='(orientation: landscape) and (max-width: 980px) and (max-height: 520px)';

function activeRunCombat(){
  const classic=document.querySelector('[data-classic-screen]');
  return Boolean(classic&&!classic.hidden&&(globalThis.RPChessBattle?.battlePlan||globalThis.RPChessSkirmish?.battlePlan));
}

function syncMobileCombatPanel(){
  if(!globalThis.matchMedia?.(MOBILE_QUERY)?.matches||!activeRunCombat())return;
  const classic=document.querySelector('[data-classic-screen]');
  const party=classic?.querySelector('.classic-party-panel');
  const moves=classic?.querySelector('.classic-panel--moves');
  if(party&&moves&&moves.parentElement!==party)party.append(moves);
}

function scheduleMobileCombatPanel(){
  requestAnimationFrame(()=>requestAnimationFrame(syncMobileCombatPanel));
}

function ensureStyle(){
  if(document.querySelector(`[${MARKER}]`))return;
  const style=document.createElement('style');
  style.setAttribute(MARKER,'');
  style.textContent=`
/* Human Acceptance correction pass 2. Presentation-only, no gameplay/state changes. */
@media (orientation:landscape) {
  /* 1. Training — one concise information frame: objective+stars | condition | attempts | reward.
     Settings remains a standalone control above it; the board contract stays edge-to-edge. */
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-topbar {
    width:min(380px,calc(100vw - 100dvh - 28px))!important;
    max-width:calc(100vw - 100dvh - 28px)!important;
    min-width:0!important;
    justify-self:start!important;
    align-self:start!important;
    margin:0!important;
    padding:10px 8px 2px!important;
    border:0!important;
    background:transparent!important;
    box-shadow:none!important;
    box-sizing:border-box!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-topbar__actions {
    width:auto!important;
    display:flex!important;
    justify-content:flex-start!important;
    background:transparent!important;
    border:0!important;
    box-shadow:none!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-layout>.puzzle-panel:first-child {
    width:min(380px,calc(100vw - 100dvh - 28px))!important;
    max-width:calc(100vw - 100dvh - 28px)!important;
    min-width:0!important;
    min-height:0!important;
    height:auto!important;
    max-height:none!important;
    align-self:start!important;
    justify-self:start!important;
    margin:8px 12px 0 8px!important;
    padding:14px 16px!important;
    overflow:visible!important;
    box-sizing:border-box!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-polish-objective {
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    align-items:center!important;
    gap:10px!important;
    padding-bottom:9px!important;
    margin:0 0 10px!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-polish-objective strong {
    min-width:0!important;
    font-size:clamp(24px,2.4vw,34px)!important;
    line-height:1!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-polish-objective span {
    justify-self:end!important;
    font-size:clamp(12px,1.15vw,18px)!important;
    line-height:1!important;
    white-space:nowrap!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen [data-puzzle-instruction] {
    margin:0 0 11px!important;
    font-size:clamp(11px,.95vw,15px)!important;
    line-height:1.28!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-attempts {
    margin:0 0 11px!important;
    gap:9px!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-polish-reward {
    margin:0!important;
    font-size:clamp(15px,1.25vw,20px)!important;
    line-height:1!important;
  }

  /* 6. Settlement service art: preserve the actual healer/tavern images while keeping
     the compact circular background. The previous background shorthand erased them. */
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-services>.settlement-service:nth-child(1) .settlement-service__icon {
    background-color:rgba(5,10,16,.95)!important;
    background-image:url('generated_assets/reward_heal.png')!important;
    background-position:center!important;
    background-repeat:no-repeat!important;
    background-size:contain!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-services>.settlement-service:nth-child(2) .settlement-service__icon {
    background-color:rgba(5,10,16,.95)!important;
    background-image:url('generated_assets/reward_recruit.png')!important;
    background-position:center!important;
    background-repeat:no-repeat!important;
    background-size:contain!important;
  }
}

@media (orientation:landscape) and (max-width:1180px) {
  /* 3. Travel — distribute the command row across the available frame instead of
     packing portrait/rating/resources against the right edge. */
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-topbar--command {
    grid-template-columns:max-content minmax(0,1fr)!important;
    column-gap:10px!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-commandbar {
    width:100%!important;
    min-width:0!important;
    grid-template-columns:40px minmax(112px,1fr) minmax(100px,1fr) minmax(148px,1.15fr)!important;
    justify-content:stretch!important;
    column-gap:9px!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-run-portrait {
    width:36px!important;
    height:36px!important;
    min-width:36px!important;
    justify-self:start!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-player-rating,
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-inline-resources,
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-topbar__actions {
    width:100%!important;
    min-width:0!important;
    transform:none!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-player-rating {
    justify-self:stretch!important;
    padding-inline:6px!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-inline-resources {
    justify-self:stretch!important;
    justify-content:center!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-topbar__actions {
    justify-self:stretch!important;
  }
}

@media (orientation:landscape) and (max-width:980px) and (max-height:520px) {
  /* 1. Training phone: standalone Settings button, compact correctly ordered info,
     and a visible gutter before the board. */
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-topbar {
    width:calc(100vw - 100dvh - 24px)!important;
    max-width:calc(100vw - 100dvh - 24px)!important;
    padding:5px 8px 2px!important;
    background:transparent!important;
    border:0!important;
    box-shadow:none!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-topbar__actions {
    width:auto!important;
    background:transparent!important;
    border:0!important;
    box-shadow:none!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-layout>.puzzle-panel:first-child {
    width:calc(100vw - 100dvh - 24px)!important;
    max-width:calc(100vw - 100dvh - 24px)!important;
    margin:5px 14px 0 8px!important;
    padding:8px 9px!important;
    min-height:0!important;
    height:auto!important;
    max-height:none!important;
    overflow:hidden!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-polish-objective {
    grid-template-columns:minmax(0,1fr) auto!important;
    gap:7px!important;
    padding-bottom:5px!important;
    margin-bottom:6px!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-polish-objective strong {
    font-size:20px!important;
    text-overflow:clip!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-polish-objective span {font-size:9px!important}
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen [data-puzzle-instruction] {
    margin-bottom:6px!important;
    font-size:8px!important;
    line-height:1.18!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-attempts {
    margin-bottom:6px!important;
    gap:8px!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-polish-reward {font-size:12px!important}

  /* 2. Roster phone: hero cards fill the catalog height instead of occupying only
     the upper half of the available frame. */
  html[data-landscape-ui='1'] body.roster-active #app main.roster-screen .roster-catalog {
    display:grid!important;
    grid-template-rows:auto minmax(0,1fr)!important;
    min-height:0!important;
    overflow:hidden!important;
  }
  html[data-landscape-ui='1'] body.roster-active #app main.roster-screen .roster-filters {grid-row:1!important}
  html[data-landscape-ui='1'] body.roster-active #app main.roster-screen .roster-grid {
    grid-row:2!important;
    height:100%!important;
    min-height:0!important;
    align-content:stretch!important;
    align-items:stretch!important;
  }
  html[data-landscape-ui='1'] body.roster-active #app main.roster-screen .roster-card {
    height:100%!important;
    min-height:0!important;
    align-self:stretch!important;
    grid-template-rows:minmax(145px,1fr) auto!important;
  }

  /* 3. Travel phone uses the same evenly distributed command rhythm as tablet. */
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-topbar--command {column-gap:8px!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-commandbar {
    height:38px!important;
    grid-template-columns:34px minmax(96px,1fr) minmax(88px,1fr) minmax(128px,1.05fr)!important;
    column-gap:6px!important;
    justify-content:stretch!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-run-portrait {
    width:32px!important;
    height:32px!important;
    min-width:32px!important;
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-player-rating,
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-inline-resources,
  html[data-landscape-ui='1'] body.travel-choice-active #app main.travel-choice-screen .travel-choice-topbar__actions {width:100%!important}

  /* 4. Battle Prep phone: keep the six personal cards directly under the section title. */
  html[data-landscape-ui='1'] body.battle-prep-compact-active #app main.battle-screen .battle-roster {
    align-content:start!important;
    grid-template-rows:auto auto!important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active #app main.battle-screen .battle-grid {
    height:auto!important;
    min-height:0!important;
    align-self:start!important;
    align-content:start!important;
    grid-template-rows:repeat(3,46px)!important;
    grid-auto-rows:46px!important;
  }
  html[data-landscape-ui='1'] body.battle-prep-compact-active #app main.battle-screen .battle-card {
    height:46px!important;
    min-height:46px!important;
  }

  /* 5. Battle/Skirmish run combat: Journal is part of the same information frame as
     Battle/Skirmish, matching the accepted tablet composition. */
  html[data-landscape-ui='1'] body.run-combat-board-active #app main.classic-screen .classic-party-panel:has(>.classic-panel--moves) {
    height:calc(100dvh - 50px)!important;
    max-height:calc(100dvh - 50px)!important;
    overflow:auto!important;
  }
  html[data-landscape-ui='1'] body.run-combat-board-active #app main.classic-screen .classic-party-panel>.classic-panel--moves {
    display:block!important;
    width:100%!important;
    margin:10px 0 0!important;
    padding:9px 0 0!important;
    border:0!important;
    border-top:1px solid rgba(216,177,93,.20)!important;
    background:transparent!important;
    box-shadow:none!important;
  }

  /* 6. Settlement phone: use one full-height row of three Tavern cards, like tablet.
     This keeps portrait, copy, price and Hire button inside each card border. */
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-recruits {
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
    grid-template-rows:minmax(0,1fr)!important;
    height:100%!important;
    min-height:0!important;
    align-items:stretch!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-recruit {
    height:100%!important;
    min-height:0!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    grid-template-rows:76px minmax(0,1fr)!important;
    gap:4px!important;
    overflow:hidden!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-recruit__portrait {
    width:100%!important;
    height:76px!important;
    min-height:0!important;
    object-fit:cover!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-recruit__body {
    min-height:0!important;
    overflow:hidden!important;
    display:flex!important;
    flex-direction:column!important;
    padding:0 2px 2px!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-recruit__head {
    display:grid!important;
    gap:1px!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-recruit__body>p {
    display:-webkit-box!important;
    -webkit-box-orient:vertical!important;
    -webkit-line-clamp:4!important;
    overflow:hidden!important;
    margin:3px 0!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-recruit__footer {
    margin-top:auto!important;
    align-items:center!important;
    gap:4px!important;
  }
}
`;
  document.head.append(style);
}

for(const name of ['rpchess:skirmish-open','rpchess:battle-open','rpchess:run-updated','rpchess:run-continue']){
  addEventListener(name,scheduleMobileCombatPanel);
}
document.addEventListener('click',(event)=>{
  const target=event.target instanceof Element?event.target:null;
  if(target?.closest('[data-skirmish-start],[data-battle-start]'))scheduleMobileCombatPanel();
},true);
addEventListener('resize',scheduleMobileCombatPanel,{passive:true});

setTimeout(()=>{
  ensureStyle();
  scheduleMobileCombatPanel();
},0);

export { ensureStyle, syncMobileCombatPanel };