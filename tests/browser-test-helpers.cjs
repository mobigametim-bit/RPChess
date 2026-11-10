const RUN_KEY = 'rpchess.reboot.v1.run';
const TUTORIAL_KEY = 'rpchess.reboot.v1.tutorial';
const TUTORIAL_HINTS = ["identity","roster","travel","artifact","skirmishChess","battleChess","combatAftermath","event","settlement","puzzle","caravanChess","caravanReward","starvation","runEnd","chronicle","arenaCatalog","arenaFoe","arenaArtifact","arenaChess","arenaResult"];

async function installManualTravelFixtureNormalizer(page) {
  await page.evaluate((key) => {
    if (globalThis.__RPChessManualTravelFixtureNormalizer) return;
    const normalize = () => {
      let run;
      try { run = JSON.parse(localStorage.getItem(key) || 'null'); } catch { return; }
      if (!Array.isArray(run?.currentTravelChoices)) return;
      let changed = false;
      const currentTravelChoices = run.currentTravelChoices.map((choice) => {
        const id = String(choice?.id || '');
        const isBrowserFixture = id.startsWith('manual.') || id.startsWith('mobile.12.');
        if (!isBrowserFixture || choice.difficultyModel === 'power-v1') return choice;
        changed = true;
        return { ...choice, difficultyModel: 'power-v1' };
      });
      if (changed) localStorage.setItem(key, JSON.stringify({ ...run, currentTravelChoices }));
    };
    globalThis.__RPChessManualTravelFixtureNormalizer = normalize;
    addEventListener('rpchess:run-updated', normalize);
  }, RUN_KEY);
}

async function waitForVisible(page, selector, label = selector, timeout = 10000) {
  const locator = page.locator(selector).first();
  try {
    await locator.waitFor({ state: 'visible', timeout });
  } catch (error) {
    const diagnostic = await page.evaluate(() => {
      const active = [...document.querySelectorAll('main, [role="dialog"]')]
        .filter((node) => !node.hidden && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden')
        .map((node) => ({
          tag: node.tagName,
          className: node.className || '',
          role: node.getAttribute('role') || '',
          ariaLabel: node.getAttribute('aria-label') || ''
        }))
        .slice(0, 12);
      return {
        href: location.href,
        lang: document.documentElement.lang,
        bodyClass: document.body.className,
        active
      };
    }).catch(() => null);
    throw new Error(`${label} did not become visible. Scene diagnostic: ${JSON.stringify(diagnostic)}\n${error.stack || error}`);
  }
  return locator;
}

async function markOnboardingComplete(page) {
  await page.evaluate(({ key, hints }) => {
    localStorage.setItem(key, JSON.stringify({
      schemaVersion:1,
      activated:true,
      dismissed:Object.fromEntries(hints.map((hint) => [hint, true]))
    }));
  }, { key:TUTORIAL_KEY, hints:TUTORIAL_HINTS });
}

async function startNewRun(page, { playerName = 'Browser Tester', legacyTravel = true } = {}) {
  // Older scene suites explicitly exercise the legacy three-card Journey UI.
  // The new kingdom acceptance suite opts out and verifies the production map.
  await page.evaluate(value=>sessionStorage.setItem('rpchess.test.legacyTravel',value?'1':'0'),legacyTravel);
  const menu = await waitForVisible(page, '[data-reboot-foundation]:not([hidden])', 'Main menu');
  await markOnboardingComplete(page);
  // Menus can paint before the asset/font loader has fully dismissed its
  // click-intercepting splash. Honor production readiness instead of racing it.
  await page.locator('[data-game-loading]').waitFor({ state:'hidden', timeout:60000 });
  const newGame = menu.locator('[data-new-game]');
  await newGame.waitFor({ state: 'visible' });
  await newGame.click();
  const identity = await waitForVisible(page, '[data-player-identity-modal]:not([hidden])', 'Player Identity');
  await identity.locator('[data-player-identity-input]').fill(playerName);
  const submit = identity.locator('[data-player-identity-submit]');
  if (await submit.isEnabled()) throw new Error('Player Identity accepted a name without an explicit portrait selection');
  await identity.locator('[data-identity-commander="oathkeeper"]').click();
  if (await submit.isDisabled()) throw new Error(`Player Identity did not accept name + chosen portrait: ${playerName}`);
  await submit.click();
  await waitForVisible(page, '[data-roster-screen]:not([hidden])', 'Roster');
  await installManualTravelFixtureNormalizer(page);
}

module.exports = { startNewRun, waitForVisible, markOnboardingComplete };
