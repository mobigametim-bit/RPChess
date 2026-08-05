'use strict';

const FORBIDDEN_TILESET_FIELDS = Object.freeze([
  'board',
  'boardImage',
  'completeBoard',
  'frame',
  'underlay'
]);

function assertInteger(name, value, min = 1, max = 64) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
}

function fileLabel(index) {
  assertInteger('file index', index, 0, 701);
  let value = index + 1;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(97 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function fileIndex(label) {
  if (!/^[a-z]+$/i.test(label)) throw new Error(`invalid file label: ${label}`);
  let value = 0;
  for (const char of label.toLowerCase()) value = value * 26 + char.charCodeAt(0) - 96;
  return value - 1;
}

function squareName(x, y, height) {
  return `${fileLabel(x)}${height - y}`;
}

function parseSquare(square, width, height) {
  const match = /^([a-z]+)([1-9][0-9]*)$/i.exec(String(square));
  if (!match) throw new Error(`invalid square: ${square}`);
  const x = fileIndex(match[1]);
  const rank = Number(match[2]);
  const y = height - rank;
  if (x < 0 || x >= width || y < 0 || y >= height) {
    throw new Error(`square outside board: ${square}`);
  }
  return Object.freeze({ x, y });
}

function validateTileSet(tileSet) {
  if (!tileSet || typeof tileSet !== 'object') throw new Error('tileSet is required');
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(String(tileSet.id || ''))) {
    throw new Error('tileSet.id must be a stable lowercase identifier');
  }
  for (const field of FORBIDDEN_TILESET_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(tileSet, field)) {
      throw new Error(`tileSet must not define ${field}; runtime boards use modular cells only`);
    }
  }
  if (typeof tileSet.light !== 'string' || !tileSet.light.trim()) throw new Error('tileSet.light is required');
  if (typeof tileSet.dark !== 'string' || !tileSet.dark.trim()) throw new Error('tileSet.dark is required');
  if (tileSet.light === tileSet.dark) throw new Error('light and dark tile assets must differ');
  return Object.freeze({
    id: tileSet.id,
    light: tileSet.light,
    dark: tileSet.dark,
    fallbackLight: tileSet.fallbackLight || '#d8d1bd',
    fallbackDark: tileSet.fallbackDark || '#596878'
  });
}

function normalizeActiveMask(width, height, activeCells = null) {
  const total = width * height;
  if (activeCells == null) return Object.freeze(Array(total).fill(true));

  if (Array.isArray(activeCells) && activeCells.length === height && activeCells.every(Array.isArray)) {
    const mask = [];
    for (const row of activeCells) {
      if (row.length !== width) throw new Error('active-cell matrix width mismatch');
      for (const active of row) mask.push(Boolean(active));
    }
    return Object.freeze(mask);
  }

  if (!Array.isArray(activeCells)) throw new Error('activeCells must be null, a matrix or an array of cells');
  const mask = Array(total).fill(false);
  for (const item of activeCells) {
    let cell;
    if (typeof item === 'string') cell = parseSquare(item, width, height);
    else if (item && Number.isInteger(item.x) && Number.isInteger(item.y)) cell = item;
    else throw new Error('activeCells entries must be square names or {x,y} objects');
    if (cell.x < 0 || cell.x >= width || cell.y < 0 || cell.y >= height) {
      throw new Error(`active cell outside board: ${JSON.stringify(item)}`);
    }
    mask[cell.y * width + cell.x] = true;
  }
  return Object.freeze(mask);
}

function buildBoardCellPlan(options = {}) {
  const width = options.width ?? 8;
  const height = options.height ?? 8;
  assertInteger('width', width);
  assertInteger('height', height);
  const tileSet = validateTileSet(options.tileSet);
  const mask = normalizeActiveMask(width, height, options.activeCells);
  const flipped = Boolean(options.flipped);
  const lightOnEven = options.lightOnEven !== false;
  const cells = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const active = mask[y * width + x];
      const even = (x + y) % 2 === 0;
      const tileKey = even === lightOnEven ? 'light' : 'dark';
      const displayX = flipped ? width - 1 - x : x;
      const displayY = flipped ? height - 1 - y : y;
      cells.push(Object.freeze({
        x,
        y,
        displayX,
        displayY,
        square: squareName(x, y, height),
        active,
        parity: tileKey,
        asset: active ? tileSet[tileKey] : null,
        fallback: active ? tileSet[tileKey === 'light' ? 'fallbackLight' : 'fallbackDark'] : null
      }));
    }
  }

  return Object.freeze({
    width,
    height,
    flipped,
    tileSet,
    cells: Object.freeze(cells),
    activeCells: Object.freeze(cells.filter((cell) => cell.active)),
    inactiveCells: Object.freeze(cells.filter((cell) => !cell.active))
  });
}

function technicalTileSet(id = 'technical') {
  return validateTileSet({
    id,
    light: 'technical://tile_light',
    dark: 'technical://tile_dark',
    fallbackLight: '#d8d1bd',
    fallbackDark: '#596878'
  });
}

module.exports = {
  FORBIDDEN_TILESET_FIELDS,
  fileLabel,
  fileIndex,
  squareName,
  parseSquare,
  validateTileSet,
  normalizeActiveMask,
  buildBoardCellPlan,
  technicalTileSet
};
