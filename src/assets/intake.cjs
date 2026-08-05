'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  readPngDimensions,
  validateBoardThemeManifest,
  loadBoardThemeManifest
} = require('./board-manifest.cjs');

function normalizeCanonicalPath(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('canonical asset path is required');
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '');
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error(`canonical asset path must stay relative: ${value}`);
  }
  return normalized;
}

function resolveInside(root, relativePath) {
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(absoluteRoot, normalizeCanonicalPath(relativePath));
  if (absolute !== absoluteRoot && !absolute.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error(`asset path escapes root: ${relativePath}`);
  }
  return absolute;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function inspectPng(filePath, expectedSize = 512) {
  if (!fs.existsSync(filePath)) return Object.freeze({ exists: false, valid: false, path: filePath });
  try {
    const dimensions = readPngDimensions(fs.readFileSync(filePath));
    if (dimensions.width !== expectedSize || dimensions.height !== expectedSize) {
      throw new Error(`expected ${expectedSize}x${expectedSize}, got ${dimensions.width}x${dimensions.height}`);
    }
    return Object.freeze({
      exists: true,
      valid: true,
      path: filePath,
      hash: sha256File(filePath),
      ...dimensions
    });
  } catch (error) {
    return Object.freeze({ exists: true, valid: false, path: filePath, error: error.message });
  }
}

function boardAssetRecords(manifestInput) {
  const manifest = validateBoardThemeManifest(manifestInput);
  const records = [];
  for (const theme of manifest.themes) {
    records.push(Object.freeze({
      id: `board-theme.${theme.id}.light`,
      themeId: theme.id,
      kind: 'light',
      priority: theme.priority,
      canonicalPath: normalizeCanonicalPath(theme.light)
    }));
    records.push(Object.freeze({
      id: `board-theme.${theme.id}.dark`,
      themeId: theme.id,
      kind: 'dark',
      priority: theme.priority,
      canonicalPath: normalizeCanonicalPath(theme.dark)
    }));
  }
  return Object.freeze(records);
}

function classify(runtime, staging) {
  if (staging.exists && !staging.valid) return 'invalid_staging';
  if (runtime.exists && !runtime.valid && !staging.exists) return 'invalid_runtime';
  if (runtime.exists && !runtime.valid && staging.valid) return 'ready_to_repair';
  if (runtime.valid && staging.valid) return runtime.hash === staging.hash ? 'duplicate' : 'replacement_review';
  if (runtime.valid) return 'integrated';
  if (staging.valid) return 'ready_to_integrate';
  return 'missing';
}

function summarize(entries) {
  const counts = {};
  for (const entry of entries) counts[entry.state] = (counts[entry.state] || 0) + 1;
  return Object.freeze(counts);
}

function planBoardAssetIntake(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const runtimeRoot = path.resolve(projectRoot, options.runtimeRoot || 'game');
  const dropRoot = path.resolve(projectRoot, options.dropRoot || 'game/generated_assets');
  const expectedSize = options.expectedSize ?? 512;
  const manifest = options.manifest
    ? validateBoardThemeManifest(options.manifest)
    : loadBoardThemeManifest(path.resolve(projectRoot, options.manifestPath || 'content/assets/board-themes.json'));

  const entries = boardAssetRecords(manifest).map((record) => {
    const runtimePath = resolveInside(runtimeRoot, record.canonicalPath);
    const stagingPath = resolveInside(dropRoot, record.canonicalPath);
    const runtime = inspectPng(runtimePath, expectedSize);
    const staging = inspectPng(stagingPath, expectedSize);
    return Object.freeze({
      ...record,
      runtimePath,
      stagingPath,
      runtime,
      staging,
      state: classify(runtime, staging)
    });
  });

  const counts = summarize(entries);
  const blocking = entries.filter((entry) => ['invalid_staging', 'invalid_runtime', 'replacement_review'].includes(entry.state));
  const missingP0 = entries.filter((entry) => entry.priority === 'P0' && entry.state === 'missing');
  return Object.freeze({
    projectRoot,
    runtimeRoot,
    dropRoot,
    expectedSize,
    entries: Object.freeze(entries),
    counts,
    blocking: Object.freeze(blocking),
    missingP0: Object.freeze(missingP0),
    ready: Object.freeze(entries.filter((entry) => ['ready_to_integrate', 'ready_to_repair'].includes(entry.state)))
  });
}

function applyBoardAssetIntake(plan, options = {}) {
  if (!plan || !Array.isArray(plan.entries)) throw new Error('valid intake plan is required');
  const replace = Boolean(options.replace);
  const copied = [];
  const skipped = [];

  for (const entry of plan.entries) {
    const mayCopy = ['ready_to_integrate', 'ready_to_repair'].includes(entry.state)
      || (replace && entry.state === 'replacement_review');
    if (!mayCopy) {
      skipped.push(Object.freeze({ id: entry.id, state: entry.state }));
      continue;
    }
    if (!entry.staging.valid) throw new Error(`cannot copy invalid staging asset: ${entry.canonicalPath}`);
    if (entry.runtime.exists && entry.state === 'replacement_review' && !replace) {
      throw new Error(`replacement requires explicit replace option: ${entry.canonicalPath}`);
    }
    fs.mkdirSync(path.dirname(entry.runtimePath), { recursive: true });
    fs.copyFileSync(entry.stagingPath, entry.runtimePath);
    const integrated = inspectPng(entry.runtimePath, plan.expectedSize);
    if (!integrated.valid || integrated.hash !== entry.staging.hash) {
      throw new Error(`copied asset failed verification: ${entry.canonicalPath}`);
    }
    copied.push(Object.freeze({ id: entry.id, canonicalPath: entry.canonicalPath, hash: integrated.hash }));
  }

  return Object.freeze({ copied: Object.freeze(copied), skipped: Object.freeze(skipped) });
}

module.exports = {
  normalizeCanonicalPath,
  resolveInside,
  sha256File,
  inspectPng,
  boardAssetRecords,
  planBoardAssetIntake,
  applyBoardAssetIntake
};
