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

async function startNewRun(page, { playerName = 'Browser Tester' } = {}) {
  await page.locator('[data-new-game]').click();
  const identity = page.locator('[data-player-identity-modal]:not([hidden])');
  await identity.waitFor();
  await identity.locator('[data-player-identity-input]').fill(playerName);
  const submit = identity.locator('[data-player-identity-submit]');
  if (await submit.isDisabled()) throw new Error(`Player Identity did not accept test name: ${playerName}`);
  await submit.click();
  await page.locator('[data-roster-screen]:not([hidden])').waitFor();
  await installManualTravelFixtureNormalizer(page);
}

module.exports = { startNewRun };
