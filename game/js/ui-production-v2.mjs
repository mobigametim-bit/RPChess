import { VerticalSlicePresenter } from './vertical-slice-presenter.mjs';

function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]); }
function after(methodName, enhance) {
  const original = VerticalSlicePresenter.prototype[methodName];
  if (typeof original !== 'function') return;
  VerticalSlicePresenter.prototype[methodName] = function approvedProductionVariant(snapshot) {
    original.call(this, snapshot);
    enhance.call(this, snapshot);
  };
}

after('renderRewardChoice', function preserveRewardBonus(snapshot) {
  if (snapshot.politicalFinaleB14?.stage === 'act_reward') return;
  for (const offer of snapshot.stageB?.rewardOffers || []) {
    if (!offer.bonus) continue;
    const button = this.root.querySelector(`[data-reward-offer="${CSS.escape(offer.id)}"]`);
    const card = button?.closest('.rpu-reward-choice-card');
    if (!card || card.querySelector('.rpu-reward-bonus')) continue;
    const bonus = this.root.ownerDocument.createElement('div');
    bonus.className = 'rpu-reward-bonus';
    bonus.textContent = `ДОПОЛНИТЕЛЬНАЯ ЦЕЛЬ: +${Number(offer.bonus.amount)} ${offer.bonus.type === 'gold' ? 'ЗОЛОТА' : 'ПРИПАС'}`;
    button.before(bonus);
  }
});

after('renderService', function preserveServiceVariants(snapshot) {
  const service = snapshot.stageB?.service;
  if (!service) return;
  const relics = snapshot.stageB?.relicInventory || [];
  for (const offer of service.offers || []) {
    let button = this.root.querySelector(`[data-service-offer="${CSS.escape(offer.id)}"]`);
    const card = button?.closest('.rpu-service-card');
    if (!button || !card) continue;
    const action = offer.action || '';
    const requiresRoster = ['piece_upgrade','heal_light_one','heal_hero_heavy','emergency_operation','remove_relic','reforge_relic','camp_heal_light'].includes(action);
    const requiresRelic = ['upgrade_relic','remove_relic','reforge_relic'].includes(action);
    const rosterLabel = card.querySelector(`label:has([data-service-target="${CSS.escape(offer.id)}"])`);
    if (!requiresRoster) rosterLabel?.remove();
    let relicSelect = card.querySelector(`[data-service-relic="${CSS.escape(offer.id)}"]`);
    if (requiresRelic && !relicSelect) {
      const label = this.root.ownerDocument.createElement('label');
      label.innerHTML = `<span>РЕЛИКВИЯ</span><select data-service-relic="${escapeHtml(offer.id)}">${relics.length ? relics.map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`).join('') : '<option value="">НЕТ ДОСТУПНОЙ РЕЛИКВИИ</option>'}</select>`;
      button.before(label);
      relicSelect = label.querySelector('select');
    }
    const clone = button.cloneNode(true);
    const unavailable = Boolean(offer.used || offer.affordable === false || (requiresRelic && !relics.length));
    clone.disabled = unavailable;
    clone.textContent = offer.used ? 'УЖЕ ИСПОЛЬЗОВАНО' : offer.affordable === false ? 'НЕДОСТАТОЧНО ЗОЛОТА' : Number(offer.cost || 0) === 0 ? 'ВЫБРАТЬ' : `КУПИТЬ · ОСТАНЕТСЯ ${Number(offer.remainingGold ?? snapshot.resources.gold - offer.cost)} ЗОЛОТА`;
    button.replaceWith(clone);
    clone.addEventListener('click', () => {
      const targetRosterId = card.querySelector(`[data-service-target="${CSS.escape(offer.id)}"]`)?.value || null;
      const targetRelicId = card.querySelector(`[data-service-relic="${CSS.escape(offer.id)}"]`)?.value || null;
      this.client.dispatch({ type:'UseService', offerId:offer.id, targetRosterId, targetRelicId }).catch(() => {});
    });
  }
});

after('renderActOutcome', function cleanLegacyFinaleMeta(snapshot) {
  if (!snapshot.politicalFinaleB14) return;
  this.root.querySelectorAll('.b10-finale-meta').forEach((node) => node.remove());
});

export { after };
