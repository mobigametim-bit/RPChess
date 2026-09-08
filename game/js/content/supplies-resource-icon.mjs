const SUPPLIES_ICON='generated_assets/reward_supplies.png';

function setSuppliesIcon(image){
  if(!(image instanceof HTMLImageElement))return;
  const current=image.getAttribute('src')||'';
  if(current===SUPPLIES_ICON||current.endsWith('/reward_supplies.png'))return;
  image.src=SUPPLIES_ICON;
}

function patchSuppliesIcons(root=document){
  if(!(root instanceof Document||root instanceof DocumentFragment||root instanceof Element))return;

  for(const image of root.querySelectorAll?.([
    '.resource-inline-icon--supplies',
    '.resource-chip__supply-image',
    '.settlement-market-row__item-icon',
    '.events-outcome-resource--supplies .events-outcome-resource__icon'
  ].join(','))||[])setSuppliesIcon(image);

  for(const amount of root.querySelectorAll?.('[data-travel-inline-supplies]')||[]){
    const holder=amount.parentElement;
    setSuppliesIcon(holder?.querySelector('img'));
  }

  for(const stock of root.querySelectorAll?.('[data-settlement-supply-stock]')||[]){
    const holder=stock.parentElement;
    setSuppliesIcon(holder?.querySelector('img'));
  }
}

let scheduled=false;
function schedulePatch(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    scheduled=false;
    patchSuppliesIcons(document);
  }));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedulePatch,{once:true});
else schedulePatch();

for(const name of [
  'rpchess:run-updated','rpchess:resources-updated','rpchess:run-continue',
  'rpchess:travel-rendered','rpchess:travel-open','rpchess:settlement-open',
  'rpchess:event-open','rpchess:starvation-open','rpchess:puzzle-open'
])addEventListener(name,schedulePatch);

document.addEventListener('click',(event)=>{
  const target=event.target instanceof Element?event.target:null;
  if(target?.closest('button,[data-travel-choice],[data-event-choice]'))schedulePatch();
},true);

globalThis.RPChessSuppliesIcon=Object.freeze({SUPPLIES_ICON,refresh:schedulePatch});

export { SUPPLIES_ICON, patchSuppliesIcons, schedulePatch };
