import { relicEffectRu } from './register-03-relic-copy-ru.mjs';

const PIECE_NAMES=Object.freeze({p:'Пешка',n:'Конь',b:'Слон',r:'Ладья',q:'Ферзь',k:'Король'});
function technicalPieceName(value){
  const raw=String(value||'').trim();
  if(!/^stage_b_/i.test(raw))return null;
  const tail=raw.match(/(?:-|_)([pnbrqk])$/i)?.[1]?.toLowerCase()||raw.match(/(?:pawn|knight|bishop|rook|queen|king)/i)?.[0]?.toLowerCase();
  const type=tail==='pawn'?'p':tail==='knight'?'n':tail==='bishop'?'b':tail==='rook'?'r':tail==='queen'?'q':tail==='king'?'k':tail;
  return PIECE_NAMES[type]||'Фигура';
}
function setText(node,value){if(node&&value!=null&&node.textContent!==value){node.textContent=value;return 1;}return 0;}
function relicSlugFromDetail(detail){
  const src=detail?.querySelector?.('.rpu-relic-detail__art')?.getAttribute('src')||'';
  return src.split('/').pop()?.replace(/\.png$/i,'')||null;
}
function sanitizeRelicCodex(root){
  const codex=root.querySelector?.('.rpu-relic-codex');
  if(!codex)return 0;
  let changed=0;
  const total=codex.querySelectorAll('[data-rpu-relic]').length||72;
  changed+=setText(codex.querySelector('.rpu-codex__header .rpu-kicker'),`РЕЛИКВИИ · ${total}`);
  const priority=codex.querySelector('[data-rpu-relic-priority]')?.closest('label');
  if(priority){priority.remove();changed+=1;}
  codex.querySelectorAll('.rpu-relic-list-card small').forEach(node=>{
    const next=node.textContent.replace(/^P[01]\s*·\s*/i,'');
    changed+=setText(node,next);
  });
  const detail=codex.querySelector('.rpu-relic-detail');
  if(detail){
    changed+=setText(detail.querySelector(':scope > .rpu-kicker'),'РЕЛИКВИЯ');
    const effect=detail.querySelector('section p');
    const translated=relicEffectRu(relicSlugFromDetail(detail));
    if(translated)changed+=setText(effect,translated);
  }
  return changed;
}
function sanitizeRuntimeLabels(root=document){
  if(!root?.querySelectorAll)return 0;
  let changed=0;
  root.querySelectorAll('.rpu-brief-intel strong').forEach(node=>{
    const value=node.textContent.trim();
    if(/environment-registry|^rpchess[-_.]/i.test(value)){
      const next='ОБЪЕКТЫ ОКРУЖЕНИЯ';
      changed+=setText(node,next);
    }
  });
  root.querySelectorAll('.rpu-deploy-unit strong,.rpu-battle-reserve strong').forEach(node=>{
    const next=technicalPieceName(node.textContent);
    if(next)changed+=setText(node,next);
  });
  changed+=sanitizeRelicCodex(root);
  return changed;
}
function installRuntimeLabelSanitizer(){
  const app=document.getElementById('app');if(!app)return null;
  let scheduled=false;
  const apply=()=>{scheduled=false;sanitizeRuntimeLabels(document);};
  const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(apply);};
  apply();
  const observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});
  return Object.freeze({observer,apply,destroy:()=>observer.disconnect()});
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installRuntimeLabelSanitizer,{once:true});
  else installRuntimeLabelSanitizer();
}
export{PIECE_NAMES,technicalPieceName,relicSlugFromDetail,sanitizeRelicCodex,sanitizeRuntimeLabels,installRuntimeLabelSanitizer};
