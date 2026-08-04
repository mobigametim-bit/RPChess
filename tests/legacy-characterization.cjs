const assert = require('assert');
const {
  MemoryStorage,
  loadLegacyRuntime,
  normalizeChoices,
  normalizeBattle
} = require('./legacy-harness.cjs');

const tests = [];
function test(name, contract, fn) { tests.push({ name, contract, fn }); }
function json(value) { return JSON.parse(JSON.stringify(value)); }
function destinations(moves) {
  return moves.map(({ x, y, capture }) => `${x},${y}${capture ? 'x' : ''}`).sort();
}

function fixedGame(seed = 123456) {
  const runtime = loadLegacyRuntime();
  const game = new runtime.NC.Game(runtime.NC.defaultProfile());
  game.startRun('warlord', 'normal', false, seed, 'Аудитор');
  return { ...runtime, game };
}

test('RNG sequence is stable for known seeds', 'PRESERVE', () => {
  const { NC } = loadLegacyRuntime();
  const expected = {
    1: [270369, 67634689, 2647435461, 307599695, 2398689233],
    42: [11355432, 2836018348, 476557059, 3648046016, 3759983556],
    123456: [3044438244, 372467569, 561134079, 2951787001, 2151050974]
  };
  for (const [seed, sequence] of Object.entries(expected)) {
    const rng = new NC.RNG(Number(seed));
    assert.deepStrictEqual(sequence.map(() => rng.nextU32()), sequence);
  }
});

test('fixed seed produces the current campaign opening', 'PRESERVE-UNTIL-GENERATOR-MIGRATION', () => {
  const { game } = fixedGame(123456);
  assert.deepStrictEqual(json(normalizeChoices(game.run.choices)), [
    { type: 'battle', danger: 2, secret: false, seed: 2951787001 },
    { type: 'battle', danger: 2, secret: false, seed: 1590560596 }
  ]);
  assert.strictEqual(game.run.act, 1);
  assert.strictEqual(game.run.step, 0);
  assert.strictEqual(game.run.maxSteps, 5);
  assert.strictEqual(game.run.squad.length, 4);
  assert.strictEqual(game.run.maxSquad, 5);
  assert.strictEqual(game.run.heroName, 'Аудитор');
});

test('fixed opening battle layout remains reproducible', 'PRESERVE-AS-LEGACY-FIXTURE', () => {
  const { game } = fixedGame(123456);
  game.enterNode(game.run.choices[0].id);
  const battle = normalizeBattle(game.battle);
  assert.strictEqual(battle.size, 6);
  assert.strictEqual(battle.seed, 2951787001);
  assert.strictEqual(battle.objectiveType, 'eliminate');
  assert.deepStrictEqual(battle.blocked, ['2,2', '3,3']);
  assert.deepStrictEqual(battle.units.map((unit) => `${unit.team}:${unit.type}@${unit.x},${unit.y}`), [
    'enemy:core@2,0',
    'enemy:process@0,1',
    'enemy:process@1,0',
    'enemy:process@3,0',
    'player:bastion@2,4',
    'player:core@2,5',
    'player:injector@0,4',
    'player:process@1,5',
    'player:process@3,5'
  ]);
});

test('legacy movement geometry remains characterized', 'PRESERVE-GEOMETRY-THEN-REIMPLEMENT-LEGALITY', () => {
  const { game } = fixedGame();
  game.enterNode(game.run.choices[0].id);
  const make = (type, team, x, y) => game.makeBattleUnit(type, team, x, y, null, 1);

  const pawn = make('process', 'player', 2, 4);
  game.battle.units = [pawn, make('process', 'enemy', 1, 3), make('process', 'enemy', 3, 3)];
  game.battle.blocked = [];
  assert.deepStrictEqual(destinations(game.movementFor(pawn)), ['1,3x', '2,3', '3,3x']);

  const knight = make('injector', 'player', 2, 2);
  game.battle.units = [knight];
  assert.deepStrictEqual(destinations(game.movementFor(knight)), [
    '0,1', '0,3', '1,0', '1,4', '3,0', '3,4', '4,1', '4,3'
  ]);

  const bishop = make('scanner', 'player', 2, 2);
  game.battle.units = [bishop, make('process', 'player', 3, 3), make('process', 'enemy', 1, 1)];
  assert.deepStrictEqual(destinations(game.movementFor(bishop)), ['0,4', '1,1x', '1,3', '3,1', '4,0']);

  const rook = make('bastion', 'player', 2, 2);
  game.battle.units = [rook];
  assert.strictEqual(game.movementFor(rook).length, 10);

  const queen = make('battle_ai', 'player', 2, 2);
  game.battle.units = [queen];
  assert.strictEqual(game.movementFor(queen).length, 19);

  const king = make('core', 'player', 2, 2);
  game.battle.units = [king];
  assert.strictEqual(game.movementFor(king).length, 8);
});

test('a ward absorbs the current capture and attacker stays in origin', 'PRESERVE-EFFECT-BEHAVIOR', () => {
  const { game } = fixedGame();
  game.enterNode(game.run.choices[0].id);
  const playerCore = game.makeBattleUnit('core', 'player', 5, 5, null, 1);
  const enemyCore = game.makeBattleUnit('core', 'enemy', 5, 0, null, 1);
  const attacker = game.makeBattleUnit('process', 'player', 2, 4, null, 1);
  const target = game.makeBattleUnit('process', 'enemy', 1, 3, null, 1);
  target.shield = 1;
  game.battle.units = [playerCore, enemyCore, attacker, target];
  game.battle.blocked = [];
  game.battle.phase = 'player';
  game.battle.status = 'active';
  game.battle.objectiveType = 'eliminate';

  const result = game.move(attacker.uid, 1, 3);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(target.alive, true);
  assert.strictEqual(target.shield, 0);
  assert.deepStrictEqual([attacker.x, attacker.y], [2, 4]);
  assert.strictEqual(attacker.acted, true);
});

test('legacy enemy turn resolves synchronously as a whole-side batch', 'INTENTIONALLY-CHANGE-IN-COMBAT-SCHEDULER', () => {
  const { game } = fixedGame();
  game.enterNode(game.run.choices[0].id);
  const beforeRound = game.battle.round;
  game.endPlayerTurn();
  assert.strictEqual(game.battle.status, 'active');
  assert.strictEqual(game.battle.phase, 'player');
  assert.strictEqual(game.battle.round, beforeRound + 1);
});

test('profile save/load round trip preserves active run decisions', 'PRESERVE-DATA-THEN-MIGRATE-ATOMically', () => {
  const storage = new MemoryStorage();
  const runtime = loadLegacyRuntime({ storage });
  const game = new runtime.NC.Game(runtime.NC.defaultProfile());
  game.startRun('engineer', 'hard', true, 424242, 'Длинное Имя Героя');
  game.run.credits = 77;
  game.run.artifacts.push('echo_shield');
  game.save();

  const loaded = runtime.NC.Storage.load();
  assert.strictEqual(loaded.currentRun.seed, 424242);
  assert.strictEqual(loaded.currentRun.commanderId, 'engineer');
  assert.strictEqual(loaded.currentRun.difficulty, 'hard');
  assert.strictEqual(loaded.currentRun.permadeath, true);
  assert.strictEqual(loaded.currentRun.heroName, 'Длинное Имя Героя');
  assert.strictEqual(loaded.currentRun.credits, 77);
  assert.deepStrictEqual(json(loaded.currentRun.artifacts), ['echo_shield']);
});

test('shop does not offer a recruit when legacy squad is at capacity', 'PRESERVE-REGRESSION', () => {
  const { game } = fixedGame();
  game.run.squad.push({
    id: 'capacity_fixture', type: 'process', name: 'Fixture', level: 1, xp: 0,
    upgrade: null, wounded: false, captures: 0, missions: 0, history: []
  });
  game.run.currentNode = { type: 'shop', seed: 17 };
  assert.strictEqual(game.run.squad.length, game.run.maxSquad);
  assert.strictEqual(game.getShopStock().some((item) => item.type === 'recruit'), false);
});

let failures = 0;
for (const { name, contract, fn } of tests) {
  try {
    fn();
    console.log(`PASS [${contract}] ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL [${contract}] ${name}`);
    console.error(error.stack || error);
  }
}

console.log(`\nLegacy characterization: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
