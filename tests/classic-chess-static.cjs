const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const game = path.join(root, 'game');
const html = fs.readFileSync(path.join(game, 'index.html'), 'utf8');
const foundationCss = fs.readFileSync(path.join(game, 'css/reboot-foundation.css'), 'utf8');
const css = fs.readFileSync(path.join(game, 'css/classic-chess.css'), 'utf8');
const polishCss = fs.readFileSync(path.join(game, 'css/chess-ai-polish.css'), 'utf8');
const app = fs.readFileSync(path.join(game, 'js/classic-chess-app.mjs'), 'utf8');
const engine = fs.readFileSync(path.join(game, 'js/classic-chess-engine.mjs'), 'utf8');
const ai = fs.readFileSync(path.join(game, 'js/chess-ai-adapter.mjs'), 'utf8');

for (const token of [
  'data-classic-screen', 'data-chess-board', 'data-classic-new', 'data-classic-menu',
  'data-move-history', 'data-game-result', 'data-promotion-modal', 'data-promotion-options',
  'data-game-setup-modal', 'data-game-mode-select', 'data-ai-elo', 'data-player-color',
  'data-start-game', 'data-ai-thinking', 'data-game-mode',
  'data-captured-by-white', 'data-captured-by-black', 'data-material-white', 'data-material-black',
  'classic-party-panel', 'classic-panel--moves'
]) assert(html.includes(token), `Classic Chess / AI UI token missing: ${token}`);

assert(html.includes('css/classic-chess.css'), 'Classic Chess stylesheet is not loaded');
assert(html.includes('css/chess-ai-polish.css?v=20260827-ai-3'), 'final Chess AI polish cache-bust is not loaded');
assert(html.includes('js/classic-chess-app.mjs'), 'Classic Chess app is not loaded');
assert(app.includes("from './classic-chess-engine.mjs'"), 'Classic app does not use standalone engine');
assert(app.includes("from './chess-ai-adapter.mjs'"), 'Classic app does not use ChessAIAdapter boundary');
assert(app.includes('globalThis.RPChessClassicChess'), 'Classic app acceptance API is missing');
assert(app.includes('globalThis.RPChessChessAI'), 'Chess AI acceptance API is missing');
assert(app.includes('generated_assets/unit_${PIECE_ASSETS[piece.type]}_'), 'production piece assets are not used');
assert(app.includes('maybeScheduleAI'), 'automatic AI response flow is missing');
assert(app.includes("engine.turn() !== gameConfig.playerColor"), 'player input is not guarded during AI turns');
assert(css.includes('grid-template-columns: repeat(8, 1fr)'), 'board is not an 8-column grid');
assert(css.includes('grid-template-rows: repeat(8, 1fr)'), 'board is not an 8-row grid');
assert(css.includes('.classic-board.is-locked'), 'AI thinking/input lock styling is missing');
assert(html.includes('data-modal-static'), 'promotion modal must be mandatory');
assert(html.includes('vendor/stockfish/COPYING.txt'), 'Stockfish GPL license link is missing');
assert(html.includes('vendor/stockfish/SOURCE.txt'), 'Stockfish source information link is missing');
assert(foundationCss.includes('[data-reboot-foundation][hidden]'), 'main menu scene has no explicit hidden-state override');
assert(foundationCss.includes('[data-classic-screen][hidden]'), 'Classic Chess scene has no explicit hidden-state override');
assert(/\[data-reboot-foundation\]\[hidden\][\s\S]*display:\s*none\s*!important/i.test(foundationCss), 'scene visibility contract must force hidden roots out of layout');

for (const rule of ['promotion_required', 'draw_50_move', 'draw_threefold', 'draw_insufficient', 'checkmate', 'stalemate', 'kingTransitSafe']) {
  assert(engine.includes(rule), `engine rule missing: ${rule}`);
}
for (const contract of ['class ChessAIAdapter', 'UCI_LimitStrength', 'UCI_Elo', 'MultiPV', 'ELO_LEVELS', 'stockfish-18-lite-single.js']) {
  assert(ai.includes(contract), `Chess AI adapter contract missing: ${contract}`);
}

for (const contract of ['sanNotation', 'PIECE_GLYPHS', 'PIECE_VALUES', 'renderMaterial', 'animateCommittedMove', 'classic-piece-marker']) {
  assert(app.includes(contract), `Chess AI production polish runtime missing: ${contract}`);
}
for (const contract of [
  'ui_button_primary.png', 'ui_panel_frame.png', '.classic-piece-marker', '.classic-san-figurine',
  '.classic-captured-piece', '.classic-piece-flyer', '.classic-thinking { display: none !important; }',
  '.classic-statusbar { display: none !important; }', '.classic-party-panel', '.classic-panel--moves',
  '.classic-result__actions { display: none !important; }', 'border-radius: 0', 'background: transparent'
]) assert(polishCss.includes(contract), `Chess AI final polish CSS missing: ${contract}`);

assert(polishCss.includes('grid-template-columns: minmax(240px, 300px) minmax(0, 860px) minmax(270px, 330px)'), 'desktop layout must be Party / board / Moves');
assert(polishCss.includes('.classic-piece-marker--w') && polishCss.includes('color: #fff'), 'white technical marker must be plain white');
assert(polishCss.includes('.classic-piece-marker--b') && polishCss.includes('color: #050505'), 'black technical marker must be plain black');
assert(!polishCss.includes("ui_button_secondary.png"), 'polish layer must not introduce light/secondary button frames');
assert(html.includes('classic-commander-panel'), 'approved commander-selection dark surface is not applied to modals');
assert(!html.includes('data-result-rematch'), 'post-game rematch button must not be duplicated inside the Party frame');
assert(!html.includes('data-result-menu'), 'post-game main-menu button must not be duplicated inside the Party frame');

for (const side of ['player', 'enemy']) {
  for (const piece of ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']) {
    assert(fs.existsSync(path.join(game, 'generated_assets', `unit_${piece}_${side}.png`)), `piece asset missing: ${piece}_${side}`);
  }
}

console.log('Classic Chess + AI final production polish static contract: PASS');
