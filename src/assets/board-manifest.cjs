'use strict';

const fs = require('fs');
const path = require('path');
const { FORBIDDEN_TILESET_FIELDS, validateTileSet } = require('../rendering/modular-board.cjs');

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readPngDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 26) throw new Error('PNG file is too small');
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('invalid PNG signature');
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') throw new Error('PNG is missing IHDR');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  if (!width || !height) throw new Error('PNG dimensions must be positive');
  return Object.freeze({ width, height, bitDepth, colorType });
}

function normalizeTheme(theme) {
  if (!theme || typeof theme !== 'object') throw new Error('board theme must be an object');
  for (const field of FORBIDDEN_TILESET_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(theme, field)) {
      throw new Error(`board theme ${theme.id || '<unknown>'} must not define ${field}`);
    }
  }
  const tileSet = validateTileSet(theme);
  if (path.posix.basename(tileSet.light) !== 'tile_light.png') {
    throw new Error(`board theme ${tileSet.id} light asset must be named tile_light.png`);
  }
  if (path.posix.basename(tileSet.dark) !== 'tile_dark.png') {
    throw new Error(`board theme ${tileSet.id} dark asset must be named tile_dark.png`);
  }
  return Object.freeze({
    ...tileSet,
    biome: theme.biome || tileSet.id,
    priority: theme.priority || 'P1',
    status: theme.status || 'MISSING'
  });
}

function validateBoardThemeManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new Error('board theme manifest must be an object');
  if (manifest.schemaVersion !== 1) throw new Error('unsupported board theme manifest schemaVersion');
  if (!Array.isArray(manifest.themes) || manifest.themes.length === 0) {
    throw new Error('board theme manifest must contain themes');
  }
  const seen = new Set();
  const themes = manifest.themes.map((theme) => {
    const normalized = normalizeTheme(theme);
    if (seen.has(normalized.id)) throw new Error(`duplicate board theme id: ${normalized.id}`);
    seen.add(normalized.id);
    return normalized;
  });
  return Object.freeze({ schemaVersion: 1, themes: Object.freeze(themes) });
}

function loadBoardThemeManifest(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return validateBoardThemeManifest(parsed);
}

function resolveInside(root, relativePath) {
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(absoluteRoot, relativePath);
  if (absolute !== absoluteRoot && !absolute.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error(`asset path escapes root: ${relativePath}`);
  }
  return absolute;
}

function auditBoardThemeFiles(root, manifestInput, options = {}) {
  const manifest = validateBoardThemeManifest(manifestInput);
  const expectedSize = options.expectedSize ?? 512;
  const allowMissing = options.allowMissing !== false;
  const themes = [];
  const missing = [];
  const errors = [];

  for (const theme of manifest.themes) {
    const files = {};
    for (const kind of ['light', 'dark']) {
      const relativePath = theme[kind];
      let absolutePath;
      try {
        absolutePath = resolveInside(root, relativePath);
      } catch (error) {
        errors.push({ themeId: theme.id, kind, path: relativePath, message: error.message });
        continue;
      }
      if (!fs.existsSync(absolutePath)) {
        missing.push({ themeId: theme.id, kind, path: relativePath });
        files[kind] = Object.freeze({ path: relativePath, exists: false });
        continue;
      }
      try {
        const dimensions = readPngDimensions(fs.readFileSync(absolutePath));
        if (dimensions.width !== expectedSize || dimensions.height !== expectedSize) {
          throw new Error(`expected ${expectedSize}x${expectedSize}, got ${dimensions.width}x${dimensions.height}`);
        }
        files[kind] = Object.freeze({ path: relativePath, exists: true, ...dimensions });
      } catch (error) {
        errors.push({ themeId: theme.id, kind, path: relativePath, message: error.message });
        files[kind] = Object.freeze({ path: relativePath, exists: true, invalid: true });
      }
    }
    themes.push(Object.freeze({
      id: theme.id,
      ready: Boolean(files.light?.exists && !files.light.invalid && files.dark?.exists && !files.dark.invalid),
      files: Object.freeze(files)
    }));
  }

  return Object.freeze({
    ok: errors.length === 0 && (allowMissing || missing.length === 0),
    expectedSize,
    allowMissing,
    themes: Object.freeze(themes),
    missing: Object.freeze(missing),
    errors: Object.freeze(errors)
  });
}

module.exports = {
  PNG_SIGNATURE,
  readPngDimensions,
  normalizeTheme,
  validateBoardThemeManifest,
  loadBoardThemeManifest,
  auditBoardThemeFiles
};
