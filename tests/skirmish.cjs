const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const root = path.resolve(__dirname, '..');
  const rosterData = await import(pathToFileURL(path.join(root, 'game/js/roster-data.mjs')).href);
  const skirmish = await import(pathToFileURL(path.join(root, 'game/js/skirmish-core.mjs')).href);

  const roster = rosterData.createStarterRoster();
  const selected = skirmish.defaultCombatSelection(roster);
  assert.strictEqual(selected.length, 6, 'starter healthy roster should be preselected');
  const valid = skirmish.validateSelection(roster, selected);
  assert.strictEqual(valid.ok, true);
  assert.strictEqual(valid.points, 13);
  assert.strictEqual(valid.count, 6);
  assert.ok(selected.includes('king.oathkeeper'));

  const noKing = skirmish.validateSelection(roster, selected.filter((id) => id !== 'king.oathkeeper'));
  assert.strictEqual(noKing.reason, 'king_required');

  const wounded = roster.map((character) => character.id === 'hero.vael_hammer' ? { ...character, status: 'wounded' } : character);
  assert.strictEqual(skirmish.validateSelection(wounded, selected).reason, 'character_unavailable');

  const oversized = [roster[0], ...Array.from({ length: 16 }, (_, index) => ({
    id: `pawn.${index}`,
    name: `Pawn ${index}`,
    pieceType: 'pawn',
    commandCost: 1,
    status: 'healthy',
    isRunKing: false
  }))];
  assert.strictEqual(skirmish.validateSelection(oversized, oversized.map((item) => item.id)).reason, 'piece_limit');

  const expensive = [roster[0], ...Array.from({ length: 5 }, (_, index) => ({
    id: `queen.${index}`,
    name: `Queen ${index}`,
    pieceType: 'queen',
    commandCost: 9,
    status: 'healthy',
    isRunKing: false
  }))];
  assert.strictEqual(skirmish.validateSelection(expensive, expensive.map((item) => item.id)).reason, 'point_limit');

  const encounter = skirmish.createEncounter({ seed: 'test-seed', stars: 2 });
  const planA = skirmish.createBattlePlan({ roster, selectedIds: selected, encounter });
  const planB = skirmish.createBattlePlan({ roster, selectedIds: selected, encounter });
  assert.strictEqual(planA.fen, planB.fen, 'same seed/composition must generate same FEN');
  assert.deepStrictEqual(planA.enemyFormation, planB.enemyFormation, 'enemy formation must be deterministic');
  assert.ok(/^[rnbqkpRNBQKP1-8\/]+ w - - 0 1$/.test(planA.fen));
  assert.strictEqual(planA.playerFormation.filter((piece) => piece.pieceType === 'king').length, 1);
  assert.strictEqual(planA.enemyFormation.filter((piece) => piece.pieceType === 'king').length, 1);
  assert.ok(planA.playerFormation.every((piece) => ['1', '2'].includes(piece.square[1])));
  assert.ok(planA.enemyFormation.every((piece) => ['7', '8'].includes(piece.square[1])));
  assert.ok(planA.enemyPoints <= 39);
  assert.ok(planA.enemyFormation.length <= 16);

  const run = { id: 'run-test', roster, ended: false };
  const winOutcome = skirmish.applyBattleOutcome(run, {
    capturedIds: ['hero.aldric_wall'],
    status: { type: 'checkmate', winner: 'w' },
    playerColor: 'w'
  });
  assert.strictEqual(winOutcome.roster.find((c) => c.id === 'hero.aldric_wall').status, 'wounded');
  assert.strictEqual(winOutcome.roster.find((c) => c.isRunKing).status, 'healthy');
  assert.strictEqual(winOutcome.ended, false);

  const drawOutcome = skirmish.applyBattleOutcome(run, {
    capturedIds: ['hero.mara_chain'],
    status: { type: 'stalemate', winner: null },
    playerColor: 'w'
  });
  assert.strictEqual(drawOutcome.roster.find((c) => c.id === 'hero.mara_chain').status, 'wounded');
  assert.strictEqual(drawOutcome.roster.find((c) => c.isRunKing).status, 'healthy');

  const lossOutcome = skirmish.applyBattleOutcome(run, {
    capturedIds: [],
    status: { type: 'checkmate', winner: 'b' },
    playerColor: 'w'
  });
  assert.strictEqual(lossOutcome.roster.find((c) => c.isRunKing).status, 'dead');
  assert.strictEqual(lossOutcome.ended, true);
  assert.strictEqual(lossOutcome.endReason, 'king_dead');

  console.log('Skirmish core deterministic tests: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
