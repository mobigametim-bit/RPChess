import { applyCombatArtifactChoice, artifactForCombat, ownedArtifacts, FIRE_BY_THREAT } from './artifact-core.mjs';
import { countSquareAttackers, indexToSquare } from './classic-chess-engine.mjs';
import { t } from './i18n.mjs';

function ensureCss(){
  if(document.querySelector('[data-artifact-combat-css]')) return;
  const link=document.createElement('link'); link.rel='stylesheet'; link.href='css/artifacts.css?v=20260917'; link.dataset.artifactCombatCss=''; document.head.append(link);
}
function chooseArtifact({run,combatType,encounterId,onChoose}={}){
  ensureCss();
  const existing=artifactForCombat(run,{combatType,encounterId});
  if(run?.combatArtifactChoice?.combatType===combatType&&run?.combatArtifactChoice?.encounterId===encounterId){ onChoose?.(run,existing); return; }
  document.querySelector('[data-artifact-choice-modal]')?.remove();
  const modal=document.createElement('div'); modal.className='artifact-choice-modal'; modal.dataset.artifactChoiceModal=''; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-labelledby','artifact-choice-title');
  const cards=[...ownedArtifacts(run).slice(0,3),null];
  modal.innerHTML=`<section class="artifact-choice-panel ui-panel-safe"><div class="reboot-eyebrow">${t('artifacts.choice.kicker')}</div><h2 id="artifact-choice-title">${t('artifacts.choice.title')}</h2><p>${t('artifacts.choice.description')}</p><div class="artifact-choice-grid"></div></section>`;
  const root=modal.querySelector('.artifact-choice-grid');
  for(const artifact of cards){ const button=document.createElement('button'); button.type='button'; button.className='artifact-choice-card'; button.dataset.artifactChoice=artifact?.id||'none'; if(artifact) button.innerHTML=`<img src="${artifact.icon}" alt=""><strong>${t(artifact.nameKey)}</strong><span>${t(artifact.descriptionKey)}</span><small>${t('artifacts.charges',{count:run.artifacts?.[artifact.id]||0})}</small>`; else button.innerHTML=`<span class="artifact-choice-card__empty" aria-hidden="true">—</span><strong>${t('artifacts.choice.none.name')}</strong><span>${t('artifacts.choice.none.description')}</span>`;
    button.addEventListener('click',()=>{ const result=applyCombatArtifactChoice(run,{combatType,encounterId,artifactId:artifact?.id||null}); if(!result.success)return; modal.remove(); document.body.classList.remove('reboot-modal-open'); onChoose?.(result.run,artifact||null); }); root.append(button); }
  document.body.append(modal); document.body.classList.add('reboot-modal-open'); modal.querySelector('button')?.focus();
}
function renderThreatOverlay(board,snapshot,artifact,playerColor){
  if(!board) return;
  const mode=artifact?.mode||null;
  const desired=new Map();
  const enemyColor=playerColor==='w'?'b':'w';
  if(mode&&snapshot?.board) for(let index=0;index<snapshot.board.length;index+=1){
    const piece=snapshot.board[index];
    if(!piece)continue;
    const side=piece.color===playerColor?'player':'enemy';
    if((mode==='player'&&side!=='player')||(mode==='enemy'&&side!=='enemy'))continue;
    const attackers=countSquareAttackers(snapshot,index,piece.color===playerColor?enemyColor:playerColor);
    if(attackers)desired.set(indexToSquare(index),attackers);
  }
  // The chess renderer replaces cells even when FEN is unchanged (selection/AI thinking).
  // Reconcile actual nodes, not a cached FEN. A second observer pass must make no mutations.
  for(const cell of board.querySelectorAll('[data-square]')){
    const attackers=desired.get(cell.dataset.square);
    const existing=[...cell.querySelectorAll('.classic-threat-fire')];
    let fire=existing.shift();
    existing.forEach(node=>node.remove());
    if(!attackers){fire?.remove();continue;}
    if(!fire){fire=document.createElement('img');fire.className='classic-threat-fire';fire.alt='';cell.append(fire);}
    const src=FIRE_BY_THREAT[Math.min(3,attackers)];
    if(fire.getAttribute('src')!==src)fire.setAttribute('src',src);
    if(fire.dataset.attackers!==String(attackers))fire.dataset.attackers=String(attackers);
  }
}

export { chooseArtifact, renderThreatOverlay };
