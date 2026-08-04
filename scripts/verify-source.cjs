const fs = require('fs');
const path = require('path');

function fail(message) {
  throw new Error(`[source verification] ${message}`);
}

function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else result.push(full);
  }
  return result;
}

module.exports = function verifySource(root) {
  const required = [
    'index.html',
    'style.css',
    'BUILD_INFO.json',
    'js/data.js',
    'js/core.js',
    'js/ui.js',
    'js/main.js',
    'SFX/win_fanfare.mp3'
  ];

  for (const relative of required) {
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) fail(`missing required file: ${relative}`);
    if (!fs.statSync(full).isFile()) fail(`required path is not a file: ${relative}`);
  }

  const fanfare = path.join(root, 'SFX', 'win_fanfare.mp3');
  if (fs.statSync(fanfare).size < 10000) fail('win_fanfare.mp3 is unexpectedly small');

  const musicDir = path.join(root, 'music');
  if (!fs.existsSync(musicDir)) fail('music directory is missing');
  const tracks = fs.readdirSync(musicDir).filter((name) => /\.(mp3|ogg|wav)$/i.test(name));
  if (tracks.length < 4) fail(`expected at least four music tracks, found ${tracks.length}`);

  const info = JSON.parse(fs.readFileSync(path.join(root, 'BUILD_INFO.json'), 'utf8'));
  if (!info.version) fail('BUILD_INFO.json has no version');

  const textExtensions = new Set(['.html', '.css', '.js', '.json', '.md']);
  const forbiddenNetworkDependencies = [
    'drive.google.com/uc?export=download',
    'drive.google.com/file/d/',
    'supabase.co/functions/',
    'http://127.0.0.1',
    'http://localhost'
  ];

  for (const file of walk(root)) {
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const forbidden of forbiddenNetworkDependencies) {
      if (text.includes(forbidden)) {
        fail(`release source contains network dependency '${forbidden}' in ${path.relative(root, file)}`);
      }
    }
  }

  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const localRefs = [...index.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)].map((match) => match[1]);
  for (const ref of localRefs) {
    if (/^(?:https?:|data:|blob:)/i.test(ref)) continue;
    if (!fs.existsSync(path.join(root, ref))) fail(`index.html references missing local file: ${ref}`);
  }

  console.log(`[source verification] ${path.relative(process.cwd(), root) || '.'}: ${walk(root).length} files, ${tracks.length} music tracks, build ${info.version}`);
  return true;
};
