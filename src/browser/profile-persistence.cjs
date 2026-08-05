'use strict';

const { AtomicProfileStore, PROFILE_SLOTS, normalizeProfileId } = require('../save/profile-store.cjs');
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

function runtimeValidationOptions(input = null) {
  if (!input) return Object.freeze({});
  if (typeof input.get === 'function') return Object.freeze({ contentRegistry: input });
  return Object.freeze({ ...input });
}

function inspectBrowserProfile(store, profileIdInput, validationInput = null) {
  const profileId = normalizeProfileId(profileIdInput);
  const validation = runtimeValidationOptions(validationInput);
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
    ...validation,
    repair: true
  });
  return Object.freeze({
    profileId,
    status: loaded.status,
    revision: loaded.envelope?.revision || 0,
    savedAt: loaded.envelope?.savedAt || null,
    recoveredFrom: loaded.recoveredFrom || null,
    migratedFrom: loaded.migratedFrom || null,
    state: loaded.state || null,
    diagnostics: loaded.diagnostics || null
  });
}

function listBrowserProfiles(store, validationInput = null) {
  return Object.freeze(PROFILE_SLOTS.map((profileId) => {
    const inspected = inspectBrowserProfile(store, profileId, validationInput);
    const state = inspected.state;
    return Object.freeze({
      profileId,
      status: inspected.status,
      available: Boolean(state),
      revision: inspected.revision,
      savedAt: inspected.savedAt,
      recoveredFrom: inspected.recoveredFrom,
      runtimeId: state?.runtimeId || null,
      seed: state?.seed || null,
      act: state?.campaign?.graph?.act || null,
      regionId: state?.campaign?.graph?.regionId || null,
      runtimeStatus: state?.status || null,
      currentNodeId: state?.campaign?.currentNodeId || null,
      rewardsClaimed: state?.rewardLog?.length || 0
    });
  }));
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
  runtimeValidationOptions,
  createBrowserProfileStore,
  inspectBrowserProfile,
  listBrowserProfiles,
  saveBrowserProfile,
  deleteBrowserProfile
};
