const assert = require('assert');
const { parseFen } = require('../src/core/chess/position.cjs');
const { createBattleState } = require('../src/combat/battle.cjs');
const {
  createScenarioDeploymentGate,
  finalizeScenarioDeployment
} = require('../src/runtime/deployment-gate.cjs');

const battle = createBattleState({
  battleId: 'deployment_ability_fixture',
  seed: 31,
  playerSide: 'w',
  position: parseFen('4k3/8/8/8/2R5/2B5/8/4K3 w - - 0 1'),
  identitiesBySquare: {
    e8: 'black_king',
    c4: 'ally_rook',
    c3: 'orell',
    e1: 'white_king'
  },
  identityMetadata: {
    black_king: { side: 'b', type: 'k' },
    ally_rook: { side: 'w', type: 'r' },
    orell: { side: 'w', type: 'b', heroId: 'hero.brother_orell', relicIds: ['relic.circle_warding'] },
    white_king: { side: 'w', type: 'k' }
  },
  statuses: {
    ally_rook: {
      pieceId: 'ally_rook',
      id: 'ward',
      sourceId: 'relic.echo_shield',
      appliedAtAction: 0,
      expiry: null,
      data: { effectId: 'effect.ward_first_capture' }
    }
  },
  orderPoints: { w: { current: 2, max: 5 }, b: { current: 0, max: 5 } },
  abilities: {
    entries: [{
      instanceId: 'ability.circle_warding:orell',
      abilityId: 'ability.circle_warding',
      effectId: 'effect.place_adjacent_ward',
      sourceId: 'relic.circle_warding',
      ownerId: 'orell',
      side: 'w',
      kind: 'place_adjacent_ward',
      orderCost: 1,
      maxUses: 1,
      used: 0
    }],
    modifiers: [{
      instanceId: 'effect.first_ability_order_discount:orell',
      effectId: 'effect.first_ability_order_discount',
      ownerId: 'orell',
      amount: 1,
      consumed: false
    }]
  }
});

const scenario = Object.freeze({
  format: 'rpchess-scenario-state',
  schemaVersion: 1,
  scenarioId: 'deployment_ability_scenario',
  playerSide: 'w',
  status: 'active',
  actionIndex: 0,
  battle,
  objectives: Object.freeze([]),
  failures: Object.freeze([]),
  environment: Object.freeze({ objects: Object.freeze([]) })
});

const gate = createScenarioDeploymentGate(scenario, { seed: 32 });
const finalized = finalizeScenarioDeployment(gate);

assert.deepStrictEqual(finalized.battle.abilities, battle.abilities);
assert.deepStrictEqual(finalized.battle.statuses, battle.statuses);
assert.strictEqual(finalized.battle.abilities.entries[0].abilityId, 'ability.circle_warding');
assert.strictEqual(finalized.battle.abilities.modifiers[0].effectId, 'effect.first_ability_order_discount');
assert.strictEqual(finalized.battle.statuses.entries.ally_rook.id, 'ward');

console.log('Deployment ability preservation: 1/1 passed.');
