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
  html[data-landscape-ui='1'] body.run-combat-board-active .classic-party-panel {
    width:calc(100% - 18px)!important;
    max-width:calc(100% - 18px)!important;
    box-sizing:border-box!important;
    justify-self:start!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-layout>.puzzle-panel:first-child {
    width:calc(100% - 18px)!important;
    max-width:calc(100% - 18px)!important;
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
