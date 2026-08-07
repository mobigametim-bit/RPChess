'use strict';

const economy = require('../runtime/production-economy.cjs');
const narrative = require('../runtime/production-narrative.cjs');
const { validateProductionEventLibrary } = require('../content/production-events.cjs');
const { createProductionEventSession, restoreProductionEventSession } = require('../runtime/production-event-session.cjs');
const eventSource = require('../../content/events/iron_marches_production.json');
const { buildBrowserProductionBundle } = require('./production-content-browser.cjs');
const { createEncounterScenario } = require('../content/scenario-templates.cjs');
const { projectIronMarchesBattleOptions } = require('../runtime/iron-marches-mechanics.cjs');
const { hash32 } = require('../core/determinism.cjs');

const INSTALL_KEY = Symbol.for('rpchess.b10-b13-production-runtime-installed');
if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;

  const library = validateProductionEventLibrary(eventSource);
  const productionEventIds = new Set(library.events.map((event) => event.id));
  const runtimeState = require('../campaign/runtime-state.cjs');
  const vertical = require('../runtime/vertical-slice.cjs');
  const presenter = require('../runtime/presenter-bridge.cjs');

  const originalCreateRuntime = vertical.createVerticalSliceRuntime;
  const originalValidateSnapshot = vertical.validateVerticalSliceSnapshot;
  const originalCreatePresenterSnapshot = presenter.createPresenterSnapshot;
  const originalDispatchPresenterCommand = presenter.dispatchPresenterCommand;

  function freezeArray(values) { return Object.freeze((values || []).slice()); }
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
  function productionizeRuntime(state, options = {}) {
    if (!productionRun(state)) return state;
    const narrativeState = state.narrative ? narrative.createNarrativeState(state.narrative) : narrative.createNarrativeState();
    return deepFreeze({
      ...state,
      stageB: economy.productionizeStageB(state.stageB),
      resources: deepFreeze({
        ...state.resources,
        gold: Number.isInteger(state.resources?.gold) ? state.resources.gold : economy.START_GOLD + Number(options.explicitStartGoldModifier || 0)
      }),
      narrative: narrativeState,
      productionEvent: state.productionEvent || null,
      interActConversion: state.interActConversion || null
    });
  }
  vertical.createVerticalSliceRuntime = function createProductionVerticalSliceRuntime(options = {}) {
    let state = originalCreateRuntime(options);
    if (!productionRun(state)) return state;
    state = deepFreeze({
      ...state,
      campaign: deepFreeze({ ...state.campaign, supplies: economy.START_SUPPLIES }),
      resources: deepFreeze({ ...state.resources, gold: economy.START_GOLD + Number(options.explicitStartGoldModifier || 0) })
    });
    return productionizeRuntime(state, options);
  };
  vertical.validateVerticalSliceSnapshot = function validateProductionVerticalSliceSnapshot(snapshot, options = {}) {
    return productionizeRuntime(originalValidateSnapshot(snapshot, options), options);
  };

  function runtimeEventContext(state) {
    return {
      seed: state.seed,
      flags: state.flags || [],
      gold: state.resources?.gold || 0,
      supplies: state.campaign?.supplies || 0,
      doctrineId: state.army?.doctrineId || null,
      heroIds: state.army?.heroIds || [],
      relicIds: state.army?.relicIds || [],
      roster: state.stageB?.roster || [],
      participatedRosterIds: state.productionEvent?.context?.participatedRosterIds || []
    };
  }
  function startProductionEvent(state) {
    const eventId = state.currentNode?.contentId;
    if (!productionEventIds.has(eventId)) return state;
    const session = createProductionEventSession({ library, eventId, language: 'ru', context: runtimeEventContext(state) });
    return deepFreeze({ ...state, productionEvent: session.snapshot() });
  }
  function eventView(state) {
    if (!state.productionEvent) return null;
    return restoreProductionEventSession({ library, snapshot: state.productionEvent }).view();
  }
  function applySessionContext(state, sessionSnapshot, eventMeta) {
    const context = sessionSnapshot.context;
    const outcome = sessionSnapshot.state.resolution?.outcome || null;
    let narrativeState = state.narrative || narrative.createNarrativeState();
    if (outcome && eventMeta) narrativeState = narrative.applyEventOutcome(narrativeState, eventMeta, outcome);
    return deepFreeze({
      ...state,
      resources: deepFreeze({ ...state.resources, gold: context.gold }),
      campaign: deepFreeze({ ...state.campaign, supplies: context.supplies }),
      flags: freezeArray(context.flags),
      narrative: narrative.withRegionalLines(narrativeState),
      productionEvent: sessionSnapshot
    });
  }
  function completeEventNode(state, rewardClaimed = true) {
    const nodeId = state.currentNode?.nodeId || state.campaign.currentNodeId;
    let campaign = state.campaign;
    if (!campaign.completedNodeIds.includes(nodeId)) campaign = runtimeState.completeNode(campaign, nodeId, { rewardClaimed });
    campaign = runtimeState.checkSecretAfterNode(campaign, nodeId);
    return deepFreeze({
      ...state,
      campaign,
      status: campaign.secret.pendingDecision ? 'campaign' : 'campaign',
      currentNode: null,
      event: null,
      scenario: null,
      productionEvent: null
    });
  }
  function createEventCombatScenario(state, pendingCombat) {
    const bundle = buildBrowserProductionBundle();
    const battleProjector = (battleOptions) => projectIronMarchesBattleOptions(battleOptions, state.army, state.stageB);
    const created = createEncounterScenario(bundle.scenarioTemplates, pendingCombat.encounterId, {
      seed: hash32(`${state.seed}:${state.currentNode?.nodeId || 'event'}:${pendingCombat.encounterId}:event-combat`),
      playerSide: state.playerSide,
      scenarioId: `${pendingCombat.encounterId.replace(/[^a-z0-9_-]+/g, '_')}_${state.currentNode?.nodeId || 'event'}`,
      battleProjector
    });
    return created.scenario;
  }

  function eventPresenterSurface(state) {
    const view = eventView(state);
    if (!view) return null;
    const definition = library.eventsById[view.eventId];
    return deepFreeze({
      eventId: view.eventId,
      nodeId: state.currentNode?.nodeId || null,
      status: view.status,
      eventClass: view.eventClass,
      variantId: view.variantId,
      stageId: view.stageId,
      stageIndex: view.stageIndex,
      title: view.title,
      body: view.body,
      sceneArt: definition?.sceneArt || null,
      scope: definition?.scope || 'iron_marches',
      participant: view.participant,
      resources: view.resources,
      choices: freezeArray(view.choices.map((choice) => deepFreeze({
        id: choice.id,
        label: choice.label,
        preview: choice.preview,
        participantRequired: choice.participantRequired,
        probabilities: choice.probabilities,
        modifiers: choice.modifiers,
        effectCount: 0
      }))),
      resolution: view.resolution,
      pendingCombat: view.pendingCombat,
      chain: view.chain,
      history: view.history,
      combatHistory: view.combatHistory
    });
  }
  function serviceSurface(snapshot, state) {
    const service = state.stageB?.service;
    if (!service) return snapshot;
    const gold = Number(state.resources?.gold || 0);
    const offers = service.offers.map((offer) => deepFreeze({
      ...offer,
      used: service.usedOfferIds?.includes(offer.id) || false,
      affordable: gold >= Number(offer.cost || 0),
      remainingGold: gold - Number(offer.cost || 0),
      disabledReason: service.usedOfferIds?.includes(offer.id) ? 'already_used' : gold < Number(offer.cost || 0) ? 'not_enough_gold' : null
    }));
    return deepFreeze({ ...snapshot, stageB: snapshot.stageB ? { ...snapshot.stageB, service: { ...service, offers: freezeArray(offers), currentGold: gold } } : snapshot.stageB });
  }
  presenter.createPresenterSnapshot = function createProductionPresenterSnapshot(state, dependencies = {}) {
    let snapshot = originalCreatePresenterSnapshot(state, dependencies);
    if (!productionRun(state)) return snapshot;
    if (state.productionEvent) snapshot = deepFreeze({ ...snapshot, event: eventPresenterSurface(state) });
    snapshot = serviceSurface(snapshot, state);
    const finale = state.stageB?.actOutcome?.choices ? state.stageB.actOutcome : null;
    return deepFreeze({
      ...snapshot,
      economy: {
        gold: state.resources?.gold || 0,
        supplies: state.campaign?.supplies || 0,
        ledger: state.stageB?.economy?.ledger || [],
        interActConversion: state.interActConversion || null
      },
      narrative: {
        facts: narrative.factIds(state.narrative || narrative.createNarrativeState()),
        regionalLines: narrative.deriveRegionalLines(state.narrative || narrative.createNarrativeState()),
        decisionHistory: state.narrative?.decisionHistory || []
      },
      politicalFinale: finale ? { summary: finale.summary, choices: finale.choices, selectedChoiceId: finale.selectedChoiceId || null } : null
    });
  };

  function normalizedCommand(commandInput) {
    return typeof presenter.normalizePresenterCommand === 'function' ? presenter.normalizePresenterCommand(commandInput) : commandInput;
  }
  function customResult(state, command, dependencies, saveEnvelope = null) {
    return Object.freeze({ state, snapshot: presenter.createPresenterSnapshot(state, dependencies), command, saveEnvelope });
  }
  function dispatchProductionEvent(state, command, dependencies) {
    const session = restoreProductionEventSession({ library, snapshot: state.productionEvent });
    const before = session.snapshot();
    const view = session.choose(command.choiceId || command.payload?.choiceId, runtimeEventContext(state));
    const after = session.snapshot();
    const meta = {
      eventId: after.state.eventId,
      eventClass: after.state.eventClass,
      variantId: after.state.variantId,
      stageId: before.state.stageId,
      choiceId: command.choiceId || command.payload?.choiceId
    };
    let next = applySessionContext(state, after, meta);
    next = deepFreeze({ ...next, transcript: freezeArray([...(state.transcript || []), deepFreeze({ type: 'ChooseEvent', choiceId: meta.choiceId })]) });
    if (view.status === 'combat_pending') {
      next = deepFreeze({
        ...next,
        status: 'scenario',
        scenario: createEventCombatScenario(next, view.pendingCombat),
        currentNode: deepFreeze({ ...next.currentNode, eventCombat: true, eventRewardMode: view.pendingCombat.rewardMode || 'event_only' })
      });
    } else if (view.status === 'resolved') next = completeEventNode(next, true);
    else next = deepFreeze({ ...next, status: 'event' });
    return customResult(next, command, dependencies);
  }
  function dispatchProductionService(state, command, dependencies) {
    if (command.type === 'LeaveService') {
      const stageB = deepFreeze({ ...state.stageB, status: 'campaign', service: null });
      const next = deepFreeze({ ...state, stageB, status: 'campaign', currentNode: null, transcript: freezeArray([...(state.transcript || []), deepFreeze({ type: 'LeaveService' })]) });
      return customResult(next, command, dependencies);
    }
    const offerId = command.offerId || command.payload?.offerId;
    const targetRosterId = command.targetRosterId || command.payload?.targetRosterId || null;
    const targetRelicId = command.targetRelicId || command.payload?.targetRelicId || null;
    const offer = state.stageB.service?.offers.find((entry) => entry.id === offerId);
    if (!offer) throw new Error('service offer is unavailable');
    const stageB = economy.useProductionService(state.stageB, offerId, { targetRosterId, targetRelicId, gold: state.resources.gold });
    const tx = stageB.lastServiceTransaction;
    const campaign = deepFreeze({
      ...state.campaign,
      supplies: Math.max(0, state.campaign.supplies + Number(tx.supplyDelta || 0)),
      scouting: Math.min(3, Number(state.campaign.scouting || 0) + Number(tx.scoutingDelta || 0))
    });
    const resources = deepFreeze({ ...state.resources, gold: state.resources.gold - Number(offer.cost || 0) });
    const next = deepFreeze({
      ...state,
      stageB,
      campaign,
      resources,
      status: stageB.status,
      currentNode: stageB.status === 'service' ? state.currentNode : null,
      transcript: freezeArray([...(state.transcript || []), deepFreeze({ type: 'UseService', offerId, targetRosterId, targetRelicId })])
    });
    return customResult(next, command, dependencies);
  }
  function applyRewardBonus(previous, next, command) {
    const offerId = command.offerId || command.payload?.offerId;
    const offer = previous.stageB?.pendingRewardOffers?.find((entry) => entry.id === offerId);
    if (!offer?.bonus) return next;
    if (offer.bonus.type === 'gold') return deepFreeze({ ...next, resources: { ...next.resources, gold: next.resources.gold + offer.bonus.amount } });
    if (offer.bonus.type === 'supplies') return deepFreeze({ ...next, campaign: { ...next.campaign, supplies: next.campaign.supplies + offer.bonus.amount } });
    return next;
  }
  function installFinale(state) {
    if (state.status !== 'act_outcome' || !state.stageB?.actOutcome) return state;
    const finale = narrative.buildIronMarchesFinale(state.narrative || narrative.createNarrativeState(), state.resources || {});
    return deepFreeze({ ...state, stageB: { ...state.stageB, actOutcome: finale } });
  }
  function finalizeEventCombat(previous, next, resultType) {
    if (!previous.currentNode?.eventCombat || !previous.productionEvent) return next;
    if (next.status === 'scenario') return deepFreeze({ ...next, productionEvent: previous.productionEvent });
    const session = restoreProductionEventSession({ library, snapshot: previous.productionEvent });
    const result = resultType || (next.status === 'reward_choice' ? 'victory' : 'defeat');
    session.completeCombat(result);
    const sessionSnapshot = session.snapshot();
    if (result === 'victory') {
      let stageB = next.stageB;
      if (stageB.status === 'reward_choice') stageB = deepFreeze({ ...stageB, status: 'campaign', pendingRewardOffers: freezeArray([]) });
      return deepFreeze({
        ...applySessionContext(next, sessionSnapshot, null),
        stageB,
        status: sessionSnapshot.state.status === 'resolved' ? 'campaign' : 'event',
        scenario: null,
        currentNode: sessionSnapshot.state.status === 'resolved' ? null : previous.currentNode,
        productionEvent: sessionSnapshot.state.status === 'resolved' ? null : sessionSnapshot,
        campaign: sessionSnapshot.state.status === 'resolved'
          ? runtimeState.completeNode(next.campaign, previous.currentNode.nodeId, { rewardClaimed: false })
          : next.campaign
      });
    }
    return deepFreeze({ ...next, productionEvent: sessionSnapshot, currentNode: previous.currentNode });
  }

  presenter.dispatchPresenterCommand = function dispatchProductionPresenterCommand(stateInput, commandInput, dependencies = {}) {
    const state = productionizeRuntime(stateInput);
    const command = normalizedCommand(commandInput);
    if (!productionRun(state)) return originalDispatchPresenterCommand(stateInput, commandInput, dependencies);
    if (state.productionEvent && state.status === 'event' && command.type === 'ChooseEvent') return dispatchProductionEvent(state, command, dependencies);
    if (state.status === 'service' && ['UseService', 'LeaveService'].includes(command.type)) return dispatchProductionService(state, command, dependencies);
    if (command.type === 'ChooseActOutcome' && state.stageB?.actOutcome) {
      const choiceId = command.choiceId || command.payload?.choiceId;
      const choice = state.stageB.actOutcome.choices.find((entry) => entry.id === choiceId);
      if (!choice) throw new Error('political finale choice is unavailable');
      if (!choice.available) throw new Error('political finale choice requirements are not met');
      if (state.resources.gold < Number(choice.costGold || 0)) throw new Error('not enough gold for political finale choice');
      const result = originalDispatchPresenterCommand(state, commandInput, dependencies);
      const selected = narrative.selectIronMarchesFinale(state.narrative, state.stageB.actOutcome, choiceId, state.resources);
      const next = deepFreeze({ ...result.state, narrative: selected.narrative, resources: selected.resources });
      return customResult(next, result.command || command, dependencies, result.saveEnvelope || null);
    }

    const result = originalDispatchPresenterCommand(state, commandInput, dependencies);
    let next = productionizeRuntime(result.state);
    if (command.type === 'Travel' && next.status === 'event' && productionEventIds.has(next.currentNode?.contentId)) next = startProductionEvent(next);
    if (command.type === 'ChooseRewardOffer') {
      next = applyRewardBonus(state, next, command);
      next = installFinale(next);
    }
    if (command.type === 'PlayerCommand' && state.currentNode?.eventCombat) next = finalizeEventCombat(state, next);
    if (command.type === 'ContinueRoyalRetreat' && state.currentNode?.eventCombat && state.productionEvent) {
      if (!next.campaign.completedNodeIds.includes(state.currentNode.nodeId)) next = deepFreeze({ ...next, campaign: runtimeState.completeNode(next.campaign, state.currentNode.nodeId, { rewardClaimed: false }), productionEvent: null });
    }
    if (command.type === 'ConfirmReorganization' && next.status === 'complete') {
      const conversion = economy.interActConversion(next.resources, next.campaign);
      next = deepFreeze({
        ...next,
        resources: { ...next.resources, gold: conversion.nextGold },
        campaign: { ...next.campaign, supplies: conversion.nextSupplies },
        interActConversion: conversion
      });
    }
    return customResult(next, result.command || command, dependencies, result.saveEnvelope || null);
  };
}

module.exports = Object.freeze({ installed: true });
