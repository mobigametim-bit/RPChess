const playwright = require('playwright');

const TUTORIAL_KEY = 'rpchess.reboot.v1.tutorial';
const HINTS = ['identity','roster','travel','skirmishPrep','skirmishChess','battlePrep','battleChess','event','settlement','puzzle'];
const COMPLETE_STATE = JSON.stringify({
  schemaVersion:1,
  activated:true,
  dismissed:Object.fromEntries(HINTS.map((hint) => [hint, true]))
});

const originalLaunch = playwright.chromium.launch.bind(playwright.chromium);
playwright.chromium.launch = async (...args) => {
  const browser = await originalLaunch(...args);
  const originalNewPage = browser.newPage.bind(browser);
  browser.newPage = async (...pageArgs) => {
    const page = await originalNewPage(...pageArgs);
    await page.addInitScript(({ key, value }) => {
      try { localStorage.setItem(key, value); } catch {}
    }, { key:TUTORIAL_KEY, value:COMPLETE_STATE });
    return page;
  };
  return browser;
};
