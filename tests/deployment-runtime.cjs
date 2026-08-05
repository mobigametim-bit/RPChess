const assert = require('assert');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { createBrowserRunSelectionHost } = require('../src/browser/iron-marches-browser-host.cjs');

async function launch(host) {
  await host.dispatch({ type: 'SelectKing', kingId: 'king.oathkeeper' });
  await host.dispatch({ type: 'SelectDoctrine', doctrineId: 'doctrine.fortress' });
  await host.dispatch({ type: 'ToggleHero', heroId: 'hero.aldric_wall' });
  await host.dispatch({ type: 'LockSelection' });
  return host.getRuntimeHost();
}

async function reachDeployment(runtime) {
  for (let step = 0; step < 20; step += 1) {
    const snapshot = runtime.getSnapshot();
    if (snapshot.status === 'deployment') return snapshot;
    if (snapshot.status === 'campaign') {
      const route = snapshot.campaign.routes.find((item) => item.affordable && ['battle', 'elite'].includes(item.type)) || snapshot.campaign.routes.find((item) => item.affordable);
      if (!route) throw new Error('no affordable route while seeking deployment');
      await runtime.dispatch({ type: 'Travel', targetNodeId: route.to });
    } else if (snapshot.status === 'event') {
      await runtime.dispatch({ type: 'ChooseEvent', choiceId: snapshot.event.choices[0].id });
    } else if (snapshot.status === 'reward') {
      await runtime.dispatch({ type: 'ClaimReward' });
    } else throw new Error('unexpected status while seeking deployment: ' + snapshot.status);
  }
  throw new Error('deployment was not reached');
}

(async () => {
  const storage = new MemoryKeyValueStorage();
  const host = createBrowserRunSelectionHost({ seed: 20001, profileId: 'profile-1', storage, deviceId: 'deployment-runtime-test' });
  const runtime = await launch(host);
  let snapshot = await reachDeployment(runtime);
  assert.strictEqual(snapshot.status, 'deployment');
  assert.strictEqual(snapshot.deployment.format, 'rpchess-deployment-presenter');
  assert.strictEqual(snapshot.actions.includes('ConfirmDeployment'), true);
  assert.strictEqual(snapshot.scenario.playerTurn, false);
  assert.ok(snapshot.deployment.zone.length >= 16);
  const movable = snapshot.deployment.units.find((unit) => !unit.fixed);
  assert.ok(movable);
  const occupied = new Set(snapshot.deployment.units.map((unit) => unit.square).filter(Boolean));
  const target = snapshot.deployment.zone.find((square) => !occupied.has(square));
  assert.ok(target);

  await runtime.dispatch({ type: 'PlaceDeploymentUnit', unitId: movable.id, square: target });
  snapshot = runtime.getSnapshot();
  assert.strictEqual(snapshot.deployment.units.find((unit) => unit.id === movable.id).square, target);
  const revisionAfterEdit = runtime.getLastSaveEnvelope().revision;

  const resumedHost = createBrowserRunSelectionHost({ profileId: 'profile-1', storage, deviceId: 'deployment-runtime-test' });
  assert.strictEqual(resumedHost.getSnapshot().status, 'ready');
  const resumed = resumedHost.getRuntimeHost();
  assert.strictEqual(resumed.getSnapshot().status, 'deployment');
  assert.strictEqual(resumed.getSnapshot().deployment.units.find((unit) => unit.id === movable.id).square, target);
  assert.strictEqual(resumed.getLastSaveEnvelope(), null);

  await resumed.dispatch({ type: 'ConfirmDeployment' });
  snapshot = resumed.getSnapshot();
  assert.strictEqual(snapshot.status, 'scenario');
  assert.strictEqual(snapshot.deployment, null);
  assert.ok(snapshot.scenario.pieces.some((piece) => piece.pieceId === movable.id && piece.square === target));
  assert.ok(resumed.getLastSaveEnvelope().revision > revisionAfterEdit);
  console.log('Deployment runtime: 1/1 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
