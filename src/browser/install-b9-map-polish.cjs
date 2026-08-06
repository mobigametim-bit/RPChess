'use strict';

const { deepFreeze, freezeArray } = require('../campaign/production-map-contract.cjs');
const runtimeState = require('../campaign/runtime-state.cjs');
const ironMarchesPack = require('../../content/packs/iron_marches_vertical_slice.json');
const ironMarchesScenarios = require('../../content/scenarios/iron_marches_vertical_slice.json');

const INSTALL_KEY = Symbol.for('rpchess.b9-map-polish-installed');
if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;

  const authoredEncounterById = new Map((ironMarchesPack.content?.encounters || []).map((entry) => [entry.id, entry]));
  function authoredScenarioCandidate(id) {
    const encounter = authoredEncounterById.get(id) || {};
    const scenario = ironMarchesScenarios.encounters?.[id] || {};
    const objectiveIds = (scenario.objectives || []).map((objective) => objective.id).filter(Boolean);
    const environmentIds = (scenario.environment || []).map((entry) => entry.id).filter(Boolean);
    const optionalObjectives = (scenario.objectives || []).filter((objective) => objective.optional === true);
    return {
      id,
      baseWeight: Number(encounter.baseWeight || 1),
      regionIds: encounter.regionId ? [encounter.regionId] : [],
      boardIds: encounter.board?.themeId ? [encounter.board.themeId] : [],
      objectiveIds,
      environmentIds,
      factorWeights: encounter.factorWeights || {},
      requiredFacts: encounter.requiredFacts || [],
      excludedFacts: encounter.excludedFacts || [],
      incompatibleScenarioIds: encounter.incompatibleScenarioIds || [],
      optionalObjectiveRequirements: {
        objectiveIds: optionalObjectives.map((objective) => objective.id),
        previews: optionalObjectives.map((objective) => objective.previewKey).filter(Boolean)
      },
      metadata: {
        encounterId: id,
        tags: encounter.tags || [],
        board: scenario.board || encounter.board || null,
        battle: scenario.battle || null,
        objectives: scenario.objectives || [],
        failures: scenario.failures || [],
        environment: scenario.environment || [],
        reward: scenario.reward || null
      }
    };
  }

  const graphModule = require('../campaign/graph.cjs');
  const originalGenerateActGraph = graphModule.generateActGraph;
  graphModule.generateActGraph = function generateB9GraphWithServicePools(options = {}) {
    if (options.stageB !== true) return originalGenerateActGraph(options);
    const pools = options.contentPools || {};
    const services = pools.services || [];
    const encounters = pools.encounters || [];
    return originalGenerateActGraph({
      ...options,
      contentPools: {
        ...pools,
        shop: pools.shop || pools.shops || services,
        hospital: pools.hospital || services,
        forge: pools.forge || services,
        camp: pools.camp || services,
        scenarioCandidates: pools.scenarioCandidates || encounters.map(authoredScenarioCandidate)
      }
    });
  };

  const presenter = require('../runtime/presenter-bridge.cjs');
  const originalCreatePresenterSnapshot = presenter.createPresenterSnapshot;
  const originalDispatchPresenterCommand = presenter.dispatchPresenterCommand;

  function visibleMapNodes(campaignSnapshot) {
    const nodes = campaignSnapshot?.nodes || [];
    return freezeArray(nodes.filter((node) => node.visibility !== 'hidden'));
  }
  function scenarioRoutePreview(route) {
    if (!route.scouted || !route.intel?.scenarioSelection) return route;
    const selection = route.intel.scenarioSelection;
    return deepFreeze({
      ...route,
      optionalObjectiveRequirements: selection.optionalObjectiveRequirements || null,
      scenarioPreview: selection.metadata ? deepFreeze({
        encounterId: selection.metadata.encounterId || route.contentId || null,
        board: selection.metadata.board || null,
        objectives: selection.metadata.objectives || [],
        failures: selection.metadata.failures || [],
        environment: selection.metadata.environment || []
      }) : null
    });
  }

  presenter.createPresenterSnapshot = function createB9PolishedSnapshot(state, dependencies = {}) {
    const snapshot = originalCreatePresenterSnapshot(state, dependencies);
    if (!runtimeState.isProductionState(state?.campaign) || !snapshot.campaign) return snapshot;
    return deepFreeze({
      ...snapshot,
      campaign: {
        ...snapshot.campaign,
        nodes: visibleMapNodes(snapshot.campaign),
        routes: freezeArray((snapshot.campaign.routes || []).map(scenarioRoutePreview))
      }
    });
  };

  function consumeForcedMarchBattleEffect(previous, next) {
    if (!runtimeState.isProductionState(next?.campaign) || !previous?.currentNode || next?.currentNode) return next;
    if (!['battle', 'elite', 'boss'].includes(previous.currentNode.type)) return next;
    const effects = next.stageB?.temporaryEffects || [];
    const remaining = effects.filter((effectId) => !String(effectId).startsWith('effect.forced_march.next_battle_penalty.'));
    if (remaining.length === effects.length) return next;
    const stageB = deepFreeze({
      ...next.stageB,
      temporaryEffects: freezeArray(remaining),
      history: freezeArray([...(next.stageB.history || []), deepFreeze({
        index: next.stageB.history?.length || 0,
        type: 'forced_march_next_battle_penalty_consumed',
        payload: deepFreeze({ nodeId: previous.currentNode.nodeId })
      })])
    });
    return deepFreeze({ ...next, stageB });
  }

  function materializationDependencies(state, dependencies) {
    if (!runtimeState.isProductionState(state?.campaign)) return dependencies;
    const storyFacts = [...new Set([
      ...(state.flags || []),
      ...(state.stageB?.storyFlags || [])
    ])].sort();
    return {
      ...dependencies,
      campaignMaterialization: {
        ...(dependencies.campaignMaterialization || {}),
        storyFacts: freezeArray(storyFacts)
      }
    };
  }

  presenter.dispatchPresenterCommand = function dispatchB9PolishedCommand(state, commandInput, dependencies = {}) {
    const resolvedDependencies = materializationDependencies(state, dependencies);
    const result = originalDispatchPresenterCommand(state, commandInput, resolvedDependencies);
    const nextState = consumeForcedMarchBattleEffect(state, result.state);
    if (nextState === result.state) return result;
    return Object.freeze({
      ...result,
      state: nextState,
      snapshot: presenter.createPresenterSnapshot(nextState, resolvedDependencies)
    });
  };
}

module.exports = Object.freeze({ installed: true });
