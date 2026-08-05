'use strict';

const crypto = require('crypto');

function normalizeJson(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('save data cannot contain non-finite numbers');
    return value;
  }
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    throw new Error(`save data contains unsupported type: ${typeof value}`);
  }
  if (seen.has(value)) throw new Error('save data cannot contain circular references');
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => normalizeJson(item, seen));
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new Error('save data must contain plain objects only');
    }
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, normalizeJson(value[key], seen)])
    );
  } finally {
    seen.delete(value);
  }
}

function stableStringify(value) {
  return JSON.stringify(normalizeJson(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
}

module.exports = {
  normalizeJson,
  stableStringify,
  sha256
};
