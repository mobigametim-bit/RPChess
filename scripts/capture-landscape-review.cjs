const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const { startNewRun } = require('../tests/browser-test-helpers.cjs');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'artifacts', 'landscape-review');
const HOST = '127.0.0.1';
const PORT = Number(process.env.RPCHESS_CAPTURE_PORT || 4174);
const BASE = `http://${HOST}:${PORT}`;
const RUN_KEY = 'rpchess.reboot.v1.run';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.wasm':'application/wasm', '.otf':'font/otf' };

const VIEWS = [
  { name:'desktop-1920x1080', width:1920, height:1080 },
  { name:'tablet-1024x768', width:1024, height:768 },
  { name:'mobile-844x390', width:844, height:390 }
];

const EVENT_ROUTE = { id:'review.event.route', step:1, type:'event', label:'СОБЫТИЕ', stars:6, threatLabel:'ОПАСНАЯ', flavor:'Необычная встреча на дороге.', mechanicalHint:'', seed:'review-event-seed', difficultyModel:'power-v1', supplyCostAtSelection:1, supplyPaid:1 };
const PUZZLE_ROUTE = { id:'review.puzzle.route', step:1, type:'puzzle', label:'ЗАДАЧА', stars:3, threatLabel:'СЛОЖНОСТЬ ★3', flavor:'На дороге обнаружена позиция, требующая точного решения.', mechanicalHint:'Шахматная задача с конкретной целью.', seed:'review-puzzle-seed', difficultyModel:'power-v1', supplyCostAtSelection:1, supplyPaid:1 };
const SETTLEMENT_ROUTE = { id:'review.settlement.route', step:1, type:'settlement', label:'ПОСЕЛЕНИЕ', stars:1, threatLabel:'БЕЗОПАСНО', flavor:'Огни поселения видны с дороги.', mechanicalHint:'Лечение, найм и припасы.', seed:'review-settlement-seed', difficultyModel:'power-v1', supplyCostAtSelection:1, supplyPaid:1 };

function safeFile(url) {
  const raw = decodeURIComponent(String(url || '/').split('?')[0]);
  const requested = raw === '/' ? 'index.html' : raw.replace(/^\/+/, '');
  const resolved = path.resolve(DIST, requested);
  if (!resolved.startsWith(`${DIST}${path.sep}`) && resolved !== DIST) return null;
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  return path.join(DIST, 'index.html');
}

function server() {
  return http.createServer((req, res) => {
    const file = safeFile(req.url);
    if (!file) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(file, (error, buffer) => {
      if (error) { res.writeHead(500); res.end(String(error)); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-store' });
      res.end(buffer);
    });
  });
}

async function freshMenu(page) {
  await page.goto(BASE, { waitUntil:'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil:'networkidle' });
  await page.locator('[data-reboot-foundation]:not([hidden])').waitFor();
}

async function freshRun(page) {
  await freshMenu(page);
  await startNewRun(page, { playerName:'Тестовый Хранитель' });
}

async function settle(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.waitForTimeout(120);
}

async function capture(browser, view, slug, prepare) {
  const page = await browser.newPage({ viewport:{ width:view.width, height:view.height }, deviceScaleFactor:1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error)));
  try {
    await freshMenu(page);
    await prepare(page);
    await settle(page);
    if (errors.length) throw new Error(`${view.name}/${slug}: ${errors.join('\n')}`);
    const dir = path.join(OUT, view.name);
    fs.mkdirSync(dir, { recursive:true });
    const file = path.join(dir, `${slug}.png`);
    await page.screenshot({ path:file, fullPage:false });
    console.log(`[capture] ${view.name}/${slug}`);
  } finally {
    await page.close();
  }
}

async function seedRoute(page, route, extras = {}) {
  await page.evaluate(({ key, route, extras }) => {
    const run = JSON.parse(localStorage.getItem(key));
    Object.assign(run, extras);
    run.supplies = Math.max(5, Number(run.supplies || 0));
    run.journeyStep = route.step;
    run.currentTravelChoices = null;
    run.activeTravelChoice = route;
    localStorage.setItem(key, JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, { key:RUN_KEY, route, extras });
}

async function openClassicSetup(page) {
  await page.evaluate(() => dispatchEvent(new CustomEvent('rpchess:new-game')));
  await page.locator('[data-game-setup-modal]:not([hidden])').waitFor();
}

async function startClassic(page) {
  await openClassicSetup(page);
  await page.locator('[data-game-mode-select]').selectOption('local');
  await page.locator('[data-start-game]').click();
  await page.locator('[data-classic-screen]:not([hidden])').waitFor();
}

async function openSkirmish(page) {
  await freshRun(page);
  await page.evaluate(() => dispatchEvent(new CustomEvent('rpchess:skirmish-open')));
  await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
}

async function openBattle(page) {
  await freshRun(page);
  await page.evaluate(() => dispatchEvent(new CustomEvent('rpchess:battle-open')));
  await page.locator('[data-battle-screen]:not([hidden])').waitFor();
}

async function captureAll(browser, view) {
  await capture(browser, view, '00-main-menu', async () => {});
  await capture(browser, view, '01-settings', async (page) => {
    await page.locator('[data-settings]').first().click();
    await page.locator('[data-settings-modal]:not([hidden])').waitFor();
  });
  await capture(browser, view, '02-language', async (page) => {
    await page.locator('[data-language]').first().click();
    await page.locator('[data-language-modal]:not([hidden])').waitFor();
  });
  await capture(browser, view, '03-player-identity', async (page) => {
    await page.locator('[data-new-game]').first().click();
    await page.locator('[data-player-identity-modal]:not([hidden])').waitFor();
  });
  await capture(browser, view, '04-roster', async (page) => { await freshRun(page); });
  await capture(browser, view, '05-travel', async (page) => {
    await freshRun(page);
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
  });
  await capture(browser, view, '06-event', async (page) => {
    await freshRun(page);
    await seedRoute(page, EVENT_ROUTE, { currentEvent:{ routeId:EVENT_ROUTE.id, eventId:'E147', choiceId:null, roll:null, success:null, resolved:false, outcome:null, combat:null } });
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-events-screen]:not([hidden])').waitFor();
  });
  await capture(browser, view, '07-puzzle', async (page) => {
    await freshRun(page);
    await seedRoute(page, PUZZLE_ROUTE, { currentPuzzle:null, puzzleHistory:[] });
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-puzzle-screen]:not([hidden])').waitFor();
  });
  await capture(browser, view, '08-skirmish-prep', async (page) => { await openSkirmish(page); });
  await capture(browser, view, '09-skirmish-combat', async (page) => {
    await openSkirmish(page);
    await page.locator('[data-skirmish-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
  });
  await capture(browser, view, '10-skirmish-aftermath', async (page) => {
    await openSkirmish(page);
    await page.locator('[data-skirmish-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    await page.evaluate(() => globalThis.RPChessSkirmish.finishBattle({ over:true, type:'checkmate', winner:'w' }));
    await page.locator('[data-skirmish-aftermath]:not([hidden])').waitFor();
  });
  await capture(browser, view, '11-battle-prep', async (page) => { await openBattle(page); });
  await capture(browser, view, '12-battle-combat', async (page) => {
    await openBattle(page);
    await page.locator('[data-battle-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
  });
  await capture(browser, view, '13-battle-aftermath', async (page) => {
    await openBattle(page);
    await page.locator('[data-battle-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    await page.evaluate(() => globalThis.RPChessBattle.finishBattle({ over:true, type:'checkmate', winner:'w' }));
    await page.locator('[data-battle-aftermath]:not([hidden])').waitFor();
  });
  await capture(browser, view, '14-settlement', async (page) => {
    await freshRun(page);
    await seedRoute(page, SETTLEMENT_ROUTE, { currentSettlement:null });
    await page.evaluate((route) => dispatchEvent(new CustomEvent('rpchess:settlement-open', { detail:{ choice:route } })), SETTLEMENT_ROUTE);
    await page.locator('[data-settlement-screen]:not([hidden])').waitFor();
  });
  await capture(browser, view, '15-starvation', async (page) => {
    await freshRun(page);
    await page.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      const victim = run.roster.find((character) => !character.isRunKing && character.status === 'healthy');
      victim.status = 'dead';
      run.supplies = 0;
      run.currentTravelChoices = null;
      run.activeTravelChoice = {
        id:'review.starvation.route', step:1, type:'battle', label:'БИТВА', stars:2,
        seed:'review-starvation', difficultyModel:'power-v1', supplyCostAtSelection:1, supplyPaid:0,
        starvationVictimId:victim.id, starvationKingDied:false, starvationAcknowledged:false
      };
      localStorage.setItem(key, JSON.stringify(run));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
      globalThis.RPChessStarvation.open(run);
    }, RUN_KEY);
    await page.locator('[data-starvation-screen]:not([hidden])').waitFor();
  });
  await capture(browser, view, '16-run-summary', async (page) => {
    await freshRun(page);
    await page.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      const king = run.roster.find((character) => character.isRunKing);
      king.status = 'dead';
      run.ended = true;
      run.endReason = 'starvation_king';
      run.journeyStep = 1;
      run.battleCount = 0;
      run.skirmishCount = 0;
      run.eventsResolved = 0;
      localStorage.setItem(key, JSON.stringify(run));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
      globalThis.RPChessEndlessRun.open(run);
    }, RUN_KEY);
    await page.locator('[data-endless-run-screen]:not([hidden])').waitFor();
  });
  await capture(browser, view, '17-classic-setup', async (page) => { await openClassicSetup(page); });
  await capture(browser, view, '18-classic-chess', async (page) => { await startClassic(page); });
  await capture(browser, view, '19-promotion', async (page) => {
    await startClassic(page);
    await page.evaluate(() => globalThis.RPChessClassicChess.loadFen('7k/P7/8/8/8/8/8/7K w - - 0 1'));
    await page.locator('[data-square="a7"]').click();
    await page.locator('[data-square="a8"]').click();
    await page.locator('[data-promotion-modal]:not([hidden])').waitFor();
  });
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/index.html missing; run npm run build first');
  fs.rmSync(OUT, { recursive:true, force:true });
  fs.mkdirSync(OUT, { recursive:true });
  const app = server();
  await new Promise((resolve, reject) => { app.once('error', reject); app.listen(PORT, HOST, resolve); });
  const browser = await chromium.launch({ headless:true });
  try {
    for (const view of VIEWS) await captureAll(browser, view);
    const portrait = { name:'portrait-lock-390x844', width:390, height:844 };
    await capture(browser, portrait, '20-portrait-lock', async (page) => {
      await page.locator('[data-orientation-lock]').waitFor({ state:'visible' });
    });
    console.log(`Landscape review capture complete: ${OUT}`);
  } finally {
    await browser.close();
    await new Promise((resolve) => app.close(resolve));
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
