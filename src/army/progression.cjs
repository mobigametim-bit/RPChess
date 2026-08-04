'use strict';

const RARITY_COMPENSATION = Object.freeze({
  common: Object.freeze({ gold: 5, supplies: 1 }),
  uncommon: Object.freeze({ gold: 7, supplies: 1 }),
  rare: Object.freeze({ gold: 10, supplies: 2 }),
  epic: Object.freeze({ gold: 18, supplies: 3 }),
  legendary: Object.freeze({ gold: 28, supplies: 5 })
});

function freezeRelics(relics) {
  return Object.freeze(relics.map((relic) => Object.freeze({ ...relic })));
}

function createFigureProgression(options) {
  if (!options || typeof options.pieceId !== 'string' || !options.pieceId) throw new TypeError('pieceId is required');
  if (!['p', 'n', 'b', 'r', 'q', 'k'].includes(options.pieceType)) throw new TypeError('valid pieceType is required');
  const stars = Number.isInteger(options.stars) ? options.stars : 0;
  if (stars < 0 || stars > 3) throw new RangeError('stars must be between 0 and 3');
  const namedHero = Boolean(options.namedHero);
  const thirdStarPath = options.thirdStarPath || null;
  if (thirdStarPath && !['talent_refinement', 'second_relic_slot'].includes(thirdStarPath)) throw new Error(`unknown third-star path: ${thirdStarPath}`);
  if (thirdStarPath && stars < 3) throw new Error('third-star path requires three stars');
  if (thirdStarPath === 'second_relic_slot' && !namedHero) throw new Error('only a named hero can choose a second relic slot');
  const passiveTalentId = options.passiveTalentId || null;
  if (passiveTalentId && stars < 1) throw new Error('passive talent requires at least one star');
  const talentRefinementId = options.talentRefinementId || null;
  if (talentRefinementId && (stars < 3 || thirdStarPath !== 'talent_refinement')) {
    throw new Error('talent refinement requires the third-star talent path');
  }
  const relics = freezeRelics(options.relics || []);
  const progression = Object.freeze({
    format: 'rpchess-figure-progression',
    schemaVersion: 1,
    pieceId: options.pieceId,
    pieceType: options.pieceType,
    namedHero,
    stars,
    passiveTalentId,
    talentRefinementId,
    uniqueAbilityId: namedHero ? (options.uniqueAbilityId || null) : null,
    thirdStarPath,
    relics,
    tags: Object.freeze([...(options.tags || [])])
  });
  validateFigureProgression(progression);
  return progression;
}

function relicSlotCapacity(progression) {
  if (progression.stars < 2) return 0;
  if (progression.namedHero && progression.stars === 3 && progression.thirdStarPath === 'second_relic_slot') return 2;
  return 1;
}

function validateFigureProgression(progression) {
  const capacity = relicSlotCapacity(progression);
  if (progression.relics.length > capacity) throw new Error(`relic capacity exceeded: ${progression.relics.length}/${capacity}`);
  const ids = progression.relics.map((relic) => relic.id);
  if (new Set(ids).size !== ids.length) throw new Error('duplicate relic on one figure');
  if (progression.thirdStarPath === 'second_relic_slot' && progression.talentRefinementId) {
    throw new Error('second relic slot and talent refinement are mutually exclusive');
  }
  return true;
}

function gainStar(progression) {
  if (progression.stars >= 3) throw new Error('figure already has three stars');
  return createFigureProgression({ ...progression, stars: progression.stars + 1, relics: progression.relics });
}

function choosePassiveTalent(progression, talentId, options = {}) {
  if (!talentId || typeof talentId !== 'string') throw new TypeError('talentId is required');
  if (progression.stars < 1) throw new Error('passive talent requires at least one star');
  if (progression.passiveTalentId && !options.replace) throw new Error('figure already has a passive talent');
  return createFigureProgression({
    ...progression,
    passiveTalentId: talentId,
    talentRefinementId: options.replace ? null : progression.talentRefinementId,
    relics: progression.relics
  });
}

function chooseThirdStarPath(progression, path, refinementId = null) {
  if (progression.stars !== 3) throw new Error('third-star path requires exactly three stars');
  if (!['talent_refinement', 'second_relic_slot'].includes(path)) throw new Error(`unknown third-star path: ${path}`);
  if (path === 'second_relic_slot' && !progression.namedHero) throw new Error('ordinary recruit cannot unlock a second relic slot');
  if (path === 'talent_refinement' && !progression.passiveTalentId) throw new Error('talent refinement requires a passive talent');
  if (path === 'talent_refinement' && (!refinementId || typeof refinementId !== 'string')) throw new Error('refinementId is required');
  return createFigureProgression({
    ...progression,
    thirdStarPath: path,
    talentRefinementId: path === 'talent_refinement' ? refinementId : null,
    relics: progression.relics
  });
}

function validateRelicDefinition(definition) {
  if (!definition || typeof definition.id !== 'string' || !definition.id) throw new TypeError('relic definition requires id');
  if (!RARITY_COMPENSATION[definition.rarity]) throw new Error(`unknown relic rarity: ${definition.rarity}`);
  const pieceTypes = definition.recipientFilter && definition.recipientFilter.pieceTypes;
  if (!Array.isArray(pieceTypes) || !pieceTypes.length || pieceTypes.some((type) => !['p', 'n', 'b', 'r', 'q', 'k'].includes(type))) {
    throw new Error('relic requires at least one valid compatible piece type');
  }
  if (definition.action) {
    if (definition.action.replacesStandardAction !== true) throw new Error('active relic action must replace the standard action');
    if (!Number.isInteger(definition.action.orderCost) || definition.action.orderCost < 0) throw new Error('active relic action requires non-negative integer order cost');
  }
  if (definition.rawNumericPower === true) throw new Error('raw global numeric power relics are forbidden');
  return true;
}

function relicCompatible(progression, definition) {
  validateRelicDefinition(definition);
  const filter = definition.recipientFilter;
  if (!filter.pieceTypes.includes(progression.pieceType)) return false;
  if (filter.namedOnly && !progression.namedHero) return false;
  if (Array.isArray(filter.requiredTags) && filter.requiredTags.some((tag) => !progression.tags.includes(tag))) return false;
  if (Array.isArray(filter.excludedTags) && filter.excludedTags.some((tag) => progression.tags.includes(tag))) return false;
  return true;
}

function relicSnapshot(definition) {
  return Object.freeze({
    id: definition.id,
    rarity: definition.rarity,
    actionId: definition.action ? definition.action.id : null
  });
}

function compensationOptions(rarity) {
  const compensation = RARITY_COMPENSATION[rarity];
  if (!compensation) throw new Error(`unknown relic rarity: ${rarity}`);
  return Object.freeze([
    Object.freeze({ type: 'gold', amount: compensation.gold }),
    Object.freeze({ type: 'supplies', amount: compensation.supplies })
  ]);
}

function acceptRelic(progression, definition, options = {}) {
  if (!relicCompatible(progression, definition)) throw new Error(`${definition.id} is incompatible with ${progression.pieceId}`);
  const capacity = relicSlotCapacity(progression);
  if (capacity === 0) throw new Error(`${progression.pieceId} has no unlocked relic slot`);
  const relics = progression.relics.slice();
  if (relics.some((relic) => relic.id === definition.id)) throw new Error(`${definition.id} is already equipped`);

  let discarded = null;
  if (relics.length >= capacity) {
    if (!Number.isInteger(options.replaceIndex) || options.replaceIndex < 0 || options.replaceIndex >= relics.length) {
      throw new Error('all relic slots are occupied; replaceIndex is required');
    }
    discarded = relics[options.replaceIndex];
    relics[options.replaceIndex] = relicSnapshot(definition);
  } else {
    relics.push(relicSnapshot(definition));
  }

  return Object.freeze({
    progression: createFigureProgression({ ...progression, relics }),
    equipped: relicSnapshot(definition),
    discarded,
    compensation: discarded ? compensationOptions(discarded.rarity) : Object.freeze([])
  });
}

function refuseRelic(definition) {
  validateRelicDefinition(definition);
  return Object.freeze({ relicId: definition.id, compensation: compensationOptions(definition.rarity) });
}

function removeRelic(progression, index, reason = 'discarded') {
  if (!Number.isInteger(index) || index < 0 || index >= progression.relics.length) throw new RangeError('invalid relic slot index');
  const relics = progression.relics.slice();
  const [removed] = relics.splice(index, 1);
  return Object.freeze({
    progression: createFigureProgression({ ...progression, relics }),
    removed,
    reason,
    compensation: compensationOptions(removed.rarity)
  });
}

module.exports = {
  RARITY_COMPENSATION,
  createFigureProgression,
  validateFigureProgression,
  relicSlotCapacity,
  gainStar,
  choosePassiveTalent,
  chooseThirdStarPath,
  validateRelicDefinition,
  relicCompatible,
  compensationOptions,
  acceptRelic,
  refuseRelic,
  removeRelic
};
