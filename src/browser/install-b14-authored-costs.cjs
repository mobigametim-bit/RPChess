'use strict';

const b14 = require('../runtime/political-finale-b14.cjs');
const narrative = require('../runtime/production-narrative.cjs');

const INSTALL_KEY = Symbol.for('rpchess.b14-authored-costs-installed');
if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;
  const presenter = require('../runtime/presenter-bridge.cjs');
  const innerSnapshot = presenter.createPresenterSnapshot;
  const innerDispatch = presenter.dispatchPresenterCommand;

  function deepFreeze(value, seen = new Set()) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
    seen.add(value); Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child, seen); return value;
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function sanitizeFinale(finaleInput) {
    if (!finaleInput) return null;
    const finale = clone(finaleInput);
    for (const force of Object.values(finale.forceStates || {})) {
      if (!force?.demand) continue;
      // B14 authoring specifies resource TYPES but does not yet specify exact cabinet numbers.
      // Never invent a numeric price in runtime: authored content may add explicit values later.
      force.demand.costGold = 0;
      force.demand.costSupplies = 0;
    }
    return deepFreeze(finale);
  }
  function shouldMaterialize(state) {
    return Boolean(state?.campaign?.graph?.stageB && state?.campaign?.graph?.regionId === 'region.iron_marches' && state?.status === 'act_outcome' && !state?.politicalFinaleB14);
  }
  function materializeSanitized(state) {
    if (!shouldMaterialize(state)) {
      if (!state?.politicalFinaleB14) return state;
      const sanitized = sanitizeFinale(state.politicalFinaleB14);
      return deepFreeze({ ...state, politicalFinaleB14: sanitized });
    }
    const regionalLines = narrative.deriveRegionalLines(state.narrative || narrative.createNarrativeState());
    const finale = sanitizeFinale(b14.createPoliticalFinale({ seed: state.seed, narrative: state.narrative, regionalLines }));
    return deepFreeze({
      ...state,
      politicalFinaleB14: finale,
      history: Object.freeze([...(state.history || []), Object.freeze({ index:(state.history || []).length, type:'b14_political_finale_started', finaleSeed:finale.finaleSeed })])
    });
  }

  presenter.createPresenterSnapshot = function createAuthoredCostSnapshot(stateInput, dependencies = {}) {
    return innerSnapshot(materializeSanitized(stateInput), dependencies);
  };
  presenter.dispatchPresenterCommand = function dispatchAuthoredCostCommand(stateInput, commandInput, dependencies = {}) {
    return innerDispatch(materializeSanitized(stateInput), commandInput, dependencies);
  };
}

module.exports = Object.freeze({ installed:true });
