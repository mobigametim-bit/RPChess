'use strict';

const { hash32 } = require('../core/determinism.cjs');

const ACT_REWARD_FORMAT = 'rpchess-iron-marches-act-reward-b14';
const ACT_REWARD_SCHEMA_VERSION = 1;

function freezeArray(values) { return Object.freeze((values || []).slice()); }
function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value); Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child, seen); return value;
}

function materializeActRewardOffers({ seed = 1, act = 1 } = {}) {
  // 12.8 authorizes a major Act Reward from authored categories but does not assign
  // a numeric payout. Use non-numeric permanent categories only: two distinct rare
  // relic offers and one new recruit. The set depends on run seed/act, never government.
  const base = `${Number(seed || 1)}:${Number(act || 1)}:iron_marches:B14:act_reward`;
  const pieceTypes = ['p', 'n', 'b', 'r'];
  const recruitType = pieceTypes[hash32(`${base}:recruit`) % pieceTypes.length];
  const offers = [
    deepFreeze({
      id:'act_reward:iron_marches:rare_relic_a', type:'relic',
      payload:{ rarity:'rare', relicId:`relic.act_reward.iron_marches.${hash32(`${base}:relic:a`).toString(36)}` },
      bonus:null, improved:false, title:'Редкая реликвия Маршей',
      description:'Добавить в арсенал редкую реликвию Железных Маршей.'
    }),
    deepFreeze({
      id:'act_reward:iron_marches:recruit', type:'recruit',
      payload:{ pieceType:recruitType }, bonus:null, improved:false,
      title:'Ветеран Железных Маршей', description:'Принять в армию нового ветерана региона.'
    }),
    deepFreeze({
      id:'act_reward:iron_marches:rare_relic_b', type:'relic',
      payload:{ rarity:'rare', relicId:`relic.act_reward.iron_marches.${hash32(`${base}:relic:b`).toString(36)}` },
      bonus:null, improved:false, title:'Реликвия кузней Маршей',
      description:'Добавить в арсенал вторую, отличающуюся редкую реликвию региона.'
    })
  ];
  if (offers[0].payload.relicId === offers[2].payload.relicId) throw new Error('Act Reward relic offers must be distinct');
  return freezeArray(offers);
}

function installActRewardOffers(stageBInput, options = {}) {
  if (!stageBInput) throw new Error('Stage B state is required for B14 Act Reward');
  const offers = materializeActRewardOffers({ seed:options.seed ?? stageBInput.seed, act:options.act ?? stageBInput.act });
  const history = freezeArray([...(stageBInput.history || []), deepFreeze({
    index:(stageBInput.history || []).length,
    type:'b14_act_reward_materialized',
    payload:{ offerIds:offers.map((offer)=>offer.id) }
  })]);
  return deepFreeze({
    ...stageBInput,
    status:'reward_choice',
    pendingRewardOffers:offers,
    history,
    b14ActReward:deepFreeze({ format:ACT_REWARD_FORMAT, schemaVersion:ACT_REWARD_SCHEMA_VERSION, offerIds:freezeArray(offers.map((offer)=>offer.id)) })
  });
}

module.exports = {
  ACT_REWARD_FORMAT,
  ACT_REWARD_SCHEMA_VERSION,
  materializeActRewardOffers,
  installActRewardOffers
};
