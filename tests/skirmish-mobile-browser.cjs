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
      await page.locator('[data-skirmish-screen]').waitFor({ state: 'visible' });
      const prep = await page.evaluate(() => {
        const panel = document.querySelector('.skirmish-selection');
        const header = panel.querySelector('.skirmish-section-head');
        const list = panel.querySelector('.skirmish-selected');
        const formation = panel.querySelector('.skirmish-formation-block');
        return {
          topGap: header.getBoundingClientRect().top - panel.getBoundingClientRect().top,
          headerBottom: header.getBoundingClientRect().bottom,
          listTop: list.getBoundingClientRect().top,
          listBottom: list.getBoundingClientRect().bottom,
          listHeight: list.clientHeight,
          formationTop: formation.getBoundingClientRect().top,
          formationBottom: formation.getBoundingClientRect().bottom,
          footerTop: document.querySelector('.skirmish-actionbar').getBoundingClientRect().top,
          styledArtifact: Boolean(document.querySelector('[data-artifact-combat-css]')?.sheet)
        };
      });
      if (width <= 980) {
        assert(prep.topGap >= 0 && prep.topGap < 24, `heading shifted down: ${JSON.stringify(prep)}`);
        assert(prep.listHeight >= 27, `selected list has no usable row: ${JSON.stringify(prep)}`);
        assert(prep.listTop >= prep.headerBottom - 1, 'list overlaps heading');
        assert(prep.listBottom <= prep.formationTop + 1, 'list overlaps formation');
        assert(prep.formationBottom <= prep.footerTop + 1, 'formation overlaps Start footer');
      }
      assert(prep.styledArtifact, 'artifact styles must be ready before the first launch click');
      await page.locator('[data-skirmish-start]').click();
      assert.strictEqual(await page.locator('[data-artifact-choice-modal]').evaluate(el => getComputedStyle(el).position), 'fixed');
      await page.locator(`[data-artifact-choice="${artifact}"]`).tap();
      await page.locator('[data-classic-screen]').waitFor({ state: 'visible' });
      assert.strictEqual(await page.locator('[data-artifact-choice-modal]').count(), 0);
      await page.evaluate(() => {
        const plan = globalThis.RPChessSkirmish.battlePlan;
        globalThis.RPChessSkirmish.finishBattle({ over: true, type: 'checkmate', winner: plan.playerColor });
      });
      await page.locator('[data-skirmish-aftermath]').waitFor({ state: 'visible' });
      // Allow the reward/power owners to fill their slots before checking layout.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const result = await page.evaluate(() => {
        const button = document.querySelector('[data-aftermath-continue]');
        const box = button.getBoundingClientRect();
        const list = document.querySelector('[data-aftermath-survivors]');
        list.scrollTop = list.scrollHeight;
        return { top: box.top, bottom: box.bottom, height: box.height,
          reachable: button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)),
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
