const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const { collectBackgroundAssetPaths } = require('./background-asset-runtime.cjs');
const { collectPortraitAssetPaths } = require('./portrait-asset-runtime.cjs');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'dist');
const target = path.join(root, 'dist-yandex');
const archive = path.join(root, 'heroes-checkmate-yandex.zip');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes:true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
function size(directory) { return files(directory).reduce((total, file) => total + fs.statSync(file).size, 0); }

async function optimize(file, background) {
  const input = fs.readFileSync(file);
  const output = await sharp(input).resize(background
    ? { width:1280, height:720, fit:'cover', withoutEnlargement:true }
    : { width:512, height:512, fit:'inside', withoutEnlargement:true })
    .png({ palette:true, colours:256, dither:0.7, compressionLevel:9 }).toBuffer();
  const before = await sharp(input).stats();
  if (before.isOpaque === false && !(await sharp(output).metadata()).hasAlpha) throw new Error(`Lost transparency: ${file}`);
  fs.writeFileSync(file, output);
}

async function main() {
  if (!fs.existsSync(path.join(source, 'vendor/stockfish/stockfish-18-lite-single.wasm'))) {
    throw new Error('Run the canonical build before the Yandex packaging step');
  }
  fs.rmSync(target, { recursive:true, force:true });
  fs.cpSync(source, target, { recursive:true });
  const beforeBytes = size(target);
  // CREDITS.md explicitly excludes this CC BY-NC track from commercial releases.
  fs.rmSync(path.join(target, 'music/epic_music3.mp3'), { force:true });
  const tracks = files(path.join(target, 'music')).map(file => path.relative(target, file).split(path.sep).join('/')).sort();
  fs.writeFileSync(path.join(target, 'js/music-catalog.mjs'), `const MUSIC_TRACKS = Object.freeze(${JSON.stringify(tracks)});\nexport { MUSIC_TRACKS };\n`);
  for (const file of collectBackgroundAssetPaths(target)) await optimize(path.join(target, file), true);
  for (const file of collectPortraitAssetPaths(target)) await optimize(path.join(target, file), false);
  for (const file of ['CREDITS.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE']) {
    if (fs.existsSync(path.join(root, file))) fs.copyFileSync(path.join(root, file), path.join(target, file));
  }
  const index = path.join(target, 'index.html');
  let html = fs.readFileSync(index, 'utf8');
  html = html.replace(/<title>[^<]*<\/title>/, '<title>Герои Шаха и Мата</title>');
  html = html.replace('<head>', `<head>\n<script>window.RPChessBuild=Object.freeze({platform:'yandex'});document.documentElement.setAttribute('data-yandex-loading','');</script>
<style>
html[data-yandex-loading] #app{visibility:hidden}
.yandex-loading{position:fixed;inset:0;z-index:100000;display:grid;place-content:center;text-align:center;background:#111821;color:#f4dfaa;font:20px sans-serif}
.yandex-loading button{padding:12px 24px;font:inherit;cursor:pointer}.yandex-loading [hidden]{display:none}
html[data-host-paused] #app{pointer-events:none}html[data-host-paused] *{animation-play-state:paused!important}
body{-webkit-user-select:none;user-select:none}input,textarea,[contenteditable="true"]{-webkit-user-select:text;user-select:text}
</style>`);
  html = html.replace('<body>', '<body>\n<div class="yandex-loading" role="status"><p>Загрузка / Loading…</p><button type="button" hidden>Повторить / Retry</button></div>');
  fs.writeFileSync(index, html);
  const sourceCommit = process.env.RPCHESS_SOURCE_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd:root, encoding:'utf8' }).trim();
  fs.writeFileSync(path.join(target, 'BUILD_INFO.json'), JSON.stringify({
    title:'Герои Шаха и Мата', title_en:'Heroes of Check & Mate',
    version:require('../package.json').version, platform:'yandex', source_commit:sourceCommit,
    build_date:new Date().toISOString(), stockfish:'18.0.0 lite single-threaded / GPLv3',
    languages:['ru','en'], orientation:'landscape',
    acceptance:'Local checks required; actual Yandex draft acceptance pending'
  }, null, 2) + '\n');
  const outputFiles = files(target);
  for (const file of outputFiles) {
    const relative = path.relative(target, file);
    if (/[\s\u0400-\u04ff]/u.test(relative)) throw new Error(`Invalid archive path: ${relative}`);
  }
  const unpackedBytes = size(target);
  if (unpackedBytes >= 100000000) throw new Error(`Yandex unpacked size exceeds 100 MB: ${unpackedBytes}`);
  if (!fs.existsSync(index)) throw new Error('index.html must be in the ZIP root');
  fs.rmSync(archive, { force:true });
  execFileSync('zip', ['-q','-r',archive,'.'], { cwd:target });
  console.log(JSON.stringify({ platform:'yandex', beforeBytes, unpackedBytes,
    zipBytes:fs.statSync(archive).size, files:outputFiles.length, sourceCommit, archive }, null, 2));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
