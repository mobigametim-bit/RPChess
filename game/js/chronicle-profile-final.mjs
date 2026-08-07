const ROMAN=['I','II','III'];
function applyChronicleFinal(root=document){
  const screen=root.querySelector?.('.rpprofile--approved-cards');
  if(!screen)return 0;
  const heading=screen.querySelector('.rpa-screen-header h1');
  const subtitle=screen.querySelector('.rpa-screen-header p');
  const back=screen.querySelector('.rpa-screen-header .rpa-button');
  if(heading)heading.textContent='Выберите хронику';
  if(subtitle)subtitle.textContent='Каждая хроника хранит отдельный поход, состав армии и принятые решения.';
  if(back)back.textContent='ГЛАВНОЕ МЕНЮ';
  const cards=[...screen.querySelectorAll('.rpa-profile-card--approved')];
  cards.forEach((card,index)=>{
    card.dataset.chronicleNumber=ROMAN[index]||String(index+1);
    const available=card.dataset.profilePrimary==='continue';
    card.classList.toggle('is-available',available);
    card.classList.toggle('is-empty',!available);
    if(!available){
      const copy=card.querySelector('.rpprofile__approved-content p');
      if(copy)copy.textContent='Начните отдельный поход и выберите нового командира.';
    }
  });
  return cards.length;
}
function install(){
  const app=document.getElementById('app');
  if(!app)return null;
  const apply=()=>applyChronicleFinal(app);
  apply();
  const observer=new MutationObserver(()=>queueMicrotask(apply));
  observer.observe(app,{childList:true,subtree:true});
  return observer;
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
}
export{applyChronicleFinal,install};
