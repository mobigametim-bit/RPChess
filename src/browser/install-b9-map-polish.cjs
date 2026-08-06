'use strict';

const { deepFreeze, freezeArray } = require('../campaign/production-map-contract.cjs');
const runtimeState = require('../campaign/runtime-state.cjs');

const INSTALL_KEY = Symbol.for('rpchess.b9-map-polish-installed');
if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;

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
        scenarioCandidates: pools.scenarioCandidates || encounters.map((id) => ({ id, baseWeight: 1 }))
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

  presenter.createPresenterSnapshot = function createB9PolishedSnapshot(state, dependencies = {}) {
    const snapshot = originalCreatePresenterSnapshot(state, dependencies);
    if (!runtimeState.isProductionState(state?.campaign) || !snapshot.campaign) return snapshot;
    return deepFreeze({
      ...snapshot,
      campaign: {
        ...snapshot.campaign,
        nodes: visibleMapNodes(snapshot.campaign)
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
