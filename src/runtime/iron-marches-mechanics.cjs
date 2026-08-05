'use strict';

const { indexToSquare } = require('../core/chess/position.cjs');
const { projectArmyBattleOptions } = require('./army-roster.cjs');

const ECHO_SHIELD = 'relic.echo_shield';
const CIRCLE_WARDING = 'relic.circle_warding';
const TWIN_COMMAND = 'relic.twin_command';

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function statusEntries(input) {
  if (!input) return {};
  if (input.format === 'rpchess-status-state') return { ...input.entries };
  return { ...(input.entries || input) };
}

function existingAbilityParts(input) {
  if (!input) return { entries: [], modifiers: [] };
  return {
    entries: [...(input.entries || [])],
    modifiers: [...(input.modifiers || [])]
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
    records.push(Object.freeze({
      pieceId,
      side: piece.side,
      type: piece.type,
      metadata,
      location: 'active'
    }));
  }
  return records;
}

function reserveHeroRecords(projected) {
  return (projected.reserve || [])
    .filter((entry) => entry.metadata?.heroId)
    .map((entry) => Object.freeze({
      pieceId: entry.id,
      side: entry.side,
      type: entry.type,
      metadata: entry.metadata,
      location: 'reserve'
    }));
}

function allHeroRecords(projected) {
  return freezeArray([...activeHeroRecords(projected), ...reserveHeroRecords(projected)]);
}

function addStartingWard(entries, record) {
  const current = entries[record.pieceId];
  if (current && current.id !== 'ward') {
    throw new Error(`${record.pieceId} cannot receive Echo Shield ward over ${current.id}`);
  }
  entries[record.pieceId] = Object.freeze({
    pieceId: record.pieceId,
    id: 'ward',
    sourceId: ECHO_SHIELD,
    appliedAtAction: 0,
    expiry: null,
    data: Object.freeze({ effectId: 'effect.ward_first_capture', sourceRelicId: ECHO_SHIELD })
  });
}

function mechanicsForRecord(record, abilities, statuses) {
  const relicIds = record.metadata.relicIds || [];
  if (relicIds.includes(ECHO_SHIELD)) addStartingWard(statuses, record);
  if (relicIds.includes(CIRCLE_WARDING)) {
    abilities.entries.push(Object.freeze({
      instanceId: `ability.circle_warding:${record.pieceId}`,
      abilityId: 'ability.circle_warding',
      effectId: 'effect.place_adjacent_ward',
      sourceId: CIRCLE_WARDING,
      ownerId: record.pieceId,
      side: record.side,
      kind: 'place_adjacent_ward',
      orderCost: 1,
      maxUses: 1,
      used: 0
    }));
  }
  if (relicIds.includes(TWIN_COMMAND)) {
    abilities.modifiers.push(Object.freeze({
      instanceId: `effect.first_ability_order_discount:${record.pieceId}`,
      effectId: 'effect.first_ability_order_discount',
      ownerId: record.pieceId,
      amount: 1,
      consumed: false
    }));
  }
}

function projectIronMarchesBattleOptions(options, army) {
  const projected = projectArmyBattleOptions(options, army);
  const statuses = statusEntries(projected.statuses);
  const abilities = existingAbilityParts(projected.abilities);
  for (const record of allHeroRecords(projected)) mechanicsForRecord(record, abilities, statuses);
  return Object.freeze({
    ...projected,
    statuses: Object.freeze({ entries: Object.freeze(statuses) }),
    abilities: Object.freeze({
      entries: freezeArray(abilities.entries),
      modifiers: freezeArray(abilities.modifiers)
    })
  });
}

module.exports = {
  ECHO_SHIELD,
  CIRCLE_WARDING,
  TWIN_COMMAND,
  activeHeroRecords,
  reserveHeroRecords,
  allHeroRecords,
  projectIronMarchesBattleOptions
};
