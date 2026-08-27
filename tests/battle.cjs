const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

(async () => {
  const game = path.resolve(__dirname, '..', 'game');
  const data = await import(pathToFileURL(path.join(game, 'js/roster-data.mjs')).href);
  const battle = await import(pathToFileURL(path.join(game, 'js/battle-core.mjs')).href);
  const persistence = await import(pathToFileURL(path.join(game, 'js/run-persistence.mjs')).href);

  const roster = data.createStarterRoster();
  const selected = battle.defaultBattleSelection(roster);
  assert.strictEqual(selected.length, 6, 'all healthy starter named pieces must be selected by default');
  assert(selected.includes('king.oathkeeper'), 'mandatory personalized King must be selected');

  const validation = battle.validateBattleSelection(roster, selected);
  assert.strictEqual(validation.ok, true);
  assert.deepStrictEqual(validation.typeCounts, { king: 1, queen: 0, rook: 1, bishop: 1, knight: 1, pawn: 2 });
  assert.deepStrictEqual(battle.SLOT_CAPACITY, { king: 1, queen: 1, rook: 2, bishop: 2, knight: 2, pawn: 8 });
  assert.strictEqual(battle.BATTLE_PIECE_COUNT, 16);
  assert.strictEqual(battle.BATTLE_ARMY_POINTS, 39);
  assert.strictEqual(battle.STANDARD_FEN, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

  const plan = battle.createBattlePlan({ roster, selectedIds: selected, encounter: battle.createBattleEncounter({ seed: 'battle-test', stars: 3 }) });
  assert.strictEqual(plan.fen, battle.STANDARD_FEN, 'Battle must always start from the standard classical position');
  assert.strictEqual(plan.playerFormation.length, 16, 'player Battle formation must contain the full army');
  assert.strictEqual(plan.enemyFormation.length, 16, 'enemy Battle formation must contain the full army');
  assert.strictEqual(plan.playerFormation.filter((entry) => entry.id).length, 6, 'starter named pieces must replace six standard slots');
  assert.strictEqual(plan.playerFormation.filter((entry) => !entry.id).length, 10, 'remaining player slots must be temporary generic pieces');
  assert.strictEqual(plan.playerFormation.find((entry) => entry.pieceType === 'king').square, 'e1');
  assert.strictEqual(plan.playerFormation.find((entry) => entry.pieceType === 'king').id, 'king.oathkeeper');
  assert.strictEqual(plan.enemyFormation.find((entry) => entry.pieceType === 'king').square, 'e8');
  assert.strictEqual(plan.enemyFormation.every((entry) => !entry.id), true, 'enemy Battle army is generic in v1');
  assert.deepStrictEqual(plan.participants, selected, 'Battle must persist named participation separately from temporary army');

  const extraRooks = [
    { ...roster.find((entry) => entry.pieceType === 'rook'), id: 'test.rook.2', name: 'Вторая ладья' },
    { ...roster.find((entry) => entry.pieceType === 'rook'), id: 'test.rook.3', name: 'Третья ладья' }
  ];
  const crowded = [...roster, ...extraRooks];
  const defaultCrowded = battle.defaultBattleSelection(crowded);
  assert.strictEqual(battle.selectedTypeCounts(crowded, defaultCrowded).rook, 2, 'default selection must never overflow two Rook slots');
  const overflow = battle.validateBattleSelection(crowded, [...defaultCrowded, 'test.rook.3']);
  assert.strictEqual(overflow.ok, false);
  assert.strictEqual(overflow.reason, 'slot_limit');
  assert.strictEqual(overflow.pieceType, 'rook');
  assert.strictEqual(overflow.capacity, 2);

  const unavailable = roster.map((entry) => entry.id === 'hero.mara_chain' ? { ...entry, status: 'wounded' } : entry);
  const unavailableDefault = battle.defaultBattleSelection(unavailable);
  assert(!unavailableDefault.includes('hero.mara_chain'), 'wounded named piece must not be auto-selected');
  assert.strictEqual(battle.validateBattleSelection(unavailable, [...unavailableDefault, 'hero.mara_chain']).reason, 'character_unavailable');

  const run = persistence.createRun({ id: 'battle-run', now: 1000 });
  const woundedOutcome = battle.applyBattleOutcome(run, {
    participantIds: selected,
    capturedIds: ['hero.mara_chain'],
    status: { over: true, type: 'checkmate', winner: 'w' },
    playerColor: 'w'
  });
  assert.strictEqual(woundedOutcome.roster.find((entry) => entry.id === 'hero.mara_chain').status, 'wounded');
  assert.strictEqual(woundedOutcome.roster.find((entry) => entry.id === 'hero.mara_chain').pieceType, 'pawn', 'Battle outcome must never permanently promote a personalized Pawn');
  assert.strictEqual(woundedOutcome.ended, false);
  assert.deepStrictEqual(woundedOutcome.lastBattle.participants, selected);

  const drawOutcome = battle.applyBattleOutcome(run, {
    participantIds: selected,
    capturedIds: ['hero.vael_hammer'],
    status: { over: true, type: 'stalemate', winner: null },
    playerColor: 'w'
  });
  assert.strictEqual(drawOutcome.roster.find((entry) => entry.isRunKing).status, 'healthy', 'draw must not kill the King');
  assert.strictEqual(drawOutcome.roster.find((entry) => entry.id === 'hero.vael_hammer').status, 'wounded');

  const loss = battle.applyBattleOutcome(run, {
    participantIds: selected,
    capturedIds: [],
    status: { over: true, type: 'checkmate', winner: 'b' },
    playerColor: 'w'
  });
  assert.strictEqual(loss.roster.find((entry) => entry.isRunKing).status, 'dead');
  assert.strictEqual(loss.ended, true);
  assert.strictEqual(loss.endReason, 'king_dead');
  assert.strictEqual(loss.lastBattle.kingDied, true);

  console.log('Battle standard army, slot replacement, participation, wounds and King-death deterministic contract: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
