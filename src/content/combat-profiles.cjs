'use strict';

const fs = require('fs');

const COMBAT_PIECE_TYPES = Object.freeze(['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function assertStableId(value, prefix, label) {
  const id = String(value || '');
  if (!new RegExp(`^${prefix}\\.[a-z0-9][a-z0-9_-]*$`).test(id)) throw new Error(`${label} must use ${prefix}.* format`);
  return id;
}

function uniqueIds(values, prefix, label) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  const ids = values.map((value, index) => assertStableId(value, prefix, `${label}[${index}]`));
  if (new Set(ids).size !== ids.length) throw new Error(`${label} must not contain duplicates`);
  return ids;
}

function validateCombatProfileSet(input, registry) {
  assertObject(input, 'combat profile set');
  if (input.schemaVersion !== 1) throw new Error('unsupported combat profile schemaVersion');
  if (!registry || typeof registry.get !== 'function' || typeof registry.list !== 'function') {
    throw new Error('combat profiles require a finalized content registry');
  }
  const profileSetId = String(input.profileSetId || '');
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(profileSetId)) throw new Error('combat profile set requires a stable profileSetId');
  const regionId = assertStableId(input.regionId, 'region', 'combat profile regionId');
  if (!registry.get('region', regionId)) throw new Error(`combat profile set references missing region: ${regionId}`);
  assertObject(input.heroes, 'combat profile heroes');

  const heroes = {};
  for (const [heroIdInput, recordInput] of Object.entries(input.heroes)) {
    const heroId = assertStableId(heroIdInput, 'hero', 'combat profile heroId');
    const record = assertObject(recordInput, heroId);
    const hero = registry.get('hero', heroId);
    if (!hero) throw new Error(`combat profile references missing hero: ${heroId}`);
    if (hero.regionId !== regionId) throw new Error(`${heroId} belongs to ${hero.regionId}, not ${regionId}`);
    const contentPieceType = String(record.contentPieceType || '');
    const battlePieceType = String(record.battlePieceType || '');
    if (!COMBAT_PIECE_TYPES.includes(contentPieceType)) throw new Error(`${heroId}.contentPieceType is invalid`);
    if (!COMBAT_PIECE_TYPES.includes(battlePieceType)) throw new Error(`${heroId}.battlePieceType is invalid`);
    if (hero.pieceType !== contentPieceType) {
      throw new Error(`${heroId}.contentPieceType does not match content registry: ${contentPieceType}/${hero.pieceType}`);
    }
    const overrideReason = record.overrideReason == null ? null : String(record.overrideReason).trim();
    if (battlePieceType !== contentPieceType && !overrideReason) {
      throw new Error(`${heroId} changes battle piece type without an explicit overrideReason`);
    }
    if (battlePieceType === contentPieceType && overrideReason) {
      throw new Error(`${heroId} has an unnecessary overrideReason`);
    }
    const relicIds = uniqueIds(record.relicIds || [], 'relic', `${heroId}.relicIds`);
    for (const relicId of relicIds) {
      const relic = registry.get('relic', relicId);
      if (!relic) throw new Error(`${heroId} references missing relic: ${relicId}`);
      if (!relic.compatibility.some((value) => value === battlePieceType || value === 'any' || value === 'hero')) {
        throw new Error(`${relicId} is incompatible with ${heroId} battle piece type ${battlePieceType}`);
      }
    }
    heroes[heroId] = {
      heroId,
      contentPieceType,
      battlePieceType,
      relicIds,
      overrideReason
    };
  }

  const regionHeroIds = registry.list('hero').filter((hero) => hero.regionId === regionId).map((hero) => hero.id).sort();
  const profileHeroIds = Object.keys(heroes).sort();
  const missing = regionHeroIds.filter((heroId) => !Object.prototype.hasOwnProperty.call(heroes, heroId));
  const extra = profileHeroIds.filter((heroId) => !regionHeroIds.includes(heroId));
  if (missing.length || extra.length) {
    throw new Error(`combat profile coverage mismatch (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`);
  }

  return deepFreeze({
    schemaVersion: 1,
    profileSetId,
    regionId,
    heroes
  });
}

function loadCombatProfileSet(filePath, registry) {
  return validateCombatProfileSet(JSON.parse(fs.readFileSync(filePath, 'utf8')), registry);
}

function combatProfileFor(profileSet, heroIdInput) {
  if (!profileSet || profileSet.schemaVersion !== 1 || !profileSet.heroes) throw new Error('invalid combat profile set');
  const heroId = assertStableId(heroIdInput, 'hero', 'heroId');
  const profile = profileSet.heroes[heroId];
  if (!profile) throw new Error(`missing combat profile: ${heroId}`);
  return profile;
}

module.exports = {
  COMBAT_PIECE_TYPES,
  validateCombatProfileSet,
  loadCombatProfileSet,
  combatProfileFor
};
