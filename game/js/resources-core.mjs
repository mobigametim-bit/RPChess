import {DEFAULT_KINGDOM_ECONOMY as K} from './kingdom-economy-config.mjs';
import { clampStars } from './encounter-difficulty.mjs';

const STARTING_GOLD = K.starting.gold;
const STARTING_SUPPLIES = K.starting.supplies;
const TRAVEL_SUPPLY_COST = K.travel.foreignCellSupplies;

function resourceAmount(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function hydrateResources(run) {
  return {
    ...run,
    gold: resourceAmount(run?.gold, STARTING_GOLD),
    supplies: resourceAmount(run?.supplies, STARTING_SUPPLIES)
  };
}

function applyTravelSupplyCost(run, cost = TRAVEL_SUPPLY_COST) {
  const safeRun = hydrateResources(run || {});
  const requested = Number.isInteger(cost) && cost > 0 ? cost : TRAVEL_SUPPLY_COST;
  const paid = Math.min(safeRun.supplies, requested);
  return {
    run: { ...safeRun, supplies: safeRun.supplies - paid },
    requested,
    paid,
    shortage: paid < requested
  };
}

function isPlayerVictory(status, playerColor = 'w') {
  return Boolean(status?.over && status?.type === 'checkmate' && status?.winner === playerColor);
}

function isDrawResult(status) {
  return Boolean(status?.over && !status?.winner);
}

function combatGoldReward({ encounterType, stars, status, playerColor = 'w' } = {}) {
  const level = clampStars(stars);
  const victory = isPlayerVictory(status, playerColor);
  const draw = isDrawResult(status);
  if (!victory && !draw) return 0;

  let victoryGold = 0;
  if (encounterType === 'battle') victoryGold = K.combat.battleGoldBase + (K.combat.battleGoldPerStar * level);
  else if (encounterType === 'skirmish') victoryGold = K.combat.skirmishGoldBase + (K.combat.skirmishGoldPerStar * level);
  else return 0;

  return victory ? victoryGold : Math.floor(victoryGold * K.combat.drawRewardPercent / 100);
}

function applyGoldReward(run, amount) {
  const safeRun = hydrateResources(run || {});
  const reward = Number.isInteger(amount) && amount > 0 ? amount : 0;
  return { ...safeRun, gold: safeRun.gold + reward };
}

export {
  STARTING_GOLD,
  STARTING_SUPPLIES,
  TRAVEL_SUPPLY_COST,
  resourceAmount,
  hydrateResources,
  applyTravelSupplyCost,
  combatGoldReward,
  applyGoldReward,
  isPlayerVictory,
  isDrawResult
};
