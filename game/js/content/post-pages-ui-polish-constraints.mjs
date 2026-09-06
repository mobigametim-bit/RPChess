const MARKER='data-post-pages-ui-polish-constraints';

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
  html[data-landscape-ui='1'] body.run-combat-board-active .classic-party-panel {
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

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureConstraints,{once:true});
else ensureConstraints();

export { ensureConstraints };
