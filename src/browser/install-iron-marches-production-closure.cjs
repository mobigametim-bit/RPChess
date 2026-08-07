'use strict';

const actReward = require('../runtime/b14-act-reward.cjs');
const economy = require('../runtime/production-economy.cjs');

const INSTALL_KEY = Symbol.for('rpchess.iron-marches-production-closure-installed');
if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;
  const presenter = require('../runtime/presenter-bridge.cjs');
  const innerSnapshot = presenter.createPresenterSnapshot;
  const innerDispatch = presenter.dispatchPresenterCommand;

  function freezeArray(values) { return Object.freeze((values || []).slice()); }
  function deepFreeze(value, seen = new Set()) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
    seen.add(value); Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child, seen); return value;
  }

  function needsB14ActReward(state) {
    return Boolean(
      state?.politicalFinaleB14?.stage === 'act_reward' &&
      state?.status === 'reward_choice' &&
      state?.stageB &&
      (!state.stageB.b14ActReward || (state.stageB.pendingRewardOffers || []).some((offer) => !String(offer.id || '').startsWith('act_reward:iron_marches:')))
    );
  }

  function installReward(state) {
    if (!needsB14ActReward(state)) return state;
    const stageB = actReward.installActRewardOffers(state.stageB, { seed:state.seed, act:state.campaign?.act || state.stageB.act || 1 });
    return deepFreeze({ ...state, stageB });
  }

  function installInterActPreview(state) {
    if (state?.politicalFinaleB14?.stage !== 'interact' || state?.status !== 'reorganization' || !state.stageB?.reorganization) return state;
    const preview = economy.interActConversion(state.resources, state.campaign);
    const current = state.stageB.reorganization.interActConversionPreview;
    if (current && current.convertedSupplies === preview.convertedSupplies && current.nextGold === preview.nextGold && current.nextSupplies === preview.nextSupplies) return state;
    const reorganization = deepFreeze({ ...state.stageB.reorganization, interActConversionPreview:preview });
    return deepFreeze({ ...state, stageB:{ ...state.stageB, reorganization } });
  }

  function normalizeClosureState(state) {
    return installInterActPreview(installReward(state));
  }

  function closureSnapshot(state, dependencies) {
    const snapshot = innerSnapshot(state, dependencies);
    if (state?.politicalFinaleB14?.stage !== 'interact' || !state.stageB?.reorganization?.interActConversionPreview) return snapshot;
    return deepFreeze({
      ...snapshot,
      interActPreview:state.stageB.reorganization.interActConversionPreview,
      stageB:snapshot.stageB ? {
        ...snapshot.stageB,
        reorganization:{ ...snapshot.stageB.reorganization, interActConversionPreview:state.stageB.reorganization.interActConversionPreview }
      } : snapshot.stageB
    });
  }

  presenter.createPresenterSnapshot = function createIronMarchesClosureSnapshot(stateInput, dependencies = {}) {
    const state = normalizeClosureState(stateInput);
    return closureSnapshot(state, dependencies);
  };

  presenter.dispatchPresenterCommand = function dispatchIronMarchesClosureCommand(stateInput, commandInput, dependencies = {}) {
    const state = normalizeClosureState(stateInput);
    const result = innerDispatch(state, commandInput, dependencies);
    const next = normalizeClosureState(result.state);
    if (next === result.state) return result;
    return Object.freeze({
      ...result,
      state:next,
      snapshot:closureSnapshot(next, dependencies),
      // The underlying save layer remains authoritative. Reload normalization is
      // deterministic, so older post-epilogue envelopes cannot reroll Act Reward.
      saveEnvelope:result.saveEnvelope || null
    });
  };
}

module.exports = Object.freeze({ installed:true });
