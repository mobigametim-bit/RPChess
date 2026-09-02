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
    await page.locator('[data-skirmish-screen]:not([hidden])').waitFor();
    const acknowledged = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(acknowledged.activeTravelChoice.starvationAcknowledged, true, 'ordinary casualty must be acknowledged exactly once');
    assert.strictEqual(acknowledged.roster.filter((character) => character.status === 'dead').length, 1);
    assert.strictEqual(await page.locator('[data-skirmish-back]').count(), 0, 'obsolete Skirmish back control must stay absent after Starvation routing');

    await startFresh(page);
    await seedZeroSupplyTravel(page, { kingOnly: true });
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice="manual.starvation.skirmish"]').click();
    await page.locator('[data-starvation-screen]:not([hidden])').waitFor();
    assert.strictEqual((await page.locator('[data-starvation-title]').innerText()).trim(), 'КОРОЛЬ ПОГИБ ОТ ГОЛОДА');
    const kingState = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(kingState.ended, true, 'King starvation casualty must end the run immediately');
    assert.strictEqual(kingState.endReason, 'starvation_king');
    assert.strictEqual(kingState.roster.find((character) => character.isRunKing).status, 'dead');
    assert.strictEqual(await page.locator('[data-skirmish-screen]:not([hidden])').count(), 0, 'King death must prevent the selected encounter from starting');
    await page.locator('[data-starvation-continue]').click();
    await page.locator('[data-reboot-foundation]:not([hidden])').waitFor();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await startFresh(mobile);
    await seedZeroSupplyTravel(mobile);
    await mobile.locator('[data-roster-travel]').click();
    await mobile.locator('[data-travel-choice="manual.starvation.skirmish"]').click();
    await mobile.locator('[data-starvation-screen]:not([hidden])').waitFor();
    const layout = await mobile.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    assert(layout.scrollWidth <= layout.clientWidth + 1, `Starvation mobile screen must not create horizontal overflow: ${layout.scrollWidth}/${layout.clientWidth}`);
    const panel = await mobile.locator('.starvation-panel').boundingBox();
    assert(panel && panel.x >= -1 && panel.x + panel.width <= 391, `Starvation panel must fit mobile viewport: ${JSON.stringify(panel)}`);

    assert.deepStrictEqual(errors, [], `desktop Starvation page errors:\n${errors.join('\n')}`);
    assert.deepStrictEqual(mobileErrors, [], `mobile Starvation page errors:\n${mobileErrors.join('\n')}`);
    console.log('Starvation compact warning, deterministic casualty, removed legacy back dependency, reload idempotency, encounter gate, King run-end and mobile Chromium acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
