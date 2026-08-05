'use strict';

require('./buffer-shim.cjs');

const content = require('./production-content-browser.cjs');
const hosts = require('./iron-marches-browser-host.cjs');
const profiles = require('./profile-persistence.cjs');

module.exports = Object.freeze({
  DEFAULT_BROWSER_SELECTION: hosts.DEFAULT_BROWSER_SELECTION,
  createBrowserProductionBundle: content.buildBrowserProductionBundle,
  createBrowserIronMarchesRuntimeHost: hosts.createBrowserIronMarchesRuntimeHost,
  createBrowserRunSelectionHost: hosts.createBrowserRunSelectionHost,
  createBrowserProfileStore: profiles.createBrowserProfileStore,
  listBrowserProfiles: profiles.listBrowserProfiles,
  deleteBrowserProfile: profiles.deleteBrowserProfile
});
