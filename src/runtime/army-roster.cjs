'use strict';

const { indexToSquare } = require('../core/chess/position.cjs');

const RUNTIME_ARMY_FORMAT = 'rpchess-runtime-army';
const RUNTIME_ARMY_SCHEMA_VERSION = 1;
const PIECE_TYPE_CODES = Object.freeze({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' });
const PIECE_COMMAND_COST = Object.freeze({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 });

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function assertRegistry(registry) {
  if (!registry || typeof registry.get !== 'function') throw new Error('runtime army requires a content registry');
  return registry;
}

function assertProfileSet(profileSet) {
  if (!profileSet || profileSet.schemaVersion !== 1 || !profileSet.heroes || !profileSet.regionId) {
    throw new Error('runtime army requires validated combat profiles');
  }
  return profileSet;
}

function stableSelectionIds(values, label) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  const ids = values.map((value) => String(value || ''));
  if (ids.some((id) => !id)) throw new Error(`${label} contains an empty id`);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} must not contain duplicates`);
  return ids;
}

function createRuntimeArmy(selectionInput, registryInput, profileSetInput) {
  const selection = selectionInput || {};
  const registry = assertRegistry(registryInput);
  const profileSet = assertProfileSet(profileSetInput);
  const regionId = String(selection.regionId || '');
  const kingId = String(selection.kingId || '');
  const doctrineId = String(selection.doctrineId || '');
  const heroIds = stableSelectionIds(selection.heroIds || [], 'selected heroIds');
  const region = registry.get('region', regionId);
  const king = registry.get('king', kingId);
  const doctrine = registry.get('doctrine', doctrineId);
  if (!region) throw new Error(`runtime army references missing region: ${regionId}`);
  if (regionId !== profileSet.regionId) throw new Error(`runtime army region ${regionId} does not match combat profiles ${profileSet.regionId}`);
  if (!king) throw new Error(`runtime army references missing king: ${kingId}`);
  if (!doctrine) throw new Error(`runtime army references missing doctrine: ${doctrineId}`);
  if (!king.doctrineIds.includes(doctrineId)) throw new Error(`${kingId} does not permit ${doctrineId}`);
  if (!heroIds.length) throw new Error('runtime army requires at least one selected hero');

  const heroes = heroIds.map((heroId) => {
    const hero = registry.get('hero', heroId);
    const profile = profileSet.heroes[heroId];
    if (!hero) throw new Error(`runtime army references missing hero: ${heroId}`);
    if (hero.regionId !== regionId) throw new Error(`${heroId} belongs to ${hero.regionId}, not ${regionId}`);
    if (!profile) throw new Error(`runtime army has no combat profile for ${heroId}`);
    for (const relicId of profile.relicIds) {
      if (!registry.get('relic', relicId)) throw new Error(`runtime army references missing relic: ${relicId}`);
    }
    return Object.freeze({
      heroId,
      nameKey: hero.nameKey,
      contentPieceType: profile.contentPieceType,
      battlePieceType: profile.battlePieceType,
      pieceType: PIECE_TYPE_CODES[profile.battlePieceType],
      relicIds: freezeArray(profile.relicIds),
      overrideReason: profile.overrideReason || null
    });
  });
  const relicIds = [];
  for (const hero of heroes) for (const relicId of hero.relicIds) if (!relicIds.includes(relicId)) relicIds.push(relicId);

  return deepFreeze({
    format: RUNTIME_ARMY_FORMAT,
    schemaVersion: RUNTIME_ARMY_SCHEMA_VERSION,
    profileSetId: profileSet.profileSetId,
    regionId,
    kingId,
    kingNameKey: king.nameKey,
    doctrineId,
    heroIds: freezeArray(heroIds),
    relicIds: freezeArray(relicIds),
    heroes: freezeArray(heroes)
  });
}

function validateRuntimeArmy(snapshot, registry, profileSet) {
  if (!snapshot || snapshot.format !== RUNTIME_ARMY_FORMAT || snapshot.schemaVersion !== RUNTIME_ARMY_SCHEMA_VERSION) {
    throw new Error('invalid runtime army snapshot');
  }
  const rebuilt = createRuntimeArmy({
    regionId: snapshot.regionId,
    kingId: snapshot.kingId,
    doctrineId: snapshot.doctrineId,
    heroIds: snapshot.heroIds
  }, registry, profileSet);
  if (snapshot.profileSetId !== rebuilt.profileSetId) throw new Error('runtime army combat profile set changed');
  if (JSON.stringify(snapshot.relicIds) !== JSON.stringify(rebuilt.relicIds)) throw new Error('runtime army relic bindings changed');
  if (JSON.stringify(snapshot.heroes) !== JSON.stringify(rebuilt.heroes)) throw new Error('runtime army hero records changed');
  return rebuilt;
}

function runtimeSelectionFromArmy(armyInput) {
  const army = armyInput;
  if (!army || army.format !== RUNTIME_ARMY_FORMAT) throw new Error('invalid runtime army');
  return Object.freeze({
    regionId: army.regionId,
    kingId: army.kingId,
    doctrineId: army.doctrineId,
    heroIds: army.heroIds,
    relicIds: army.relicIds
  });
}

function cleanHeroMetadata(input = {}) {
  const metadata = { ...input };
  delete metadata.heroId;
  delete metadata.nameKey;
  delete metadata.relicIds;
  delete metadata.anonymous;
  delete metadata.armySource;
  delete metadata.combatPieceType;
  delete metadata.combatProfileOverride;
  return metadata;
}

function selectedHeroMetadata(base, hero) {
  return Object.freeze({
    ...cleanHeroMetadata(base),
    heroId: hero.heroId,
    nameKey: hero.nameKey,
    relicIds: hero.relicIds,
    combatPieceType: hero.battlePieceType,
    combatProfileOverride: hero.overrideReason,
    armySource: 'selected'
  });
}

function anonymousRoleMetadata(base) {
  return Object.freeze({
    ...cleanHeroMetadata(base),
    anonymous: true,
    armySource: 'scenario_role'
  });
}

function reserveIdForHero(heroId, usedIds) {
  const base = `army_${heroId.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase()}`;
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}_${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function projectArmyBattleOptions(optionsInput, armyInput) {
  const options = optionsInput;
  const army = armyInput;
  if (!options || !options.position || !options.identitiesBySquare) throw new Error('battle projection requires battle creation options');
  if (!army || army.format !== RUNTIME_ARMY_FORMAT) throw new Error('battle projection requires a runtime army');
  const playerSide = options.playerSide || 'w';
  const identitiesBySquare = Object.freeze({ ...options.identitiesBySquare });
  const metadata = { ...(options.identityMetadata || {}) };
  const assigned = new Set();
  const selectedById = new Map(army.heroes.map((hero) => [hero.heroId, hero]));

  const chooseHero = (originalHeroId, pieceType) => {
    const original = originalHeroId ? selectedById.get(originalHeroId) : null;
    if (original && !assigned.has(original.heroId) && original.pieceType === pieceType) return original;
    return army.heroes.find((hero) => !assigned.has(hero.heroId) && hero.pieceType === pieceType) || null;
  };

  for (let index = 0; index < 64; index += 1) {
    const boardPiece = options.position.board[index];
    if (!boardPiece || boardPiece.side !== playerSide) continue;
    const square = indexToSquare(index);
    const pieceId = identitiesBySquare[square];
    if (!pieceId) throw new Error(`army projection identity missing on ${square}`);
    const base = metadata[pieceId] || {};
    if (base.heroId) {
      const hero = chooseHero(base.heroId, boardPiece.type);
      if (hero) {
        assigned.add(hero.heroId);
        metadata[pieceId] = selectedHeroMetadata(base, hero);
      } else {
        metadata[pieceId] = anonymousRoleMetadata(base);
      }
    } else if (boardPiece.type === 'k') {
      metadata[pieceId] = Object.freeze({
        ...base,
        kingId: army.kingId,
        nameKey: army.kingNameKey,
        armySource: 'selected_king'
      });
    }
  }

  const usedIds = new Set([...Object.values(identitiesBySquare), ...(options.reserve || []).map((entry) => entry.id)]);
  const reserve = [];
  for (const entry of options.reserve || []) {
    if (entry.side !== playerSide) {
      reserve.push(entry);
      continue;
    }
    const base = entry.metadata || {};
    if (!base.heroId) {
      reserve.push(entry);
      continue;
    }
    const hero = chooseHero(base.heroId, entry.type);
    if (!hero) continue;
    assigned.add(hero.heroId);
    reserve.push(Object.freeze({
      ...entry,
      metadata: selectedHeroMetadata(base, hero)
    }));
  }

  for (const hero of army.heroes) {
    if (assigned.has(hero.heroId)) continue;
    reserve.push(Object.freeze({
      id: reserveIdForHero(hero.heroId, usedIds),
      side: playerSide,
      type: hero.pieceType,
      orderCost: Math.max(1, PIECE_COMMAND_COST[hero.pieceType]),
      metadata: selectedHeroMetadata({}, hero)
    }));
    assigned.add(hero.heroId);
  }

  const occurrences = [];
  for (const [pieceId, record] of Object.entries(metadata)) {
    if (record.heroId) occurrences.push(Object.freeze({ heroId: record.heroId, location: `active:${pieceId}` }));
  }
  for (const entry of reserve) {
    if (entry.metadata?.heroId) occurrences.push(Object.freeze({ heroId: entry.metadata.heroId, location: `reserve:${entry.id}` }));
  }
  const occurrenceIds = occurrences.map((entry) => entry.heroId);
  const unknown = occurrenceIds.filter((heroId) => !army.heroIds.includes(heroId));
  const duplicates = occurrenceIds.filter((heroId, index) => occurrenceIds.indexOf(heroId) !== index);
  const missing = army.heroIds.filter((heroId) => !occurrenceIds.includes(heroId));
  if (unknown.length || duplicates.length || missing.length) {
    throw new Error(`projected army identity mismatch (unknown: ${[...new Set(unknown)].join(', ') || 'none'}; duplicate: ${[...new Set(duplicates)].join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'})`);
  }

  return Object.freeze({
    ...options,
    identitiesBySquare,
    identityMetadata: Object.freeze(metadata),
    reserve: freezeArray(reserve)
  });
}

module.exports = {
  RUNTIME_ARMY_FORMAT,
  RUNTIME_ARMY_SCHEMA_VERSION,
  PIECE_TYPE_CODES,
  PIECE_COMMAND_COST,
  createRuntimeArmy,
  validateRuntimeArmy,
  runtimeSelectionFromArmy,
  projectArmyBattleOptions
};
