import { applyCombatArtifactChoice, artifactForCombat, ownedArtifacts, FIRE_BY_THREAT } from './artifact-core.mjs';
import { countSquareAttackers, indexToSquare, squareToIndex } from './classic-chess-engine.mjs';

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
  modal.innerHTML=`<section class="artifact-choice-panel ui-panel-safe"><div class="reboot-eyebrow">ПЕРЕД СРАЖЕНИЕМ</div><h2 id="artifact-choice-title">Выберите артефакт</h2><p>Один заряд будет потрачен сразу. Эффект действует до конца этого боя.</p><div class="artifact-choice-grid"></div></section>`;
  const root=modal.querySelector('.artifact-choice-grid');
  for(const artifact of cards){ const button=document.createElement('button'); button.type='button'; button.className='artifact-choice-card'; button.dataset.artifactChoice=artifact?.id||'none'; if(artifact) button.innerHTML=`<img src="${artifact.icon}" alt=""><strong>${artifact.name}</strong><span>${artifact.description}</span><small>Зарядов: ${run.artifacts?.[artifact.id]||0}</small>`; else button.innerHTML='<span class="artifact-choice-card__empty" aria-hidden="true">—</span><strong>Без артефакта</strong><span>Начать бой без дополнительного эффекта.</span>';
    button.addEventListener('click',()=>{ const result=applyCombatArtifactChoice(run,{combatType,encounterId,artifactId:artifact?.id||null}); if(!result.success)return; modal.remove(); document.body.classList.remove('reboot-modal-open'); onChoose?.(result.run,artifact||null); }); root.append(button); }
  document.body.append(modal); document.body.classList.add('reboot-modal-open'); modal.querySelector('button')?.focus();
}
function renderThreatOverlay(board,snapshot,artifact,playerColor){
  if(!board) return;
  const mode=artifact?.mode||null,signature=`${mode||'none'}:${playerColor}:${snapshot?.fen||''}`;
  if(board.dataset.artifactThreatSignature===signature) return;
  board.dataset.artifactThreatSignature=signature;
  board.querySelectorAll('.classic-threat-fire').forEach((node)=>node.remove());
  if(!mode||!snapshot?.board) return;
  const enemyColor=playerColor==='w'?'b':'w';
  for(let index=0;index<snapshot.board.length;index+=1){ const piece=snapshot.board[index]; if(!piece)continue; const side=piece.color===playerColor?'player':'enemy'; if((mode==='player'&&side!=='player')||(mode==='enemy'&&side!=='enemy'))continue; const attackers=countSquareAttackers(snapshot,index,piece.color===playerColor?enemyColor:playerColor); if(!attackers)continue; const square=indexToSquare(index),cell=board.querySelector(`[data-square="${square}"]`); if(!cell)continue; const fire=document.createElement('img'); fire.className='classic-threat-fire'; fire.src=FIRE_BY_THREAT[Math.min(3,attackers)]; fire.alt=''; fire.dataset.attackers=String(attackers); cell.append(fire); }
}

export { chooseArtifact, renderThreatOverlay };
