const assert = require('assert');
const crypto = require('crypto');
const browserCrypto = require('../src/browser/node-shims/crypto.cjs');

const fixtures = [
  '',
  'abc',
  'RPChess',
  'Корона и клятва',
  JSON.stringify({ z: 3, a: [1, 2, 3], nested: { active: true } })
];

for (const fixture of fixtures) {
  const expected = crypto.createHash('sha256').update(fixture).digest('hex');
  const direct = browserCrypto.sha256Hex(fixture);
  const chained = browserCrypto.createHash('sha256').update(fixture.slice(0, 2)).update(fixture.slice(2)).digest('hex');
  assert.strictEqual(direct, expected, `direct SHA-256 mismatch for ${JSON.stringify(fixture)}`);
  assert.strictEqual(chained, expected, `chained SHA-256 mismatch for ${JSON.stringify(fixture)}`);
}

assert.throws(() => browserCrypto.createHash('md5'), /unsupported browser hash algorithm/);
assert.throws(() => browserCrypto.createHash('sha256').update('x').digest('base64'), /unsupported browser digest encoding/);
console.log(`Browser crypto shim: ${fixtures.length}/${fixtures.length} fixtures passed.`);
