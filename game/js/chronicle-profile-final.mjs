const ROMAN=['I','II','III'];
function setText(node,value){if(node&&node.textContent!==value)node.textContent=value;}
function applyChronicleFinal(root=document){
  const screen=root.querySelector?.('.rpprofile--approved-cards');
  if(!screen)return 0;
  setText(screen.querySelector('.rpa-screen-header h1'),'Выберите хронику');
  setText(screen.querySelector('.rpa-screen-header p'),'Каждая хроника хранит отдельный поход, состав армии и принятые решения.');
  setText(screen.querySelector('.rpa-screen-header .rpa-button'),'ГЛАВНОЕ МЕНЮ');
  const cards=[...screen.querySelectorAll('.rpa-profile-card--approved')];
  cards.forEach((card,index)=>{
    const number=ROMAN[index]||String(index+1);
    if(card.dataset.chronicleNumber!==number)card.dataset.chronicleNumber=number;
    const available=card.dataset.profilePrimary==='continue';
    card.classList.toggle('is-available',available);
    card.classList.toggle('is-empty',!available);
    if(!available)setText(card.querySelector('.rpprofile__approved-content p'),'Начните отдельный поход и выберите нового командира.');
  });
  return cards.length;
}
function install(){
  const app=document.getElementById('app');
  if(!app)return null;
  let scheduled=false;
  const apply=()=>{scheduled=false;applyChronicleFinal(app);};
  const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(apply);};
  apply();
  const observer=new MutationObserver(schedule);
  observer.observe(app,{childList:true,subtree:true});
  return observer;
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
}
export{applyChronicleFinal,install};
