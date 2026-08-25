'use strict';

const assert = require('assert');
const { hash32 } = require('../src/core/determinism.cjs');
const { validateProductionEventLibrary } = require('../src/content/production-events.cjs');
const {
  createProductionEventSelectorState,
  selectEventForSlot
} = require('../src/campaign/production-event-selector.cjs');
const b14 = require('../src/runtime/political-finale-b14.cjs');
const eventSource = require('../content/events/iron_marches_production.json');

const library = validateProductionEventLibrary(eventSource);
const FACT_POOL = Object.freeze([
  'story.iron_marches.strike_compromise',
  'story.iron_marches.strike_workers_backed',
  'story.strike_broken',
  'politics.iron_marches.workers_hostile',
  'politics.iron_marches.garrison_united',
  'politics.iron_marches.garrison_divided',
  'obligation.iron_marches.standard_ratified',
  'obligation.iron_marches.emergency_term',
  'obligation.iron_marches.forge_amnesty',
  'obligation.iron_marches.royal_arbitration',
  'law.iron_marches.appointed_command',
  'law.iron_marches.prisoner_rule',
  'knowledge.iron_marches.mine_abuse_proven',
  'politics.iron_marches.joint_furnace_charter'
]);
const LINE_STATES = Object.freeze(['favorable','crisis','standalone','incomplete','unstarted']);

function narrative(seed) {
  const ids = FACT_POOL.filter((id, index) => (hash32(`${seed}:fact:${index}`) & 3) === 0);
  return Object.freeze({
    format:'rpchess-production-narrative',
    schemaVersion:1,
    currentFacts:Object.freeze(Object.fromEntries(ids.map((id,index)=>[`fact:${index}`,Object.freeze({id})]))),
    decisionHistory:Object.freeze([]),
    regionalLines:Object.freeze({
      iron_and_bread:LINE_STATES[hash32(`${seed}:line:bread`) % LINE_STATES.length],
      honor_of_the_marches:LINE_STATES[hash32(`${seed}:line:honor`) % LINE_STATES.length]
    }),
    finale:null
  });
}

function resolveCabinet(finale, seed) {
  let current = finale;
  let resources = { gold:80, supplies:10 };
  while (current.stage === 'cabinet') {
    const choices = b14.cabinetChoices(current, resources);
    let choice;
    const accept = choices.find((entry)=>entry.id.startsWith('cabinet_accept:'));
    const refuse = choices.find((entry)=>entry.id.startsWith('cabinet_refuse:'));
    if (accept || refuse) choice = (hash32(`${seed}:cabinet:${current.crisisIndex}`) & 1) === 0 ? (accept || refuse) : (refuse || accept);
    else choice = choices[0];
    const result = b14.resolveCabinet(current, choice.id, resources);
    current = result.finale;
    resources = result.resources;
  }
  return { finale:current, resources };
}

(function main(){
  const eventSeen = new Set();
  const activeFollowups = new Set();
  const governmentSeen = new Set();
  let crisisFinales = 0;
  let coalitionFinales = 0;
  let maxCoalitions = 0;

  for (let seed=1; seed<=10000; seed+=1) {
    for (const phase of ['early','mid','late']) {
      const selector = createProductionEventSelectorState(library,{seed});
      const id = selectEventForSlot(library,selector,{nodeId:`${phase}:${seed}`,phase});
      if (id) eventSeen.add(id);
    }
    const ironSelector = createProductionEventSelectorState(library,{seed,activeChainIds:['chain.iron_marches.iron_and_bread']});
    const honorSelector = createProductionEventSelectorState(library,{seed,activeChainIds:['chain.iron_marches.honor_of_the_marches']});
    const ironId = selectEventForSlot(library,ironSelector,{nodeId:`iron:${seed}`,phase:'late'});
    const honorId = selectEventForSlot(library,honorSelector,{nodeId:`honor:${seed}`,phase:'late'});
    if (ironId === 'event.furnace_oath') activeFollowups.add(ironId);
    if (honorId === 'event.prisoners_pass') activeFollowups.add(honorId);

    const story = narrative(seed);
    const initial = b14.createPoliticalFinale({seed,narrative:story,regionalLines:story.regionalLines});
    const repeated = b14.createPoliticalFinale({seed,narrative:story,regionalLines:story.regionalLines});
    assert.deepStrictEqual(repeated,initial,`seed ${seed}: finale materialization rerolled`);
    if (initial.crisisQueue.length) crisisFinales += 1;
    let { finale } = resolveCabinet(initial,seed);
    assert.strictEqual(finale.stage,'government');
    const bases = finale.governmentOffers.filter((entry)=>entry.kind==='base'&&entry.available);
    const coalitions = finale.governmentOffers.filter((entry)=>entry.kind==='coalition'&&entry.available);
    assert.strictEqual(bases.length,4,`seed ${seed}: four base governments must remain available`);
    assert.ok(coalitions.length<=3,`seed ${seed}: more than three coalitions exposed`);
    maxCoalitions = Math.max(maxCoalitions,coalitions.length);
    const offer = finale.governmentOffers[hash32(`${seed}:government`) % finale.governmentOffers.length];
    governmentSeen.add(offer.id);
    if (offer.kind === 'coalition') coalitionFinales += 1;
    finale = b14.chooseGovernment(finale,offer.id);
    assert.strictEqual(finale.lawOffers.length,3,`seed ${seed}: law offer count`);
    assert.strictEqual(new Set(finale.lawOffers.map((entry)=>entry.category)).size,3,`seed ${seed}: law categories`);
    const law = finale.lawOffers[hash32(`${seed}:law`) % finale.lawOffers.length];
    finale = b14.chooseLaw(finale,law.id);
    assert.ok(finale.epilogueCards.length>=4&&finale.epilogueCards.length<=5,`seed ${seed}: epilogue card count`);
    assert.strictEqual(finale.support.charges,1);
    assert.ok(finale.support.directions.length>=1&&finale.support.directions.length<=2);
    finale = b14.finishEpilogue(finale);
    finale = b14.finishActReward(finale,`reward:corpus:${seed}`);
    finale = b14.completeFinale(finale);
    assert.strictEqual(finale.completed,true);
  }

  for (const event of library.events) assert.ok(eventSeen.has(event.id),`mass corpus never selected ${event.id}`);
  assert.deepStrictEqual([...activeFollowups].sort(),['event.furnace_oath','event.prisoners_pass']);
  for (const id of b14.GOVERNMENT_IDS) assert.ok(governmentSeen.has(id),`mass corpus never selected government ${id}`);
  assert.ok(crisisFinales>0,'mass corpus must include crisis finales');
  assert.ok(coalitionFinales>0,'mass corpus must include coalition finales');
  assert.ok(maxCoalitions>=1,'mass corpus must expose conditional coalitions');

  console.log(JSON.stringify({seeds:10000,eventIds:[...eventSeen].sort(),followups:[...activeFollowups].sort(),governmentIds:[...governmentSeen].sort(),crisisFinales,coalitionFinales,maxCoalitions},null,2));
  console.log('Iron Marches political/event seed corpus: 10,000/10,000 passed.');
})();
