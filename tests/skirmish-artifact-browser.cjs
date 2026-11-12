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
    for (const artifactId of ['threat.attack', 'threat.defense', 'threat.great', 'vision.piercing', 'none']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await page.goto(url, { waitUntil: 'networkidle' });
      await startNewRun(page);
      await page.evaluate(async artifactId => {
        const { readRun, writeRun } = await import('./js/run-persistence.mjs');
        await import('./js/skirmish-app.mjs');
        writeRun({ ...readRun(), artifacts: artifactId==='vision.piercing'?{'vision.piercing':3}:{ 'threat.attack': 3, 'threat.defense': 3, 'threat.great': 3 } });
        globalThis.RPChessSkirmish.open();
      },artifactId);
      await page.locator('[data-artifact-choice-modal]').waitFor();
      await page.locator(`[data-artifact-choice="${artifactId}"]`).click({ timeout: 10000 });
      await page.locator('[data-classic-screen]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
      assert.strictEqual(await page.locator('[data-artifact-choice-modal]').count(), 0);
      if(artifactId==='vision.piercing'){
        // Drag selection changes classes but not child nodes: verify X-ray
        // before releasing the pointer, including transparent blockers.
        await page.evaluate(()=>globalThis.RPChessClassicChess.loadFen(
          '7k/8/3p4/3p4/3p4/3P4/3R1p2/3K4 w - - 0 1',
          {mode:'hotseat',playerColor:'w',combatOwner:'skirmish'}));
        const rookCell=page.locator('[data-chess-board] [data-square="d2"]');
        // After loadFen the owning board and its imagery must be hit-testable.
        // A stale first-frame bounding box can cause Playwright mouse presses
        // to land on the previous UI layer instead of starting a real drag.
        await rookCell.locator('.classic-piece').waitFor({state:'visible',timeout:10000});
        await rookCell.scrollIntoViewIfNeeded();
        await page.waitForFunction(()=>{
          const board=document.querySelector('[data-chess-board]');
          const cell=board?.querySelector('[data-square="d2"]');
          if(!cell||board.classList.contains('is-locked'))return false;
          const rect=cell.getBoundingClientRect();
          const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
          return Boolean(hit&&(cell===hit||cell.contains(hit)));
        },null,{timeout:10000});
        try {
          let highlighted=false;
          for(let attempt=0;attempt<2&&!highlighted;attempt++){
            const rook=await rookCell.boundingBox();
            assert(rook);
            const x=rook.x+rook.width/2,y=rook.y+rook.height/2;
            await page.mouse.move(x,y);
            await page.mouse.down();
            // Shared drag input intentionally starts only after 7px of movement.
            await page.mouse.move(x+11,y+11,{steps:3});
            try {
              await page.waitForFunction(()=>
                document.querySelector('[data-chess-board] [data-square="d6"]')?.dataset.visionDepth==='3',
                null,{timeout:3500});
              highlighted=true;
            }catch(e){
              // A missed pointer press is a test-driver race. A second genuine
              // pointer gesture is allowed; real drag/overlay assertions still
              // must succeed on that second attempt or this test fails.
              await page.mouse.up();
              if(attempt===1)throw e;
            }
          }
        } catch (error) {
          const diagnostics=await page.evaluate(()=>{
            const snapshot=globalThis.RPChessClassicChess?.snapshot?.();
            const cells=[...document.querySelectorAll('[data-chess-board] [data-square]')];
            return {selected:snapshot?.selectedSquare,owner:globalThis.RPChessClassicChess?.combatOwner,
              fen:snapshot?.fen,choice:JSON.parse(localStorage.getItem('rpchess.reboot.v1.run'))?.combatArtifactChoice,
              targets:Object.fromEntries(cells.filter(c=>c.dataset.visionDepth).map(c=>[c.dataset.square,c.dataset.visionDepth])),
              dragOrigin:document.querySelectorAll('.rpchess-drag-origin').length,
              dragGhost:document.querySelectorAll('.rpchess-piece-drag-ghost').length};
          });
          throw new Error('Skirmish X-ray drag-overlay diagnostics: '+JSON.stringify(diagnostics)+': '+error.message);
        }
        const depths=await page.locator('[data-chess-board]').evaluate(board=>Object.fromEntries(
          [...board.querySelectorAll('[data-vision-depth]')].map(c=>[c.dataset.square,c.dataset.visionDepth])));
        assert.deepStrictEqual(depths,{d6:'3',d5:'2',d4:'1',f2:'1'},
          'drag-selected Rook must reveal all enemy pieces through allies and obstacles');
        await page.mouse.up();
      }

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
      for (const id of ['threat.attack', 'threat.defense', 'threat.great']) assert.strictEqual(result.charges[id],
        artifactId==='vision.piercing'?undefined:id === artifactId ? 2 : 3);
      assert.strictEqual(result.charges['vision.piercing'],artifactId==='vision.piercing'?2:undefined);
      assert.deepStrictEqual(errors, []);
      console.log(`Skirmish launch, responsive frame/timer and obstacle stability (${artifactId}): PASS`);
      await page.reload({ waitUntil: 'networkidle' });
      await page.evaluate(async () => {
        await import('./js/battle-route.mjs');
        await import('./js/skirmish-app.mjs');
        globalThis.RPChessSkirmish.open();
      });
      assert.strictEqual(await page.locator('[data-skirmish-screen]').isHidden(),true);
      await page.locator('[data-classic-screen]:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
      assert.strictEqual(await page.locator('[data-artifact-choice-modal]').count(), 0, 'saved choice must resume without another prompt');
      const resumed = await page.evaluate(() => JSON.parse(localStorage.getItem('rpchess.reboot.v1.run')));
      assert.deepStrictEqual(resumed.artifacts, result.charges, 'resuming a chosen combat must not spend another charge');
      assert.deepStrictEqual(errors, []);
      console.log(`Skirmish resume preserves artifact charges (${artifactId}): PASS`);
      await page.close();
    }
  } finally { await browser.close(); clearTimeout(watchdog); }
})().catch(error => { clearTimeout(watchdog); console.error(error.stack || error); process.exitCode = 1; });
