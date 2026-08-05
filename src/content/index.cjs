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

class ContentRegistry extends internal.ContentRegistry {
  addPack(pack) {
    const normalized = normalizePackCollections(pack);
    const regions = normalized?.content?.regions || [];
    for (const region of regions) {
      if (region?.boardThemeId && !this.boardThemes.has(region.boardThemeId)) {
        throw new Error(`${region.id || 'region'} references unknown board theme: ${region.boardThemeId}`);
      }
    }
    super.addPack(normalized);
    return this;
  }
}

module.exports = {
  ...internal,
  COLLECTION_KEYS,
  normalizePackCollections,
  ContentRegistry
};
