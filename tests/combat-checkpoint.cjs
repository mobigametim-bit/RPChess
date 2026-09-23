const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

(async () => {
  const fromGame = filename => pathToFileURL(path.join(__dirname, '..', 'game/js', filename)).href;
  const { createRun, writeRun, readRun } = await import(fromGame('run-persistence.mjs'));
  const { ClassicChessEngine } = await import(fromGame('classic-chess-engine.mjs'));
  const { isCombatCheckpoint, checkpointFor, combatMoves } = await import(fromGame('combat-checkpoint.mjs'));
  const battle = await import(fromGame('battle-core.mjs'));
  const skirmish = await import(fromGame('skirmish-core.mjs'));

  for (const [type, core] of [['battle', battle], ['skirmish', skirmish]]) {
    const store = new MemoryStorage();
    const initial = createRun({ now:100, playerName:'Checkpoint Tester' });
    const encounter = type === 'battle'
      ? core.createBattleEncounter({ seed:'checkpoint-battle', stars:5 })
      : core.createEncounter({ seed:'checkpoint-skirmish', stars:5 });
    const selectedIds = type === 'battle'
      ? core.defaultBattleSelection(initial.roster)
      : core.defaultCombatSelection(initial.roster);
    const plan = core.createBattlePlan({ roster:initial.roster, selectedIds, encounter });
    let current = writeRun({ ...initial, currentCombat:{ type, encounterId:encounter.id, selectedIds, moves:[] } }, store, 110);
    const engine = new ClassicChessEngine(plan.fen, { blockedSquares:plan.blockedSquares });
    const log = [];
    for (let index = 0; index < 2; index += 1) {
      const candidate = engine.legalMoves()[0];
      const move = engine.move(candidate.from, candidate.uciTo || candidate.to, candidate.promotion || null);
      assert(move.ok, `${type} move ${index + 1} must be legal`);
      log.push({ move:move.move });
      current = writeRun({ ...current, currentCombat:{ ...current.currentCombat, moves:combatMoves(log) } }, store, 120 + index);
    }
    assert(isCombatCheckpoint(current.currentCombat));
    const persisted = readRun(store);
    assert.deepStrictEqual(checkpointFor(persisted, type, encounter), current.currentCombat);
    const restoredPlan = core.createBattlePlan({ roster:persisted.roster, selectedIds:persisted.currentCombat.selectedIds, encounter });
    assert.strictEqual(restoredPlan.fen, plan.fen, `${type} formation must be stable after reload`);
    const replay = new ClassicChessEngine(restoredPlan.fen, { blockedSquares:restoredPlan.blockedSquares });
    for (const move of persisted.currentCombat.moves) assert(replay.move(move.from, move.to, move.promotion).ok);
    assert.strictEqual(replay.fen(), engine.fen(), `${type} must restore the exact board position`);
    assert.strictEqual(persisted.gold, initial.gold, `${type} moves cannot spend resources`);
    const settled = writeRun({ ...persisted, currentCombat:null }, store, 200);
    assert.strictEqual(readRun(store).currentCombat, null, `${type} completed combat must not resume`);
    assert.strictEqual(checkpointFor(settled, type, encounter), null);
  }
  assert(!isCombatCheckpoint({ type:'battle', encounterId:'x', selectedIds:['king'], moves:[{ from:'z9', to:'e4' }] }));
  console.log('Battle/Skirmish checkpoint round-trip, move replay and settlement cleanup: PASS');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
