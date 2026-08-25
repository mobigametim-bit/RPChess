'use strict';

const { validateProductionEventLibrary } = require('../content/production-events.cjs');
const { createProductionEventSession } = require('../runtime/production-event-session.cjs');
const { createAuthoredEventState } = require('../runtime/authored-event.cjs');
const eventSource = require('../../content/events/iron_marches_production.json');

const INSTALL_KEY = Symbol.for('rpchess.production-event-travel-installed');
if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;

  const vertical = require('../runtime/vertical-slice.cjs');
  const presenter = require('../runtime/presenter-bridge.cjs');
  const innerValidate = vertical.validateVerticalSliceSnapshot;
  const innerDispatch = presenter.dispatchPresenterCommand;
  const library = validateProductionEventLibrary(eventSource);
  const eventIds = new Set(library.events.map((event) => event.id));

  function deepFreeze(value, seen = new Set()) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
    seen.add(value);
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child, seen);
    return value;
  }

  function productionRun(state) {
    return Boolean(state?.campaign?.graph?.generatorVersion === 3 && state.campaign.graph.regionId === 'region.iron_marches');
  }

  function productionEventId(state) {
    return state?.productionEvent?.state?.eventId || state?.productionEvent?.eventId || null;
  }

  function compatibilityEvent(state, options = {}) {
    const eventId = productionEventId(state);
    if (!productionRun(state) || state.status !== 'event' || !eventId || !eventIds.has(eventId)) return null;
    const content = options.contentRegistry?.get?.('event', eventId);
    if (!content) throw new Error(`production event reload references missing compiled event: ${eventId}`);
    return createAuthoredEventState(content, { nodeId:state.currentNode?.nodeId || state.campaign?.currentNodeId || '' });
  }

  vertical.validateVerticalSliceSnapshot = function validateProductionEventSnapshot(snapshot, options = {}) {
    const shim = compatibilityEvent(snapshot, options);
    if (!shim || snapshot.event) return innerValidate(snapshot, options);
    const validated = innerValidate({ ...snapshot, event:shim }, options);
    return deepFreeze({ ...validated, event:null, productionEvent:snapshot.productionEvent });
  };

  function eventTarget(state, commandInput) {
    if (!productionRun(state) || state.status !== 'campaign' || String(commandInput?.type || '') !== 'Travel') return null;
    const targetNodeId = String(commandInput.targetNodeId || commandInput.payload?.targetNodeId || '');
    if (!targetNodeId) return null;
    const node = state.campaign.graph.nodesById?.[targetNodeId];
    const materialized = state.campaign.materializedContentByNode?.[targetNodeId];
    const eventId = materialized?.contentId || node?.contentId || null;
    if (node?.type !== 'event' || !eventIds.has(eventId)) return null;
    return Object.freeze({ targetNodeId, eventId });
  }

  function eventContext(state) {
    return Object.freeze({
      seed: state.seed,
      flags: state.flags || [],
      gold: state.resources?.gold || 0,
      supplies: state.campaign?.supplies || 0,
      doctrineId: state.army?.doctrineId || null,
      heroIds: state.army?.heroIds || [],
      relicIds: state.army?.relicIds || [],
      roster: state.stageB?.roster || [],
      participatedRosterIds: []
    });
  }

  presenter.dispatchPresenterCommand = function dispatchProductionEventTravel(state, commandInput, dependencies = {}) {
    const target = eventTarget(state, commandInput);
    if (!target) return innerDispatch(state, commandInput, dependencies);
    if (typeof dependencies.nodeResolver !== 'function') throw new Error('production event travel requires nodeResolver');

    const originalNodeResolver = dependencies.nodeResolver;
    const travelDependencies = {
      ...dependencies,
      nodeResolver(payload) {
        if (payload?.node?.id === target.targetNodeId && payload.node.type === 'event') {
          return Object.freeze({ mode:'immediate', reward:Object.freeze({ gold:0, supplies:0, meta:0 }) });
        }
        return originalNodeResolver(payload);
      }
    };
    const travelled = innerDispatch(state, commandInput, travelDependencies);
    if (travelled.state?.currentNode?.nodeId !== target.targetNodeId) throw new Error('production event travel did not enter the target node');
    const session = createProductionEventSession({
      library,
      eventId:target.eventId,
      language:'ru',
      context:eventContext(travelled.state)
    });
    const next = deepFreeze({
      ...travelled.state,
      status:'event',
      event:null,
      scenario:null,
      boss:null,
      pendingReward:null,
      productionEvent:session.snapshot()
    });
    return Object.freeze({
      ...travelled,
      state:next,
      snapshot:presenter.createPresenterSnapshot(next, dependencies)
    });
  };
}

module.exports = Object.freeze({ installed:true });
