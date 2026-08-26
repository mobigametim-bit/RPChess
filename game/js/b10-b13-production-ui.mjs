import { VerticalSlicePresenter } from './vertical-slice-presenter.mjs';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;',"'":'&#39;','"':'&quot;' })[character]);
const FORCED_MARCH_LABELS = Object.freeze({
  gold_loss: 'Потерять золото',
  light_injury: 'Получить лёгкое ранение',
  next_battle_penalty: 'Штраф следующего боя',
  reward_choice_reduction: 'Сократить следующий выбор награды',
  scouting_lock: 'Запретить следующую разведку'
});
const BRANCH_LABELS = Object.freeze({ fortified:'укреплённая', direct:'прямая', resource:'ресурсная', volatile:'рискованная' });
const SECRET_LABELS = Object.freeze({ event:'Тайное событие', cache:'Скрытый тайник', battle:'Тайный бой', special_service:'Особая услуга', political_meeting:'Закрытая политическая встреча', recruit:'Тайный рекрут' });

function after(methodName, enhance) {
  const original = VerticalSlicePresenter.prototype[methodName];
  if (typeof original !== 'function') return;
  VerticalSlicePresenter.prototype[methodName] = function productionEnhanced(snapshot) {
    original.call(this, snapshot);
    enhance.call(this, snapshot);
  };
}

function addResourceStrip(root, snapshot, target) {
  if (!target || target.querySelector('.b10-resource-strip')) return;
  const strip = root.ownerDocument.createElement('div');
  strip.className = 'b10-resource-strip';
  strip.innerHTML = `<span>Золото <strong>${Number(snapshot.economy?.gold ?? snapshot.resources?.gold ?? 0)}</strong></span><span>Припасы <strong>${Number(snapshot.economy?.supplies ?? snapshot.resources?.supplies ?? 0)}</strong></span>`;
  target.appendChild(strip);
}

after('renderCampaign', function enhanceCampaign(snapshot) {
  const root = this.root;
  addResourceStrip(root, snapshot, root.querySelector('.rpvs__panel-head'));
  const routes = new Map((snapshot.campaign?.routes || []).map((route) => [route.to, route]));
  const approvedRoutePanel = Boolean(root.querySelector('.rpu-route-panel'));
  for (const [nodeId, route] of routes) {
    const card = root.querySelector(`[data-node-card="${CSS.escape(nodeId)}"]`);
    if (!card) continue;
    if (route.branchProfile || route.branchLength != null) {
      const meta = root.ownerDocument.createElement('div');
      meta.className = 'b10-route-meta';
      meta.textContent = `${route.branchProfile ? `Профиль: ${BRANCH_LABELS[route.branchProfile] || route.branchProfile}` : ''}${route.branchLength != null ? `${route.branchProfile ? ' · ' : ''}До схождения: ~${route.branchLength}` : ''}`;
      card.appendChild(meta);
    }
    if (!route.requiresForcedMarch || approvedRoutePanel) continue;
    const main = card.querySelector('[data-node-id]');
    if (main) {
      const clone = main.cloneNode(true);
      clone.disabled = true;
      clone.setAttribute('aria-disabled', 'true');
      main.replaceWith(clone);
    }
    const choices = route.forcedMarchChoices || [];
    const panel = root.ownerDocument.createElement('div');
    panel.className = 'b10-forced-march';
    panel.innerHTML = `<strong>Припасы закончились — выберите последствие</strong><select data-forced-choice="${escapeHtml(nodeId)}">${choices.map((choice) => `<option value="${escapeHtml(choice)}">${escapeHtml(FORCED_MARCH_LABELS[choice] || choice)}</option>`).join('')}</select><button class="rpvs__primary" data-forced-travel="${escapeHtml(nodeId)}" ${choices.length ? '' : 'disabled'}>Форсированный марш</button>`;
    card.appendChild(panel);
    panel.querySelector('[data-forced-travel]')?.addEventListener('click', () => {
      const forcedMarchChoice = panel.querySelector('[data-forced-choice]')?.value;
      if (!forcedMarchChoice) return;
      this.client.dispatch({ type:'Travel', targetNodeId:nodeId, forcedMarchChoice }).catch(() => {});
    });
  }

  const secret = snapshot.campaign?.secret;
  if (secret?.status === 'pending') {
    const panel = root.ownerDocument.createElement('section');
    panel.className = 'b10-secret-decision';
    panel.innerHTML = `<div><span class="b10-secret-mark">?</span><strong>Обнаружен тайный путь</strong><p>Содержимое, риск и награда неизвестны до входа. Вход стоит 1 припас, возврат после прохождения бесплатный.</p></div><div><button class="rpvs__primary" data-secret-decision="enter" ${secret.canEnter ? '' : 'disabled'}>Войти · 1 припас</button><button data-secret-decision="decline">Отказаться навсегда</button></div>`;
    root.querySelector('.rpvs__map')?.after(panel);
    panel.querySelectorAll('[data-secret-decision]').forEach((button) => button.addEventListener('click', () => this.client.dispatch({ type:'DecideSecret', decision:button.dataset.secretDecision }).catch(() => {})));
  } else if (secret?.status === 'active') {
    const panel = root.ownerDocument.createElement('section');
    panel.className = 'b10-secret-decision b10-secret-active';
    panel.innerHTML = `<div><span class="b10-secret-mark">?</span><strong>${escapeHtml(SECRET_LABELS[secret.type] || 'Тайный узел')}</strong><p>Вы вошли в тайный узел. После завершения вы бесплатно вернётесь в исходную точку карты.</p></div><div><button class="rpvs__primary" data-complete-secret>Завершить тайный узел</button></div>`;
    root.querySelector('.rpvs__map')?.after(panel);
    panel.querySelector('[data-complete-secret]')?.addEventListener('click', () => this.client.dispatch({ type:'CompleteSecret' }).catch(() => {}));
  }

  const reopenable = snapshot.campaign?.reopenableNodeIds || [];
  if (reopenable.length) {
    const panel = root.ownerDocument.createElement('section');
    panel.className = 'b10-reopen-panel';
    panel.innerHTML = `<strong>Редкий маршрут</strong><p>Можно один раз открыть ранее пропущенный authored-узел. Содержимое узла не меняется.</p>${reopenable.map((nodeId) => `<button data-reopen-node="${escapeHtml(nodeId)}">Открыть ${escapeHtml(nodeId)} · переход 1 припас</button>`).join('')}`;
    root.querySelector('.rpvs__map')?.after(panel);
    panel.querySelectorAll('[data-reopen-node]').forEach((button) => button.addEventListener('click', () => this.client.dispatch({ type:'ReopenBranch', nodeId:button.dataset.reopenNode }).catch(() => {})));
  }
});

after('renderEvent', function enhanceEvent(snapshot) {
  const event = snapshot.event;
  if (!event) return;
  const panel = this.root.querySelector('.rpvs__event-copy-panel');
  if (!panel) return;
  const head = this.root.ownerDocument.createElement('div');
  head.className = 'b10-event-meta';
  head.innerHTML = `<span>${escapeHtml(event.eventClass || 'event')}</span><span>Версия: ${escapeHtml(event.variantId || 'default')}</span>${event.participant ? `<span>Участник: ${escapeHtml(event.participant.name || event.participant.id || 'назначен')}</span>` : ''}<span>Золото ${Number(event.resources?.gold ?? snapshot.resources?.gold ?? 0)}</span><span>Припасы ${Number(event.resources?.supplies ?? snapshot.resources?.supplies ?? 0)}</span>`;
  panel.querySelector('.rpa-eyebrow')?.after(head);
  for (const choice of event.choices || []) {
    const button = panel.querySelector(`[data-choice-id="${CSS.escape(choice.id)}"]`);
    if (!button) continue;
    const probability = (choice.probabilities || []).map((entry) => `${Number(entry.probability)}% ${entry.outcomeId || ''}`.trim()).join(' / ');
    const modifiers = (choice.modifiers || []).map((entry) => `${entry.label || entry.id}: ${Number(entry.delta) >= 0 ? '+' : ''}${Number(entry.delta)}%`).join(' · ');
    button.innerHTML = `<strong>${escapeHtml(choice.label)}</strong>${choice.preview ? `<small>${escapeHtml(choice.preview)}</small>` : ''}${probability ? `<span class="b10-event-probability">${escapeHtml(probability)}</span>` : ''}${modifiers ? `<span class="b10-event-modifiers">${escapeHtml(modifiers)}</span>` : ''}`;
  }
  if ((snapshot.eventJournal || []).length) {
    const journal = this.root.ownerDocument.createElement('details');
    journal.className = 'b10-event-journal';
    journal.innerHTML = `<summary>Журнал текущего прохождения</summary>${snapshot.eventJournal.map((entry) => `<p>${escapeHtml(entry.eventId)} · ${escapeHtml(entry.choiceId)} → ${escapeHtml(entry.outcomeId)}</p>`).join('')}`;
    panel.appendChild(journal);
  }
});

after('renderRewardChoice', function enhanceReward(snapshot) {
  const header = this.root.querySelector('.rpb-stage__header');
  const copy = header?.querySelector('p');
  if (copy) copy.textContent = 'Выберите ровно одно предложение. Генерация не зависит от текущего золота, ранений или силы армии.';
  addResourceStrip(this.root, snapshot, header);
  const offers = snapshot.stageB?.rewardOffers || [];
  for (const offer of offers) {
    const button = this.root.querySelector(`[data-reward-offer="${CSS.escape(offer.id)}"]`);
    const card = button?.closest('.rpb-card');
    if (!card) continue;
    if (offer.bonus) {
      const bonus = this.root.ownerDocument.createElement('div');
      bonus.className = 'b10-offer-bonus';
      bonus.textContent = `Дополнительная цель: +${offer.bonus.amount} ${offer.bonus.type === 'gold' ? 'золота' : 'припас'}`;
      button.before(bonus);
    }
  }
});

after('renderService', function enhanceService(snapshot) {
  const service = snapshot.stageB?.service;
  if (!service) return;
  const header = this.root.querySelector('.rpb-stage__header');
  addResourceStrip(this.root, snapshot, header);
  const relics = snapshot.stageB?.relicInventory || [];
  for (const offer of service.offers || []) {
    const oldButton = this.root.querySelector(`[data-service-offer="${CSS.escape(offer.id)}"]`);
    if (!oldButton) continue;
    const card = oldButton.closest('.rpb-card');
    const targetSelect = card?.querySelector(`[data-service-target="${CSS.escape(offer.id)}"]`);
    const action = offer.action || '';
    const requiresRoster = ['piece_upgrade','heal_light_one','heal_hero_heavy','emergency_operation','remove_relic','reforge_relic','camp_heal_light'].includes(action);
    if (!requiresRoster) targetSelect?.closest('label')?.remove();
    let relicSelect = null;
    if (['upgrade_relic','remove_relic','reforge_relic'].includes(action)) {
      const label = this.root.ownerDocument.createElement('label');
      label.textContent = 'Реликвия';
      relicSelect = this.root.ownerDocument.createElement('select');
      relicSelect.dataset.serviceRelic = offer.id;
      relicSelect.className = 'rpb-target-select';
      relicSelect.innerHTML = relics.length ? relics.map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`).join('') : '<option value="">Нет доступной реликвии</option>';
      label.appendChild(relicSelect);
      oldButton.before(label);
    }
    const clone = oldButton.cloneNode(true);
    clone.disabled = Boolean(offer.used || offer.affordable === false || (relicSelect && !relics.length));
    clone.textContent = offer.used ? 'Уже использовано' : offer.affordable === false ? 'Недостаточно золота' : Number(offer.cost || 0) === 0 ? 'Выбрать' : `Купить · останется ${Number(offer.remainingGold ?? snapshot.resources.gold - offer.cost)} золота`;
    oldButton.replaceWith(clone);
    clone.addEventListener('click', () => {
      const targetRosterId = card?.querySelector(`[data-service-target="${CSS.escape(offer.id)}"]`)?.value || null;
      const targetRelicId = card?.querySelector(`[data-service-relic="${CSS.escape(offer.id)}"]`)?.value || null;
      this.client.dispatch({ type:'UseService', offerId:offer.id, targetRosterId, targetRelicId }).catch(() => {});
    });
  }
});

after('renderActOutcome', function enhanceActOutcome(snapshot) {
  const outcome = snapshot.stageB?.actOutcome;
  if (!outcome) return;
  for (const choice of outcome.choices || []) {
    const button = this.root.querySelector(`[data-act-choice="${CSS.escape(choice.id)}"]`);
    if (!button) continue;
    const meta = this.root.ownerDocument.createElement('div');
    meta.className = 'b10-finale-meta';
    meta.textContent = `${Number(choice.costGold || 0)} золота${choice.supporters?.length ? ` · Сторонники: ${choice.supporters.join(', ')}` : ''}`;
    button.appendChild(meta);
    button.disabled = choice.available === false;
    if (choice.available === false) button.title = 'Требования этого исхода сейчас не выполнены';
  }
});

after('renderReorganization', function enhanceReorganization(snapshot) {
  const conversion = snapshot.economy?.conversionPreview;
  if (!conversion) return;
  const summary = this.root.querySelector('.rpb-summary');
  if (!summary) return;
  summary.innerHTML = `<div><span>Остаток припасов</span><strong>${conversion.convertedSupplies}</strong></div><div><span>Конвертация 1 → 5</span><strong>${escapeHtml(conversion.formula)}</strong></div><div><span>Золото следующего акта</span><strong>${conversion.nextGold}</strong></div><div><span>Припасы следующего акта</span><strong>${conversion.nextSupplies}</strong></div>`;
});

export { FORCED_MARCH_LABELS, BRANCH_LABELS, SECRET_LABELS };
