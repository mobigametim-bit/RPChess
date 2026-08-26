'use strict';

const assert = require('assert');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const {
  createBrowserRunSelectionHost,
  createBrowserIronMarchesRuntimeHost
} = require('../src/browser/iron-marches-browser-host-b9.cjs');
const {
  createBrowserProfileStore,
  saveBrowserProfile
} = require('../src/browser/profile-persistence.cjs');

const HERO_IDS = Object.freeze([
  'hero.aldric_wall','hero.mara_chain','hero.brother_orell',
  'hero.vael_hammer','hero.lady_sorn','hero.tomas_gate'
]);

(async () => {
  const host = createBrowserRunSelectionHost({
    seed: 3,
    profileId: 'profile-1',
    storage: new MemoryKeyValueStorage(),
    deviceId: 'stale-opponent-turn-fixture',
    stageB: true,
    availableHeroIds: HERO_IDS,
    forceNew: true
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

  snapshot = runtime.getSnapshot();
  const route = snapshot.campaign.routes.find((entry) => ['battle','elite'].includes(entry.type));
  assert.ok(route, 'fixture must expose a battle route');
  await runtime.dispatch({ type:'Travel', targetNodeId:route.to });
  await runtime.dispatch({ type:'ConfirmBriefing' });
  snapshot = runtime.getSnapshot();
  assert.strictEqual(snapshot.status, 'deployment');
  assert.strictEqual(snapshot.deployment.canConfirm, true, 'fixture deployment must be confirmable');
  await runtime.dispatch({ type:'ConfirmDeployment' });

  const fresh = runtime.getState();
  assert.strictEqual(fresh.status, 'scenario');
  assert.strictEqual(fresh.scenario.battle.position.sideToMove, fresh.playerSide, 'fresh deployment must begin on player side');

  const stale = JSON.parse(JSON.stringify(fresh));
  const opponent = stale.playerSide === 'w' ? 'b' : 'w';
  stale.scenario.battle.position.sideToMove = opponent;
  const oldHistoryLength = stale.history.length;

  const staleStore = createBrowserProfileStore({
    storage: new MemoryKeyValueStorage(),
    deviceId: 'stale-opponent-turn-persisted'
  });
  saveBrowserProfile(staleStore, stale);

  const repairedHost = createBrowserIronMarchesRuntimeHost({
    saveStore: staleStore,
    resume: true,
    seed: 3,
    profileId: stale.profileId,
    stageB: true,
    availableHeroIds: HERO_IDS
  });
  const repaired = repairedHost.getState();
  const repairedSnapshot = repairedHost.getSnapshot();

  assert.strictEqual(repairedHost.resumed, true, 'fixture must resume the persisted stale profile');
  assert.strictEqual(repaired.scenario.battle.position.sideToMove, repaired.playerSide, 'resumed stale battle must return control to player');
  assert.strictEqual(repairedSnapshot.scenario.playerTurn, true, 'presenter snapshot must expose player turn after repair');
  assert.strictEqual(repaired.history.length, oldHistoryLength + 1, 'repair must be auditable in runtime history');
  assert.strictEqual(repaired.history.at(-1).type, 'stale_opponent_turn_repaired');
  assert.strictEqual(repaired.history.at(-1).previousSide, opponent);
  assert.strictEqual(repaired.history.at(-1).restoredSide, repaired.playerSide);
  assert.strictEqual(stale.scenario.battle.position.sideToMove, opponent, 'repair must not mutate the persisted source object');

  console.log('Stale autosave opponent-turn repair: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
