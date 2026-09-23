const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');
const { assertPageFitsViewport, assertViewportContained } = require('./helpers/viewport-geometry-contract.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const runKey = 'rpchess.reboot.v1.run';
const viewports = [[1180, 820], [1024, 768], [980, 520], [844, 390], [667, 375]];

async function showOffers(page, kind) {
  await page.evaluate(async ({ key, kind }) => {
    const { showCaravanRewards } = await import('./js/caravan-reward-ui.mjs');
    const { RECRUIT_LIBRARY } = await import('./js/settlement-core.mjs');
    const { ARTIFACTS } = await import('./js/artifact-core.mjs');
    const run = JSON.parse(localStorage.getItem(key));
    const healed = run.roster.find(hero => !hero.isRunKing);
    const recruit = RECRUIT_LIBRARY.find(hero => !run.roster.some(member => member.id === hero.id));
    const artifact = ARTIFACTS[0];
    const offers = kind === 'heroes'
      ? [{ id:'audit:healing',kind:'healing',heroId:healed.id },
        { id:'audit:hero',kind:'hero',heroId:recruit.id },
        { id:'audit:artifact',kind:'artifact',artifactId:artifact.id,amount:3 }]
      : [{ id:'audit:gold',kind:'gold',amount:120 },
        { id:'audit:supplies',kind:'supplies',amount:12 },
        { id:'audit:artifact',kind:'artifact',artifactId:artifact.id,amount:3 }];
    showCaravanRewards({ ...run,currentCaravan:{ ...run.currentCaravan,offers } }, () => false);
  }, { key:runKey,kind });
  await page.locator('[data-caravan-rewards]').waitFor();
}

async function checkOffers(page, label, language, kind) {
  await assertPageFitsViewport(page, `${label} ${kind}`);
  await assertViewportContained(page, '.caravan-reward-panel', `${label} ${kind} panel`);
  const geometry = await page.evaluate(() => {
    const panel = document.querySelector('.caravan-reward-panel');
    const cards = [...panel.querySelectorAll('[data-caravan-reward]')];
    const bounds = element => {
      const rect = element.getBoundingClientRect();
      return { left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom };
    };
    return { panel:bounds(panel),scrollHeight:panel.scrollHeight,clientHeight:panel.clientHeight,
      title:panel.querySelector('h2').textContent,hint:panel.querySelector('p').textContent,
      cards:cards.map(card => ({ id:card.dataset.caravanReward,name:card.querySelector('strong').textContent,
        card:bounds(card),text:bounds(card.querySelector('strong')),
        images:card.querySelectorAll('img').length,glyph:card.querySelector('.caravan-reward-card__glyph')?.textContent,
        portrait:card.querySelector('.caravan-reward-card__portrait') ? bounds(card.querySelector('.caravan-reward-card__portrait')) : null,
        glyphBounds:card.querySelector('.caravan-reward-card__glyph') ? bounds(card.querySelector('.caravan-reward-card__glyph')) : null })) };
  });
  assert.equal(geometry.cards.length,3,`${label}: exactly three offers`);
  assert(geometry.scrollHeight <= geometry.clientHeight + 1,`${label}: reward panel must fit without scrolling: ${JSON.stringify(geometry)}`);
  assert.equal(geometry.title,language === 'ru' ? 'Выберите награду' : 'Choose your reward');
  assert.equal(geometry.hint,language === 'ru' ? 'Караван спасён. Заберите один из трёх подарков.' : 'The caravan is safe. Claim one of three gifts.');
  for (const entry of geometry.cards) {
    assert(entry.card.left >= geometry.panel.left - 1 && entry.card.right <= geometry.panel.right + 1 &&
      entry.card.top >= geometry.panel.top - 1 && entry.card.bottom <= geometry.panel.bottom + 1,
      `${label}: offer ${entry.id} escapes panel: ${JSON.stringify(geometry)}`);
    assert(entry.text.left >= entry.card.left - 1 && entry.text.right <= entry.card.right + 1 &&
      entry.text.top >= entry.card.top - 1 && entry.text.bottom <= entry.card.bottom + 1,
      `${label}: name ${entry.id} does not fit its card: ${JSON.stringify(geometry)}`);
    assert.equal(entry.images,1,`${label}: one image per reward`);
    assert(entry.name && !/\[missing:|\{\w+\}/.test(entry.name),`${label}: untranslated reward: ${entry.name}`);
    if (language === 'en') assert(!/[А-ЯЁа-яё]/.test(entry.name),`${label}: Cyrillic in English offer: ${entry.name}`);
    if (kind === 'heroes' && /audit:(healing|hero)/.test(entry.id)) {
      assert(entry.glyph,`${label}: hero portrait needs a piece glyph`);
      assert(entry.glyphBounds.left >= entry.portrait.left && entry.glyphBounds.left <= entry.portrait.left + 5 &&
        entry.glyphBounds.bottom <= entry.portrait.bottom && entry.glyphBounds.bottom >= entry.portrait.bottom - 5,
        `${label}: piece glyph belongs in bottom-left of portrait: ${JSON.stringify(entry)}`);
    }
  }
}

async function audit(browser,language) {
  const page = await browser.newPage({ viewport:{width:1024,height:768} });
  const errors = [];
  page.on('pageerror',error => errors.push(String(error.stack || error)));
  try {
    await page.goto(url,{ waitUntil:'networkidle' });
    await page.evaluate(({ language,key }) => { localStorage.removeItem(key); globalThis.RPChessI18n.setLanguage(language); },{ language,key:runKey });
    await startNewRun(page);
    await page.evaluate(async key => {
      const { createTravelChoices } = await import('./js/travel-choice-core.mjs');
      const run = JSON.parse(localStorage.getItem(key));
      run.currentTravelChoices = createTravelChoices({ runId:run.id,types:['caravan'],step:1 });
      run.activeTravelChoice = null;
      localStorage.setItem(key,JSON.stringify(run));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
    },runKey);
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-type="caravan"]').first().click();
    await page.locator('[data-battle-screen]:not([hidden])').waitFor();
    assert.equal(await page.locator('[data-battle-title]').innerText(),language === 'ru' ? 'Защита каравана' : 'Defend the caravan');
    for (const [width,height] of [[1024,768],[844,390]]) {
      await page.setViewportSize({ width,height });
      await assertPageFitsViewport(page,`${language} ${width}x${height} Caravan preparation`);
      await assertViewportContained(page,'[data-battle-start]',`${language} Caravan Start`);
    }
    await page.locator('[data-battle-start]').click();
    await page.locator('[data-artifact-choice="none"]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    await assertPageFitsViewport(page,`${language} Caravan combat`);
    assert.equal(await page.locator('.classic-party-panel h2').innerText(),language === 'ru' ? 'Защита каравана' : 'Defend the caravan');
    await page.evaluate(() => {
      const plan = globalThis.RPChessBattle.battlePlan;
      globalThis.RPChessBattle.finishBattle({ over:true,type:'checkmate',winner:plan.playerColor });
    });
    await page.locator('[data-caravan-rewards]').waitFor();
    for (const kind of ['heroes','resources']) {
      await showOffers(page,kind);
      for (const [width,height] of viewports) {
        await page.setViewportSize({ width,height });
        await checkOffers(page,`${language} ${width}x${height}`,language,kind);
      }
    }
    assert.deepEqual(errors,[],`${language}: browser errors`);
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch({ headless:true });
  try { for (const language of ['ru','en']) await audit(browser,language); }
  finally { await browser.close(); }
  console.log('Caravan RU/EN reward localization and tablet/mobile geometry: PASS');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
