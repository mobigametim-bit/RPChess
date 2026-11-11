const playwright = require('playwright');

const TUTORIAL_KEY = 'rpchess.reboot.v1.tutorial';
const HINTS = ["welcome","identity","roster","kingdomMap","kingdomCastle","kingdomProduction","artifact","skirmishChess","battleChess","event","settlement","puzzle","caravanChess","starvation","chronicle","arenaCatalog","arenaFoe","arenaArtifact","arenaChess"];
const COMPLETE_STATE = JSON.stringify({
  schemaVersion:1,
  activated:true,
  dismissed:Object.fromEntries(HINTS.map((hint) => [hint, true]))
});

const originalLaunch = playwright.chromium.launch.bind(playwright.chromium);
playwright.chromium.launch = async (...args) => {
  const browser = await originalLaunch(...args);
  const originalNewContext = browser.newContext.bind(browser);
  browser.newContext = async (...contextArgs) => {
    const context = await originalNewContext(...contextArgs);
    // Some viewport suites call browser.newContext() then context.newPage().
    // Install before navigating, so the welcome cannot cover unrelated scenes.
    await context.addInitScript(({key,value}) => {
      try { localStorage.setItem(key,value); } catch {}
    }, {key:TUTORIAL_KEY,value:COMPLETE_STATE});
    return context;
  };
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
