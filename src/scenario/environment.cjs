'use strict';

const { parseSquare } = require('../rendering/modular-board.cjs');

const ENVIRONMENT_TYPES = Object.freeze(['blocker', 'portal', 'altar', 'hazard', 'objective', 'seal']);

function uniqueCells(values, width, height, label) {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${label} must contain cells`);
  const cells = values.map((value) => {
    if (typeof value !== 'string') throw new Error(`${label} cells must use square names`);
    parseSquare(value, width, height);
    return value.toLowerCase();
  });
  if (new Set(cells).size !== cells.length) throw new Error(`${label} must not repeat cells`);
  return Object.freeze(cells);
}

function normalizeEnvironmentObject(record, board) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('environment object must be an object');
  if (!/^environment\.[a-z0-9][a-z0-9_-]*$/.test(String(record.id || ''))) throw new Error('environment object requires stable environment.* id');
  if (!ENVIRONMENT_TYPES.includes(record.type)) throw new Error(`${record.id}.type is invalid`);
  if (record.visible !== true) throw new Error(`${record.id} must be visible; hidden tactical objects are forbidden`);
  const cells = uniqueCells(record.cells, board.width, board.height, `${record.id}.cells`);
  if (record.type === 'portal' && cells.length !== 2) throw new Error(`${record.id} portal must contain exactly two endpoints`);
  if (record.type === 'blocker' && record.passable === true) throw new Error(`${record.id} blocker cannot be passable`);
  const interaction = record.interaction || 'none';
  if (!['none', 'activate', 'destroy', 'hold'].includes(interaction)) throw new Error(`${record.id}.interaction is invalid`);
  return Object.freeze({
    id: record.id,
    type: record.type,
    visible: true,
    cells,
    active: record.active !== false,
    passable: record.type === 'blocker' ? false : record.passable !== false,
    interaction,
    previewKey: record.previewKey || null,
    metadata: Object.freeze({ ...(record.metadata || {}) })
  });
}

function createEnvironmentRegistry(options = {}) {
  const width = options.width ?? 8;
  const height = options.height ?? 8;
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) throw new Error('environment board dimensions are invalid');
  const records = options.objects || [];
  if (!Array.isArray(records)) throw new Error('environment objects must be an array');
  const objects = records.map((record) => normalizeEnvironmentObject(record, { width, height }));
  const ids = new Set();
  const occupied = new Map();
  for (const object of objects) {
    if (ids.has(object.id)) throw new Error(`duplicate environment id: ${object.id}`);
    ids.add(object.id);
    for (const cell of object.cells) {
      const list = occupied.get(cell) || [];
      list.push(object.id);
      occupied.set(cell, list);
    }
  }
  return Object.freeze({
    format: 'rpchess-environment-registry',
    schemaVersion: 1,
    width,
    height,
    objects: Object.freeze(objects),
    byId: Object.freeze(Object.fromEntries(objects.map((object) => [object.id, object]))),
    byCell: Object.freeze(Object.fromEntries([...occupied.entries()].map(([cell, idsAtCell]) => [cell, Object.freeze(idsAtCell)])))
  });
}

function environmentObject(registry, id) {
  if (!registry || registry.format !== 'rpchess-environment-registry') throw new Error('invalid environment registry');
  return registry.byId[id] || null;
}

function blockingCells(registry) {
  if (!registry || registry.format !== 'rpchess-environment-registry') throw new Error('invalid environment registry');
  const cells = [];
  const seen = new Set();
  for (const object of registry.objects) {
    if (object.type !== 'blocker' || object.visible !== true || object.active !== true || object.passable !== false) continue;
    for (const cell of object.cells) {
      if (seen.has(cell)) continue;
      seen.add(cell);
      cells.push(cell);
    }
  }
  return Object.freeze(cells);
}

module.exports = {
  ENVIRONMENT_TYPES,
  normalizeEnvironmentObject,
  createEnvironmentRegistry,
  environmentObject,
  blockingCells
};