'use strict';

require('./buffer-shim.cjs');

const content = require('./production-content-browser.cjs');
const hosts = require('./iron-marches-browser-host-b9.cjs');
const profiles = require('./profile-persistence.cjs');
const eventSessions = require('../runtime/production-event-session.cjs');
const eventSelector = require('../campaign/production-event-selector.cjs');

module.exports = Object.freeze({
  DEFAULT_BROWSER_SELECTION: hosts.DEFAULT_BROWSER_SELECTION,
  createBrowserProductionBundle: content.buildBrowserProductionBundle,
  createBrowserIronMarchesRuntimeHost: hosts.createBrowserIronMarchesRuntimeHost,
  createBrowserRunSelectionHost: hosts.createBrowserRunSelectionHost,
  createBrowserProfileStore: profiles.createBrowserProfileStore,
  listBrowserProfiles: profiles.listBrowserProfiles,
  deleteBrowserProfile: profiles.deleteBrowserProfile,
  createProductionEventSession: eventSessions.createProductionEventSession,
  restoreProductionEventSession: eventSessions.restoreProductionEventSession,
  createProductionEventSelectorState: eventSelector.createProductionEventSelectorState,
  reserveProductionEvents: eventSelector.reserveProductionEvents,
  releaseProductionEventReservations: eventSelector.releaseProductionEventReservations,
  reopenProductionEventReservation: eventSelector.reopenProductionEventReservation,
  completeProductionEventReservation: eventSelector.completeProductionEventReservation
});
