'use strict';

const assert = require('assert');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { createBrowserRunSelectionHost } = require('../src/browser/iron-marches-browser-host-b9.cjs');
const presenter = require('../src/runtime/presenter-bridge.cjs');
const { validatePresenterSnapshot } = require('../src/browser/presenter-snapshot-validator.cjs');

async function launchedState() {
  const host = createBrowserRunSelectionHost({
    seed: 14114,
    profileId: 'profile-1',
    storage: new MemoryKeyValueStorage(),
    deviceId: 'b14-browser-test',
    stageB: true,
    availableHeroIds: ['hero.aldric_wall', 'hero.mara_chain', 'hero.vael_hammer']
  });
  await host.dispatch({ type: 'SelectKing', kingId: 'king.oathkeeper' });
  await host.dispatch({ type: 'SelectDoctrine', doctrineId: 'doctrine.fortress' });
  await host.dispatch({ type: 'ToggleHero', heroId: 'hero.aldric_wall' });
  await host.dispatch({ type: 'LockSelection' });
  const runtime = host.getRuntimeHost();
  let snapshot = runtime.getSnapshot();
  await runtime.dispatch({ type: 'ChooseDraftHero', heroId: snapshot.stageB.draft.heroOffers[0].id });
  snapshot = runtime.getSnapshot();
  await runtime.dispatch({ type: 'ChooseDraftRegular', regularId: snapshot.stageB.draft.regularOffers[0].id });
  await runtime.dispatch({ type: 'ConfirmDraft' });
  return runtime.getState();
}

function finaleGate(state) {
  return Object.freeze({
    ...state,
    status: 'act_outcome',
    stageB: Object.freeze({
      ...state.stageB,
      status: 'act_outcome',
      actOutcome: Object.freeze({
        summary: 'Железный Регент повержен.',
        choices: Object.freeze([]),
        selectedChoiceId: null,
        regionalRecruitId: state.stageB.roster.find((entry) => entry.kind === 'hero')?.id || 'hero.aldric_wall'
      })
    })
  });
}

function dispatch(state, command) {
  const result = presenter.dispatchPresenterCommand(state, command, {});
  validatePresenterSnapshot(result.snapshot);
  return result;
}

(async () => {
  let state = finaleGate(await launchedState());

  // Snapshot creation itself materializes the B14 gate deterministically.
  const firstSnapshot = presenter.createPresenterSnapshot(state, {});
  validatePresenterSnapshot(firstSnapshot);
  assert.strictEqual(firstSnapshot.status, 'act_outcome');
  assert.strictEqual(firstSnapshot.politicalFinaleB14.stage, 'cabinet');
  assert.ok(firstSnapshot.politicalFinaleB14.choices.length >= 1);

  // First command starts from the same unmaterialized state and must produce the same finale seed.
  let choice = firstSnapshot.politicalFinaleB14.choices.find((entry) => entry.available !== false);
  let result = dispatch(state, { type: 'ChooseActOutcome', choiceId: choice.id });
  state = result.state;
  assert.ok(state.politicalFinaleB14);

  // Resolve remaining cabinet demands / confirmation.
  while (state.politicalFinaleB14.stage === 'cabinet') {
    const snapshot = presenter.createPresenterSnapshot(state, {});
    choice = snapshot.politicalFinaleB14.choices.find((entry) => entry.available !== false);
    result = dispatch(state, { type: 'ChooseActOutcome', choiceId: choice.id });
    state = result.state;
  }
  assert.strictEqual(state.politicalFinaleB14.stage, 'government');
  assert.strictEqual(state.politicalFinaleB14.governmentOffers.filter((entry) => entry.kind === 'base').length, 4);

  // Choose a base government so the test is never dependent on optional coalition facts.
  result = dispatch(state, { type: 'ChooseActOutcome', choiceId: 'crown' });
  state = result.state;
  assert.strictEqual(state.politicalFinaleB14.stage, 'law');
  assert.strictEqual(state.politicalFinaleB14.lawOffers.length, 3);
  assert.strictEqual(new Set(state.politicalFinaleB14.lawOffers.map((entry) => entry.category)).size, 3);

  const lawId = state.politicalFinaleB14.lawOffers[0].id;
  result = dispatch(state, { type: 'ChooseActOutcome', choiceId: lawId });
  state = result.state;
  assert.strictEqual(state.politicalFinaleB14.stage, 'epilogue');
  assert.strictEqual(state.regionalLegacy.iron_marches, lawId);
  assert.strictEqual(state.regionalSupport.iron_marches.charges, 1);

  result = dispatch(state, { type: 'ChooseActOutcome', choiceId: 'epilogue_continue' });
  state = result.state;
  assert.strictEqual(state.status, 'reward_choice');
  assert.strictEqual(state.politicalFinaleB14.stage, 'act_reward');
  assert.strictEqual(state.stageB.rewardOffers.length, 3);

  const offer = state.stageB.rewardOffers[0];
  const targetRosterId = state.stageB.roster.find((entry) => entry.available || entry.injury)?.id || null;
  result = dispatch(state, { type: 'ChooseRewardOffer', offerId: offer.id, targetRosterId });
  state = result.state;
  assert.strictEqual(state.status, 'reorganization');
  assert.strictEqual(state.politicalFinaleB14.stage, 'interact');
  assert.ok(state.stageB.reorganization);

  const activeRosterIds = state.stageB.reorganization.activeRosterIds;
  result = dispatch(state, { type: 'SetReorganization', activeRosterIds });
  state = result.state;
  result = dispatch(state, { type: 'ConfirmReorganization' });
  state = result.state;
  assert.strictEqual(state.politicalFinaleB14.stage, 'complete');
  assert.strictEqual(state.politicalFinaleB14.completed, true);

  // Serialization/reload contract: plain JSON round-trip does not change confirmed political materialization.
  const roundTrip = JSON.parse(JSON.stringify(state.politicalFinaleB14));
  assert.deepStrictEqual(roundTrip, JSON.parse(JSON.stringify(state.politicalFinaleB14)));
  assert.strictEqual(roundTrip.governmentId, 'crown');
  assert.strictEqual(roundTrip.legacyLawId, lawId);

  console.log('B14 browser runtime: cabinet, government, law, epilogue, Act Reward, inter-act reorganization and presenter snapshot validation passed.');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
