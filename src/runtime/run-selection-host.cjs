'use strict';

const path = require('path');
const { buildProductionContentBundle } = require('../content/production-bundle.cjs');
const {
  createRunSelection,
  selectRunKing,
  selectRunDoctrine,
  toggleRunHero,
  lockRunSelection,
  runSelectionPresenter,
  runSelectionSnapshot
} = require('./run-selection.cjs');
const { DEFAULT_SELECTION, createIronMarchesVerticalSlice } = require('./iron-marches-bootstrap.cjs');

const SELECTION_HOST_FORMAT = 'rpchess-run-selection-host';
const SELECTION_COMMANDS = Object.freeze(['SelectKing', 'SelectDoctrine', 'ToggleHero', 'LockSelection']);

function normalizeSelectionCommand(command) {
  if (!command || typeof command !== 'object') throw new Error('selection command is required');
  const type = String(command.type || '');
  if (!SELECTION_COMMANDS.includes(type)) throw new Error(`unsupported selection command: ${type}`);
  if (type === 'SelectKing') {
    const kingId = String(command.kingId || command.payload?.kingId || '');
    if (!kingId) throw new Error('SelectKing requires kingId');
    return Object.freeze({ type, kingId });
  }
  if (type === 'SelectDoctrine') {
    const doctrineId = String(command.doctrineId || command.payload?.doctrineId || '');
    if (!doctrineId) throw new Error('SelectDoctrine requires doctrineId');
    return Object.freeze({ type, doctrineId });
  }
  if (type === 'ToggleHero') {
    const heroId = String(command.heroId || command.payload?.heroId || '');
    if (!heroId) throw new Error('ToggleHero requires heroId');
    return Object.freeze({ type, heroId });
  }
  return Object.freeze({ type });
}

function createRunSelectionHost(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.resolve(__dirname, '../..'));
  const language = options.language || 'ru';
  const bundle = buildProductionContentBundle({ projectRoot });
  const localization = bundle.localization[language];
  if (!localization) throw new Error(`unsupported run-selection language: ${language}`);
  let selection = createRunSelection({
    contentRegistry: bundle.registry,
    selectionId: options.selectionId || `selection:${options.seed || 1}`,
    regionId: options.regionId || DEFAULT_SELECTION.regionId,
    heroLimit: options.heroLimit ?? 6,
    minimumHeroes: options.minimumHeroes ?? 1
  });
  let verticalSlice = null;

  function snapshot() {
    return Object.freeze({
      format: 'rpchess-run-selection-host-snapshot',
      schemaVersion: 1,
      status: verticalSlice ? 'ready' : selection.status,
      selection: runSelectionPresenter(selection, bundle.registry, localization),
      runtime: verticalSlice?.snapshot || null
    });
  }

  function execute(commandInput) {
    const command = normalizeSelectionCommand(commandInput);
    if (verticalSlice) throw new Error('run selection has already launched');
    if (command.type === 'SelectKing') selection = selectRunKing(selection, command.kingId, bundle.registry);
    else if (command.type === 'SelectDoctrine') selection = selectRunDoctrine(selection, command.doctrineId, bundle.registry);
    else if (command.type === 'ToggleHero') selection = toggleRunHero(selection, command.heroId, bundle.registry);
    else if (command.type === 'LockSelection') {
      selection = lockRunSelection(selection, bundle.registry);
      verticalSlice = createIronMarchesVerticalSlice({
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
      });
    }
    return Object.freeze({ command, snapshot: snapshot() });
  }

  return Object.freeze({
    format: SELECTION_HOST_FORMAT,
    getSelection: () => runSelectionSnapshot(selection),
    getVerticalSlice: () => verticalSlice,
    getSnapshot: snapshot,
    dispatch: async (command) => execute(command),
    contentRegistry: bundle.registry,
    localization
  });
}

module.exports = {
  SELECTION_HOST_FORMAT,
  SELECTION_COMMANDS,
  normalizeSelectionCommand,
  createRunSelectionHost
};
