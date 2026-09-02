async function startNewRun(page, { playerName = 'Browser Tester' } = {}) {
  await page.locator('[data-new-game]').click();
  const identity = page.locator('[data-player-identity-modal]:not([hidden])');
  await identity.waitFor();
  await identity.locator('[data-player-identity-input]').fill(playerName);
  const submit = identity.locator('[data-player-identity-submit]');
  if (await submit.isDisabled()) throw new Error(`Player Identity did not accept test name: ${playerName}`);
  await submit.click();
  await page.locator('[data-roster-screen]:not([hidden])').waitFor();
}

module.exports = { startNewRun };
