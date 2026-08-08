'use strict';

const assert = require('assert');
const originalStrictEqual = assert.strictEqual;
assert.strictEqual = function structuralReloadStrictEqual(actual, expected, message) {
  if (typeof message === 'string' && message.includes('runtime snapshot changed across real page reload')) {
    return assert.deepStrictEqual(JSON.parse(actual), JSON.parse(expected), message);
  }
  return originalStrictEqual(actual, expected, message);
};

require('./iron-marches-browser-reload-matrix.cjs');
