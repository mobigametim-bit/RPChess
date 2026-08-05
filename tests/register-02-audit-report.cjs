const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'content/assets/register_02_assets.json');
const reportPath = path.join(root, 'content/assets/register_02_audit.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function pngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.ok(buffer.length >= 24, `${filePath} is too short to be a PNG`);
  assert.strictEqual(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${filePath} is not PNG`);
  assert.strictEqual(buffer.subarray(12, 16).toString('ascii'), 'IHDR', `${filePath} has no IHDR`);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

const expectedSizes = {
  'HERO-PORTRAIT-768': [768, 768],
  'HERO-BADGE-512': [512, 512],
  'ABILITY-ICON-512': [512, 512],
  'POLITICAL-PORTRAIT-768': [768, 768]
};

assert.strictEqual(manifest.assetCount, 126);
assert.strictEqual(manifest.heroCount, 36);
assert.strictEqual(manifest.politicalCharacterCount, 18);
assert.strictEqual(manifest.assets.length, 126);
assert.strictEqual(new Set(manifest.assets.map((entry) => entry.repositoryPath)).size, 126);
assert.strictEqual(report.manifestAssetCount, 126);
assert.strictEqual(report.auditedAssetCount, 126);
assert.strictEqual(report.gate, 'PASS');
assert.strictEqual(report.errorCount, 0);
assert.deepStrictEqual(report.errors, []);

const expectedWarnings = [
  ['low_thumbnail_readability', 'game/assets/heroes/ivar_lens/ability_icon.png', 160],
  ['low_thumbnail_readability', 'game/assets/heroes/temur_wind/ability_icon.png', 160]
];
const actualWarnings = report.warnings
  .map((warning) => [warning.code, warning.path, warning.thumbnail || null])
  .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
assert.deepStrictEqual(actualWarnings, expectedWarnings.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
assert.strictEqual(report.warningCount, expectedWarnings.length);

const reportByPath = new Map(report.assets.map((entry) => [entry.repositoryPath, entry]));
let totalBytes = 0;
for (const entry of manifest.assets) {
  const filePath = path.join(root, entry.repositoryPath);
  assert.ok(fs.statSync(filePath).isFile(), `missing Register 02 asset: ${entry.repositoryPath}`);
  const bytes = fs.statSync(filePath).size;
  const digest = sha256(filePath);
  const dimensions = pngSize(filePath);
  const expected = expectedSizes[entry.profile];
  assert.ok(expected, `unknown Register 02 profile: ${entry.profile}`);
  assert.deepStrictEqual(dimensions, expected, `${entry.repositoryPath} dimensions`);
  assert.strictEqual(entry.bytes, bytes, `${entry.repositoryPath} manifest byte count`);
  assert.strictEqual(entry.sha256, digest, `${entry.repositoryPath} manifest hash`);
  const audited = reportByPath.get(entry.repositoryPath);
  assert.ok(audited, `missing audit entry: ${entry.repositoryPath}`);
  assert.strictEqual(audited.bytes, bytes, `${entry.repositoryPath} audit byte count`);
  assert.strictEqual(audited.sha256, digest, `${entry.repositoryPath} audit hash`);
  assert.deepStrictEqual(audited.size, expected, `${entry.repositoryPath} audit dimensions`);
  totalBytes += bytes;
}
assert.strictEqual(reportByPath.size, 126);
assert.strictEqual(manifest.totalBytes, totalBytes);

console.log(`Register 02 audit report: 126/126 verified, ${report.errorCount} errors, ${report.warningCount} review warnings.`);
