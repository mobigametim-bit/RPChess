'use strict';

const fs = require('fs');
const path = require('path');
const { ContentRegistry } = require('./index.cjs');
const { loadBoardThemeManifest } = require('../assets/board-manifest.cjs');
const { loadCombatProfileSet } = require('./combat-profiles.cjs');
const {
  loadEffectCatalog,
  mergeEffectCatalogs,
  validateEventEffectReferences,
  createCatalogEventChoiceResolver
} = require('./effect-catalog.cjs');
const {
  loadProductionEventLibrary,
  compileProductionEventPack,
  compileProductionLocalization
} = require('./production-events.cjs');
const { createCompatibleProductionEventChoiceResolver } = require('./production-event-runtime.cjs');
const { bindRegister04EventArt } = require('./register-04-event-assets.cjs');

const DEFAULT_BOARD_MANIFEST = 'content/board-themes.json';
const DEFAULT_PACKS = Object.freeze(['content/packs/iron_marches_vertical_slice.json']);
const DEFAULT_EFFECT_CATALOGS = Object.freeze(['content/effects/iron_marches_events.json']);
const DEFAULT_COMBAT_PROFILES = 'content/combat-profiles/iron_marches.json';
const DEFAULT_PRODUCTION_EVENTS = 'content/events/iron_marches_production.json';
const DEFAULT_LOCALIZATION = Object.freeze({
  ru: Object.freeze(['content/localization/ru/iron_marches_vertical_slice.json']),
  en: Object.freeze(['content/localization/en/iron_marches_vertical_slice.json'])
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveProjectPath(projectRoot, relativePath) {
  const root = path.resolve(projectRoot);
  const absolute = path.resolve(root, relativePath);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) throw new Error(`production content path escapes project root: ${relativePath}`);
  return absolute;
}

function mergeLocalization(projectRoot, pathsByLanguage) {
  const localization = {};
  for (const language of ['ru', 'en']) {
    const dictionary = {};
    for (const relativePath of pathsByLanguage[language] || []) {
      const filePath = resolveProjectPath(projectRoot, relativePath);
      const fragment = readJson(filePath);
      if (!fragment || typeof fragment !== 'object' || Array.isArray(fragment)) throw new Error(`${relativePath} must contain a localization object`);
      for (const [key, value] of Object.entries(fragment)) {
        if (Object.prototype.hasOwnProperty.call(dictionary, key)) throw new Error(`duplicate ${language} localization key: ${key}`);
        if (typeof value !== 'string' || !value.trim()) throw new Error(`invalid ${language} localization value: ${key}`);
        dictionary[key] = value;
      }
    }
    localization[language] = Object.freeze(dictionary);
  }
  return Object.freeze(localization);
}

function mergeProductionLocalization(base, productionEvents) {
  return Object.freeze({
    ru: Object.freeze({ ...base.ru, ...compileProductionLocalization(productionEvents, 'ru') }),
    en: Object.freeze({ ...base.en, ...compileProductionLocalization(productionEvents, 'en') })
  });
}

function buildProductionContentBundle(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.resolve(__dirname, '../..'));
  const boardManifestPath = options.boardManifestPath || DEFAULT_BOARD_MANIFEST;
  const packPaths = options.packPaths || DEFAULT_PACKS;
  const effectCatalogPaths = options.effectCatalogPaths || DEFAULT_EFFECT_CATALOGS;
  const combatProfilePath = options.combatProfilePath || DEFAULT_COMBAT_PROFILES;
  const productionEventPath = options.productionEventPath || DEFAULT_PRODUCTION_EVENTS;
  const localizationPaths = options.localizationPaths || DEFAULT_LOCALIZATION;
  if (!Array.isArray(packPaths) || !packPaths.length) throw new Error('production content requires at least one pack');
  if (!Array.isArray(effectCatalogPaths) || !effectCatalogPaths.length) throw new Error('production content requires at least one effect catalog');

  const boardThemeManifest = loadBoardThemeManifest(resolveProjectPath(projectRoot, boardManifestPath));
  const productionEvents = loadProductionEventLibrary(resolveProjectPath(projectRoot, productionEventPath));
  const localization = mergeProductionLocalization(mergeLocalization(projectRoot, localizationPaths), productionEvents);
  const registry = new ContentRegistry({ boardThemeManifest });
  const packs = [];
  for (const relativePath of packPaths) {
    const source = readJson(resolveProjectPath(projectRoot, relativePath));
    const pack = bindRegister04EventArt(compileProductionEventPack(source, productionEvents));
    registry.addPack(pack);
    packs.push(Object.freeze({ packId: pack.packId, path: relativePath }));
  }
  registry.finalize({ localization });

  const combatProfiles = loadCombatProfileSet(resolveProjectPath(projectRoot, combatProfilePath), registry);
  const effectCatalogs = effectCatalogPaths.map((relativePath) => loadEffectCatalog(resolveProjectPath(projectRoot, relativePath)));
  const eventEffectCatalog = mergeEffectCatalogs(effectCatalogs);
  validateEventEffectReferences(registry, eventEffectCatalog);
  const catalogEventChoiceResolver = createCatalogEventChoiceResolver(eventEffectCatalog);
  const eventChoiceResolver = createCompatibleProductionEventChoiceResolver(productionEvents, catalogEventChoiceResolver);

  return Object.freeze({
    format: 'rpchess-production-content-bundle',
    schemaVersion: 1,
    projectRoot,
    boardManifestPath,
    boardThemeManifest,
    packs: Object.freeze(packs),
    effectCatalogPaths: Object.freeze(effectCatalogPaths.slice()),
    combatProfilePath,
    productionEventPath,
    productionEvents,
    combatProfiles,
    eventEffectCatalog,
    eventChoiceResolver,
    localization,
    registry,
    summary: registry.summary(),
    assetPaths: registry.assetPaths()
  });
}

function productionContentReport(bundle) {
  if (!bundle || bundle.format !== 'rpchess-production-content-bundle') throw new Error('invalid production content bundle');
  const statuses = { draft: 0, review: 0, approved: 0 };
  for (const kind of Object.keys(bundle.summary)) {
    for (const record of bundle.registry.list(kind)) statuses[record.status] += 1;
  }
  const missingLocalization = [];
  const languageCounts = {};
  for (const language of ['ru', 'en']) languageCounts[language] = Object.keys(bundle.localization[language]).length;
  return Object.freeze({
    ok: missingLocalization.length === 0,
    packs: bundle.packs.length,
    summary: bundle.summary,
    statuses: Object.freeze(statuses),
    languageCounts: Object.freeze(languageCounts),
    effectCatalogs: bundle.effectCatalogPaths.length,
    eventEffectCount: Object.keys(bundle.eventEffectCatalog.effects).length,
    productionEventCount: bundle.productionEvents.events.length,
    combatProfileCount: Object.keys(bundle.combatProfiles.heroes).length,
    assetCount: bundle.assetPaths.length,
    missingLocalization: Object.freeze(missingLocalization)
  });
}

module.exports = {
  DEFAULT_BOARD_MANIFEST,
  DEFAULT_PACKS,
  DEFAULT_EFFECT_CATALOGS,
  DEFAULT_COMBAT_PROFILES,
  DEFAULT_PRODUCTION_EVENTS,
  DEFAULT_LOCALIZATION,
  readJson,
  resolveProjectPath,
  mergeLocalization,
  mergeProductionLocalization,
  buildProductionContentBundle,
  productionContentReport
};
