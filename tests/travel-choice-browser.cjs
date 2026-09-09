const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';

async function installLifecycleProbe(page) {
  await page.addInitScript(() => {
    const nativeAdd = EventTarget.prototype.addEventListener;
    const nativeRemove = EventTarget.prototype.removeEventListener;
    const registrations = new Map();
    const eventCounts = { runContinue:0, travelRendered:0, runUpdated:0 };
    const captureOf = (options) => typeof options === 'boolean' ? options : Boolean(options?.capture);
    const registrationKey = (type, options) => `${type}|${captureOf(options) ? 1 : 0}`;

    window.addEventListener = function(type, listener, options) {
      if (String(type).startsWith('rpchess:') && listener) {
        const key = registrationKey(type, options);
        let listeners = registrations.get(key);
        if (!listeners) { listeners = new Set(); registrations.set(key, listeners); }
        listeners.add(listener);
      }
      return nativeAdd.call(this, type, listener, options);
    };
    window.removeEventListener = function(type, listener, options) {
      if (String(type).startsWith('rpchess:') && listener) {
        const key = registrationKey(type, options);
        const listeners = registrations.get(key);
        listeners?.delete(listener);
        if (listeners && listeners.size === 0) registrations.delete(key);
      }
      return nativeRemove.call(this, type, listener, options);
    };

    nativeAdd.call(window, 'rpchess:run-continue', () => { eventCounts.runContinue += 1; });
    nativeAdd.call(window, 'rpchess:travel-rendered', () => { eventCounts.travelRendered += 1; });
    nativeAdd.call(window, 'rpchess:run-updated', () => { eventCounts.runUpdated += 1; });
    window.__RPChessLifecycleProbe = Object.freeze({
      snapshot() {
        return {
          listeners:Object.fromEntries([...registrations.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([key, listeners]) => [key, listeners.size])),
          eventCounts:{ ...eventCounts }
        };
      }
    });
  });
}

async function lifecycleSnapshot(page) {
  return page.evaluate(() => {
    const selectors = {
      resourceHud:'[data-resource-hud]',
      travelScreen:'[data-travel-choice-screen]',
      rosterScreen:'[data-roster-screen]',
      travelOwnerStyle:'link[data-travel-choice-owner-style]',
      uxCss:'link[data-ux-consistency-css]',
      playtestCss:'link[data-playtest-fixes-css]',
      finalUiCss:'link[data-ui-redesign-final-css]',
      sideColorsCss:'link[data-combat-side-colors-css]',
      resourcesCss:'link[data-resources-css]',
      playerRatingCss:'link[data-player-rating-css]',
      crossSceneStyle:'style[data-cross-scene-visuals]'
    };
    return {
      probe:globalThis.__RPChessLifecycleProbe?.snapshot?.() || null,
      appMains:document.querySelectorAll('#app > main').length,
      routeCards:document.querySelectorAll('[data-travel-choice]').length,
      singletons:Object.fromEntries(Object.entries(selectors).map(([name, selector]) => [name, document.querySelectorAll(selector).length]))
    };
  });
}

async function assertRouteLoopStability(page, travel) {
  const baseline = await lifecycleSnapshot(page);
  assert(baseline.probe, 'lifecycle listener probe must be installed before application modules');
  const initialChoices = await page.locator('[data-travel-choice]').evaluateAll((nodes) => nodes.map((node) => node.dataset.travelChoice));
  assert.strictEqual(initialChoices.length, 3);

  for (let index = 0; index < 12; index += 1) {
    await page.locator('[data-travel-roster]').click();
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    await page.locator('[data-roster-travel]').click();
    await travel.waitFor();
    assert.strictEqual(await page.locator('[data-travel-choice]').count(), 3, `route loop ${index + 1}: exactly three Travel cards must remain`);
    assert.deepStrictEqual(
      await page.locator('[data-travel-choice]').evaluateAll((nodes) => nodes.map((node) => node.dataset.travelChoice)),
      initialChoices,
      `route loop ${index + 1}: persisted fork must not regenerate`
    );
    await page.evaluate(() => dispatchEvent(new CustomEvent('rpchess:run-updated', { detail:{ source:'browser-route-stability-noop' } })));
    await page.waitForTimeout(0);
  }

  const after = await lifecycleSnapshot(page);
  assert.deepStrictEqual(after.probe.listeners, baseline.probe.listeners, '12 route loops must not accumulate rpchess:* window listeners');
  assert.strictEqual(after.appMains, baseline.appMains, '12 route loops must not accumulate owner scene roots');
  assert.deepStrictEqual(after.singletons, baseline.singletons, '12 route loops must not duplicate HUD/style/runtime singleton nodes');
  assert.strictEqual(after.routeCards, 3, 'Travel render must still own exactly three route-card nodes after 12 loops');
  assert.strictEqual(after.probe.eventCounts.runContinue - baseline.probe.eventCounts.runContinue, 12, 'each Travel→Roster loop must dispatch exactly one run-continue');
  assert.strictEqual(after.probe.eventCounts.travelRendered - baseline.probe.eventCounts.travelRendered, 12, 'each Roster→Travel loop must render Travel exactly once');
  assert.strictEqual(after.probe.eventCounts.runUpdated - baseline.probe.eventCounts.runUpdated, 12, 'the 12 explicit no-op run updates must not trigger hidden producer loops');
}

async function fresh(page, runId = 'all_event-18') {
  await page.goto(url, { waitUntil:'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil:'networkidle' });
  await startNewRun(page);
  await page.evaluate(({ key, runId }) => {
    const run = JSON.parse(localStorage.getItem(key));
    run.id = runId;
    run.currentTravelChoices = null;
    run.activeTravelChoice = null;
    run.currentPuzzle = null;
    localStorage.setItem(key, JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, { key:RUN_KEY, runId });
}

async function forceTwelveStarRoutes(page) {
  await page.evaluate((key) => {
    const run = JSON.parse(localStorage.getItem(key));
    run.currentTravelChoices = Array.from({ length:3 }, (_, index) => ({
      id:`mobile.12.${index + 1}`,
      step:1,
      type:'skirmish',
      label:'СТЫЧКА',
      stars:12,
      threatLabel:'ЛЕГЕНДАРНАЯ',
      flavor:'Разведчики заметили впереди небольшой вражеский отряд.',
      mechanicalHint:'Нестандартный состав противника.',
      seed:`mobile-12-${index + 1}`
    }));
    run.activeTravelChoice = null;
    localStorage.setItem(key, JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, RUN_KEY);
}

async function assertResponsiveStars(page) {
  const layout = await page.locator('[data-travel-stars="12"] .travel-choice-card__threat strong').first().evaluate((element) => {
    const card = element.closest('.travel-choice-card');
    const range = document.createRange();
    range.selectNodeContents(element);
    const bounds = card.getBoundingClientRect();
    const rects = [...range.getClientRects()].map((rect) => ({ left:rect.left, right:rect.right, top:rect.top, bottom:rect.bottom }));
    return {
      text:(element.textContent || '').replace(/\u200B/g,''),
      hasBreak:(element.textContent || '').includes('\u200B'),
      rects,
      bounds:{ left:bounds.left, right:bounds.right }
    };
  });
  assert.strictEqual((layout.text.match(/★/g) || []).length, 12);
  assert.strictEqual(layout.hasBreak, true);
  assert(layout.rects.length >= 1 && layout.rects.length <= 2, `Travel 12-star label must occupy one or two lines, got ${layout.rects.length}`);
  for (const rect of layout.rects) {
    assert(rect.left >= layout.bounds.left - 1);
    assert(rect.right <= layout.bounds.right + 1);
  }
}

async function assertResourceAlignment(page) {
  const geometry = await page.locator('[data-travel-choice]').filter({ has:page.locator('.travel-choice-card__reward') }).first().evaluate((card) => {
    const cost = card.querySelector('.travel-choice-card__cost');
    const reward = card.querySelector('.travel-choice-card__reward');
    const costIcon = card.querySelector('.travel-choice-card__cost-icon');
    const rewardIcon = card.querySelector('.travel-choice-card__reward-icon');
    const costAmount = card.querySelector('.travel-choice-card__cost-amount');
    const rewardAmount = card.querySelector('.travel-choice-card__reward-amount');
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { left:rect.left, top:rect.top, width:rect.width, height:rect.height, cx:rect.left + rect.width / 2, cy:rect.top + rect.height / 2 };
    };
    return {
      cost:box(cost), reward:box(reward), costIcon:box(costIcon), rewardIcon:box(rewardIcon),
      costFont:parseFloat(getComputedStyle(costAmount).fontSize),
      rewardFont:parseFloat(getComputedStyle(rewardAmount).fontSize)
    };
  });
  assert(Math.abs(geometry.cost.cy - geometry.reward.cy) <= 1.5, `Travel cost/reward centers must align: ${geometry.cost.cy}/${geometry.reward.cy}`);
  assert(Math.abs(geometry.costIcon.cy - geometry.rewardIcon.cy) <= 1.5, `Travel resource icon centers must align: ${geometry.costIcon.cy}/${geometry.rewardIcon.cy}`);
  assert(Math.abs(geometry.costIcon.width - geometry.rewardIcon.width) <= .5 && Math.abs(geometry.costIcon.height - geometry.rewardIcon.height) <= .5, `Travel resource icons must share one size: ${geometry.costIcon.width}x${geometry.costIcon.height} vs ${geometry.rewardIcon.width}x${geometry.rewardIcon.height}`);
  assert(Math.abs(geometry.costFont - geometry.rewardFont) <= .1, `Travel resource amounts must share one font size: ${geometry.costFont}/${geometry.rewardFont}`);
}

async function assertDecoratedBackdrops(page, label) {
  const cards = await page.locator('[data-travel-choice]').evaluateAll((nodes) => nodes.map((node) => ({
    path:node.dataset.travelBackdrop || '',
    css:node.style.getPropertyValue('--travel-card-backdrop')
  })));
  assert.strictEqual(cards.length, 3, `${label}: Travel must render three cards`);
  for (const card of cards) {
    assert(card.path, `${label}: every Travel card must receive its route backdrop on first render`);
    assert(!card.path.includes('scene_campaign.jpg'), `${label}: route card must not remain on shared campaign fallback`);
    assert(card.css.includes(card.path), `${label}: route backdrop must be applied before the Travel screen is shown`);
  }
}

(async () => {
  const browser = await chromium.launch({ headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
    await installLifecycleProbe(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));
    await fresh(page);
    await page.locator('[data-roster-travel]').click();
    const travel = page.locator('[data-travel-choice-screen]:not([hidden])');
    await travel.waitFor();
    assert.strictEqual(await page.locator('[data-travel-choice]').count(), 3);
    await assertDecoratedBackdrops(page, 'initial roster-to-Travel open');
    assert.strictEqual((await page.locator('[data-travel-week]').innerText()).trim(), 'Неделя 1');
    const font = await page.locator('[data-travel-week]').evaluate((element) => getComputedStyle(element).fontFamily);
    assert(font.includes('BrahmsGotischCyr'));
    const copy = await travel.innerText();
    for (const removed of ['Исход неизвестен','3–5 решений','Выбрать путь','Каждая карточка выбирается независимо','Куда двигаться дальше?','Шаг путешествия']) assert(!copy.includes(removed), `removed Travel copy leaked: ${removed}`);
    const types = await page.locator('[data-travel-choice]').evaluateAll((nodes) => nodes.map((node) => node.dataset.travelType));
    assert.deepStrictEqual(types, ['puzzle','puzzle','puzzle'], 'known five-type seed proves duplicate Puzzle cards are allowed');
    assert.strictEqual(await page.locator('[data-travel-type="puzzle"]').count(), 3);
    assert((await travel.innerText()).includes('Тренировка'), 'Puzzle route must expose the semantic Training label in DOM text');
    assert((await travel.innerText()).includes('СЛОЖНОСТЬ'));
    assert.strictEqual((await page.locator('[data-travel-inline-gold]').innerText()).trim(), '80');
    assert.strictEqual((await page.locator('[data-travel-inline-supplies]').innerText()).trim(), '10');
    await assertResourceAlignment(page);
    await assertRouteLoopStability(page, travel);

    const first = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).currentTravelChoices, RUN_KEY);
    await page.locator('[data-travel-roster]').click();
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    await page.locator('[data-roster-travel]').click();
    await travel.waitFor();
    await assertDecoratedBackdrops(page, 'roster re-entry');
    assert.deepStrictEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).currentTravelChoices, RUN_KEY), first);
    await page.reload({ waitUntil:'networkidle' });
    await page.locator('[data-continue-run]').click();
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    await page.locator('[data-roster-travel]').click();
    await travel.waitFor();
    await assertDecoratedBackdrops(page, 'main-menu continue re-entry');
    assert.deepStrictEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).currentTravelChoices, RUN_KEY), first);
    await page.locator('[data-travel-type="puzzle"]').first().click();
    await page.locator('[data-puzzle-screen]:not([hidden])').waitFor();
    const committed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(committed.journeyStep, 1);
    assert.strictEqual(committed.activeTravelChoice.type, 'puzzle');
    assert.strictEqual(committed.activeTravelChoice.stars, 1);
    assert.strictEqual(committed.supplies, 9);
    assert(committed.currentPuzzle?.puzzleId);

    const mobile = await browser.newPage({ viewport:{ width:844, height:390 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await fresh(mobile, 'test-4');
    await forceTwelveStarRoutes(mobile);
    await mobile.locator('[data-roster-travel]').click();
    await mobile.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    assert.strictEqual(await mobile.locator('[data-travel-choice]').count(), 3);
    await assertDecoratedBackdrops(mobile, 'landscape-mobile initial Travel open');
    assert.strictEqual(await mobile.locator('[data-travel-stars="12"]').count(), 3);
    await assertResponsiveStars(mobile);
    await assertResourceAlignment(mobile);
    const layout = await mobile.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-travel-choice]')].map((node) => {
        const rect = node.getBoundingClientRect();
        return { left:rect.left, right:rect.right, top:rect.top, bottom:rect.bottom };
      });
      const screen = document.querySelector('[data-travel-choice-screen]')?.getBoundingClientRect();
      return {
        sw:document.documentElement.scrollWidth,
        cw:document.documentElement.clientWidth,
        sh:document.documentElement.scrollHeight,
        ch:document.documentElement.clientHeight,
        cards,
        screen:screen ? { left:screen.left, right:screen.right, top:screen.top, bottom:screen.bottom } : null
      };
    });
    assert(layout.sw <= layout.cw + 1);
    assert(layout.sh <= layout.ch + 1, `landscape-mobile Travel must not page-scroll: ${layout.sh}/${layout.ch}`);
    assert(layout.screen && layout.screen.left >= -1 && layout.screen.right <= layout.cw + 1 && layout.screen.top >= -1 && layout.screen.bottom <= layout.ch + 1, 'Travel screen must fit one viewport');
    assert(layout.cards.length === 3 && layout.cards.every((card) => card.left >= -1 && card.right <= layout.cw + 1 && card.top >= -1 && card.bottom <= layout.ch + 1), 'all Travel cards must remain inside the viewport');

    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(mobileErrors, []);
    console.log('Travel first-render backdrops, 12-loop listener/render/node stability, semantic Training labels, aligned resources, persistence and landscape-mobile acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
