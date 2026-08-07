'use strict';

const economy = require('./production-economy.cjs');

const INSTALL_KEY = Symbol.for('rpchess.production-economy-stageb-installed');
if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;
  const stageB = require('./stage-b-act.cjs');
  const originalCreate = stageB.createStageBActState;
  stageB.createStageBActState = function createProductionStageB(options = {}) {
    return economy.productionizeStageB(originalCreate(options));
  };
  stageB.generateRewardOffers = function generateProductionRewardOffers(state, context = {}) {
    return economy.productionRewardOffers(economy.productionizeStageB(state), context);
  };
  stageB.chooseRewardOffer = function chooseProductionRewardOffer(state, offerId, options = {}) {
    return economy.chooseProductionReward(economy.productionizeStageB(state), offerId, options);
  };
  stageB.createServiceState = function createProductionService(state, serviceType, options = {}) {
    return economy.productionServiceState(economy.productionizeStageB(state), serviceType, options);
  };
  stageB.useService = function useProductionService(state, offerId, options = {}) {
    return economy.useProductionService(economy.productionizeStageB(state), offerId, options);
  };
}

module.exports = Object.freeze({ installed: true });
