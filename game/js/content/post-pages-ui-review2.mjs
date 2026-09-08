const MARKER='data-post-pages-ui-review2';

function ensureStyle(){
  if(document.querySelector(`[${MARKER}]`))return;
  const style=document.createElement('style');
  style.setAttribute(MARKER,'');
  style.textContent=`
/* Temporary run-combat presentation parity. The Journal stays in its stable Classic shell slot;
   this layer only makes Party + Journal read as one combined information frame. */
@media (orientation:landscape) {
  html[data-landscape-ui='1'] body.run-combat-board-active #app main.classic-screen .classic-topbar {
    background:transparent!important;
    border:0!important;
    box-shadow:none!important;
    padding:8px 10px!important;
  }
  html[data-landscape-ui='1'] body.run-combat-board-active #app main.classic-screen .classic-party-panel,
  html[data-landscape-ui='1'] body.run-combat-board-active #app main.classic-screen .classic-panel--moves {
    width:calc(100% - 18px)!important;
    max-width:calc(100% - 18px)!important;
    min-width:0!important;
    margin-left:8px!important;
    margin-right:10px!important;
    box-sizing:border-box!important;
    justify-self:start!important;
    transform:none!important;
    background:rgba(4,8,13,.92)!important;
  }
  html[data-landscape-ui='1'] body.run-combat-board-active #app main.classic-screen .classic-party-panel {
    margin-bottom:0!important;
    padding:clamp(12px,1.2vw,18px)!important;
    border:1px solid rgba(216,177,93,.28)!important;
    border-bottom:0!important;
    border-radius:3px 3px 0 0!important;
    box-shadow:0 12px 34px rgba(0,0,0,.32)!important;
    overflow:auto!important;
  }
  html[data-landscape-ui='1'] body.run-combat-board-active #app main.classic-screen .classic-panel--moves {
    margin-top:0!important;
    margin-bottom:8px!important;
    padding:9px clamp(12px,1.2vw,18px) 10px!important;
    border:1px solid rgba(216,177,93,.28)!important;
    border-top:1px solid rgba(216,177,93,.20)!important;
    border-radius:0 0 3px 3px!important;
    box-shadow:none!important;
    overflow:hidden!important;
  }
  html[data-landscape-ui='1'] body.run-combat-board-active #app main.classic-screen .classic-panel--moves .classic-moves {
    height:100%!important;
    max-height:none!important;
    overflow:auto!important;
  }
}

@media (orientation:landscape) and (max-width:980px) and (max-height:520px) {
  html[data-landscape-ui='1'] body.run-combat-board-active #app main.classic-screen .classic-party-panel {
    padding:10px 12px!important;
  }
  html[data-landscape-ui='1'] body.run-combat-board-active #app main.classic-screen .classic-panel--moves {
    padding:7px 12px 8px!important;
  }
}
`;
  document.head.append(style);
}

setTimeout(ensureStyle,0);

export { ensureStyle };
