'use strict';

const fs = require('fs');

function freezeArray(values) {
  return Object.freeze(values.slice());
}

function stableIds(values = [], label) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  const normalized = values.map(String);
  if (normalized.some((value) => !/^[a-z0-9][a-z0-9_.-]*$/.test(value))) throw new Error(`${label} contains an invalid stable ID`);
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} contains duplicates`);
  return freezeArray(normalized);
}

function resourceDelta(input = {}, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`${label}.resourceDelta must be an object`);
  const normalized = { gold: 0, supplies: 0, meta: 0 };
  for (const key of Object.keys(input)) if (!Object.prototype.hasOwnProperty.call(normalized, key)) throw new Error(`${label}.resourceDelta has unsupported key ${key}`);
  for (const key of Object.keys(normalized)) {
    const value = input[key] ?? 0;
    if (!Number.isInteger(value)) throw new Error(`${label}.resourceDelta.${key} must be an integer`);
    normalized[key] = value;
  }
  return Object.freeze(normalized);
}

function normalizeEffect(effectId, input = {}) {
  if (!/^effect\.[a-z0-9][a-z0-9_.-]*$/.test(effectId)) throw new Error(`invalid effect ID: ${effectId}`);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`${effectId} definition must be an object`);
  const normalized = Object.freeze({
    id: effectId,
    resourceDelta: resourceDelta(input.resourceDelta || {}, effectId),
    addFlags: stableIds(input.addFlags || [], `${effectId}.addFlags`),
    removeFlags: stableIds(input.removeFlags || [], `${effectId}.removeFlags`),
    chronicleKeys: stableIds(input.chronicleKeys || [], `${effectId}.chronicleKeys`)
  });
  const hasBehavior = Object.values(normalized.resourceDelta).some(Boolean)
    || normalized.addFlags.length
    || normalized.removeFlags.length
    || normalized.chronicleKeys.length;
  if (!hasBehavior) throw new Error(`${effectId} has no declared behavior`);
  return normalized;
}

function validateEffectCatalog(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('effect catalog must be an object');
  if (input.schemaVersion !== 1) throw new Error('unsupported effect catalog schemaVersion');
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(String(input.catalogId || ''))) throw new Error('effect catalog requires a stable catalogId');
  if (!input.effects || typeof input.effects !== 'object' || Array.isArray(input.effects)) throw new Error('effect catalog requires effects');
  const entries = Object.entries(input.effects).map(([effectId, definition]) => [effectId, normalizeEffect(effectId, definition)]);
  if (!entries.length) throw new Error('effect catalog must not be empty');
  return Object.freeze({
    schemaVersion: 1,
    catalogId: input.catalogId,
    effects: Object.freeze(Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))))
  });
}

function loadEffectCatalog(filePath) {
  return validateEffectCatalog(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function mergeEffectCatalogs(catalogs) {
  if (!Array.isArray(catalogs) || !catalogs.length) throw new Error('at least one effect catalog is required');
  const effects = {};
  const catalogIds = [];
  for (const input of catalogs) {
    const catalog = validateEffectCatalog(input);
    catalogIds.push(catalog.catalogId);
    for (const [effectId, definition] of Object.entries(catalog.effects)) {
      if (effects[effectId]) throw new Error(`duplicate effect definition: ${effectId}`);
      effects[effectId] = definition;
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    catalogId: catalogIds.join('+'),
    effects: Object.freeze(Object.fromEntries(Object.entries(effects).sort(([a], [b]) => a.localeCompare(b))))
  });
}

function validateEventEffectReferences(registry, catalog) {
  if (!registry || typeof registry.list !== 'function') throw new Error('content registry is required');
  const normalized = validateEffectCatalog(catalog);
  const missing = [];
  for (const event of registry.list('event')) {
    for (const choice of event.choices) {
      for (const effectId of choice.effectIds) if (!normalized.effects[effectId]) missing.push(`${event.id}.${choice.id}: ${effectId}`);
    }
  }
  if (missing.length) {
    const error = new Error(`event effect validation failed with ${missing.length} missing definition(s)`);
    error.details = Object.freeze(missing.sort());
    throw error;
  }
  return true;
}

function createCatalogEventChoiceResolver(catalogInput) {
  const catalog = validateEffectCatalog(catalogInput);
  return ({ event, choice }) => {
    const delta = { gold: 0, supplies: 0, meta: 0 };
    const addFlags = new Set();
    const removeFlags = new Set();
    const chronicleKeys = new Set([`chronicle.${event.eventId.split('.').slice(1).join('.')}.${choice.id}`]);
    for (const effectId of choice.effectIds) {
      const definition = catalog.effects[effectId];
      if (!definition) throw new Error(`unknown event effect: ${effectId}`);
      for (const key of Object.keys(delta)) delta[key] += definition.resourceDelta[key];
      for (const flag of definition.addFlags) addFlags.add(flag);
      for (const flag of definition.removeFlags) removeFlags.add(flag);
      for (const key of definition.chronicleKeys) chronicleKeys.add(key);
    }
    for (const flag of removeFlags) addFlags.delete(flag);
    return Object.freeze({
      resourceDelta: Object.freeze(delta),
      addFlags: freezeArray([...addFlags].sort()),
      removeFlags: freezeArray([...removeFlags].sort()),
      chronicleKeys: freezeArray([...chronicleKeys].sort()),
      outcomeKey: null
    });
  };
}

module.exports = {
  stableIds,
  resourceDelta,
  normalizeEffect,
  validateEffectCatalog,
  loadEffectCatalog,
  mergeEffectCatalogs,
  validateEventEffectReferences,
  createCatalogEventChoiceResolver
};
