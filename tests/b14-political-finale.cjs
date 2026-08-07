'use strict';

const assert = require('assert');
const b14 = require('../src/runtime/political-finale-b14.cjs');

function narrative(...ids) {
  return {
    format: 'rpchess-production-narrative',
    schemaVersion: 1,
    currentFacts: Object.freeze(Object.fromEntries(ids.map((id, index) => [`fact:${index}`, Object.freeze({ id })]))),
    decisionHistory: Object.freeze([]),
    regionalLines: Object.freeze({ iron_and_bread: 'favorable', honor_of_the_marches: 'favorable' }),
    finale: null
  };
}

(function main() {
  const source = narrative(
    'story.iron_marches.strike_compromise',
    'obligation.iron_marches.standard_ratified',
    'politics.iron_marches.garrison_united',
    'obligation.iron_marches.emergency_term'
  );
  let finale = b14.createPoliticalFinale({ seed: 9042, narrative: source, regionalLines: source.regionalLines });
  assert.strictEqual(finale.format, b14.B14_FORMAT);
  assert.strictEqual(finale.stage, 'cabinet');

  // Resolve every crisis if present, otherwise confirm the cabinet.
  while (finale.stage === 'cabinet') {
    const choices = b14.cabinetChoices(finale, { gold: 100, supplies: 10 });
    const selected = choices.find((choice) => choice.id.startsWith('cabinet_accept:')) || choices[0];
    const resolved = b14.resolveCabinet(finale, selected.id, { gold: 100, supplies: 10 });
    finale = resolved.finale;
  }

  assert.strictEqual(finale.stage, 'government');
  const baseIds = new Set(finale.governmentOffers.filter((entry) => entry.kind === 'base').map((entry) => entry.id));
  for (const id of ['crown', 'military_council', 'forge_council', 'marches_charter']) assert.ok(baseIds.has(id), `${id} must always be available`);
  assert.ok(finale.governmentOffers.filter((entry) => entry.kind === 'coalition').length <= 3, 'no more than three coalitions may be displayed');

  const repeated = b14.createPoliticalFinale({ seed: 9042, narrative: source, regionalLines: source.regionalLines });
  assert.strictEqual(repeated.finaleSeed, b14.createPoliticalFinale({ seed: 9042, narrative: source, regionalLines: source.regionalLines }).finaleSeed);

  finale = b14.chooseGovernment(finale, 'crown');
  assert.strictEqual(finale.stage, 'law');
  assert.strictEqual(finale.lawOffers.length, 3);
  assert.strictEqual(new Set(finale.lawOffers.map((entry) => entry.category)).size, 3, 'law offers must use three distinct categories');
  const repeatedLaws = b14.materializeLaws(finale, 'crown').map((entry) => entry.id);
  assert.deepStrictEqual(repeatedLaws, finale.lawOffers.map((entry) => entry.id), 'law materialization must be deterministic');

  finale = b14.chooseLaw(finale, finale.lawOffers[0].id);
  assert.strictEqual(finale.stage, 'epilogue');
  assert.ok(finale.legacyLawId);
  assert.strictEqual(finale.support.charges, 1);
  assert.strictEqual(finale.support.maximum, 2);
  assert.ok(finale.support.directions.length >= 1 && finale.support.directions.length <= 2);
  assert.ok(finale.epilogueCards.length >= 4 && finale.epilogueCards.length <= 5);

  finale = b14.finishEpilogue(finale);
  assert.strictEqual(finale.stage, 'act_reward');
  finale = b14.finishActReward(finale, 'reward:act_reward:iron_marches:1');
  assert.strictEqual(finale.stage, 'interact');
  finale = b14.completeFinale(finale);
  assert.strictEqual(finale.stage, 'complete');
  assert.strictEqual(finale.completed, true);

  // Crisis path must not remove any of the four base regimes.
  let crisis = b14.createPoliticalFinale({ seed: 77, narrative: narrative('politics.iron_marches.workers_hostile', 'politics.iron_marches.garrison_divided') });
  while (crisis.stage === 'cabinet') {
    const choices = b14.cabinetChoices(crisis, { gold: 0, supplies: 0 });
    const refusal = choices.find((choice) => choice.id.startsWith('cabinet_refuse:')) || choices[0];
    crisis = b14.resolveCabinet(crisis, refusal.id, { gold: 0, supplies: 0 }).finale;
  }
  assert.strictEqual(crisis.governmentOffers.filter((entry) => entry.kind === 'base' && entry.available).length, 4);

  console.log('B14 political finale: deterministic cabinet, governments, laws, legacy, support and epilogue passed.');
})();
