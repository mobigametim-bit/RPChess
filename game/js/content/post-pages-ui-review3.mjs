const MARKER='data-post-pages-ui-review3';

function ensureTrainingLayout(){
  if(document.querySelector(`[${MARKER}]`))return;
  const style=document.createElement('style');
  style.setAttribute(MARKER,'');
  style.textContent=`
/* Final Training geometry for the second Human Acceptance pass. */
@media (orientation:landscape) {
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-shell {
    position:relative!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-topbar {
    position:absolute!important;
    z-index:52!important;
    top:10px!important;
    left:8px!important;
    width:min(380px,calc(100vw - 100dvh - 28px))!important;
    max-width:calc(100vw - 100dvh - 28px)!important;
    min-width:0!important;
    height:auto!important;
    min-height:0!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    background:transparent!important;
    box-shadow:none!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-topbar__actions {
    width:auto!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    background:transparent!important;
    box-shadow:none!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-layout>.puzzle-panel:first-child {
    position:absolute!important;
    z-index:46!important;
    top:68px!important;
    left:8px!important;
    width:min(380px,calc(100vw - 100dvh - 28px))!important;
    max-width:calc(100vw - 100dvh - 28px)!important;
    min-width:0!important;
    height:auto!important;
    min-height:0!important;
    max-height:none!important;
    margin:0!important;
    overflow:hidden!important;
  }
}

@media (orientation:landscape) and (max-width:1180px) {
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-topbar {
    top:8px!important;
    left:8px!important;
    width:calc(100vw - 100dvh - 24px)!important;
    max-width:calc(100vw - 100dvh - 24px)!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-layout>.puzzle-panel:first-child {
    top:58px!important;
    left:8px!important;
    width:calc(100vw - 100dvh - 24px)!important;
    max-width:calc(100vw - 100dvh - 24px)!important;
  }
}

@media (orientation:landscape) and (max-width:980px) and (max-height:520px) {
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-topbar {
    top:6px!important;
    left:8px!important;
    width:calc(100vw - 100dvh - 26px)!important;
    max-width:calc(100vw - 100dvh - 26px)!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-layout>.puzzle-panel:first-child {
    top:52px!important;
    left:8px!important;
    width:calc(100vw - 100dvh - 26px)!important;
    max-width:calc(100vw - 100dvh - 26px)!important;
  }
}
`;
  document.head.append(style);
}

setTimeout(ensureTrainingLayout,0);

export { ensureTrainingLayout };