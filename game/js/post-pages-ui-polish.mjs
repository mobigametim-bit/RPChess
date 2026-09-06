const GOLD_ICON='generated_assets/reward_gold.png';
const SUPPLIES_ICON='generated_assets/node_shop.png';
const STYLE_MARKER='data-post-pages-ui-polish-style';
const RUN_KEY='rpchess.reboot.v1.run';

function visible(node){return Boolean(node&&!node.hidden);}
function run(){try{return JSON.parse(localStorage.getItem(RUN_KEY)||'null');}catch{return null;}}
function img(src,className=''){const node=document.createElement('img');node.src=src;node.alt='';node.draggable=false;if(className)node.className=className;node.setAttribute('aria-hidden','true');return node;}
function numberFrom(value){const match=String(value||'').match(/-?\d+/);return match?Number(match[0]):0;}

function ensureStyle(){
  if(document.querySelector(`[${STYLE_MARKER}]`))return;
  const style=document.createElement('style');style.setAttribute(STYLE_MARKER,'');style.textContent=`
/* Post GitHub-Pages playtest polish: accepted 10-point UI correction pass. */
@media (orientation:landscape) {
  /* 3. Training: one concise information frame, separated from the board. */
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-heading{display:none!important}
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-layout>.puzzle-panel:first-child{
    margin:8px 10px 8px 8px!important;
    padding:clamp(12px,1.4vw,20px)!important;
    border:1px solid rgba(216,177,93,.34)!important;
    border-radius:4px!important;
    box-shadow:0 12px 34px rgba(0,0,0,.34)!important;
    background:rgba(4,8,13,.91)!important;
    overflow:auto!important;
  }
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-layout>.puzzle-panel:first-child>h2,
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-reward{display:none!important}
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-polish-objective{
    display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;
    padding-bottom:9px!important;margin-bottom:10px!important;border-bottom:1px solid rgba(216,177,93,.25)!important
  }
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-polish-objective strong{
    color:#f3dfa6!important;font:400 clamp(24px,3.2vw,42px)/1 'BrahmsGotischCyr',Georgia,serif!important
  }
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-polish-objective span{color:#e8bd5f!important;font-size:clamp(14px,1.5vw,22px)!important;white-space:nowrap!important}
  html[data-landscape-ui='1'] body.puzzles-active [data-puzzle-instruction]{margin:0 0 12px!important;font-size:clamp(12px,1.1vw,16px)!important;line-height:1.35!important}
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-attempts{margin:0 0 12px!important}
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-polish-reward{display:flex!important;align-items:center!important;gap:8px!important;color:#f1cf75!important;font-weight:800!important;font-size:clamp(16px,1.6vw,23px)!important}
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-polish-reward img{width:1.45em!important;height:1.45em!important;object-fit:contain!important}

  /* 5 + 7. Run combat information keeps the desktop panel structure at every landscape size. */
  html[data-landscape-ui='1'] body.run-combat-board-active .classic-topbar{
    background:transparent!important;border:0!important;box-shadow:none!important;padding:8px 10px!important
  }
  html[data-landscape-ui='1'] body.run-combat-board-active .classic-party-panel{
    margin:0 10px 8px 8px!important;padding:clamp(12px,1.2vw,18px)!important;
    border:1px solid rgba(216,177,93,.28)!important;border-radius:3px!important;
    background:rgba(4,8,13,.92)!important;box-shadow:0 12px 34px rgba(0,0,0,.32)!important;
    overflow:auto!important
  }
  html[data-landscape-ui='1'] body.run-combat-board-active .classic-party-panel .classic-panel--moves{
    display:block!important;position:relative!important;width:100%!important;height:auto!important;min-height:0!important;
    margin:12px 0 0!important;padding:10px 0 0!important;border:0!important;border-top:1px solid rgba(216,177,93,.20)!important;
    border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important
  }
  html[data-landscape-ui='1'] body.run-combat-board-active .classic-party-panel .classic-moves{max-height:22dvh!important;overflow:auto!important}

  /* 6. Hiring cost is always gold icon then amount. */
  html[data-landscape-ui='1'] body.battle-prep-compact-active .battle-mercenary-quote__row--cost strong,
  html[data-landscape-ui='1'] .battle-mercenary-quote__row--cost strong{display:inline-flex!important;align-items:center!important;gap:6px!important}
  html[data-landscape-ui='1'] .battle-mercenary-quote__row--cost .resource-inline-icon{order:-1!important}

  /* 10. Final run summary has no floating Gold/Supplies frames. */
  html[data-landscape-ui='1'] body.endless-run-active .resource-hud{display:none!important}
}

@media (orientation:landscape) and (max-width:1180px) {
  /* 2. Travel command bar: Week | portrait | Power/Threat | Gold | Supplies | Roster | Settings. */
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-topbar--command{
    min-height:48px!important;height:48px!important;padding:4px 7px!important;margin:0!important;
    display:flex!important;align-items:center!important;gap:7px!important;overflow:hidden!important;box-sizing:border-box!important
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-heading{flex:0 0 auto!important;min-width:0!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-heading h1{margin:0!important;font-size:clamp(16px,2.3vw,24px)!important;line-height:1!important;white-space:nowrap!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-commandbar{
    flex:1 1 auto!important;min-width:0!important;display:grid!important;
    grid-template-columns:38px minmax(92px,auto) auto auto!important;align-items:center!important;gap:6px!important
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-run-portrait{
    width:36px!important;height:36px!important;border-radius:4px!important;object-fit:cover!important;border:1px solid rgba(216,177,93,.5)!important
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-player-rating{display:flex!important;align-items:center!important;gap:5px!important;min-width:0!important;padding:0!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-player-rating__row{display:flex!important;align-items:center!important;gap:3px!important;white-space:nowrap!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-player-rating__row span{font-size:7px!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-player-rating__row strong{font-size:10px!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-inline-resources{display:flex!important;gap:4px!important;min-width:0!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-inline-resource{min-width:0!important;padding:2px 4px!important;gap:3px!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-inline-resource__icon{width:20px!important;height:20px!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-inline-resource strong{font-size:10px!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-topbar__actions{display:flex!important;gap:4px!important;justify-content:flex-end!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-topbar__actions .reboot-button{min-width:0!important;min-height:30px!important;padding:3px 7px!important;font-size:9px!important;white-space:nowrap!important}
  html[data-landscape-ui='1'] body.travel-choice-active .travel-choice-card__difficulty small{display:none!important}

  /* 8. Settlement tablet/mobile share one compact composition. */
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
    transform:none!important;background:rgba(5,10,16,.95)!important;border:1px solid rgba(216,177,93,.42)!important;border-radius:50%!important
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
  html[data-landscape-ui='1'] body.settlement-active .settlement-supply-card{display:grid!important;grid-template-columns:1fr!important;gap:5px!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-supply-card__compact{display:flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;font-size:11px!important;white-space:nowrap!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-supply-card__compact img{width:21px!important;height:21px!important;object-fit:contain!important}
  html[data-landscape-ui='1'] body.settlement-active .settlement-supply-card [data-settlement-buy-supply]{width:100%!important;min-height:28px!important;padding:3px 7px!important;font-size:9px!important}

  /* 9. Starvation panel starts below the resource HUD. */
  html[data-landscape-ui='1'] body.starvation-active .starvation-screen{padding-top:50px!important;box-sizing:border-box!important}
  html[data-landscape-ui='1'] body.starvation-active .starvation-panel{max-height:calc(100dvh - 58px)!important;margin-top:0!important;overflow:auto!important}
}

@media (orientation:landscape) and (max-width:980px) and (max-height:520px) {
  /* 1. Roster cards are vertically centered in the mobile catalog area. */
  html[data-landscape-ui='1'] body.roster-active #app .roster-grid{align-content:center!important;align-items:center!important}
  html[data-landscape-ui='1'] body.roster-active #app .roster-card{align-self:center!important}
  html[data-landscape-ui='1'] body.roster-active #app .roster-card__art-wrap{display:grid!important;place-items:center!important}
  html[data-landscape-ui='1'] body.roster-active #app .roster-card__art{align-self:center!important;justify-self:center!important;object-position:center center!important}

  /* 2. Mobile Travel uses the same three-column card treatment as tablet. */
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-shell{grid-template-rows:48px minmax(0,1fr)!important;gap:5px!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-routes{
    display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-template-rows:minmax(0,1fr)!important;
    gap:6px!important;overflow:hidden!important
  }
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-card{height:100%!important;min-height:0!important;display:grid!important;grid-template-rows:minmax(0,1fr) auto!important;overflow:hidden!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-card__visual{width:100%!important;height:auto!important;min-height:0!important;position:relative!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-card__icon{left:50%!important;top:38%!important;width:54px!important;height:54px!important;transform:translate(-50%,-50%)!important;opacity:.95!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-card__overlay{left:7px!important;right:7px!important;top:auto!important;bottom:6px!important;width:auto!important;height:auto!important;padding:0!important;display:block!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-card__type{font-size:15px!important;line-height:1!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-card__threat,
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-card__safe,
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-card__meta{margin-top:3px!important;gap:3px!important;font-size:8px!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-card__body{padding:4px 6px 5px!important;min-height:0!important}
  html[data-landscape-ui='1'] body.travel-choice-active #app .travel-choice-card__flavor{font-size:7px!important;line-height:1.1!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important}

  /* 4. Mobile Skirmish prep keeps the full 2x8 formation preview visible. */
  html[data-landscape-ui='1'] body.skirmish-active .skirmish-selection{display:grid!important;grid-template-rows:auto minmax(72px,.75fr) auto!important;min-height:0!important;overflow:hidden!important}
  html[data-landscape-ui='1'] body.skirmish-active .skirmish-selected{height:auto!important;min-height:0!important;max-height:92px!important;overflow:auto!important}
  html[data-landscape-ui='1'] body.skirmish-active .skirmish-formation-block{margin-top:4px!important;padding-top:4px!important;min-height:64px!important;overflow:visible!important}
  html[data-landscape-ui='1'] body.skirmish-active .skirmish-formation-head{margin-bottom:2px!important;font-size:7px!important}
  html[data-landscape-ui='1'] body.skirmish-active .skirmish-formation{height:46px!important;min-height:46px!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;grid-template-rows:repeat(2,minmax(0,1fr))!important;gap:1px!important;overflow:visible!important}
  html[data-landscape-ui='1'] body.skirmish-active .skirmish-formation-cell{min-height:0!important;height:auto!important;font-size:10px!important;line-height:1!important}

  /* Compact puzzle copy without sacrificing the board. */
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-layout>.puzzle-panel:first-child{margin:5px 7px 5px 5px!important;padding:8px 9px!important}
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-polish-objective{padding-bottom:5px!important;margin-bottom:6px!important}
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-polish-objective strong{font-size:20px!important}
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-polish-objective span{font-size:11px!important}
  html[data-landscape-ui='1'] body.puzzles-active [data-puzzle-instruction]{font-size:8px!important;line-height:1.18!important;margin-bottom:7px!important}
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-attempts{margin-bottom:7px!important}
  html[data-landscape-ui='1'] body.puzzles-active .puzzle-polish-reward{font-size:12px!important}

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

function syncTravel(){
  const screen=document.querySelector('[data-travel-choice-screen]');if(!visible(screen))return;
  const command=screen.querySelector('[data-travel-commandbar]');
  if(command){
    let portrait=command.querySelector('[data-travel-run-portrait]');
    if(!portrait){portrait=document.createElement('img');portrait.className='travel-choice-run-portrait';portrait.dataset.travelRunPortrait='';command.prepend(portrait);}
    const current=globalThis.RPChessTravelChoice?.run||run();
    const king=current?.roster?.find((character)=>character?.isRunKing)||current?.roster?.find((character)=>character?.pieceType==='king');
    portrait.src=king?.portrait||'assets/kings/oathkeeper/portrait.png';portrait.alt=king?.name||'Король';
  }
}

function syncPuzzle(){
  const screen=document.querySelector('[data-puzzle-screen]');if(!visible(screen))return;
  const panel=screen.querySelector('.puzzle-layout>.puzzle-panel:first-child');if(!panel)return;
  let head=panel.querySelector('.puzzle-polish-objective');
  if(!head){head=document.createElement('div');head.className='puzzle-polish-objective';head.innerHTML='<strong></strong><span></span>';panel.prepend(head);}
  head.querySelector('strong').textContent=screen.querySelector('[data-puzzle-objective]')?.textContent?.trim()||'';
  head.querySelector('span').textContent=screen.querySelector('[data-puzzle-stars]')?.textContent?.trim()||'';
  const instruction=screen.querySelector('[data-puzzle-instruction]');
  if(instruction)instruction.textContent=instruction.textContent.replace(/\s*У вас три попытки\.?\s*$/i,'').replace(/\s*You have three attempts\.?\s*$/i,'').trim();
  let reward=panel.querySelector('.puzzle-polish-reward');
  if(!reward){reward=document.createElement('div');reward.className='puzzle-polish-reward';reward.append(img(GOLD_ICON),document.createElement('strong'));panel.append(reward);}
  const current=screen.querySelector('[data-puzzle-current-reward]');
  reward.querySelector('strong').textContent=String(numberFrom(current?.textContent));
}

const classic=document.querySelector('[data-classic-screen]');
const moves=classic?.querySelector('.classic-panel--moves')||null;
const movesHome=moves?.parentElement||null;
const movesNext=moves?.nextSibling||null;
function restore(node,home,next){if(!node||!home||node.parentElement===home)return;home.insertBefore(node,next?.parentNode===home?next:null);}
function syncCombat(){
  const active=visible(classic)&&Boolean(globalThis.RPChessBattle?.battlePlan||globalThis.RPChessSkirmish?.battlePlan);
  if(!moves)return;
  if(active){const party=classic.querySelector('.classic-party-panel');if(party&&moves.parentElement!==party)party.append(moves);}
  else restore(moves,movesHome,movesNext);
}

function syncBattleCost(){
  for(const strong of document.querySelectorAll('.battle-mercenary-quote__row--cost strong')){
    const value=numberFrom(strong.textContent);if(strong.querySelector('.post-pages-gold-icon'))continue;
    strong.replaceChildren(img(GOLD_ICON,'post-pages-gold-icon'),document.createTextNode(String(value)));
  }
}

function syncSettlement(){
  const screen=document.querySelector('[data-settlement-screen]');if(!visible(screen))return;
  const card=screen.querySelector('[data-settlement-supply-card]');if(!card)return;
  const stock=numberFrom(card.querySelector('[data-settlement-supply-stock]')?.textContent||card.textContent);
  const price=numberFrom(card.querySelector('.settlement-price')?.textContent||'0');
  const existingButton=card.querySelector('[data-settlement-buy-supply]');
  if(!existingButton)return;
  const disabled=existingButton.disabled,label=existingButton.textContent;
  card.replaceChildren();
  const row=document.createElement('div');row.className='settlement-supply-card__compact';
  const supplyImg=img(SUPPLIES_ICON),stockText=document.createElement('strong');stockText.dataset.settlementSupplyStock='';stockText.textContent=`${stock}/4`;
  const separator=document.createElement('span');separator.textContent='за';
  const goldImg=img(GOLD_ICON),priceText=document.createElement('strong');priceText.textContent=String(price);
  row.append(supplyImg,stockText,separator,goldImg,priceText);
  const button=document.createElement('button');button.type='button';button.className='reboot-button reboot-button--primary';button.dataset.settlementBuySupply='';button.disabled=disabled;button.textContent=label||'Купить';
  card.append(row,button);
}

let queued=false;
function refresh(){queued=false;syncTravel();syncPuzzle();syncCombat();syncBattleCost();syncSettlement();}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(refresh);}

for(const name of ['rpchess:travel-open','rpchess:puzzle-open','rpchess:skirmish-open','rpchess:battle-open','rpchess:settlement-open','rpchess:run-updated','rpchess:resources-updated'])addEventListener(name,()=>queueMicrotask(schedule));
document.addEventListener('click',()=>queueMicrotask(schedule),true);
addEventListener('resize',schedule,{passive:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
setTimeout(()=>{ensureStyle();schedule();},0);

globalThis.RPChessPostPagesUIPolish=Object.freeze({refresh:schedule});
