const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');
const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';

// A renderer microtask loop prevents even page.evaluate/timeouts in the page
// from running, so the watchdog must live outside the browser process.
const watchdog = setTimeout(() => { console.error('Combat launch blocked browser event loop'); process.exit(1); }, 90000);
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const artifactId of ['threat.attack', 'threat.defense', 'threat.great', 'none']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await page.goto(url, { waitUntil: 'networkidle' });
      await startNewRun(page);
      await page.evaluate(async () => {
        const { readRun, writeRun } = await import('./js/run-persistence.mjs');
        await import('./js/skirmish-app.mjs');
        writeRun({ ...readRun(), artifacts: { 'threat.attack': 3, 'threat.defense': 3, 'threat.great': 3 } });
        globalThis.RPChessSkirmish.open();
      });
      await page.locator('[data-skirmish-start]').click();
      await page.locator(`[data-artifact-choice="${artifactId}"]`).click({ timeout: 10000 });
      await page.locator('[data-classic-screen]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
      assert.strictEqual(await page.locator('[data-artifact-choice-modal]').count(), 0);
      const result = await page.evaluate(async () => {
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));
        const plan = globalThis.RPChessSkirmish.battlePlan;
        const cells = document.querySelectorAll('[data-chess-board] [data-square]');
        const images = [...document.querySelectorAll('.classic-board-obstacle')];
        const before = images.slice();
        globalThis.RPChessSkirmish.syncBattleFromChess();
        globalThis.RPChessSkirmish.syncBattleFromChess();
        const after = [...document.querySelectorAll('.classic-board-obstacle')];
        const run = JSON.parse(localStorage.getItem('rpchess.reboot.v1.run'));
        return { cells: cells.length, obstacles: images.length, expected: plan.obstacles.length,
          stable: before.every((node, i) => node === after[i]), charges: run.artifacts,
          chosen: run.combatArtifactChoice.artifactId };
      });
      assert.strictEqual(result.cells, 64);
      assert(result.obstacles >= 1 && result.obstacles <= 4);
      assert.strictEqual(result.obstacles, result.expected);
      assert(result.stable, 'sync must retain obstacle nodes and release the event loop');
      assert.strictEqual(result.chosen, artifactId === 'none' ? null : artifactId);
      for (const id of ['threat.attack', 'threat.defense', 'threat.great']) assert.strictEqual(result.charges[id], id === artifactId ? 2 : 3);
      assert.deepStrictEqual(errors, []);
      console.log(`Skirmish launch, responsive frame/timer and obstacle stability (${artifactId}): PASS`);
      await page.close();
    }
  } finally { await browser.close(); clearTimeout(watchdog); }
})().catch(error => { clearTimeout(watchdog); console.error(error.stack || error); process.exitCode = 1; });
