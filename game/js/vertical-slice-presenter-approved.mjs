import { VerticalSlicePresenter as UnifiedVerticalSlicePresenter } from './vertical-slice-presenter-v2.mjs';
import { heroAssets } from './register-02-assets.mjs';
import { unitArt, sceneArt as approvedSceneArt } from './approved-shell-data.mjs';

const PIECE_GLYPHS = Object.freeze({ p:'♙', n:'♘', b:'♗', r:'♖', q:'♕', k:'♔' });
const PIECE_LABELS = Object.freeze({ p:'ПЕШКА', n:'КОНЬ', b:'СЛОН', r:'ЛАДЬЯ', q:'ФЕРЗЬ', k:'КОРОЛЬ' });
const REWARD_IMAGES = Object.freeze({ relic:'artifact', recruit:'recruit', supplies:'heal', gold:'gold', heal:'heal', temporary:'upgrade', scouting:'experience', risky_event:'meta' });
const SERVICE_LABELS = Object.freeze({ shop:'ЛАВКА', hospital:'ПОЛЕВОЙ ГОСПИТАЛЬ', forge:'КУЗНИЦА', camp:'ЛАГЕРЬ' });

function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]); }
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function typeId(value) { return String(value || 'p').slice(0,1).toLowerCase(); }
function heroArt(id, type='p') { return heroAssets(id)?.portrait || unitArt({ side:'w', type }); }
function pieceArt(type) { return unitArt({ side:'w', type:typeId(type) }); }
function rosterArt(entry) { return entry?.kind === 'hero' ? heroArt(entry.id, entry.type) : pieceArt(entry?.type); }
function rosterState(entry) {
  if (entry?.injury === 'heavy') return 'ТЯЖЁЛАЯ ТРАВМА';
  if (entry?.injury === 'light') return 'ЛЁГКАЯ ТРАВМА';
  if (!entry?.available) return 'НЕДОСТУПЕН';
  return entry?.active ? 'ОСНОВНОЙ СОСТАВ' : 'РЕЗЕРВ';
}
function rewardImage(type) { return `generated_assets/reward_${REWARD_IMAGES[type] || 'artifact'}.png`; }

class VerticalSlicePresenter extends UnifiedVerticalSlicePresenter {
  renderDraft(snapshot) {
    const stage = snapshot.stageB;
    const selectedHero = stage.draft.selectedHeroId;
    const selectedRegular = stage.draft.selectedRegularId;
    const selectedHeroOffer = stage.draft.heroOffers.find((offer) => offer.id === selectedHero) || null;
    const selectedRegularOffer = stage.draft.regularOffers.find((offer) => offer.id === selectedRegular) || null;
    const regularCost = Number(selectedRegularOffer?.commandCost || 0);
    const heroCards = stage.draft.heroOffers.map((offer) => {
      const type = typeId(offer.pieceType);
      const selected = offer.id === selectedHero;
      return `<button class="rpu-draft-card rpu-draft-card--hero${selected ? ' is-selected' : ''}" data-draft-hero="${escapeAttribute(offer.id)}" aria-pressed="${selected}"><div class="rpu-draft-card__art"><img src="${escapeAttribute(heroArt(offer.id,type))}" alt="${escapeAttribute(offer.name)}"><span>${PIECE_GLYPHS[type] || '♙'}</span></div><div class="rpu-draft-card__copy"><span class="rpu-kicker">ИМЕННОЙ ГЕРОЙ · ${PIECE_LABELS[type] || type.toUpperCase()}</span><h3>${escapeHtml(offer.name)}</h3><small>${selected ? 'ВЫБРАН В ОСНОВУ' : 'ВЫБРАТЬ ГЕРОЯ'}</small></div></button>`;
    }).join('');
    const regularCards = stage.draft.regularOffers.map((offer) => {
      const type = typeId(offer.type);
      const selected = offer.id === selectedRegular;
      return `<button class="rpu-draft-card rpu-draft-card--regular${selected ? ' is-selected' : ''}" data-draft-regular="${escapeAttribute(offer.id)}" aria-pressed="${selected}"><div class="rpu-draft-card__art"><img src="${escapeAttribute(pieceArt(type))}" alt=""><span>${PIECE_GLYPHS[type] || '♙'}</span></div><div class="rpu-draft-card__copy"><span class="rpu-kicker">ПОПОЛНЕНИЕ · ${PIECE_LABELS[type] || type.toUpperCase()}</span><h3>${escapeHtml(offer.name)}</h3><small>${escapeHtml(offer.commandCost)} КОМАНДОВАНИЯ</small></div></button>`;
    }).join('');
    const main = `<section class="rpu-draft" style="background-image:linear-gradient(90deg,rgba(3,8,15,.95),rgba(3,8,15,.72) 68%,rgba(3,8,15,.4)),url('generated_assets/splash_poster.jpg')"><div class="rpu-draft__heading"><span class="rpu-kicker">ФОРМИРОВАНИЕ АРМИИ</span><h1>СОБЕРИТЕ ОСНОВУ АРМИИ</h1><p>Доктрина уже дала костяк. Выберите одного именного героя и одно пополнение.</p></div><div class="rpu-draft__layout"><div class="rpu-draft__choices"><section><div class="rpu-section-title"><span>01</span><div><h2>ИМЕННОЙ ГЕРОЙ</h2><p>Выберите одного героя.</p></div></div><div class="rpu-draft-grid">${heroCards}</div></section><section><div class="rpu-section-title"><span>02</span><div><h2>ПОПОЛНЕНИЕ</h2><p>Обычные фигуры показаны боевыми ассетами и шахматными глифами.</p></div></div><div class="rpu-draft-grid rpu-draft-grid--regular">${regularCards}</div></section></div><aside class="rpu-draft-summary"><span class="rpu-kicker">СВОДКА СОСТАВА</span><h2>КОМАНДОВАНИЕ</h2><div class="rpu-command-meter"><span style="width:${Math.min(100,Math.round(regularCost / Math.max(1,stage.commandLimit) * 100))}%"></span></div><strong>${regularCost} / ${escapeHtml(stage.commandLimit)}</strong><dl><div><dt>ГЕРОЙ</dt><dd>${escapeHtml(selectedHeroOffer?.name || 'НЕ ВЫБРАН')}</dd></div><div><dt>ПОПОЛНЕНИЕ</dt><dd>${escapeHtml(selectedRegularOffer?.name || 'НЕ ВЫБРАНО')}</dd></div></dl><p>${escapeHtml(stage.draft.warning || '')}</p><button class="rpa-button rpa-button--primary" data-confirm-draft ${selectedHero && selectedRegular ? '' : 'disabled'}>ПОДТВЕРДИТЬ СОСТАВ</button></aside></div></section>`;
    this.root.innerHTML = this.shell(snapshot, main);
    this.root.querySelectorAll('[data-draft-hero]').forEach((button) => button.addEventListener('click', () => this.client.dispatch({ type:'ChooseDraftHero', heroId:button.dataset.draftHero }).catch(() => {})));
    this.root.querySelectorAll('[data-draft-regular]').forEach((button) => button.addEventListener('click', () => this.client.dispatch({ type:'ChooseDraftRegular', regularId:button.dataset.draftRegular }).catch(() => {})));
    this.root.querySelector('[data-confirm-draft]')?.addEventListener('click', () => this.client.dispatch({ type:'ConfirmDraft' }).catch(() => {}));
  }

  renderReward(snapshot) {
    const reward = snapshot.reward;
    const resources = [
      ['gold', reward.gold, 'ЗОЛОТО'], ['supplies', reward.supplies, 'ПРИПАСЫ'], ['meta', reward.meta, 'НАСЛЕДИЕ']
    ];
    const main = `<section class="rpu-base-reward" style="background-image:linear-gradient(90deg,rgba(3,8,15,.88),rgba(3,8,15,.42)),url('${escapeAttribute(approvedSceneArt('reward'))}')"><div class="rpu-base-reward__copy"><span class="rpu-kicker">ПОБЕДА</span><h1>${escapeHtml(reward.title || 'ТРОФЕИ ВАШИ')}</h1><p>Сражение завершено. Заберите ресурсы и продолжайте поход.</p><div class="rpu-base-reward__grid">${resources.map(([kind,value,label]) => `<article><img src="${rewardImage(kind)}" alt=""><strong>${escapeHtml(value)}</strong><span>${label}</span></article>`).join('')}</div><button class="rpa-button rpa-button--primary" data-claim>ЗАБРАТЬ НАГРАДУ</button></div>${this.pendingEffect ? '<div class="rpvs__scene-vfx" data-scene-vfx></div>' : ''}</section>`;
    this.root.innerHTML = this.shell(snapshot, main);
    this.root.querySelector('[data-claim]')?.addEventListener('click', () => this.client.dispatch({ type:'ClaimReward' }).catch(() => {}));
    const effectElement = this.root.querySelector('[data-scene-vfx]');
    if (effectElement && this.pendingEffect) { const effect = this.pendingEffect; this.pendingEffect = null; this.animateSprite(effectElement,effect); }
  }

  renderRewardChoice(snapshot) {
    if (snapshot.politicalFinaleB14?.stage === 'act_reward') return super.renderRewardChoice(snapshot);
    const offers = snapshot.stageB.rewardOffers || [];
    const injured = (snapshot.stageB.roster || []).filter((entry) => entry.injury);
    const targets = (snapshot.stageB.roster || []).filter((entry) => entry.available || entry.injury).map((entry) => `<option value="${escapeAttribute(entry.id)}">${escapeHtml(entry.name)} · ${rosterState(entry)}</option>`).join('');
    const cards = offers.map((offer,index) => `<article class="rpu-reward-choice-card${offer.improved ? ' is-improved' : ''}"><span class="rpu-reward-choice-card__index">0${index + 1}</span><img src="${rewardImage(offer.type)}" alt=""><span class="rpu-kicker">${offer.improved ? 'УЛУЧШЕННАЯ НАГРАДА' : 'НАГРАДА'}</span><h3>${escapeHtml(offer.title)}</h3><p>${escapeHtml(offer.description)}</p>${['heal','relic'].includes(offer.type) ? `<label><span>ПОЛУЧАТЕЛЬ</span><select data-reward-target="${escapeAttribute(offer.id)}">${targets}</select></label>` : '<div class="rpu-reward-choice-card__spacer"></div>'}<button class="rpa-button rpa-button--primary" data-reward-offer="${escapeAttribute(offer.id)}">ВЫБРАТЬ</button></article>`).join('');
    const main = `<section class="rpu-reward-choice" style="background-image:linear-gradient(rgba(3,8,15,.7),rgba(3,8,15,.9)),url('${escapeAttribute(approvedSceneArt('reward'))}')"><div class="rpu-finale-heading"><span class="rpu-kicker">НАГРАДА ЗА СРАЖЕНИЕ</span><h1>ВЫБЕРИТЕ ОДНУ НАГРАДУ</h1><p>Предложения учитывают состав армии, недавние награды и дополнительные цели.</p></div><div class="rpu-reward-choice-grid">${cards}</div>${injured.length ? `<div class="rpu-warning">РАНЕНЫЕ: ${injured.map((entry) => escapeHtml(entry.name)).join(', ')}</div>` : ''}</section>`;
    this.root.innerHTML = this.shell(snapshot,main);
    this.root.querySelectorAll('[data-reward-offer]').forEach((button) => button.addEventListener('click', () => { const target = this.root.querySelector(`[data-reward-target="${CSS.escape(button.dataset.rewardOffer)}"]`)?.value || null; this.client.dispatch({ type:'ChooseRewardOffer', offerId:button.dataset.rewardOffer, targetRosterId:target }).catch(() => {}); }));
  }

  renderService(snapshot) {
    const service = snapshot.stageB.service;
    const targets = (snapshot.stageB.roster || []).map((entry) => `<option value="${escapeAttribute(entry.id)}">${escapeHtml(entry.name)} · ${rosterState(entry)}</option>`).join('');
    const offers = (service.offers || []).map((offer,index) => `<article class="rpu-service-card${snapshot.resources.gold < offer.cost ? ' is-unavailable' : ''}"><span class="rpu-service-card__number">0${index + 1}</span><img src="generated_assets/reward_${service.type === 'hospital' ? 'heal' : service.type === 'shop' ? 'artifact' : 'upgrade'}.png" alt=""><h3>${escapeHtml(offer.title)}</h3><div class="rpu-service-card__price"><span>СТОИМОСТЬ</span><strong>${escapeHtml(offer.cost)} <small>ЗОЛОТА</small></strong></div><label><span>ПОЛУЧАТЕЛЬ</span><select data-service-target="${escapeAttribute(offer.id)}">${targets}</select></label><button class="rpa-button rpa-button--primary" data-service-offer="${escapeAttribute(offer.id)}" ${snapshot.resources.gold >= offer.cost ? '' : 'disabled'}>ПОЛУЧИТЬ УСЛУГУ</button></article>`).join('');
    const roster = (snapshot.stageB.roster || []).map((entry) => `<article class="rpu-service-roster-card ${entry.injury ? 'is-injured' : ''}"><img src="${escapeAttribute(rosterArt(entry))}" alt=""><div><strong>${escapeHtml(entry.name)}</strong><span>${rosterState(entry)}</span></div><b>★${escapeHtml(entry.stars)}</b></article>`).join('');
    const main = `<section class="rpu-service" style="background-image:linear-gradient(90deg,rgba(3,8,15,.94),rgba(3,8,15,.62)),url('${escapeAttribute(approvedSceneArt(service.type === 'shop' ? 'shop' : service.type === 'hospital' ? 'repair' : 'training'))}')"><div class="rpu-finale-heading"><span class="rpu-kicker">СЕРВИСНЫЙ УЗЕЛ</span><h1>${SERVICE_LABELS[service.type] || escapeHtml(service.type).toUpperCase()}</h1><p>${escapeHtml(service.warning || '')}</p></div><div class="rpu-service-layout"><div class="rpu-service-grid">${offers}</div><aside><div class="rpu-service-army-head"><span class="rpu-kicker">СОСТОЯНИЕ АРМИИ</span><strong>${escapeHtml(snapshot.resources.gold)} ЗОЛОТА</strong></div><div class="rpu-service-roster">${roster}</div><button class="rpa-button" data-leave-service>ПОКИНУТЬ МЕСТО</button></aside></div></section>`;
    this.root.innerHTML = this.shell(snapshot,main);
    this.root.querySelectorAll('[data-service-offer]').forEach((button) => button.addEventListener('click', () => { const target = this.root.querySelector(`[data-service-target="${CSS.escape(button.dataset.serviceOffer)}"]`)?.value || null; this.client.dispatch({ type:'UseService', offerId:button.dataset.serviceOffer, targetRosterId:target }).catch(() => {}); }));
    this.root.querySelector('[data-leave-service]')?.addEventListener('click', () => this.client.dispatch({ type:'LeaveService' }).catch(() => {}));
  }

  renderRetreat(snapshot) {
    const retreat = snapshot.stageB.royalRetreat;
    const consequences = (retreat.consequences || []).slice(0,3).map((value,index) => `<article><span>0${index + 1}</span><p>${escapeHtml(value)}</p></article>`).join('');
    const main = `<section class="rpu-retreat" style="background-image:linear-gradient(90deg,rgba(18,5,8,.94),rgba(4,8,15,.62)),url('${escapeAttribute(approvedSceneArt('defeat'))}')"><div class="rpu-retreat__copy"><span class="rpu-kicker">КОРОЛЕВСКОЕ ОТСТУПЛЕНИЕ</span><h1>АРМИЯ ВЫРВАЛАСЬ ИЗ ОКРУЖЕНИЯ</h1><p>Первое поражение не завершает обычный поход. Потерянный узел закрывается, награда утрачена, армия отходит к следующей точке схождения.</p><div class="rpu-retreat__consequences">${consequences}</div><div class="rpu-retreat__warning"><strong>ПОСЛЕДНИЙ ШАНС</strong><span>Следующее поражение завершит поход.</span></div><button class="rpa-button rpa-button--primary" data-continue-retreat>ПРОДОЛЖИТЬ ОТСТУПЛЕНИЕ</button></div><img class="rpu-retreat__king" src="${escapeAttribute(pieceArt('k'))}" alt=""></section>`;
    this.root.innerHTML = this.shell(snapshot,main);
    this.root.querySelector('[data-continue-retreat]')?.addEventListener('click', () => this.client.dispatch({ type:'ContinueRoyalRetreat' }).catch(() => {}));
  }

  renderTerminal(snapshot) {
    const victory = snapshot.terminal?.outcome === 'victory' || snapshot.status === 'complete';
    const background = approvedSceneArt(victory ? 'victory' : 'defeat');
    const main = `<section class="rpu-terminal ${victory ? 'is-victory' : 'is-defeat'}" style="background-image:linear-gradient(90deg,rgba(3,8,15,.92),rgba(3,8,15,.35)),url('${escapeAttribute(background)}')"><div class="rpu-terminal__copy"><img src="generated_assets/logo_main.png" alt="RPChess"><span class="rpu-kicker">${victory ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}</span><h1>${victory ? 'ЖЕЛЕЗНЫЕ МАРШИ ПРОЙДЕНЫ' : 'ПОХОД ОКОНЧЕН'}</h1><p>${victory ? 'Железный Регент повержен. Победа и решения региона сохранены.' : 'Ваш король получил мат. Поход можно начать заново из главного меню.'}</p>${!victory ? '<strong>КОРОЛЬ ПОЛУЧИЛ МАТ</strong>' : ''}<button class="rpa-button rpa-button--primary" data-runtime-menu>ВЕРНУТЬСЯ В ГЛАВНОЕ МЕНЮ</button></div>${!victory ? `<img class="rpu-terminal__king" src="${escapeAttribute(pieceArt('k'))}" alt="">` : ''}</section>`;
    this.root.innerHTML = this.shell(snapshot,main);
  }
}

export { VerticalSlicePresenter };
