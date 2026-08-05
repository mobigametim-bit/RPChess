'use strict';

const { indexToSquare } = require('../core/chess/position.cjs');
const { projectArmyBattleOptions } = require('./army-roster.cjs');

const RELICS = Object.freeze({
  ECHO_SHIELD: 'relic.echo_shield',
  PHANTOM_SPURS: 'relic.phantom_spurs',
  CIRCLE_WARDING: 'relic.circle_warding',
  TWIN_COMMAND: 'relic.twin_command',
  ROYAL_DECREE: 'relic.royal_decree',
  OATH_FALLEN: 'relic.oath_fallen'
});

const HERO_ABILITIES = Object.freeze({
  'hero.aldric_wall': Object.freeze({ abilityId: 'ability.interpose', effectId: 'effect.interpose_adjacent_ally', kind: 'interpose', orderCost: 1, maxUses: 1 }),
  'hero.mara_chain': Object.freeze({ abilityId: 'ability.chain_formation', effectId: 'effect.advance_two_pawns', kind: 'chain_formation', orderCost: 1, maxUses: 1 }),
  'hero.brother_orell': Object.freeze({ abilityId: 'ability.forge_line', effectId: 'effect.temporary_line_blocker', kind: 'forge_line', orderCost: 1, maxUses: 1 }),
  'hero.vael_hammer': Object.freeze({ abilityId: 'ability.previewed_charge', effectId: 'effect.two_jump_charge', kind: 'previewed_charge', orderCost: 2, maxUses: 1 }),
  'hero.lady_sorn': Object.freeze({ abilityId: 'ability.hostage_tactic', effectId: 'effect.mutual_hostage_binding', kind: 'hostage_tactic', orderCost: 1, maxUses: 1 }),
  'hero.tomas_gate': Object.freeze({ abilityId: 'ability.gate_command', effectId: 'effect.visible_gate_toggle', kind: 'gate_command', orderCost: 1, maxUses: 2 })
});

function freezeArray(values) { return Object.freeze(values.slice()); }

function statusEntries(input) {
  if (!input) return {};
  if (input.format === 'rpchess-status-state') return { ...input.entries };
  return { ...(input.entries || input) };
}

function existingAbilityParts(input) {
  if (!input) return { entries: [], modifiers: [], passives: [] };
  return {
    entries: [...(input.entries || [])],
    modifiers: [...(input.modifiers || [])],
    passives: [...(input.passives || [])]
  };
}

function activeHeroRecords(projected) {
  const records = [];
  for (let index = 0; index < projected.position.board.length; index += 1) {
    const piece = projected.position.board[index];
    if (!piece) continue;
    const square = indexToSquare(index);
    const pieceId = projected.identitiesBySquare[square];
    const metadata = projected.identityMetadata?.[pieceId] || {};
    if (!pieceId || !metadata.heroId) continue;
    records.push(Object.freeze({ pieceId, side: piece.side, type: piece.type, metadata, location: 'active' }));
  }
  return records;
}

function reserveHeroRecords(projected) {
  return (projected.reserve || [])
    .filter((entry) => entry.metadata?.heroId)
    .map((entry) => Object.freeze({ pieceId: entry.id, side: entry.side, type: entry.type, metadata: entry.metadata, location: 'reserve' }));
}

function allHeroRecords(projected) {
  return freezeArray([...activeHeroRecords(projected), ...reserveHeroRecords(projected)]);
}

function addStartingWard(entries, record) {
  const current = entries[record.pieceId];
  if (current && current.id !== 'ward') throw new Error(`${record.pieceId} cannot receive Echo Shield ward over ${current.id}`);
  entries[record.pieceId] = Object.freeze({
    pieceId: record.pieceId,
    id: 'ward',
    sourceId: RELICS.ECHO_SHIELD,
    appliedAtAction: 0,
    expiry: null,
    data: Object.freeze({ effectId: 'effect.ward_first_capture', sourceRelicId: RELICS.ECHO_SHIELD })
  });
}

function addEntry(abilities, record, definition, sourceId, data = {}) {
  abilities.entries.push(Object.freeze({
    instanceId: `${definition.abilityId}:${record.pieceId}`,
    abilityId: definition.abilityId,
    effectId: definition.effectId,
    sourceId,
    ownerId: record.pieceId,
    side: record.side,
    kind: definition.kind,
    orderCost: definition.orderCost,
    maxUses: definition.maxUses,
    used: 0,
    cooldownActions: definition.cooldownActions || 0,
    lastUsedAction: null,
    data: Object.freeze({ ...data })
  }));
}

function mechanicsForRecord(record, abilities, statuses, projected) {
  const relicIds = record.metadata.relicIds || [];
  const heroAbility = HERO_ABILITIES[record.metadata.heroId];
  if (heroAbility) {
    const gateSquares = projected.scenarioRules?.gateSquares || [];
    addEntry(abilities, record, heroAbility, record.metadata.heroId, heroAbility.kind === 'gate_command' ? { gateSquares } : {});
  }

  if (relicIds.includes(RELICS.ECHO_SHIELD)) addStartingWard(statuses, record);
  if (relicIds.includes(RELICS.PHANTOM_SPURS)) {
    abilities.passives.push(Object.freeze({
      instanceId: `effect.visible_evasion_after_non_capture:${record.pieceId}`,
      effectId: 'effect.visible_evasion_after_non_capture',
      sourceId: RELICS.PHANTOM_SPURS,
      ownerId: record.pieceId,
      side: record.side,
      kind: 'evasion_after_non_capture',
      consumed: false,
      data: Object.freeze({})
    }));
  }
  if (relicIds.includes(RELICS.CIRCLE_WARDING)) {
    addEntry(abilities, record, Object.freeze({
      abilityId: 'ability.circle_warding',
      effectId: 'effect.place_adjacent_ward',
      kind: 'place_adjacent_ward',
      orderCost: 1,
      maxUses: 1
    }), RELICS.CIRCLE_WARDING);
  }
  if (relicIds.includes(RELICS.TWIN_COMMAND)) {
    abilities.modifiers.push(Object.freeze({
      instanceId: `effect.first_ability_order_discount:${record.pieceId}`,
      effectId: 'effect.first_ability_order_discount',
      ownerId: record.pieceId,
      amount: 1,
      consumed: false
    }));
  }
  if (relicIds.includes(RELICS.ROYAL_DECREE)) {
    addEntry(abilities, record, Object.freeze({
      abilityId: 'ability.royal_decree',
      effectId: 'effect.conditional_early_promotion',
      kind: 'early_promotion',
      orderCost: 2,
      maxUses: 1
    }), RELICS.ROYAL_DECREE);
  }
  if (relicIds.includes(RELICS.OATH_FALLEN)) {
    addEntry(abilities, record, Object.freeze({
      abilityId: 'ability.oath_fallen',
      effectId: 'effect.order_after_voluntary_sacrifice',
      kind: 'declare_sacrifice',
      orderCost: 0,
      maxUses: 99,
      cooldownActions: 2
    }), RELICS.OATH_FALLEN);
  }
}

function uniqueByInstance(records) {
  const seen = new Set();
  return records.filter((record) => {
    if (seen.has(record.instanceId)) return false;
    seen.add(record.instanceId);
    return true;
  });
}

function projectIronMarchesBattleOptions(options, army) {
  const projected = projectArmyBattleOptions(options, army);
  const statuses = statusEntries(projected.statuses);
  const abilities = existingAbilityParts(projected.abilities);
  for (const record of allHeroRecords(projected)) mechanicsForRecord(record, abilities, statuses, projected);
  return Object.freeze({
    ...projected,
    statuses: Object.freeze({ entries: Object.freeze(statuses) }),
    abilities: Object.freeze({
      entries: freezeArray(uniqueByInstance(abilities.entries)),
      modifiers: freezeArray(uniqueByInstance(abilities.modifiers)),
      passives: freezeArray(uniqueByInstance(abilities.passives))
    })
  });
}

module.exports = {
  ...RELICS,
  RELICS,
  HERO_ABILITIES,
  activeHeroRecords,
  reserveHeroRecords,
  allHeroRecords,
  projectIronMarchesBattleOptions
};
