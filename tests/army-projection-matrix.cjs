const assert = require('assert');
const { squareToIndex } = require('../src/core/chess/position.cjs');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');
const { DEFAULT_BROWSER_SELECTION } = require('../src/browser/iron-marches-browser-host.cjs');
const { createEncounterScenario, createBossFromTemplates } = require('../src/content/scenario-templates.cjs');
const { createRuntimeArmy, projectArmyBattleOptions } = require('../src/runtime/army-roster.cjs');

const bundle = buildBrowserProductionBundle();
const heroIds = DEFAULT_BROWSER_SELECTION.heroIds.slice();
const encounterIds = bundle.registry.list('encounter').map((record) => record.id).sort();
assert.strictEqual(heroIds.length, 6);
assert.strictEqual(encounterIds.length, 6, `expected six authored encounters, got ${encounterIds.length}`);

function subsets(values) {
  const result = [];
  for (let mask = 1; mask < (1 << values.length); mask += 1) {
    result.push(values.filter((_value, index) => mask & (1 << index)));
  }
  return result;
}

function createArmy(selected) {
  return createRuntimeArmy({
    regionId: DEFAULT_BROWSER_SELECTION.regionId,
    kingId: DEFAULT_BROWSER_SELECTION.kingId,
    doctrineId: DEFAULT_BROWSER_SELECTION.doctrineId,
    heroIds: selected
  }, bundle.registry, bundle.combatProfiles);
}

function cloneWithoutArmyIdentity(value) {
  const clone = JSON.parse(JSON.stringify(value));
  if (clone.battle) {
    delete clone.battle.identities;
    delete clone.battle.reserve;
  } else {
    delete clone.identities;
    delete clone.reserve;
  }
  return clone;
}

function heroOccurrences(battle) {
  const result = [];
  for (const [pieceId, metadata] of Object.entries(battle.identities.metadata)) {
    if (metadata.heroId) result.push({ heroId: metadata.heroId, metadata, location: `active:${pieceId}` });
  }
  for (const entry of battle.reserve || []) {
    if (entry.metadata?.heroId) result.push({ heroId: entry.metadata.heroId, metadata: entry.metadata, location: `reserve:${entry.id}` });
  }
  return result;
}

function assertIdentityIntegrity(battle) {
  const activeIds = Object.values(battle.identities.bySquare);
  assert.strictEqual(new Set(activeIds).size, activeIds.length, 'active identity ids must be unique');
  for (const [square, pieceId] of Object.entries(battle.identities.bySquare)) {
    const piece = battle.position.board[squareToIndex(square)];
    assert.ok(piece, `identity ${pieceId} has no board piece on ${square}`);
    assert.strictEqual(battle.identities.metadata[pieceId].side, piece.side);
    assert.strictEqual(battle.identities.metadata[pieceId].currentType, piece.type);
  }
  const reserveIds = (battle.reserve || []).map((entry) => entry.id);
  assert.strictEqual(new Set(reserveIds).size, reserveIds.length, 'reserve identity ids must be unique');
  for (const id of reserveIds) assert.strictEqual(activeIds.includes(id), false, `${id} exists in active field and reserve`);
}

function assertArmyBindings(baseBattle, projectedBattle, army, label) {
  assertIdentityIntegrity(projectedBattle);
  const occurrences = heroOccurrences(projectedBattle);
  const occurrenceIds = occurrences.map((entry) => entry.heroId);
  assert.deepStrictEqual([...occurrenceIds].sort(), [...army.heroIds].sort(), `${label}: projected hero set`);
  assert.strictEqual(new Set(occurrenceIds).size, occurrenceIds.length, `${label}: duplicate selected hero`);
  for (const occurrence of occurrences) {
    const profile = bundle.combatProfiles.heroes[occurrence.heroId];
    assert.ok(profile, `${label}: missing combat profile for ${occurrence.heroId}`);
    assert.deepStrictEqual(occurrence.metadata.relicIds, profile.relicIds, `${label}: relic binding for ${occurrence.heroId}`);
    assert.strictEqual(occurrence.metadata.armySource, 'selected', `${label}: army source for ${occurrence.heroId}`);
    assert.strictEqual(occurrence.metadata.combatPieceType, profile.battlePieceType, `${label}: combat type for ${occurrence.heroId}`);
    if (occurrence.heroId === 'hero.tomas_gate') {
      assert.strictEqual(occurrence.metadata.combatProfileOverride, 'escort_scenario_uses_rook_profile', `${label}: Tomas override`);
      assert.strictEqual(occurrence.metadata.combatPieceType, 'rook', `${label}: Tomas battle type`);
      assert.deepStrictEqual(occurrence.metadata.relicIds, ['relic.twin_command'], `${label}: Tomas relic`);
    }
  }
  for (const [pieceId, baseMetadata] of Object.entries(baseBattle.identities.metadata)) {
    if (!baseMetadata.heroId) continue;
    const projected = projectedBattle.identities.metadata[pieceId];
    assert.ok(projected, `${label}: projected metadata missing for ${pieceId}`);
    if (!projected.heroId) {
      assert.strictEqual(projected.anonymous, true, `${label}: unfilled authored role ${pieceId} must be anonymous`);
      assert.strictEqual(projected.armySource, 'scenario_role', `${label}: anonymous role source ${pieceId}`);
    } else {
      assert.ok(army.heroIds.includes(projected.heroId), `${label}: authored role leaked unselected hero ${projected.heroId}`);
    }
  }
}

let encounterCases = 0;
let bossBattleCases = 0;
for (const selected of subsets(heroIds)) {
  const army = createArmy(selected);
  for (const encounterId of encounterIds) {
    const seed = 19000 + encounterCases;
    const base = createEncounterScenario(bundle.scenarioTemplates, encounterId, {
      seed,
      playerSide: 'w'
    });
    const projected = createEncounterScenario(bundle.scenarioTemplates, encounterId, {
      seed,
      playerSide: 'w',
      battleProjector: (options) => projectArmyBattleOptions(options, army)
    });
    assert.deepStrictEqual(cloneWithoutArmyIdentity(projected.scenario), cloneWithoutArmyIdentity(base.scenario), `${encounterId}: non-army scenario content changed`);
    assert.deepStrictEqual(projected.reward, base.reward, `${encounterId}: reward changed`);
    assertArmyBindings(base.scenario.battle, projected.scenario.battle, army, `${encounterId}:${selected.join(',')}`);
    encounterCases += 1;
  }

  const seed = 29000 + bossBattleCases;
  const baseBoss = createBossFromTemplates(bundle.scenarioTemplates, 'boss.iron_regent', {
    seed,
    playerSide: 'w'
  });
  const projectedBoss = createBossFromTemplates(bundle.scenarioTemplates, 'boss.iron_regent', {
    seed,
    playerSide: 'w',
    battleProjector: (options) => projectArmyBattleOptions(options, army)
  });
  const baseBattles = [baseBoss.state.scenario.battle, baseBoss.battleForPhase(1)];
  const projectedBattles = [projectedBoss.state.scenario.battle, projectedBoss.battleForPhase(1)];
  for (let phase = 0; phase < 2; phase += 1) {
    assert.deepStrictEqual(cloneWithoutArmyIdentity(projectedBattles[phase]), cloneWithoutArmyIdentity(baseBattles[phase]), `boss phase ${phase + 1}: non-army battle content changed`);
    assertArmyBindings(baseBattles[phase], projectedBattles[phase], army, `boss:${phase + 1}:${selected.join(',')}`);
    bossBattleCases += 1;
  }
}

assert.strictEqual(encounterCases, 63 * 6);
assert.strictEqual(bossBattleCases, 63 * 2);
console.log(`Army projection matrix: ${encounterCases} encounter cases + ${bossBattleCases} boss phase cases passed.`);
