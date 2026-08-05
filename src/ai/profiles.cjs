'use strict';

const AI_PROFILES = Object.freeze({
  apprentice: Object.freeze({
    id: 'apprentice',
    depth: 1,
    maxNodes: 1200,
    timeBudgetMs: 35,
    rootNoise: 140,
    reserveDiscount: 0.72,
    mobilityWeight: 2,
    statusWeight: 18
  }),
  tactician: Object.freeze({
    id: 'tactician',
    depth: 2,
    maxNodes: 8000,
    timeBudgetMs: 90,
    rootNoise: 28,
    reserveDiscount: 0.82,
    mobilityWeight: 3,
    statusWeight: 22
  }),
  warlord: Object.freeze({
    id: 'warlord',
    depth: 3,
    maxNodes: 30000,
    timeBudgetMs: 220,
    rootNoise: 0,
    reserveDiscount: 0.9,
    mobilityWeight: 4,
    statusWeight: 28
  })
});

function resolveAiProfile(profile) {
  if (typeof profile === 'string') {
    const resolved = AI_PROFILES[profile];
    if (!resolved) throw new Error(`unknown AI profile: ${profile}`);
    return resolved;
  }
  if (!profile || typeof profile !== 'object') throw new Error('AI profile is required');
  const depth = profile.depth;
  const maxNodes = profile.maxNodes;
  const timeBudgetMs = profile.timeBudgetMs ?? 0;
  const rootNoise = profile.rootNoise ?? 0;
  if (!Number.isInteger(depth) || depth < 1 || depth > 5) throw new Error('AI depth must be an integer from 1 to 5');
  if (!Number.isInteger(maxNodes) || maxNodes < 1) throw new Error('AI maxNodes must be a positive integer');
  if (!Number.isFinite(timeBudgetMs) || timeBudgetMs < 0) throw new Error('AI timeBudgetMs must be non-negative');
  if (!Number.isFinite(rootNoise) || rootNoise < 0) throw new Error('AI rootNoise must be non-negative');
  return Object.freeze({
    id: String(profile.id || 'custom'),
    depth,
    maxNodes,
    timeBudgetMs,
    rootNoise,
    reserveDiscount: Number.isFinite(profile.reserveDiscount) ? profile.reserveDiscount : 0.85,
    mobilityWeight: Number.isFinite(profile.mobilityWeight) ? profile.mobilityWeight : 3,
    statusWeight: Number.isFinite(profile.statusWeight) ? profile.statusWeight : 22
  });
}

module.exports = { AI_PROFILES, resolveAiProfile };
