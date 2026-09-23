import { artifactById } from './artifact-core.mjs';
import { recruitProfile } from './settlement-core.mjs';
import { t, translateLegacy } from './i18n.mjs';

export function caravanRewardText(reward, run) {
  const hero = recruitProfile(reward.heroId) || run.roster.find(c => c.id === reward.heroId);
  if (reward.kind === 'artifact') return `${t(artifactById(reward.artifactId).nameKey)} · ${t('artifacts.charges',{count:reward.amount})}`;
  return t(`caravan.reward.${reward.kind}`,{amount:reward.amount, name:translateLegacy(hero?.name || '')});
}
export function showCaravanRewards(run, onChoose) {
  document.querySelector('[data-caravan-rewards]')?.remove();
  if (!document.querySelector('[data-caravan-css]')) {
    const link=document.createElement('link');link.rel='stylesheet';link.href='css/caravan.css';link.dataset.caravanCss='';document.head.append(link);
  }
  const modal=document.createElement('div');modal.className='caravan-reward-modal';modal.dataset.caravanRewards='';
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','caravan-rewards-title');
  const panel=document.createElement('section');panel.className='caravan-reward-panel ui-panel-safe';
  const title=document.createElement('h2');title.id='caravan-rewards-title';title.textContent=t('caravan.rewardTitle');
  const hint=document.createElement('p');hint.textContent=t('caravan.rewardHint');
  const cards=document.createElement('div');cards.className='caravan-reward-grid';
  const error=document.createElement('p');error.hidden=true;error.setAttribute('role','alert');
  let busy=false;
  for(const reward of run.currentCaravan.offers){
    const button=document.createElement('button');button.type='button';button.className='caravan-reward-card';button.dataset.caravanReward=reward.id;
    const image=document.createElement('img');image.alt='';
    const hero=recruitProfile(reward.heroId)||run.roster.find(c=>c.id===reward.heroId);
    image.src=reward.kind==='gold'?'generated_assets/reward_gold.png':reward.kind==='supplies'?'generated_assets/reward_supplies.png':reward.kind==='artifact'?artifactById(reward.artifactId).icon:hero.portrait;
    const name=document.createElement('strong');name.textContent=caravanRewardText(reward,run);
    button.append(image,name);
    button.addEventListener('click',()=>{
      if(busy)return;busy=true;for(const b of cards.querySelectorAll('button'))b.disabled=true;
      try{if(!onChoose(reward.id))throw new Error('Reward rejected');modal.remove();document.querySelector('[data-battle-continue]')?.focus({preventScroll:true});}
      catch(e){console.error('[RPChess] Caravan reward',e);busy=false;error.textContent=t('caravan.rewardFailed');error.hidden=false;for(const b of cards.querySelectorAll('button'))b.disabled=false;}
    });cards.append(button);
  }
  modal.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const buttons=[...cards.querySelectorAll('button:not(:disabled)')];const i=buttons.indexOf(document.activeElement);event.preventDefault();buttons[(i+(event.shiftKey?buttons.length-1:1))%buttons.length]?.focus();});
  panel.append(title,hint,cards,error);modal.append(panel);document.body.append(modal);cards.querySelector('button')?.focus({preventScroll:true});
}
