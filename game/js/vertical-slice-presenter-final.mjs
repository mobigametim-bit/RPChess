import { VerticalSlicePresenter as ApprovedVerticalSlicePresenter } from './vertical-slice-presenter-approved.mjs';
import { sceneArt as approvedSceneArt } from './approved-shell-data.mjs';
import { renderCampaignApproved, renderBriefingApproved } from './ui-approved-campaign.mjs';
import { renderDeploymentApproved } from './ui-approved-deployment.mjs';
import { renderScenarioApproved } from './ui-approved-battle.mjs';

function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]); }
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function rosterLabel(entry) {
  if (entry.injury === 'heavy') return 'Тяжёлое ранение';
  if (entry.injury === 'light') return 'Лёгкое ранение';
  if (!entry.available) return 'Недоступна';
  return entry.active ? 'Активный состав' : 'Резерв';
}
function optionMarkup(entries) {
  return entries.map((entry) => `<option value="${escapeAttribute(entry.id)}">${escapeHtml(entry.name)} · ${escapeHtml(rosterLabel(entry))}</option>`).join('');
}

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

  renderService(snapshot) {
    super.renderService(snapshot);
    const service = snapshot.stageB?.service;
    if (!service) return;
    const roster = snapshot.stageB?.roster || [];
    const allRelics = [...new Set([...(snapshot.stageB?.relicInventory || []), ...roster.flatMap((entry) => entry.relicIds || [])])].sort();
    const used = new Set(service.usedOfferIds || []);
    const campConsumed = Boolean(service.oneActionOnly && used.size);

    const relevantTargets = (action) => {
      if (action === 'heal_light_one') return roster.filter((entry) => entry.injury === 'light');
      if (action === 'heal_hero_heavy' || action === 'emergency_operation') return roster.filter((entry) => entry.kind === 'hero' && entry.injury === 'heavy');
      if (action === 'camp_heal_light') return roster.filter((entry) => entry.kind === 'regular' && entry.injury === 'light');
      if (action === 'remove_relic' || action === 'reforge_relic') return roster.filter((entry) => (entry.relicIds || []).length);
      return roster;
    };
    const targetRequired = (action) => ['piece_upgrade','heal_light_one','heal_hero_heavy','emergency_operation','camp_heal_light','remove_relic','reforge_relic'].includes(action);
    const relicRequired = (action) => ['upgrade_relic','remove_relic','reforge_relic'].includes(action);

    for (const offer of service.offers || []) {
      const oldButton = this.root.querySelector(`[data-service-offer="${CSS.escape(offer.id)}"]`);
      if (!oldButton) continue;
      const card = oldButton.closest('.rpb-card');
      const figureSelect = card?.querySelector(`[data-service-target="${CSS.escape(offer.id)}"]`);
      const targets = relevantTargets(offer.action);
      if (figureSelect) {
        if (targetRequired(offer.action)) {
          figureSelect.innerHTML = optionMarkup(targets);
          figureSelect.closest('label')?.removeAttribute('hidden');
        } else {
          figureSelect.closest('label')?.setAttribute('hidden','');
        }
      }

      let relicSelect = null;
      if (relicRequired(offer.action) && card) {
        const label = this.root.ownerDocument.createElement('label');
        label.textContent = 'Реликвия';
        relicSelect = this.root.ownerDocument.createElement('select');
        relicSelect.className = 'rpb-target-select';
        relicSelect.dataset.serviceRelic = offer.id;
        label.appendChild(relicSelect);
        oldButton.before(label);
        const fillRelics = () => {
          const ids = offer.action === 'upgrade_relic'
            ? allRelics
            : (roster.find((entry) => entry.id === figureSelect?.value)?.relicIds || []);
          relicSelect.innerHTML = ids.map((id) => `<option value="${escapeAttribute(id)}">${escapeHtml(id.replace(/^relic\./,'').replaceAll('_',' '))}</option>`).join('');
          return ids;
        };
        fillRelics();
        figureSelect?.addEventListener('change', fillRelics);
      }

      const eligibleTargets = !targetRequired(offer.action) || targets.length > 0;
      const eligibleRelics = !relicRequired(offer.action) || (offer.action === 'upgrade_relic' ? allRelics.length > 0 : targets.some((entry) => (entry.relicIds || []).length > 0));
      const affordable = Number(snapshot.resources?.gold || 0) >= Number(offer.cost || 0);
      const available = affordable && !used.has(offer.id) && !campConsumed && eligibleTargets && eligibleRelics;
      const button = oldButton.cloneNode(true);
      button.disabled = !available;
      button.toggleAttribute('aria-disabled', !available);
      if (!available) {
        const reason = !affordable ? 'Недостаточно золота' : used.has(offer.id) || campConsumed ? 'Уже использовано в этом посещении' : !eligibleTargets ? 'Нет подходящей фигуры' : 'Нет подходящей реликвии';
        button.title = reason;
        card?.setAttribute('data-unavailable-reason', reason);
      }
      oldButton.replaceWith(button);
      button.addEventListener('click', () => {
        const targetRosterId = targetRequired(offer.action) ? (figureSelect?.value || null) : null;
        const targetRelicId = relicRequired(offer.action) ? (relicSelect?.value || null) : null;
        this.client.dispatch({ type:'UseService', offerId:offer.id, targetRosterId, targetRelicId }).catch(() => {});
      });
    }
  }

  renderReorganization(snapshot) {
    super.renderReorganization(snapshot);
    if (snapshot.politicalFinaleB14?.stage !== 'interact') return;
    const preview = snapshot.stageB?.reorganization?.interActConversionPreview || snapshot.interActPreview;
    if (!preview) return;
    const aside = this.root.querySelector('.rpu-interact-layout aside');
    const list = aside?.querySelector('dl');
    if (list) {
      list.innerHTML = `<div><dt>Осталось припасов</dt><dd>${escapeHtml(preview.convertedSupplies)}</dd></div><div><dt>Конвертация</dt><dd>${escapeHtml(preview.formula)} золота</dd></div><div><dt>Золото следующего акта</dt><dd>${escapeHtml(preview.nextGold)}</dd></div><div><dt>Припасы следующего акта</dt><dd>${escapeHtml(preview.nextSupplies)}</dd></div>`;
      list.setAttribute('data-interact-conversion', '');
    }
    const heading = aside?.querySelector('h2');
    if (heading) heading.textContent = 'ПЕРЕНОС МЕЖДУ АКТАМИ';
    const confirm = aside?.querySelector('[data-confirm-reorganization]');
    if (confirm) confirm.textContent = 'ПОДТВЕРДИТЬ И ПЕРЕЙТИ К СЛЕДУЮЩЕМУ АКТУ';
  }
}

export { VerticalSlicePresenter };