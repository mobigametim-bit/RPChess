const MARKER='data-post-pages-ui-review5';

function ensureStyle(){
  if(document.querySelector(`[${MARKER}]`))return;
  const style=document.createElement('style');
  style.setAttribute(MARKER,'');
  style.textContent=`
@media (orientation:landscape) and (max-width:980px) and (max-height:520px) {
  /* Human Acceptance: mobile Training keeps a small, explicit viewport gutter before the board. */
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-layout>.puzzle-panel:first-child {
    position:fixed!important;
    z-index:46!important;
    top:70px!important;
    left:clamp(24px,3.9vw,33px)!important;
    right:calc(100dvh + 10px)!important;
    width:auto!important;
    max-width:none!important;
    min-width:0!important;
    margin:0!important;
    box-sizing:border-box!important;
  }
}
`;
  document.head.append(style);
}

setTimeout(ensureStyle,0);

export { ensureStyle };