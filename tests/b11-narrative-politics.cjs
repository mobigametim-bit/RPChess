'use strict';

const assert = require('assert');
const {
  FACT_TYPES,
  createNarrativeState,
  normalizeFact,
  applyFacts,
  applyEventOutcome,
  factIds,
  deriveRegionalLines,
  selectNarrativeParticipant,
  buildIronMarchesFinale,
  selectIronMarchesFinale
} = require('../src/runtime/production-narrative.cjs');

assert.deepStrictEqual(FACT_TYPES, ['fate', 'position', 'obligation', 'knowledge', 'relation', 'control']);
let state = createNarrativeState();
state = applyFacts(state, ['knowledge.iron_marches.mine_abuse_proven'], [], { source: 'event.miners', eventClass: 'key' });
assert.strictEqual(state.currentFacts['knowledge.iron_marches.mine_abuse_proven'].type, 'knowledge');
assert.strictEqual(state.decisionHistory.at(-1).type, 'fact_applied');

const low = normalizeFact({ id: 'politics.iron_marches.council_resentful', eventClass: 'small', compatibilityKey: 'politics.iron_marches.council' });
const high = normalizeFact({ id: 'politics.iron_marches.council_supportive', eventClass: 'key', compatibilityKey: 'politics.iron_marches.council' });
state = applyFacts(state, [low]);
state = applyFacts(state, [high]);
assert.strictEqual(state.currentFacts['politics.iron_marches.council'].id, 'politics.iron_marches.council_supportive');
state = applyFacts(state, [{ id: 'politics.iron_marches.council_neutral', eventClass: 'small', compatibilityKey: 'politics.iron_marches.council' }]);
assert.strictEqual(state.currentFacts['politics.iron_marches.council'].id, 'politics.iron_marches.council_supportive', 'lower-priority fact must not overwrite a key-event fact');

state = applyEventOutcome(state, {
  eventId: 'event.miners_on_strike', eventClass: 'key', variantId: 'default', stageId: 'settlement', choiceId: 'right_to_stop'
}, {
  id: 'compromise',
  addFlags: ['story.iron_marches.strike_compromise', 'politics.iron_marches.workers_support_crown'],
  removeFlags: [],
  resourceDelta: { gold: 0, supplies: 2 },
  consequences: ['reach_compromise']
});
state = applyEventOutcome(state, {
  eventId: 'event.prisoners_pass', eventClass: 'standard', variantId: 'linked_favorable', stageId: 'decision', choiceId: 'release'
}, {
  id: 'oath',
  addFlags: ['obligation.iron_marches.standard_ratified', 'politics.iron_marches.garrison_united'],
  removeFlags: [],
  resourceDelta: { gold: 0, supplies: 0 },
  consequences: ['unite_garrison']
});
const lines = deriveRegionalLines(state);
assert.deepStrictEqual(lines, { iron_and_bread: 'favorable', honor_of_the_marches: 'favorable' });
assert.ok(factIds(state).includes('story.iron_marches.strike_compromise'));
assert.ok(factIds(state).includes('politics.iron_marches.workers_support_crown'));
assert.ok(factIds(state).includes('politics.iron_marches.garrison_united'));

const participantContext = {
  kingId: 'king.oathkeeper', doctrineId: 'doctrine.fortress',
  roster: [
    { id: 'king-slot', contentId: 'king.oathkeeper', kind: 'king', available: true },
    { id: 'hero-slot', contentId: 'hero.lady_sorn', kind: 'hero', available: true },
    { id: 'linked-slot', contentId: 'hero.aldric_wall', kind: 'hero', available: true }
  ]
};
assert.strictEqual(selectNarrativeParticipant(participantContext, { linkedCharacterId: 'hero.aldric_wall', uniqueHeroIds: ['hero.lady_sorn'] }).source, 'linked_character');
assert.strictEqual(selectNarrativeParticipant(participantContext, { uniqueHeroIds: ['hero.lady_sorn'] }).source, 'unique_hero');
assert.strictEqual(selectNarrativeParticipant({ ...participantContext, roster: participantContext.roster.filter((entry) => entry.kind !== 'hero') }, {}).source, 'king');
assert.strictEqual(selectNarrativeParticipant({ doctrineId: 'doctrine.fortress', roster: [] }, {}).source, 'doctrine');

const finale = buildIronMarchesFinale(state, { gold: 80 });
assert.strictEqual(finale.choices.some((choice) => choice.id === 'workers_compact'), true);
assert.strictEqual(finale.choices.some((choice) => choice.id === 'oath_compact'), true);
assert.strictEqual(finale.choices.some((choice) => choice.available), true);
const selected = selectIronMarchesFinale(state, finale, 'workers_compact', { gold: 80, meta: 0 });
assert.strictEqual(selected.resources.gold, 60);
assert.ok(factIds(selected.narrative).includes('fate.iron_marches.workers_compact'));
assert.strictEqual(selected.narrative.finale.selectedChoiceId, 'workers_compact');
assert.throws(() => selectIronMarchesFinale(state, buildIronMarchesFinale(state, { gold: 0 }), 'workers_compact', { gold: 0 }), /requirements|gold/);

console.log('B11 narrative: typed facts, priority resolution, participant priority, regional chains and player-selected political finale passed.');
