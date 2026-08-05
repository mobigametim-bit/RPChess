const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const client = await import(pathToFileURL(path.resolve(__dirname, '../game/js/runtime-command-client.mjs')).href);
  assert.deepStrictEqual(client.normalizeClientCommand({ type: 'PlaceDeploymentUnit', unitId: 'hero_a', square: 'b1' }), { type: 'PlaceDeploymentUnit', payload: { unitId: 'hero_a', square: 'b1' } });
  assert.deepStrictEqual(client.normalizeClientCommand({ type: 'RemoveDeploymentUnit', unitId: 'hero_a' }), { type: 'RemoveDeploymentUnit', payload: { unitId: 'hero_a' } });
  assert.deepStrictEqual(client.normalizeClientCommand({ type: 'ConfirmDeployment' }), { type: 'ConfirmDeployment' });
  const source = fs.readFileSync(path.resolve(__dirname, '../game/js/vertical-slice-presenter.mjs'), 'utf8');
  assert.ok(source.includes('renderDeployment(snapshot)'));
  assert.ok(source.includes('drawDeploymentBoard()'));
  assert.ok(source.includes('handleDeploymentPointer(event)'));
  assert.ok(source.includes('data-confirm-deployment'));
  assert.ok(source.includes('CORE_ASSETS.neutralBoard.startZone'));
  console.log('Deployment presenter browser: 1/1 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
