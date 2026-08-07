'use strict';

const economy = require('../runtime/production-economy.cjs');

const INSTALL_KEY = Symbol.for('rpchess.b10-b13-presenter-polish-installed');
if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;
  const presenter = require('../runtime/presenter-bridge.cjs');
  const originalNormalize = presenter.normalizePresenterCommand;
  const originalSnapshot = presenter.createPresenterSnapshot;

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

  presenter.normalizePresenterCommand = function normalizeB10B13PresenterCommand(command) {
    const normalized = originalNormalize(command);
    if (normalized.type !== 'UseService') return normalized;
    return deepFreeze({ ...normalized, targetRelicId: command.targetRelicId || command.payload?.targetRelicId || null });
  };

  presenter.createPresenterSnapshot = function createB10B13PresenterSnapshot(state, dependencies = {}) {
    const snapshot = originalSnapshot(state, dependencies);
    if (!productionRun(state)) return snapshot;
    const equippedRelicIds = (state.stageB?.roster || []).flatMap((entry) => entry.relicIds || []);
    const relicInventory = [...new Set([...(state.stageB?.relicInventory || []), ...equippedRelicIds])].sort();
    const stageB = snapshot.stageB ? deepFreeze({
      ...snapshot.stageB,
      relicInventory: freezeArray(relicInventory),
      relicUpgrades: deepFreeze({ ...(state.stageB?.relicUpgrades || {}) }),
      lastServiceTransaction: state.stageB?.lastServiceTransaction || null
    }) : null;
    const conversionPreview = state.status === 'reorganization'
      ? economy.interActConversion(state.resources, state.campaign)
      : state.interActConversion || null;
    const journal = freezeArray((state.narrative?.decisionHistory || [])
      .filter((entry) => entry.type === 'event_decision')
      .slice(-12)
      .map((entry) => deepFreeze({
        eventId: entry.eventId, variantId: entry.variantId, stageId: entry.stageId,
        choiceId: entry.choiceId, outcomeId: entry.outcomeId, immediate: entry.immediate
      })));
    return deepFreeze({
      ...snapshot,
      stageB,
      economy: { ...(snapshot.economy || {}), conversionPreview },
      eventJournal: journal
    });
  };
}

module.exports = Object.freeze({ installed: true });
