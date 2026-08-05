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
  if (x < 0 || x >= width || y < 0 || y >= height) throw new Error(`square outside board: ${square}`);
  return Object.freeze({ x, y });
}

function validateTileSet(tileSet) {
  if (!tileSet || typeof tileSet !== 'object') throw new Error('tileSet is required');
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(String(tileSet.id || ''))) {
    throw new Error('tileSet.id must be a stable lowercase identifier');
  }
  for (const field of FORBIDDEN_TILESET_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(tileSet, field)) {
      throw new Error(`tileSet must not define ${field}; browser boards use modular cells only`);
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

function buildBrowserBoardPlan(options = {}) {
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
      const parity = even === lightOnEven ? 'light' : 'dark';
      cells.push(Object.freeze({
        x,
        y,
        displayX: flipped ? width - 1 - x : x,
        displayY: flipped ? height - 1 - y : y,
        square: squareName(x, y, height),
        active,
        parity,
        asset: active ? tileSet[parity] : null,
        fallback: active ? tileSet[parity === 'light' ? 'fallbackLight' : 'fallbackDark'] : null
      }));
    }
  }
  return Object.freeze({
    format: 'rpchess-browser-board-plan',
    schemaVersion: 1,
    width,
    height,
    flipped,
    tileSet,
    cells: Object.freeze(cells),
    activeCells: Object.freeze(cells.filter((cell) => cell.active)),
    inactiveCells: Object.freeze(cells.filter((cell) => !cell.active))
  });
}

function validateBrowserBoardPlan(plan) {
  if (!plan || plan.format !== 'rpchess-browser-board-plan') throw new Error('invalid browser board plan');
  assertInteger('width', plan.width);
  assertInteger('height', plan.height);
  validateTileSet(plan.tileSet);
  if (!Array.isArray(plan.cells) || plan.cells.length !== plan.width * plan.height) throw new Error('browser board plan cell count mismatch');
  return plan;
}

function calculateBoardViewport(options = {}) {
  const canvasWidth = Number(options.canvasWidth);
  const canvasHeight = Number(options.canvasHeight);
  const boardWidth = Number(options.boardWidth);
  const boardHeight = Number(options.boardHeight);
  const padding = Math.max(0, Number(options.padding ?? 24));
  if (!(canvasWidth > 0) || !(canvasHeight > 0)) throw new Error('canvas dimensions must be positive');
  assertInteger('board width', boardWidth);
  assertInteger('board height', boardHeight);
  const usableWidth = Math.max(1, canvasWidth - padding * 2);
  const usableHeight = Math.max(1, canvasHeight - padding * 2);
  const cellSize = Math.max(1, Math.floor(Math.min(usableWidth / boardWidth, usableHeight / boardHeight)));
  const width = cellSize * boardWidth;
  const height = cellSize * boardHeight;
  return Object.freeze({
    x: Math.floor((canvasWidth - width) / 2),
    y: Math.floor((canvasHeight - height) / 2),
    width,
    height,
    cellSize,
    padding
  });
}

function resizeCanvasForDisplay(canvas, cssWidth, cssHeight, devicePixelRatio = globalThis.devicePixelRatio || 1) {
  if (!canvas || typeof canvas.getContext !== 'function') throw new Error('canvas element is required');
  if (!(cssWidth > 0) || !(cssHeight > 0)) throw new Error('display dimensions must be positive');
  const dpr = Math.max(1, Number(devicePixelRatio) || 1);
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  if (canvas.style) {
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
  }
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context is unavailable');
  if (typeof context.setTransform === 'function') context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return Object.freeze({ context, cssWidth, cssHeight, devicePixelRatio: dpr });
}

class TileImageCache {
  constructor(options = {}) {
    this.ImageCtor = options.ImageCtor || globalThis.Image || null;
    this.records = new Map();
  }

  request(source) {
    const src = String(source || '');
    if (!src || src.startsWith('technical://')) {
      const record = Object.freeze({ source: src, status: 'unavailable', image: null });
      if (src) this.records.set(src, record);
      return record;
    }
    if (this.records.has(src)) return this.records.get(src);
    if (!this.ImageCtor) {
      const record = Object.freeze({ source: src, status: 'unavailable', image: null });
      this.records.set(src, record);
      return record;
    }
    const image = new this.ImageCtor();
    const record = { source: src, status: 'loading', image };
    this.records.set(src, record);
    image.onload = () => { record.status = 'ready'; };
    image.onerror = () => { record.status = 'error'; };
    image.src = src;
    return record;
  }

  get(source) {
    return this.records.get(String(source || '')) || null;
  }

  prime(sources) {
    for (const source of new Set(sources || [])) this.request(source);
    return this;
  }

  status(source) {
    return this.get(source)?.status || 'missing';
  }
}

function drawFallbackCell(context, cell, rect, options) {
  context.fillStyle = cell.fallback;
  context.fillRect(rect.x, rect.y, rect.size, rect.size);
  if (options.fallbackPattern === false) return;
  const canPath = typeof context.beginPath === 'function'
    && typeof context.moveTo === 'function'
    && typeof context.lineTo === 'function'
    && typeof context.stroke === 'function';
  if (!canPath) return;
  context.save?.();
  context.strokeStyle = options.fallbackPatternColor || 'rgba(255,255,255,.10)';
  context.lineWidth = Math.max(1, rect.size / 32);
  context.beginPath();
  context.moveTo(rect.x, rect.y + rect.size);
  context.lineTo(rect.x + rect.size, rect.y);
  context.moveTo(rect.x - rect.size * 0.35, rect.y + rect.size);
  context.lineTo(rect.x + rect.size * 0.65, rect.y);
  context.moveTo(rect.x + rect.size * 0.35, rect.y + rect.size);
  context.lineTo(rect.x + rect.size * 1.35, rect.y);
  context.stroke();
  context.restore?.();
}

function drawCoordinates(context, plan, viewport, options) {
  if (options.showCoordinates === false || typeof context.fillText !== 'function') return 0;
  const fontSize = Math.max(9, Math.floor(viewport.cellSize * 0.16));
  context.save?.();
  context.font = `${fontSize}px system-ui, sans-serif`;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = options.coordinateColor || 'rgba(255,255,255,.82)';
  let count = 0;
  for (const cell of plan.activeCells) {
    const rect = {
      x: viewport.x + cell.displayX * viewport.cellSize,
      y: viewport.y + cell.displayY * viewport.cellSize,
      size: viewport.cellSize
    };
    const match = /^([a-z]+)([0-9]+)$/.exec(cell.square);
    if (!match) continue;
    if (cell.displayY === plan.height - 1) {
      context.fillText(match[1], rect.x + Math.max(3, fontSize * 0.25), rect.y + rect.size - Math.max(3, fontSize * 0.22));
      count += 1;
    }
    if (cell.displayX === 0) {
      context.fillText(match[2], rect.x + Math.max(3, fontSize * 0.25), rect.y + fontSize + Math.max(2, fontSize * 0.1));
      count += 1;
    }
  }
  context.restore?.();
  return count;
}

function renderModularBoard(context, planInput, options = {}) {
  if (!context || typeof context.fillRect !== 'function') throw new Error('2D canvas context is required');
  const plan = validateBrowserBoardPlan(planInput);
  const canvasWidth = Number(options.canvasWidth ?? context.canvas?.clientWidth ?? context.canvas?.width);
  const canvasHeight = Number(options.canvasHeight ?? context.canvas?.clientHeight ?? context.canvas?.height);
  const viewport = calculateBoardViewport({
    canvasWidth,
    canvasHeight,
    boardWidth: plan.width,
    boardHeight: plan.height,
    padding: options.padding
  });
  const cache = options.assetCache || null;
  const missingAssets = new Set();
  let imageCells = 0;
  let fallbackCells = 0;
  let overlayCalls = 0;

  context.save?.();
  if (options.clear !== false && typeof context.clearRect === 'function') context.clearRect(0, 0, canvasWidth, canvasHeight);
  if (options.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  for (const cell of plan.activeCells) {
    const rect = Object.freeze({
      x: viewport.x + cell.displayX * viewport.cellSize,
      y: viewport.y + cell.displayY * viewport.cellSize,
      size: viewport.cellSize
    });
    let record = cache?.get(cell.asset) || null;
    if (!record && cache && options.requestAssets !== false) record = cache.request(cell.asset);
    if (record?.status === 'ready' && record.image && typeof context.drawImage === 'function') {
      context.drawImage(record.image, rect.x, rect.y, rect.size, rect.size);
      imageCells += 1;
    } else {
      drawFallbackCell(context, cell, rect, options);
      fallbackCells += 1;
      if (cell.asset && !cell.asset.startsWith('technical://')) missingAssets.add(cell.asset);
    }
    if (options.grid !== false && typeof context.strokeRect === 'function') {
      context.strokeStyle = options.gridColor || 'rgba(8,15,20,.38)';
      context.lineWidth = Math.max(1, viewport.cellSize / 96);
      context.strokeRect(rect.x, rect.y, rect.size, rect.size);
    }
    if (typeof options.drawCellOverlay === 'function') {
      options.drawCellOverlay(context, cell, rect, plan);
      overlayCalls += 1;
    }
  }

  const coordinateLabels = drawCoordinates(context, plan, viewport, options);
  context.restore?.();
  return Object.freeze({
    viewport,
    activeCells: plan.activeCells.length,
    inactiveCells: plan.inactiveCells.length,
    imageCells,
    fallbackCells,
    overlayCalls,
    coordinateLabels,
    missingAssets: Object.freeze([...missingAssets].sort())
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

export {
  FORBIDDEN_TILESET_FIELDS,
  fileLabel,
  fileIndex,
  squareName,
  parseSquare,
  validateTileSet,
  normalizeActiveMask,
  buildBrowserBoardPlan,
  validateBrowserBoardPlan,
  calculateBoardViewport,
  resizeCanvasForDisplay,
  TileImageCache,
  renderModularBoard,
  technicalTileSet
};
