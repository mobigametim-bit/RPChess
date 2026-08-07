'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { createBrowserRunSelectionHost } = require('../src/browser/iron-marches-browser-host-b9.cjs');
const presenter = require('../src/runtime/presenter-bridge.cjs');
const b14 = require('../src/runtime/political-finale-b14.cjs');
const actReward = require('../src/runtime/b14-act-reward.cjs');
const economy = require('../src/runtime/production-economy.cjs');

function narrative(...ids) {
  return {
    format:'rpchess-production-narrative', schemaVersion:1,
    currentFacts:Object.freeze(Object.fromEntries(ids.map((id,index)=>[`fact:${index}`,Object.freeze({ id })]))),
    decisionHistory:Object.freeze([]), regionalLines:Object.freeze({ iron_and_bread:'favorable', honor_of_the_marches:'favorable' }), finale:null
  };
}
function noTechnicalLeak(value) {
  const text = JSON.stringify(value);
  for (const token of ['fate.iron_marches.', 'politics.iron_marches.', 'obligation.iron_marches.', 'story.iron_marches.', 'undefined', '[object Object]', 'NaN']) {
    assert.strictEqual(text.includes(token), false, `player-facing B14 output leaked ${token}`);
  }
}
async function launchedState(seed = 14114) {
  const host = createBrowserRunSelectionHost({
    seed, profileId:'profile-1', storage:new MemoryKeyValueStorage(), deviceId:`closure-${seed}`,
    stageB:true, availableHeroIds:['hero.aldric_wall','hero.mara_chain','hero.vael_hammer']
  });
  await host.dispatch({ type:'SelectKing', kingId:'king.oathkeeper' });
  await host.dispatch({ type:'SelectDoctrine', doctrineId:'doctrine.fortress' });
  await host.dispatch({ type:'ToggleHero', heroId:'hero.aldric_wall' });
  await host.dispatch({ type:'LockSelection' });
  const runtime = host.getRuntimeHost();
  let snapshot = runtime.getSnapshot();
  await runtime.dispatch({ type:'ChooseDraftHero', heroId:snapshot.stageB.draft.heroOffers[0].id });
  snapshot = runtime.getSnapshot();
  await runtime.dispatch({ type:'ChooseDraftRegular', regularId:snapshot.stageB.draft.regularOffers[0].id });
  await runtime.dispatch({ type:'ConfirmDraft' });
  return runtime.getState();
}
function finaleGate(state, lines = { iron_and_bread:'favorable', honor_of_the_marches:'favorable' }) {
  return Object.freeze({
    ...state,
    narrative:Object.freeze({ ...state.narrative, regionalLines:Object.freeze(lines) }),
    status:'act_outcome',
    stageB:Object.freeze({
      ...state.stageB, status:'act_outcome',
      actOutcome:Object.freeze({ summary:'Железный Регент повержен.', choices:Object.freeze([]), selectedChoiceId:null, regionalRecruitId:state.stageB.roster.find((entry)=>entry.kind==='hero')?.id || 'hero.aldric_wall' })
    })
  });
}
function dispatch(state, command) { return presenter.dispatchPresenterCommand(state, command, {}); }

(async () => {
  for (const force of Object.values(b14.FORCE_DEFINITIONS)) {
    assert.strictEqual(force.demand.costGold, 0);
    assert.strictEqual(force.demand.costSupplies, 0);
  }

  const factRich = narrative(
    'story.iron_marches.strike_compromise', 'obligation.iron_marches.standard_ratified',
    'politics.iron_marches.garrison_united', 'obligation.iron_marches.emergency_term',
    'story.iron_marches.furnace_oath', 'politics.iron_marches.workers_support_crown'
  );
  let finale = b14.createPoliticalFinale({ seed:9042, narrative:factRich, regionalLines:factRich.regionalLines });
  while (finale.stage === 'cabinet') {
    const choice = b14.cabinetChoices(finale, { gold:0, supplies:0 }).find((entry)=>entry.available !== false);
    finale = b14.resolveCabinet(finale, choice.id, { gold:0, supplies:0 }).finale;
  }
  const surface = b14.finaleSurface(finale, { gold:0, supplies:0 });
  assert.strictEqual(surface.stage, 'government');
  assert.strictEqual(surface.choices.filter((entry)=>entry.kind==='base').length, 4);
  assert.ok(surface.choices.filter((entry)=>entry.kind==='coalition').length <= 3);
  for (const choice of surface.choices) {
    for (const privateField of ['strong','normal','weak','crises','blocked']) assert.strictEqual(Object.hasOwn(choice, privateField), false, `UI government choice leaked ${privateField}`);
    for (const reason of choice.reasons || []) assert.strictEqual(/[._][a-z]/i.test(reason), false, `technical coalition reason leaked: ${reason}`);
  }

  for (const governmentId of b14.GOVERNMENT_IDS) {
    assert.strictEqual(b14.LAW_POOLS[governmentId].length, 5, `${governmentId} must retain five authored laws`);
    const fake = { finaleSeed:123456, factIds:[], governmentId };
    const laws = b14.materializeLaws(fake, governmentId);
    assert.strictEqual(laws.length, 3);
    assert.strictEqual(new Set(laws.map((entry)=>entry.category)).size, 3);
    assert.ok(laws.filter((entry)=>entry.universallyValid !== false).length >= 2);
    assert.deepStrictEqual(b14.materializeLaws(fake, governmentId).map((entry)=>entry.id), laws.map((entry)=>entry.id));
  }
  const substituted = b14.materializeLaws({ finaleSeed:17, factIds:['story.iron_marches.strike_compromise'] }, 'crown');
  assert.ok(substituted.some((entry)=>entry.id === 'charter_safe_work_stop'), 'authored unsafe-work substitution must be materialized');

  let epilogueFinale = b14.createPoliticalFinale({
    seed:77,
    narrative:narrative('fate.iron_marches.prisoners_released'),
    regionalLines:{ iron_and_bread:'unstarted', honor_of_the_marches:'crisis' }
  });
  epilogueFinale = { ...epilogueFinale, stage:'government', governmentOffers:b14.availableGovernments(epilogueFinale) };
  epilogueFinale = b14.chooseGovernment(epilogueFinale, 'crown');
  epilogueFinale = b14.chooseLaw(epilogueFinale, epilogueFinale.lawOffers[0].id);
  noTechnicalLeak(b14.finaleSurface(epilogueFinale, {}));

  const offersA = actReward.materializeActRewardOffers({ seed:9042, act:1 });
  const offersB = actReward.materializeActRewardOffers({ seed:9042, act:1 });
  assert.strictEqual(offersA.length, 3);
  assert.deepStrictEqual(offersB, offersA);
  assert.deepStrictEqual(offersA.map((entry)=>entry.type).sort(), ['recruit','relic','relic']);
  assert.strictEqual(new Set(offersA.filter((entry)=>entry.type==='relic').map((entry)=>entry.payload.relicId)).size, 2);
  assert.ok(offersA.every((entry)=>entry.id.startsWith('act_reward:iron_marches:')));

  let state = finaleGate(await launchedState());
  let snapshot = presenter.createPresenterSnapshot(state, {});
  while (snapshot.politicalFinaleB14.stage === 'cabinet') {
    const choice = snapshot.politicalFinaleB14.choices.find((entry)=>entry.available !== false);
    const step = dispatch(state, { type:'ChooseActOutcome', choiceId:choice.id });
    state = step.state; snapshot = step.snapshot;
  }
  let result = dispatch(state, { type:'ChooseActOutcome', choiceId:'crown' });
  state = result.state; snapshot = result.snapshot;
  assert.strictEqual(snapshot.politicalFinaleB14.stage, 'law');
  const lawId = snapshot.politicalFinaleB14.choices[0].id;
  result = dispatch(state, { type:'ChooseActOutcome', choiceId:lawId });
  state = result.state; snapshot = result.snapshot;
  assert.strictEqual(snapshot.politicalFinaleB14.stage, 'epilogue');
  noTechnicalLeak(snapshot.politicalFinaleB14);

  result = dispatch(state, { type:'ChooseActOutcome', choiceId:'epilogue_continue' });
  state = result.state; snapshot = result.snapshot;
  assert.strictEqual(snapshot.politicalFinaleB14.stage, 'act_reward');
  assert.strictEqual(snapshot.stageB.rewardOffers.length, 3);
  assert.ok(snapshot.stageB.rewardOffers.every((entry)=>entry.id.startsWith('act_reward:iron_marches:')));
  const serializedReward = JSON.parse(JSON.stringify(state));
  const reloadSnapshot = presenter.createPresenterSnapshot(serializedReward, {});
  assert.deepStrictEqual(reloadSnapshot.stageB.rewardOffers.map((entry)=>entry.id), snapshot.stageB.rewardOffers.map((entry)=>entry.id), 'reload must not reroll Act Reward');

  const reward = snapshot.stageB.rewardOffers[0];
  result = dispatch(state, { type:'ChooseRewardOffer', offerId:reward.id, targetRosterId:state.stageB.roster[0]?.id || null });
  state = result.state; snapshot = result.snapshot;
  assert.strictEqual(snapshot.politicalFinaleB14.stage, 'interact');
  const preview = snapshot.stageB.reorganization.interActConversionPreview;
  assert.ok(preview, 'inter-act conversion preview must be bound into presenter state');
  assert.deepStrictEqual(preview, economy.interActConversion(state.resources, state.campaign));
  assert.strictEqual(preview.nextSupplies, economy.START_SUPPLIES);
  assert.strictEqual(preview.convertedGold, preview.convertedSupplies * economy.INTER_ACT_SUPPLY_TO_GOLD);

  result = dispatch(state, { type:'SetReorganization', activeRosterIds:state.stageB.reorganization.activeRosterIds });
  state = result.state;
  result = dispatch(state, { type:'ConfirmReorganization' });
  state = result.state; snapshot = result.snapshot;
  assert.strictEqual(state.politicalFinaleB14.stage, 'complete');
  assert.strictEqual(state.campaign.supplies, economy.START_SUPPLIES);
  assert.ok(state.interActConversion);
  assert.strictEqual(state.resources.gold, state.interActConversion.nextGold);

  const finalPresenter = fs.readFileSync(path.resolve(__dirname, '../game/js/vertical-slice-presenter-final.mjs'), 'utf8');
  assert.ok(finalPresenter.includes('data-interact-conversion'));
  assert.ok(finalPresenter.includes('Осталось припасов'));
  assert.ok(finalPresenter.includes('Золото следующего акта'));
  assert.ok(finalPresenter.includes('data-service-relic'));
  assert.ok(finalPresenter.includes('targetRelicId'));
  assert.ok(finalPresenter.includes('Нет подходящей фигуры'));
  assert.ok(finalPresenter.includes('Нет подходящей реликвии'));

  const explicitSetup = fs.readFileSync(path.resolve(__dirname, '../game/js/explicit-run-setup.mjs'), 'utf8');
  assert.ok(explicitSetup.includes('Stage B still materializes three deterministic offers'));
  assert.ok(explicitSetup.includes('createProgressObserver'));
  assert.ok(explicitSetup.includes('victories:next.victories+1'));

  console.log('Iron Marches production closure: B14 rules, human surfaces, all 8 law pools, dedicated Act Reward, reload stability, inter-act conversion, explicit setup and production service bindings passed.');
})().catch((error)=>{ console.error(error.stack || error); process.exitCode=1; });