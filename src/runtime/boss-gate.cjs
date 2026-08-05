'use strict';

const { chooseAiCommand } = require('../ai/search.cjs');
const { scenarioObjectiveEvaluator } = require('../scenario/scenario.cjs');
const { executeBossCommand, beginNextBossPhase } = require('../scenario/boss-phases.cjs');

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function copyRequest(request) {
  if (!request || typeof request !== 'object' || typeof request.type !== 'string') throw new Error('boss player command is required');
  return Object.freeze({ type: request.type, payload: Object.freeze({ ...(request.payload || {}) }) });
}

function executeBossActionPair(bossState, request, options = {}) {
  if (!bossState || bossState.format !== 'rpchess-boss-phase-state') throw new Error('valid boss phase state is required');
  if (bossState.status !== 'active') throw new Error(`boss does not accept actions while ${bossState.status}`);
  const playerSide = options.playerSide || bossState.playerSide;
  if (bossState.scenario.battle.position.sideToMove !== playerSide) throw new Error('it is not the player side turn in the boss battle');
  const playerRequest = copyRequest(request);
  const playerResult = executeBossCommand(bossState, playerRequest);
  let boss = playerResult.state;
  let aiDecision = null;
  let aiBossEvents = freezeArray([]);
  let aiScenarioEvents = freezeArray([]);

  if (boss.status === 'active' && boss.scenario.battle.position.sideToMove !== playerSide) {
    const perspective = boss.scenario.battle.position.sideToMove;
    aiDecision = chooseAiCommand(boss.scenario.battle, {
      profile: options.aiProfile || 'tactician',
      perspective,
      objectiveEvaluator: scenarioObjectiveEvaluator(boss.scenario),
      timeBudgetMs: options.aiTimeBudgetMs ?? 0,
      maxNodes: options.aiMaxNodes
    });
    if (!aiDecision.command) throw new Error(`boss AI produced no legal command: ${aiDecision.reason || 'unknown'}`);
    const aiResult = executeBossCommand(boss, aiDecision.command);
    boss = aiResult.state;
    aiBossEvents = aiResult.bossEvents;
    aiScenarioEvents = aiResult.scenarioEvents;
  }

  if (boss.status === 'active' && boss.scenario.battle.position.sideToMove !== playerSide) {
    throw new Error('boss action scheduler did not return control to the player');
  }

  return Object.freeze({
    boss,
    playerRequest,
    playerBattleEvents: playerResult.battleEvents,
    playerScenarioEvents: playerResult.scenarioEvents,
    playerBossEvents: playerResult.bossEvents,
    aiDecision,
    aiBossEvents,
    aiScenarioEvents
  });
}

function advanceBossPhase(bossState, battle) {
  const result = beginNextBossPhase(bossState, battle);
  if (result.state.scenario.battle.position.sideToMove !== result.state.playerSide) {
    throw new Error('next boss phase must begin on the player side');
  }
  return result;
}

module.exports = {
  copyRequest,
  executeBossActionPair,
  advanceBossPhase
};
