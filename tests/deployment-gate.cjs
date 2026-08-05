const assert = require('assert');
const path = require('path');
const { buildProductionContentBundle } = require('../src/content/production-bundle.cjs');
const { createEncounterScenario, loadScenarioTemplateSet } = require('../src/content/scenario-templates.cjs');
const { createRuntimeArmy, projectArmyBattleOptions } = require('../src/runtime/army-roster.cjs');
const {
  createScenarioDeploymentGate,
  executeDeploymentEdit,
  finalizeScenarioDeployment,
  deploymentGateSnapshot
} = require('../src/runtime/deployment-gate.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const projectRoot = path.resolve(__dirname, '..');
const bundle = buildProductionContentBundle({ projectRoot });
const scenarioTemplates = loadScenarioTemplateSet(path.join(projectRoot, 'content/scenarios/iron_marches_vertical_slice.json'));

function fixture(seed = 19001) {
  const created = createEncounterScenario(scenarioTemplates, 'encounter.iron_crossfire_files', {
    seed,
    playerSide: 'w',
    scenarioId: `deployment_fixture_${seed}`
  });
  return createScenarioDeploymentGate(created.scenario, {
    seed,
    playerSide: 'w',
    localization: bundle.localization.ru
  });
}

function projectedFixture(seed = 19020) {
  const heroIds = bundle.registry.list('hero').map((hero) => hero.id);
  const army = createRuntimeArmy({
    regionId: 'region.iron_marches',
    kingId: 'king.oathkeeper',
    doctrineId: 'doctrine.fortress',
    heroIds
  }, bundle.registry, bundle.combatProfiles);
  const created = createEncounterScenario(scenarioTemplates, 'encounter.iron_crossfire_files', {
    seed,
    playerSide: 'w',
    scenarioId: `projected_deployment_fixture_${seed}`,
    battleProjector: (options) => projectArmyBattleOptions(options, army)
  });
  return createScenarioDeploymentGate(created.scenario, {
    seed,
    playerSide: 'w',
    localization: bundle.localization.ru
  });
}

test('deployment gate derives a legal zone and preserves initial production placement', () => {
  const gate = fixture();
  const snapshot = deploymentGateSnapshot(gate);
  assert.strictEqual(snapshot.format, 'rpchess-deployment-presenter');
  assert.strictEqual(snapshot.canConfirm, true);
  assert.strictEqual(snapshot.units.filter((unit) => unit.inReserve).length, 0);
  assert.ok(snapshot.zone.includes('a1'));
  assert.ok(snapshot.zone.includes('h2'));
  assert.ok(snapshot.units.some((unit) => unit.type === 'k' && unit.fixed));
  assert.strictEqual(snapshot.commandSpent, snapshot.commandLimit);
});

test('optional unit can move inside the zone without mutating the previous gate', () => {
  const gate = fixture(19002);
  const initial = deploymentGateSnapshot(gate);
  const unit = initial.units.find((candidate) => !candidate.fixed && !candidate.required);
  assert.ok(unit);
  const occupied = new Set(initial.units.map((candidate) => candidate.square).filter(Boolean));
  const target = initial.zone.find((square) => !occupied.has(square));
  assert.ok(target);
  const moved = executeDeploymentEdit(gate, { type: 'PlaceDeploymentUnit', payload: { unitId: unit.id, square: target } });
  assert.strictEqual(deploymentGateSnapshot(moved).units.find((candidate) => candidate.id === unit.id).square, target);
  assert.strictEqual(deploymentGateSnapshot(gate).units.find((candidate) => candidate.id === unit.id).square, unit.square);
  assert.strictEqual(moved.revision, 1);
});

test('removed optional unit becomes a battle reserve with legal deployment cells', () => {
  const gate = fixture(19003);
  const unit = deploymentGateSnapshot(gate).units.find((candidate) => !candidate.fixed && !candidate.required);
  const edited = executeDeploymentEdit(gate, { type: 'RemoveDeploymentUnit', payload: { unitId: unit.id } });
  const snapshot = deploymentGateSnapshot(edited);
  assert.strictEqual(snapshot.units.find((candidate) => candidate.id === unit.id).inReserve, true);
  assert.ok(snapshot.commandSpent < snapshot.commandLimit);
  const finalized = finalizeScenarioDeployment(edited);
  const reserve = finalized.battle.reserve.find((entry) => entry.id === unit.id);
  assert.ok(reserve);
  assert.strictEqual(reserve.orderCost > 0, true);
  assert.ok(finalized.battle.reserveCells.w.includes('a1'));
  assert.strictEqual(finalized.scenario.actionIndex, 0);
});

test('selected reserve heroes participate in deployment without appearing twice', () => {
  const gate = projectedFixture(19021);
  const initial = deploymentGateSnapshot(gate);
  const aldric = initial.units.find((unit) => unit.metadata.heroId === 'hero.aldric_wall');
  const tomas = initial.units.find((unit) => unit.metadata.heroId === 'hero.tomas_gate');
  assert.ok(aldric);
  assert.ok(tomas);
  assert.strictEqual(aldric.inReserve, false);
  assert.strictEqual(tomas.inReserve, true);
  assert.strictEqual(tomas.type, 'r');
  assert.strictEqual(initial.commandLimit, 5);
  assert.strictEqual(initial.units.filter((unit) => unit.metadata.heroId).length, 6);

  let edited = executeDeploymentEdit(gate, { type: 'RemoveDeploymentUnit', payload: { unitId: aldric.id } });
  edited = executeDeploymentEdit(edited, { type: 'PlaceDeploymentUnit', payload: { unitId: tomas.id, square: 'a1' } });
  const finalized = finalizeScenarioDeployment(edited);
  const activeId = finalized.battle.identities.bySquare.a1;
  assert.strictEqual(finalized.battle.identities.metadata[activeId].heroId, 'hero.tomas_gate');
  assert.deepStrictEqual(finalized.battle.identities.metadata[activeId].relicIds, ['relic.twin_command']);
  const aldricReserve = finalized.battle.reserve.find((entry) => entry.metadata.heroId === 'hero.aldric_wall');
  assert.ok(aldricReserve);

  const heroIds = [
    ...Object.values(finalized.battle.identities.metadata).map((metadata) => metadata.heroId).filter(Boolean),
    ...finalized.battle.reserve.map((entry) => entry.metadata.heroId).filter(Boolean)
  ];
  assert.strictEqual(heroIds.length, 6);
  assert.strictEqual(new Set(heroIds).size, 6);
});

test('fixed king cannot be removed and required units block confirmation when absent', () => {
  const gate = fixture(19004);
  const snapshot = deploymentGateSnapshot(gate);
  const king = snapshot.units.find((unit) => unit.type === 'k');
  assert.throws(() => executeDeploymentEdit(gate, { type: 'RemoveDeploymentUnit', payload: { unitId: king.id } }), /fixed/);
  const required = snapshot.units.find((unit) => unit.required && !unit.fixed);
  if (required) {
    const edited = executeDeploymentEdit(gate, { type: 'RemoveDeploymentUnit', payload: { unitId: required.id } });
    assert.strictEqual(deploymentGateSnapshot(edited).canConfirm, false);
    assert.throws(() => finalizeScenarioDeployment(edited), /missing required units/);
  }
});

test('same scenario and deployment edits finalize byte-equivalently', () => {
  const first = fixture(19005);
  const second = fixture(19005);
  const unit = deploymentGateSnapshot(first).units.find((candidate) => !candidate.fixed && !candidate.required);
  const firstEdited = executeDeploymentEdit(first, { type: 'RemoveDeploymentUnit', payload: { unitId: unit.id } });
  const secondEdited = executeDeploymentEdit(second, { type: 'RemoveDeploymentUnit', payload: { unitId: unit.id } });
  assert.deepStrictEqual(secondEdited, firstEdited);
  assert.deepStrictEqual(finalizeScenarioDeployment(secondEdited), finalizeScenarioDeployment(firstEdited));
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
  }
}
console.log(`\nDeployment gate: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
