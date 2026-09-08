const MARKER='data-post-pages-ui-polish-constraints';

function ensureConstraints(){
  if(document.querySelector(`[${MARKER}]`))return;
  const style=document.createElement('style');
  style.setAttribute(MARKER,'');
  style.textContent=`
@media (orientation:landscape) and (max-width:1180px) {
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-layout>.puzzle-panel:first-child {
    width:calc(100vw - 100dvh - 32px)!important;
    max-width:calc(100vw - 100dvh - 32px)!important;
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
