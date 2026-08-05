'use strict';

const { AtomicProfileStore, normalizeProfileId } = require('../save/profile-store.cjs');
const { assertStorageAdapter } = require('../save/storage.cjs');
const { loadVerticalSlice, saveVerticalSlice } = require('../runtime/vertical-slice.cjs');

const BROWSER_SAVE_NAMESPACE = 'rpchess.vertical-slice.v1';

function resolveBrowserStorage(explicit = undefined) {
  if (explicit !== undefined) return explicit ? assertStorageAdapter(explicit) : null;
  try {
    return globalThis.localStorage ? assertStorageAdapter(globalThis.localStorage) : null;
  } catch (_error) {
    return null;
  }
}

function createBrowserProfileStore(options = {}) {
  if (options.saveStore) return options.saveStore;
  const storage = resolveBrowserStorage(options.storage);
  if (!storage) return null;
  return new AtomicProfileStore({
    storage,
    namespace: options.namespace || BROWSER_SAVE_NAMESPACE,
    deviceId: String(options.deviceId || 'rpchess-browser'),
    clock: options.clock
  });
}

function inspectBrowserProfile(store, profileIdInput, contentRegistry = null) {
  const profileId = normalizeProfileId(profileIdInput);
  if (!store) return Object.freeze({
    profileId,
    status: 'unavailable',
    revision: 0,
    savedAt: null,
    recoveredFrom: null,
    state: null,
    diagnostics: null
  });
  const loaded = loadVerticalSlice(store, profileId, {
    contentRegistry,
    repair: true
  });
  return Object.freeze({
    profileId,
    status: loaded.status,
    revision: loaded.envelope?.revision || 0,
    savedAt: loaded.envelope?.savedAt || null,
    recoveredFrom: loaded.recoveredFrom || null,
    state: loaded.state || null,
    diagnostics: loaded.diagnostics || null
  });
}

function saveBrowserProfile(store, state) {
  if (!store) return null;
  return saveVerticalSlice(store, state);
}

function deleteBrowserProfile(store, profileIdInput) {
  if (!store) return false;
  store.delete(normalizeProfileId(profileIdInput));
  return true;
}

module.exports = {
  BROWSER_SAVE_NAMESPACE,
  resolveBrowserStorage,
  createBrowserProfileStore,
  inspectBrowserProfile,
  saveBrowserProfile,
  deleteBrowserProfile
};
