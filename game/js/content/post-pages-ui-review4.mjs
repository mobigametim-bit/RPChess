const MARKER='data-post-pages-ui-review4';
const GOLD_ICON='generated_assets/reward_gold.png';
const SUPPLY_ICON='generated_assets/node_shop.png';

function visible(node){return Boolean(node&&!node.hidden);}
function numberFrom(value){const match=String(value||'').match(/-?\d+/);return match?Number(match[0]):0;}
function icon(src,className){const image=document.createElement('img');image.src=src;image.alt='';image.draggable=false;image.className=className;image.setAttribute('aria-hidden','true');return image;}

function syncMarketRow(){
  const screen=document.querySelector('[data-settlement-screen]');
  if(!visible(screen))return;
  const card=screen.querySelector('[data-settlement-supply-card]');
  if(!card)return;

  const existingButton=card.querySelector('[data-settlement-buy-supply]');
  if(!existingButton)return;
  const stock=numberFrom(card.querySelector('[data-settlement-supply-stock]')?.textContent||card.textContent);
  const priceNode=card.querySelector('.settlement-price')||card.querySelector('.settlement-supply-card__compact strong:last-child');
  const price=numberFrom(priceNode?.textContent||card.textContent);
  const disabled=existingButton.disabled;

  if(card.dataset.review4MarketRow==='1'&&card.dataset.review4Stock===String(stock)&&card.dataset.review4Price===String(price)&&card.querySelector('.settlement-market-row__product'))return;

  const product=document.createElement('div');
  product.className='settlement-market-row__product';
  const stockText=document.createElement('strong');
  stockText.dataset.settlementSupplyStock='';
  stockText.textContent=`${stock}/4`;
  const separator=document.createElement('span');
  separator.className='settlement-market-row__separator';
  separator.textContent='за';
  const priceText=document.createElement('strong');
  priceText.className='settlement-price settlement-market-row__price';
  priceText.textContent=String(price);
  product.append(icon(SUPPLY_ICON,'settlement-market-row__item-icon'),stockText,separator,icon(GOLD_ICON,'settlement-market-row__gold-icon'),priceText);

  const button=document.createElement('button');
  button.type='button';
  button.className='reboot-button reboot-button--primary';
  button.dataset.settlementBuySupply='';
  button.disabled=disabled;
  button.textContent=stock<=0?'Распродано':'Купить';

  card.replaceChildren(product,button);
  card.dataset.review4MarketRow='1';
  card.dataset.review4Stock=String(stock);
  card.dataset.review4Price=String(price);
}

function scheduleMarketRow(){
  requestAnimationFrame(()=>requestAnimationFrame(syncMarketRow));
}

function ensureStyle(){
  if(document.querySelector(`[${MARKER}]`))return;
  const style=document.createElement('style');
  style.setAttribute(MARKER,'');
  style.textContent=`
/* Third Human Acceptance follow-up. */
@media (orientation:landscape) {
  /* 3. Market: no explanatory paragraph; each offer is one horizontal product row. */
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-services>.settlement-service:nth-child(3) .settlement-service__intro {
    display:none!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-supply-card {
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    align-items:center!important;
    gap:10px!important;
    width:100%!important;
    min-width:0!important;
    margin:8px 0 0!important;
    text-align:left!important;
    box-sizing:border-box!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-market-row__product {
    display:flex!important;
    align-items:center!important;
    justify-content:flex-start!important;
    gap:7px!important;
    min-width:0!important;
    white-space:nowrap!important;
    color:#f0d28b!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-market-row__item-icon,
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-market-row__gold-icon {
    width:26px!important;
    height:26px!important;
    flex:0 0 26px!important;
    object-fit:contain!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-market-row__product strong {
    font-size:16px!important;
    line-height:1!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-market-row__separator {
    color:rgba(205,212,219,.74)!important;
    font-size:13px!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-supply-card>[data-settlement-buy-supply] {
    width:auto!important;
    min-width:132px!important;
    min-height:38px!important;
    margin:0!important;
    padding:5px 14px!important;
    font-size:15px!important;
    justify-self:end!important;
  }
}

@media (orientation:landscape) and (max-width:1180px) {
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-supply-card {
    gap:7px!important;
    margin-top:4px!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-market-row__item-icon,
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-market-row__gold-icon {
    width:21px!important;
    height:21px!important;
    flex-basis:21px!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-market-row__product strong {font-size:12px!important}
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-market-row__separator {font-size:10px!important}
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-supply-card>[data-settlement-buy-supply] {
    width:auto!important;
    min-width:94px!important;
    min-height:28px!important;
    padding:3px 8px!important;
    font-size:9px!important;
  }
}

@media (orientation:landscape) and (max-width:980px) and (max-height:520px) {
  /* 1. Training phone: anchor the information frame by its right edge so it can never
     touch the edge-to-edge board. Keep an explicit 10px visual gutter. */
  html[data-landscape-ui='1'] body.puzzles-active #app main.puzzle-screen .puzzle-layout>.puzzle-panel:first-child {
    left:8px!important;
    right:calc(100dvh + 10px)!important;
    width:auto!important;
    max-width:none!important;
    min-width:0!important;
    margin:0!important;
    box-sizing:border-box!important;
  }

  /* 2. Tavern phone: portraits are square. */
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-recruit {
    grid-template-rows:auto minmax(0,1fr)!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-recruit__portrait {
    width:100%!important;
    height:auto!important;
    aspect-ratio:1/1!important;
    object-fit:cover!important;
  }

  /* 3. Market phone keeps product and Buy on the same line. */
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-supply-card {
    grid-template-columns:minmax(0,1fr) auto!important;
    gap:5px!important;
    margin-top:2px!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-market-row__item-icon,
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-market-row__gold-icon {
    width:18px!important;
    height:18px!important;
    flex-basis:18px!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-market-row__product {
    gap:4px!important;
  }
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-market-row__product strong {font-size:10px!important}
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-market-row__separator {font-size:8px!important}
  html[data-landscape-ui='1'] body.settlement-active #app main.settlement-screen .settlement-supply-card>[data-settlement-buy-supply] {
    min-width:78px!important;
    min-height:26px!important;
    padding:2px 6px!important;
    font-size:8px!important;
  }
}
`;
  document.head.append(style);
}

for(const name of ['rpchess:settlement-open','rpchess:run-updated','rpchess:resources-updated']){
  addEventListener(name,scheduleMarketRow);
}
document.addEventListener('click',(event)=>{
  const target=event.target instanceof Element?event.target:null;
  if(target?.closest('[data-settlement-buy-supply]'))setTimeout(scheduleMarketRow,0);
},true);
addEventListener('resize',scheduleMarketRow,{passive:true});

setTimeout(()=>{
  ensureStyle();
  scheduleMarketRow();
},0);

export { ensureStyle, syncMarketRow };