import { PIECE_VALUES } from './roster-data.mjs';
import { seededRandom } from './travel-choice-core.mjs';

const SETTLEMENT_OFFER_COUNT = 3;
const SETTLEMENT_SUPPLY_PRICE = 12;
const SETTLEMENT_SUPPLY_STOCK = 4;

const HEAL_COSTS = Object.freeze({
  pawn: 10,
  knight: 18,
  bishop: 18,
  rook: 26,
  queen: 42
});

const RECRUIT_COSTS = Object.freeze({
  pawn: 24,
  knight: 42,
  bishop: 42,
  rook: 64,
  queen: 96
});

const ORIGINS = Object.freeze({
  iron_marches: 'Железные Марши',
  luminous_synod: 'Светлый Синод',
  free_cities: 'Вольные Города',
  thorn_covenant: 'Терновый Завет',
  ashen_dominion: 'Пепельный Доминион',
  sky_khanate: 'Небесный Каганат'
});

const RECRUIT_ROWS = Object.freeze([
  ['aldric_wall', 'Альдрик Стена', 'iron_marches', 'rook', 'Ветеран пограничных гарнизонов, привыкший держать линию до последнего.'],
  ['mara_chain', 'Мара Цепь', 'iron_marches', 'pawn', 'Упрямая воительница из низших рядов, для которой каждый шаг вперёд имеет цену.'],
  ['brother_orell', 'Брат Орелл', 'iron_marches', 'bishop', 'Жрец-кузнец, читающий поле боя так же внимательно, как линии на раскалённом металле.'],
  ['vael_hammer', 'Ваэль Молот', 'iron_marches', 'knight', 'Тяжёлый всадник, предпочитающий решительный манёвр долгому ожиданию.'],
  ['lady_sorn', 'Леди Сорн', 'iron_marches', 'queen', 'Знатная тактик, чьи решения редко бывают осторожными.'],
  ['seraph_lyra', 'Серафима Лира', 'luminous_synod', 'bishop', 'Паломница Светлого Синода, привыкшая видеть путь там, где другие замечают лишь стены.'],
  ['ivar_lens', 'Ивар Линза', 'luminous_synod', 'rook', 'Инженер-наблюдатель, который ценит надёжные позиции и ясный обзор.'],
  ['nemea_quill', 'Немея Перо', 'luminous_synod', 'pawn', 'Учёная-путешественница, записывающая историю похода на ходу.'],
  ['orion_step', 'Орион Шаг', 'luminous_synod', 'knight', 'Астральный навигатор, всегда ищущий неожиданный путь через поле.'],
  ['abbess_celene', 'Аббатиса Селена', 'luminous_synod', 'queen', 'Строгая реформаторша, привыкшая брать на себя тяжесть окончательного решения.'],
  ['deacon_mirel', 'Диакон Мирель', 'luminous_synod', 'bishop', 'Молодой служитель, разрывающийся между догмой и состраданием.'],
  ['cassian_coin', 'Кассиан Монета', 'free_cities', 'rook', 'Капитан-купец, способный превратить любую остановку в выгодную сделку.'],
  ['viola_mask', 'Виола Маска', 'free_cities', 'queen', 'Дипломатка, умеющая улыбаться даже в момент самого жёсткого торга.'],
  ['renzo_bridge', 'Ренцо Мост', 'free_cities', 'pawn', 'Проводник и строитель, привыкший соединять места, которые никто не считал совместимыми.'],
  ['tessa_gull', 'Тесса Чайка', 'free_cities', 'knight', 'Портовая всадница, для которой скорость важнее парадного строя.'],
  ['old_marin', 'Старый Марин', 'free_cities', 'bishop', 'Отставной судья, помнящий слишком много старых долгов и договоров.'],
  ['elio_silk', 'Элио Шёлк', 'free_cities', 'pawn', 'Тихий разведчик, предпочитающий замечать детали раньше остальных.'],
  ['briar_sister', 'Сестра Терн', 'thorn_covenant', 'bishop', 'Лесная провидица, говорящая о дорогах так, будто они живые.'],
  ['roan_stag', 'Роан Олень', 'thorn_covenant', 'knight', 'Хранитель лесных трактов, привыкший появляться там, где его не ждут.'],
  ['maeve_root', 'Мейв Корень', 'thorn_covenant', 'rook', 'Невозмутимая защитница, которую трудно сдвинуть с выбранной позиции.'],
  ['puck_ember', 'Пак Уголёк', 'thorn_covenant', 'pawn', 'Неугомонный трикстер, всегда находящий ещё один путь вперёд.'],
  ['ysra_moss', 'Исра Мох', 'thorn_covenant', 'queen', 'Древняя посредница, которая говорит медленно, но принимает решения быстро.'],
  ['kael_cinder', 'Каэль Уголь', 'ashen_dominion', 'pawn', 'Закалённый солдат, переживший слишком много поражений, чтобы бояться ещё одного боя.'],
  ['velka_urn', 'Велька Урна', 'ashen_dominion', 'bishop', 'Погребальная жрица, хранящая память о тех, кто не дошёл до конца пути.'],
  ['rath_banner', 'Рат Знамя', 'ashen_dominion', 'rook', 'Знаменосец, вокруг которого отряд невольно выстраивается ровнее.'],
  ['suri_ash', 'Сури Пепел', 'ashen_dominion', 'knight', 'Всадница-изгнанница, предпочитающая риск бездействию.'],
  ['empress_nahla', 'Императрица Нахла', 'ashen_dominion', 'queen', 'Правительница без двора, всё ещё несущая себя так, будто трон рядом.'],
  ['daro_last', 'Даро Последний', 'ashen_dominion', 'pawn', 'Выживший после падения своего отряда, не привыкший бросать начатое.'],
  ['temur_wind', 'Темур Ветер', 'sky_khanate', 'knight', 'Подвижный командир степных отрядов, мыслящий дорогами и дистанциями.'],
  ['altana_bow', 'Алтана Лук', 'sky_khanate', 'bishop', 'Стражница открытых пространств, привыкшая видеть опасность издалека.'],
  ['batu_cliff', 'Бату Утёс', 'sky_khanate', 'rook', 'Хранитель скальной крепости с привычкой стоять до конца.'],
  ['saran_dawn', 'Саран Рассвет', 'sky_khanate', 'pawn', 'Молодой посланник, который ещё верит, что любую вражду можно пережить.'],
  ['khulan_star', 'Хулан Звезда', 'sky_khanate', 'queen', 'Амбициозная претендентка, привыкшая превращать любой поход в проверку лидерства.']
]);

const RECRUIT_LIBRARY = Object.freeze(RECRUIT_ROWS.map(([slug, name, factionId, pieceType, description]) => Object.freeze({
  id: `hero.${slug}`,
  slug,
  name,
  pieceType,
  origin: ORIGINS[factionId],
  portrait: `assets/heroes/${slug}/portrait.png`,
  pieceArt: `assets/heroes/${slug}/piece_badge.png`,
  description,
  isRunKing: false,
  commandCost: PIECE_VALUES[pieceType] ?? 0,
  status: 'healthy'
})));

const RECRUIT_BY_ID = Object.freeze(Object.fromEntries(RECRUIT_LIBRARY.map((candidate) => [candidate.id, candidate])));

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function recruitProfile(id) {
  return RECRUIT_BY_ID[id] || null;
}

function deterministicRecruitOffers({ seed, roster = [] } = {}) {
  if (!seed) throw new Error('Settlement recruit offers require a seed');
  const excluded = new Set((roster || []).map((character) => character?.id).filter(Boolean));
  const eligible = RECRUIT_LIBRARY.filter((candidate) => candidate.pieceType !== 'king' && !excluded.has(candidate.id));
  if (eligible.length < SETTLEMENT_OFFER_COUNT) throw new Error('Not enough eligible named heroes for Settlement offers');
  const random = seededRandom(`${seed}:settlement:recruits`);
  return shuffled(eligible, random).slice(0, SETTLEMENT_OFFER_COUNT).map((candidate) => candidate.id);
}

function isSettlementState(value) {
  if (!value || typeof value !== 'object') return false;
  if (!value.routeId || typeof value.routeId !== 'string') return false;
  if (!value.seed || typeof value.seed !== 'string') return false;
  if (!Array.isArray(value.offers) || value.offers.length !== SETTLEMENT_OFFER_COUNT) return false;
  if (new Set(value.offers).size !== SETTLEMENT_OFFER_COUNT) return false;
  if (!value.offers.every((id) => Boolean(recruitProfile(id)))) return false;
  if (!Number.isInteger(value.supplyStock) || value.supplyStock < 0 || value.supplyStock > SETTLEMENT_SUPPLY_STOCK) return false;
  return true;
}

function createSettlementState(run, choice) {
  if (!run || !choice || choice.type !== 'settlement') throw new Error('Settlement state requires an active settlement route');
  if (isSettlementState(run.currentSettlement) && run.currentSettlement.routeId === choice.id && run.currentSettlement.seed === choice.seed) {
    return run.currentSettlement;
  }
  return {
    routeId: choice.id,
    seed: choice.seed,
    offers: deterministicRecruitOffers({ seed: choice.seed, roster: run.roster }),
    supplyStock: SETTLEMENT_SUPPLY_STOCK
  };
}

function healCost(character) {
  return HEAL_COSTS[character?.pieceType] ?? null;
}

function recruitCost(candidate) {
  return RECRUIT_COSTS[candidate?.pieceType] ?? null;
}

function applyHealing(run, characterId) {
  const character = run?.roster?.find((entry) => entry.id === characterId);
  if (!character || character.isRunKing || character.status !== 'wounded') return { run, success: false, spent: 0, reason: 'not-healable' };
  const price = healCost(character);
  if (!Number.isInteger(price)) return { run, success: false, spent: 0, reason: 'unsupported-piece' };
  if ((run.gold || 0) < price) return { run, success: false, spent: 0, reason: 'insufficient-gold' };
  return {
    run: {
      ...run,
      gold: run.gold - price,
      roster: run.roster.map((entry) => entry.id === characterId ? { ...entry, status: 'healthy' } : entry)
    },
    success: true,
    spent: price,
    reason: 'healed'
  };
}

function applyRecruitment(run, candidateId) {
  const candidate = recruitProfile(candidateId);
  if (!candidate || !isSettlementState(run?.currentSettlement) || !run.currentSettlement.offers.includes(candidateId)) {
    return { run, success: false, spent: 0, reason: 'not-offered' };
  }
  if ((run.roster || []).some((entry) => entry.id === candidateId)) return { run, success: false, spent: 0, reason: 'already-present' };
  const price = recruitCost(candidate);
  if (!Number.isInteger(price)) return { run, success: false, spent: 0, reason: 'unsupported-piece' };
  if ((run.gold || 0) < price) return { run, success: false, spent: 0, reason: 'insufficient-gold' };
  const recruit = { ...candidate, status: 'healthy', isRunKing: false };
  return {
    run: { ...run, gold: run.gold - price, roster: [...run.roster, recruit] },
    success: true,
    spent: price,
    reason: 'recruited',
    recruit
  };
}

function applySupplyPurchase(run) {
  if (!isSettlementState(run?.currentSettlement)) return { run, success: false, spent: 0, suppliesAdded: 0, reason: 'no-settlement' };
  if (run.currentSettlement.supplyStock <= 0) return { run, success: false, spent: 0, suppliesAdded: 0, reason: 'sold-out' };
  if ((run.gold || 0) < SETTLEMENT_SUPPLY_PRICE) return { run, success: false, spent: 0, suppliesAdded: 0, reason: 'insufficient-gold' };
  return {
    run: {
      ...run,
      gold: run.gold - SETTLEMENT_SUPPLY_PRICE,
      supplies: (run.supplies || 0) + 1,
      currentSettlement: {
        ...run.currentSettlement,
        supplyStock: run.currentSettlement.supplyStock - 1
      }
    },
    success: true,
    spent: SETTLEMENT_SUPPLY_PRICE,
    suppliesAdded: 1,
    reason: 'purchased'
  };
}

function completeSettlement(run) {
  if (!run || run.activeTravelChoice?.type !== 'settlement') return run;
  return { ...run, activeTravelChoice: null, currentSettlement: null };
}

export {
  SETTLEMENT_OFFER_COUNT,
  SETTLEMENT_SUPPLY_PRICE,
  SETTLEMENT_SUPPLY_STOCK,
  HEAL_COSTS,
  RECRUIT_COSTS,
  RECRUIT_LIBRARY,
  recruitProfile,
  deterministicRecruitOffers,
  isSettlementState,
  createSettlementState,
  healCost,
  recruitCost,
  applyHealing,
  applyRecruitment,
  applySupplyPurchase,
  completeSettlement
};
