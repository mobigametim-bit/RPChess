import {
  HERO_ASSETS,
  POLITICAL_ASSETS,
  heroAssets,
  politicalAssets
} from './register-02-assets.mjs';
import { relicChipMarkup } from './register-03-relic-codex.mjs';
import { relicProfile, relicAsset } from './register-03-relic-assets.mjs';
import { humanStatus } from './approved-shell-data.mjs';

const FACTIONS = Object.freeze({
  iron_marches: Object.freeze({ id: 'iron_marches', label: 'Железные Марши' }),
  luminous_synod: Object.freeze({ id: 'luminous_synod', label: 'Светлый Синод' }),
  free_cities: Object.freeze({ id: 'free_cities', label: 'Вольные Города' }),
  thorn_covenant: Object.freeze({ id: 'thorn_covenant', label: 'Терновый Завет' }),
  ashen_dominion: Object.freeze({ id: 'ashen_dominion', label: 'Пепельный Доминион' }),
  sky_khanate: Object.freeze({ id: 'sky_khanate', label: 'Небесный Каганат' })
});

const PIECE_LABELS = Object.freeze({
  pawn: 'пешка', knight: 'конь', bishop: 'слон', rook: 'ладья', queen: 'ферзь', king: 'король',
  p: 'пешка', n: 'конь', b: 'слон', r: 'ладья', q: 'ферзь', k: 'король'
});

const HERO_ROWS = Object.freeze([
  ['aldric_wall', 'Альдрик Стена', 'iron_marches', 'rook', 'Ветеран-защитник, способный один раз за бой встать между ударом и союзником.'],
  ['mara_chain', 'Мара Цепь', 'iron_marches', 'pawn', 'Бывшая пленница, ведущая пешечные построения.'],
  ['brother_orell', 'Брат Орелл', 'iron_marches', 'bishop', 'Жрец-кузнец, управляющий перекрытыми линиями.'],
  ['vael_hammer', 'Ваэль Молот', 'iron_marches', 'knight', 'Тяжёлая кавалерия с ограниченным и заранее показанным натиском.'],
  ['lady_sorn', 'Леди Сорн', 'iron_marches', 'queen', 'Политическая заложница и элитный тактик.'],
  ['tomas_gate', 'Томас Вратарь', 'iron_marches', 'king', 'Временный герой сопровождения с командованием воротами.'],
  ['seraph_lyra', 'Серафима Лира', 'luminous_synod', 'bishop', 'Целительница, освящающая одну диагональ.'],
  ['ivar_lens', 'Ивар Линза', 'luminous_synod', 'rook', 'Инженер обсерватории, поворачивающий видимые рунические зеркала.'],
  ['nemea_quill', 'Немея Перо', 'luminous_synod', 'pawn', 'Учёная пешка, сохраняющая память о продвижении.'],
  ['orion_step', 'Орион Шаг', 'luminous_synod', 'knight', 'Астральный навигатор, использующий отмеченные клетки приземления.'],
  ['abbess_celene', 'Аббатиса Селена', 'luminous_synod', 'queen', 'Строгая реформаторша с дорогостоящей способностью молчания.'],
  ['deacon_mirel', 'Диакон Мирель', 'luminous_synod', 'bishop', 'Сомневающийся служитель, чья сила растёт от милосердных решений.'],
  ['cassian_coin', 'Кассиан Монета', 'free_cities', 'rook', 'Капитан-купец, превращающий защищённые торговые клетки в приказы.'],
  ['viola_mask', 'Виола Маска', 'free_cities', 'queen', 'Дипломат со способностью, основанной на контракте.'],
  ['renzo_bridge', 'Ренцо Мост', 'free_cities', 'pawn', 'Создаёт временный безопасный маршрут после прогресса к превращению.'],
  ['tessa_gull', 'Тесса Чайка', 'free_cities', 'knight', 'Портовая всадница, способная спасти союзника с фланга.'],
  ['old_marin', 'Старый Марин', 'free_cities', 'bishop', 'Отставной судья, раскрывающий отмеченных противников.'],
  ['elio_silk', 'Элио Шёлк', 'free_cities', 'pawn', 'Шпион, чья ценность заключается в информации, а не в скрытом положении на доске.'],
  ['briar_sister', 'Сестра Терн', 'thorn_covenant', 'bishop', 'Лесная провидица, связывающая две видимые рунические клетки.'],
  ['roan_stag', 'Роан Олень', 'thorn_covenant', 'knight', 'Всадник-хранитель, использующий выходы из порталов.'],
  ['maeve_root', 'Мейв Корень', 'thorn_covenant', 'rook', 'Живой оплот, закрепляющий линию.'],
  ['puck_ember', 'Пак Уголёк', 'thorn_covenant', 'pawn', 'Пешка-трикстер с детерминированным выбором превращения.'],
  ['lord_aylen', 'Лорд Айлен', 'thorn_covenant', 'king', 'Оспариваемый лидер, используемый в сценариях сопровождения.'],
  ['ysra_moss', 'Исра Мох', 'thorn_covenant', 'queen', 'Древняя посредница с разменом, связанным с окружением.'],
  ['kael_cinder', 'Каэль Уголь', 'ashen_dominion', 'pawn', 'Солдат, получающий выбор после добровольной жертвы союзника.'],
  ['velka_urn', 'Велька Урна', 'ashen_dominion', 'bishop', 'Погребальная чародейка, возвращающая память, но не мёртвые тела.'],
  ['rath_banner', 'Рат Знамя', 'ashen_dominion', 'rook', 'Знаменосец, усиливающий построения.'],
  ['suri_ash', 'Сури Пепел', 'ashen_dominion', 'knight', 'Всадница-изгнанница с рискованным спасительным прыжком.'],
  ['empress_nahla', 'Императрица Нахла', 'ashen_dominion', 'queen', 'Возможная правительница или босс с командованием, основанным на долге.'],
  ['daro_last', 'Даро Последний', 'ashen_dominion', 'pawn', 'Выживший, чей шрам изменяет будущие события.'],
  ['temur_wind', 'Темур Ветер', 'sky_khanate', 'knight', 'Подвижный командир с ограниченным ускорением резерва.'],
  ['altana_bow', 'Алтана Лук', 'sky_khanate', 'bishop', 'Диагональная стражница, читающая открытую местность.'],
  ['batu_cliff', 'Бату Утёс', 'sky_khanate', 'rook', 'Хранитель скальной крепости, контролирующий крайние вертикали.'],
  ['saran_dawn', 'Саран Рассвет', 'sky_khanate', 'pawn', 'Молодой посланник с дипломатией превращения.'],
  ['khulan_star', 'Хулан Звезда', 'sky_khanate', 'queen', 'Соперничающая претендентка с темповой командой.'],
  ['ergen_cloud', 'Эрген Облако', 'sky_khanate', 'king', 'Герой сопровождения, явно изменяющий клетки резерва.']
]);

const POLITICAL_ROWS = Object.freeze([
  ['marshal_varn', 'Маршал Варн', 'iron_marches', 'Кандидат военной преемственности.'],
  ['heir_elda', 'Наследница Эльда', 'iron_marches', 'Кандидат династической реформы.'],
  ['guildmaster_borek', 'Цехмейстер Борек', 'iron_marches', 'Промышленные советы и власть рабочих.'],
  ['pontiff_aelia', 'Понтифик Элия', 'luminous_synod', 'Ортодоксальное единство.'],
  ['archivist_noem', 'Архивист Ноэм', 'luminous_synod', 'Истина, архивы и контролируемая реформа.'],
  ['heretic_salos', 'Еретик Салос', 'luminous_synod', 'Радикальный доктринальный разрыв.'],
  ['consul_marco', 'Консул Марко', 'free_cities', 'Торговая олигархия.'],
  ['speaker_ines', 'Спикер Инес', 'free_cities', 'Гражданское собрание и контракты.'],
  ['admiral_rava', 'Адмирал Рава', 'free_cities', 'Безопасность и морская экспансия.'],
  ['warden_roan', 'Хранитель Роан', 'thorn_covenant', 'Традиционный пограничный договор.'],
  ['bride_melis', 'Невеста Мелис', 'thorn_covenant', 'Живой пакт и преображение.'],
  ['huntsman_orr', 'Ловчий Орр', 'thorn_covenant', 'Воинствующая изоляция.'],
  ['empress_nahla_p', 'Императрица Нахла', 'ashen_dominion', 'Имперская преемственность, связанная долгом.'],
  ['general_dor', 'Генерал Дор', 'ashen_dominion', 'Военное восстановление.'],
  ['priestess_velka', 'Жрица Велька', 'ashen_dominion', 'Погребальное право и примирение.'],
  ['khan_temur', 'Каган Темур', 'sky_khanate', 'Военное лидерство конфедерации.'],
  ['princess_khulan', 'Княжна Хулан', 'sky_khanate', 'Централизующая претендентка.'],
  ['speaker_batu', 'Говорящий Бату', 'sky_khanate', 'Собрание кланов и договорное правление.']
]);

function freezeProfile(profile) {
  return Object.freeze(profile);
}

const HERO_PROFILES = Object.freeze(Object.fromEntries(HERO_ROWS.map(([slug, name, factionId, pieceType, brief]) => [slug, freezeProfile({
  id: `hero.${slug}`,
  slug,
  name,
  factionId,
  faction: FACTIONS[factionId].label,
  pieceType,
  piece: PIECE_LABELS[pieceType],
  brief,
  assets: HERO_ASSETS[slug]
})])));

const POLITICAL_PROFILES = Object.freeze(Object.fromEntries(POLITICAL_ROWS.map(([slug, name, factionId, role]) => [slug, freezeProfile({
  id: `politics.${slug}`,
  slug,
  name,
  factionId,
  faction: FACTIONS[factionId].label,
  role,
  assets: POLITICAL_ASSETS[slug]
})])));

const RELIC_LABELS = Object.freeze({
  'relic.echo_shield': 'Эхо-щит',
  'relic.phantom_spurs': 'Призрачные шпоры',
  'relic.circle_warding': 'Круг защиты',
  'relic.twin_command': 'Двойной приказ',
  'relic.royal_decree': 'Королевский указ',
  'relic.oath_fallen': 'Клятва павших'
});

function normalizeSlug(value, prefix) {
  const source = String(value || '');
  const withoutPrefix = prefix && source.startsWith(prefix) ? source.slice(prefix.length) : source;
  return withoutPrefix.replace(/\.png$/i, '');
}

function heroProfile(value) {
  return HERO_PROFILES[normalizeSlug(value, 'hero.')] || null;
}

function politicalProfile(value) {
  return POLITICAL_PROFILES[normalizeSlug(value, 'politics.')] || null;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function heroAssetMarkup(source, label, className, fallback = '♟') {
  return `<span class="rp02-media ${className}"><span aria-hidden="true">${escapeHtml(fallback)}</span><img src="${escapeAttribute(source || '')}" alt="${escapeAttribute(label)}" loading="lazy" onload="this.parentElement.classList.add('is-loaded')" onerror="this.remove()"></span>`;
}

const HERO_MECHANICS = Object.freeze({
  'hero.aldric_wall': Object.freeze({ name: 'Перехват', description: 'Выберите соседнего союзника. Альдрик прикроет его и отменит первое направленное в него взятие.', kind: 'active' }),
  'hero.mara_chain': Object.freeze({ name: 'Цепное построение', description: 'Мара и соседняя союзная пешка одновременно продвигаются на одну свободную клетку вперёд.', kind: 'active' }),
  'hero.brother_orell': Object.freeze({ name: 'Линия кузни', description: 'Создаёт на видимой диагональной клетке временную преграду, меняющую линии движения и шаха.', kind: 'active' }),
  'hero.vael_hammer': Object.freeze({ name: 'Предсказанный натиск', description: 'Выполняет два заранее показанных прыжка коня. Маршрут и итоговая клетка видны до подтверждения.', kind: 'active' }),
  'hero.lady_sorn': Object.freeze({ name: 'Тактика заложника', description: 'Связывает Леди Сорн с соседней вражеской фигурой: обе временно лишаются возможности двигаться.', kind: 'active' }),
  'hero.tomas_gate': Object.freeze({ name: 'Команда ворот', description: 'Открывает или закрывает выбранные ворота, изменяя доступные пути и линии атаки.', kind: 'active' })
});

const RELIC_MECHANICS = Object.freeze({
  'relic.echo_shield': Object.freeze({ name: 'Защита от первого взятия', description: 'Первое законное взятие владельца отменяется. Щит после этого разрушается.', kind: 'passive' }),
  'relic.phantom_spurs': Object.freeze({ name: 'Призрачное уклонение', description: 'После первого хода коня без взятия следующая попытка взять его отменяется.', kind: 'passive' }),
  'relic.circle_warding': Object.freeze({ name: 'Круг защиты', description: 'За одно очко приказа накладывает одноразовую защиту на соседнего союзника.', kind: 'active' }),
  'relic.twin_command': Object.freeze({ name: 'Двойной приказ', description: 'Первая способность владельца в каждом бою стоит на одно очко приказа меньше.', kind: 'passive' }),
  'relic.royal_decree': Object.freeze({ name: 'Королевский указ', description: 'Позволяет один раз превратить пешку на предпоследней линии за два очка приказа.', kind: 'active' }),
  'relic.oath_fallen': Object.freeze({ name: 'Клятва павших', description: 'Пометьте добровольную жертву. Если её возьмут до следующего хода, армия получает очки приказа.', kind: 'active' })
});

function statusLabels(status) {
  if (!status) return Object.freeze([]);
  if (Array.isArray(status)) return Object.freeze(status.map((value) => humanStatus(typeof value === 'object' ? value.id : value)).filter(Boolean));
  if (typeof status === 'string') return Object.freeze(status ? [humanStatus(status)] : []);
  if (typeof status !== 'object') return Object.freeze([]);
  if (status.id) return Object.freeze([humanStatus(status.id)]);
  const result = [];
  for (const [key, value] of Object.entries(status)) {
    if (value == null || value === false || value === 0 || (Array.isArray(value) && !value.length) || key === 'pieceId') continue;
    if (key === 'id') result.push(humanStatus(value));
    else result.push(humanStatus(key));
  }
  return Object.freeze([...new Set(result)]);
}

function mechanicCardMarkup(mechanic, image, typeLabel, modifier = '') {
  if (!mechanic) return '';
  return `<article class="rp02-mechanic-card rp02-mechanic-card--${escapeAttribute(mechanic.kind || 'passive')} ${modifier}">
    <img src="${escapeAttribute(image || '')}" alt="">
    <div><div class="rp02-eyebrow">${escapeHtml(typeLabel)}</div><strong>${escapeHtml(mechanic.name)}</strong><small>${escapeHtml(mechanic.description)}</small></div>
  </article>`;
}


function relicSlotMarkup(relicId, mechanic) {
  const relic = relicId ? relicProfile(relicId) : null;
  if (!relic) return '';
  return `<article class="rp02-relic-slot rp02-mechanic-card--${escapeAttribute(mechanic?.kind || 'passive')}"><img src="${escapeAttribute(relicAsset(relicId))}" alt=""><div><div class="rp02-eyebrow">${mechanic?.kind === 'active' ? 'Активная реликвия' : 'Пассивная реликвия'}</div><strong>${escapeHtml(relic.nameRu)}</strong><small>${escapeHtml(mechanic?.description || 'Реликвия сопровождает героя в этом походе.')}</small></div></article>`;
}

function heroPanelMarkup(recordInput, options = {}) {
  const record = recordInput || {};
  const profile = heroProfile(record.heroId || record.id);
  if (!profile) return '';
  const assets = heroAssets(profile.id);
  const stars = Number.isInteger(record.stars) ? record.stars : Number.isInteger(record.metadata?.stars) ? record.metadata.stars : 0;
  const relicIds = record.relicIds || record.metadata?.relicIds || [];
  const statuses = statusLabels(record.status || record.metadata?.status);
  const pieceType = record.type || record.pieceType || record.metadata?.combatPieceType || profile.pieceType;
  const heroMechanic = HERO_MECHANICS[profile.id];
  const relicId = relicIds[0] || null;
  const relic = relicId ? relicProfile(relicId) : null;
  const relicMechanic = relicId ? RELIC_MECHANICS[relicId] : null;
  const activeCards = [
    mechanicCardMarkup(heroMechanic, assets?.abilityIcon, 'Активная способность'),
    relicMechanic?.kind === 'active' ? relicSlotMarkup(relicId, relicMechanic) : ''
  ].filter(Boolean).join('');
  const passiveCards = [
    relicMechanic?.kind === 'passive' ? relicSlotMarkup(relicId, relicMechanic) : '',
    ...statuses.map((status) => mechanicCardMarkup({ name: status, description: 'Действующий боевой эффект отображается на фигуре и учитывается правилами боя.', kind: 'passive' }, assets?.pieceBadge, 'Текущий эффект'))
  ].filter(Boolean).join('');
  const starLine = stars ? '★'.repeat(Math.min(stars, 5)) : '☆';
  return `<section class="rp02-hero-panel" aria-label="Панель героя ${escapeAttribute(profile.name)}">
    <div class="rp02-hero-panel__portrait">
      ${heroAssetMarkup(assets?.portrait, profile.name, 'rp02-media--portrait', '♚')}
      <div class="rp02-hero-panel__stars" aria-label="${stars || 0} звёзд">${starLine}</div>
    </div>
    <div class="rp02-hero-panel__body">
      <div class="rp02-eyebrow">${escapeHtml(profile.faction)} · ${escapeHtml(PIECE_LABELS[pieceType] || pieceType)}</div>
      <h3>${escapeHtml(profile.name)}</h3>
      <p>${escapeHtml(profile.brief)}</p>
      <div class="rp02-hero-loadout">
        ${activeCards}
        ${passiveCards ? `<div class="rp02-eyebrow">Пассивные эффекты</div>${passiveCards}` : ''}
      </div>
    </div>
  </section>`;
}

function codexCard(profile, section) {
  const political = section === 'politics';
  const assets = political ? politicalAssets(profile.id) : heroAssets(profile.id);
  const description = political ? profile.role : profile.brief;
  return `<article class="rp02-codex-card" data-rp02-faction="${escapeAttribute(profile.factionId)}">
    ${heroAssetMarkup(assets?.portrait, profile.name, 'rp02-media--codex', political ? '♛' : '♟')}
    <div class="rp02-eyebrow">${escapeHtml(profile.faction)}${political ? '' : ` · ${escapeHtml(profile.piece)}`}</div>
    <h3>${escapeHtml(profile.name)}</h3>
    <p>${escapeHtml(description)}</p>
    ${political ? '' : `<div class="rp02-codex-card__icons">${heroAssetMarkup(assets?.pieceBadge, `${profile.name}: знак фигуры`, 'rp02-media--mini', '♟')}${heroAssetMarkup(assets?.abilityIcon, `${profile.name}: способность`, 'rp02-media--mini', '✦')}</div>`}
  </article>`;
}

function codexMarkup(section = 'heroes', factionId = 'all') {
  const profiles = section === 'politics' ? Object.values(POLITICAL_PROFILES) : Object.values(HERO_PROFILES);
  const filtered = factionId === 'all' ? profiles : profiles.filter((profile) => profile.factionId === factionId);
  return `<div class="rp02-codex" role="dialog" aria-modal="true" aria-labelledby="rp02-codex-title">
    <div class="rp02-codex__scrim" data-rp02-close></div>
    <section class="rp02-codex__window">
      <header class="rp02-codex__header"><div><div class="rp02-eyebrow">REGISTER 02</div><h2 id="rp02-codex-title">Кодекс личностей</h2></div><button type="button" class="rp02-codex__close" data-rp02-close aria-label="Закрыть">×</button></header>
      <nav class="rp02-codex__tabs" aria-label="Разделы кодекса"><button type="button" data-rp02-section="heroes" aria-pressed="${section === 'heroes'}">Герои · 36</button><button type="button" data-rp02-section="politics" aria-pressed="${section === 'politics'}">Политика · 18</button></nav>
      <label class="rp02-codex__filter">Фракция<select data-rp02-faction><option value="all">Все фракции</option>${Object.values(FACTIONS).map((faction) => `<option value="${faction.id}" ${faction.id === factionId ? 'selected' : ''}>${escapeHtml(faction.label)}</option>`).join('')}</select></label>
      <div class="rp02-codex__grid">${filtered.map((profile) => codexCard(profile, section)).join('')}</div>
    </section>
  </div>`;
}

function ensureCodexStyles(document) {
  if (!document || document.getElementById('rp02-codex-styles')) return;
  const style = document.createElement('style');
  style.id = 'rp02-codex-styles';
  style.textContent = `
    .rp02-codex-launch{padding:7px 11px;border:1px solid #9d8148;border-radius:999px;background:#151f31;color:#f7e7b0;font-weight:750;cursor:pointer}.rp02-codex-launch:hover{border-color:#f0c96e}.rp02-codex-launch:focus-visible{outline:3px solid #78c9ff;outline-offset:3px}
    .rp02-codex{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;padding:22px;color:#f4ead6;font:15px/1.4 system-ui,sans-serif}.rp02-codex__scrim{position:absolute;inset:0;background:#02050bd9;backdrop-filter:blur(7px)}.rp02-codex__window{position:relative;width:min(1240px,100%);max-height:92vh;display:grid;grid-template-rows:auto auto auto 1fr;overflow:hidden;border:1px solid #9b7e43;border-radius:20px;background:linear-gradient(145deg,#111b2c,#080e18);box-shadow:0 30px 100px #000}.rp02-codex__header{display:flex;justify-content:space-between;align-items:center;padding:19px 22px;border-bottom:1px solid #6f5b34}.rp02-codex h2,.rp02-codex h3,.rp02-hero-panel h3{margin:0;font-family:Georgia,serif}.rp02-codex__close{width:42px;height:42px;border:1px solid #7d6d4b;border-radius:50%;background:#1b2638;color:#fff;font-size:27px;cursor:pointer}.rp02-codex__tabs{display:flex;gap:8px;padding:12px 22px}.rp02-codex__tabs button{padding:9px 14px;border:1px solid #526782;border-radius:9px;background:#17253a;color:#f4ead6;cursor:pointer}.rp02-codex__tabs button[aria-pressed=true]{border-color:#e5bc60;background:#5c461a}.rp02-codex__filter{display:flex;align-items:center;gap:10px;padding:0 22px 13px;color:#b9c5d6}.rp02-codex__filter select{padding:8px 10px;border:1px solid #526782;border-radius:8px;background:#101b2b;color:#f4ead6}.rp02-codex__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;overflow:auto;padding:4px 22px 24px}.rp02-codex-card{display:grid;align-content:start;gap:8px;padding:12px;border:1px solid #415472;border-radius:13px;background:linear-gradient(#16243a,#0d1624)}.rp02-codex-card h3{font-size:18px}.rp02-codex-card p{margin:0;color:#bdc8d8}.rp02-codex-card__icons{display:flex;gap:7px;margin-top:auto}.rp02-eyebrow{color:#e2bd67;font-size:11px;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.rp02-media{position:relative;display:grid;place-items:center;overflow:hidden;background:#08111e;color:#8fa7cf}.rp02-media>img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0}.rp02-media.is-loaded>img{opacity:1}.rp02-media.is-loaded>span{opacity:0}.rp02-media--codex{aspect-ratio:1;border-radius:10px;font-size:52px}.rp02-media--mini{width:42px;height:42px;border-radius:8px;font-size:24px}.rp02-media--portrait{width:112px;aspect-ratio:1;border-radius:14px;font-size:54px}.rp02-media--badge,.rp02-media--ability{width:52px;height:52px;border-radius:9px;font-size:27px}
    .rp02-hero-panel{display:grid;grid-template-columns:112px 1fr;gap:13px;margin-bottom:14px;padding:12px;border:1px solid #8b7443;border-radius:13px;background:linear-gradient(145deg,#18273e,#0d1725)}.rp02-hero-panel__body{min-width:0}.rp02-hero-panel__body>p{margin:.35em 0 .7em;color:#bbc7d8}.rp02-hero-panel__icons{display:grid;grid-template-columns:52px 52px 1fr;gap:8px;align-items:center}.rp02-hero-panel__icons>div{display:grid}.rp02-hero-panel__icons span{color:#b9c5d6;font-size:12px}.rp02-hero-panel__facts{display:grid;gap:5px;margin:10px 0 0}.rp02-hero-panel__facts>div{display:grid;grid-template-columns:78px 1fr;gap:7px}.rp02-hero-panel__facts dt{color:#8fa0b8}.rp02-hero-panel__facts dd{margin:0;color:#f4ead6}.rp02-piece-image{display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 7px #000b)}.rp02-selection-brief{display:block;color:#b8c4d5!important;line-height:1.35}
    @media(max-width:700px){.rp02-codex{padding:7px}.rp02-codex__window{max-height:97vh;border-radius:13px}.rp02-codex__grid{grid-template-columns:repeat(2,minmax(0,1fr));padding:4px 10px 16px}.rp02-codex__header,.rp02-codex__tabs,.rp02-codex__filter{padding-left:12px;padding-right:12px}.rp02-hero-panel{grid-template-columns:82px 1fr}.rp02-media--portrait{width:82px}.rp02-hero-panel__icons{grid-template-columns:44px 44px 1fr}.rp02-media--badge,.rp02-media--ability{width:44px;height:44px}}@media(max-width:430px){.rp02-codex__grid{grid-template-columns:1fr}.rp02-hero-panel{grid-template-columns:1fr}.rp02-media--portrait{width:100%;max-width:150px}}
  `;
  document.head.appendChild(style);
}

function openRegister02Codex(root, initialSection = 'heroes') {
  const document = root?.ownerDocument || globalThis.document;
  if (!document) return null;
  ensureCodexStyles(document);
  let section = initialSection === 'politics' ? 'politics' : 'heroes';
  let factionId = 'all';
  const host = document.createElement('div');
  let keydown = null;
  const close = () => {
    if (keydown) document.removeEventListener('keydown', keydown);
    host.remove();
  };
  const render = () => {
    host.innerHTML = codexMarkup(section, factionId);
    for (const button of host.querySelectorAll('[data-rp02-close]')) button.addEventListener('click', close);
    for (const button of host.querySelectorAll('[data-rp02-section]')) button.addEventListener('click', () => { section = button.dataset.rp02Section; factionId = 'all'; render(); });
    host.querySelector('[data-rp02-faction]')?.addEventListener('change', (event) => { factionId = event.target.value; render(); });
    host.querySelector('.rp02-codex__close')?.focus();
  };
  keydown = (event) => { if (event.key === 'Escape') close(); };
  document.addEventListener('keydown', keydown);
  render();
  document.body.appendChild(host);
  return host;
}

function installRegister02Codex(root, options = {}) {
  const document = root?.ownerDocument || globalThis.document;
  if (!root || !document) return null;
  ensureCodexStyles(document);
  const target = root.querySelector(options.target || '.rpvs__resources') || root.querySelector('.rprs__hero-copy') || root.querySelector('header') || root;
  if (target.querySelector('[data-rp02-codex-launch]')) return target.querySelector('[data-rp02-codex-launch]');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rp02-codex-launch';
  button.dataset.rp02CodexLaunch = '';
  button.textContent = options.label || 'Кодекс';
  button.addEventListener('click', () => openRegister02Codex(root, options.section || 'heroes'));
  target.appendChild(button);
  return button;
}

export {
  FACTIONS,
  PIECE_LABELS,
  HERO_PROFILES,
  POLITICAL_PROFILES,
  RELIC_LABELS,
  heroProfile,
  politicalProfile,
  statusLabels,
  heroPanelMarkup,
  codexMarkup,
  ensureCodexStyles,
  openRegister02Codex,
  installRegister02Codex
};
