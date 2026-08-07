import { VerticalSlicePresenter as LegacyVerticalSlicePresenter } from './vertical-slice-presenter.mjs?legacy=1';
import { CORE_ASSETS, regionAssets } from './register-01-assets.mjs';
import { heroAssets } from './register-02-assets.mjs';
import { bossAssets, bossPhaseSigil } from './register-05-boss-assets.mjs';
import { sceneArt as approvedSceneArt, unitArt } from './approved-shell-data.mjs';

const PIECE_GLYPHS = Object.freeze({ k:'♔', q:'♕', r:'♖', b:'♗', n:'♘', p:'♙' });
const REWARD_IMAGES = Object.freeze({ relic:'artifact', recruit:'recruit', supplies:'heal', gold:'gold', heal:'heal', temporary:'upgrade', scouting:'experience', risky_event:'meta' });

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]);
}
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function resourceChip(kind, value, label) {
  const image = kind === 'gold' ? 'reward_gold.png' : kind === 'supplies' ? 'reward_heal.png' : 'reward_meta.png';
  return `<span class="rpu-resource" title="${escapeAttribute(label)}"><img src="generated_assets/${image}" alt=""><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></span>`;
}
function rosterArt(entry) {
  if (entry?.kind === 'hero' || String(entry?.id || '').startsWith('hero.')) return heroAssets(entry.id)?.portrait || heroAssets(entry.contentId)?.portrait || unitArt({ side:'w', type:entry.type || 'p' });
  return unitArt({ side:'w', type:entry?.type || 'p' });
}
function rosterState(entry) {
  if (entry?.injury === 'heavy') return 'ТЯЖЁЛАЯ ТРАВМА';
  if (entry?.injury === 'light') return 'ЛЁГКАЯ ТРАВМА';
  if (!entry?.available) return 'НЕДОСТУПЕН';
  return entry?.active ? 'ОСНОВНОЙ СОСТАВ' : 'РЕЗЕРВ';
}
function humanCategory(category) {
  return ({ command:'КОМАНДОВАНИЕ', labor_production:'ТРУД И ПРОИЗВОДСТВО', law:'ПРАВО', local_governance:'МЕСТНОЕ УПРАВЛЕНИЕ' })[category] || String(category || '').toUpperCase();
}
function forceStatus(force) { return force?.status === 'crisis' ? 'КРИЗИС' : 'СТАБИЛЬНО'; }

class VerticalSlicePresenter extends LegacyVerticalSlicePresenter {
  shell(snapshot, main, sidebar = '') {
    const region = regionAssets(snapshot.campaign.regionId);
    const banner = region?.mapBanner;
    const regionLabel = snapshot.campaign.regionId === 'region.iron_marches' ? 'Железные Марши' : snapshot.campaign.regionId;
    const tactical = ['scenario','boss'].includes(snapshot.status);
    const layoutClass = `${sidebar ? '' : ' rpvs__layout--single'}${tactical ? ' rpvs__layout--battle' : ''}`;
    return `<section class="rpvs rpu-runtime${tactical ? ' rpvs--battle' : ''}" aria-label="RPChess" style="${banner ? `background-image:linear-gradient(rgba(4,8,14,.72),rgba(4,8,14,.88)),url('${escapeAttribute(banner)}')` : ''}">
      <header class="rpu-topbar${tactical ? ' rpu-topbar--battle' : ''}">
        <div class="rpu-topbar__identity"><img src="generated_assets/logo_main.png" alt="RPChess"><div><strong>${escapeHtml(regionLabel)}</strong><span>АКТ ${escapeHtml(snapshot.campaign.act)}</span></div></div>
        <div class="rpu-topbar__resources" aria-label="Ресурсы">
          ${resourceChip('gold', snapshot.resources.gold, 'ЗОЛОТО')}
          ${resourceChip('supplies', snapshot.resources.supplies, 'ПРИПАСЫ')}
          ${resourceChip('meta', snapshot.resources.meta, 'НАСЛЕДИЕ')}
          <button class="rpu-topbar__menu" data-runtime-menu aria-label="Главное меню">☰ <span>МЕНЮ</span></button>
        </div>
      </header>
      <div class="rpvs__layout${layoutClass}"><main class="rpvs__panel rpvs__panel--scene">${main}</main>${sidebar ? `<aside class="rpvs__panel">${sidebar}</aside>` : ''}</div>
    </section>`;
  }

  render(snapshotInput) {
    super.render(snapshotInput);
    this.installTalentOverlay(this.lastSnapshot || snapshotInput);
  }

  installTalentOverlay(snapshot) {
    const pendingEntry = (snapshot?.stageB?.roster || []).find((entry) => entry.talentChoices?.length);
    if (!pendingEntry) return;
    this.root.querySelectorAll('.rpb-talent').forEach((card) => card.closest('.rpb-stage')?.remove());
    if (this.root.querySelector('[data-rpu-talent-modal]')) return;
    const pending = pendingEntry.talentChoices[0];
    const assets = heroAssets(pendingEntry.id);
    const portrait = assets?.portrait || rosterArt(pendingEntry);
    const badge = assets?.pieceBadge || rosterArt(pendingEntry);
    const ability = assets?.abilityIcon || CORE_ASSETS.logo;
    const options = (pending.options || []).map((option, index) => `<article class="rpu-talent-option">
      <span class="rpu-talent-option__number">${index + 1}</span>
      <img src="${escapeAttribute(ability)}" alt="">
      <h3>${escapeHtml(option.name)}</h3>
      <p>${escapeHtml(option.description)}</p>
      <span class="rpu-kicker">ПОСТОЯННЫЙ ТАЛАНТ</span>
      <button class="rpa-button rpa-button--primary" data-talent-roster="${escapeAttribute(pendingEntry.id)}" data-talent-id="${escapeAttribute(option.id)}">ВЫБРАТЬ</button>
    </article>`).join('');
    const host = this.root.ownerDocument.createElement('div');
    host.dataset.rpuTalentModal = '';
    host.className = 'rpu-modal rpu-talent-modal';
    host.innerHTML = `<div class="rpu-modal__scrim"></div><section class="rpu-modal__window" role="dialog" aria-modal="true" aria-labelledby="rpu-talent-title">
      <header class="rpu-modal__header"><div><span class="rpu-kicker">ПОВЫШЕНИЕ ГЕРОЯ</span><h2 id="rpu-talent-title">НОВАЯ ЗВЕЗДА</h2><p>Выберите один талант для ${escapeHtml(pendingEntry.name)}. Этот выбор закрепится навсегда.</p></div><div class="rpu-danger-note"><strong>ВЫБОР НЕОБРАТИМ</strong><span>Обычный сброс талантов недоступен.</span></div></header>
      <div class="rpu-talent-layout"><aside class="rpu-talent-hero"><img class="rpu-talent-hero__portrait" src="${escapeAttribute(portrait)}" alt="${escapeAttribute(pendingEntry.name)}"><div class="rpu-talent-hero__role"><img src="${escapeAttribute(badge)}" alt=""><span>${PIECE_GLYPHS[pendingEntry.type] || '♙'}</span></div><h3>${escapeHtml(pendingEntry.name)}</h3><p>${pendingEntry.kind === 'hero' ? 'ИМЕННОЙ ГЕРОЙ' : 'ФИГУРА'} · ${PIECE_GLYPHS[pendingEntry.type] || '♙'}</p><strong>★ ${Math.max(0, Number(pending.star || 1) - 1)} → ★ ${escapeHtml(pending.star)}</strong></aside><div class="rpu-talent-options">${options}</div></div>
    </section>`;
    this.root.appendChild(host);
    host.querySelectorAll('[data-talent-id]').forEach((button) => button.addEventListener('click', () => this.client.dispatch({ type:'ChooseTalent', rosterId:button.dataset.talentRoster, talentId:button.dataset.talentId }).catch(() => {})));
  }

  renderActOutcome(snapshot) {
    const finale = snapshot.politicalFinaleB14;
    if (!finale || !['cabinet','government','law','epilogue'].includes(finale.stage)) return super.renderActOutcome(snapshot);
    const background = approvedSceneArt(finale.stage === 'epilogue' ? 'victory' : 'campaign');
    let body = '';
    if (finale.stage === 'cabinet') {
      const forces = (finale.forces || []).map((force) => `<article class="rpu-force-card ${force.status === 'crisis' ? 'is-crisis' : ''}"><img src="${escapeAttribute(force.portrait || 'generated_assets/logo_main.png')}" alt=""><div><span class="rpu-kicker">${forceStatus(force)}</span><h3>${escapeHtml(force.name)}</h3><p>${escapeHtml(force.direction)}</p>${force.demand ? `<strong>${escapeHtml(force.demand.title)}</strong><small>${escapeHtml(force.demand.description)}</small>` : '<small>Сила входит во временный кабинет без дополнительного требования.</small>'}</div></article>`).join('');
      const choices = (finale.choices || []).map((choice) => `<button class="rpu-political-choice" data-act-choice="${escapeAttribute(choice.id)}" ${choice.available === false ? 'disabled' : ''}><strong>${escapeHtml(choice.title)}</strong><span>${escapeHtml(choice.consequence || '')}</span>${choice.risk ? `<small>${escapeHtml(choice.risk)}</small>` : ''}</button>`).join('');
      body = `<div class="rpu-finale-heading"><span class="rpu-kicker">ЭТАП I · ЧРЕЗВЫЧАЙНЫЙ КАБИНЕТ</span><h1>${escapeHtml(finale.title)}</h1><p>${escapeHtml(finale.summary)}</p></div><div class="rpu-force-grid">${forces}</div><div class="rpu-political-actions">${choices}</div>`;
    } else if (finale.stage === 'government') {
      const cards = (finale.choices || []).map((choice) => `<button class="rpu-government-card ${choice.kind === 'coalition' ? 'is-coalition' : ''}" data-act-choice="${escapeAttribute(choice.id)}" ${choice.available === false ? 'disabled' : ''}><span class="rpu-kicker">${choice.kind === 'coalition' ? 'КОАЛИЦИЯ' : 'БАЗОВЫЙ РЕЖИМ'}</span><h3>${escapeHtml(choice.name || choice.title)}</h3>${choice.subtitle ? `<strong>${escapeHtml(choice.subtitle)}</strong>` : ''}<p>${escapeHtml(choice.description || '')}</p>${choice.reasons?.length ? `<ul>${choice.reasons.slice(0,3).map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>` : ''}<small>${escapeHtml(choice.warning || '')}</small><span class="rpu-card-cta">ВЫБРАТЬ</span></button>`).join('');
      body = `<div class="rpu-finale-heading"><span class="rpu-kicker">ЭТАП II · ПОСТОЯННАЯ ВЛАСТЬ</span><h1>${escapeHtml(finale.title)}</h1><p>${escapeHtml(finale.summary)}</p></div><div class="rpu-government-grid">${cards}</div>`;
    } else if (finale.stage === 'law') {
      const cards = (finale.choices || []).map((choice) => `<button class="rpu-law-card" data-act-choice="${escapeAttribute(choice.id)}"><span class="rpu-kicker">${humanCategory(choice.category)}</span><h3>${escapeHtml(choice.name)}</h3><div class="rpu-law-effect is-positive"><strong>ПРЕИМУЩЕСТВО</strong><p>${escapeHtml(choice.advantage)}</p></div><div class="rpu-law-effect is-cost"><strong>ЦЕНА</strong><p>${escapeHtml(choice.cost)}</p></div><span class="rpu-card-cta">ПРИНЯТЬ ЗАКОН</span></button>`).join('');
      body = `<div class="rpu-finale-heading"><span class="rpu-kicker">ЭТАП III · ФУНДАМЕНТАЛЬНЫЙ ЗАКОН</span><h1>${escapeHtml(finale.title)}</h1><p>${escapeHtml(finale.summary)}</p></div><div class="rpu-law-grid">${cards}</div>`;
    } else {
      const cards = (finale.cards || []).map((card) => `<article class="rpu-epilogue-card"><span class="rpu-kicker">ИТОГ</span><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.body)}</p></article>`).join('');
      body = `<div class="rpu-finale-heading"><span class="rpu-kicker">ЭПИЛОГ РЕГИОНА</span><h1>${escapeHtml(finale.title)}</h1><p>${escapeHtml(finale.summary)}</p></div><div class="rpu-epilogue-grid">${cards}</div><div class="rpu-finale-footer"><button class="rpa-button rpa-button--primary" data-act-choice="epilogue_continue">ПЕРЕЙТИ К НАГРАДЕ ЗА АКТ</button></div>`;
    }
    const main = `<section class="rpu-finale" style="background-image:linear-gradient(90deg,rgba(3,8,15,.96),rgba(3,8,15,.76) 62%,rgba(3,8,15,.45)),url('${escapeAttribute(background)}')">${body}</section>`;
    this.root.innerHTML = this.shell(snapshot, main);
    this.root.querySelectorAll('[data-act-choice]:not([disabled])').forEach((button) => button.addEventListener('click', () => this.client.dispatch({ type:'ChooseActOutcome', choiceId:button.dataset.actChoice }).catch(() => {})));
  }

  renderRewardChoice(snapshot) {
    if (snapshot.politicalFinaleB14?.stage !== 'act_reward') return super.renderRewardChoice(snapshot);
    const offers = snapshot.stageB?.rewardOffers || [];
    const injured = (snapshot.stageB?.roster || []).filter((entry) => entry.injury);
    const targets = (snapshot.stageB?.roster || []).filter((entry) => entry.available || entry.injury).map((entry) => `<option value="${escapeAttribute(entry.id)}">${escapeHtml(entry.name)} · ${rosterState(entry)}</option>`).join('');
    const cards = offers.map((offer) => `<article class="rpu-act-reward-card"><img src="generated_assets/reward_${REWARD_IMAGES[offer.type] || 'artifact'}.png" alt=""><span class="rpu-kicker">КРУПНАЯ НАГРАДА</span><h3>${escapeHtml(offer.title)}</h3><p>${escapeHtml(offer.description)}</p>${offer.improved ? '<strong class="rpu-improved">УСИЛЕНО ДОПОЛНИТЕЛЬНОЙ ЦЕЛЬЮ</strong>' : ''}${['heal','relic'].includes(offer.type) ? `<label>ПОЛУЧАТЕЛЬ<select data-reward-target="${escapeAttribute(offer.id)}">${targets}</select></label>` : ''}<button class="rpa-button rpa-button--primary" data-reward-offer="${escapeAttribute(offer.id)}">ВЫБРАТЬ</button></article>`).join('');
    const main = `<section class="rpu-act-reward" style="background-image:linear-gradient(rgba(4,9,18,.72),rgba(4,9,18,.9)),url('${escapeAttribute(approvedSceneArt('reward'))}')"><div class="rpu-finale-heading"><span class="rpu-kicker">ЖЕЛЕЗНЫЕ МАРШИ ЗАВЕРШЕНЫ</span><h1>НАГРАДА ЗА ЗАВЕРШЕНИЕ АКТА</h1><p>Выберите одну крупную награду. Политическая форма власти не определяет состав предложений.</p></div><div class="rpu-act-reward-grid">${cards}</div>${injured.length ? `<div class="rpu-warning">РАНЕНЫЕ: ${injured.map((entry) => escapeHtml(entry.name)).join(', ')}</div>` : ''}</section>`;
    this.root.innerHTML = this.shell(snapshot, main);
    this.root.querySelectorAll('[data-reward-offer]').forEach((button) => button.addEventListener('click', () => { const target = this.root.querySelector(`[data-reward-target="${CSS.escape(button.dataset.rewardOffer)}"]`)?.value || null; this.client.dispatch({ type:'ChooseRewardOffer', offerId:button.dataset.rewardOffer, targetRosterId:target }).catch(() => {}); }));
  }

  renderReorganization(snapshot) {
    if (snapshot.politicalFinaleB14?.stage !== 'interact') return super.renderReorganization(snapshot);
    const finale = snapshot.politicalFinaleB14;
    const stage = snapshot.stageB;
    const active = new Set(stage.reorganization?.activeRosterIds || []);
    const roster = (stage.roster || []).map((entry) => `<label class="rpu-interact-roster-card ${entry.available ? '' : 'is-unavailable'}"><input type="checkbox" data-reorg-roster="${escapeAttribute(entry.id)}" ${active.has(entry.id) ? 'checked' : ''} ${entry.kind === 'king' || !entry.available ? 'disabled' : ''}><img src="${escapeAttribute(rosterArt(entry))}" alt=""><div><strong>${escapeHtml(entry.name)}</strong><span>${rosterState(entry)} · ★${escapeHtml(entry.stars)}</span><small>${PIECE_GLYPHS[entry.type] || '♙'} · талантов ${(entry.talents || []).length}</small></div></label>`).join('');
    const government = finale.government || {};
    const legacy = finale.legacy || {};
    const support = finale.support || {};
    const main = `<section class="rpu-interact" style="background-image:linear-gradient(90deg,rgba(3,8,15,.96),rgba(3,8,15,.73)),url('${escapeAttribute(approvedSceneArt('campaign'))}')"><div class="rpu-finale-heading"><span class="rpu-kicker">МЕЖАКТОВОЕ СОСТОЯНИЕ</span><h1>ЖЕЛЕЗНЫЕ МАРШИ ЗАВЕРШЕНЫ</h1><p>Итоги региона закреплены. Проверьте наследие, поддержку и состав армии перед следующим актом.</p></div><div class="rpu-interact-summary"><article><span>ПРАВИТЕЛЬСТВО</span><strong>${escapeHtml(government.name || '—')}</strong><small>${escapeHtml(government.subtitle || government.description || '')}</small></article><article><span>НАСЛЕДИЕ</span><strong>${escapeHtml(legacy.name || '—')}</strong><small>${escapeHtml(legacy.advantage || '')}</small></article><article><span>ПОДДЕРЖКА РЕГИОНА</span><strong>${escapeHtml(support.charges || 0)} / ${escapeHtml(support.maximum || 2)}</strong><small>${escapeHtml((support.directions || []).join(' · '))}</small></article><article><span>ТЯЖЁЛЫЕ ТРАВМЫ</span><strong>${escapeHtml(stage.reorganization?.heavyInjuries?.length || 0)}</strong><small>Сохраняются между актами</small></article></div><div class="rpu-interact-layout"><div><h2>СОСТАВ АРМИИ</h2><div class="rpu-interact-roster">${roster}</div></div><aside><h2>ПЕРЕНОС РЕСУРСОВ</h2><dl><div><dt>Лимит снабжения</dt><dd>${escapeHtml(stage.reorganization?.supplyCarryCap)}</dd></div><div><dt>Компенсация излишков</dt><dd>${escapeHtml(stage.reorganization?.excessSupplyCompensation)}</dd></div><div><dt>Сила армии</dt><dd>${escapeHtml(stage.reorganization?.nextRegionScaling?.armyStrength)}</dd></div><div><dt>Усиление врага</dt><dd>+${escapeHtml(stage.reorganization?.nextRegionScaling?.enemyBonus)}</dd></div></dl><button class="rpa-button" data-save-reorganization>ПРИМЕНИТЬ СОСТАВ</button><button class="rpa-button rpa-button--primary" data-confirm-reorganization>К СЛЕДУЮЩЕМУ АКТУ</button></aside></div></section>`;
    this.root.innerHTML = this.shell(snapshot, main);
    const ids = () => [...this.root.querySelectorAll('[data-reorg-roster]:checked')].map((input) => input.dataset.reorgRoster);
    this.root.querySelector('[data-save-reorganization]')?.addEventListener('click', () => this.client.dispatch({ type:'SetReorganization', activeRosterIds:ids() }).catch(() => {}));
    this.root.querySelector('[data-confirm-reorganization]')?.addEventListener('click', async () => { try { await this.client.dispatch({ type:'SetReorganization', activeRosterIds:ids() }); await this.client.dispatch({ type:'ConfirmReorganization' }); } catch (_error) {} });
  }

  renderBossTransition(snapshot) {
    const boss = bossAssets(snapshot.boss?.bossId || 'boss.iron_regent');
    if (!boss) return super.renderBossTransition(snapshot);
    const phase = Math.max(1, Number(snapshot.boss?.phaseNumber || 1) + 1);
    const sigil = bossPhaseSigil(boss.id, phase);
    const main = `<section class="rpu-boss-transition" style="background-image:linear-gradient(90deg,rgba(4,5,10,.96),rgba(22,5,14,.64)),url('${escapeAttribute(boss.arena)}')"><img class="rpu-boss-transition__boss" src="${escapeAttribute(boss.portrait)}" alt="${escapeAttribute(boss.name)}"><div class="rpu-boss-transition__copy"><span class="rpu-kicker">${escapeHtml(boss.name)}</span>${sigil ? `<img class="rpu-boss-transition__sigil" src="${escapeAttribute(sigil)}" alt="">` : ''}<h1>ВРАГ МЕНЯЕТ ТАКТИКУ</h1><p>Первая линия обороны разрушена. Следующая фаза меняет правила поля — новые угрозы будут показаны до первого хода.</p><button class="rpa-button rpa-button--primary" data-begin-phase>НАЧАТЬ СЛЕДУЮЩУЮ ФАЗУ</button></div></section>`;
    this.root.innerHTML = this.shell(snapshot, main);
    this.root.querySelector('[data-begin-phase]')?.addEventListener('click', () => this.client.dispatch({ type:'BeginBossPhase' }).catch(() => {}));
  }
}

export { VerticalSlicePresenter };
