// Run the existing Journey/Caravan/Arena browser contracts against the Yandex
// output. This fixture simulates only SDK access; all game code and Stockfish
// assets are the actual distribution. Cross-device cloud has its own test.
const { chromium } = require('playwright');
const { mockSDK } = require('./yandex-browser.cjs');
const launch = chromium.launch.bind(chromium);
chromium.launch = async options => {
  const browser = await launch(options);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async options => {
    const context = await newContext(options);
    await context.addInitScript(() => {
      window.__readCloud = async () => ({});
      window.__writeCloud = async () => {};
    });
    await context.route('**/sdk.js', route => route.fulfill({
      contentType:'text/javascript', body:mockSDK.replace("lang:'en'", "lang:'ru'")
    }));
    return context;
  };
  return browser;
};
