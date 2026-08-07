function percentForInput(input){
  const value=Number(input?.value||0);
  const max=Number(input?.max||1);
  if(input?.name==='uiScale')return`${Math.round(value*100)}%`;
  return`${Math.round(max?value/max*100:0)}%`;
}
function applySettingsFinal(root=document){
  const form=root.querySelector?.('.rpa-settings-grid');
  if(!form||form.dataset.finalSettings==='true')return form?1:0;
  form.dataset.finalSettings='true';
  const screen=form.closest('.rpa-subscreen');
  const doc=form.ownerDocument;
  const eyebrow=screen?.querySelector('.rpa-screen-header .rpa-eyebrow');
  if(eyebrow)eyebrow.textContent='ПАРАМЕТРЫ ИГРЫ';
  const copy=screen?.querySelector('.rpa-screen-header p');
  if(copy)copy.textContent='Изменения применяются ко всему интерфейсу и сохраняются в этом браузере.';
  const menu=screen?.querySelector('.rpa-screen-header [data-shell-action="menu"]');
  if(menu){menu.innerHTML='<img src="generated_assets/logo_main.png" alt="RPChess">';menu.setAttribute('aria-label','Главное меню');}
  const header=screen?.querySelector('.rpa-screen-header');
  if(header&&!header.querySelector('.rpu-settings-version')){const version=doc.createElement('span');version.className='rpu-settings-version';version.textContent='v1.3.9';header.append(version);}
  const settings=[...form.querySelectorAll('.rpa-setting')];
  const sound=doc.createElement('div');sound.className='rpu-settings-section-label';sound.textContent='ЗВУК';form.prepend(sound);
  const scale=settings.find(node=>node.querySelector('[name="uiScale"]'));
  if(scale){const section=doc.createElement('div');section.className='rpu-settings-section-label is-interface';section.textContent='ИНТЕРФЕЙС';scale.before(section);}
  form.querySelectorAll('input[type="range"]').forEach(input=>{
    const output=doc.createElement('output');output.className='rpu-setting-value';
    const update=()=>{output.textContent=percentForInput(input);};update();input.addEventListener('input',update);input.after(output);
  });
  const submit=form.querySelector('button[type="submit"]');
  if(submit){submit.textContent='СОХРАНИТЬ НАСТРОЙКИ';const note=doc.createElement('small');note.className='rpu-settings-note';note.textContent='Настройки применяются сразу после сохранения';submit.closest('.rpa-setting')?.append(note);}
  return 1;
}
function installSettingsFinal(){
  const app=document.getElementById('app');if(!app)return null;
  let scheduled=false;
  const apply=()=>{scheduled=false;applySettingsFinal(app);};
  const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(apply);};
  apply();
  const observer=new MutationObserver(schedule);observer.observe(app,{childList:true,subtree:true});
  return Object.freeze({observer,apply,destroy:()=>observer.disconnect()});
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installSettingsFinal,{once:true});else installSettingsFinal();}
export{percentForInput,applySettingsFinal,installSettingsFinal};
