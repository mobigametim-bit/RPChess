const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';
const MATRIX = [
  [1920, 1080], [1366, 768], [1280, 720], [1024, 768],
  [768, 1024], [390, 844], [844, 390]
];

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  assert(metrics.scrollWidth <= metrics.clientWidth + 1, `${label}: horizontal overflow ${metrics.scrollWidth}/${metrics.clientWidth}`);
}

async function assertReachable(page, selector, label) {
  const target = page.locator(selector).first();
  await target.waitFor({ state: 'visible' });
  await target.evaluate((element) => element.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  const geometry = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, vw: innerWidth, vh: innerHeight };
  });
  assert(geometry.width > 0 && geometry.height > 0, `${label}: target has no rendered area`);
  assert(geometry.left >= -1 && geometry.right <= geometry.vw + 1, `${label}: target is outside viewport horizontally`);
  assert(geometry.top < geometry.vh && geometry.bottom > 0, `${label}: target is not reachable after scrolling`);
}

async function freshMenu(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-reboot-foundation]:not([hidden])').waitFor();
}

async function auditPortraitLock(browser, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error)));
  const label = `${width}x${height}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
    await page.reload({ waitUntil: 'networkidle' });
    const lock = page.locator('[data-orientation-lock]');
    await lock.waitFor({ state: 'visible' });
    const geometry = await lock.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, vw: innerWidth, vh: innerHeight };
    });
    assert(Math.abs(geometry.left) <= 1 && Math.abs(geometry.top) <= 1, `${label}: portrait lock must start at viewport origin`);
    assert(Math.abs(geometry.right - geometry.vw) <= 1 && Math.abs(geometry.bottom - geometry.vh) <= 1, `${label}: portrait lock must cover viewport`);
    const copy = await lock.innerText();
    assert(copy.includes('Поверните устройство'), `${label}: portrait lock copy missing`);
    assert.strictEqual(await page.locator('.landscape-orientation-lock__device').count(), 1, `${label}: device frame missing`);
    assert.deepStrictEqual(errors, [], `${label} browser errors:\n${errors.join('\n')}`);
  } finally {
    await page.close();
  }
}

async function auditViewport(browser, width, height) {
  if (height > width && width <= 1180) return auditPortraitLock(browser, width, height);
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error)));
  const label = `${width}x${height}`;
  try {
    await freshMenu(page);
    await assertNoHorizontalOverflow(page, `${label} menu`);
    for (const selector of ['[data-new-game]', '[data-continue-run]', '[data-settings]']) await assertReachable(page, selector, `${label} ${selector}`);

    await page.locator('[data-settings]').first().click();
    await assertReachable(page, '[data-settings-modal]:not([hidden]) [data-close-modal]', `${label} Settings close`);
    await assertNoHorizontalOverflow(page, `${label} Settings`);
    await page.locator('[data-settings-modal] [data-close-modal]').click();

    await startNewRun(page, { playerName: `Viewport ${width}` });
    await assertNoHorizontalOverflow(page, `${label} Roster`);
    await assertReachable(page, '[data-roster-travel]', `${label} Roster journey CTA`);
    await page.locator('[data-roster-menu]').click();
    await assertReachable(page, '[data-chronicle-panel]', `${label} Chronicle`);
    await assertNoHorizontalOverflow(page, `${label} Chronicle`);
    await page.locator('[data-continue-run]').click();
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    await assertNoHorizontalOverflow(page, `${label} Travel`);
    await assertReachable(page, '[data-travel-choice]', `${label} Travel route`);
    if (width <= 1180) {
      await page.locator('[data-travel-run-portrait]').waitFor({ state:'visible' });
      const difficultyLabelVisible = await page.locator('.travel-choice-card--puzzle .travel-choice-card__difficulty small').evaluateAll((nodes) => nodes.some((node) => getComputedStyle(node).display !== 'none'));
      assert.strictEqual(difficultyLabelVisible, false, `${label}: Training route must not show the difficulty caption under stars`);
    }
    if (width <= 980 && height <= 520) {
      const cards = await page.locator('[data-travel-choice]').evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
      }));
      assert.strictEqual(cards.length, 3, `${label}: Travel must render exactly three choices`);
      assert(cards.every((card) => card.top >= -1 && card.bottom <= height + 1), `${label}: all three Travel choices must be visible without page scroll`);
      assert(cards.every((card) => Math.abs(card.top - cards[0].top) <= 2), `${label}: mobile Travel choices must share one tablet-style row`);
      assert(cards[1].left >= cards[0].right - 2 && cards[2].left >= cards[1].right - 2, `${label}: mobile Travel choices must be laid out left-to-right`);
    }
    assert.deepStrictEqual(errors, [], `${label} browser errors:\n${errors.join('\n')}`);
  } finally {
    await page.close();
  }
}

async function auditEventLayout(browser, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error)));
  const label = `${width}x${height}`;
  try {
    await freshMenu(page);
    await startNewRun(page, { playerName: `Event ${width}` });
    await page.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      const route = {
        id:'responsive.event.route', step:1, type:'event', label:'СОБЫТИЕ', stars:6,
        threatLabel:'ОПАСНАЯ', flavor:'Необычная встреча на дороге.', mechanicalHint:'',
        seed:'responsive-event-seed', difficultyModel:'power-v1', supplyCostAtSelection:1, supplyPaid:1
      };
      run.supplies = Math.max(5, Number(run.supplies || 0));
      run.journeyStep = 1;
      run.currentTravelChoices = null;
      run.activeTravelChoice = route;
      run.currentEvent = { routeId:route.id, eventId:'E147', choiceId:null, roll:null, success:null, resolved:false, outcome:null, combat:null };
      localStorage.setItem(key, JSON.stringify(run));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
      dispatchEvent(new CustomEvent('rpchess:event-open', { detail:{ choice:route } }));
    }, RUN_KEY);
    await page.locator('[data-events-screen]:not([hidden])').waitFor();
    await assertNoHorizontalOverflow(page, `${label} Event`);
    const layout = await page.evaluate(() => {
      const choices = document.querySelector('.events-choices');
      const frame = document.querySelector('.events-choice-frame');
      const first = document.querySelector('.events-choice__head strong');
      const columns = choices ? getComputedStyle(choices).gridTemplateColumns.split(' ').filter(Boolean).length : 0;
      const frameRect = frame?.getBoundingClientRect();
      const firstRect = first?.getBoundingClientRect();
      return {
        columns,
        frame: frameRect ? { left:frameRect.left, right:frameRect.right, top:frameRect.top, bottom:frameRect.bottom, width:frameRect.width, height:frameRect.height } : null,
        firstWidth:firstRect?.width || 0,
        vw:innerWidth,
        vh:innerHeight
      };
    });
    assert.strictEqual(layout.columns, 1, `${label}: Event choices must use one readable column in the right rail`);
    assert(layout.firstWidth >= 180, `${label}: Event choice text rail is too narrow (${layout.firstWidth}px)`);
    assert(layout.frame && layout.frame.right <= width + 1 && layout.frame.bottom <= height + 1, `${label}: Event choice frame must stay inside viewport`);
    assert.deepStrictEqual(errors, [], `${label} browser errors:\n${errors.join('\n')}`);
  } finally {
    await page.close();
  }
}

async function auditPrepAndCombat(browser, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error)));
  const label = `${width}x${height}`;
  try {
    await freshMenu(page);
    await startNewRun(page, { playerName: `Breakpoint ${width}` });
    await page.evaluate(() => dispatchEvent(new CustomEvent('rpchess:skirmish-open')));
    await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
    await assertNoHorizontalOverflow(page, `${label} Skirmish prep`);
    const skirmishColumns = await page.locator('.skirmish-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
    assert.strictEqual(skirmishColumns, 2, `${label}: Skirmish prep must keep two selectable card columns`);
    if (width <= 980 && height <= 520) {
      const formation = await page.locator('[data-skirmish-formation]').evaluate((element) => {
        const rect=element.getBoundingClientRect();return { top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,vw:innerWidth,vh:innerHeight };
      });
      assert(formation.top >= -1 && formation.bottom <= formation.vh + 1 && formation.left >= -1 && formation.right <= formation.vw + 1, `${label}: full Skirmish formation preview must fit in the viewport`);
    }
    await assertReachable(page, '[data-skirmish-start]', `${label} Skirmish start`);
    await page.locator('[data-skirmish-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    const combatPanel = await page.evaluate(() => {
      const party=document.querySelector('.classic-party-panel');const moves=document.querySelector('.classic-panel--moves');const board=document.querySelector('[data-chess-board]');
      const p=party?.getBoundingClientRect(),b=board?.getBoundingClientRect();
      return { movesInside:Boolean(party&&moves&&moves.parentElement===party),gap:p&&b?b.left-p.right:0 };
    });
    assert(combatPanel.movesInside, `${label}: run combat must use the desktop information-panel structure`);
    assert(combatPanel.gap >= 4, `${label}: combat information panel must not touch the board`);
    const board = await page.locator('[data-chess-board]').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const square = element.querySelector('[data-square]')?.getBoundingClientRect();
      const wrap = element.closest('[data-board-wrap]')?.getBoundingClientRect();
      const frame = element.parentElement?.getBoundingClientRect();
      const visibleCoordinates = [...element.querySelectorAll('.classic-coordinate')].filter((node) => getComputedStyle(node).display !== 'none').length;
      const style = getComputedStyle(element);
      return {
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        width: rect.width, height: rect.height, squareWidth: square?.width || 0, squareHeight: square?.height || 0,
        wrap: wrap ? { left:wrap.left, right:wrap.right, top:wrap.top, bottom:wrap.bottom, width:wrap.width, height:wrap.height } : null,
        frame: frame ? { left:frame.left, right:frame.right, top:frame.top, bottom:frame.bottom, width:frame.width, height:frame.height } : null,
        computed: { width:style.width, height:style.height, boxSizing:style.boxSizing, display:style.display },
        visibleCoordinates, vw: innerWidth, vh: innerHeight
      };
    });
    console.log(`[responsive-board] ${label} ${JSON.stringify(board)}`);
    const geometry = JSON.stringify(board);
    assert(Math.abs(board.width - board.height) <= 2, `${label}: combat board lost square aspect ${geometry}`);
    assert(Math.abs(board.width - board.vh) <= 2, `${label}: combat board must use full viewport height ${geometry}`);
    assert(Math.abs(board.top) <= 1 && Math.abs(board.bottom - board.vh) <= 1, `${label}: combat board must touch top and bottom viewport edges ${geometry}`);
    assert(Math.abs(board.right - board.vw) <= 1, `${label}: combat board must touch right viewport edge ${geometry}`);
    assert(Math.abs(board.squareWidth - board.squareHeight) <= 1, `${label}: board cells lost square aspect ${geometry}`);
    assert.strictEqual(board.visibleCoordinates, 0, `${label}: board coordinate labels must be hidden ${geometry}`);
    await page.evaluate(() => globalThis.RPChessSkirmish.finishBattle({ over: true, type: 'stalemate', winner: null }));
    await page.locator('[data-skirmish-aftermath]:not([hidden])').waitFor();
    await assertNoHorizontalOverflow(page, `${label} Skirmish aftermath`);
    if (width <= 980 && height <= 520) {
      const aftermath = await page.evaluate(() => {
        const button = document.querySelector('[data-aftermath-continue]')?.getBoundingClientRect();
        const rows = [...document.querySelectorAll('[data-aftermath-survivors] .skirmish-aftermath-row')].map((row) => {
          const rect = row.getBoundingClientRect();
          return { top:rect.top, bottom:rect.bottom };
        });
        return { button:button ? { top:button.top, bottom:button.bottom } : null, rows, vh:innerHeight };
      });
      assert(aftermath.button && aftermath.button.top >= -1 && aftermath.button.bottom <= aftermath.vh + 1, `${label}: aftermath CTA must be visible without scrolling`);
      assert.strictEqual(aftermath.rows.length, 6, `${label}: all six named survivors must remain present`);
      assert(aftermath.rows.every((row) => row.top >= -1 && row.bottom <= aftermath.vh + 1), `${label}: all six survivor rows must be visible without page scrolling`);
    }
    await assertReachable(page, '[data-aftermath-continue]', `${label} Skirmish aftermath CTA`);

    await page.evaluate(() => dispatchEvent(new CustomEvent('rpchess:battle-open')));
    await page.locator('[data-battle-screen]:not([hidden])').waitFor();
    await page.waitForFunction(() => document.body.classList.contains('battle-prep-compact-active'));
    await assertNoHorizontalOverflow(page, `${label} Battle prep`);
    const battleColumns = await page.locator('.battle-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
    assert.strictEqual(battleColumns, 2, `${label}: Battle prep must keep two card columns at tablet/mobile landscape widths`);
    const hireCost = await page.locator('.battle-mercenary-quote__row--cost strong').evaluate((element) => ({ icon:Boolean(element.querySelector('img')),text:element.textContent.trim() }));
    assert(hireCost.icon && /^\d+$/.test(hireCost.text), `${label}: hiring cost must render as gold icon + numeric value`);
    if (width <= 980 && height <= 520) {
      const prep = await page.evaluate(() => {
        const buttonRect = document.querySelector('[data-battle-start]')?.getBoundingClientRect();
        const cards = [...document.querySelectorAll('[data-battle-character]')].map((card) => {
          const rect = card.getBoundingClientRect();
          return { top:rect.top, bottom:rect.bottom, left:rect.left, right:rect.right };
        });
        const rosterRect = document.querySelector('.battle-roster')?.getBoundingClientRect();
        const armyRect = document.querySelector('.battle-army')?.getBoundingClientRect();
        return {
          button:buttonRect ? { top:buttonRect.top, bottom:buttonRect.bottom, left:buttonRect.left, right:buttonRect.right } : null,
          cards,
          roster:rosterRect ? { top:rosterRect.top, bottom:rosterRect.bottom, left:rosterRect.left, right:rosterRect.right } : null,
          army:armyRect ? { top:armyRect.top, bottom:armyRect.bottom, left:armyRect.left, right:armyRect.right } : null,
          documentHeight:document.documentElement.scrollHeight,
          bodyHeight:document.body.scrollHeight,
          vw:innerWidth,
          vh:innerHeight
        };
      });
      assert(prep.button && prep.button.top >= -1 && prep.button.bottom <= prep.vh + 1, `${label}: Battle start CTA must be visible without scrolling`);
      assert.strictEqual(prep.cards.length, 6, `${label}: Battle prep must keep all six personal fighter cards present`);
      assert(prep.cards.every((card) => card.top >= -1 && card.bottom <= prep.vh + 1), `${label}: all six Battle prep fighter cards must be visible without page scrolling`);
      assert(prep.roster && prep.army && prep.roster.right <= prep.army.left + 1, `${label}: Battle prep must keep roster and army side-by-side`);
      assert(prep.documentHeight <= prep.vh + 1 && prep.bodyHeight <= prep.vh + 1, `${label}: Battle prep must not require page scrolling`);
    }
    await assertReachable(page, '[data-battle-start]', `${label} Battle start`);
    assert.deepStrictEqual(errors, [], `${label} browser errors:\n${errors.join('\n')}`);
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1180, 820], [1024, 768], [844, 390]]) await auditPrepAndCombat(browser, width, height);
    for (const [width, height] of [[1024, 768], [844, 390]]) await auditEventLayout(browser, width, height);
    for (const [width, height] of MATRIX) await auditViewport(browser, width, height);
    console.log(`Responsive viewport browser: PASS — landscape matrix, portrait lock, readable Event rail, tablet-style mobile Travel, full Skirmish formation, desktop-style run combat panel, edge-to-edge board, no-scroll aftermath and no-scroll Battle prep contracts`);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });