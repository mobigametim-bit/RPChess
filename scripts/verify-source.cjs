const fs = require('fs');
const path = require('path');

function fail(message) { throw new Error(`[reboot source verification] ${message}`); }
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
    'index.html', 'BUILD_INFO.json',
    'css/reboot-foundation.css', 'css/classic-chess.css',
    'js/reboot-foundation.mjs', 'js/reboot-audio.mjs',
    'js/classic-chess-engine.mjs', 'js/classic-chess-app.mjs',
    'fonts/BrahmsGotischCyr.otf',
    'generated_assets/title_wordmark.png', 'generated_assets/splash_poster.jpg', 'generated_assets/scene_battle.jpg',
    'music/echoes_iron_throne_01.mp3', 'music/echoes_iron_throne_02.mp3',
    'music/echoes_iron_throne_03.mp3', 'music/echoes_iron_throne_04.mp3'
  ];
  for (const side of ['player', 'enemy']) {
    for (const piece of ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']) required.push(`generated_assets/unit_${piece}_${side}.png`);
  }

  for (const relative of required) {
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) fail(`missing required file: ${relative}`);
    if (!fs.statSync(full).isFile()) fail(`required path is not a file: ${relative}`);
  }

  const info = JSON.parse(fs.readFileSync(path.join(root, 'BUILD_INFO.json'), 'utf8'));
  if (!String(info.version || '').startsWith('2.1.0-classic-chess')) fail(`unexpected Classic Chess version: ${info.version || 'missing'}`);

  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const requiredRef of ['css/reboot-foundation.css', 'css/classic-chess.css', 'js/reboot-foundation.mjs', 'js/classic-chess-app.mjs']) {
    if (!index.includes(requiredRef)) fail(`index.html is missing active runtime reference: ${requiredRef}`);
  }
  for (const forbidden of ['iron-marches-runtime.bundle.js', 'vertical-slice-app.mjs', 'ui-approved-campaign.mjs', 'b10-b13-production-ui.mjs', 'explicit-run-setup.mjs', 'commander-selection-final.mjs']) {
    if (index.includes(forbidden)) fail(`index.html still references legacy runtime: ${forbidden}`);
  }

  const localRefs = [...index.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)].map((match) => match[1]);
  for (const ref of localRefs) {
    if (/^(?:https?:|data:|blob:)/i.test(ref)) continue;
    if (!fs.existsSync(path.join(root, ref))) fail(`index.html references missing local file: ${ref}`);
  }

  const foundationCss = fs.readFileSync(path.join(root, 'css/reboot-foundation.css'), 'utf8');
  if (!/html\s*\{[\s\S]*overflow-y:\s*auto/i.test(foundationCss) || !/body\s*\{[\s\S]*overflow-y:\s*auto/i.test(foundationCss)) fail('global vertical scroll contract is missing');

  const engine = fs.readFileSync(path.join(root, 'js/classic-chess-engine.mjs'), 'utf8');
  for (const contract of ['castling', 'enPassant', 'draw_50_move', 'draw_threefold', 'draw_insufficient', 'promotion_required', 'checkmate', 'stalemate']) {
    if (!engine.includes(contract)) fail(`Classic Chess engine contract missing: ${contract}`);
  }
  const app = fs.readFileSync(path.join(root, 'js/classic-chess-app.mjs'), 'utf8');
  if (!app.includes("from './classic-chess-engine.mjs'")) fail('Classic Chess UI does not import the standalone engine');
  if (!app.includes('unit_${PIECE_ASSETS[piece.type]}_')) fail('Classic Chess UI does not use production piece assets');

  const runtime = fs.readFileSync(path.join(root, 'js/reboot-foundation.mjs'), 'utf8');
  if (!runtime.includes("from './reboot-audio.mjs'")) fail('Reboot runtime does not load audio');

  const textExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.md']);
  const forbiddenNetworkDependencies = ['drive.google.com/uc?export=download', 'drive.google.com/file/d/', 'supabase.co/functions/', 'http://127.0.0.1', 'http://localhost'];
  for (const file of walk(root)) {
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const forbidden of forbiddenNetworkDependencies) if (text.includes(forbidden)) fail(`release source contains network dependency '${forbidden}' in ${path.relative(root, file)}`);
  }

  console.log(`[reboot source verification] ${path.relative(process.cwd(), root) || '.'}: ${walk(root).length} files, build ${info.version}`);
  return true;
};
