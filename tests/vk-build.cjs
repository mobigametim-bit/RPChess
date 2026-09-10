const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const WEB_DIST = path.join(ROOT, 'dist');
const VK_DIST = path.join(ROOT, 'dist-vk');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vk-hosting-config.json'), 'utf8'));
const AUDIO_BASE_URL = 'https://mobigametim-bit.github.io/RPChess';
const HOSTING_MEDIA_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.mp4', '.webm', '.mov']);

assert.strictEqual(config.static_path, 'dist-vk');
assert.strictEqual(config.app_id, 54754579);
assert.strictEqual(config.noprompt, true);
assert.deepStrictEqual(config.endpoints, { web: 'index.html', mobile: 'index.html', mvk: 'index.html' });

for (const relative of [
  'index.html',
  'VK_BUILD_INFO.json',
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
]) assert(fs.existsSync(path.join(VK_DIST, relative)), `VK build missing ${relative}`);

const webHtml = fs.readFileSync(path.join(WEB_DIST, 'index.html'), 'utf8');
const vkHtml = fs.readFileSync(path.join(VK_DIST, 'index.html'), 'utf8');
assert(!webHtml.includes('data-rpchess-vk-bootstrap'), 'canonical Web dist must not include VK bootstrap');
for (const token of [
  'data-rpchess-vk-config',
  'data-rpchess-vk-bridge',
  'data-rpchess-vk-bootstrap',
  'vendor/vk-bridge/browser.min.js',
  'js/platform/vk-bootstrap.mjs',
  '"kind":"vk"',
  '"appId":54754579',
  `"audioBaseUrl":"${AUDIO_BASE_URL}"`
]) assert(vkHtml.includes(token), `VK index missing ${token}`);
assert(vkHtml.indexOf('data-rpchess-vk-bootstrap') < vkHtml.indexOf('js/reboot-foundation.mjs'), 'VK platform bootstrap must run before common Foundation bootstrap');
assert(!/\b(?:src|href)\s*=\s*["']\/(?!\/)/i.test(vkHtml), 'VK index must not contain root-absolute src/href URLs');

for (const relative of [
  'music/echoes_iron_throne_01.mp3',
  'music/echoes_iron_throne_02.mp3',
  'music/echoes_iron_throne_03.mp3',
  'music/echoes_iron_throne_04.mp3',
  'SFX/win_fanfare.mp3'
]) assert(fs.existsSync(path.join(WEB_DIST, relative)), `canonical Web dist must retain ${relative}`);

const embeddedHostingMedia = [];
const visit = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(absolute);
    else if (HOSTING_MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) embeddedHostingMedia.push(path.relative(VK_DIST, absolute));
  }
};
visit(VK_DIST);
assert.deepStrictEqual(embeddedHostingMedia, [], `VK Hosting build must externalize audio/video media: ${embeddedHostingMedia.join(', ')}`);

const resolver = fs.readFileSync(path.join(VK_DIST, 'js/platform/audio-assets.mjs'), 'utf8');
const rebootAudio = fs.readFileSync(path.join(VK_DIST, 'js/reboot-audio.mjs'), 'utf8');
const crossScene = fs.readFileSync(path.join(VK_DIST, 'js/cross-scene-visuals.mjs'), 'utf8');
assert(resolver.includes('RPChessPlatformConfig?.audioBaseUrl'), 'audio resolver must read platform audioBaseUrl');
assert(rebootAudio.includes('audioAssetUrl(MUSIC_TRACKS['), 'music playback must use platform audio resolver');
assert(crossScene.includes('new Audio(audioAssetUrl(VICTORY_FANFARE))'), 'victory SFX must use platform audio resolver');

const bridge = fs.readFileSync(path.join(VK_DIST, 'vendor/vk-bridge/browser.min.js'), 'utf8');
assert(bridge.length > 500, 'VK Bridge bundle unexpectedly small');
assert(bridge.includes('vkBridge'), 'VK Bridge bundle must expose vkBridge');

const info = JSON.parse(fs.readFileSync(path.join(VK_DIST, 'VK_BUILD_INFO.json'), 'utf8'));
assert.strictEqual(info.platform, 'vk');
assert.strictEqual(info.app_id, 54754579);
assert.strictEqual(info.bridge_version, '3.0.2');
assert.strictEqual(info.audio_base_url, AUDIO_BASE_URL);
assert.strictEqual(info.hosting_media_externalized, true);
assert.deepStrictEqual(info.hosting_media_removed.sort(), [
  'SFX/win_fanfare.mp3',
  'music/echoes_iron_throne_01.mp3',
  'music/echoes_iron_throne_02.mp3',
  'music/echoes_iron_throne_03.mp3',
  'music/echoes_iron_throne_04.mp3'
].sort());

console.log('VK dist/config/Bridge/Stockfish/audio externalization contract: PASS');
