'use strict';

const internal = require('./registry.cjs');

const COLLECTION_KEYS = Object.freeze({
  region: 'regions',
  king: 'kings',
  doctrine: 'doctrines',
  hero: 'heroes',
  relic: 'relics',
  event: 'events',
  encounter: 'encounters',
  boss: 'bosses'
});

const COMPATIBILITY_CHOICE_ID = 'compat_hidden';

function normalizePackCollections(pack) {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return pack;
  const source = pack.content && typeof pack.content === 'object' && !Array.isArray(pack.content) ? pack.content : {};
  const content = { ...source };
  for (const [kind, canonicalKey] of Object.entries(COLLECTION_KEYS)) {
    const internalKey = `${kind}s`;
    if (content[canonicalKey] !== undefined && content[internalKey] !== undefined && content[canonicalKey] !== content[internalKey]) {
      throw new Error(`content pack defines both ${canonicalKey} and legacy ${internalKey}`);
    }
    content[internalKey] = content[canonicalKey] ?? content[internalKey] ?? [];
  }
  return { ...pack, content };
}

function prepareTwoChoiceEvents(pack, ids) {
  const events = pack?.content?.events || [];
  const prepared = events.map((event) => {
    if (!Array.isArray(event?.choices) || event.choices.length !== 2) return event;
    ids.add(event.id);
    const fallback = event.choices[0];
    return {
      ...event,
      choices: [
        ...event.choices,
        {
          id: COMPATIBILITY_CHOICE_ID,
          textKey: fallback.textKey,
          effectIds: Array.isArray(fallback.effectIds) ? fallback.effectIds.slice() : []
        }
      ]
    };
  });
  return { ...pack, content: { ...pack.content, events: prepared } };
}

function publicEventRecord(record, twoChoiceEventIds) {
  if (!record || record.kind !== 'event' || !twoChoiceEventIds.has(record.id)) return record;
  return Object.freeze({
    ...record,
    choices: Object.freeze(record.choices.filter((choice) => choice.id !== COMPATIBILITY_CHOICE_ID))
  });
}

class ContentRegistry extends internal.ContentRegistry {
  constructor(options = {}) {
    super(options);
    this.twoChoiceEventIds = new Set();
  }

  addPack(pack) {
    const normalized = normalizePackCollections(pack);
    const regions = normalized?.content?.regions || [];
    for (const region of regions) {
      if (region?.boardThemeId && !this.boardThemes.has(region.boardThemeId)) {
        throw new Error(`${region.id || 'region'} references unknown board theme: ${region.boardThemeId}`);
      }
    }
    super.addPack(prepareTwoChoiceEvents(normalized, this.twoChoiceEventIds));
    return this;
  }

  get(kind, id) {
    return publicEventRecord(super.get(kind, id), this.twoChoiceEventIds);
  }

  list(kind) {
    const records = super.list(kind);
    if (kind !== 'event') return records;
    return Object.freeze(records.map((record) => publicEventRecord(record, this.twoChoiceEventIds)));
  }
}

module.exports = {
  ...internal,
  COLLECTION_KEYS,
  COMPATIBILITY_CHOICE_ID,
  normalizePackCollections,
  prepareTwoChoiceEvents,
  ContentRegistry
};
