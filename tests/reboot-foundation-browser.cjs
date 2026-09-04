const assert = require('assert');
const { chromium } = require('playwright');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';
const SETTINGS_KEY = 'rpchess.reboot.v1.settings';
const MUSIC_TRACK_RE = /\/music\/echoes_iron_throne_0[1-4]\.mp3(?:$|\?)/;

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(([runKey, settingsKey]) => {
      localStorage.removeItem(runKey);
      localStorage.removeItem(settingsKey);
    }, [RUN_KEY, SETTINGS_KEY]);
    await page.reload({ waitUntil: 'networkidle' });
    const menu = page.locator('[data-reboot-foundation]');
    await menu.waitFor();

    assert.strictEqual(await menu.locator('[data-new-game]').count(), 1, 'New Game button must exist once in the main menu');
    assert.strictEqual(await menu.locator('[data-continue-run]').isDisabled(), true, 'Continue must be disabled before a Reboot run exists');
    assert.strictEqual(await menu.locator('[data-settings]').count(), 1, 'Settings button must exist once in the main menu');
    assert.strictEqual(await menu.locator('[data-language]').count(), 1, 'Language button must exist once in the main menu');
    assert.deepStrictEqual(
      await menu.locator('.reboot-menu-secondary > button').evaluateAll((buttons) => buttons.map((button) => button.dataset.settings !== undefined ? 'settings' : button.dataset.language !== undefined ? 'language' : 'unknown')),
      ['settings', 'language'],
      'Language must appear directly after Settings'
    );
    assert.strictEqual(await page.getByText('Новый путь RPChess').count(), 0, 'prototype marketing copy must not appear in production menu');

    const scripts = await page.locator('script[src]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src')));
    assert.deepStrictEqual(scripts, [
      'js/reboot-foundation.mjs?v=20260827-roster-1',
      'js/roster-app.mjs?v=20260827-skirmish-1',
      'js/classic-chess-app.mjs?v=20260827-ai-2',
      'js/skirmish-app.mjs?v=20260827-skirmish-1'
    ], `unexpected runtime scripts: ${scripts.join(', ')}`);

    await page.evaluate(async () => {
      if (window.RPChessRouteReady && typeof window.RPChessRouteReady.then === 'function') await window.RPChessRouteReady;
    });
    const runtimeState = await page.evaluate(() => ({
      verticalSlice: Boolean(window.RPChessVerticalSlice),
      ironMarches: Boolean(window.RPChessIronMarchesRuntime),
      rebootAudio: Boolean(window.RPChessRebootAudio),
      roster: Boolean(window.RPChessRoster),
      skirmish: Boolean(window.RPChessSkirmish),
      battle: Boolean(window.RPChessBattle),
      travelChoice: Boolean(window.RPChessTravelChoice),
      settlement: Boolean(window.RPChessSettlement),
      resources: Boolean(window.RPChessResources),
      sharedUx: Boolean(window.RPChessResourceIcons),
      travelScreen: Boolean(document.querySelector('[data-travel-choice-screen]')),
      settlementScreen: Boolean(document.querySelector('[data-settlement-screen]')),
      directBattleShortcut: Boolean(document.querySelector('[data-roster-battle]')),
      classicChess: Boolean(window.RPChessClassicChess),
      chessAI: Boolean(window.RPChessChessAI),
      musicSrc: window.RPChessRebootAudio?.music?.src || '',
      activated: Boolean(window.RPChessRebootAudio?.activated)
    }));
    assert.strictEqual(runtimeState.verticalSlice, false, 'legacy vertical slice global must not be active');
    assert.strictEqual(runtimeState.ironMarches, false, 'legacy Iron Marches global must not be active');
    assert.strictEqual(runtimeState.rebootAudio, true, 'Reboot audio layer must be active');
    assert.strictEqual(runtimeState.roster, true, 'Roster runtime must coexist with the retained Foundation menu');
    assert.strictEqual(runtimeState.skirmish, true, 'Skirmish runtime must load with the run shell');
    assert.strictEqual(runtimeState.battle, true, 'Battle runtime must remain available for Travel encounters');
    assert.strictEqual(runtimeState.travelChoice, true, 'Travel Choice runtime must load with the run shell');
    assert.strictEqual(runtimeState.settlement, true, 'Settlement runtime must load with the run shell');
    assert.strictEqual(runtimeState.resources, true, 'Resources runtime must remain available across run scenes');
    assert.strictEqual(runtimeState.sharedUx, true, 'Shared board/resource UX runtime must be present in production dist');
    assert.strictEqual(runtimeState.travelScreen, true, 'Travel Choice scene must be prepared at bootstrap');
    assert.strictEqual(runtimeState.settlementScreen, true, 'Settlement scene must be prepared at bootstrap');
    assert.strictEqual(runtimeState.directBattleShortcut, false, 'temporary direct Battle shortcut must be gone');
    assert.strictEqual(runtimeState.classicChess, true, 'Classic Chess runtime must remain available for encounters');
    assert.strictEqual(runtimeState.chessAI, true, 'Chess AI adapter surface must remain available');
    assert(MUSIC_TRACK_RE.test(runtimeState.musicSrc), `unexpected first music track: ${runtimeState.musicSrc}`);
    assert.strictEqual(runtimeState.activated, false, 'audio must wait for the first browser-approved user gesture');

    await menu.locator('[data-settings]').click();
    await page.locator('[data-settings-modal]:not([hidden])').waitFor();
    assert.strictEqual(await page.evaluate(() => window.RPChessRebootAudio.activated), true, 'opening settings must activate music/SFX after a user gesture');
    await page.locator('[data-music-volume]').evaluate((input) => {
      input.value = '33';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.strictEqual(await page.locator('[data-music-volume]').inputValue(), '33', 'music setting must be interactive');
    await page.locator('[data-settings-modal] [data-close-modal]').click();

    const navigationCount = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    await menu.locator('[data-language]').click();
    const languageModal = page.locator('[data-language-modal]:not([hidden])');
    await languageModal.waitFor();
    assert.strictEqual(await languageModal.locator('[data-language-option="ru"] strong').textContent(), 'Русский');
    assert.strictEqual(await languageModal.locator('[data-language-option="en"] strong').textContent(), 'English');
    assert.strictEqual(await languageModal.locator('[data-language-option="ru"]').getAttribute('aria-pressed'), 'true', 'RU must be selected by default');
    await languageModal.locator('[data-language-option="en"]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.strictEqual(await menu.locator('[data-new-game]').textContent(), 'New Game');
    assert.strictEqual(await menu.locator('[data-continue-run]').textContent(), 'Continue');
    assert.strictEqual(await menu.locator('[data-settings]').textContent(), 'Settings');
    assert.strictEqual(await menu.locator('[data-language]').textContent(), 'Language');
    assert.strictEqual(await languageModal.locator('[data-language-option="en"]').getAttribute('aria-pressed'), 'true', 'EN selection must update immediately');
    assert.strictEqual(await languageModal.locator('[data-language-current]:visible').textContent(), 'Selected: English');
    assert.strictEqual(await languageModal.locator('[data-close-modal].reboot-language-back').textContent(), 'Back');
    assert.strictEqual(await page.evaluate(() => performance.getEntriesByType('navigation').length), navigationCount, 'language switching must not reload the game');
    assert.strictEqual(await page.evaluate((key) => localStorage.getItem(key), RUN_KEY), null, 'language switching must not create or mutate run state');
    assert.deepStrictEqual(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SETTINGS_KEY),
      { music: 33, sfx: 80, reducedMotion: false, language: 'en' },
      'language must persist alongside existing audio settings'
    );
    await languageModal.locator('[data-close-modal].reboot-language-back').click();
    await menu.locator('[data-settings]').click();
    const openSettings = page.locator('[data-settings-modal]:not([hidden])');
    await openSettings.waitFor();
    assert.strictEqual(await openSettings.locator('#settings-title').textContent(), 'Settings');
    assert.deepStrictEqual(await openSettings.locator('.reboot-setting > span').allTextContents(), ['Music', 'Sound', 'Reduce motion']);
    await openSettings.locator('[data-close-modal]').click();

    await page.reload({ waitUntil: 'networkidle' });
    await menu.waitFor();
    assert.strictEqual(await page.getAttribute('html', 'lang'), 'en', 'language must survive page reload');
    assert.strictEqual(await menu.locator('[data-new-game]').textContent(), 'New Game', 'persisted language must localize the menu on boot');
    assert.strictEqual(await page.locator('[data-music-volume]').inputValue(), '33', 'language reload must preserve audio settings');

    await menu.locator('[data-new-game]').click();
    const identityModal = page.locator('[data-player-identity-modal]:not([hidden])');
    await identityModal.waitFor();
    await identityModal.locator('[data-player-identity-input]').fill('Browser Tester');
    assert.strictEqual(await identityModal.locator('[data-player-identity-submit]').isDisabled(), false, 'valid player name must enable New Run confirmation');
    await identityModal.locator('[data-player-identity-submit]').click();
    const rosterScreen = page.locator('[data-roster-screen]:not([hidden])');
    await rosterScreen.waitFor();
    assert.strictEqual(await menu.isHidden(), true, 'confirmed New Game identity must replace the main menu with the Roster scene');
    assert.strictEqual(await page.locator('[data-travel-choice-screen]').isHidden(), true, 'Travel Choice must wait for Start Journey');
    assert.strictEqual(await page.locator('[data-settlement-screen]').isHidden(), true, 'Settlement must wait for a safe route choice');
    assert.strictEqual(await page.locator('[data-skirmish-screen]').isHidden(), true, 'Skirmish must wait for a route choice');
    assert.strictEqual(await page.locator('[data-classic-screen]').isHidden(), true, 'Classic Chess must not open before an encounter exists');
    assert.strictEqual(await page.locator('[data-game-setup-modal]').isHidden(), true, 'standalone Chess setup must not open from product New Game');
    assert.strictEqual(await page.locator('[data-roster-card]').count(), 6, 'New Game must create the approved starter roster');
    assert.strictEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key))?.playerName, RUN_KEY), 'Browser Tester', 'Player Identity must persist into the new run');

    await page.locator('[data-roster-menu]').click();
    await menu.waitFor({ state: 'visible' });
    assert.strictEqual(await menu.locator('[data-continue-run]').isDisabled(), false, 'Continue must enable after a run is created');

    await menu.locator('[data-continue-run]').click();
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    await page.locator('[data-roster-travel]').click();
    const travelScreen = page.locator('[data-travel-choice-screen]:not([hidden])');
    await travelScreen.waitFor();
    assert.strictEqual(await menu.isHidden(), true, 'Start Journey must not flash or fall back to the main menu');
    assert.strictEqual(await page.locator('[data-travel-choice]').count(), 3, 'Start Journey must render the three Travel Choice cards');

    const travelStyle = await page.evaluate(() => {
      const cssLink = document.querySelector('link[data-travel-choice-css]');
      const routes = document.querySelector('.travel-choice-routes');
      const card = document.querySelector('[data-travel-choice]');
      const cardBody = card?.querySelector('.travel-choice-card__body');
      const screen = document.querySelector('[data-travel-choice-screen]');
      const routeStyle = routes ? getComputedStyle(routes) : null;
      const cardStyle = card ? getComputedStyle(card) : null;
      const bodyStyle = cardBody ? getComputedStyle(cardBody) : null;
      const screenStyle = screen ? getComputedStyle(screen) : null;
      return {
        cssHref: cssLink?.getAttribute('href') || '',
        routesDisplay: routeStyle?.display || '',
        routesColumns: routeStyle?.gridTemplateColumns || '',
        cardDisplay: cardStyle?.display || '',
        cardMinHeight: Number.parseFloat(cardStyle?.minHeight || '0'),
        cardBodyHeight: Number.parseFloat(bodyStyle?.height || '0'),
        screenHeight: screen?.getBoundingClientRect().height || 0,
        viewportHeight: window.innerHeight,
        screenBackground: screenStyle?.backgroundImage || ''
      };
    });
    assert(travelStyle.cssHref.includes('css/travel-choice.css'), `Travel stylesheet link missing: ${travelStyle.cssHref}`);
    assert.strictEqual(travelStyle.routesDisplay, 'grid', `Travel routes must render as grid, got ${travelStyle.routesDisplay}`);
    assert(travelStyle.routesColumns.split(' ').length >= 3, `desktop Travel must expose three grid columns, got ${travelStyle.routesColumns}`);
    assert.strictEqual(travelStyle.cardDisplay, 'grid', `compact desktop Travel cards must use the final grid contract, got ${travelStyle.cardDisplay}`);
    assert(travelStyle.cardMinHeight <= 1, `compact Travel cards must not retain the obsolete 500px minimum, got ${travelStyle.cardMinHeight}`);
    assert(travelStyle.cardBodyHeight >= 70 && travelStyle.cardBodyHeight <= 78, `compact Travel copy row must stay near the approved 74px height, got ${travelStyle.cardBodyHeight}`);
    assert(travelStyle.screenHeight <= travelStyle.viewportHeight + 1, `desktop Travel must fit the viewport, got ${travelStyle.screenHeight}/${travelStyle.viewportHeight}`);
    assert(travelStyle.screenBackground && travelStyle.screenBackground !== 'none', 'Travel screen fantasy background styling must be applied');

    const mobile = await browser.newPage({ viewport: { width: 390, height: 500 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await mobile.goto(url, { waitUntil: 'networkidle' });
    const scrollContract = await mobile.evaluate(() => ({
      htmlOverflow: getComputedStyle(document.documentElement).overflowY,
      bodyOverflow: getComputedStyle(document.body).overflowY,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight
    }));
    assert(['auto', 'scroll'].includes(scrollContract.htmlOverflow), `html overflowY=${scrollContract.htmlOverflow}`);
    assert(['auto', 'scroll'].includes(scrollContract.bodyOverflow), `body overflowY=${scrollContract.bodyOverflow}`);
    assert(scrollContract.scrollHeight > scrollContract.clientHeight, 'small viewport must create a scrollable page');
    await mobile.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await mobile.waitForTimeout(80);
    assert((await mobile.evaluate(() => window.scrollY)) > 0, 'page must actually scroll vertically');

    assert.deepStrictEqual(errors, [], `desktop browser errors:\n${errors.join('\n')}`);
    assert.deepStrictEqual(mobileErrors, [], `mobile browser errors:\n${mobileErrors.join('\n')}`);
    console.log('Reboot Foundation identity -> Roster -> compact Start Journey Travel Choice Chromium acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
