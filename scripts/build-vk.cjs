const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WEB_DIST = path.join(ROOT, 'dist');
const VK_DIST = path.join(ROOT, 'dist-vk');
const VK_CONFIG_PATH = path.join(ROOT, 'vk-hosting-config.json');
const USE_MOCK = process.argv.includes('--mock');
const BRIDGE_VERSION = '3.0.2';
const BRIDGE_SOURCE = path.join(
  ROOT,
  'platforms',
  'vk',
  'vendor',
  USE_MOCK ? 'vk-bridge-mock.js' : `vk-bridge-${BRIDGE_VERSION}.browser.min.js`
);
const BRIDGE_LICENSE = path.join(ROOT, 'platforms', 'vk', 'vendor', 'VK_BRIDGE_LICENSE.txt');

function requireFile(file, message) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(message || `Missing required file: ${file}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function copyFile(source, target) {
  requireFile(source);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function assertRelativeRuntimePaths(root) {
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!/\.(?:html|css)$/i.test(entry.name)) continue;
      const source = fs.readFileSync(absolute, 'utf8');
      if (/\b(?:src|href)\s*=\s*["']\/(?!\/)/i.test(source)) {
        throw new Error(`VK build contains a root-absolute HTML URL: ${path.relative(root, absolute)}`);
      }
      if (/url\(\s*["']?\/(?!\/)/i.test(source)) {
        throw new Error(`VK build contains a root-absolute CSS URL: ${path.relative(root, absolute)}`);
      }
    }
  };
  visit(root);
}

function main() {
  requireFile(path.join(WEB_DIST, 'index.html'), 'dist/index.html is missing. Run the canonical Web build first.');
  requireFile(VK_CONFIG_PATH, 'vk-hosting-config.json is missing.');
  requireFile(BRIDGE_SOURCE, 'Pinned VK Bridge browser bundle/mock is missing.');
  requireFile(BRIDGE_LICENSE, 'VK Bridge license notice is missing.');

  const hosting = readJson(VK_CONFIG_PATH);
  if (hosting.static_path !== 'dist-vk') throw new Error('vk-hosting-config.json static_path must be dist-vk');
  const appId = Number(hosting.app_id);
  if (!Number.isInteger(appId) || appId <= 0) throw new Error('vk-hosting-config.json app_id must be a positive integer');

  fs.rmSync(VK_DIST, { recursive: true, force: true });
  fs.cpSync(WEB_DIST, VK_DIST, { recursive: true, force: true });

  copyFile(BRIDGE_SOURCE, path.join(VK_DIST, 'vendor', 'vk-bridge', 'browser.min.js'));
  copyFile(BRIDGE_LICENSE, path.join(VK_DIST, 'vendor', 'vk-bridge', 'LICENSE.txt'));

  const indexPath = path.join(VK_DIST, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const marker = '  <script type="module" src="js/reboot-foundation.mjs?v=20260827-roster-1"></script>';
  if (!html.includes(marker)) throw new Error('VK build bootstrap marker not found in dist/index.html');
  if (html.includes('data-rpchess-vk-bootstrap')) throw new Error('VK bootstrap was already injected');

  const config = JSON.stringify({
    kind: 'vk',
    appId,
    bridgeVersion: BRIDGE_VERSION,
    bridgeInitTimeoutMs: 4000,
    mockBridge: USE_MOCK
  });
  const bootstrap = [
    '  <script data-rpchess-vk-config>',
    `    globalThis.RPChessPlatformConfig = Object.freeze(${config});`,
    '  </script>',
    '  <script src="vendor/vk-bridge/browser.min.js" data-rpchess-vk-bridge></script>',
    '  <script type="module" src="js/platform/vk-bootstrap.mjs" data-rpchess-vk-bootstrap></script>'
  ].join('\n');
  html = html.replace(marker, `${bootstrap}\n${marker}`);
  fs.writeFileSync(indexPath, html);

  const required = [
    'js/platform/platform.mjs',
    'js/platform/web-platform.mjs',
    'js/platform/vk-platform.mjs',
    'js/platform/vk-bootstrap.mjs',
    'vendor/vk-bridge/browser.min.js',
    'vendor/vk-bridge/LICENSE.txt',
    'vendor/stockfish/stockfish-18-lite-single.js',
    'vendor/stockfish/stockfish-18-lite-single.wasm',
    'vendor/stockfish/COPYING.txt',
    'vendor/stockfish/SOURCE.txt'
  ];
  for (const relative of required) requireFile(path.join(VK_DIST, relative), `VK build missing ${relative}`);

  assertRelativeRuntimePaths(VK_DIST);

  fs.writeFileSync(path.join(VK_DIST, 'VK_BUILD_INFO.json'), `${JSON.stringify({
    platform: 'vk',
    app_id: appId,
    bridge_version: BRIDGE_VERSION,
    bridge_mock: USE_MOCK,
    source: 'canonical dist copy + VK platform overlay'
  }, null, 2)}\n`);

  console.log(`Prepared RPChess VK Games build in ${VK_DIST}; app_id=${appId}; VK Bridge ${BRIDGE_VERSION}${USE_MOCK ? ' mock' : ''}`);
}

main();
