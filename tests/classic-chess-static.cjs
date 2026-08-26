const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const game = path.join(root, 'game');
const html = fs.readFileSync(path.join(game, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(game, 'css/classic-chess.css'), 'utf8');
const app = fs.readFileSync(path.join(game, 'js/classic-chess-app.mjs'), 'utf8');
const engine = fs.readFileSync(path.join(game, 'js/classic-chess-engine.mjs'), 'utf8');

for (const token of [
  'data-classic-screen', 'data-chess-board', 'data-classic-new', 'data-classic-menu',
  'data-move-history', 'data-game-result', 'data-promotion-modal', 'data-promotion-options'
]) assert(html.includes(token), `Classic Chess UI token missing: ${token}`);

assert(html.includes('css/classic-chess.css'), 'Classic Chess stylesheet is not loaded');
assert(html.includes('js/classic-chess-app.mjs'), 'Classic Chess app is not loaded');
assert(app.includes("from './classic-chess-engine.mjs'"), 'Classic app does not use standalone engine');
assert(app.includes("globalThis.RPChessClassicChess"), 'Classic app acceptance API is missing');
assert(app.includes('generated_assets/unit_${PIECE_ASSETS[piece.type]}_'), 'production piece assets are not used');
assert(css.includes('grid-template-columns: repeat(8, 1fr)'), 'board is not an 8-column grid');
assert(css.includes('grid-template-rows: repeat(8, 1fr)'), 'board is not an 8-row grid');
assert(html.includes('data-modal-static'), 'promotion modal must be mandatory');

for (const rule of ['promotion_required', 'draw_50_move', 'draw_threefold', 'draw_insufficient', 'checkmate', 'stalemate', 'kingTransitSafe']) {
  assert(engine.includes(rule), `engine rule missing: ${rule}`);
}

for (const side of ['player', 'enemy']) {
  for (const piece of ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']) {
    assert(fs.existsSync(path.join(game, 'generated_assets', `unit_${piece}_${side}.png`)), `piece asset missing: ${piece}_${side}`);
  }
}

console.log('Classic Chess UI static contract: PASS');
