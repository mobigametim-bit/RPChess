'use strict';

const { hash32 } = require('../core/determinism.cjs');

const ACT_REWARD_FORMAT = 'rpchess-iron-marches-act-reward-b14';
const ACT_REWARD_SCHEMA_VERSION = 1;
const AUTHORED_RELIC_REWARDS = Object.freeze([
  Object.freeze({ relicId:'relic.echo_shield', title:'Щит эха', description:'Добавить в арсенал реликвию «Щит эха».' }),
  Object.freeze({ relicId:'relic.circle_warding', title:'Круг защиты', description:'Добавить в арсенал реликвию «Круг защиты».' })
]);

function freezeArray(values) { return Object.freeze((values || []).slice()); }
function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value); Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child, seen); return value;
}

function materializeActRewardOffers({ seed = 1, act = 1 } = {}) {
  // 12.8 authorizes a major Act Reward from authored categories but does not assign
  // a numeric payout. Keep the reward non-numeric and use only relic IDs already present
  // in Register 03 with implemented mechanics; never synthesize unknown inventory IDs.
  const base = `${Number(seed || 1)}:${Number(act || 1)}:iron_marches:B14:act_reward`;
  const pieceTypes = ['p', 'n', 'b', 'r'];
  const recruitType = pieceTypes[hash32(`${base}:recruit`) % pieceTypes.length];
  const relics = AUTHORED_RELIC_REWARDS.slice().sort((a,b) => hash32(`${base}:${a.relicId}`) - hash32(`${base}:${b.relicId}`));
  const offers = [
    deepFreeze({
      id:`act_reward:iron_marches:${relics[0].relicId.replace('relic.','')}`, type:'relic',
      payload:{ rarity:'rare', relicId:relics[0].relicId }, bonus:null, improved:false,
      title:relics[0].title, description:relics[0].description
    }),
    deepFreeze({
      id:'act_reward:iron_marches:recruit', type:'recruit',
      payload:{ pieceType:recruitType }, bonus:null, improved:false,
      title:'Ветеран Железных Маршей', description:'Принять в армию нового ветерана региона.'
    }),
    deepFreeze({
      id:`act_reward:iron_marches:${relics[1].relicId.replace('relic.','')}`, type:'relic',
      payload:{ rarity:'rare', relicId:relics[1].relicId }, bonus:null, improved:false,
      title:relics[1].title, description:relics[1].description
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
  AUTHORED_RELIC_REWARDS,
  materializeActRewardOffers,
  installActRewardOffers
};