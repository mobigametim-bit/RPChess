'use strict';

require('./buffer-shim.cjs');

const {
  DEFAULT_BROWSER_SELECTION,
  createBrowserProductionBundle,
  createBrowserIronMarchesRuntimeHost,
  createBrowserRunSelectionHost
} = (() => {
  const content = require('./production-content-browser.cjs');
  const hosts = require('./iron-marches-browser-host.cjs');
  return {
    DEFAULT_BROWSER_SELECTION: hosts.DEFAULT_BROWSER_SELECTION,
    createBrowserProductionBundle: content.buildBrowserProductionBundle,
    createBrowserIronMarchesRuntimeHost: hosts.createBrowserIronMarchesRuntimeHost,
    createBrowserRunSelectionHost: hosts.createBrowserRunSelectionHost
  };
})();

module.exports = Object.freeze({
  DEFAULT_BROWSER_SELECTION,
  createBrowserProductionBundle,
  createBrowserIronMarchesRuntimeHost,
  createBrowserRunSelectionHost
});
