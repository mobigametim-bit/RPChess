const PIECE_NAMES=Object.freeze({p:'Пешка',n:'Конь',b:'Слон',r:'Ладья',q:'Ферзь',k:'Король'});
function technicalPieceName(value){
  const raw=String(value||'').trim();
  if(!/^stage_b_/i.test(raw))return null;
  const tail=raw.match(/(?:-|_)([pnbrqk])$/i)?.[1]?.toLowerCase()||raw.match(/(?:pawn|knight|bishop|rook|queen|king)/i)?.[0]?.toLowerCase();
  const type=tail==='pawn'?'p':tail==='knight'?'n':tail==='bishop'?'b':tail==='rook'?'r':tail==='queen'?'q':tail==='king'?'k':tail;
  return PIECE_NAMES[type]||'Фигура';
}
function sanitizeRuntimeLabels(root=document){
  if(!root?.querySelectorAll)return 0;
  let changed=0;
  root.querySelectorAll('.rpu-brief-intel strong').forEach(node=>{
    const value=node.textContent.trim();
    if(/environment-registry|^rpchess[-_.]/i.test(value)){
      const next='ОБЪЕКТЫ ОКРУЖЕНИЯ';
      if(value!==next){node.textContent=next;changed+=1;}
    }
  });
  root.querySelectorAll('.rpu-deploy-unit strong,.rpu-battle-reserve strong').forEach(node=>{
    const next=technicalPieceName(node.textContent);
    if(next&&node.textContent!==next){node.textContent=next;changed+=1;}
  });
  return changed;
}
function installRuntimeLabelSanitizer(){
  const app=document.getElementById('app');if(!app)return null;
  let scheduled=false;
  const apply=()=>{scheduled=false;sanitizeRuntimeLabels(app);};
  const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(apply);};
  apply();
  const observer=new MutationObserver(schedule);
  observer.observe(app,{childList:true,subtree:true});
  return Object.freeze({observer,apply,destroy:()=>observer.disconnect()});
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installRuntimeLabelSanitizer,{once:true});
  else installRuntimeLabelSanitizer();
}
export{PIECE_NAMES,technicalPieceName,sanitizeRuntimeLabels,installRuntimeLabelSanitizer};
