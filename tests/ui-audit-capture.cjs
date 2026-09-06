const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';
const OUT = path.resolve(process.env.RPCHESS_UI_AUDIT_DIR || 'ui-audit');
const VIEWPORTS = Object.freeze({
  desktop: [1920, 1080],
  tablet: [1024, 768],
  mobile: [844, 390]
});
const SCREENS = Object.freeze([
  'roster','travel','training','skirmish-prep','skirmish-combat',
  'battle-prep','battle-combat','settlement','starvation','run-end'
]);

function route(type, stars, label) {
  return {
    id:`audit.${type}.route`, step:3, type, label, stars,
    threatLabel:'ОПАСНАЯ', flavor:'Визуальный аудит адаптивного интерфейса.', mechanicalHint:'',
    seed:`audit-${type}-seed`, difficultyModel:'power-v1', supplyCostAtSelection:1, supplyPaid:1
  };
}

async function fresh(page) {
  // Clear the run before app scripts execute. This avoids the old goto -> clear -> reload cycle,
  // which doubled every navigation in the 30-shot audit while preserving an identical fresh-run state.
  await page.addInitScript((key) => localStorage.removeItem(key), RUN_KEY);
  await page.goto(url, { waitUntil:'domcontentloaded' });
  await page.locator('[data-reboot-foundation]:not([hidden])').waitFor();
}

async function visualReady(page) {
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
  await page.waitForFunction(() => [...document.images].filter((image) => {
    const style=getComputedStyle(image),rect=image.getBoundingClientRect();
    return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;
  }).every((image) => image.complete), null, { timeout:5000 }).catch(() => {});
  await page.waitForTimeout(180);
}

async function runStart(page, label) {
  await startNewRun(page, { playerName:`UI Audit ${label}` });
  await page.waitForTimeout(80);
}

async function setRoute(page, nextRoute) {
  await page.evaluate(([key, nextRoute]) => {
    const run = JSON.parse(localStorage.getItem(key));
    run.supplies = Math.max(5, Number(run.supplies || 0));
    run.gold = Math.max(100, Number(run.gold || 0));
    run.journeyStep = nextRoute.step;
    run.currentTravelChoices = null;
    run.activeTravelChoice = nextRoute;
    localStorage.setItem(key, JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, [RUN_KEY, nextRoute]);
}

async function openScreen(page, name) {
  await fresh(page);
  await runStart(page, name);
  if (name === 'roster') return;
  if (name === 'travel') {
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    return;
  }
  if (name === 'training') {
    const next = route('puzzle', 7, 'ТРЕНИРОВКА');
    await setRoute(page, next);
    await page.evaluate((next) => dispatchEvent(new CustomEvent('rpchess:puzzle-open', { detail:{ choice:next } })), next);
    await page.locator('[data-puzzle-screen]:not([hidden])').waitFor();
    return;
  }
  if (name === 'skirmish-prep' || name === 'skirmish-combat') {
    await setRoute(page, route('skirmish', 6, 'СТЫЧКА'));
    await page.evaluate(() => dispatchEvent(new CustomEvent('rpchess:skirmish-open')));
    await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
    if (name === 'skirmish-combat') {
      await page.locator('[data-skirmish-start]').click();
      await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    }
    return;
  }
  if (name === 'battle-prep' || name === 'battle-combat') {
    await setRoute(page, route('battle', 8, 'БИТВА'));
    await page.evaluate(() => dispatchEvent(new CustomEvent('rpchess:battle-open')));
    await page.locator('[data-battle-screen]:not([hidden])').waitFor();
    if (name === 'battle-combat') {
      await page.locator('[data-battle-start]').click();
      await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    }
    return;
  }
  if (name === 'settlement') {
    const next = route('settlement', 4, 'ПОСЕЛЕНИЕ');
    await setRoute(page, next);
    await page.evaluate((next) => dispatchEvent(new CustomEvent('rpchess:settlement-open', { detail:{ choice:next } })), next);
    await page.locator('[data-settlement-screen]:not([hidden])').waitFor();
    return;
  }
  if (name === 'starvation') {
    await page.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      const victim = (run.roster || []).find((entry) => !entry.isRunKing) || run.roster?.[0];
      run.supplies = 0;
      run.activeTravelChoice = {
        id:'audit.starvation.route', step:3, type:'event', label:'ПУТЬ', stars:5,
        supplyCostAtSelection:1, supplyPaid:0,
        starvationVictimId:victim.id, starvationKingDied:false, starvationAcknowledged:false
      };
      localStorage.setItem(key, JSON.stringify(run));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
      globalThis.RPChessStarvation?.open?.(run);
    }, RUN_KEY);
    await page.locator('[data-starvation-screen]:not([hidden])').waitFor();
    return;
  }
  if (name === 'run-end') {
    await page.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      run.ended = true;
      run.endReason = 'king_dead';
      run.journeyStep = 9;
      run.runStats = { goldEarned:137, skirmishWins:4, battleWins:2, puzzlesSolved:3, eventsResolved:7 };
      localStorage.setItem(key, JSON.stringify(run));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
      globalThis.RPChessEndlessRun?.open?.(run);
    }, RUN_KEY);
    await page.locator('[data-endless-run-screen]:not([hidden])').waitFor();
    return;
  }
  throw new Error(`Unknown UI audit screen: ${name}`);
}

async function metrics(page) {
  return page.evaluate(() => {
    const visible = [...document.querySelectorAll('body *')].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    const outside = visible.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -2 || rect.right > innerWidth + 2 || rect.top < -2 || rect.bottom > innerHeight + 2;
    }).slice(0, 40).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        tag:element.tagName,
        className:String(element.className || '').slice(0,160),
        data:[...element.attributes].filter((attr) => attr.name.startsWith('data-')).slice(0,4).map((attr) => attr.name),
        rect:{ left:Math.round(rect.left), top:Math.round(rect.top), right:Math.round(rect.right), bottom:Math.round(rect.bottom), width:Math.round(rect.width), height:Math.round(rect.height) }
      };
    });
    return {
      viewport:{ width:innerWidth, height:innerHeight },
      document:{ width:document.documentElement.scrollWidth, height:document.documentElement.scrollHeight },
      outside
    };
  });
}

(async () => {
  fs.rmSync(OUT, { recursive:true, force:true });
  fs.mkdirSync(OUT, { recursive:true });
  const browser = await chromium.launch({ headless:true });
  const manifest = { source:url, createdAt:new Date().toISOString(), captures:{} };
  try {
    for (const [adaptation, [width, height]] of Object.entries(VIEWPORTS)) {
      manifest.captures[adaptation] = {};
      const dir = path.join(OUT, adaptation);
      fs.mkdirSync(dir, { recursive:true });
      for (let index = 0; index < SCREENS.length; index += 1) {
        const name = SCREENS[index];
        const page = await browser.newPage({ viewport:{ width, height } });
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(String(error.stack || error)));
        try {
          await openScreen(page, name);
          await visualReady(page);
          const file = `${String(index + 1).padStart(2,'0')}-${name}.png`;
          await page.screenshot({ path:path.join(dir, file), fullPage:false });
          manifest.captures[adaptation][name] = { file, pageErrors, metrics:await metrics(page) };
          console.log(`[ui-audit] ${adaptation} ${name}: ${file}`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT,'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`[ui-audit] complete: ${OUT}`);
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
