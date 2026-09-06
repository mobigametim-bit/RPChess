const MARKER='data-post-pages-ui-review6';

function ensureStyle(){
  if(document.querySelector(`[${MARKER}]`))return;
  const style=document.createElement('style');
  style.setAttribute(MARKER,'');
  style.textContent=`
@media (orientation:landscape) and (max-width:980px) and (max-height:520px) {
  /* Use viewport units directly so transformed ancestors cannot shrink the Training frame.
     At the 844x390 acceptance viewport this leaves a 10px gutter before the 390px board. */
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-layout>.puzzle-panel:first-child,
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-outcome {
    left:clamp(24px,3.9vw,33px)!important;
    right:auto!important;
    width:calc(100vw - 100dvh - 43px)!important;
    max-width:calc(100vw - 100dvh - 43px)!important;
    min-width:0!important;
    box-sizing:border-box!important;
  }
}
`;
  document.head.append(style);
}

setTimeout(ensureStyle,0);

export { ensureStyle };