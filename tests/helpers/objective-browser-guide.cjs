'use strict';

const { parseFen } = require('../../src/core/chess/position.cjs');
const { createBattleState } = require('../../src/combat/battle.cjs');
const { createScenarioState, scenarioObjectiveEvaluator } = require('../../src/scenario/scenario.cjs');
const { chooseAiCommand } = require('../../src/ai/search.cjs');
const { hash32 } = require('../../src/core/determinism.cjs');

const GUIDE_PROFILE = Object.freeze({
  id:'browser-objective-guide',
  depth:2,
  maxNodes:18000,
  timeBudgetMs:0,
  rootNoise:0,
  reserveDiscount:0.85,
  mobilityWeight:2,
  statusWeight:22
});

function activeIds(snapshot) {
  return new Set((snapshot?.scenario?.pieces || []).map((piece) => piece.id || piece.pieceId).filter(Boolean));
}

function currentObjective(snapshot, templates) {
  const progress = snapshot?.scenario?.objectives || [];
  const index = Math.max(0, progress.findIndex((entry) => entry.mandatory !== false && entry.status !== 'completed'));
  if (snapshot.status === 'boss') {
    const bossId = snapshot.boss?.bossId || snapshot.currentNode?.contentId;
    const phaseIndex = Number(snapshot.boss?.phaseIndex || 0);
    return templates.bosses?.[bossId]?.phases?.[phaseIndex]?.objectives?.[index] || null;
  }
  return templates.encounters?.[snapshot.currentNode?.contentId]?.objectives?.[index] || null;
}

function remainingObjective(definition, snapshot) {
  if (!definition) return null;
  const ids = activeIds(snapshot);
  const objective = { ...definition };
  if (objective.targetPieceIds) objective.targetPieceIds = objective.targetPieceIds.filter((id) => ids.has(id));
  if (objective.protectedPieceIds) objective.protectedPieceIds = objective.protectedPieceIds.filter((id) => ids.has(id));
  if (objective.type === 'capture_targets' && !objective.targetPieceIds?.length) return null;
  return objective;
}

function battleFromSnapshot(snapshot) {
  const scenario = snapshot.scenario;
  const identitiesBySquare = {};
  const identityMetadata = {};
  for (const piece of scenario.pieces || []) {
    const id = piece.id || piece.pieceId;
    if (!id) continue;
    identitiesBySquare[piece.square] = id;
    identityMetadata[id] = {
      ...(piece.heroId ? { heroId:piece.heroId } : {}),
      ...(Number.isInteger(piece.stars) ? { stars:piece.stars } : {}),
      ...(piece.relicIds ? { relicIds:piece.relicIds } : {})
    };
  }
  const blockedSquares = (scenario.environment || [])
    .filter((entry) => entry.passable === false || entry.type === 'blocker')
    .flatMap((entry) => entry.cells || []);
  return createBattleState({
    battleId:`browser-guide-${scenario.scenarioId || 'scenario'}`,
    seed:hash32(`${snapshot.seed || 1}:${scenario.scenarioId || 'scenario'}:${scenario.actionIndex || 0}:guide`),
    playerSide:scenario.playerSide || 'w',
    position:parseFen(scenario.positionFen),
    identitiesBySquare,
    identityMetadata,
    scenarioRules:{ blockedSquares },
    orderPoints:scenario.orderPoints || undefined
  });
}

function chooseObjectiveBrowserCommand(snapshot, templates) {
  if (!snapshot?.scenario?.positionFen) return null;
  const legal = (snapshot.scenario.legalCommands || []).filter((command) => command.type === 'MovePiece');
  if (!legal.length) return null;
  const definition = remainingObjective(currentObjective(snapshot, templates), snapshot);
  if (!definition) return legal[0];
  try {
    const battle = battleFromSnapshot(snapshot);
    const scenario = createScenarioState({
      scenarioId:`browser_guide_${String(snapshot.scenario.scenarioId || 'scenario').replace(/[^a-z0-9_-]+/ig,'_')}`,
      seed:hash32(`${snapshot.seed || 1}:${snapshot.scenario.scenarioId || 'scenario'}:objective-guide`),
      playerSide:snapshot.scenario.playerSide || 'w',
      battle,
      objectives:[definition],
      failures:[],
      environment:(snapshot.scenario.environment || []).filter((entry) => entry.visible !== false)
    });
    const choice = chooseAiCommand(battle, {
      profile:GUIDE_PROFILE,
      perspective:battle.position.sideToMove,
      seed:hash32(`${snapshot.seed || 1}:${snapshot.scenario.scenarioId || 'scenario'}:${snapshot.scenario.actionIndex || 0}:player-guide`),
      now:() => 0,
      objectiveEvaluator:scenarioObjectiveEvaluator(scenario)
    }).command;
    if (!choice) return legal[0];
    return legal.find((command) => command.payload.from === choice.payload.from
      && command.payload.to === choice.payload.to
      && (command.payload.promotion || null) === (choice.payload.promotion || null)) || legal[0];
  } catch (_error) {
    return legal[0];
  }
}

module.exports = {
  GUIDE_PROFILE,
  currentObjective,
  remainingObjective,
  battleFromSnapshot,
  chooseObjectiveBrowserCommand
};
