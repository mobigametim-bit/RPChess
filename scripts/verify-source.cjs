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
    'css/reboot-foundation.css', 'css/classic-chess.css', 'css/chess-ai-polish.css',
    'js/reboot-foundation.mjs', 'js/reboot-audio.mjs',
    'js/classic-chess-engine.mjs', 'js/classic-chess-app.mjs', 'js/chess-ai-adapter.mjs',
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
  if (!String(info.version || '').startsWith('2.2.0-chess-ai')) fail(`unexpected Chess AI version: ${info.version || 'missing'}`);

  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const requiredRef of ['css/reboot-foundation.css', 'css/classic-chess.css', 'css/chess-ai-polish.css', 'js/reboot-foundation.mjs', 'js/classic-chess-app.mjs', 'data-game-setup-modal', 'data-ai-elo', 'data-captured-by-white', 'data-captured-by-black']) {
    if (!index.includes(requiredRef)) fail(`index.html is missing active AI runtime/UI reference: ${requiredRef}`);
  }
  for (const forbidden of ['iron-marches-runtime.bundle.js', 'vertical-slice-app.mjs', 'ui-approved-campaign.mjs', 'b10-b13-production-ui.mjs', 'explicit-run-setup.mjs', 'commander-selection-final.mjs']) {
    if (index.includes(forbidden)) fail(`index.html still references legacy runtime: ${forbidden}`);
  }

  const localRefs = [...index.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)].map((match) => match[1]);
  for (const ref of localRefs) {
    if (/^(?:https?:|data:|blob:)/i.test(ref)) continue;
    const target = path.join(root, ref);
    if (!fs.existsSync(target)) {
      const isBuildVendorRef = ref.startsWith('vendor/stockfish/') && !fs.existsSync(path.join(root, 'vendor'));
      if (!isBuildVendorRef) fail(`index.html references missing local file: ${ref}`);
    }
  }

  const foundationCss = fs.readFileSync(path.join(root, 'css/reboot-foundation.css'), 'utf8');
  if (!/html\s*\{[\s\S]*overflow-y:\s*auto/i.test(foundationCss) || !/body\s*\{[\s\S]*overflow-y:\s*auto/i.test(foundationCss)) fail('global vertical scroll contract is missing');

  const engine = fs.readFileSync(path.join(root, 'js/classic-chess-engine.mjs'), 'utf8');
  for (const contract of ['castling', 'enPassant', 'draw_50_move', 'draw_threefold', 'draw_insufficient', 'promotion_required', 'checkmate', 'stalemate']) {
    if (!engine.includes(contract)) fail(`Classic Chess engine contract missing: ${contract}`);
  }
  const app = fs.readFileSync(path.join(root, 'js/classic-chess-app.mjs'), 'utf8');
  if (!app.includes("from './classic-chess-engine.mjs'")) fail('Classic Chess UI does not import the standalone engine');
  if (!app.includes("from './chess-ai-adapter.mjs'")) fail('Classic Chess UI does not import the AI adapter boundary');
  if (!app.includes('unit_${PIECE_ASSETS[piece.type]}_')) fail('Classic Chess UI does not use production piece assets');
  for (const aiContract of ['maybeScheduleAI', 'aiThinking', 'data-game-setup-modal', 'Stockfish 18 lite']) {
    if (!app.includes(aiContract) && !index.includes(aiContract)) fail(`Chess AI UI contract missing: ${aiContract}`);
  }
  for (const polishContract of ['sanNotation', 'classic-piece-marker', 'renderMaterial', 'animateCommittedMove', 'PIECE_GLYPHS']) {
    if (!app.includes(polishContract)) fail(`Chess AI polish runtime contract missing: ${polishContract}`);
  }

  const polishCss = fs.readFileSync(path.join(root, 'css/chess-ai-polish.css'), 'utf8');
  for (const polishContract of ['ui_button_primary.png', 'ui_panel_frame.png', '.classic-piece-marker', '.classic-san-figurine', '.classic-captured-piece', '.classic-piece-flyer', '.classic-thinking']) {
    if (!polishCss.includes(polishContract)) fail(`Chess AI polish CSS contract missing: ${polishContract}`);
  }

  const adapter = fs.readFileSync(path.join(root, 'js/chess-ai-adapter.mjs'), 'utf8');
  for (const aiContract of ['class ChessAIAdapter', 'UCI_LimitStrength', 'UCI_Elo', 'MultiPV', 'chooseMove', 'ELO_LEVELS']) {
    if (!adapter.includes(aiContract)) fail(`Chess AI adapter contract missing: ${aiContract}`);
  }

  const runtime = fs.readFileSync(path.join(root, 'js/reboot-foundation.mjs'), 'utf8');
  if (!runtime.includes("from './reboot-audio.mjs'")) fail('Reboot runtime does not load audio');

  if (fs.existsSync(path.join(root, 'vendor', 'stockfish'))) {
    for (const relative of [
      'vendor/stockfish/stockfish-18-lite-single.js',
      'vendor/stockfish/stockfish-18-lite-single.wasm',
      'vendor/stockfish/COPYING.txt',
      'vendor/stockfish/SOURCE.txt'
    ]) if (!fs.existsSync(path.join(root, relative))) fail(`Stockfish distribution file missing: ${relative}`);
  }

  const textExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.md', '.txt']);
  const forbiddenNetworkDependencies = ['drive.google.com/uc?export=download', 'drive.google.com/file/d/', 'supabase.co/functions/', 'http://127.0.0.1', 'http://localhost'];
  for (const file of walk(root)) {
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const forbidden of forbiddenNetworkDependencies) if (text.includes(forbidden)) fail(`release source contains network dependency '${forbidden}' in ${path.relative(root, file)}`);
  }

  console.log(`[reboot source verification] ${path.relative(process.cwd(), root) || '.'}: ${walk(root).length} files, build ${info.version}`);
  return true;
};