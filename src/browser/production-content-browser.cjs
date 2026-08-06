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
  compileProductionLocalization,
  createProductionEventChoiceResolver
} = require('../content/production-events.cjs');
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

function buildBrowserProductionBundle() {
  const productionEvents = validateProductionEventLibrary(productionEventSource);
  const productionPack = compileProductionEventPack(productionPackSource, productionEvents);
  const localization = Object.freeze({
    ru: Object.freeze({ ...localizationRu, ...compileProductionLocalization(productionEvents, 'ru') }),
    en: Object.freeze({ ...localizationEn, ...compileProductionLocalization(productionEvents, 'en') })
  });
  const registry = new ContentRegistry({ boardThemeManifest });
  registry.addPack(productionPack);
  registry.finalize({ localization });

  const combatProfiles = validateCombatProfileSet(combatProfileSource, registry);
  const eventEffectCatalog = mergeEffectCatalogs([validateEffectCatalog(effectCatalog)]);
  validateEventEffectReferences(registry, eventEffectCatalog);
  const scenarioTemplates = validateScenarioTemplateSet(scenarioTemplateSource);
  validateScenarioContentReferences(scenarioTemplates, registry);
  const catalogEventChoiceResolver = createCatalogEventChoiceResolver(eventEffectCatalog);

  return Object.freeze({
    format: 'rpchess-browser-production-content',
    schemaVersion: 1,
    boardThemeManifest,
    registry,
    localization,
    productionEvents,
    combatProfiles,
    eventEffectCatalog,
    eventChoiceResolver: createProductionEventChoiceResolver(productionEvents, catalogEventChoiceResolver),
    scenarioTemplates,
    summary: registry.summary(),
    assetPaths: registry.assetPaths()
  });
}

module.exports = {
  buildBrowserProductionBundle
};
