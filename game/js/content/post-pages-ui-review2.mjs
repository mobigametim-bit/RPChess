const MARKER='data-post-pages-ui-review2';

function ensureStyle(){
  if(document.querySelector(`[${MARKER}]`))return;
  const style=document.createElement('style');
  style.setAttribute(MARKER,'');
  style.textContent=`
/* Human Acceptance correction pass 2. Presentation-only, no gameplay/state changes. */
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
}
`;
  document.head.append(style);
}

setTimeout(ensureStyle,0);

export { ensureStyle };
