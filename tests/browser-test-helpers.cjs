const RUN_KEY = 'rpchess.reboot.v1.run';

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

async function startNewRun(page, { playerName = 'Browser Tester' } = {}) {
  const menu = await waitForVisible(page, '[data-reboot-foundation]:not([hidden])', 'Main menu');
  const newGame = menu.locator('[data-new-game]');
  await newGame.waitFor({ state: 'visible' });
  await newGame.click();
  const identity = await waitForVisible(page, '[data-player-identity-modal]:not([hidden])', 'Player Identity');
  await identity.locator('[data-player-identity-input]').fill(playerName);
  const submit = identity.locator('[data-player-identity-submit]');
  if (await submit.isDisabled()) throw new Error(`Player Identity did not accept test name: ${playerName}`);
  await submit.click();
  await waitForVisible(page, '[data-roster-screen]:not([hidden])', 'Roster');
  await installManualTravelFixtureNormalizer(page);
}

module.exports = { startNewRun, waitForVisible };
