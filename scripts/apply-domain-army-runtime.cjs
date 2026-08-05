'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function write(relative, content) {
  fs.writeFileSync(path.join(root, relative), content, 'utf8');
}

function replaceOnce(content, from, to, label) {
  const index = content.indexOf(from);
  if (index < 0) throw new Error(`patch anchor not found: ${label}`);
  if (content.indexOf(from, index + from.length) >= 0) throw new Error(`patch anchor is not unique: ${label}`);
  return content.slice(0, index) + to + content.slice(index + from.length);
}

function patchVerticalSlice() {
  const file = 'src/runtime/vertical-slice.cjs';
  let content = read(file);
  content = replaceOnce(content,
`const {
  DEPLOYMENT_COMMANDS,
  executeDeploymentEdit,
  finalizeScenarioDeployment
} = require('./deployment-gate.cjs');

const RUNTIME_FORMAT = 'rpchess-vertical-slice-runtime';
const RUNTIME_SCHEMA_VERSION = 1;`,
`const {
  DEPLOYMENT_COMMANDS,
  executeDeploymentEdit,
  finalizeScenarioDeployment
} = require('./deployment-gate.cjs');
const {
  RUNTIME_ARMY_FORMAT,
  validateRuntimeArmy
} = require('./army-roster.cjs');

const RUNTIME_FORMAT = 'rpchess-vertical-slice-runtime';
const LEGACY_RUNTIME_SCHEMA_VERSION = 1;
const RUNTIME_SCHEMA_VERSION = 2;`, 'vertical-slice imports and schema');

  content = replaceOnce(content,
`function assertRuntimeState(state) {
  if (!state || state.format !== RUNTIME_FORMAT) throw new Error('invalid vertical slice runtime state');
  if (state.schemaVersion !== RUNTIME_SCHEMA_VERSION) throw new Error('unsupported vertical slice runtime schema');
  if (!RUNTIME_STATUSES.includes(state.status)) throw new Error(\`invalid vertical slice runtime status: \${state.status}\`);
  if (!state.campaign || state.campaign.format !== 'rpchess-campaign-state') throw new Error('vertical slice runtime requires campaign state');
  return state;
}`,
`function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeRuntimeArmy(army, options = {}) {
  if (army == null) {
    if (options.requireArmy) throw new Error('vertical slice runtime requires an army');
    return null;
  }
  if (!army || army.format !== RUNTIME_ARMY_FORMAT) throw new Error('vertical slice runtime has an invalid army');
  if (!options.contentRegistry || !options.combatProfiles) {
    throw new Error('vertical slice army validation requires contentRegistry and combatProfiles');
  }
  return validateRuntimeArmy(army, options.contentRegistry, options.combatProfiles);
}

function migrationArmy(snapshot, options = {}) {
  if (snapshot.army) return snapshot.army;
  if (options.defaultArmy) return options.defaultArmy;
  if (options.army) return options.army;
  if (typeof options.armyFactory === 'function') return options.armyFactory(snapshot);
  return null;
}

function migrateVerticalSliceSnapshot(snapshot, options = {}) {
  if (!snapshot || snapshot.format !== RUNTIME_FORMAT) throw new Error('invalid vertical slice runtime state');
  if (snapshot.schemaVersion === RUNTIME_SCHEMA_VERSION) {
    if (!hasOwn(snapshot, 'army')) throw new Error('vertical slice runtime schema 2 requires an army field');
    return snapshot;
  }
  if (snapshot.schemaVersion !== LEGACY_RUNTIME_SCHEMA_VERSION) throw new Error('unsupported vertical slice runtime schema');
  return {
    ...cloneSerializable(snapshot),
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    army: migrationArmy(snapshot, options)
  };
}

function assertRuntimeState(state) {
  if (!state || state.format !== RUNTIME_FORMAT) throw new Error('invalid vertical slice runtime state');
  if (state.schemaVersion !== RUNTIME_SCHEMA_VERSION) throw new Error('unsupported vertical slice runtime schema');
  if (!hasOwn(state, 'army')) throw new Error('vertical slice runtime requires an army field');
  if (!RUNTIME_STATUSES.includes(state.status)) throw new Error(\`invalid vertical slice runtime status: \${state.status}\`);
  if (!state.campaign || state.campaign.format !== 'rpchess-campaign-state') throw new Error('vertical slice runtime requires campaign state');
  return state;
}`, 'vertical-slice runtime helpers');

  content = replaceOnce(content,
`  if (!['w', 'b'].includes(playerSide)) throw new Error('playerSide must be w or b');
  validateGraphContent(campaign.graph, options.contentRegistry);

  return deepFreeze({`,
`  if (!['w', 'b'].includes(playerSide)) throw new Error('playerSide must be w or b');
  validateGraphContent(campaign.graph, options.contentRegistry);
  const army = normalizeRuntimeArmy(options.army ?? null, options);

  return deepFreeze({`, 'create runtime army normalization');

  content = replaceOnce(content,
`    aiProfile: String(options.aiProfile || 'tactician'),
    campaign,
    status: 'campaign',`,
`    aiProfile: String(options.aiProfile || 'tactician'),
    campaign,
    army,
    status: 'campaign',`, 'create runtime army field');

  content = replaceOnce(content,
`function validateVerticalSliceSnapshot(snapshot, options = {}) {
  const state = assertRuntimeState(snapshot);
  normalizeProfileId(state.profileId);
  if (options.contentRegistry) validateGraphContent(state.campaign.graph, options.contentRegistry);
  if (state.currentNode) {
    const node = state.campaign.graph.nodesById[state.currentNode.nodeId];
    if (!node) throw new Error(\`snapshot current node is missing: \${state.currentNode.nodeId}\`);
    if (node.type !== state.currentNode.type) throw new Error('snapshot current node type mismatch');
  }
  if (state.status === 'deployment' && (!state.deployment || state.deployment.format !== 'rpchess-scenario-deployment-gate' || !state.scenario)) throw new Error('snapshot active deployment is invalid');
  if (state.status === 'event' && (!state.event || state.event.status !== 'active')) throw new Error('snapshot active event is invalid');
  if (state.status === 'scenario' && (!state.scenario || state.scenario.status !== 'active')) throw new Error('snapshot active scenario is invalid');
  if (state.status === 'boss' && (!state.boss || state.boss.status !== 'active')) throw new Error('snapshot active boss is invalid');
  if (state.status === 'boss_transition' && (!state.boss || state.boss.status !== 'awaiting_phase_transition')) throw new Error('snapshot boss transition is invalid');
  if (state.status === 'reward' && !state.pendingReward) throw new Error('snapshot reward state has no pending reward');
  if (state.status === 'complete' && state.campaign.status !== 'completed') throw new Error('snapshot completion does not match campaign');
  return deepFreeze(state);
}`,
`function validateVerticalSliceSnapshot(snapshot, options = {}) {
  const migrated = migrateVerticalSliceSnapshot(snapshot, options);
  const asserted = assertRuntimeState(migrated);
  normalizeProfileId(asserted.profileId);
  if (options.contentRegistry) validateGraphContent(asserted.campaign.graph, options.contentRegistry);
  const army = normalizeRuntimeArmy(asserted.army, options);
  const state = army === asserted.army ? asserted : { ...asserted, army };
  if (state.currentNode) {
    const node = state.campaign.graph.nodesById[state.currentNode.nodeId];
    if (!node) throw new Error(\`snapshot current node is missing: \${state.currentNode.nodeId}\`);
    if (node.type !== state.currentNode.type) throw new Error('snapshot current node type mismatch');
  }
  if (state.status === 'deployment' && (!state.deployment || state.deployment.format !== 'rpchess-scenario-deployment-gate' || !state.scenario)) throw new Error('snapshot active deployment is invalid');
  if (state.status === 'event' && (!state.event || state.event.status !== 'active')) throw new Error('snapshot active event is invalid');
  if (state.status === 'scenario' && (!state.scenario || state.scenario.status !== 'active')) throw new Error('snapshot active scenario is invalid');
  if (state.status === 'boss' && (!state.boss || state.boss.status !== 'active')) throw new Error('snapshot active boss is invalid');
  if (state.status === 'boss_transition' && (!state.boss || state.boss.status !== 'awaiting_phase_transition')) throw new Error('snapshot boss transition is invalid');
  if (state.status === 'reward' && !state.pendingReward) throw new Error('snapshot reward state has no pending reward');
  if (state.status === 'complete' && state.campaign.status !== 'completed') throw new Error('snapshot completion does not match campaign');
  return deepFreeze(state);
}`, 'validate runtime snapshot');

  content = replaceOnce(content,
`function loadVerticalSlice(store, profileId, options = {}) {
  if (!store || typeof store.load !== 'function') throw new Error('atomic profile store is required');
  const loaded = store.load(profileId, options);
  if (!loaded.payload) return Object.freeze({ ...loaded, state: null });
  const state = validateVerticalSliceSnapshot(loaded.payload, options);
  return Object.freeze({ ...loaded, state });
}`,
`function loadVerticalSlice(store, profileId, options = {}) {
  if (!store || typeof store.load !== 'function') throw new Error('atomic profile store is required');
  const loaded = store.load(profileId, options);
  if (!loaded.payload) return Object.freeze({ ...loaded, state: null, migratedFrom: null });
  const sourceSchemaVersion = loaded.payload.schemaVersion;
  const state = validateVerticalSliceSnapshot(loaded.payload, options);
  return Object.freeze({
    ...loaded,
    state,
    migratedFrom: sourceSchemaVersion === RUNTIME_SCHEMA_VERSION ? null : sourceSchemaVersion
  });
}`, 'load runtime migration metadata');

  content = replaceOnce(content,
`  let state = assertRuntimeState(initialState);`,
`  let state = validateVerticalSliceSnapshot(initialState, dependencies);`, 'replay validation');

  content = replaceOnce(content,
`  RUNTIME_FORMAT,
  RUNTIME_SCHEMA_VERSION,
  RUNTIME_STATUSES,`,
`  RUNTIME_FORMAT,
  LEGACY_RUNTIME_SCHEMA_VERSION,
  RUNTIME_SCHEMA_VERSION,
  RUNTIME_STATUSES,
  normalizeRuntimeArmy,
  migrateVerticalSliceSnapshot,`, 'vertical-slice exports');

  write(file, content);
}

function patchArmyRoster() {
  const file = 'src/runtime/army-roster.cjs';
  let content = read(file);
  content = replaceOnce(content,
`    if (!hero) throw new Error(\`runtime army references missing hero: \${heroId}\`);
    if (hero.regionId !== regionId) throw new Error(\`\${heroId} belongs to \${hero.regionId}, not \${regionId}\`);
    if (!profile) throw new Error(\`runtime army has no combat profile for \${heroId}\`);
    return Object.freeze({`,
`    if (!hero) throw new Error(\`runtime army references missing hero: \${heroId}\`);
    if (hero.regionId !== regionId) throw new Error(\`\${heroId} belongs to \${hero.regionId}, not \${regionId}\`);
    if (!profile) throw new Error(\`runtime army has no combat profile for \${heroId}\`);
    for (const relicId of profile.relicIds) {
      if (!registry.get('relic', relicId)) throw new Error(\`runtime army references missing relic: \${relicId}\`);
    }
    return Object.freeze({`, 'runtime army relic validation');

  content = replaceOnce(content,
`  if (snapshot.profileSetId !== rebuilt.profileSetId) throw new Error('runtime army combat profile set changed');
  return rebuilt;`,
`  if (snapshot.profileSetId !== rebuilt.profileSetId) throw new Error('runtime army combat profile set changed');
  if (JSON.stringify(snapshot.relicIds) !== JSON.stringify(rebuilt.relicIds)) throw new Error('runtime army relic bindings changed');
  if (JSON.stringify(snapshot.heroes) !== JSON.stringify(rebuilt.heroes)) throw new Error('runtime army hero records changed');
  return rebuilt;`, 'runtime army canonical snapshot validation');
  write(file, content);
}

function patchProfilePersistence() {
  const file = 'src/browser/profile-persistence.cjs';
  let content = read(file);
  content = replaceOnce(content,
`function inspectBrowserProfile(store, profileIdInput, contentRegistry = null) {
  const profileId = normalizeProfileId(profileIdInput);`,
`function runtimeValidationOptions(input = null) {
  if (!input) return Object.freeze({});
  if (typeof input.get === 'function') return Object.freeze({ contentRegistry: input });
  return Object.freeze({ ...input });
}

function inspectBrowserProfile(store, profileIdInput, validationInput = null) {
  const profileId = normalizeProfileId(profileIdInput);
  const validation = runtimeValidationOptions(validationInput);`, 'profile validation options');

  content = replaceOnce(content,
`  const loaded = loadVerticalSlice(store, profileId, {
    contentRegistry,
    repair: true
  });`,
`  const loaded = loadVerticalSlice(store, profileId, {
    ...validation,
    repair: true
  });`, 'profile load validation');

  content = replaceOnce(content,
`    recoveredFrom: loaded.recoveredFrom || null,
    state: loaded.state || null,`,
`    recoveredFrom: loaded.recoveredFrom || null,
    migratedFrom: loaded.migratedFrom || null,
    state: loaded.state || null,`, 'profile migration metadata');

  content = replaceOnce(content,
`function listBrowserProfiles(store, contentRegistry = null) {
  return Object.freeze(PROFILE_SLOTS.map((profileId) => {
    const inspected = inspectBrowserProfile(store, profileId, contentRegistry);`,
`function listBrowserProfiles(store, validationInput = null) {
  return Object.freeze(PROFILE_SLOTS.map((profileId) => {
    const inspected = inspectBrowserProfile(store, profileId, validationInput);`, 'profile list validation options');

  content = replaceOnce(content,
`  BROWSER_SAVE_NAMESPACE,
  resolveBrowserStorage,`,
`  BROWSER_SAVE_NAMESPACE,
  resolveBrowserStorage,
  runtimeValidationOptions,`, 'profile exports');
  write(file, content);
}

function patchBrowserHost() {
  const file = 'src/browser/iron-marches-browser-host.cjs';
  let content = read(file);
  const oldBlock = `  assertBrowserSelection(bundle, requestedSelection);

  let resumeInfo = options.resumeInfo || null;
  let state = options.initialState
    ? validateVerticalSliceSnapshot(options.initialState, { contentRegistry: bundle.registry })
    : null;
  if (!state && saveStore && options.resume !== false) {
    resumeInfo = inspectBrowserProfile(saveStore, profileId, bundle.registry);
    state = resumeInfo.state;
  }
  const resumed = Boolean(state);
  const army = state?.army
    ? validateRuntimeArmy(state.army, bundle.registry, bundle.combatProfiles)
    : createRuntimeArmy(requestedSelection, bundle.registry, bundle.combatProfiles);
  const selection = runtimeSelectionFromArmy(army);
  assertBrowserSelection(bundle, selection);`;
  const newBlock = `  assertBrowserSelection(bundle, requestedSelection);
  const requestedArmy = createRuntimeArmy(requestedSelection, bundle.registry, bundle.combatProfiles);
  const runtimeValidation = Object.freeze({
    contentRegistry: bundle.registry,
    combatProfiles: bundle.combatProfiles,
    defaultArmy: requestedArmy,
    requireArmy: true
  });

  let resumeInfo = options.resumeInfo || null;
  let state = options.initialState
    ? validateVerticalSliceSnapshot(options.initialState, runtimeValidation)
    : null;
  if (!state && saveStore && options.resume !== false) {
    resumeInfo = inspectBrowserProfile(saveStore, profileId, runtimeValidation);
    state = resumeInfo.state;
  }
  const resumed = Boolean(state);
  const army = state?.army || requestedArmy;
  const selection = runtimeSelectionFromArmy(army);
  assertBrowserSelection(bundle, selection);`;
  content = replaceOnce(content, oldBlock, newBlock, 'browser host army ownership');

  content = replaceOnce(content,
`      campaign,
      contentRegistry: bundle.registry
    });
  }
  if (state.army !== army) state = Object.freeze({ ...state, army });
  const dependencies = createBrowserDependencies({`,
`      campaign,
      army,
      contentRegistry: bundle.registry,
      combatProfiles: bundle.combatProfiles,
      requireArmy: true
    });
  }
  const dependencies = createBrowserDependencies({`, 'browser runtime creation');

  content = replaceOnce(content,
`  let lastSaveEnvelope = null;
  if (!resumed && saveStore && options.saveOnStart === true) lastSaveEnvelope = saveBrowserProfile(saveStore, state);`,
`  let lastSaveEnvelope = null;
  if (resumed && resumeInfo?.migratedFrom && saveStore) lastSaveEnvelope = saveBrowserProfile(saveStore, state);
  else if (!resumed && saveStore && options.saveOnStart === true) lastSaveEnvelope = saveBrowserProfile(saveStore, state);`, 'persist migrated browser save');

  content = replaceOnce(content,
`    ? inspectBrowserProfile(saveStore, profileId, bundle.registry)
    : Object.freeze({ profileId, status: saveStore ? 'empty' : 'unavailable', revision: 0, savedAt: null, recoveredFrom: null, state: null });`,
`    ? inspectBrowserProfile(saveStore, profileId, {
      contentRegistry: bundle.registry,
      combatProfiles: bundle.combatProfiles,
      defaultArmy: createRuntimeArmy(DEFAULT_BROWSER_SELECTION, bundle.registry, bundle.combatProfiles),
      requireArmy: true
    })
    : Object.freeze({ profileId, status: saveStore ? 'empty' : 'unavailable', revision: 0, savedAt: null, recoveredFrom: null, migratedFrom: null, state: null });`, 'selection host legacy save migration');

  write(file, content);
}

patchVerticalSlice();
patchArmyRoster();
patchProfilePersistence();
patchBrowserHost();
console.log('Applied domain army runtime migration patches.');
