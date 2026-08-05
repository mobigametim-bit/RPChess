const assert = require('assert');
const { parseFen } = require('../src/core/chess/position.cjs');
const { createBattleState } = require('../src/combat/battle.cjs');
const { legalWardAwareCommands, executeWardAwareCommand } = require('../src/combat/ward-protection.cjs');
const { statusFor } = require('../src/combat/statuses.cjs');
const { projectIronMarchesBattleOptions } = require('../src/runtime/iron-marches-mechanics.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function abilityBattle(options = {}) {
  return createBattleState({
    battleId: options.battleId || 'ability_fixture',
    seed: options.seed || 11,
    playerSide: 'w',
    position: parseFen(options.fen || '4k3/8/8/8/2R5/2B5/8/4K3 w - - 0 1'),
    identitiesBySquare: options.identitiesBySquare || {
      e8: 'black_king',
      c4: 'ally_rook',
      c3: 'orell',
      e1: 'white_king'
    },
    identityMetadata: options.identityMetadata || {
      black_king: { side: 'b', type: 'k' },
      ally_rook: { side: 'w', type: 'r' },
      orell: { side: 'w', type: 'b', heroId: 'hero.brother_orell', relicIds: ['relic.circle_warding'] },
      white_king: { side: 'w', type: 'k' }
    },
    orderPoints: options.orderPoints || { w: { current: 2, max: 5 }, b: { current: 0, max: 5 } },
    abilities: options.abilities || {
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
      modifiers: options.modifiers || []
    }
  });
}

test('Circle Warding is a legal deterministic command that spends one order and passes the turn', () => {
  const battle = abilityBattle();
  const command = legalWardAwareCommands(battle).find((candidate) => candidate.type === 'UseAbility');
  assert.ok(command);
  assert.strictEqual(command.payload.abilityId, 'ability.circle_warding');
  assert.strictEqual(command.payload.targetId, 'ally_rook');
  assert.strictEqual(command.payload.effectiveOrderCost, 1);

  const result = executeWardAwareCommand(battle, command);
  assert.strictEqual(result.state.position.sideToMove, 'b');
  assert.strictEqual(result.state.orderPoints.w.current, 1);
  assert.strictEqual(statusFor(result.state.statuses, 'ally_rook').id, 'ward');
  assert.strictEqual(statusFor(result.state.statuses, 'ally_rook').sourceId, 'relic.circle_warding');
  assert.strictEqual(result.state.abilities.entries[0].used, 1);
  assert.ok(result.events.some((event) => event.type === 'AbilityUsed'));
  assert.ok(result.events.some((event) => event.type === 'StatusApplied'));
  assert.ok(result.events.some((event) => event.type === 'OrderPointsChanged'));
});

test('Circle Warding is unavailable while the acting king is in check', () => {
  const battle = abilityBattle({
    fen: 'k3r3/8/8/8/2R5/2B5/8/4K3 w - - 0 1',
    identitiesBySquare: {
      a8: 'black_king',
      e8: 'black_rook',
      c4: 'ally_rook',
      c3: 'orell',
      e1: 'white_king'
    },
    identityMetadata: {
      black_king: { side: 'b', type: 'k' },
      black_rook: { side: 'b', type: 'r' },
      ally_rook: { side: 'w', type: 'r' },
      orell: { side: 'w', type: 'b' },
      white_king: { side: 'w', type: 'k' }
    }
  });
  assert.strictEqual(legalWardAwareCommands(battle).filter((candidate) => candidate.type === 'UseAbility').length, 0);
});

test('Twin Command discounts and consumes the first ability modifier deterministically', () => {
  const battle = abilityBattle({
    orderPoints: { w: { current: 0, max: 5 }, b: { current: 0, max: 5 } },
    modifiers: [{
      instanceId: 'effect.first_ability_order_discount:orell',
      effectId: 'effect.first_ability_order_discount',
      ownerId: 'orell',
      amount: 1,
      consumed: false
    }]
  });
  const command = legalWardAwareCommands(battle).find((candidate) => candidate.type === 'UseAbility');
  assert.ok(command);
  assert.strictEqual(command.payload.baseOrderCost, 1);
  assert.strictEqual(command.payload.effectiveOrderCost, 0);
  const result = executeWardAwareCommand(battle, command);
  assert.strictEqual(result.state.orderPoints.w.current, 0);
  assert.strictEqual(result.state.abilities.modifiers[0].consumed, true);
  assert.ok(result.events.some((event) => event.type === 'RelicEffectConsumed'));
});

test('Iron Marches projection binds Echo Shield, Circle Warding and Twin Command from canonical relic metadata', () => {
  const army = Object.freeze({
    format: 'rpchess-runtime-army',
    schemaVersion: 1,
    profileSetId: 'iron_marches_vertical_slice',
    regionId: 'region.iron_marches',
    kingId: 'king.oathkeeper',
    kingNameKey: 'king.oathkeeper.name',
    doctrineId: 'doctrine.fortress',
    heroIds: Object.freeze(['hero.aldric_wall', 'hero.brother_orell', 'hero.tomas_gate']),
    relicIds: Object.freeze(['relic.echo_shield', 'relic.circle_warding', 'relic.twin_command']),
    heroes: Object.freeze([
      Object.freeze({ heroId: 'hero.aldric_wall', nameKey: 'hero.aldric_wall.name', contentPieceType: 'rook', battlePieceType: 'rook', pieceType: 'r', relicIds: Object.freeze(['relic.echo_shield']), overrideReason: null }),
      Object.freeze({ heroId: 'hero.brother_orell', nameKey: 'hero.brother_orell.name', contentPieceType: 'bishop', battlePieceType: 'bishop', pieceType: 'b', relicIds: Object.freeze(['relic.circle_warding']), overrideReason: null }),
      Object.freeze({ heroId: 'hero.tomas_gate', nameKey: 'hero.tomas_gate.name', contentPieceType: 'king', battlePieceType: 'rook', pieceType: 'r', relicIds: Object.freeze(['relic.twin_command']), overrideReason: 'escort_scenario_uses_rook_profile' })
    ])
  });
  const projected = projectIronMarchesBattleOptions({
    battleId: 'production_mechanics_projection',
    seed: 17,
    playerSide: 'w',
    position: parseFen('4k3/8/8/8/2P5/2B5/8/R3K2R w - - 0 1'),
    identitiesBySquare: Object.freeze({
      e8: 'black_king',
      c4: 'ally_pawn',
      c3: 'orell_role',
      a1: 'aldric_role',
      e1: 'white_king',
      h1: 'tomas_role'
    }),
    identityMetadata: Object.freeze({
      black_king: { side: 'b', type: 'k' },
      ally_pawn: { side: 'w', type: 'p' },
      orell_role: { side: 'w', type: 'b', heroId: 'hero.brother_orell' },
      aldric_role: { side: 'w', type: 'r', heroId: 'hero.aldric_wall' },
      white_king: { side: 'w', type: 'k' },
      tomas_role: { side: 'w', type: 'r', heroId: 'hero.tomas_gate' }
    }),
    orderPoints: { w: { current: 2, max: 5 }, b: { current: 0, max: 5 } },
    reserve: [],
    reserveCells: { w: [], b: [] }
  }, army);

  assert.strictEqual(projected.statuses.entries.aldric_role.id, 'ward');
  assert.strictEqual(projected.statuses.entries.aldric_role.sourceId, 'relic.echo_shield');
  const circleWarding = projected.abilities.entries.find((entry) => entry.effectId === 'effect.place_adjacent_ward');
  assert.ok(circleWarding);
  assert.strictEqual(circleWarding.ownerId, 'orell_role');
  assert.strictEqual(projected.abilities.modifiers[0].ownerId, 'tomas_role');
  assert.strictEqual(projected.abilities.modifiers[0].effectId, 'effect.first_ability_order_discount');

  const battle = createBattleState(projected);
  assert.strictEqual(statusFor(battle.statuses, 'aldric_role').id, 'ward');
  assert.ok(legalWardAwareCommands(battle).some((command) => command.type === 'UseAbility' && command.payload.targetId === 'ally_pawn'));
});

let passed = 0;
for (const entry of tests) {
  try {
    entry.fn();
    passed += 1;
  } catch (error) {
    console.error(`FAIL: ${entry.name}`);
    console.error(error.stack || error);
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log(`Iron Marches abilities: ${passed}/${tests.length} passed.`);
