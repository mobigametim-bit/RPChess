const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const game = path.join(root, 'game');

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

(async () => {
  const starvation = await import(pathToFileURL(path.join(game, 'js/starvation-core.mjs')).href);
  const travel = await import(pathToFileURL(path.join(game, 'js/travel-choice-core.mjs')).href);
  const persistence = await import(pathToFileURL(path.join(game, 'js/run-persistence.mjs')).href);

  const choice = {
    id: 'travel.1.starvation-test',
    step: 1,
    type: 'skirmish',
    label: 'СТЫЧКА',
    stars: 1,
    threatLabel: 'НИЗКАЯ',
    flavor: 'Путь без припасов.',
    mechanicalHint: 'Нестандартный состав противника.',
    seed: 'starvation-test-seed',
    supplyCostAtSelection: 1,
    supplyPaid: 0
  };

  const candidates = starvation.livingStarvationCandidates([
    { id: 'dead', status: 'dead' },
    { id: 'wounded', status: 'wounded' },
    { id: 'healthy', status: 'healthy' }
  ]);
  assert.deepStrictEqual(candidates.map((item) => item.id), ['wounded', 'healthy'], 'wounded and healthy characters are both valid starvation victims');

  const simpleRun = {
    id: 'simple-starvation',
    roster: [
      { id: 'king', name: 'King', status: 'healthy', isRunKing: true },
      { id: 'wounded', name: 'Wounded', status: 'wounded', isRunKing: false },
      { id: 'healthy', name: 'Healthy', status: 'healthy', isRunKing: false }
    ],
    activeTravelChoice: choice,
    ended: false,
    endReason: null
  };
  const selectedA = starvation.deterministicStarvationVictim(simpleRun, choice);
  const selectedB = starvation.deterministicStarvationVictim(simpleRun, choice);
  assert(selectedA && selectedA.id === selectedB.id, 'same run/route must always select the same starvation victim');

  const resolved = starvation.resolveStarvation(simpleRun, choice);
  assert.strictEqual(resolved.triggered, true, 'zero-supply committed travel must trigger Starvation');
  assert(resolved.choice.starvationVictimId, 'resolved route must persist the victim id');
  assert.strictEqual(resolved.choice.starvationAcknowledged, false);
  assert.strictEqual(resolved.run.roster.filter((character) => character.status === 'dead').length, 1, 'exactly one living character dies');
  assert.strictEqual(starvation.hasPendingStarvation(resolved.run), true, 'new casualty must require acknowledgement');

  const repeated = starvation.resolveStarvation(resolved.run, resolved.choice);
  assert.strictEqual(repeated.triggered, false, 'resolved route must be idempotent');
  assert.strictEqual(repeated.choice.starvationVictimId, resolved.choice.starvationVictimId, 'reload/retry must never reroll the victim');
  assert.strictEqual(repeated.run.roster.filter((character) => character.status === 'dead').length, 1, 'reload/retry must not kill a second character');

  if (!resolved.choice.starvationKingDied) {
    const acknowledged = starvation.acknowledgeStarvation(resolved.run);
    assert.strictEqual(acknowledged.activeTravelChoice.starvationAcknowledged, true, 'ordinary casualty can be acknowledged before the encounter starts');
    assert.strictEqual(starvation.hasPendingStarvation(acknowledged), false);
  }

  const kingOnlyRun = {
    id: 'king-only-starvation',
    roster: [
      { id: 'king', name: 'King', status: 'healthy', isRunKing: true },
      { id: 'fallen', name: 'Fallen', status: 'dead', isRunKing: false }
    ],
    activeTravelChoice: choice,
    ended: false,
    endReason: null
  };
  const kingDeath = starvation.resolveStarvation(kingOnlyRun, choice);
  assert.strictEqual(kingDeath.choice.starvationKingDied, true, 'King participates in the same victim pool');
  assert.strictEqual(kingDeath.run.ended, true, 'King starvation death must end the run immediately');
  assert.strictEqual(kingDeath.run.endReason, 'starvation_king');
  assert.strictEqual(kingDeath.run.roster[0].status, 'dead');
  assert.strictEqual(starvation.acknowledgeStarvation(kingDeath.run), kingDeath.run, 'King death cannot be acknowledged into an encounter');

  const paidChoice = { ...choice, supplyPaid: 1 };
  const paid = starvation.resolveStarvation(simpleRun, paidChoice);
  assert.strictEqual(paid.triggered, false, 'paid travel must never trigger Starvation');
  assert.strictEqual(paid.run, simpleRun);

  const storage = new MemoryStorage();
  const persistentRun = persistence.createRun({ now: 1000, id: 'persistent-starvation' });
  const persistentChoice = {
    ...travel.createTravelChoices({ runId: persistentRun.id, step: 1 })[0],
    supplyCostAtSelection: 1,
    supplyPaid: 0
  };
  const persistentResolved = starvation.resolveStarvation({
    ...persistentRun,
    supplies: 0,
    journeyStep: 1,
    currentTravelChoices: null,
    activeTravelChoice: persistentChoice
  }, persistentChoice);
  persistence.writeRun(persistentResolved.run, storage, 2000);
  const reloaded = persistence.readRun(storage);
  assert(reloaded, 'Starvation state must survive run validation and reload');
  assert.strictEqual(reloaded.activeTravelChoice.starvationVictimId, persistentResolved.choice.starvationVictimId, 'victim id must persist through reload');
  assert.strictEqual(reloaded.roster.filter((character) => character.status === 'dead').length, 1, 'exactly one casualty must persist through reload');

  const travelSource = fs.readFileSync(path.join(game, 'js/travel-choice-app.mjs'), 'utf8');
  const appSource = fs.readFileSync(path.join(game, 'js/starvation-app.mjs'), 'utf8');
  const css = fs.readFileSync(path.join(game, 'css/starvation.css'), 'utf8');
  assert(travelSource.includes('СЛУЧАЙНЫЙ БОЕЦ ПОГИБНЕТ'), 'Travel cards must warn about the casualty before commitment');
  assert(travelSource.includes('resolveStarvation'), 'Travel must resolve Starvation atomically with route commitment');
  assert(appSource.includes('КОРОЛЬ ПОГИБ ОТ ГОЛОДА'), 'King starvation run-end copy missing');
  assert(appSource.includes('dataset.starvationScreen'), 'Starvation consequence screen contract missing');
  assert(!css.includes('ui_panel_frame.png') && !css.includes('ui_panel_wide.png'), 'Starvation UI must remain frameless CSS-only');

  console.log('Starvation deterministic casualty, idempotency, King death, persistence and frameless UX contract: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
