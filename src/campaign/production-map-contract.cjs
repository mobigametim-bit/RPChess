'use strict';

const GENERATOR_VERSION = 3;
const GRAPH_SCHEMA_VERSION = 3;
const MAX_GENERATION_ATTEMPTS = 10;
const MAP_NODE_MIN = 18;
const MAP_NODE_MAX = 24;
const ROUTE_NODE_MIN = 9;
const ROUTE_NODE_MAX = 11;
const SERVICE_TYPES = Object.freeze(['shop', 'hospital', 'forge', 'camp']);
const NODE_TYPES = Object.freeze(['start', 'battle', 'elite', 'event', ...SERVICE_TYPES, 'boss']);
const NORMAL_CATEGORIES = Object.freeze(['battle', 'event', 'service']);
const PHASE_WEIGHTS = Object.freeze({
  early: Object.freeze({ battle: 60, event: 25, service: 15 }),
  mid: Object.freeze({ battle: 50, event: 30, service: 20 }),
  late: Object.freeze({ battle: 45, event: 35, service: 20 })
});
const DANGER_RANGES = Object.freeze({
  early: Object.freeze([1, 2]),
  mid: Object.freeze([2, 4]),
  late: Object.freeze([4, 5]),
  elite: Object.freeze([5, 5]),
  boss: Object.freeze([5, 5])
});
const SECRET_CONTENT_WEIGHTS = Object.freeze([
  Object.freeze({ value: 'event', weight: 25 }),
  Object.freeze({ value: 'cache', weight: 25 }),
  Object.freeze({ value: 'battle', weight: 20 }),
  Object.freeze({ value: 'special_service', weight: 15 }),
  Object.freeze({ value: 'political_meeting', weight: 10 }),
  Object.freeze({ value: 'recruit', weight: 5 })
]);
const BRANCH_PROFILES = Object.freeze(['fortified', 'direct', 'resource', 'volatile']);
const MACRO_TEMPLATES = Object.freeze([
  Object.freeze({ id: 'bastion_spine', widths: Object.freeze([3, 3, 1, 2, 2, 1, 1, 3, 1]), edgeStyle: 'parallel', profiles: Object.freeze(['fortified', 'direct', 'resource']) }),
  Object.freeze({ id: 'twin_ramparts', widths: Object.freeze([2, 3, 1, 3, 2, 1, 1, 3, 1]), edgeStyle: 'weave', profiles: Object.freeze(['direct', 'fortified', 'volatile']) }),
  Object.freeze({ id: 'hammer_and_anvil', widths: Object.freeze([3, 2, 1, 3, 3, 1, 1, 2, 1]), edgeStyle: 'cross', profiles: Object.freeze(['volatile', 'fortified', 'resource']) }),
  Object.freeze({ id: 'broken_chain', widths: Object.freeze([3, 3, 1, 2, 3, 1, 1, 2, 1]), edgeStyle: 'stagger', profiles: Object.freeze(['resource', 'direct', 'fortified']) }),
  Object.freeze({ id: 'three_gates', widths: Object.freeze([2, 3, 1, 3, 3, 1, 1, 2, 1]), edgeStyle: 'fan', profiles: Object.freeze(['fortified', 'resource', 'direct']) }),
  Object.freeze({ id: 'iron_fork', widths: Object.freeze([3, 2, 1, 3, 2, 1, 1, 3, 1]), edgeStyle: 'split', profiles: Object.freeze(['direct', 'volatile', 'fortified']) })
]);
const RESERVE_TEMPLATE_ID = 'reserve_bastion';
const RESERVE_WIDTHS = Object.freeze([3, 3, 1, 3, 2, 1, 1, 3, 1]);

function freezeArray(values) { return Object.freeze(values.slice()); }
function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return value;
}
function weightedPick(rng, entries) {
  const total = entries.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
  if (!(total > 0)) throw new Error('weighted pick requires a positive total');
  let roll = rng.float() * total;
  for (const entry of entries) { roll -= entry.weight; if (roll < 0) return entry.value; }
  return entries.at(-1).value;
}
function phaseForLayer(layer) {
  if (layer <= 3) return 'early';
  if (layer <= 7) return 'mid';
  return 'late';
}
function categoryForType(type) { return SERVICE_TYPES.includes(type) ? 'service' : type; }
function phaseEntries(phase) { return Object.entries(PHASE_WEIGHTS[phase]).map(([value, weight]) => ({ value, weight })); }

module.exports = {
  GENERATOR_VERSION, GRAPH_SCHEMA_VERSION, MAX_GENERATION_ATTEMPTS,
  MAP_NODE_MIN, MAP_NODE_MAX, ROUTE_NODE_MIN, ROUTE_NODE_MAX,
  SERVICE_TYPES, NODE_TYPES, NORMAL_CATEGORIES, PHASE_WEIGHTS, DANGER_RANGES,
  SECRET_CONTENT_WEIGHTS, BRANCH_PROFILES, MACRO_TEMPLATES,
  RESERVE_TEMPLATE_ID, RESERVE_WIDTHS,
  freezeArray, deepFreeze, weightedPick, phaseForLayer, categoryForType, phaseEntries
};
