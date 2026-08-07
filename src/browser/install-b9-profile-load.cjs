'use strict';

const INSTALL_KEY = Symbol.for('rpchess.b9-profile-load-installed');

if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;

  const vertical = require('../runtime/vertical-slice.cjs');

  vertical.loadVerticalSlice = function loadB9AwareVerticalSlice(store, profileId, options = {}) {
    if (!store || typeof store.load !== 'function') throw new Error('atomic profile store is required');
    const loaded = store.load(profileId, options);
    if (!loaded.payload) return Object.freeze({ ...loaded, state: null, migratedFrom: null });

    const sourceSchemaVersion = loaded.payload.schemaVersion;
    const state = vertical.validateVerticalSliceSnapshot(loaded.payload, options);

    return Object.freeze({
      ...loaded,
      state,
      migratedFrom: sourceSchemaVersion === vertical.RUNTIME_SCHEMA_VERSION ? null : sourceSchemaVersion
    });
  };
}

module.exports = Object.freeze({ installed: true });
