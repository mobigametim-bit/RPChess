const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const game = path.join(root, 'game');
const html = fs.readFileSync(path.join(game, 'index.html'), 'utf8');
const foundationCss = fs.readFileSync(path.join(game, 'css/reboot-foundation.css'), 'utf8');
const css = fs.readFileSync(path.join(game, 'css/classic-chess.css'), 'utf8');
const polishCss = fs.readFileSync(path.join(game, 'css/chess-ai-polish.css'), 'utf8');
const redesignSource = fs.readFileSync(path.join(game, 'js/ui-redesign-final.mjs'), 'utf8');
const rosterCss = fs.readFileSync(path.join(game, 'css/roster.css'), 'utf8');
const uxCss = fs.readFileSync(path.join(game, 'css/ux-consistency.css'), 'utf8');
const uxApp = fs.readFileSync(path.join(game, 'js/ux-consistency.mjs'), 'utf8');
const app = fs.readFileSync(path.join(game, 'js/classic-chess-app.mjs'), 'utf8');
const classicUi = fs.readFileSync(path.join(game, 'localization/classic-ui.mjs'), 'utf8');
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

assert(html.includes('css/classic-chess.css?v=20260827-frameless-1'), 'frameless Classic Chess stylesheet is not pinned');
assert(html.includes('css/chess-ai-polish.css?v=20260827-frameless-1'), 'frameless Chess AI polish cache-bust is not pinned');
assert(html.includes('js/classic-chess-app.mjs'), 'Classic Chess app is not loaded');
assert(app.includes("from './classic-chess-engine.mjs'"), 'Classic app does not use standalone engine');
assert(app.includes("from './chess-ai-adapter.mjs'"), 'Classic app does not use ChessAIAdapter boundary');
assert(app.includes("from './i18n.mjs'") && app.includes("from '../localization/classic-ui.mjs'"), 'Classic owner must import language state plus its semantic registry');
assert(app.includes('subscribe(() => { renderStaticCopy(); render(); });'), 'Classic owner must rerender dynamic presentation on language changes');
assert(classicUi.includes('CLASSIC_UI_MESSAGES') && classicUi.includes("'classic.boardCell'") && classicUi.includes("'classic.result.drawThreefoldText'"), 'Classic semantic RU/EN registry must cover board and dynamic result presentation');
for (const forbidden of ['Локальная партия · два игрока','Ходов пока нет','Компьютер думает…','Мат — победа ${sideName']) assert(!app.includes(forbidden), `Classic owner still hardcodes translated presentation: ${forbidden}`);
assert(app.includes('globalThis.RPChessClassicChess'), 'Classic app acceptance API is missing');
assert(app.includes('globalThis.RPChessChessAI'), 'Chess AI acceptance API is missing');
assert(app.includes('generated_assets/unit_${PIECE_ASSETS[piece.type]}_'), 'production piece assets are not used');
assert(app.includes('maybeScheduleAI'), 'automatic AI response flow is missing');
assert(app.includes("engine.turn() !== gameConfig.playerColor"), 'player input is not guarded during AI turns');
assert(app.includes("movingSrc: sourceImage.getAttribute('src')"), 'move animation must snapshot the actual rendered source art before board rebuild');
assert(app.includes('flyer.src = geometry.movingSrc || pieceAsset(geometry.moving)'), 'move flyer must preserve custom race/hero art instead of reverting to generic Classic art');
assert(app.includes("capturedSrc: targetImage?.getAttribute('src')"), 'capture animation must snapshot the actual rendered captured-piece art');
assert(app.includes('capturedGhost.src = geometry.capturedSrc || pieceAsset(geometry.capturedPiece)'), 'capture ghost must preserve custom race/hero art');
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
  '.classic-piece-marker', '.classic-san-figurine',
  '.classic-captured-piece', '.classic-piece-flyer', '.classic-thinking { display: none !important; }',
  '.classic-statusbar { display: none !important; }', '.classic-party-panel', '.classic-panel--moves',
  '.classic-result__actions { display: none !important; }', 'border-radius: 0', 'background: transparent',
  'border: 1px solid var(--ui-panel-border)', 'background: var(--ui-panel-bg)'
]) assert(polishCss.includes(contract), `Chess AI frameless polish CSS missing: ${contract}`);

assert(polishCss.includes('grid-template-columns: minmax(240px, 300px) minmax(0, 860px) minmax(270px, 330px)'), 'desktop layout must be Party / board / Moves');
assert(polishCss.includes('.classic-piece-marker--w') && polishCss.includes('color: #fff'), 'white technical marker must be plain white');
assert(polishCss.includes('.classic-piece-marker--b') && polishCss.includes('color: #050505'), 'black technical marker must be plain black');
assert(!polishCss.includes("ui_button_primary.png"), 'Chess AI polish must not reintroduce the legacy primary image-button override');
assert(!polishCss.includes("ui_button_secondary.png"), 'polish layer must not introduce light/secondary button frames');
assert(!html.includes('data-result-rematch'), 'post-game rematch button must not be duplicated inside the Party panel');
assert(!html.includes('data-result-menu'), 'post-game main-menu button must not be duplicated inside the Party panel');

// Shared board shell keeps all 64 playable children untouched and draws coordinates in sibling rails.
assert(uxApp.includes('board-coordinate-frame') && uxApp.includes('board-coordinate-ranks') && uxApp.includes('board-coordinate-files'), 'shared external board-coordinate renderer missing');
assert(uxApp.includes(".classic-board[data-chess-board], .puzzle-board[data-puzzle-board]"), 'external coordinate renderer must cover Classic combat and Puzzle boards');
assert(uxCss.includes('.classic-coordinate,.puzzle-coordinate{display:none!important}'), 'coordinates must no longer be rendered visually inside playable squares');
assert(uxCss.includes('grid-template-rows:repeat(8,minmax(0,1fr))!important'), 'Puzzle/Classic shared board must force eight equal square rows');
assert(uxCss.includes('.puzzles-active .puzzle-square--light') && uxCss.includes('.puzzles-active .puzzle-square--dark'), 'Puzzle board must inherit the combat-board palette');

for (const source of [foundationCss, css, polishCss, rosterCss, uxCss]) {
  assert(!source.includes('ui_panel_frame.png'), 'active Reboot CSS must not use ornate ui_panel_frame.png');
  assert(!source.includes('ui_panel_wide.png'), 'active Reboot CSS must not use ornate ui_panel_wide.png');
}
assert(css.includes('.classic-board-wrap') && css.includes('border: 1px solid rgba(102, 157, 199, .5)'), 'board wrapper must use a CSS-only frameless edge');
assert(polishCss.includes(".classic-piece-marker[data-piece-marker='p']::before") && polishCss.includes('paint-order:stroke fill'), 'Classic owner CSS must render accepted role glyphs');
assert(polishCss.includes("html[lang='en'] .classic-party-panel h2::before { content:'COMBAT SUMMARY'!important; }") && polishCss.includes("content:'COMBAT LOG'!important"), 'Classic owner CSS must own language-aware combat captions');

// Run combat must keep the Journal in its source-owned sibling slot instead of moving live DOM.
assert(polishCss.includes('body.run-combat-board-active') && polishCss.includes('.classic-party-panel,') && polishCss.includes('.classic-panel--moves'), 'Classic owner CSS must style stable Party/Journal siblings during run combat');
assert(!polishCss.includes(':has(>.classic-panel--moves)') && !polishCss.includes('>.classic-panel--moves'), 'run-combat CSS must not depend on Journal being reparented into Party');
assert(!fs.existsSync(path.join(game,'js/content/post-pages-ui-review2.mjs')), 'superseded review2 compatibility module must be deleted');
assert(!redesignSource.includes('movePanelHome') && !redesignSource.includes('party.append(movePanel)'), 'shared redesign runtime must not reparent Classic Journal');
assert(!fs.existsSync(path.join(game,'js/content/post-pages-ui-polish-constraints.mjs')), 'superseded constraints compatibility module must be deleted');

for (const side of ['player', 'enemy']) {
  for (const piece of ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']) {
    assert(fs.existsSync(path.join(game, 'generated_assets', `unit_${piece}_${side}.png`)), `piece asset missing: ${piece}_${side}`);
  }
}

console.log('Classic Chess + AI owner-localized / external-coordinate / stable-Journal / frameless static contract: PASS');