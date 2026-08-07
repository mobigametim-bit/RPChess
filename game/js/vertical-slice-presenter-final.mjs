import { VerticalSlicePresenter as ApprovedVerticalSlicePresenter } from './vertical-slice-presenter-approved.mjs';
import { sceneArt as approvedSceneArt } from './approved-shell-data.mjs';
import { renderCampaignApproved, renderBriefingApproved } from './ui-approved-campaign.mjs';
import { renderDeploymentApproved } from './ui-approved-deployment.mjs';
import { renderScenarioApproved } from './ui-approved-battle.mjs';

function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]); }
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }

class VerticalSlicePresenter extends ApprovedVerticalSlicePresenter {
  renderCampaign(snapshot) { return renderCampaignApproved(this, snapshot); }
  renderBriefing(snapshot) { return renderBriefingApproved(this, snapshot); }
  renderDeployment(snapshot) { return renderDeploymentApproved(this, snapshot); }
  renderScenario(snapshot) { return renderScenarioApproved(this, snapshot); }

  renderReward(snapshot) {
    const reward = snapshot.reward;
    const resources = [
      ['reward_gold.png', reward.gold, 'ЗОЛОТО'],
      ['reward_heal.png', reward.supplies, 'ПРИПАСЫ'],
      ['reward_meta.png', reward.meta, 'НАСЛЕДИЕ']
    ];
    const main = `<section class="rpu-base-reward" style="background-image:linear-gradient(90deg,rgba(3,8,15,.88),rgba(3,8,15,.42)),url('${escapeAttribute(approvedSceneArt('reward'))}')"><div class="rpu-base-reward__copy"><span class="rpu-kicker">ПОБЕДА</span><h1>${escapeHtml(reward.title || 'ТРОФЕИ ВАШИ')}</h1><p>Сражение завершено. Заберите ресурсы и продолжайте поход.</p><div class="rpu-base-reward__grid">${resources.map(([image,value,label]) => `<article><img src="generated_assets/${image}" alt=""><strong>${escapeHtml(value)}</strong><span>${label}</span></article>`).join('')}</div><button class="rpa-button rpa-button--primary" data-claim>ЗАБРАТЬ НАГРАДУ</button></div>${this.pendingEffect ? '<div class="rpvs__scene-vfx" data-scene-vfx></div>' : ''}</section>`;
    this.root.innerHTML = this.shell(snapshot, main);
    this.root.querySelector('[data-claim]')?.addEventListener('click', () => this.client.dispatch({ type:'ClaimReward' }).catch(() => {}));
    const effectElement = this.root.querySelector('[data-scene-vfx]');
    if (effectElement && this.pendingEffect) { const effect = this.pendingEffect; this.pendingEffect = null; this.animateSprite(effectElement,effect); }
  }
}

export { VerticalSlicePresenter };
