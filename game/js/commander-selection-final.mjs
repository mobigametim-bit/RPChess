function setText(node,value){if(node&&node.textContent!==value)node.textContent=value;}
function syncCommanderPreview(screen){
  const selected=screen.querySelector('.rpa-commander[aria-pressed="true"]');
  const preview=screen.querySelector('.rpa-launch');
  if(!selected||!preview)return;
  setText(preview.querySelector('.rpa-eyebrow'),'ВЫБРАННЫЙ КОМАНДИР');
  const hero=preview.querySelector('[data-preview-hero]');
  const description=selected.querySelector('.rpa-commander__copy p')?.textContent?.trim()||'';
  let copy=preview.querySelector('.rpu-commander-preview-description');
  if(!copy){copy=document.createElement('p');copy.className='rpu-commander-preview-description';hero?.after(copy);}
  setText(copy,description);
}
function applyCommanderFinal(root=document){
  const screen=root.querySelector?.('.is-approved-commander-selection');
  if(!screen)return 0;
  setText(screen.querySelector('.rpa-screen-header h1'),'Выберите командира');
  setText(screen.querySelector('.rpa-screen-header p'),'Командир задаёт стартовый стиль похода. Остальные открываются через решения, победы и находки.');
  const header=screen.querySelector('.rpa-screen-header');
  if(header&&!header.querySelector('.rpu-commander-version')){
    const version=document.createElement('span');version.className='rpu-commander-version';version.textContent='v1.3.9';header.append(version);
  }
  [...screen.querySelectorAll('.rpa-commander')].forEach(card=>{
    const hero=card.querySelector('.rpa-commander__hero');
    if(hero){
      const cached=hero.dataset.finalHeroName;
      const parsed=(cached||hero.textContent.replace(/^Именной герой:\s*/i,'').replace(/^ИМЕННОЙ ГЕРОЙ\s*·\s*/i,'').trim());
      if(!cached)hero.dataset.finalHeroName=parsed;
      setText(hero,`ИМЕННОЙ ГЕРОЙ · ${parsed}`);
    }
    const lock=card.querySelector('.rpa-lock');
    if(lock&&!lock.dataset.finalLock){
      const full=lock.textContent.trim();
      const match=full.match(/Нужно открытий:\s*(\d+)/i);
      if(match){lock.dataset.finalLock='true';lock.title=full;lock.setAttribute('aria-label',full);setText(lock,match[1]);}
    }
  });
  syncCommanderPreview(screen);
  return screen.querySelectorAll('.rpa-commander').length;
}
function install(){
  const app=document.getElementById('app');if(!app)return null;
  let scheduled=false;
  const apply=()=>{scheduled=false;applyCommanderFinal(app);};
  const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(apply);};
  apply();
  const observer=new MutationObserver(schedule);
  observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-pressed']});
  app.addEventListener('click',event=>{if(event.target.closest?.('.rpa-commander'))schedule();});
  return observer;
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();}
export{applyCommanderFinal,syncCommanderPreview,install};
