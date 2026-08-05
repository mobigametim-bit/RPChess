'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'content/manifests/register-03-relics.json'), 'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(root, 'content/audits/register_03_relic_assets.json'), 'utf8'));
assert.strictEqual(manifest.records.length, 72);
assert.strictEqual(audit.verifiedCount, 72);
assert.strictEqual(new Set(manifest.records.map((record) => record.id)).size, 72);
assert(audit.minimumSafeMarginRatio >= 0.12);
for (const record of manifest.records) {
  const target = path.join(root, 'game', record.path);
  assert(fs.existsSync(target), record.path);
  const bytes = fs.readFileSync(target);
  assert.strictEqual(bytes.readUInt32BE(16), 512, record.filename);
  assert.strictEqual(bytes.readUInt32BE(20), 512, record.filename);
  assert.strictEqual(bytes[25], 6, record.filename + ' must be RGBA');
}
const browserModule = fs.readFileSync(path.join(root, 'game/js/register-03-relic-assets.mjs'), 'utf8');
for (const record of manifest.records) assert(browserModule.includes(record.path), record.path);
console.log('Register 03 relic assets: 72/72 passed.');
