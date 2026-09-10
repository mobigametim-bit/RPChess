const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WEB_DIST = path.join(ROOT, 'dist');
const VK_DIST = path.join(ROOT, 'dist-vk');
const VK_CONFIG_PATH = path.join(ROOT, 'vk-hosting-config.json');
const MOCK_INIT_FAILURE = process.argv.includes('--mock-fail');
const USE_MOCK = process.argv.includes('--mock') || MOCK_INIT_FAILURE;
const BRIDGE_VERSION = '3.0.2';
const AUDIO_BASE_URL = 'https://mobigametim-bit.github.io/RPChess';
const VK_HOSTING_MEDIA_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.mp4', '.webm', '.mov']);
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

function stripHostingMedia(root) {
  const removed = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!VK_HOSTING_MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      removed.push(path.relative(root, absolute).replace(/\\/g, '/'));
      fs.unlinkSync(absolute);
    }
  };
  visit(root);
  return removed;
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

function applyMockInitFailure(file) {
  fs.appendFileSync(file, `\n;(() => {\n  const bridge = globalThis.vkBridge;\n  if (!bridge || typeof bridge.send !== 'function') return;\n  bridge.__rpchessMockMode = 'init-failure';\n  const originalSend = bridge.send.bind(bridge);\n  bridge.send = (method, params = {}) => {\n    if (method === 'VKWebAppInit') {\n      bridge.calls.push({ method, params });\n      const error = new Error('RPChess deterministic VKWebAppInit failure');\n      error.code = 'RPCHESS_VK_MOCK_INIT_FAILURE';\n      return Promise.reject(error);\n    }\n    return originalSend(method, params);\n  };\n  bridge.sendPromise = bridge.send;\n})();\n`);
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
  const removedHostingMedia = USE_MOCK ? [] : stripHostingMedia(VK_DIST);

  const bridgeTarget = path.join(VK_DIST, 'vendor', 'vk-bridge', 'browser.min.js');
  copyFile(BRIDGE_SOURCE, bridgeTarget);
  if (MOCK_INIT_FAILURE) applyMockInitFailure(bridgeTarget);
  copyFile(BRIDGE_LICENSE, path.join(VK_DIST, 'vendor', 'vk-bridge', 'LICENSE.txt'));

  const indexPath = path.join(VK_DIST, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const marker = '  <script type="module" src="js/reboot-foundation.mjs?v=20260827-roster-1"></script>';
  if (!html.includes(marker)) throw new Error('VK build bootstrap marker not found in dist/index.html');
  if (html.includes('data-rpchess-vk-bootstrap')) throw new Error('VK bootstrap was already injected');

  const bridgeMockMode = MOCK_INIT_FAILURE ? 'init-failure' : (USE_MOCK ? 'success' : null);
  const audioBaseUrl = USE_MOCK ? '' : AUDIO_BASE_URL;
  const config = JSON.stringify({
    kind: 'vk',
    appId,
    bridgeVersion: BRIDGE_VERSION,
    bridgeInitTimeoutMs: 4000,
    audioBaseUrl,
    mockBridge: USE_MOCK,
    bridgeMockMode
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
    'js/platform/audio-assets.mjs',
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
    bridge_mock_mode: bridgeMockMode,
    audio_base_url: audioBaseUrl,
    hosting_media_externalized: !USE_MOCK,
    hosting_media_removed: removedHostingMedia,
    source: 'canonical dist copy + VK platform overlay'
  }, null, 2)}\n`);

  const mode = MOCK_INIT_FAILURE ? ' mock-init-failure' : (USE_MOCK ? ' mock' : '');
  const audioMode = USE_MOCK ? 'local test audio' : `${removedHostingMedia.length} hosting media externalized to ${AUDIO_BASE_URL}`;
  console.log(`Prepared RPChess VK Games build in ${VK_DIST}; app_id=${appId}; VK Bridge ${BRIDGE_VERSION}${mode}; ${audioMode}`);
}

main();
