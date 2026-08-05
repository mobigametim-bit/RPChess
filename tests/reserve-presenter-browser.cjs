const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const presenter = await import(pathToFileURL(path.resolve(__dirname, '../game/js/vertical-slice-presenter.mjs')).href);
  const scenario = {
    legalCommands: [
      { type: 'MovePiece', payload: { from: 'e2', to: 'e4' } },
      { type: 'DeployReserve', payload: { entryId: 'reserve_knight', square: 'b1' } },
      { type: 'DeployReserve', payload: { entryId: 'reserve_knight', square: 'c1' } },
      { type: 'DeployReserve', payload: { entryId: 'reserve_pawn', square: 'd1' } }
    ]
  };
  const targets = presenter.reserveTargets(scenario, 'reserve_knight');
  assert.deepStrictEqual([...targets.keys()], ['b1', 'c1']);
  assert.strictEqual(targets.get('b1').payload.entryId, 'reserve_knight');
  assert.strictEqual(presenter.reserveTargets(scenario, null).size, 0);
  assert.strictEqual(presenter.commandLabel({ type: 'DeployReserve', payload: { entryId: 'reserve_knight', square: 'b1' } }), 'Резерв: reserve_knight → b1');
  const styles = presenter.createPresenterStyles();
  assert.ok(styles.includes('rpvs__reserve-card'));
  assert.ok(styles.includes('rpvs__order'));
  const source = fs.readFileSync(path.resolve(__dirname, '../game/js/vertical-slice-presenter.mjs'), 'utf8');
  assert.ok(source.includes('CORE_ASSETS.neutralBoard.startZone'));
  assert.ok(source.includes('data-reserve-entry'));
  assert.ok(source.includes('selectedReserveEntryId'));
  console.log('Reserve presenter browser: 1/1 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
