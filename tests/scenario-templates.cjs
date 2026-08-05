const assert = require('assert');
const path = require('path');
const { buildProductionContentBundle } = require('../src/content/production-bundle.cjs');
const {
  validateScenarioTemplateSet,
  loadScenarioTemplateSet,
  createEncounterScenario,
  createBossFromTemplates,
  validateScenarioContentReferences
} = require('../src/content/scenario-templates.cjs');
const { legalWardAwareCommands } = require('../src/combat/ward-protection.cjs');
const { createScenarioState, executeScenarioCommand } = require('../src/scenario/scenario.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const projectRoot = path.resolve(__dirname, '..');
const bundle = buildProductionContentBundle({ projectRoot });
const templates = loadScenarioTemplateSet(path.join(projectRoot, 'content/scenarios/iron_marches_vertical_slice.json'));

test('scenario templates match every compiled encounter and boss phase ID', () => {
  assert.strictEqual(validateScenarioContentReferences(templates, bundle.registry), true);
  assert.deepStrictEqual(Object.keys(templates.encounters).sort(), bundle.registry.list('encounter').map((record) => record.id).sort());
  assert.deepStrictEqual(Object.keys(templates.bosses), ['boss.iron_regent']);
  assert.deepStrictEqual(templates.bosses['boss.iron_regent'].phases.map((phase) => phase.id), ['furnace_seals', 'collapsing_fortress']);
});

test('all six encounter templates construct legal player-turn scenarios with explicit objectives', () => {
  for (const encounterId of Object.keys(templates.encounters)) {
    const created = createEncounterScenario(templates, encounterId, { seed: 100, playerSide: 'w' });
    assert.strictEqual(created.scenario.status, 'active', encounterId);
    assert.strictEqual(created.scenario.battle.position.sideToMove, 'w', encounterId);
    assert.ok(legalWardAwareCommands(created.scenario.battle).length > 0, encounterId);
    assert.ok(created.scenario.objectives.length > 0, encounterId);
    assert.ok(created.scenario.environment.objects.every((object) => object.visible), encounterId);
    assert.ok(created.reward.gold + created.reward.supplies + created.reward.meta > 0, encounterId);
  }
});

test('template identity metadata connects registered heroes and relics to battle pieces', () => {
  const created = createEncounterScenario(templates, 'encounter.iron_crossfire_files', { seed: 101 });
  const metadata = created.scenario.battle.identities.metadata.aldric_wall;
  assert.strictEqual(metadata.heroId, 'hero.aldric_wall');
  assert.deepStrictEqual(metadata.relicIds, ['relic.echo_shield']);
  assert.strictEqual(metadata.type, 'r');
  assert.strictEqual(metadata.side, 'w');
});

test('Iron Regent phase two is a legal checkmate objective with a deterministic mate in one', () => {
  const created = createBossFromTemplates(templates, 'boss.iron_regent', { seed: 202, playerSide: 'w' });
  const phase = created.template.phases[1];
  const battle = created.battleForPhase(1);
  const scenario = createScenarioState({
    scenarioId: 'iron_regent_phase_two_test',
    seed: 203,
    playerSide: 'w',
    battle,
    board: phase.board,
    completionMode: phase.completionMode,
    objectives: phase.objectives,
    failures: phase.failures,
    environment: phase.environment
  });
  const commands = legalWardAwareCommands(battle);
  const mate = commands.find((command) => command.type === 'MovePiece' && command.payload.from === 'g6' && command.payload.to === 'g7');
  assert.ok(mate, 'Qg7# must be legal');
  const result = executeScenarioCommand(scenario, mate);
  assert.strictEqual(result.state.status, 'completed');
  assert.strictEqual(result.state.result.outcome, 'victory');
  assert.strictEqual(result.state.battle.result.reason, 'checkmate');
});

test('whole-board art, frames and underlays are absent from scenario templates', () => {
  const text = JSON.stringify(templates);
  assert.strictEqual(/boardImage|completeBoard|underlay|boardFrame/.test(text), false);
  for (const template of Object.values(templates.encounters)) assert.deepStrictEqual(template.board, { width: 8, height: 8 });
});

test('invalid scenario data fails before runtime construction', () => {
  assert.throws(() => validateScenarioTemplateSet({
    schemaVersion: 1,
    scenarioSetId: 'bad',
    encounters: { 'encounter.bad': { battle: { fen: 'invalid', identitiesBySquare: { a1: 'x' } }, objectives: [{}], reward: {} } },
    bosses: { 'boss.bad': { reward: {}, phases: [{ id: 'one' }, { id: 'two' }] } }
  }), /FEN|rank|position|battle/i);
});

let failures = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL ${name}`); console.error(error.stack || error); }
}
console.log(`\nScenario templates: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
