'use strict';

const { hash32 } = require('../core/determinism.cjs');

const PRODUCTION_ECONOMY_SCHEMA_VERSION = 1;
const START_SUPPLIES = 10;
const START_GOLD = 80;
const INTER_ACT_SUPPLY_TO_GOLD = 5;
const GOLD_REWARD_VALUES = Object.freeze([30, 50, 70]);
const SUPPLY_REWARD = 3;
const PRICE_BANDS = Object.freeze({
  small: Object.freeze([20, 30]),
  standard: Object.freeze([40, 60]),
  large: Object.freeze([70, 100]),
  exceptional: Object.freeze([110, 140])
});
const HOSPITAL_PRICES = Object.freeze({ oneLight: 25, allLight: 50, heroHeavy: 60, emergency: 90 });
const FORGE_PRICES = Object.freeze({ commonUpgrade: 50, rareUpgrade: 80, remove: 30, reforge: 60 });

function freezeArray(values) { return Object.freeze((values || []).slice()); }
function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return value;
}
function unique(values) { return [...new Set(values || [])]; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function economyLedger(stageB) {
  return Array.isArray(stageB?.economy?.ledger) ? stageB.economy.ledger : [];
}
function appendLedger(stageB, type, payload = {}) {
  const economy = { ...(stageB.economy || {}) };
  const ledger = [...economyLedger(stageB), deepFreeze({ index: economyLedger(stageB).length, type, ...clone(payload) })];
  return deepFreeze({ ...stageB, economy: { ...economy, ledger: freezeArray(ledger) } });
}
function productionizeStageB(stageB) {
  const economy = stageB.economy || {};
  return deepFreeze({
    ...stageB,
    draft: stageB.draft ? { ...stageB.draft, crownBonus: { ...(stageB.draft.crownBonus || {}), supplies: 0 } } : stageB.draft,
    relicInventory: freezeArray(stageB.relicInventory || []),
    relicUpgrades: deepFreeze({ ...(stageB.relicUpgrades || {}) }),
    economy: {
      ...economy,
      goldEarned: Number(economy.goldEarned || 0),
      goldSpent: Number(economy.goldSpent || 0),
      suppliesEarned: Number(economy.suppliesEarned || 0),
      suppliesSpent: Number(economy.suppliesSpent || 0),
      serviceVisits: Number(economy.serviceVisits || 0),
      ledger: freezeArray(economy.ledger || [])
    },
    productionEconomy: deepFreeze({ schemaVersion: PRODUCTION_ECONOMY_SCHEMA_VERSION })
  });
}

function rewardGold(seed, nodeId) {
  return GOLD_REWARD_VALUES[hash32(`${Number(seed || 1)}:${nodeId || 'node'}:gold-reward`) % GOLD_REWARD_VALUES.length];
}
function powerReward(seed, nodeId, elite = false) {
  const kinds = elite ? ['relic', 'recruit', 'temporary'] : ['relic', 'recruit', 'temporary'];
  const type = kinds[hash32(`${Number(seed || 1)}:${nodeId || 'node'}:power-reward`) % kinds.length];
  if (type === 'relic') return deepFreeze({ type, payload: { rarity: elite ? 'rare' : 'common', relicId: `relic.reward.${hash32(`${seed}:${nodeId}:relic`).toString(36)}` } });
  if (type === 'recruit') {
    const pieceTypes = ['p', 'n', 'b', 'r'];
    return deepFreeze({ type, payload: { pieceType: pieceTypes[hash32(`${seed}:${nodeId}:recruit`) % pieceTypes.length] } });
  }
  const effects = ['effect.temp_order_bonus', 'effect.temp_ward', 'effect.temp_supply_discount'];
  return deepFreeze({ type, payload: { effectId: effects[hash32(`${seed}:${nodeId}:temporary`) % effects.length] } });
}
function productionRewardOffers(stageB, context = {}) {
  const nodeId = String(context.nodeId || `reward-${stageB.rewardHistory?.length || 0}`);
  const seed = Number(stageB.seed || context.seed || 1);
  const power = powerReward(seed, nodeId, Boolean(context.elite));
  const bonus = context.sideObjectiveCompleted
    ? (context.sideObjectiveReward === 'gold'
      ? deepFreeze({ type: 'gold', amount: 10 })
      : deepFreeze({ type: 'supplies', amount: 1 }))
    : null;
  const offers = [
    deepFreeze({ id: `reward:${nodeId}:power`, type: power.type, payload: power.payload, bonus, title: power.type === 'relic' ? 'Реликвия' : power.type === 'recruit' ? 'Пополнение' : 'Временное усиление', description: 'Получить силовое предложение. Выбор закрывает остальные варианты.' }),
    deepFreeze({ id: `reward:${nodeId}:supplies`, type: 'supplies', payload: { supplies: SUPPLY_REWARD }, bonus, title: 'Припасы', description: `Получить ${SUPPLY_REWARD} припаса. Выбор закрывает остальные варианты.` }),
    deepFreeze({ id: `reward:${nodeId}:gold`, type: 'gold', payload: { gold: rewardGold(seed, nodeId) }, bonus, title: 'Золото', description: 'Получить фиксированную денежную награду. Выбор закрывает остальные варианты.' })
  ];
  return deepFreeze({
    ...stageB,
    status: 'reward_choice',
    pendingRewardOffers: freezeArray(offers),
    history: freezeArray([...(stageB.history || []), deepFreeze({ index: stageB.history?.length || 0, type: 'production_reward_offers_generated', payload: { nodeId, offerIds: offers.map((offer) => offer.id) } })])
  });
}
function rewardRecruitRecord(stageB, offer) {
  const type = offer.payload.pieceType;
  return deepFreeze({
    id: `regular:reward-${(stageB.rewardHistory?.length || 0) + 1}`,
    kind: 'regular', type, name: ({ p: 'Пешка', n: 'Конь', b: 'Слон', r: 'Ладья' })[type] || type,
    source: 'reward', active: false, reserve: true, available: true, injury: null, skipBattles: 0,
    criticalRisk: false, stars: 0, merits: 0, talentChoices: freezeArray([]), talents: freezeArray([]), relicIds: freezeArray([]), relicSlots: 0,
    battlesActive: 0, battlesReserve: 0
  });
}
function chooseProductionReward(stageBInput, offerId, options = {}) {
  const stageB = productionizeStageB(stageBInput);
  if (stageB.status !== 'reward_choice') throw new Error('no production reward choice is pending');
  const offer = stageB.pendingRewardOffers.find((entry) => entry.id === offerId);
  if (!offer) throw new Error('production reward offer is unavailable');
  let roster = stageB.roster.slice();
  let relicInventory = stageB.relicInventory.slice();
  let temporaryEffects = stageB.temporaryEffects.slice();
  const economy = { ...stageB.economy };
  if (offer.type === 'recruit') roster.push(rewardRecruitRecord(stageB, offer));
  if (offer.type === 'relic') relicInventory.push(offer.payload.relicId);
  if (offer.type === 'temporary') temporaryEffects.push(offer.payload.effectId);
  if (offer.type === 'gold') economy.goldEarned += Number(offer.payload.gold || 0) + Number(offer.bonus?.type === 'gold' ? offer.bonus.amount : 0);
  if (offer.type === 'supplies') economy.suppliesEarned += Number(offer.payload.supplies || 0) + Number(offer.bonus?.type === 'supplies' ? offer.bonus.amount : 0);
  const record = deepFreeze({ id: offer.id, type: offer.type, payload: offer.payload, bonus: offer.bonus || null, nodeId: options.nodeId || null });
  let next = deepFreeze({
    ...stageB,
    status: 'campaign',
    roster: freezeArray(roster),
    relicInventory: freezeArray(unique(relicInventory)),
    temporaryEffects: freezeArray(unique(temporaryEffects)),
    pendingRewardOffers: freezeArray([]),
    rewardHistory: freezeArray([...(stageB.rewardHistory || []), record]),
    economy: deepFreeze(economy),
    history: freezeArray([...(stageB.history || []), deepFreeze({ index: stageB.history?.length || 0, type: 'production_reward_selected', payload: record })])
  });
  next = appendLedger(next, 'reward_selected', {
    nodeId: record.nodeId,
    offerId: offer.id,
    goldDelta: Number(offer.type === 'gold' ? offer.payload.gold : 0) + Number(offer.bonus?.type === 'gold' ? offer.bonus.amount : 0),
    suppliesDelta: Number(offer.type === 'supplies' ? offer.payload.supplies : 0) + Number(offer.bonus?.type === 'supplies' ? offer.bonus.amount : 0)
  });
  return next;
}

function shopOffers(seed, nodeId) {
  const relicPrice = hash32(`${seed}:${nodeId}:shop:relic`) % 2 ? 80 : 50;
  const piecePrice = hash32(`${seed}:${nodeId}:shop:piece`) % 2 ? 90 : 60;
  const exceptionalPrice = 110 + (hash32(`${seed}:${nodeId}:shop:exceptional`) % 4) * 10;
  return freezeArray([
    deepFreeze({ id: 'shop.supplies', action: 'buy_supplies', category: 'resource', cost: 30, title: 'Купить 2 припаса', payload: { supplies: 2 }, singleUse: true }),
    deepFreeze({ id: 'shop.relic', action: 'buy_relic', category: 'relic', cost: relicPrice, title: 'Купить реликвию', payload: { relicId: `relic.shop.${hash32(`${seed}:${nodeId}:relic-id`).toString(36)}`, rarity: relicPrice === 80 ? 'rare' : 'common' }, singleUse: true }),
    deepFreeze({ id: 'shop.piece', action: 'piece_upgrade', category: 'piece', cost: piecePrice, title: 'Усилить фигуру', payload: { stars: 1 }, singleUse: true }),
    deepFreeze({ id: 'shop.regional', action: 'regional_item', category: 'regional', cost: exceptionalPrice, title: 'Редкий товар Железных Маршей', payload: { effectId: 'effect.iron_marches.exceptional_supply_contract' }, singleUse: true })
  ]);
}
function hospitalOffers() {
  return freezeArray([
    deepFreeze({ id: 'hospital.light_one', action: 'heal_light_one', cost: HOSPITAL_PRICES.oneLight, title: 'Снять одно лёгкое ранение', singleUse: true }),
    deepFreeze({ id: 'hospital.light_all', action: 'heal_light_all', cost: HOSPITAL_PRICES.allLight, title: 'Снять все лёгкие ранения', singleUse: true }),
    deepFreeze({ id: 'hospital.hero_heavy', action: 'heal_hero_heavy', cost: HOSPITAL_PRICES.heroHeavy, title: 'Лечить тяжёлое ранение героя', singleUse: true }),
    deepFreeze({ id: 'hospital.emergency', action: 'emergency_operation', cost: HOSPITAL_PRICES.emergency, title: 'Экстренная операция', singleUse: true })
  ]);
}
function forgeOffers(seed, nodeId) {
  return freezeArray([
    deepFreeze({ id: 'forge.upgrade_common', action: 'upgrade_relic', cost: FORGE_PRICES.commonUpgrade, title: 'Улучшить обычную реликвию', payload: { rarity: 'common' }, singleUse: true }),
    deepFreeze({ id: 'forge.upgrade_rare', action: 'upgrade_relic', cost: FORGE_PRICES.rareUpgrade, title: 'Улучшить редкую реликвию', payload: { rarity: 'rare' }, singleUse: true }),
    deepFreeze({ id: 'forge.remove', action: 'remove_relic', cost: FORGE_PRICES.remove, title: 'Безопасно снять реликвию', singleUse: true }),
    deepFreeze({ id: 'forge.reforge', action: 'reforge_relic', cost: FORGE_PRICES.reforge, title: 'Перековать реликвию той же редкости', payload: { resultRelicId: `relic.reforged.${hash32(`${seed}:${nodeId}:reforge`).toString(36)}` }, singleUse: true })
  ]);
}
function campOffers() {
  return freezeArray([
    deepFreeze({ id: 'camp.supplies', action: 'camp_supplies', cost: 0, title: 'Получить 1 припас', singleUse: true }),
    deepFreeze({ id: 'camp.heal', action: 'camp_heal_light', cost: 0, title: 'Снять лёгкое ранение обычной фигуры', singleUse: true }),
    deepFreeze({ id: 'camp.bonus', action: 'camp_next_battle_bonus', cost: 0, title: 'Получить временный бонус следующего боя', singleUse: true }),
    deepFreeze({ id: 'camp.scout', action: 'camp_free_scout', cost: 0, title: 'Получить бесплатную разведку соседнего узла', singleUse: true })
  ]);
}
function productionServiceState(stageBInput, serviceType, options = {}) {
  const stageB = productionizeStageB(stageBInput);
  const nodeId = String(options.nodeId || serviceType);
  const seed = Number(stageB.seed || 1);
  const offers = serviceType === 'shop' ? shopOffers(seed, nodeId)
    : serviceType === 'hospital' ? hospitalOffers()
      : serviceType === 'forge' ? forgeOffers(seed, nodeId)
        : serviceType === 'camp' ? campOffers()
          : null;
  if (!offers) throw new Error(`unsupported production service type: ${serviceType}`);
  const service = deepFreeze({
    schemaVersion: 1,
    type: serviceType,
    nodeId,
    offers,
    usedOfferIds: freezeArray([]),
    oneActionOnly: serviceType === 'camp',
    warning: serviceType === 'camp' ? 'Лагерь даёт ровно одно бесплатное действие.' : 'Каждая позиция используется не более одного раза за посещение.'
  });
  let next = deepFreeze({ ...stageB, status: 'service', service, history: freezeArray([...(stageB.history || []), deepFreeze({ index: stageB.history?.length || 0, type: 'production_service_entered', payload: { serviceType, nodeId } })]) });
  next = appendLedger(next, 'service_entered', { serviceType, nodeId });
  return next;
}
function ensureTarget(stageB, targetId) {
  const target = stageB.roster.find((entry) => entry.id === targetId);
  if (!target) throw new Error('service target figure is required');
  return target;
}
function replaceRoster(stageB, targetId, updater) {
  return stageB.roster.map((entry) => entry.id === targetId ? deepFreeze(updater(entry)) : entry);
}
function useProductionService(stageBInput, offerId, options = {}) {
  const stageB = productionizeStageB(stageBInput);
  if (stageB.status !== 'service' || !stageB.service) throw new Error('no production service is active');
  const offer = stageB.service.offers.find((entry) => entry.id === offerId);
  if (!offer) throw new Error('production service offer is unavailable');
  if (stageB.service.usedOfferIds.includes(offerId)) throw new Error('service offer was already used during this visit');
  const gold = Number(options.gold || 0);
  if (gold < offer.cost) throw new Error('not enough gold for service');
  let roster = stageB.roster.slice();
  let relicInventory = stageB.relicInventory.slice();
  let relicUpgrades = { ...stageB.relicUpgrades };
  let temporaryEffects = stageB.temporaryEffects.slice();
  let supplyDelta = 0;
  let scoutingDelta = 0;
  const targetId = options.targetRosterId || null;
  const targetRelicId = options.targetRelicId || null;

  if (offer.action === 'buy_supplies') supplyDelta += Number(offer.payload.supplies || 0);
  else if (offer.action === 'buy_relic') relicInventory.push(offer.payload.relicId);
  else if (offer.action === 'piece_upgrade') {
    ensureTarget(stageB, targetId);
    roster = replaceRoster(stageB, targetId, (entry) => ({ ...entry, stars: Math.min(3, Number(entry.stars || 0) + 1) }));
  } else if (offer.action === 'regional_item') temporaryEffects.push(offer.payload.effectId);
  else if (offer.action === 'heal_light_one') {
    const target = ensureTarget(stageB, targetId);
    if (target.injury !== 'light') throw new Error('target does not have a light injury');
    roster = replaceRoster(stageB, targetId, (entry) => ({ ...entry, injury: null, skipBattles: 0, available: true, criticalRisk: false }));
  } else if (offer.action === 'heal_light_all') {
    roster = stageB.roster.map((entry) => entry.injury === 'light' ? deepFreeze({ ...entry, injury: null, skipBattles: 0, available: true, criticalRisk: false }) : entry);
  } else if (offer.action === 'heal_hero_heavy' || offer.action === 'emergency_operation') {
    const target = ensureTarget(stageB, targetId);
    if (target.kind !== 'hero' || target.injury !== 'heavy') throw new Error('target must be a hero with a heavy injury');
    roster = replaceRoster(stageB, targetId, (entry) => ({ ...entry, injury: null, skipBattles: 0, available: true, criticalRisk: false }));
    if (offer.action === 'emergency_operation') temporaryEffects.push('effect.emergency_operation.next_battle');
  } else if (offer.action === 'upgrade_relic') {
    if (!targetRelicId) throw new Error('targetRelicId is required for relic upgrade');
    relicUpgrades[targetRelicId] = Math.min(3, Number(relicUpgrades[targetRelicId] || 0) + 1);
  } else if (offer.action === 'remove_relic') {
    const target = ensureTarget(stageB, targetId);
    if (!targetRelicId || !target.relicIds.includes(targetRelicId)) throw new Error('target relic is not equipped on the selected figure');
    roster = replaceRoster(stageB, targetId, (entry) => ({ ...entry, relicIds: freezeArray(entry.relicIds.filter((id) => id !== targetRelicId)) }));
    relicInventory.push(targetRelicId);
  } else if (offer.action === 'reforge_relic') {
    const target = ensureTarget(stageB, targetId);
    if (!targetRelicId || !target.relicIds.includes(targetRelicId)) throw new Error('target relic is not equipped on the selected figure');
    roster = replaceRoster(stageB, targetId, (entry) => ({ ...entry, relicIds: freezeArray(entry.relicIds.map((id) => id === targetRelicId ? offer.payload.resultRelicId : id)) }));
  } else if (offer.action === 'camp_supplies') supplyDelta = 1;
  else if (offer.action === 'camp_heal_light') {
    const target = ensureTarget(stageB, targetId);
    if (target.kind !== 'regular' || target.injury !== 'light') throw new Error('camp healing requires a regular figure with a light injury');
    roster = replaceRoster(stageB, targetId, (entry) => ({ ...entry, injury: null, skipBattles: 0, available: true, criticalRisk: false }));
  } else if (offer.action === 'camp_next_battle_bonus') temporaryEffects.push('effect.camp.next_battle_bonus');
  else if (offer.action === 'camp_free_scout') scoutingDelta = 1;
  else throw new Error(`unsupported production service action: ${offer.action}`);

  const usedOfferIds = [...stageB.service.usedOfferIds, offerId];
  const serviceClosed = stageB.service.oneActionOnly;
  const economy = {
    ...stageB.economy,
    goldSpent: stageB.economy.goldSpent + offer.cost,
    suppliesEarned: stageB.economy.suppliesEarned + Math.max(0, supplyDelta),
    serviceVisits: stageB.economy.serviceVisits + (stageB.service.usedOfferIds.length === 0 ? 1 : 0)
  };
  const transaction = deepFreeze({ serviceType: stageB.service.type, nodeId: stageB.service.nodeId, offerId, cost: offer.cost, supplyDelta, scoutingDelta, targetRosterId: targetId, targetRelicId, serviceClosed });
  let next = deepFreeze({
    ...stageB,
    status: serviceClosed ? 'campaign' : 'service',
    roster: freezeArray(roster),
    relicInventory: freezeArray(unique(relicInventory)),
    relicUpgrades: deepFreeze(relicUpgrades),
    temporaryEffects: freezeArray(unique(temporaryEffects)),
    economy: deepFreeze(economy),
    service: serviceClosed ? null : deepFreeze({ ...stageB.service, usedOfferIds: freezeArray(usedOfferIds) }),
    lastServiceTransaction: transaction,
    history: freezeArray([...(stageB.history || []), deepFreeze({ index: stageB.history?.length || 0, type: 'production_service_used', payload: transaction })])
  });
  next = appendLedger(next, 'service_purchase', transaction);
  return next;
}

function priceBandFor(cost) {
  for (const [band, [minimum, maximum]] of Object.entries(PRICE_BANDS)) if (cost >= minimum && cost <= maximum) return band;
  return null;
}
function validateProductionPrices() {
  const checks = [30, 50, 80, 60, 90, 110, 120, 130, 140, ...Object.values(HOSPITAL_PRICES), ...Object.values(FORGE_PRICES)];
  const invalid = checks.filter((cost) => !priceBandFor(cost));
  return deepFreeze({ ok: invalid.length === 0, invalid: freezeArray(invalid) });
}
function interActConversion(resources, campaign) {
  const supplies = Math.max(0, Number(campaign?.supplies || 0));
  const convertedGold = supplies * INTER_ACT_SUPPLY_TO_GOLD;
  return deepFreeze({
    convertedSupplies: supplies,
    convertedGold,
    nextGold: Math.max(0, Number(resources?.gold || 0)) + convertedGold,
    nextSupplies: START_SUPPLIES,
    formula: `${supplies} × ${INTER_ACT_SUPPLY_TO_GOLD} = ${convertedGold}`
  });
}

module.exports = {
  PRODUCTION_ECONOMY_SCHEMA_VERSION,
  START_SUPPLIES,
  START_GOLD,
  INTER_ACT_SUPPLY_TO_GOLD,
  GOLD_REWARD_VALUES,
  SUPPLY_REWARD,
  PRICE_BANDS,
  HOSPITAL_PRICES,
  FORGE_PRICES,
  productionizeStageB,
  rewardGold,
  productionRewardOffers,
  chooseProductionReward,
  shopOffers,
  hospitalOffers,
  forgeOffers,
  campOffers,
  productionServiceState,
  useProductionService,
  priceBandFor,
  validateProductionPrices,
  interActConversion
};
