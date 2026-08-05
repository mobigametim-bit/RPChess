'use strict';

const path = require('path');
const { buildProductionContentBundle } = require('../content/production-bundle.cjs');
const {
  createRunSelection,
  selectRunKing,
  selectRunDoctrine,
  toggleRunHero,
  lockRunSelection,
  runSelectionPresenter
} = require('./run-selection.cjs');
const { DEFAULT_SELECTION, createIronMarchesVerticalSlice } = require('./iron-marches-bootstrap.cjs');

function createDefaultIronMarchesSelection(bundle, options = {}) {
  let state = createRunSelection({
    contentRegistry: bundle.registry,
    selectionId: options.selectionId || 'iron_marches_default',
    regionId: options.regionId || DEFAULT_SELECTION.regionId,
    heroLimit: options.heroLimit ?? 6,
    minimumHeroes: options.minimumHeroes ?? 1
  });
  state = selectRunKing(state, options.kingId || DEFAULT_SELECTION.kingId, bundle.registry);
  state = selectRunDoctrine(state, options.doctrineId || DEFAULT_SELECTION.doctrineId, bundle.registry);
  for (const heroId of options.heroIds || DEFAULT_SELECTION.heroIds) state = toggleRunHero(state, heroId, bundle.registry);
  return state;
}

function createIronMarchesRunSetup(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.resolve(__dirname, '../..'));
  const bundle = buildProductionContentBundle({ projectRoot });
  const selecting = createDefaultIronMarchesSelection(bundle, options.selection || {});
  const selection = options.lock === false ? selecting : lockRunSelection(selecting, bundle.registry);
  const language = options.language || 'ru';
  const localization = bundle.localization[language];
  if (!localization) throw new Error(`unsupported Iron Marches language: ${language}`);
  const presenter = runSelectionPresenter(selection, bundle.registry, localization);
  const verticalSlice = selection.status === 'locked'
    ? createIronMarchesVerticalSlice({
      ...options,
      projectRoot,
      language,
      selection: Object.freeze({
        regionId: selection.regionId,
        kingId: selection.kingId,
        doctrineId: selection.doctrineId,
        heroIds: selection.heroIds,
        relicIds: DEFAULT_SELECTION.relicIds
      })
    })
    : null;
  return Object.freeze({
    format: 'rpchess-iron-marches-run-setup',
    schemaVersion: 1,
    projectRoot,
    bundle,
    selection,
    presenter,
    verticalSlice
  });
}

module.exports = {
  createDefaultIronMarchesSelection,
  createIronMarchesRunSetup
};
