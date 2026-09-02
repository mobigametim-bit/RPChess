const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PIECE_RUNTIME_MAX_SIDE = 256;
const PIECE_RUNTIME_MAX_BYTES = 320 * 1024;
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

function parsePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('not a PNG file');
  }
  let offset = 8;
  let ihdr = null;
  const idat = [];
  let palette = null;
  let transparency = null;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > buffer.length) throw new Error(`truncated PNG chunk ${type}`);
    const data = buffer.subarray(start, end);
    if (type === 'IHDR') ihdr = Buffer.from(data);
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'PLTE') palette = Buffer.from(data);
    else if (type === 'tRNS') transparency = Buffer.from(data);
    offset = end + 4;
    if (type === 'IEND') break;
  }
  if (!ihdr || ihdr.length !== 13 || !idat.length) throw new Error('PNG missing IHDR/IDAT');
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const compression = ihdr[10];
  const filter = ihdr[11];
  const interlace = ihdr[12];
  if (bitDepth !== 8 || compression !== 0 || filter !== 0 || interlace !== 0) {
    throw new Error(`unsupported PNG encoding: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  }
  const channelsByType = {0:1,2:3,3:1,4:2,6:4};
  const channels = channelsByType[colorType];
  if (!channels) throw new Error(`unsupported PNG color type ${colorType}`);
  return {width,height,colorType,channels,palette,transparency,compressed:Buffer.concat(idat)};
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
}

function decodePng(buffer) {
  const png = parsePng(buffer);
  const {width,height,colorType,channels,palette,transparency} = png;
  const stride = width * channels;
  const inflated = zlib.inflateSync(png.compressed);
  const expected = height * (stride + 1);
  if (inflated.length !== expected) throw new Error(`unexpected PNG payload length ${inflated.length}; expected ${expected}`);
  const rows = Buffer.allocUnsafe(height * stride);
  let inputOffset = 0;
  for (let y = 0; y < height; y++) {
    const filterType = inflated[inputOffset++];
    const rowOffset = y * stride;
    const prevOffset = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const raw = inflated[inputOffset++];
      const left = x >= channels ? rows[rowOffset + x - channels] : 0;
      const up = y > 0 ? rows[prevOffset + x] : 0;
      const upLeft = y > 0 && x >= channels ? rows[prevOffset + x - channels] : 0;
      let value;
      if (filterType === 0) value = raw;
      else if (filterType === 1) value = (raw + left) & 255;
      else if (filterType === 2) value = (raw + up) & 255;
      else if (filterType === 3) value = (raw + Math.floor((left + up) / 2)) & 255;
      else if (filterType === 4) value = (raw + paeth(left, up, upLeft)) & 255;
      else throw new Error(`unsupported PNG row filter ${filterType}`);
      rows[rowOffset + x] = value;
    }
  }
  const rgba = Buffer.allocUnsafe(width * height * 4);
  let src = 0, dst = 0;
  for (let i = 0; i < width * height; i++) {
    if (colorType === 6) {
      rgba[dst++] = rows[src++]; rgba[dst++] = rows[src++]; rgba[dst++] = rows[src++]; rgba[dst++] = rows[src++];
    } else if (colorType === 2) {
      rgba[dst++] = rows[src++]; rgba[dst++] = rows[src++]; rgba[dst++] = rows[src++]; rgba[dst++] = 255;
    } else if (colorType === 4) {
      const gray = rows[src++], alpha = rows[src++];
      rgba[dst++] = gray; rgba[dst++] = gray; rgba[dst++] = gray; rgba[dst++] = alpha;
    } else if (colorType === 0) {
      const gray = rows[src++];
      rgba[dst++] = gray; rgba[dst++] = gray; rgba[dst++] = gray; rgba[dst++] = 255;
    } else {
      const index = rows[src++];
      if (!palette || index * 3 + 2 >= palette.length) throw new Error('indexed PNG missing palette entry');
      rgba[dst++] = palette[index * 3]; rgba[dst++] = palette[index * 3 + 1]; rgba[dst++] = palette[index * 3 + 2];
      rgba[dst++] = transparency && index < transparency.length ? transparency[index] : 255;
    }
  }
  return {width,height,rgba};
}

function resizeRgbaPremultiplied(source, srcWidth, srcHeight, dstWidth, dstHeight) {
  if (srcWidth === dstWidth && srcHeight === dstHeight) return Buffer.from(source);
  const out = Buffer.allocUnsafe(dstWidth * dstHeight * 4);
  const sxScale = srcWidth / dstWidth, syScale = srcHeight / dstHeight;
  function sample(x, y, c) { return source[(y * srcWidth + x) * 4 + c]; }
  for (let y = 0; y < dstHeight; y++) {
    const sy = Math.max(0, Math.min(srcHeight - 1, (y + 0.5) * syScale - 0.5));
    const y0 = Math.floor(sy), y1 = Math.min(srcHeight - 1, y0 + 1), fy = sy - y0;
    for (let x = 0; x < dstWidth; x++) {
      const sx = Math.max(0, Math.min(srcWidth - 1, (x + 0.5) * sxScale - 0.5));
      const x0 = Math.floor(sx), x1 = Math.min(srcWidth - 1, x0 + 1), fx = sx - x0;
      const weights = [(1-fx)*(1-fy), fx*(1-fy), (1-fx)*fy, fx*fy];
      const points = [[x0,y0],[x1,y0],[x0,y1],[x1,y1]];
      let alpha = 0, pr = 0, pg = 0, pb = 0;
      for (let i = 0; i < 4; i++) {
        const [px,py] = points[i], w = weights[i], a = sample(px,py,3) / 255;
        alpha += a * w;
        pr += sample(px,py,0) * a * w;
        pg += sample(px,py,1) * a * w;
        pb += sample(px,py,2) * a * w;
      }
      const o = (y * dstWidth + x) * 4;
      if (alpha > 1e-8) {
        out[o] = Math.max(0, Math.min(255, Math.round(pr / alpha)));
        out[o+1] = Math.max(0, Math.min(255, Math.round(pg / alpha)));
        out[o+2] = Math.max(0, Math.min(255, Math.round(pb / alpha)));
      } else out[o] = out[o+1] = out[o+2] = 0;
      out[o+3] = Math.max(0, Math.min(255, Math.round(alpha * 255)));
    }
  }
  return out;
}

function filterRow(row, prev, bpp, type) {
  const out = Buffer.allocUnsafe(row.length);
  let score = 0;
  for (let i = 0; i < row.length; i++) {
    const left = i >= bpp ? row[i-bpp] : 0;
    const up = prev ? prev[i] : 0;
    const upLeft = prev && i >= bpp ? prev[i-bpp] : 0;
    let predictor = 0;
    if (type === 1) predictor = left;
    else if (type === 2) predictor = up;
    else if (type === 3) predictor = Math.floor((left + up) / 2);
    else if (type === 4) predictor = paeth(left, up, upLeft);
    const value = (row[i] - predictor + 256) & 255;
    out[i] = value;
    score += Math.abs(value < 128 ? value : value - 256);
  }
  return {out,score};
}

function encodeRgbaPng(width, height, rgba) {
  if (rgba.length !== width * height * 4) throw new Error('RGBA buffer length mismatch');
  const scanlines = [];
  let prev = null;
  for (let y = 0; y < height; y++) {
    const row = rgba.subarray(y * width * 4, (y + 1) * width * 4);
    let bestType = 0, best = filterRow(row, prev, 4, 0);
    for (let type = 1; type <= 4; type++) {
      const candidate = filterRow(row, prev, 4, type);
      if (candidate.score < best.score) { bestType = type; best = candidate; }
    }
    scanlines.push(Buffer.from([bestType]), best.out);
    prev = row;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const compressed = zlib.deflateSync(Buffer.concat(scanlines), {level: 9});
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND')]);
}

function optimizePngBuffer(buffer, maxSide = PIECE_RUNTIME_MAX_SIDE) {
  const decoded = decodePng(buffer);
  const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const rgba = resizeRgbaPremultiplied(decoded.rgba, decoded.width, decoded.height, width, height);
  return {buffer: encodeRgbaPng(width, height, rgba), width, height, sourceWidth: decoded.width, sourceHeight: decoded.height};
}

function walkPngs(root, relative, output) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) return;
  const stat = fs.statSync(full);
  if (stat.isFile()) {
    if (relative.toLowerCase().endsWith('.png')) output.push(relative.split(path.sep).join('/'));
    return;
  }
  for (const entry of fs.readdirSync(full)) walkPngs(root, path.join(relative, entry), output);
}

function collectPieceAssetPaths(root) {
  const output = [];
  const heroes = path.join(root, 'assets/heroes');
  if (fs.existsSync(heroes)) {
    for (const entry of fs.readdirSync(heroes, {withFileTypes:true})) {
      if (!entry.isDirectory()) continue;
      const rel = `assets/heroes/${entry.name}/piece_badge.png`;
      if (fs.existsSync(path.join(root, rel))) output.push(rel);
    }
  }
  const raceFiles = [];
  walkPngs(root, 'assets/races', raceFiles);
  output.push(...raceFiles.filter((rel) => rel.includes('/pieces/')));
  const oathkeeper = 'assets/kings/oathkeeper/piece.png';
  if (fs.existsSync(path.join(root, oathkeeper))) output.push(oathkeeper);
  const generated = path.join(root, 'generated_assets');
  if (fs.existsSync(generated)) {
    for (const name of fs.readdirSync(generated)) if (/^unit_(pawn|knight|bishop|rook|queen|king)_(player|enemy)\.png$/.test(name)) output.push(`generated_assets/${name}`);
  }
  return [...new Set(output)].sort();
}

function assertPieceAssetBudget(root, {maxSide = PIECE_RUNTIME_MAX_SIDE, maxBytes = PIECE_RUNTIME_MAX_BYTES} = {}) {
  const failures = [];
  for (const relative of collectPieceAssetPaths(root)) {
    const full = path.join(root, relative), buffer = fs.readFileSync(full), png = parsePng(buffer);
    if (png.width > maxSide || png.height > maxSide || buffer.length > maxBytes) {
      failures.push(`${relative}: ${png.width}x${png.height}, ${buffer.length} bytes (allowed <= ${maxSide}x${maxSide}, <= ${maxBytes} bytes)`);
    }
  }
  if (failures.length) throw new Error(`[piece asset budget] production piece assets exceed budget:\n${failures.join('\n')}`);
  return true;
}

function optimizePieceAssets(root, {write = true, maxSide = PIECE_RUNTIME_MAX_SIDE, maxBytes = PIECE_RUNTIME_MAX_BYTES} = {}) {
  const records = [];
  for (const relative of collectPieceAssetPaths(root)) {
    const full = path.join(root, relative), source = fs.readFileSync(full), before = source.length;
    const metadata = parsePng(source);
    if (metadata.width <= maxSide && metadata.height <= maxSide && before <= maxBytes) {
      records.push({path:relative,before,after:before,width:metadata.width,height:metadata.height,sourceWidth:metadata.width,sourceHeight:metadata.height,skipped:true});
      continue;
    }
    const optimized = optimizePngBuffer(source, maxSide);
    if (optimized.buffer.length > maxBytes) throw new Error(`[piece asset budget] optimizer produced oversized file ${relative}: ${optimized.buffer.length} bytes`);
    if (write) fs.writeFileSync(full, optimized.buffer);
    records.push({path:relative,before,after:optimized.buffer.length,width:optimized.width,height:optimized.height,sourceWidth:optimized.sourceWidth,sourceHeight:optimized.sourceHeight,skipped:false});
  }
  const beforeBytes = records.reduce((sum, item) => sum + item.before, 0);
  const afterBytes = records.reduce((sum, item) => sum + item.after, 0);
  return {count:records.length,beforeBytes,afterBytes,savedBytes:beforeBytes-afterBytes,savedPercent:beforeBytes ? (beforeBytes-afterBytes)*100/beforeBytes : 0,records};
}

function formatBytes(bytes) {
  if (bytes >= 1024*1024) return `${(bytes/(1024*1024)).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes/1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

module.exports = {
  PIECE_RUNTIME_MAX_SIDE,
  PIECE_RUNTIME_MAX_BYTES,
  parsePng,
  decodePng,
  encodeRgbaPng,
  optimizePngBuffer,
  collectPieceAssetPaths,
  optimizePieceAssets,
  assertPieceAssetBudget,
  formatBytes
};
