const MARKER='data-post-pages-ui-review2';

function ensureStyle(){
  if(document.querySelector(`[${MARKER}]`))return;
  const style=document.createElement('style');
  style.setAttribute(MARKER,'');
  style.textContent=`
/* Human Acceptance correction pass 2. Presentation-only, no gameplay/state changes. */
@media (orientation:landscape) and (max-width:980px) and (max-height:520px) {
  /* Battle/Skirmish run combat: Journal is part of the same information frame as
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
