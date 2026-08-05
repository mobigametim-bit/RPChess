'use strict';

const RUN_SELECTION_FORMAT = 'rpchess-run-selection';
const RUN_SELECTION_SCHEMA_VERSION = 1;
const RUN_SELECTION_STATUSES = Object.freeze(['selecting', 'locked']);

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function stableId(value, prefix, label) {
  const id = String(value || '');
  if (!new RegExp(`^${prefix}\\.[a-z0-9][a-z0-9_-]*$`).test(id)) throw new Error(`${label} must use ${prefix}.* format`);
  return id;
}

function assertRegistry(registry) {
  if (!registry || typeof registry.get !== 'function' || typeof registry.list !== 'function') {
    throw new Error('run selection requires a finalized content registry');
  }
  return registry;
}

function assertSelecting(state) {
  if (!state || state.format !== RUN_SELECTION_FORMAT) throw new Error('invalid run selection state');
  if (state.status !== 'selecting') throw new Error('run selection is already locked');
}

function selectionCatalog(registryInput, regionIdInput) {
  const registry = assertRegistry(registryInput);
  const regionId = stableId(regionIdInput, 'region', 'regionId');
  const region = registry.get('region', regionId);
  if (!region) throw new Error(`unknown region: ${regionId}`);
  const kings = registry.list('king').map((record) => Object.freeze({
    id: record.id,
    nameKey: record.nameKey,
    doctrineIds: freezeArray(record.doctrineIds),
    assets: record.assets
  }));
  const doctrines = registry.list('doctrine').map((record) => Object.freeze({
    id: record.id,
    nameKey: record.nameKey,
    assets: record.assets
  }));
  const heroes = registry.list('hero')
    .filter((record) => record.regionId === regionId)
    .map((record) => Object.freeze({
      id: record.id,
      nameKey: record.nameKey,
      pieceType: record.pieceType,
      abilityId: record.abilityId,
      assets: record.assets
    }));
  return Object.freeze({
    region: Object.freeze({ id: region.id, nameKey: region.nameKey, boardThemeId: region.boardThemeId, factionId: region.factionId }),
    kings: freezeArray(kings),
    doctrines: freezeArray(doctrines),
    heroes: freezeArray(heroes)
  });
}

function normalizeHeroIds(values, heroLimit) {
  if (!Array.isArray(values)) throw new Error('heroIds must be an array');
  const heroIds = values.map((value) => stableId(value, 'hero', 'heroId'));
  if (new Set(heroIds).size !== heroIds.length) throw new Error('heroIds must not contain duplicates');
  if (heroIds.length > heroLimit) throw new Error(`selected heroes exceed limit ${heroLimit}`);
  return freezeArray(heroIds);
}

function validateSelectionReferences(state, registryInput, options = {}) {
  const registry = assertRegistry(registryInput);
  const errors = [];
  const region = registry.get('region', state.regionId);
  const king = state.kingId ? registry.get('king', state.kingId) : null;
  const doctrine = state.doctrineId ? registry.get('doctrine', state.doctrineId) : null;
  if (!region) errors.push(`unknown region: ${state.regionId}`);
  if (state.kingId && !king) errors.push(`unknown king: ${state.kingId}`);
  if (state.doctrineId && !doctrine) errors.push(`unknown doctrine: ${state.doctrineId}`);
  if (king && doctrine && !king.doctrineIds.includes(doctrine.id)) errors.push(`${king.id} does not permit ${doctrine.id}`);
  for (const heroId of state.heroIds) {
    const hero = registry.get('hero', heroId);
    if (!hero) errors.push(`unknown hero: ${heroId}`);
    else if (hero.regionId !== state.regionId) errors.push(`${heroId} belongs to ${hero.regionId}, not ${state.regionId}`);
  }
  if (state.heroIds.length > state.heroLimit) errors.push(`selected heroes exceed limit ${state.heroLimit}`);
  if (options.requireComplete) {
    if (!king) errors.push('king selection is required');
    if (!doctrine) errors.push('doctrine selection is required');
    if (state.heroIds.length < state.minimumHeroes) errors.push(`at least ${state.minimumHeroes} hero selection(s) are required`);
  }
  if (errors.length) {
    const error = new Error(`run selection validation failed with ${errors.length} error(s)`);
    error.details = Object.freeze(errors);
    throw error;
  }
  return true;
}

function createRunSelection(options = {}) {
  const registry = assertRegistry(options.contentRegistry);
  const regionId = stableId(options.regionId, 'region', 'regionId');
  const heroLimit = options.heroLimit ?? 6;
  const minimumHeroes = options.minimumHeroes ?? 1;
  if (!Number.isInteger(heroLimit) || heroLimit < 1 || heroLimit > 16) throw new Error('heroLimit must be an integer from 1 to 16');
  if (!Number.isInteger(minimumHeroes) || minimumHeroes < 1 || minimumHeroes > heroLimit) throw new Error('minimumHeroes must be between 1 and heroLimit');
  const state = Object.freeze({
    format: RUN_SELECTION_FORMAT,
    schemaVersion: RUN_SELECTION_SCHEMA_VERSION,
    selectionId: String(options.selectionId || `selection:${regionId}`),
    status: 'selecting',
    regionId,
    kingId: options.kingId ? stableId(options.kingId, 'king', 'kingId') : null,
    doctrineId: options.doctrineId ? stableId(options.doctrineId, 'doctrine', 'doctrineId') : null,
    heroIds: normalizeHeroIds(options.heroIds || [], heroLimit),
    heroLimit,
    minimumHeroes,
    revision: 0,
    history: freezeArray([])
  });
  validateSelectionReferences(state, registry);
  return state;
}

function appendSelectionChange(state, type, payload, patch) {
  const revision = state.revision + 1;
  const record = Object.freeze({ revision, type, payload: Object.freeze({ ...payload }) });
  return Object.freeze({
    ...state,
    ...patch,
    revision,
    history: freezeArray([...state.history, record])
  });
}

function selectRunKing(state, kingIdInput, registry) {
  assertSelecting(state);
  const kingId = stableId(kingIdInput, 'king', 'kingId');
  const king = assertRegistry(registry).get('king', kingId);
  if (!king) throw new Error(`unknown king: ${kingId}`);
  const doctrineId = state.doctrineId && king.doctrineIds.includes(state.doctrineId) ? state.doctrineId : null;
  const next = appendSelectionChange(state, 'SelectKing', { kingId }, { kingId, doctrineId });
  validateSelectionReferences(next, registry);
  return next;
}

function selectRunDoctrine(state, doctrineIdInput, registry) {
  assertSelecting(state);
  const doctrineId = stableId(doctrineIdInput, 'doctrine', 'doctrineId');
  if (!assertRegistry(registry).get('doctrine', doctrineId)) throw new Error(`unknown doctrine: ${doctrineId}`);
  if (!state.kingId) throw new Error('select a king before selecting a doctrine');
  const next = appendSelectionChange(state, 'SelectDoctrine', { doctrineId }, { doctrineId });
  validateSelectionReferences(next, registry);
  return next;
}

function toggleRunHero(state, heroIdInput, registry) {
  assertSelecting(state);
  const heroId = stableId(heroIdInput, 'hero', 'heroId');
  const hero = assertRegistry(registry).get('hero', heroId);
  if (!hero) throw new Error(`unknown hero: ${heroId}`);
  if (hero.regionId !== state.regionId) throw new Error(`${heroId} belongs to ${hero.regionId}, not ${state.regionId}`);
  const selected = state.heroIds.includes(heroId);
  const heroIds = selected ? state.heroIds.filter((id) => id !== heroId) : [...state.heroIds, heroId];
  if (heroIds.length > state.heroLimit) throw new Error(`selected heroes exceed limit ${state.heroLimit}`);
  const next = appendSelectionChange(state, selected ? 'RemoveHero' : 'AddHero', { heroId }, { heroIds: freezeArray(heroIds) });
  validateSelectionReferences(next, registry);
  return next;
}

function lockRunSelection(state, registry) {
  assertSelecting(state);
  validateSelectionReferences(state, registry, { requireComplete: true });
  return Object.freeze({
    ...state,
    status: 'locked',
    revision: state.revision + 1,
    history: freezeArray([...state.history, Object.freeze({ revision: state.revision + 1, type: 'LockSelection', payload: Object.freeze({}) })])
  });
}

function runSelectionSnapshot(state) {
  if (!state || state.format !== RUN_SELECTION_FORMAT) throw new Error('invalid run selection state');
  return JSON.parse(JSON.stringify(state));
}

function restoreRunSelection(snapshot, registry) {
  if (!snapshot || snapshot.format !== RUN_SELECTION_FORMAT || snapshot.schemaVersion !== RUN_SELECTION_SCHEMA_VERSION) throw new Error('invalid run selection snapshot');
  if (!RUN_SELECTION_STATUSES.includes(snapshot.status)) throw new Error('invalid run selection status');
  const restored = Object.freeze({
    ...snapshot,
    heroIds: freezeArray(snapshot.heroIds || []),
    history: freezeArray((snapshot.history || []).map((record) => Object.freeze({ ...record, payload: Object.freeze({ ...(record.payload || {}) }) })))
  });
  validateSelectionReferences(restored, registry, { requireComplete: restored.status === 'locked' });
  return restored;
}

function runSelectionPresenter(state, registryInput, localization = null) {
  const registry = assertRegistry(registryInput);
  const catalog = selectionCatalog(registry, state.regionId);
  const text = (key, fallback) => localization?.[key] || fallback || key;
  const king = state.kingId ? registry.get('king', state.kingId) : null;
  const doctrine = state.doctrineId ? registry.get('doctrine', state.doctrineId) : null;
  return Object.freeze({
    format: 'rpchess-run-selection-presenter',
    schemaVersion: 1,
    status: state.status,
    revision: state.revision,
    region: Object.freeze({ ...catalog.region, label: text(catalog.region.nameKey, catalog.region.id) }),
    selectedKing: king ? Object.freeze({ id: king.id, label: text(king.nameKey, king.id), assets: king.assets }) : null,
    selectedDoctrine: doctrine ? Object.freeze({ id: doctrine.id, label: text(doctrine.nameKey, doctrine.id), assets: doctrine.assets }) : null,
    selectedHeroIds: freezeArray(state.heroIds),
    heroLimit: state.heroLimit,
    minimumHeroes: state.minimumHeroes,
    canLock: (() => { try { validateSelectionReferences(state, registry, { requireComplete: true }); return true; } catch (_error) { return false; } })(),
    kings: freezeArray(catalog.kings.map((item) => Object.freeze({ ...item, label: text(item.nameKey, item.id), selected: item.id === state.kingId }))),
    doctrines: freezeArray(catalog.doctrines.map((item) => Object.freeze({ ...item, label: text(item.nameKey, item.id), selected: item.id === state.doctrineId, compatible: Boolean(king?.doctrineIds.includes(item.id)) }))),
    heroes: freezeArray(catalog.heroes.map((item) => Object.freeze({ ...item, label: text(item.nameKey, item.id), selected: state.heroIds.includes(item.id) })))
  });
}

module.exports = {
  RUN_SELECTION_FORMAT,
  RUN_SELECTION_SCHEMA_VERSION,
  RUN_SELECTION_STATUSES,
  selectionCatalog,
  validateSelectionReferences,
  createRunSelection,
  selectRunKing,
  selectRunDoctrine,
  toggleRunHero,
  lockRunSelection,
  runSelectionSnapshot,
  restoreRunSelection,
  runSelectionPresenter
};
