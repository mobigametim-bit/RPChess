const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');
const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height, artifact] of [
      [667, 300, 'threat.attack'], [844, 390, 'threat.great'],
      [932, 430, 'threat.defense'], [1440, 900, 'none']
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      // A cold, slow stylesheet must load before a modal can be painted.
      await page.route('**/css/artifacts.css*', async route => {
        await new Promise(resolve => setTimeout(resolve, 400));
        await route.continue();
      });
      await page.goto(url, { waitUntil: 'networkidle' });
      await startNewRun(page);
      await page.evaluate(async () => {
        const { readRun, writeRun } = await import('./js/run-persistence.mjs');
        await import('./js/skirmish-app.mjs');
        writeRun({ ...readRun(), artifacts: { 'threat.attack': 3, 'threat.defense': 3, 'threat.great': 3 } });
        globalThis.RPChessSkirmish.open();
      });
      await page.locator('[data-artifact-choice-modal]').waitFor({state:'visible'});
      await page.locator('[data-game-loading]').waitFor({state:'hidden',timeout:25000});
      const modalLayout=await page.evaluate(()=>{
        const panel=document.querySelector('[data-artifact-choice-modal] .artifact-choice-panel');
        const rect=panel.getBoundingClientRect();
        return {top:rect.top,bottom:rect.bottom,styled:Boolean(document.querySelector('[data-artifact-combat-css]')?.sheet)};
      });
      assert(modalLayout.styled,'cold artifact stylesheet must finish before its modal is unveiled');
      assert(modalLayout.top>=-1&&modalLayout.bottom<=innerHeight+1,'artifact selection replaces prep and fits viewport');
      assert.strictEqual(await page.locator('[data-skirmish-screen]').isHidden(),true,'Skirmish preparation is skipped');
      assert.strictEqual(await page.locator('[data-artifact-choice-modal]').evaluate(el => getComputedStyle(el).position), 'fixed');
      await page.locator(`[data-artifact-choice="${artifact}"]`).tap();
      await page.locator('[data-classic-screen]').waitFor({ state: 'visible' });
      assert.strictEqual(await page.locator('[data-artifact-choice-modal]').count(), 0);
      await page.evaluate(() => {
        const plan = globalThis.RPChessSkirmish.battlePlan;
        globalThis.RPChessSkirmish.finishBattle({ over: true, type: 'checkmate', winner: plan.playerColor });
      });
      await page.locator('[data-skirmish-aftermath]').waitFor({ state: 'visible' });
      // The new asset-loading mask deliberately covers a scene until its images decode.
      // Check tap accessibility only after that blocking overlay is fully dismissed.
      await page.locator('[data-game-loading]').waitFor({ state: 'hidden', timeout: 25000 });
      // Allow the reward/power owners to fill their slots before checking layout.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const result = await page.evaluate(() => {
        const button = document.querySelector('[data-aftermath-continue]');
        const box = button.getBoundingClientRect();
        const list = document.querySelector('[data-aftermath-survivors]');
        list.scrollTop = list.scrollHeight;
        return { top: box.top, bottom: box.bottom, height: box.height,
          reachable: button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)),
          coveringElement: document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.className || '',
          listHeight: list.clientHeight, overflow: list.scrollHeight > list.clientHeight + 1,
          scrolled: list.scrollTop > 0 };
      });
      assert(result.top >= 0 && result.bottom <= height + 1 && result.height >= 30 && result.reachable,
        `Continue is clipped or covered at ${width}x${height}: ${JSON.stringify(result)}`);
      assert(result.listHeight > 0, 'survivors must remain visible');
      if (result.overflow) assert(result.scrolled, 'long survivor list must scroll');
      await page.locator('[data-aftermath-continue]').tap();
      await page.locator('[data-travel-choice-screen]').waitFor({ state: 'visible' });
      assert.deepStrictEqual(errors, []);
      console.log(`Skirmish heading, artifact transition, scrollable victory and Continue ${width}x${height}: PASS`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
