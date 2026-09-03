const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { decodePng, parsePng, formatBytes } = require('./piece-asset-runtime.cjs');

const BACKGROUND_RUNTIME_EXPECTED_COUNT = 36;
const BACKGROUND_RUNTIME_WIDTH = 1600;
const BACKGROUND_RUNTIME_HEIGHT = 900;
const BACKGROUND_RUNTIME_CHANNEL_BITS = 5;
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
  const base = path.join(root, 'assets/events/register-04/backgrounds');
  const output = [];
  function walk(full, relative) {
    if (!fs.existsSync(full)) return;
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      const child = path.join(full, entry.name);
      const rel = path.join(relative, entry.name);
      if (entry.isDirectory()) walk(child, rel);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) output.push(rel.split(path.sep).join('/'));
    }
  }
  walk(base, 'assets/events/register-04/backgrounds');
  return output.sort();
}

function optimizeBackgroundBuffer(buffer, channelBits = BACKGROUND_RUNTIME_CHANNEL_BITS) {
  if (!Number.isInteger(channelBits) || channelBits < 4 || channelBits > 8) throw new Error(`invalid background channelBits ${channelBits}`);
  const decoded = decodePng(buffer);
  const rgb = Buffer.allocUnsafe(decoded.width * decoded.height * 3);
  let src = 0, dst = 0;
  for (let i = 0; i < decoded.width * decoded.height; i++) {
    const r = decoded.rgba[src++], g = decoded.rgba[src++], b = decoded.rgba[src++], a = decoded.rgba[src++];
    if (a !== 255) throw new Error(`background contains transparency at pixel ${i}`);
    rgb[dst++] = quantizeChannel(r, channelBits);
    rgb[dst++] = quantizeChannel(g, channelBits);
    rgb[dst++] = quantizeChannel(b, channelBits);
  }
  return {
    buffer: encodeRgbPng(decoded.width, decoded.height, rgb),
    width: decoded.width,
    height: decoded.height,
    channelBits
  };
}

function inspectBackgroundAssets(root, { expectedCount = BACKGROUND_RUNTIME_EXPECTED_COUNT } = {}) {
  const paths = collectBackgroundAssetPaths(root);
  const failures = [];
  if (paths.length !== expectedCount) failures.push(`expected ${expectedCount} event backgrounds, found ${paths.length}`);
  let totalBytes = 0;
  for (const relative of paths) {
    const full = path.join(root, relative);
    const buffer = fs.readFileSync(full);
    const png = parsePng(buffer);
    totalBytes += buffer.length;
    if (png.width !== BACKGROUND_RUNTIME_WIDTH || png.height !== BACKGROUND_RUNTIME_HEIGHT) failures.push(`${relative}: expected ${BACKGROUND_RUNTIME_WIDTH}x${BACKGROUND_RUNTIME_HEIGHT}, found ${png.width}x${png.height}`);
  }
  if (failures.length) throw new Error(`[background asset contract] ${failures.join('\n')}`);
  return { count: paths.length, totalBytes, paths };
}

function optimizeBackgroundAssets(root, {
  write = false,
  channelBits = BACKGROUND_RUNTIME_CHANNEL_BITS,
  expectedCount = BACKGROUND_RUNTIME_EXPECTED_COUNT
} = {}) {
  const contract = inspectBackgroundAssets(root, { expectedCount });
  const records = [];
  for (const relative of contract.paths) {
    const full = path.join(root, relative);
    const source = fs.readFileSync(full);
    const optimized = optimizeBackgroundBuffer(source, channelBits);
    const keepSource = optimized.buffer.length >= source.length;
    const output = keepSource ? source : optimized.buffer;
    if (write && !keepSource) fs.writeFileSync(full, output);
    records.push({ path: relative, before: source.length, after: output.length, width: optimized.width, height: optimized.height, skipped: keepSource });
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
  console.log(`Background assets: ${report.count}; RGB channel bits: ${report.channelBits}`);
  console.log(`Before: ${formatBytes(report.beforeBytes)}`);
  console.log(`Projected: ${formatBytes(report.afterBytes)}`);
  console.log(`Saved: ${formatBytes(report.savedBytes)} (${report.savedPercent.toFixed(1)}%)`);
  for (const item of [...report.records].sort((a, b) => (b.before - b.after) - (a.before - a.after)).slice(0, 12)) {
    console.log(`${item.path}: ${formatBytes(item.before)} -> ${formatBytes(item.after)}${item.skipped ? ' (kept source)' : ''}`);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf('--root');
  const bitsIndex = args.indexOf('--bits');
  const root = path.resolve(rootIndex >= 0 && args[rootIndex + 1] ? args[rootIndex + 1] : 'game');
  const channelBits = bitsIndex >= 0 && args[bitsIndex + 1] ? Number(args[bitsIndex + 1]) : BACKGROUND_RUNTIME_CHANNEL_BITS;
  const write = args.includes('--write');
  const report = optimizeBackgroundAssets(root, { write, channelBits });
  printReport(report);
}

module.exports = {
  BACKGROUND_RUNTIME_EXPECTED_COUNT,
  BACKGROUND_RUNTIME_WIDTH,
  BACKGROUND_RUNTIME_HEIGHT,
  BACKGROUND_RUNTIME_CHANNEL_BITS,
  collectBackgroundAssetPaths,
  inspectBackgroundAssets,
  optimizeBackgroundBuffer,
  optimizeBackgroundAssets,
  printReport
};
