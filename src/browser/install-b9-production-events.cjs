'use strict';

const { validateProductionEventLibrary } = require('../content/production-events.cjs');
const { createProductionEventMaterializationCallbacks } = require('../campaign/production-event-b9-adapter.cjs');
const eventSource = require('../../content/events/iron_marches_production.json');

const INSTALL_KEY = Symbol.for('rpchess.b9-production-events-installed');
if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;

  const library = validateProductionEventLibrary(eventSource);
  const productionEventIds = new Set(library.events.map((event) => event.id));
  const stateModule = require('../campaign/state.cjs');
  const runtimeState = require('../campaign/runtime-state.cjs');

  function usesProductionEvents(graphOrState) {
    const graph = graphOrState?.graph || graphOrState;
    if (!graph || graph.generatorVersion !== 3 || graph.regionId !== 'region.iron_marches') return false;
    const pools = graphOrState?.materializationContext?.contentPools || graph.materializationContext?.contentPools || {};
    const eventIds = pools.events || [];
    return eventIds.length > 0 && eventIds.every((eventId) => productionEventIds.has(eventId));
  }

  function callbacks(options = {}) {
    return createProductionEventMaterializationCallbacks(library, {
      storyFacts: options.storyFacts || options.flags || [],
      heroIds: options.heroIds || [],
      doctrineIds: options.doctrineIds || [],
      relicIds: options.relicIds || [],
      roster: options.roster || [],
      participatedRosterIds: options.participatedRosterIds || [],
      gold: options.gold,
      supplies: options.supplies
    });
  }

  const originalCreateCampaignState = stateModule.createCampaignState;
  stateModule.createCampaignState = function createB9ProductionEventCampaignState(graph, options = {}) {
    if (!usesProductionEvents(graph)) return originalCreateCampaignState(graph, options);
    return originalCreateCampaignState(graph, { ...options, ...callbacks(options) });
  };

  const originalTravelTo = runtimeState.travelTo;
  runtimeState.travelTo = function travelWithProductionEvents(state, targetNodeId, options = {}) {
    if (!usesProductionEvents(state)) return originalTravelTo(state, targetNodeId, options);
    return originalTravelTo(state, targetNodeId, { ...options, ...callbacks(options) });
  };

  const originalCompleteNode = runtimeState.completeNode;
  runtimeState.completeNode = function completeWithProductionEvents(state, nodeId, options = {}) {
    if (!usesProductionEvents(state)) return originalCompleteNode(state, nodeId, options);
    return originalCompleteNode(state, nodeId, { ...options, ...callbacks(options) });
  };

  const originalReopenBranch = runtimeState.reopenBranch;
  runtimeState.reopenBranch = function reopenWithProductionEvents(state, nodeId, options = {}) {
    if (!usesProductionEvents(state)) return originalReopenBranch(state, nodeId, options);
    return originalReopenBranch(state, nodeId, { ...options, ...callbacks(options) });
  };
}

module.exports = Object.freeze({ installed: true });
