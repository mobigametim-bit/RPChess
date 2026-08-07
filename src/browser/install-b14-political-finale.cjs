'use strict';

const b14 = require('../runtime/political-finale-b14.cjs');
const narrative = require('../runtime/production-narrative.cjs');
const stageBAct = require('../runtime/stage-b-act.cjs');

const INSTALL_KEY = Symbol.for('rpchess.b14-political-finale-installed');
if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;

  const presenter = require('../runtime/presenter-bridge.cjs');
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
  function appendTranscript(state, record) {
    return freezeArray([...(state.transcript || []), deepFreeze(record)]);
  }
  function isIronMarchesStageB(state) {
    return Boolean(state?.campaign?.graph?.stageB && state?.campaign?.graph?.regionId === 'region.iron_marches');
  }
  function b14Resources(state) {
    return Object.freeze({ gold: Number(state.resources?.gold || 0), supplies: Number(state.campaign?.supplies || 0), meta: Number(state.resources?.meta || 0) });
  }
  function withB14Resources(state, values) {
    return deepFreeze({
      ...state,
      resources: { ...state.resources, gold: Number(values.gold ?? state.resources?.gold ?? 0), meta: Number(values.meta ?? state.resources?.meta ?? 0) },
      campaign: { ...state.campaign, supplies: Math.max(0, Number(values.supplies ?? state.campaign?.supplies ?? 0)) }
    });
  }
  function surfaceOutcome(finale, state) {
    const surface = b14.finaleSurface(finale, b14Resources(state));
    const choices = (surface?.choices || []).map((choice) => Object.freeze({
      ...choice,
      id: String(choice.id),
      title: choice.title || choice.name || String(choice.id),
      consequence: choice.consequence || choice.description || choice.advantage || '',
      available: choice.available !== false
    }));
    return Object.freeze({
      summary: surface?.summary || '',
      choices: freezeArray(choices),
      selectedChoiceId: null,
      regionalRecruitId: state.stageB?.draft?.selectedHeroId || state.army?.heroIds?.[0] || 'hero.aldric_wall',
      b14Stage: finale.stage
    });
  }
  function withActOutcomeSurface(state, finale) {
    return deepFreeze({
      ...state,
      status: 'act_outcome',
      politicalFinaleB14: finale,
      stageB: {
        ...state.stageB,
        status: 'act_outcome',
        actOutcome: surfaceOutcome(finale, state),
        pendingRewardOffers: finale.stage === 'act_reward' ? state.stageB.pendingRewardOffers : freezeArray([])
      }
    });
  }
  function startB14(state) {
    const regionalLines = narrative.deriveRegionalLines(state.narrative || narrative.createNarrativeState());
    const finale = b14.createPoliticalFinale({ seed: state.seed, narrative: state.narrative, regionalLines });
    return withActOutcomeSurface(deepFreeze({
      ...state,
      politicalFinaleB14: finale,
      history: freezeArray([...(state.history || []), Object.freeze({ index: (state.history || []).length, type: 'b14_political_finale_started', finaleSeed: finale.finaleSeed })])
    }), finale);
  }
  function maybeStartB14(state) {
    return isIronMarchesStageB(state) && state.status === 'act_outcome' && !state.politicalFinaleB14 ? startB14(state) : state;
  }
  function applyNarrativeFact(state, factId, type = 'position') {
    const nextNarrative = narrative.applyFacts(state.narrative || narrative.createNarrativeState(), [{
      id: factId,
      type,
      source: 'iron_marches_b14',
      scope: type === 'fate' ? 'campaign' : 'region',
      visibility: 'known',
      eventClass: 'regional_finale',
      priority: narrative.EVENT_CLASS_PRIORITY.regional_finale,
      replaceable: false
    }], [], { source: 'iron_marches_b14', eventClass: 'regional_finale' });
    return deepFreeze({ ...state, narrative: narrative.withRegionalLines(nextNarrative) });
  }
  function createB14Reorganization(stageB) {
    const roster = (stageB.roster || []).map((entry) => entry.injury === 'light'
      ? Object.freeze({ ...entry, injury: null, skipBattles: 0, available: true })
      : entry);
    const carrySupplyCap = 10;
    const compensation = Math.max(0, Number(stageB.economy?.suppliesEarned || 0) - Number(stageB.economy?.suppliesSpent || 0) - carrySupplyCap);
    const stars = roster.reduce((sum, entry) => sum + Number(entry.stars || 0), 0);
    const armyStrength = roster.reduce((sum, entry) => sum + Number(entry.stars || 0) + (entry.kind === 'hero' ? 2 : 1), 0);
    const activeRosterIds = roster.filter((entry) => entry.active && entry.available).map((entry) => entry.id);
    const king = roster.find((entry) => entry.kind === 'king' && entry.available);
    if (king && !activeRosterIds.includes(king.id)) activeRosterIds.unshift(king.id);
    const reorganization = Object.freeze({
      activeRosterIds: freezeArray(activeRosterIds),
      reserveRosterIds: freezeArray(roster.map((entry) => entry.id).filter((id) => !activeRosterIds.includes(id))),
      commandLimit: stageB.commandLimit,
      supplyCarryCap: carrySupplyCap,
      excessSupplyCompensation: compensation,
      heavyInjuries: freezeArray(roster.filter((entry) => entry.injury === 'heavy').map((entry) => entry.id)),
      temporaryEffectsCleared: freezeArray(stageB.temporaryEffects || []),
      nextRegionScaling: Object.freeze({ act: Number(stageB.act || 1) + 1, armyStrength, enemyBonus: Math.max(0, Math.min(3, Math.floor(stars / 5))) }),
      lockedTalentIds: freezeArray(roster.flatMap((entry) => entry.talents || [])),
      confirmed: false
    });
    return deepFreeze({ ...stageB, status: 'reorganization', roster: freezeArray(roster), temporaryEffects: freezeArray([]), reorganization });
  }
  function customResult(state, command, dependencies, saveEnvelope = null) {
    return Object.freeze({ state, snapshot: presenter.createPresenterSnapshot(state, dependencies), command, saveEnvelope });
  }
  function handleB14Choice(stateInput, command, dependencies) {
    let state = stateInput;
    let finale = state.politicalFinaleB14;
    const choiceId = command.choiceId || command.payload?.choiceId;
    if (!choiceId) throw new Error('B14 choice requires choiceId');

    if (finale.stage === 'cabinet') {
      const beforeIndex = finale.crisisIndex;
      const forceId = finale.crisisQueue[beforeIndex] || null;
      const resolved = b14.resolveCabinet(finale, choiceId, b14Resources(state));
      state = withB14Resources(state, resolved.resources);
      finale = resolved.finale;
      if (forceId && finale.cabinetResolutions?.[forceId]?.factId) state = applyNarrativeFact(state, finale.cabinetResolutions[forceId].factId, 'obligation');
      state = withActOutcomeSurface(state, finale);
    } else if (finale.stage === 'government') {
      finale = b14.chooseGovernment(finale, choiceId);
      state = applyNarrativeFact(state, `government.iron_marches.${finale.governmentId}`, 'position');
      state = withActOutcomeSurface(state, finale);
    } else if (finale.stage === 'law') {
      finale = b14.chooseLaw(finale, choiceId);
      state = applyNarrativeFact(state, `legacy.iron_marches.${finale.legacyLawId}`, 'fate');
      state = deepFreeze({ ...state, regionalLegacy: { ...(state.regionalLegacy || {}), iron_marches: finale.legacyLawId }, regionalSupport: { ...(state.regionalSupport || {}), iron_marches: finale.support } });
      state = withActOutcomeSurface(state, finale);
    } else if (finale.stage === 'epilogue') {
      if (choiceId !== 'epilogue_continue') throw new Error('epilogue continuation is unavailable');
      finale = b14.finishEpilogue(finale);
      const stageB = stageBAct.generateRewardOffers(state.stageB, { nodeId: 'act_reward:iron_marches', elite: true, sideObjectiveCompleted: true, doctrineId: state.army?.doctrineId || null });
      state = deepFreeze({ ...state, politicalFinaleB14: finale, stageB, status: 'reward_choice', transcript: appendTranscript(state, { type: 'ChooseActOutcome', choiceId }) });
      return customResult(state, command, dependencies);
    } else if (finale.stage === 'interact') {
      if (choiceId !== 'interact_continue') throw new Error('inter-act continuation is unavailable');
      finale = b14.completeFinale(finale);
      const stageB = createB14Reorganization(state.stageB);
      state = deepFreeze({ ...state, politicalFinaleB14: finale, stageB, status: 'reorganization' });
    } else throw new Error(`B14 choice is unavailable during ${finale.stage}`);

    state = deepFreeze({ ...state, transcript: appendTranscript(state, { type: 'ChooseActOutcome', choiceId, b14Stage: state.politicalFinaleB14?.stage || finale.stage }) });
    return customResult(state, command, dependencies);
  }

  presenter.createPresenterSnapshot = function createB14PresenterSnapshot(stateInput, dependencies = {}) {
    const state = maybeStartB14(stateInput);
    let snapshot = originalCreatePresenterSnapshot(state, dependencies);
    if (!state.politicalFinaleB14) return snapshot;
    const surface = b14.finaleSurface(state.politicalFinaleB14, b14Resources(state));
    snapshot = deepFreeze({
      ...snapshot,
      politicalFinaleB14: surface,
      campaignLegacy: state.regionalLegacy || null,
      regionalSupport: state.regionalSupport || null
    });
    return snapshot;
  };

  presenter.dispatchPresenterCommand = function dispatchB14PresenterCommand(stateInput, commandInput, dependencies = {}) {
    let state = maybeStartB14(stateInput);
    const command = typeof presenter.normalizePresenterCommand === 'function' ? presenter.normalizePresenterCommand(commandInput) : commandInput;

    if (state.politicalFinaleB14 && state.status === 'act_outcome' && command.type === 'ChooseActOutcome') return handleB14Choice(state, command, dependencies);

    if (state.politicalFinaleB14 && state.politicalFinaleB14.stage === 'act_reward' && state.status === 'reward_choice' && command.type === 'ChooseRewardOffer') {
      const result = originalDispatchPresenterCommand(state, commandInput, dependencies);
      let next = result.state;
      const finale = b14.finishActReward(state.politicalFinaleB14, command.offerId || command.payload?.offerId);
      next = deepFreeze({ ...next, politicalFinaleB14: finale, status: 'act_outcome', stageB: { ...next.stageB, status: 'act_outcome', actOutcome: surfaceOutcome(finale, next) } });
      return customResult(next, result.command || command, dependencies, result.saveEnvelope || null);
    }

    const result = originalDispatchPresenterCommand(state, commandInput, dependencies);
    let next = maybeStartB14(result.state);
    return next === result.state ? result : customResult(next, result.command || command, dependencies, result.saveEnvelope || null);
  };
}

module.exports = require('./iron-marches-browser-host.cjs');
