'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content, 'utf8');

function replaceOnce(content, needle, replacement, label) {
  const first = content.indexOf(needle);
  if (first < 0) throw new Error(`${label}: needle not found`);
  if (content.indexOf(needle, first + needle.length) >= 0) throw new Error(`${label}: needle is ambiguous`);
  return content.slice(0, first) + replacement + content.slice(first + needle.length);
}

function replaceRange(content, startNeedle, endNeedle, replacement, label) {
  const start = content.indexOf(startNeedle);
  if (start < 0) throw new Error(`${label}: start not found`);
  const end = content.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) throw new Error(`${label}: end not found`);
  return content.slice(0, start) + replacement + content.slice(end);
}

function patchHost() {
  const file = 'src/browser/iron-marches-browser-host.cjs';
  let source = read(file);
  source = replaceOnce(
    source,
    "const { createVerticalSliceRuntime } = require('../runtime/vertical-slice.cjs');",
    "const { createVerticalSliceRuntime, validateVerticalSliceSnapshot } = require('../runtime/vertical-slice.cjs');",
    'host vertical slice import'
  );
  source = replaceOnce(
    source,
    "const { buildBrowserProductionBundle } = require('./production-content-browser.cjs');",
    `const { buildBrowserProductionBundle } = require('./production-content-browser.cjs');
const {
  createBrowserProfileStore,
  inspectBrowserProfile,
  saveBrowserProfile,
  deleteBrowserProfile
} = require('./profile-persistence.cjs');`,
    'host persistence import'
  );
  source = replaceOnce(
    source,
    '  const { bundle, language, aiProfile, aiMaxNodes, aiTimeBudgetMs } = options;',
    '  const { bundle, language, aiProfile, aiMaxNodes, aiTimeBudgetMs, saveStore } = options;',
    'host dependencies save store destructure'
  );
  source = replaceOnce(
    source,
    '    aiProfile,\n    aiMaxNodes,\n    aiTimeBudgetMs\n',
    '    aiProfile,\n    aiMaxNodes,\n    aiTimeBudgetMs,\n    saveStore\n',
    'host dependencies save store output'
  );

  const runtimeHost = `function createBrowserIronMarchesRuntimeHost(options = {}) {
  const bundle = options.bundle || buildBrowserProductionBundle();
  const language = options.language || 'ru';
  const requestedSeed = Number(options.seed ?? 9042);
  const act = options.act ?? 1;
  const nodeCount = options.nodeCount ?? 9;
  const profileId = options.profileId || 'profile-1';
  const saveStore = options.saveStore || createBrowserProfileStore(options);
  const selection = Object.freeze({
    regionId: options.selection?.regionId || DEFAULT_BROWSER_SELECTION.regionId,
    kingId: options.selection?.kingId || DEFAULT_BROWSER_SELECTION.kingId,
    doctrineId: options.selection?.doctrineId || DEFAULT_BROWSER_SELECTION.doctrineId,
    heroIds: freezeArray(options.selection?.heroIds || DEFAULT_BROWSER_SELECTION.heroIds),
    relicIds: freezeArray(options.selection?.relicIds || DEFAULT_BROWSER_SELECTION.relicIds)
  });
  assertBrowserSelection(bundle, selection);

  let resumeInfo = options.resumeInfo || null;
  let state = options.initialState
    ? validateVerticalSliceSnapshot(options.initialState, { contentRegistry: bundle.registry })
    : null;
  if (!state && saveStore && options.resume !== false) {
    resumeInfo = inspectBrowserProfile(saveStore, profileId, bundle.registry);
    state = resumeInfo.state;
  }
  const resumed = Boolean(state);
  if (!state) {
    const graph = generateActGraph({
      seed: requestedSeed,
      act,
      nodeCount,
      regionId: selection.regionId,
      contentPools: productionContentPools(bundle)
    });
    const campaign = createCampaignState(graph, {
      supplies: options.supplies ?? 18,
      scouting: options.scouting ?? 1
    });
    state = createVerticalSliceRuntime({
      runtimeId: options.runtimeId || \`iron_marches_browser_\${requestedSeed}_\${act}\`,
      seed: requestedSeed,
      profileId,
      playerSide: options.playerSide || 'w',
      aiProfile: options.aiProfile || 'apprentice',
      campaign,
      contentRegistry: bundle.registry
    });
  }
  const dependencies = createBrowserDependencies({
    bundle,
    language,
    aiProfile: state.aiProfile,
    aiMaxNodes: options.aiMaxNodes ?? 8000,
    aiTimeBudgetMs: options.aiTimeBudgetMs ?? 0,
    saveStore
  });
  let lastSaveEnvelope = null;
  if (!resumed && saveStore && options.saveOnStart === true) lastSaveEnvelope = saveBrowserProfile(saveStore, state);

  return Object.freeze({
    format: 'rpchess-browser-runtime-host',
    selection,
    bundle,
    dependencies,
    saveStore,
    resumed,
    resumeInfo,
    getState: () => state,
    getSnapshot: () => createPresenterSnapshot(state, dependencies),
    getLastSaveEnvelope: () => lastSaveEnvelope,
    dispatch: async (command) => {
      const result = dispatchPresenterCommand(state, command, dependencies);
      state = result.state;
      let saveEnvelope = result.saveEnvelope || null;
      if (saveStore && options.autoSave !== false && command.type !== 'SaveCheckpoint') {
        saveEnvelope = saveBrowserProfile(saveStore, state);
      }
      if (saveEnvelope) lastSaveEnvelope = saveEnvelope;
      return Object.freeze({ snapshot: createPresenterSnapshot(state, dependencies), saveEnvelope });
    }
  });
}

`;
  source = replaceRange(source, 'function createBrowserIronMarchesRuntimeHost(options = {}) {', 'function normalizeSelectionCommand(command) {', runtimeHost, 'runtime host replacement');

  const selectionHost = `function createBrowserRunSelectionHost(options = {}) {
  const bundle = options.bundle || buildBrowserProductionBundle();
  const language = options.language || 'ru';
  const localization = bundle.localization[language];
  if (!localization) throw new Error(\`unsupported run-selection language: \${language}\`);
  const profileId = options.profileId || 'profile-1';
  const saveStore = options.saveStore || createBrowserProfileStore(options);
  if (options.forceNew && saveStore) deleteBrowserProfile(saveStore, profileId);
  let resumeInfo = saveStore && !options.forceNew
    ? inspectBrowserProfile(saveStore, profileId, bundle.registry)
    : Object.freeze({ profileId, status: saveStore ? 'empty' : 'unavailable', revision: 0, savedAt: null, recoveredFrom: null, state: null });
  let selection = createRunSelection({
    contentRegistry: bundle.registry,
    selectionId: options.selectionId || \`selection:\${options.seed || 1}\`,
    regionId: options.regionId || DEFAULT_BROWSER_SELECTION.regionId,
    heroLimit: options.heroLimit ?? 6,
    minimumHeroes: options.minimumHeroes ?? 1
  });
  let runtimeHost = resumeInfo.state ? createBrowserIronMarchesRuntimeHost({
    ...options,
    bundle,
    language,
    profileId,
    saveStore,
    initialState: resumeInfo.state,
    resume: false,
    resumeInfo
  }) : null;

  function profileSnapshot() {
    return Object.freeze({
      profileId,
      storageAvailable: Boolean(saveStore),
      status: runtimeHost?.resumed ? 'resumed' : resumeInfo.status,
      revision: runtimeHost?.getLastSaveEnvelope()?.revision || resumeInfo.revision || 0,
      savedAt: runtimeHost?.getLastSaveEnvelope()?.savedAt || resumeInfo.savedAt || null,
      recoveredFrom: resumeInfo.recoveredFrom || null
    });
  }

  function snapshot() {
    return Object.freeze({
      format: 'rpchess-run-selection-host-snapshot',
      schemaVersion: 1,
      status: runtimeHost ? 'ready' : selection.status,
      selection: runSelectionPresenter(selection, bundle.registry, localization),
      profile: profileSnapshot(),
      runtime: runtimeHost?.getSnapshot() || null
    });
  }

  function execute(commandInput) {
    const command = normalizeSelectionCommand(commandInput);
    if (runtimeHost) throw new Error('run selection has already launched');
    if (command.type === 'SelectKing') selection = selectRunKing(selection, command.kingId, bundle.registry);
    else if (command.type === 'SelectDoctrine') selection = selectRunDoctrine(selection, command.doctrineId, bundle.registry);
    else if (command.type === 'ToggleHero') selection = toggleRunHero(selection, command.heroId, bundle.registry);
    else if (command.type === 'LockSelection') {
      selection = lockRunSelection(selection, bundle.registry);
      runtimeHost = createBrowserIronMarchesRuntimeHost({
        ...options,
        bundle,
        language,
        profileId,
        saveStore,
        resume: false,
        saveOnStart: true,
        selection: Object.freeze({
          regionId: selection.regionId,
          kingId: selection.kingId,
          doctrineId: selection.doctrineId,
          heroIds: selection.heroIds,
          relicIds: DEFAULT_BROWSER_SELECTION.relicIds
        })
      });
      resumeInfo = Object.freeze({ profileId, status: 'saved', revision: runtimeHost.getLastSaveEnvelope()?.revision || 0, savedAt: runtimeHost.getLastSaveEnvelope()?.savedAt || null, recoveredFrom: null, state: runtimeHost.getState() });
    }
    return Object.freeze({ command, snapshot: snapshot() });
  }

  return Object.freeze({
    format: 'rpchess-browser-run-selection-host',
    getSelection: () => runSelectionSnapshot(selection),
    getRuntimeHost: () => runtimeHost,
    getProfile: profileSnapshot,
    getSnapshot: snapshot,
    dispatch: async (command) => execute(command),
    bundle,
    localization,
    saveStore
  });
}

`;
  source = replaceRange(source, 'function createBrowserRunSelectionHost(options = {}) {', 'module.exports = {', selectionHost, 'selection host replacement');
  write(file, source);
}

function patchApp() {
  const file = 'game/js/vertical-slice-app.mjs';
  let source = read(file);
  source = replaceOnce(
    source,
    "    aiProfile: ['apprentice', 'tactician', 'warlord'].includes(params.get('ai')) ? params.get('ai') : 'apprentice'\n",
    "    aiProfile: ['apprentice', 'tactician', 'warlord'].includes(params.get('ai')) ? params.get('ai') : 'apprentice',\n    forceNew: params.get('new') === '1',\n    autoSave: params.get('autosave') !== '0'\n",
    'app query options'
  );
  source = replaceOnce(
    source,
    'function showFatal(root, error) {',
    `function resolveLocalStorage(explicit = undefined) {
  if (explicit !== undefined) return explicit;
  try { return globalThis.localStorage || null; } catch (_error) { return null; }
}

function showFatal(root, error) {`,
    'app storage resolver'
  );

  const startFunction = `function startVerticalSlice(options = {}) {
  const root = options.root || document.getElementById('app');
  if (!root) throw new Error('vertical slice root element is missing');
  installBootstrapStyles(root.ownerDocument || document);
  const runtimeApi = options.runtimeApi || globalThis.RPChessRuntime;
  if (!runtimeApi || typeof runtimeApi.createBrowserRunSelectionHost !== 'function') {
    throw new Error('production browser runtime bundle is unavailable');
  }
  const launchOptions = Object.freeze({
    ...readLaunchOptions(),
    ...(options.launchOptions || {}),
    storage: resolveLocalStorage(options.storage),
    deviceId: options.deviceId || 'rpchess-browser-v1'
  });
  const selectionHost = runtimeApi.createBrowserRunSelectionHost(launchOptions);
  let selectionClient = null;
  let selectionPresenter = null;
  let verticalPresenter = null;
  let runtimeClient = null;

  const mountRuntime = () => {
    const runtimeHost = selectionHost.getRuntimeHost();
    if (!runtimeHost) throw new Error('ready selection has no runtime host');
    root.replaceChildren();
    runtimeClient = new RuntimeCommandClient({
      transport: createLocalRuntimeTransport(runtimeHost),
      snapshot: runtimeHost.getSnapshot()
    });
    verticalPresenter = new VerticalSlicePresenter({ root, client: runtimeClient });
    globalThis.RPChessVerticalSlice = Object.freeze({
      launchOptions,
      selectionHost,
      runtimeHost,
      runtimeClient,
      presenter: verticalPresenter
    });
    return verticalPresenter;
  };

  const initial = selectionHost.getSnapshot();
  if (initial.status === 'ready') {
    mountRuntime();
  } else {
    selectionClient = new RunSelectionClient({
      transport: createRunSelectionTransport(selectionHost),
      snapshot: initial
    });
    selectionPresenter = new RunSelectionPresenter({
      root,
      client: selectionClient,
      onReady: () => {
        try { mountRuntime(); } catch (error) { showFatal(root, error); }
      }
    });
    selectionPresenter.mount();
  }
  return Object.freeze({
    launchOptions,
    selectionHost,
    getSelectionClient: () => selectionClient,
    getSelectionPresenter: () => selectionPresenter,
    getRuntimeClient: () => runtimeClient,
    getVerticalPresenter: () => verticalPresenter
  });
}

`;
  source = replaceRange(source, 'function startVerticalSlice(options = {}) {', 'try {\n  startVerticalSlice();', `${startFunction}try {\n  startVerticalSlice();`, 'app start function replacement');
  source = replaceOnce(
    source,
    '  readLaunchOptions,\n  showFatal,',
    '  readLaunchOptions,\n  resolveLocalStorage,\n  showFatal,',
    'app storage export'
  );
  write(file, source);
}

function addTests() {
  const file = 'tests/browser-profile-persistence.cjs';
  write(file, `const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { createBrowserProfileStore, inspectBrowserProfile } = require('../src/browser/profile-persistence.cjs');
const { createBrowserRunSelectionHost } = require('../src/browser/iron-marches-browser-host.cjs');

async function launch(host) {
  await host.dispatch({ type: 'SelectKing', kingId: 'king.oathkeeper' });
  await host.dispatch({ type: 'SelectDoctrine', doctrineId: 'doctrine.fortress' });
  await host.dispatch({ type: 'ToggleHero', heroId: 'hero.aldric_wall' });
  return host.dispatch({ type: 'LockSelection' });
}

(async () => {
  const storage = new MemoryKeyValueStorage();
  const clockValues = [1000, 2000, 3000, 4000, 5000, 6000];
  const clock = () => clockValues.shift() || 7000;
  const first = createBrowserRunSelectionHost({ seed: 17001, profileId: 'profile-1', storage, clock, deviceId: 'browser-test' });
  assert.strictEqual(first.getSnapshot().status, 'selecting');
  await launch(first);
  assert.strictEqual(first.getSnapshot().status, 'ready');
  assert.strictEqual(first.getProfile().revision, 1);
  const runtime = first.getRuntimeHost();
  const initialRuntimeSnapshot = runtime.getSnapshot();
  const route = initialRuntimeSnapshot.campaign.routes.find((candidate) => candidate.affordable);
  assert.ok(route);
  await runtime.dispatch({ type: 'Travel', targetNodeId: route.to });
  assert.strictEqual(runtime.getLastSaveEnvelope().revision, 2);
  const savedSnapshot = runtime.getSnapshot();

  const resumed = createBrowserRunSelectionHost({ seed: 99999, profileId: 'profile-1', storage, clock, deviceId: 'browser-test' });
  assert.strictEqual(resumed.getSnapshot().status, 'ready');
  assert.strictEqual(resumed.getRuntimeHost().resumed, true);
  assert.deepStrictEqual(resumed.getRuntimeHost().getSnapshot(), savedSnapshot);
  assert.strictEqual(resumed.getProfile().revision, 2);

  const secondProfile = createBrowserRunSelectionHost({ seed: 17002, profileId: 'profile-2', storage, clock, deviceId: 'browser-test' });
  assert.strictEqual(secondProfile.getSnapshot().status, 'selecting');
  assert.strictEqual(secondProfile.getProfile().revision, 0);

  const store = createBrowserProfileStore({ storage, clock, deviceId: 'browser-test' });
  const keys = store.keys('profile-1');
  storage.setItem(keys.current, '{broken-json');
  const recovered = createBrowserRunSelectionHost({ profileId: 'profile-1', storage, clock, deviceId: 'browser-test' });
  assert.strictEqual(recovered.getSnapshot().status, 'ready');
  assert.strictEqual(recovered.getProfile().recoveredFrom, 'backup');
  assert.strictEqual(inspectBrowserProfile(store, 'profile-1', recovered.bundle.registry).state !== null, true);

  const fresh = createBrowserRunSelectionHost({ seed: 17003, profileId: 'profile-1', storage, clock, deviceId: 'browser-test', forceNew: true });
  assert.strictEqual(fresh.getSnapshot().status, 'selecting');
  assert.strictEqual(fresh.getProfile().revision, 0);
  assert.strictEqual(store.load('profile-2').status, 'empty');

  const app = fs.readFileSync(path.resolve(__dirname, '../game/js/vertical-slice-app.mjs'), 'utf8');
  assert.ok(app.includes("params.get('new') === '1'"));
  assert.ok(app.includes("initial.status === 'ready'"));
  assert.ok(app.includes('resolveLocalStorage'));
  console.log('Browser profile persistence: 1/1 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
`);
}

function patchPackage() {
  const file = 'package.json';
  const data = JSON.parse(read(file));
  const marker = 'node tests/browser-production-runtime.cjs';
  if (!data.scripts.test.includes(marker)) throw new Error('browser production test marker missing');
  if (!data.scripts.test.includes('tests/browser-profile-persistence.cjs')) {
    data.scripts.test = data.scripts.test.replace(marker, `${marker} && node tests/browser-profile-persistence.cjs`);
  }
  write(file, `${JSON.stringify(data, null, 2)}\n`);
}

patchHost();
patchApp();
addTests();
patchPackage();
console.log('Applied browser profile persistence patch.');
