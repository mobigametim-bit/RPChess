'use strict';

require('./buffer-shim.cjs');

const { ContentRegistry } = require('../content/index.cjs');
const { validateCombatProfileSet } = require('../content/combat-profiles.cjs');
const {
  mergeEffectCatalogs,
  validateEffectCatalog,
  validateEventEffectReferences,
  createCatalogEventChoiceResolver
} = require('../content/effect-catalog.cjs');
const {
  validateProductionEventLibrary,
  compileProductionEventPack,
  compileProductionLocalization
} = require('../content/production-events.cjs');
const { assertProductionEventPolicy, productionEventPolicyReport } = require('../content/production-event-policy.cjs');
const { createCompatibleProductionEventChoiceResolver } = require('../content/production-event-runtime.cjs');
const { bindRegister04EventArt } = require('../content/register-04-event-assets.cjs');
const {
  validateScenarioTemplateSet,
  validateScenarioContentReferences
} = require('../content/scenario-templates.cjs');

const boardThemeManifest = require('../../content/board-themes.json');
const productionPackSource = require('../../content/packs/iron_marches_vertical_slice.json');
const productionEventSource = require('../../content/events/iron_marches_production.json');
const combatProfileSource = require('../../content/combat-profiles/iron_marches.json');
const effectCatalog = require('../../content/effects/iron_marches_events.json');
const localizationRu = require('../../content/localization/ru/iron_marches_vertical_slice.json');
const localizationEn = require('../../content/localization/en/iron_marches_vertical_slice.json');
const scenarioTemplateSource = require('../../content/scenarios/iron_marches_vertical_slice.json');

function playableRegistry(registry, productionEvents) {
  const productionIds = new Set(productionEvents.events.map((event) => event.id));
  return Object.freeze({
    get: (kind, id) => registry.get(kind, id),
    list: (kind) => kind === 'event'
      ? Object.freeze(registry.list(kind).filter((record) => productionIds.has(record.id)))
      : registry.list(kind),
    summary: () => Object.freeze({ ...registry.summary(), event: productionIds.size }),
    assetPaths: () => registry.assetPaths()
  });
}

function buildBrowserProductionBundle() {
  const productionEvents = assertProductionEventPolicy(validateProductionEventLibrary(productionEventSource));
  const eventPolicyReport = productionEventPolicyReport(productionEvents);
  const compiled = compileProductionEventPack(productionPackSource, productionEvents);
  const productionPack = bindRegister04EventArt({ ...compiled, packId: productionPackSource.packId });
  const localization = Object.freeze({
    ru: Object.freeze({ ...localizationRu, ...compileProductionLocalization(productionEvents, 'ru') }),
    en: Object.freeze({ ...localizationEn, ...compileProductionLocalization(productionEvents, 'en') })
  });
  const sourceRegistry = new ContentRegistry({ boardThemeManifest });
  sourceRegistry.addPack(productionPack);
  sourceRegistry.finalize({ localization });

  const combatProfiles = validateCombatProfileSet(combatProfileSource, sourceRegistry);
  const eventEffectCatalog = mergeEffectCatalogs([validateEffectCatalog(effectCatalog)]);
  validateEventEffectReferences(sourceRegistry, eventEffectCatalog);
  const scenarioTemplates = validateScenarioTemplateSet(scenarioTemplateSource);
  validateScenarioContentReferences(scenarioTemplates, sourceRegistry);
  const catalogEventChoiceResolver = createCatalogEventChoiceResolver(eventEffectCatalog);
  const registry = playableRegistry(sourceRegistry, productionEvents);

  return Object.freeze({
    format: 'rpchess-browser-production-content',
    schemaVersion: 1,
    boardThemeManifest,
    registry,
    sourceRegistry,
    localization,
    productionEvents,
    eventPolicyReport,
    combatProfiles,
    eventEffectCatalog,
    eventChoiceResolver: createCompatibleProductionEventChoiceResolver(productionEvents, catalogEventChoiceResolver),
    scenarioTemplates,
    summary: registry.summary(),
    assetPaths: sourceRegistry.assetPaths()
  });
}

module.exports = {
  playableRegistry,
  buildBrowserProductionBundle
};
