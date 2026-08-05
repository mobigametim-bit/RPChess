'use strict';
const assert = require('assert');
const { parseFen } = require('../src/core/chess/position.cjs');
const { createBattleState, legalBattleCommands, executeBattleCommand } = require('../src/combat/battle.cjs');
const { executeWardAwareCommand } = require('../src/combat/ward-protection.cjs');
const { statusFor } = require('../src/combat/statuses.cjs');

function battle(fen, identitiesBySquare, metadata, entries = [], passives = [], rules = {}) {
  return createBattleState({
    battleId: 'remaining_abilities', seed: 77, playerSide: 'w', position: parseFen(fen),
    identitiesBySquare, identityMetadata: metadata,
    orderPoints: { w: { current: 5, max: 5 }, b: { current: 5, max: 5 } },
    abilities: { entries, passives }, scenarioRules: rules
  });
}
function entry(kind, ownerId, abilityId, effectId, extras = {}) {
  return { instanceId: abilityId + ':' + ownerId, abilityId, effectId, sourceId: abilityId, ownerId, side: 'w', kind, orderCost: extras.orderCost ?? 1, maxUses: extras.maxUses ?? 1, used: 0, cooldownActions: extras.cooldownActions || 0, data: extras.data || {} };
}
function command(state, abilityId, predicate = () => true) {
  const found = legalBattleCommands(state).find((item) => item.type === 'UseAbility' && item.payload.abilityId === abilityId && predicate(item.payload));
  assert(found, 'missing legal ' + abilityId);
  return found;
}

{
  let state = battle('4k3/8/8/8/8/8/2RP4/4K3 w - - 0 1', { c2: 'aldric', d2: 'ally', e1: 'wk', e8: 'bk' }, { aldric: { side: 'w' }, ally: { side: 'w' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('interpose', 'aldric', 'ability.interpose', 'effect.interpose_adjacent_ally')]);
  state = executeBattleCommand(state, command(state, 'ability.interpose')).state;
  assert.strictEqual(statusFor(state.statuses, 'ally').id, 'guarded');
}
{
  let state = battle('4k3/8/8/8/8/8/3PP3/4K3 w - - 0 1', { d2: 'mara', e2: 'ally', e1: 'wk', e8: 'bk' }, { mara: { side: 'w' }, ally: { side: 'w' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('chain_formation', 'mara', 'ability.chain_formation', 'effect.advance_two_pawns')]);
  state = executeBattleCommand(state, command(state, 'ability.chain_formation')).state;
  assert.strictEqual(state.identities.bySquare.d3, 'mara');
  assert.strictEqual(state.identities.bySquare.e3, 'ally');
}
{
  let state = battle('4k3/8/8/8/8/8/2B5/4K3 w - - 0 1', { c2: 'orell', e1: 'wk', e8: 'bk' }, { orell: { side: 'w' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('forge_line', 'orell', 'ability.forge_line', 'effect.temporary_line_blocker')]);
  const use = command(state, 'ability.forge_line');
  state = executeBattleCommand(state, use).state;
  assert(state.scenarioRules.blockedSquares.includes(use.payload.targetSquare));
}
{
  let state = battle('4k3/8/8/8/8/8/3N4/4K3 w - - 0 1', { d2: 'vael', e1: 'wk', e8: 'bk' }, { vael: { side: 'w' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('previewed_charge', 'vael', 'ability.previewed_charge', 'effect.two_jump_charge', { orderCost: 2 })]);
  const use = command(state, 'ability.previewed_charge');
  state = executeBattleCommand(state, use).state;
  assert.strictEqual(state.identities.bySquare[use.payload.to], 'vael');
}
{
  let state = battle('4k3/8/8/8/3r4/8/3Q4/4K3 w - - 0 1', { d2: 'sorn', d4: 'enemy', e1: 'wk', e8: 'bk' }, { sorn: { side: 'w' }, enemy: { side: 'b' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('hostage_tactic', 'sorn', 'ability.hostage_tactic', 'effect.mutual_hostage_binding')]);
  state = executeBattleCommand(state, command(state, 'ability.hostage_tactic')).state;
  assert.strictEqual(statusFor(state.statuses, 'sorn').id, 'bound');
  assert.strictEqual(statusFor(state.statuses, 'enemy').id, 'bound');
}
{
  let state = battle('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1', { e2: 'tomas', e1: 'wk', e8: 'bk' }, { tomas: { side: 'w' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('gate_command', 'tomas', 'ability.gate_command', 'effect.visible_gate_toggle', { maxUses: 2 })]);
  const use = command(state, 'ability.gate_command');
  state = executeBattleCommand(state, use).state;
  assert(state.scenarioRules.blockedSquares.includes(use.payload.targetSquare));
}
{
  let state = battle('4k3/3P4/8/8/8/8/8/4K3 w - - 0 1', { d7: 'pawn', e1: 'wk', e8: 'bk' }, { pawn: { side: 'w' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('early_promotion', 'pawn', 'ability.royal_decree', 'effect.conditional_early_promotion', { orderCost: 2 })]);
  const use = command(state, 'ability.royal_decree', (payload) => payload.promotion === 'n');
  state = executeBattleCommand(state, use).state;
  assert.strictEqual(state.position.board[3].type, 'n');
}
{
  let state = battle('4k3/8/8/8/3r4/8/3P4/R3K3 w - - 0 1', { a1: 'oath', d2: 'offering', d4: 'enemy', e1: 'wk', e8: 'bk' }, { oath: { side: 'w' }, offering: { side: 'w' }, enemy: { side: 'b' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('declare_sacrifice', 'oath', 'ability.oath_fallen', 'effect.order_after_voluntary_sacrifice', { orderCost: 0, maxUses: 99, cooldownActions: 2 })]);
  const use = command(state, 'ability.oath_fallen', (payload) => payload.targetId === 'offering');
  state = executeBattleCommand(state, use).state;
  assert(statusFor(state.statuses, use.payload.targetId));
}
{
  let state = battle('4k3/8/8/8/8/8/3N4/4K3 w - - 0 1', { d2: 'knight', e1: 'wk', e8: 'bk' }, { knight: { side: 'w' }, wk: { side: 'w' }, bk: { side: 'b' } }, [], [{ instanceId: 'spurs:knight', effectId: 'effect.visible_evasion_after_non_capture', sourceId: 'relic.phantom_spurs', ownerId: 'knight', side: 'w', kind: 'evasion_after_non_capture', consumed: false }]);
  const move = legalBattleCommands(state).find((item) => item.type === 'MovePiece' && item.payload.from === 'd2');
  state = executeWardAwareCommand(state, move).state;
  assert.strictEqual(statusFor(state.statuses, 'knight').id, 'evasion');
}
console.log('Remaining Iron Marches abilities: 9/9 passed.');
