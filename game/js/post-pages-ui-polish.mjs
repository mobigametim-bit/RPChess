const STYLE_MARKER='data-post-pages-ui-polish-style';

function ensureStyle(){
  if(document.querySelector(`[${STYLE_MARKER}]`))return;
  const style=document.createElement('style');style.setAttribute(STYLE_MARKER,'');style.textContent=`
/* Post GitHub-Pages playtest polish: accepted UI corrections not yet folded into screen owners. */
@media (orientation:landscape) {
  /* Final run summary has no floating Gold/Supplies frames. */
  html[data-landscape-ui='1'] body.endless-run-active .resource-hud{display:none!important}
}

@media (orientation:landscape) and (max-width:1180px) {
  /* Settlement tablet/mobile share one compact composition. Market row rendering itself is
     owned by settlement-app + settlement.css; this layer only positions the surrounding frames. */
  html[data-landscape-ui='1'] body.settlement-active .settlement-screen{padding:6px 8px!important;overflow:hidden!important;box-sizing:border-box!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-shell{height:100%!important;display:grid!important;grid-template-rows:44px minmax(0,1fr)!important;gap:7px!important;overflow:visible!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-topbar{display:none!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-heading{grid-row:1!important;align-self:center!important;width:max-content!important;margin:0!important;padding:0!important;background:transparent!important;border:0!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-heading .reboot-eyebrow,
  html[data-landscape-ui='1'] body.settlement-active .settlement-heading p{display:none!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-heading h1{margin:0!important;font-size:clamp(22px,3vw,34px)!important;line-height:1!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-services{
    grid-row:2!important;height:100%!important;min-height:0!important;display:grid!important;
    grid-template-columns:minmax(0,1.58fr) minmax(250px,.92fr)!important;grid-template-rows:repeat(2,minmax(0,1fr))!important;
    gap:8px!important;overflow:visible!important
  }
  html[data-landscape-ui='1'] body.settlement-active .settlement-service{position:relative!important;min-height:0!important;padding:12px 10px 8px!important;overflow:visible!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-service:nth-child(1){grid-column:2!important;grid-row:1!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-service--tavern{grid-column:1!important;grid-row:1 / 3!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-service:nth-child(3){grid-column:2!important;grid-row:2!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-service__icon{
    position:absolute!important;z-index:5!important;top:-12px!important;right:9px!important;width:42px!important;height:42px!important;
    transform:none!important;background-color:rgba(5,10,16,.95)!important;border:1px solid rgba(216,177,93,.42)!important;border-radius:50%!important
  }
  html[data-landscape-ui='1'] body.settlement-active .settlement-service__intro{font-size:9px!important;line-height:1.15!important;margin:2px 0 5px!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-footer{position:fixed!important;z-index:95!important;top:7px!important;right:8px!important;width:auto!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-footer p{display:none!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-continue{min-height:32px!important;padding:4px 9px!important;font-size:9px!important}
  html[data-landscape-ui='1'] body.settlement-active .resource-hud{top:7px!important;left:50%!important;right:auto!important;transform:translateX(-50%)!important;gap:4px!important;width:auto!important}
  html[data-landscape-ui='1'] body.settlement-active .resource-chip{width:auto!important;min-height:30px!important;grid-template-columns:22px auto!important;padding:3px 6px!important;gap:3px!important}
  html[data-landscape-ui='1'] body.settlement-active .resource-chip span:not(.resource-chip__supply-icon){display:none!important}
  html[data-landscape-ui='1'] body.settlement-active .resource-chip img,
  html[data-landscape-ui='1'] body.settlement-active .resource-chip__supply-icon{width:21px!important;height:21px!important}
  html[data-landscape-ui='1'] body.settlement-active .resource-chip strong{font-size:11px!important}

  /* Starvation panel starts below the resource HUD. */
  html[data-landscape-ui='1'] body.starvation-active .starvation-screen{padding-top:50px!important;box-sizing:border-box!important}
  html[data-landscape-ui='1'] body.starvation-active .starvation-panel{max-height:calc(100dvh - 58px)!important;margin-top:0!important;overflow:auto!important}
}

@media (orientation:landscape) and (max-width:980px) and (max-height:520px) {
  /* Mobile Skirmish prep keeps the full 2x8 formation preview visible. */
  html[data-landscape-ui='1'] body.skirmish-active .skirmish-selection{display:grid!important;grid-template-rows:auto minmax(72px,.75fr) auto!important;min-height:0!important;overflow:hidden!important}
  html[data-landscape-ui='1'] body.skirmish-active .skirmish-selected{height:auto!important;min-height:0!important;max-height:92px!important;overflow:auto!important}
  html[data-landscape-ui='1'] body.skirmish-active .skirmish-formation-block{margin-top:4px!important;padding-top:4px!important;min-height:64px!important;overflow:visible!important}
  html[data-landscape-ui='1'] body.skirmish-active .skirmish-formation-head{margin-bottom:2px!important;font-size:7px!important}
  html[data-landscape-ui='1'] body.skirmish-active .skirmish-formation{height:46px!important;min-height:46px!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;grid-template-rows:repeat(2,minmax(0,1fr))!important;gap:1px!important;overflow:visible!important}
  html[data-landscape-ui='1'] body.skirmish-active .skirmish-formation-cell{min-height:0!important;height:auto!important;font-size:10px!important;line-height:1!important}

  /* Settlement service icons remain physically above their frames, same composition as tablet. */
  html[data-landscape-ui='1'] body.settlement-active .settlement-services{grid-template-columns:minmax(0,1.48fr) minmax(220px,.92fr)!important;gap:6px!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-service{padding:9px 7px 5px!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-service__icon{top:-9px!important;right:6px!important;width:34px!important;height:34px!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-service h2{font-size:14px!important;margin:0 0 2px!important;padding-right:31px!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-service .reboot-eyebrow{font-size:6px!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-service__intro{font-size:6.5px!important;line-height:1.08!important;margin:0 0 3px!important}
}
`;
  document.head.append(style);
}

ensureStyle();
globalThis.RPChessPostPagesUIPolish=Object.freeze({refresh:ensureStyle});
