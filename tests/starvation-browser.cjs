const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nonKingRunId(choiceId = 'manual.starvation.skirmish') {
  for (let index = 1; index < 500; index += 1) {
    const id = `starvation-browser-${index}`;
    const sortedIds = ['hero.aldric_wall', 'hero.brother_orell', 'hero.mara_chain', 'hero.nemea_quill', 'hero.vael_hammer', 'king.oathkeeper'];
    const victim = sortedIds[hashString(`${id}:${choiceId}:1:starvation`) % sortedIds.length];
    if (victim !== 'king.oathkeeper') return id;
  }
  throw new Error('could not find deterministic non-King starvation seed');
}

function manualChoices() {
  return [
    { id: 'manual.starvation.skirmish', step: 1, type: 'skirmish', label: 'СТЫЧКА', stars: 1, threatLabel: 'НИЗКАЯ', flavor: 'Пустая дорога.', mechanicalHint: 'Нестандартный состав противника.', seed: 'manual-starvation-1' },
    { id: 'manual.starvation.battle', step: 1, type: 'battle', label: 'БИТВА', stars: 2, threatLabel: 'УМЕРЕННАЯ', flavor: 'Армия впереди.', mechanicalHint: 'Полная армия противника.', seed: 'manual-starvation-2' },
    { id: 'manual.starvation.settlement', step: 1, type: 'settlement', label: 'ПОСЕЛЕНИЕ', stars: 1, threatLabel: 'НИЗКАЯ', flavor: 'Огни поселения.', mechanicalHint: 'Место для передышки и подготовки.', seed: 'manual-starvation-3' }
  ];
}

async function startFresh(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await startNewRun(page);
}

async function seedZeroSupplyTravel(page, { kingOnly = false } = {}) {
  const runId = kingOnly ? 'starvation-browser-king-only' : nonKingRunId();
  await page.evaluate(({ key, runId, choices, kingOnly }) => {
    const run = JSON.parse(localStorage.getItem(key));
    run.id = runId;
    run.supplies = 0;
    run.journeyStep = 0;
    run.currentTravelChoices = choices;
    run.activeTravelChoice = null;
    run.ended = false;
    run.endReason = null;
    if (kingOnly) {
      run.roster = run.roster.map((character) => ({
        ...character,
        status: character.isRunKing ? 'healthy' : 'dead'
      }));
    } else {
      run.roster = run.roster.map((character) => ({ ...character, status: 'healthy' }));
    }
    localStorage.setItem(key, JSON.stringify(run));
    globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, { key: RUN_KEY, runId, choices: manualChoices(), kingOnly });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));

    await startFresh(page);
    await seedZeroSupplyTravel(page);
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    assert.strictEqual(await page.locator('.travel-choice-card__cost.is-empty').count(), 3, 'all zero-Supply route cards must expose the starvation state');
    for (const warning of await page.locator('.travel-choice-card__cost.is-empty').evaluateAll((nodes) => nodes.map((node) => ({
      amount: node.querySelector('.travel-choice-card__cost-amount')?.textContent?.trim() || '',
      aria: node.getAttribute('aria-label') || '',
      title: node.getAttribute('title') || ''
    })))) {
      assert.strictEqual(warning.amount, '-1');
      assert(warning.aria.includes('Припасов нет — при переходе сработает голод.'), `missing accessible starvation warning: ${warning.aria}`);
      assert.strictEqual(warning.title, warning.aria, 'compact starvation tooltip and aria warning must stay synchronized');
    }

    await page.locator('[data-travel-choice="manual.starvation.skirmish"]').click();
    await page.locator('[data-starvation-screen]:not([hidden])').waitFor();
    const casualty = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    // Both Starvation variants must use a combat-aftermath-sized card, never a
    // 580px minimum that forces the entire screen outside shorter viewports.
    const desktopCard=await page.evaluate(()=>{
      const card=document.querySelector('.starvation-panel');
      const r=card.getBoundingClientRect();
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,
        viewportWidth:innerWidth,viewportHeight:innerHeight,scrollable:getComputedStyle(card).overflowY};
    });
    assert.strictEqual(await page.locator('[data-starvation-screen] .starvation-logo').count(),0,'Starvation hero and King death must not render a corner logo');
    assert(Math.abs((desktopCard.left+desktopCard.right)/2-desktopCard.viewportWidth/2)<=2 &&
      Math.abs((desktopCard.top+desktopCard.bottom)/2-desktopCard.viewportHeight/2)<=2,
      `desktop Starvation death panel must center on the entire viewport: ${JSON.stringify(desktopCard)}`);
    assert(desktopCard.width<=1161,`desktop Starvation must be no wider than Battle aftermath: ${JSON.stringify(desktopCard)}`);
    assert(desktopCard.left>=-1&&desktopCard.right<=desktopCard.viewportWidth+1&&desktopCard.top>=-1&&desktopCard.bottom<=desktopCard.viewportHeight+1,
      `desktop Starvation card must stay inside viewport: ${JSON.stringify(desktopCard)}`);
    await page.setViewportSize({width:1280,height:720});
    const shorter=await page.locator('.starvation-panel').evaluate(node=>{
      const r=node.getBoundingClientRect();return {height:r.height,width:r.width,top:r.top,bottom:r.bottom,viewport:innerHeight,
        scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,overflowY:getComputedStyle(node).overflowY};
    });
    const shorterHorizontalCenter=await page.locator('.starvation-panel').evaluate(node=>{
      const r=node.getBoundingClientRect();return (r.left+r.right)/2-innerWidth/2;
    });
    assert(Math.abs(shorterHorizontalCenter)<=2,'720px Starvation card must be horizontally centered');
    assert(shorter.width<=1161&&shorter.height<=shorter.viewport&&shorter.top>=-1&&shorter.bottom<=shorter.viewport+1,
      `720px landscape Starvation card must be contained like aftermath: ${JSON.stringify(shorter)}`);
    if(shorter.scrollHeight>shorter.clientHeight+1)assert(['auto','scroll'].includes(shorter.overflowY),
      'desktop Starvation tall content must scroll inside its bounded panel');
    await page.setViewportSize({width:1440,height:900});
    assert.strictEqual(casualty.supplies, 0, 'Starvation travel must never make Supplies negative');
    assert.strictEqual(casualty.activeTravelChoice.supplyPaid, 0);
    assert(casualty.activeTravelChoice.starvationVictimId, 'committed route must persist the starvation victim');
    assert.strictEqual(casualty.activeTravelChoice.starvationKingDied, false, 'desktop ordinary flow seed must select a non-King casualty');
    assert.strictEqual(casualty.activeTravelChoice.starvationAcknowledged, false);
    assert.strictEqual(casualty.roster.filter((character) => character.status === 'dead').length, 1, 'exactly one casualty must be persisted');
    const victimId = casualty.activeTravelChoice.starvationVictimId;
    const victim = casualty.roster.find((character) => character.id === victimId);
    assert(victim && victim.status === 'dead');
    assert((await page.locator('[data-starvation-name]').innerText()).includes(victim.name));
    assert.strictEqual(await page.locator('[data-skirmish-screen]:not([hidden])').count(), 0, 'encounter must not start before Starvation acknowledgement');

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-continue-run]').click();
    await page.locator('[data-roster-screen]:not([hidden])').waitFor();
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-starvation-screen]:not([hidden])').waitFor();
    const reloaded = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(reloaded.activeTravelChoice.starvationVictimId, victimId, 'reload must preserve the same victim');
    assert.strictEqual(reloaded.roster.filter((character) => character.status === 'dead').length, 1, 'reload must not kill a second character');

    await page.locator('[data-starvation-continue]').click();
    await page.locator('[data-artifact-choice-modal]').waitFor();
    const acknowledged = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(acknowledged.activeTravelChoice.starvationAcknowledged, true, 'ordinary casualty must be acknowledged exactly once');
    assert.strictEqual(acknowledged.roster.filter((character) => character.status === 'dead').length, 1);
    assert.strictEqual(await page.locator('[data-skirmish-back]').count(), 0, 'obsolete Skirmish back control must stay absent after Starvation routing');

    await startFresh(page);
    await seedZeroSupplyTravel(page, { kingOnly: true });
    await page.locator('[data-roster-travel]').click();
    assert.strictEqual(await page.locator('[data-travel-choice="manual.starvation.skirmish"]').isDisabled(), true, 'King-only run must respect canonical Skirmish companion gating');
    await page.locator('[data-travel-choice="manual.starvation.battle"]').click();
    await page.locator('[data-starvation-screen]:not([hidden])').waitFor();
    assert.strictEqual((await page.locator('[data-starvation-title]').innerText()).trim(), 'КОРОЛЬ ПОГИБ ОТ ГОЛОДА');
    const kingCard=await page.locator('.starvation-panel').evaluate(node=>{
      const r=node.getBoundingClientRect();return{width:r.width,top:r.top,bottom:r.bottom,viewport:innerHeight};
    });
    const kingMid=await page.locator('.starvation-panel').evaluate(node=>{
      const r=node.getBoundingClientRect();return {x:(r.left+r.right)/2-innerWidth/2,y:(r.top+r.bottom)/2-innerHeight/2};
    });
    assert(Math.abs(kingMid.x)<=2&&Math.abs(kingMid.y)<=2,
      `King starvation panel must be centered with the logo removed: ${JSON.stringify(kingMid)}`);
    assert(kingCard.width<=1161&&kingCard.top>=-1&&kingCard.bottom<=kingCard.viewport+1,
      `king-death Starvation card must fit combat aftermath bounds: ${JSON.stringify(kingCard)}`);
    const kingState = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(kingState.ended, true, 'King starvation casualty must end the run immediately');
    assert.strictEqual(kingState.endReason, 'starvation_king');
    assert.strictEqual(kingState.roster.find((character) => character.isRunKing).status, 'dead');
    assert.strictEqual(await page.locator('[data-battle-screen]:not([hidden])').count(), 0, 'King death must prevent the selected Battle from starting');
    await page.locator('[data-starvation-continue]').click();
    await page.locator('[data-endless-run-screen]:not([hidden])').waitFor();
    assert((await page.locator('[data-endless-run-reason]').innerText()).includes('без припасов'), 'King starvation summary must expose the canonical no-supplies reason');
    assert.strictEqual(await page.locator('[data-reboot-foundation]:not([hidden])').count(), 0, 'run summary must appear before returning to the main menu');
    await page.locator('[data-endless-run-menu]').click();
    await page.locator('[data-reboot-foundation]:not([hidden])').waitFor();

    const mobile = await browser.newPage({ viewport: { width: 844, height: 390 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await startFresh(mobile);
    await seedZeroSupplyTravel(mobile);
    await mobile.locator('[data-roster-travel]').click();
    await mobile.locator('[data-travel-choice="manual.starvation.skirmish"]').click();
    await mobile.locator('[data-starvation-screen]:not([hidden])').waitFor();
    const layout = await mobile.evaluate(() => {
      const screen = document.querySelector('[data-starvation-screen]')?.getBoundingClientRect();
      const panel = document.querySelector('.starvation-panel');
      const panelRect = panel?.getBoundingClientRect();
      return {
        scrollWidth:document.documentElement.scrollWidth,
        clientWidth:document.documentElement.clientWidth,
        scrollHeight:document.documentElement.scrollHeight,
        clientHeight:document.documentElement.clientHeight,
        screen:screen ? { left:screen.left,right:screen.right,top:screen.top,bottom:screen.bottom } : null,
        panel:panelRect ? { left:panelRect.left,right:panelRect.right,top:panelRect.top,bottom:panelRect.bottom } : null,
        panelScrollHeight:panel?.scrollHeight || 0,
        panelClientHeight:panel?.clientHeight || 0,
        panelOverflowY:panel ? getComputedStyle(panel).overflowY : ''
      };
    });
    assert(layout.scrollWidth <= layout.clientWidth + 1, `Starvation landscape-mobile screen must not create horizontal overflow: ${layout.scrollWidth}/${layout.clientWidth}`);
    assert(layout.scrollHeight <= layout.clientHeight + 1, `Starvation landscape-mobile screen must not page-scroll: ${layout.scrollHeight}/${layout.clientHeight}`);
    const insideViewport = (box) => box && box.left >= -1 && box.right <= layout.clientWidth + 1 && box.top >= -1 && box.bottom <= layout.clientHeight + 1;
    assert(insideViewport(layout.screen), 'Starvation screen must fit the viewport');
    assert(insideViewport(layout.panel), 'Starvation panel must fit the viewport');
    assert(Math.abs((layout.panel.left+layout.panel.right)/2-layout.clientWidth/2)<=2 &&
      Math.abs((layout.panel.top+layout.panel.bottom)/2-layout.clientHeight/2)<=2,
      'Starvation mobile outcome panel must be centered horizontally and vertically');
    assert(layout.panel.right-layout.panel.left<=Math.min(780,layout.clientWidth*.96)+2,
      'landscape mobile Starvation card must be no wider than compact combat aftermath');
    const action=await mobile.locator('[data-starvation-continue]').boundingBox();
    assert(action&&action.y>=layout.panel.top-1&&action.y+action.height<=layout.panel.bottom+1,
      'Starvation Continue must remain visible within the bounded panel');
    await mobile.setViewportSize({width:667,height:300});
    const narrow=await mobile.evaluate(()=>{
      const panel=document.querySelector('.starvation-panel')?.getBoundingClientRect(),
        root=document.querySelector('[data-starvation-screen]')?.getBoundingClientRect();
      return {viewportWidth:innerWidth,viewportHeight:innerHeight,scrollWidth:document.documentElement.scrollWidth,
        scrollHeight:document.documentElement.scrollHeight,
        panel:panel?{left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom}:null,
        root:root?{left:root.left,right:root.right,top:root.top,bottom:root.bottom}:null};
    });
    assert(narrow.panel&&narrow.panel.left>=-1&&narrow.panel.right<=narrow.viewportWidth+1&&
      narrow.panel.top>=-1&&narrow.panel.bottom<=narrow.viewportHeight+1,
      `667x300 Starvation must stay inside compact aftermath bounds: ${JSON.stringify(narrow)}`);
    assert(narrow.scrollWidth<=narrow.viewportWidth+1&&narrow.scrollHeight<=narrow.viewportHeight+1,
      `667x300 Starvation must not scroll the document: ${JSON.stringify(narrow)}`);
    if (layout.panelScrollHeight > layout.panelClientHeight + 1) assert(['auto','scroll'].includes(layout.panelOverflowY), 'overflowing Starvation content must scroll inside the panel');

    assert.deepStrictEqual(errors, [], `desktop Starvation page errors:\n${errors.join('\n')}`);
    assert.deepStrictEqual(mobileErrors, [], `landscape-mobile Starvation page errors:\n${mobileErrors.join('\n')}`);
    console.log('Starvation compact warning, deterministic casualty, canonical Skirmish gating, reload idempotency, encounter gate, King run summary and landscape-mobile Chromium acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
