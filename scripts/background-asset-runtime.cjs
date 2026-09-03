const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { decodePng, parsePng, formatBytes } = require('./piece-asset-runtime.cjs');

const BACKGROUND_RUNTIME_WIDTH = 1600;
const BACKGROUND_RUNTIME_HEIGHT = 900;
const BACKGROUND_RUNTIME_CHANNEL_BITS = 6;
const BACKGROUND_RUNTIME_MAX_BYTES = 1792 * 1024;
const BACKGROUND_RUNTIME_MAX_TOTAL_BYTES = 45 * 1024 * 1024;
const CANONICAL_BACKGROUND_FILES = Object.freeze({
  generic:['forest_crossroad.png','old_kings_road.png','roadside_shrine.png','abandoned_camp.png','ancient_ruins.png','stormy_bridge.png','moonlit_gravefield.png','market_square_twilight.png'],
  humans:['human_waystation.png','human_chapel_court.png'],
  elves:['elven_glade.png','elven_waystones.png'],
  orcs:['orc_war_camp.png','orc_trial_circle.png'],
  undead:['necropolis_gate.png','bone_court.png'],
  dark_elves:['obsidian_passage.png','spider_shrine.png'],
  dwarves:['dwarven_forgehall.png','dwarven_gate_road.png'],
  demons:['infernal_breach.png','ashen_altar.png'],
  angels:['sky_sanctuary.png','hall_of_halos.png'],
  dragonborn:['dragonborn_aerie.png','ember_tribunal.png'],
  beastfolk:['beastfolk_hunting_camp.png','moon_run_path.png'],
  constructs:['construct_foundry.png','silent_observatory.png'],
  animals:['wild_glen.png','riverbank_tracks.png'],
  fae:['fae_ring_garden.png','whispering_meadow.png'],
  goblins:['goblin_trade_nook.png','goblin_scrapyard_camp.png']
});
const BACKGROUND_RUNTIME_EXPECTED_COUNT = Object.values(CANONICAL_BACKGROUND_FILES).reduce((sum, files) => sum + files.length, 0);
const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const out = Buffer.allocUnsafe(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuffer.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
}

function filterRow(row, prev, bpp, type) {
  const out = Buffer.allocUnsafe(row.length);
  let score = 0;
  for (let i = 0; i < row.length; i++) {
    const left = i >= bpp ? row[i - bpp] : 0;
    const up = prev ? prev[i] : 0;
    const upLeft = prev && i >= bpp ? prev[i - bpp] : 0;
    let predictor = 0;
    if (type === 1) predictor = left;
    else if (type === 2) predictor = up;
    else if (type === 3) predictor = Math.floor((left + up) / 2);
    else if (type === 4) predictor = paeth(left, up, upLeft);
    const value = (row[i] - predictor + 256) & 255;
    out[i] = value;
    score += Math.abs(value < 128 ? value : value - 256);
  }
  return { out, score };
}

function encodeRgbPng(width, height, rgb) {
  if (rgb.length !== width * height * 3) throw new Error('RGB buffer length mismatch');
  const scanlines = [];
  let prev = null;
  for (let y = 0; y < height; y++) {
    const row = rgb.subarray(y * width * 3, (y + 1) * width * 3);
    let bestType = 0, best = filterRow(row, prev, 3, 0);
    for (let type = 1; type <= 4; type++) {
      const candidate = filterRow(row, prev, 3, type);
      if (candidate.score < best.score) { bestType = type; best = candidate; }
    }
    scanlines.push(Buffer.from([bestType]), best.out);
    prev = row;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const compressed = zlib.deflateSync(Buffer.concat(scanlines), { level: 9 });
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND')]);
}

function quantizeChannel(value, bits) {
  if (bits >= 8) return value;
  const levels = (1 << bits) - 1;
  return Math.round(Math.round(value * levels / 255) * 255 / levels);
}

function collectBackgroundAssetPaths(root) {
  const paths = [];
  for (const [folder, files] of Object.entries(CANONICAL_BACKGROUND_FILES)) {
    for (const file of files) paths.push(`assets/events/register-04/backgrounds/${folder}/${file}`);
  }
  const missing = paths.filter((relative) => !fs.existsSync(path.join(root, relative)));
  if (missing.length) throw new Error(`[background asset contract] missing canonical backgrounds:\n${missing.join('\n')}`);
  return paths.sort();
}

function validateOpaque(rgba, pixels) {
  for (let i = 0, offset = 3; i < pixels; i++, offset += 4) {
    if (rgba[offset] !== 255) throw new Error(`background contains transparency at pixel ${i}`);
  }
}

function resizeAndQuantizeRgb(rgba, srcWidth, srcHeight, dstWidth, dstHeight, bits) {
  const out = Buffer.allocUnsafe(dstWidth * dstHeight * 3);
  const sxScale = srcWidth / dstWidth;
  const syScale = srcHeight / dstHeight;
  const x0 = new Int32Array(dstWidth), x1 = new Int32Array(dstWidth), fx = new Float64Array(dstWidth);
  for (let x = 0; x < dstWidth; x++) {
    const sx = Math.max(0, Math.min(srcWidth - 1, (x + 0.5) * sxScale - 0.5));
    x0[x] = Math.floor(sx);
    x1[x] = Math.min(srcWidth - 1, x0[x] + 1);
    fx[x] = sx - x0[x];
  }
  let dst = 0;
  for (let y = 0; y < dstHeight; y++) {
    const sy = Math.max(0, Math.min(srcHeight - 1, (y + 0.5) * syScale - 0.5));
    const y0 = Math.floor(sy), y1 = Math.min(srcHeight - 1, y0 + 1), fy = sy - y0;
    for (let x = 0; x < dstWidth; x++) {
      const ax = fx[x], bx = 1 - ax, by = 1 - fy;
      const i00 = (y0 * srcWidth + x0[x]) * 4;
      const i10 = (y0 * srcWidth + x1[x]) * 4;
      const i01 = (y1 * srcWidth + x0[x]) * 4;
      const i11 = (y1 * srcWidth + x1[x]) * 4;
      for (let c = 0; c < 3; c++) {
        const top = rgba[i00 + c] * bx + rgba[i10 + c] * ax;
        const bottom = rgba[i01 + c] * bx + rgba[i11 + c] * ax;
        out[dst++] = quantizeChannel(Math.round(top * by + bottom * fy), bits);
      }
    }
  }
  return out;
}

function optimizeBackgroundBuffer(buffer, channelBits = BACKGROUND_RUNTIME_CHANNEL_BITS) {
  if (!Number.isInteger(channelBits) || channelBits < 4 || channelBits > 8) throw new Error(`invalid background channelBits ${channelBits}`);
  const decoded = decodePng(buffer);
  if (decoded.width < BACKGROUND_RUNTIME_WIDTH || decoded.height < BACKGROUND_RUNTIME_HEIGHT) {
    throw new Error(`background ${decoded.width}x${decoded.height} is smaller than runtime target ${BACKGROUND_RUNTIME_WIDTH}x${BACKGROUND_RUNTIME_HEIGHT}`);
  }
  validateOpaque(decoded.rgba, decoded.width * decoded.height);
  const rgb = resizeAndQuantizeRgb(decoded.rgba, decoded.width, decoded.height, BACKGROUND_RUNTIME_WIDTH, BACKGROUND_RUNTIME_HEIGHT, channelBits);
  return {
    buffer: encodeRgbPng(BACKGROUND_RUNTIME_WIDTH, BACKGROUND_RUNTIME_HEIGHT, rgb),
    width: BACKGROUND_RUNTIME_WIDTH,
    height: BACKGROUND_RUNTIME_HEIGHT,
    sourceWidth: decoded.width,
    sourceHeight: decoded.height,
    channelBits
  };
}

function inspectBackgroundAssets(root) {
  const paths = collectBackgroundAssetPaths(root);
  let totalBytes = 0;
  const records = [];
  for (const relative of paths) {
    const full = path.join(root, relative);
    const buffer = fs.readFileSync(full);
    const png = parsePng(buffer);
    totalBytes += buffer.length;
    records.push({ path: relative, bytes: buffer.length, width: png.width, height: png.height });
  }
  return { count: paths.length, totalBytes, paths, records };
}

function assertBackgroundAssetBudget(root, {
  maxBytes = BACKGROUND_RUNTIME_MAX_BYTES,
  maxTotalBytes = BACKGROUND_RUNTIME_MAX_TOTAL_BYTES
} = {}) {
  const contract = inspectBackgroundAssets(root);
  const failures = [];
  let totalBytes = 0;
  for (const record of contract.records) {
    totalBytes += record.bytes;
    const full = path.join(root, record.path);
    const png = parsePng(fs.readFileSync(full));
    if (record.width !== BACKGROUND_RUNTIME_WIDTH || record.height !== BACKGROUND_RUNTIME_HEIGHT) failures.push(`${record.path}: ${record.width}x${record.height}, expected ${BACKGROUND_RUNTIME_WIDTH}x${BACKGROUND_RUNTIME_HEIGHT}`);
    if (record.bytes > maxBytes) failures.push(`${record.path}: ${formatBytes(record.bytes)} exceeds ${formatBytes(maxBytes)}`);
    if (png.colorType !== 2) failures.push(`${record.path}: expected opaque RGB PNG colorType=2, found ${png.colorType}`);
  }
  if (totalBytes > maxTotalBytes) failures.push(`aggregate ${formatBytes(totalBytes)} exceeds ${formatBytes(maxTotalBytes)}`);
  if (failures.length) throw new Error(`[background asset budget] runtime backgrounds exceed budget:\n${failures.join('\n')}`);
  return { count: contract.count, totalBytes };
}

function optimizeBackgroundAssets(root, { write = false, channelBits = BACKGROUND_RUNTIME_CHANNEL_BITS } = {}) {
  const contract = inspectBackgroundAssets(root);
  const records = [];
  for (const relative of contract.paths) {
    const full = path.join(root, relative);
    const source = fs.readFileSync(full);
    const optimized = optimizeBackgroundBuffer(source, channelBits);
    if (write) fs.writeFileSync(full, optimized.buffer);
    records.push({ path: relative, before: source.length, after: optimized.buffer.length, width: optimized.width, height: optimized.height, sourceWidth: optimized.sourceWidth, sourceHeight: optimized.sourceHeight, skipped: false });
  }
  const beforeBytes = records.reduce((sum, item) => sum + item.before, 0);
  const afterBytes = records.reduce((sum, item) => sum + item.after, 0);
  return {
    count: records.length,
    beforeBytes,
    afterBytes,
    savedBytes: beforeBytes - afterBytes,
    savedPercent: beforeBytes ? (beforeBytes - afterBytes) * 100 / beforeBytes : 0,
    channelBits,
    records
  };
}

function printReport(report) {
  console.log(`Background assets: ${report.count}; target: ${BACKGROUND_RUNTIME_WIDTH}x${BACKGROUND_RUNTIME_HEIGHT}; RGB channel bits: ${report.channelBits}`);
  console.log(`Before: ${formatBytes(report.beforeBytes)}`);
  console.log(`Projected: ${formatBytes(report.afterBytes)}`);
  console.log(`Saved: ${formatBytes(report.savedBytes)} (${report.savedPercent.toFixed(1)}%)`);
  for (const item of [...report.records].sort((a, b) => (b.before - b.after) - (a.before - a.after)).slice(0, 12)) {
    console.log(`${item.path}: ${item.sourceWidth}x${item.sourceHeight} ${formatBytes(item.before)} -> ${item.width}x${item.height} ${formatBytes(item.after)}`);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf('--root');
  const bitsIndex = args.indexOf('--bits');
  const root = path.resolve(rootIndex >= 0 && args[rootIndex + 1] ? args[rootIndex + 1] : 'game');
  const channelBits = bitsIndex >= 0 && args[bitsIndex + 1] ? Number(args[bitsIndex + 1]) : BACKGROUND_RUNTIME_CHANNEL_BITS;
  const write = args.includes('--write');
  const verifyOnly = args.includes('--verify-only');
  if (verifyOnly) {
    const budget = assertBackgroundAssetBudget(root);
    console.log(`Background asset budget PASS: ${budget.count}/${BACKGROUND_RUNTIME_EXPECTED_COUNT}, ${BACKGROUND_RUNTIME_WIDTH}x${BACKGROUND_RUNTIME_HEIGHT}, <=${formatBytes(BACKGROUND_RUNTIME_MAX_BYTES)} each, <=${formatBytes(BACKGROUND_RUNTIME_MAX_TOTAL_BYTES)} aggregate`);
  } else {
    const report = optimizeBackgroundAssets(root, { write, channelBits });
    printReport(report);
    if (write) assertBackgroundAssetBudget(root);
  }
}

module.exports = {
  CANONICAL_BACKGROUND_FILES,
  BACKGROUND_RUNTIME_EXPECTED_COUNT,
  BACKGROUND_RUNTIME_WIDTH,
  BACKGROUND_RUNTIME_HEIGHT,
  BACKGROUND_RUNTIME_CHANNEL_BITS,
  BACKGROUND_RUNTIME_MAX_BYTES,
  BACKGROUND_RUNTIME_MAX_TOTAL_BYTES,
  collectBackgroundAssetPaths,
  inspectBackgroundAssets,
  assertBackgroundAssetBudget,
  optimizeBackgroundBuffer,
  optimizeBackgroundAssets,
  printReport
};
