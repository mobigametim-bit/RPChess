const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist-vk');
const HOST = process.env.RPCHESS_VK_HOST || '127.0.0.1';
const PORT = Number(process.env.RPCHESS_VK_PORT || 4174);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm',
  '.otf': 'font/otf'
};

const index = path.join(DIST, 'index.html');
if (!fs.existsSync(index)) {
  console.error('dist-vk/index.html is missing. Run: npm run build:vk');
  process.exit(1);
}

function safeFile(url) {
  const raw = decodeURIComponent(String(url || '/').split('?')[0]);
  const requested = raw === '/' ? 'index.html' : raw.replace(/^\/+/, '');
  const resolved = path.resolve(DIST, requested);
  if (!resolved.startsWith(`${DIST}${path.sep}`) && resolved !== DIST) return null;
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  return index;
}

const server = http.createServer((req, res) => {
  const file = safeFile(req.url);
  if (!file) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  fs.readFile(file, (error, buffer) => {
    if (error) {
      res.writeHead(500);
      res.end(String(error));
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(buffer);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`RPChess VK build: http://${HOST}:${PORT}/`);
  console.log('Press Ctrl+C to stop.');
});

function close() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
