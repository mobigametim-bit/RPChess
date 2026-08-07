'use strict';

const assert = require('assert');
require('../src/browser/iron-marches-browser-host-b9.cjs');
const presenter = require('../src/runtime/presenter-bridge.cjs');

(function main() {
  const state = Object.freeze({
    seed: 9042,
    status: 'act_outcome',
    resources: Object.freeze({ gold:80, meta:0 }),
    campaign: Object.freeze({ graph:Object.freeze({ stageB:true, regionId:'region.iron_marches' }), regionId:'region.iron_marches', act:1, currentNodeId:'boss', supplies:10, visitedNodeIds:Object.freeze(['boss']), closedNodeIds:Object.freeze([]), scoutedNodeIds:Object.freeze([]), routes:Object.freeze([]) }),
    army: Object.freeze({ heroIds:Object.freeze(['hero.aldric_wall']), doctrineId:'doctrine.fortress' }),
    stageB: Object.freeze({ draft:Object.freeze({ selectedHeroId:'hero.aldric_wall' }), roster:Object.freeze([]), status:'act_outcome', actOutcome:Object.freeze({ summary:'Boss defeated', choices:Object.freeze([]), selectedChoiceId:null, regionalRecruitId:'hero.aldric_wall' }), pendingRewardOffers:Object.freeze([]) }),
    narrative: Object.freeze({ format:'rpchess-production-narrative', schemaVersion:1, currentFacts:Object.freeze({ crisis:Object.freeze({ id:'politics.iron_marches.workers_hostile' }) }), decisionHistory:Object.freeze([]), regionalLines:Object.freeze({}), finale:null }),
    transcript: Object.freeze([]),
    history: Object.freeze([])
  });
  const snapshot = presenter.createPresenterSnapshot(state, {});
  assert.strictEqual(snapshot.politicalFinaleB14.stage, 'cabinet');
  assert.ok(snapshot.politicalFinaleB14.choices.length >= 1);
  for (const choice of snapshot.politicalFinaleB14.choices) {
    assert.strictEqual(Number(choice.costGold || 0), 0, 'cabinet must not invent a gold price');
    assert.strictEqual(Number(choice.costSupplies || 0), 0, 'cabinet must not invent a supplies price');
  }
  console.log('B14 authored costs: cabinet exposes no unauthored numeric prices.');
})();
