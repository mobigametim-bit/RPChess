'use strict';

const { chromium } = require('playwright');
const originalLaunch = chromium.launch.bind(chromium);
const MOBILE_VIEWPORT = Object.freeze({ width:390, height:844 });

chromium.launch = async function launchWithMobileAcceptance(options = {}) {
  const browser = await originalLaunch(options);
  const originalNewContext = browser.newContext.bind(browser);
  browser.newContext = function mobileContext(contextOptions = {}) {
    return originalNewContext({ ...contextOptions, viewport:MOBILE_VIEWPORT });
  };
  const originalNewPage = browser.newPage?.bind(browser);
  if (originalNewPage) {
    browser.newPage = function mobilePage(pageOptions = {}) {
      return originalNewPage({ ...pageOptions, viewport:MOBILE_VIEWPORT });
    };
  }
  return browser;
};

console.log('[mobile-preload] forcing Playwright viewport 390x844');
