'use strict';

const { hash32 } = require('../core/determinism.cjs');
const { generateProductionActGraph } = require('../campaign/production-map.cjs');
const { START_SUPPLIES, START_GOLD, GOLD_REWARD_VALUES, SUPPLY_REWARD } = require('./production-economy.cjs');

const ECONOMY_STRATEGIES = Object.freeze(['balanced', 'power', 'gold', 'supplies', 'save', 'scout', 'secret']);

function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function routeNodes(graph, seed) {
  const nodes = [];
  let current = graph.startNodeId;
  while (current !== graph.bossNodeId) {
    const edgeIds = graph.outgoing[current] || [];
    if (!edgeIds.length) throw new Error(`simulation route dead-end at ${current}`);
    const edgeId = edgeIds[hash32(`${seed}:${current}:route`) % edgeIds.length];
    current = graph.edgesById[edgeId].to;
    nodes.push(graph.nodesById[current]);
  }
  return nodes;
}
function eventResource(seed, nodeId) {
  const roll = hash32(`${seed}:${nodeId}:event-resource`) % 4;
  if (roll === 0) return { gold: 15 + (hash32(`${seed}:${nodeId}:event-gold`) % 21), supplies: 0 };
  if (roll === 1) return { gold: 0, supplies: 1 + (hash32(`${seed}:${nodeId}:event-supplies`) % 2) };
  return { gold: 0, supplies: 0 };
}
function secretResource(seed, nodeId) {
  return hash32(`${seed}:${nodeId}:secret-kind`) % 2
    ? { gold: 30 + (hash32(`${seed}:${nodeId}:secret-gold`) % 31), supplies: 0 }
    : { gold: 0, supplies: 3 + (hash32(`${seed}:${nodeId}:secret-supplies`) % 3) };
}
function battleRewardChoice(strategy, battleIndex, supplies) {
  if (strategy === 'gold') return 'gold';
  if (strategy === 'supplies' || strategy === 'scout') return 'supplies';
  if (strategy === 'power') return 'power';
  if (strategy === 'save') return supplies <= 2 ? 'supplies' : 'power';
  if (strategy === 'secret') return battleIndex === 0 ? 'supplies' : battleIndex === 1 ? 'gold' : 'power';
  return battleIndex === 0 ? 'supplies' : battleIndex === 1 || battleIndex === 3 ? 'gold' : 'power';
}
function simulateProductionEconomyAct(seed, strategy = 'balanced') {
  if (!ECONOMY_STRATEGIES.includes(strategy)) throw new Error(`unsupported economy strategy: ${strategy}`);
  const graph = generateProductionActGraph({ rootSeed: seed, regionId: 'region.iron_marches' });
  const route = routeNodes(graph, seed);
  let supplies = START_SUPPLIES;
  let gold = START_GOLD;
  let suppliesSpent = 0;
  let suppliesEarned = 0;
  let goldEarned = 0;
  let goldSpent = 0;
  let forcedMarches = 0;
  let purchases = 0;
  let battleIndex = 0;
  let secretVisited = false;
  for (const node of route) {
    if (supplies > 0) { supplies -= 1; suppliesSpent += 1; }
    else forcedMarches += 1;
    if (node.type === 'battle' || node.type === 'elite') {
      const choice = battleRewardChoice(strategy, battleIndex, supplies);
      if (choice === 'supplies') { supplies += SUPPLY_REWARD; suppliesEarned += SUPPLY_REWARD; }
      else if (choice === 'gold') {
        const amount = GOLD_REWARD_VALUES[hash32(`${seed}:${node.id}:sim-gold`) % GOLD_REWARD_VALUES.length];
        gold += amount; goldEarned += amount;
      }
      battleIndex += 1;
    } else if (node.type === 'event') {
      const delta = eventResource(seed, node.id);
      gold += delta.gold; supplies += delta.supplies;
      goldEarned += delta.gold; suppliesEarned += delta.supplies;
    } else if (node.type === 'shop' && ['balanced', 'supplies', 'scout', 'secret'].includes(strategy) && gold >= 30 && supplies <= 5) {
      gold -= 30; goldSpent += 30; supplies += 2; suppliesEarned += 2; purchases += 1;
    }
    if (strategy === 'scout' && node.layer < 9 && supplies > 2 && hash32(`${seed}:${node.id}:scout`) % 3 === 0) {
      supplies -= 1; suppliesSpent += 1;
    }
    if (strategy === 'secret' && !secretVisited && node.type !== 'boss' && hash32(`${seed}:${node.id}:secret-check`) % 10 === 0) {
      secretVisited = true;
      if (supplies > 0) { supplies -= 1; suppliesSpent += 1; }
      else forcedMarches += 1;
      const delta = secretResource(seed, node.id);
      gold += delta.gold; supplies += delta.supplies;
      goldEarned += delta.gold; suppliesEarned += delta.supplies;
    }
  }
  return Object.freeze({
    seed, strategy, routeLength: route.length, routeCost: route.length, endingSupplies: supplies, endingGold: gold,
    suppliesSpent, suppliesEarned, goldEarned, goldSpent, forcedMarches, purchases, secretVisited,
    softLocked: false
  });
}
function simulateProductionEconomyCorpus(options = {}) {
  const seeds = Math.max(1, Number(options.seeds || 10000));
  const strategies = options.strategies || ECONOMY_STRATEGIES;
  const byStrategy = {};
  let totalRuns = 0;
  for (const strategy of strategies) {
    const rows = [];
    for (let seed = 1; seed <= seeds; seed += 1) rows.push(simulateProductionEconomyAct(seed, strategy));
    totalRuns += rows.length;
    byStrategy[strategy] = Object.freeze({
      runs: rows.length,
      medianRouteCost: median(rows.map((row) => row.routeCost)),
      medianSuppliesEarned: median(rows.map((row) => row.suppliesEarned)),
      medianGoldEarned: median(rows.map((row) => row.goldEarned)),
      medianGoldSpent: median(rows.map((row) => row.goldSpent)),
      medianForcedMarches: median(rows.map((row) => row.forcedMarches)),
      medianPurchases: median(rows.map((row) => row.purchases)),
      softLocks: rows.filter((row) => row.softLocked).length,
      secretVisitRate: rows.filter((row) => row.secretVisited).length / rows.length
    });
  }
  return Object.freeze({ seedsPerStrategy: seeds, totalRuns, strategies: Object.freeze(byStrategy) });
}

module.exports = { ECONOMY_STRATEGIES, median, routeNodes, eventResource, secretResource, simulateProductionEconomyAct, simulateProductionEconomyCorpus };
