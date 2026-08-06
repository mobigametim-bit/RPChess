'use strict';

const assert = require('assert');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { createBrowserRunSelectionHost } = require('../src/browser/iron-marches-browser-host-b9.cjs');

async function launchStageB(storage) {
  const host = createBrowserRunSelectionHost({
    seed: 9042,
    profileId: 'profile-1',
    storage,
    deviceId: 'stage-b-runtime-test',
    stageB: true,
    availableHeroIds: ['hero.aldric_wall', 'hero.mara_chain', 'hero.vael_hammer']
  });
  await host.dispatch({ type: 'SelectKing', kingId: 'king.oathkeeper' });
  await host.dispatch({ type: 'SelectDoctrine', doctrineId: 'doctrine.fortress' });
  await host.dispatch({ type: 'ToggleHero', heroId: 'hero.aldric_wall' });
  await host.dispatch({ type: 'LockSelection' });
  return host;
}

(async () => {
  const storage = new MemoryKeyValueStorage();
  const selection = await launchStageB(storage);
  const runtime = selection.getRuntimeHost();
  let snapshot = runtime.getSnapshot();
  assert.strictEqual(snapshot.status, 'draft');
  assert.deepStrictEqual(snapshot.actions, ['ChooseDraftHero', 'ChooseDraftRegular', 'ConfirmDraft']);
  assert.strictEqual(snapshot.stageB.draft.heroOffers.length, 3);
  assert.strictEqual(snapshot.stageB.draft.regularOffers.length, 4);

  await runtime.dispatch({ type: 'ChooseDraftHero', heroId: snapshot.stageB.draft.heroOffers[0].id });
  snapshot = runtime.getSnapshot();
  await runtime.dispatch({ type: 'ChooseDraftRegular', regularId: snapshot.stageB.draft.regularOffers[0].id });
  await runtime.dispatch({ type: 'ConfirmDraft' });
  snapshot = runtime.getSnapshot();
  assert.strictEqual(snapshot.status, 'campaign');
  assert.strictEqual(snapshot.campaign.generatorVersion, 3);
  assert.ok(snapshot.campaign.macroTemplateId);
  assert.strictEqual(typeof snapshot.campaign.isMirrored, 'boolean');
  assert.ok(snapshot.campaign.nodes.length >= 18 && snapshot.campaign.nodes.length <= 24);
  assert.ok(snapshot.stageB.roster.length >= 6 && snapshot.stageB.roster.length <= 8);
  assert.strictEqual(snapshot.resources.supplies, 20);
  assert.strictEqual(snapshot.campaign.nodes.filter((node) => node.visibility !== 'hidden' && node.visibility !== 'landmark').every((node) => node.layer <= 1), true);

  const route = snapshot.campaign.routes.find((entry) => entry.affordable && entry.type === 'battle');
  assert.ok(route);
  assert.strictEqual(route.visibility, 'type');
  await runtime.dispatch({ type: 'ScoutNode', nodeId: route.to });
  snapshot = runtime.getSnapshot();
  const scouted = snapshot.campaign.routes.find((entry) => entry.to === route.to);
  assert.strictEqual(scouted.visibility, 'content');
  assert.strictEqual(scouted.scouted, true);
  assert.ok(scouted.intel);

  await runtime.dispatch({ type: 'Travel', targetNodeId: route.to });
  snapshot = runtime.getSnapshot();
  assert.strictEqual(snapshot.status, 'briefing');
  assert.strictEqual(snapshot.stageB.briefing.locked, false);
  assert.ok(snapshot.stageB.briefing.winConditions.length);
  assert.ok(snapshot.stageB.briefing.lossConditions.length);
  await runtime.dispatch({ type: 'ConfirmBriefing' });
  snapshot = runtime.getSnapshot();
  assert.strictEqual(snapshot.status, 'deployment');
  assert.strictEqual(snapshot.deployment.canConfirm, true);
  await runtime.dispatch({ type: 'ConfirmDeployment' });
  snapshot = runtime.getSnapshot();
  assert.strictEqual(snapshot.status, 'scenario');
  assert.ok(snapshot.scenario.legalCommands.length > 0);
  assert.ok(runtime.getLastSaveEnvelope().revision >= 8);

  const resumedSelection = createBrowserRunSelectionHost({
    profileId: 'profile-1', storage, deviceId: 'stage-b-runtime-test', stageB: true,
    availableHeroIds: ['hero.aldric_wall', 'hero.mara_chain', 'hero.vael_hammer']
  });
  assert.strictEqual(resumedSelection.getSnapshot().status, 'ready');
  assert.strictEqual(resumedSelection.getRuntimeHost().resumed, true);
  assert.deepStrictEqual(resumedSelection.getRuntimeHost().getSnapshot(), snapshot);
  console.log('Stage B runtime: B9 map, draft, scouting, briefing, deployment and browser resume passed.');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
