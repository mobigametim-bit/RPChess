function syncCommanderPreview(screen){
  const selected=screen.querySelector('.rpa-commander[aria-pressed="true"]');
  const preview=screen.querySelector('.rpa-launch');
  if(!selected||!preview)return;
  const eyebrow=preview.querySelector('.rpa-eyebrow');
  if(eyebrow)eyebrow.textContent='ВЫБРАННЫЙ КОМАНДИР';
  const hero=preview.querySelector('[data-preview-hero]');
  const description=selected.querySelector('.rpa-commander__copy p')?.textContent?.trim()||'';
  let copy=preview.querySelector('.rpu-commander-preview-description');
  if(!copy){copy=document.createElement('p');copy.className='rpu-commander-preview-description';hero?.after(copy);}
  copy.textContent=description;
}
function applyCommanderFinal(root=document){
  const screen=root.querySelector?.('.is-approved-commander-selection');
  if(!screen)return 0;
  const heading=screen.querySelector('.rpa-screen-header h1');
  const subtitle=screen.querySelector('.rpa-screen-header p');
  if(heading)heading.textContent='Выберите командира';
  if(subtitle)subtitle.textContent='Командир задаёт стартовый стиль похода. Остальные открываются через решения, победы и находки.';
  const header=screen.querySelector('.rpa-screen-header');
  if(header&&!header.querySelector('.rpu-commander-version')){
    const version=document.createElement('span');version.className='rpu-commander-version';version.textContent='v1.3.9';header.append(version);
  }
  [...screen.querySelectorAll('.rpa-commander')].forEach(card=>{
    const hero=card.querySelector('.rpa-commander__hero');
    if(hero){const name=hero.textContent.replace(/^Именной герой:\s*/i,'').trim();hero.textContent=`ИМЕННОЙ ГЕРОЙ · ${name}`;}
    const lock=card.querySelector('.rpa-lock');
    if(lock){const full=lock.textContent.trim();const match=full.match(/Нужно открытий:\s*(\d+)/i);if(match){lock.title=full;lock.setAttribute('aria-label',full);lock.textContent=match[1];}}
  });
  syncCommanderPreview(screen);
  return screen.querySelectorAll('.rpa-commander').length;
}
function install(){
  const app=document.getElementById('app');if(!app)return null;
  const apply=()=>applyCommanderFinal(app);apply();
  const observer=new MutationObserver(()=>queueMicrotask(apply));observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-pressed']});
  app.addEventListener('click',event=>{if(event.target.closest?.('.rpa-commander'))queueMicrotask(()=>applyCommanderFinal(app));});
  return observer;
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();}
export{applyCommanderFinal,syncCommanderPreview,install};
