const assert = require('assert');
const { chromium } = require('playwright');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';

async function clickMove(page, from, to) {
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
}

async function pieceSrc(page, square) {
  return page.locator(`[data-square="${square}"] .classic-piece`).getAttribute('src');
}

async function waitForMoveAnimation(page) {
  await page.locator('.classic-piece-flyer').waitFor({ state: 'attached', timeout: 1500 });
  await page.locator('.classic-piece-flyer').waitFor({ state: 'detached', timeout: 2500 });
}

async function openSetup(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('rpchess:new-game')));
  await page.locator('[data-game-setup-modal]:not([hidden])').waitFor();
}

async function startFromSetup(page, { mode = 'local', elo = '800', color = 'w' } = {}) {
  await page.locator('[data-game-mode-select]').selectOption(mode);
  if (mode === 'ai') {
    await page.locator('[data-ai-elo]').selectOption(String(elo));
    await page.locator('[data-player-color]').selectOption(color);
  }
  await page.locator('[data-start-game]').click();
  await page.locator('[data-classic-screen]:not([hidden])').waitFor();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));

    await page.goto(url, { waitUntil: 'networkidle' });
    const menu = page.locator('[data-reboot-foundation]');
    assert.strictEqual(await menu.isVisible(), true, 'menu scene must be visible before starting a game');
    assert.strictEqual(await page.locator('[data-classic-screen]').isHidden(), true, 'Classic Chess scene must start hidden');
    await openSetup(page);
    assert.strictEqual(await menu.isVisible(), true, 'setup opens over menu before game scene transition');
    assert.strictEqual(await page.locator('[data-ai-elo] option').count(), 12, 'setup exposes 12 Elo levels');
    await startFromSetup(page, { mode: 'local' });

    assert.strictEqual(await page.locator('[data-chess-board] [data-square]').count(), 64, 'board must contain 64 squares');
    assert.strictEqual(await page.locator('[data-chess-board] .classic-piece').count(), 32, 'initial position must render 32 pieces');
    assert.strictEqual(await page.locator('[data-chess-board] [data-piece-marker]').count(), 32, 'every initial fantasy piece must carry a technical chess marker');
    assert.strictEqual(await menu.isHidden(), true, 'menu must leave layout during game');
    assert((await page.locator('[data-game-mode]').innerText()).includes('Локальная'), 'local mode label must render');

    await page.locator('[data-square="e2"]').click();
    assert(await page.locator('[data-square="e3"]').evaluate((node) => node.classList.contains('classic-square--legal')), 'e3 must be highlighted as legal');
    assert(await page.locator('[data-square="e4"]').evaluate((node) => node.classList.contains('classic-square--legal')), 'e4 must be highlighted as legal');
    await page.locator('[data-square="e4"]').click();
    await waitForMoveAnimation(page);
    assert((await pieceSrc(page, 'e4')).includes('unit_pawn_player.png'), 'white pawn must move to e4');
    assert.strictEqual(await page.locator('[data-move-history] [data-san="e4"]').count(), 1, 'pawn move must use SAN e4');
    await clickMove(page, 'e7', 'e5');
    await waitForMoveAnimation(page);
    await clickMove(page, 'g1', 'f3');
    await waitForMoveAnimation(page);
    assert.strictEqual(await page.locator('[data-move-history] [data-san="Nf3"] .classic-san-figurine').count(), 1, 'piece SAN must render as figurine notation');

    const fenBeforeIllegal = await page.evaluate(() => window.RPChessClassicChess.snapshot().fen);
    await page.locator('[data-square="e5"]').click();
    await page.locator('[data-square="e4"]').click();
    assert.strictEqual(await page.evaluate(() => window.RPChessClassicChess.snapshot().fen), fenBeforeIllegal, 'illegal pawn move may not change position');

    await page.evaluate(() => window.RPChessClassicChess.loadFen('4k3/8/8/8/8/8/p7/R3K3 w - - 0 1'));
    await clickMove(page, 'a1', 'a2');
    await waitForMoveAnimation(page);
    assert.strictEqual(await page.locator('[data-captured-by-white] .classic-captured-piece').count(), 1, 'capture must add a technical captured-piece glyph');
    assert.strictEqual((await page.locator('[data-material-white]').innerText()).trim(), '+5', 'material advantage must be shown for stronger side');
    assert.strictEqual(await page.locator('[data-move-history] [data-san="Rxa2"] .classic-san-figurine').count(), 1, 'capture must use SAN Rxa2 with figurine rendering');

    await page.evaluate(() => window.RPChessClassicChess.loadFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'));
    await clickMove(page, 'e1', 'g1');
    await waitForMoveAnimation(page);
    assert((await pieceSrc(page, 'g1')).includes('unit_king_player.png'), 'castling must place king on g1');
    assert((await pieceSrc(page, 'f1')).includes('unit_rook_player.png'), 'castling must place rook on f1');
    assert.strictEqual(await page.locator('[data-move-history] [data-san="O-O"]').count(), 1, 'castling must use SAN O-O');

    await page.evaluate(() => window.RPChessClassicChess.loadFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1'));
    await clickMove(page, 'e5', 'd6');
    await waitForMoveAnimation(page);
    assert((await pieceSrc(page, 'd6')).includes('unit_pawn_player.png'), 'en passant pawn must land on d6');
    assert.strictEqual(await page.locator('[data-square="d5"] .classic-piece').count(), 0, 'en passant must remove pawn from d5');

    await page.evaluate(() => window.RPChessClassicChess.loadFen('7k/P7/8/8/8/8/8/7K w - - 0 1'));
    await clickMove(page, 'a7', 'a8');
    await page.locator('[data-promotion-modal]:not([hidden])').waitFor();
    assert.strictEqual(await page.locator('[data-promotion-options] [data-promotion]').count(), 4, 'promotion must offer four pieces');
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.locator('[data-promotion-modal]').isVisible(), true, 'mandatory promotion modal must ignore Escape');
    await page.locator('[data-promotion="q"]').click();
    await waitForMoveAnimation(page);
    assert((await pieceSrc(page, 'a8')).includes('unit_queen_player.png'), 'promotion must render chosen queen asset');
    assert((await page.locator('[data-move-history] .classic-move[data-san]').last().getAttribute('data-san')).includes('=Q'), 'promotion SAN must include =Q');

    await page.evaluate(() => window.RPChessClassicChess.newGame());
    for (const [from, to] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) {
      await clickMove(page, from, to);
      await waitForMoveAnimation(page);
    }
    await page.locator('[data-game-result]:not([hidden])').waitFor();
    assert.strictEqual((await page.locator('[data-result-title]').innerText()).trim(), 'Мат', 'Fool’s mate must end in checkmate');
    assert((await page.locator('[data-move-history] .classic-move[data-san]').last().getAttribute('data-san')).endsWith('#'), 'checkmate SAN must end with #');

    await page.evaluate(() => window.RPChessClassicChess.loadFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'));
    assert.strictEqual((await page.locator('[data-result-title]').innerText()).trim(), 'Пат', 'stalemate must be shown in UI');

    await page.evaluate(() => window.RPChessClassicChess.loadFen('7k/8/8/8/8/8/2R5/K7 w - - 99 1'));
    await clickMove(page, 'c2', 'c3');
    await waitForMoveAnimation(page);
    assert((await page.locator('[data-result-text]').innerText()).includes('Пятьдесят'), '50-move draw must be shown in UI');

    await page.locator('[data-classic-menu]').click();
    assert.strictEqual(await menu.isVisible(), true, 'main menu must be reachable from Classic Chess');
    assert.strictEqual(await page.locator('[data-classic-screen]').isHidden(), true, 'chess scene must leave layout on menu return');

    await openSetup(page);
    await startFromSetup(page, { mode: 'ai', elo: '800', color: 'w' });
    assert((await page.locator('[data-game-mode]').innerText()).includes('≈800 Elo'), 'selected AI Elo must be shown');
    await clickMove(page, 'e2', 'e4');
    await page.waitForFunction(() => window.RPChessClassicChess.moveLog.length >= 2 && !window.RPChessChessAI.thinking && !window.RPChessChessAI.snapshot().animating, null, { timeout: 20000 });
    const aiWhite = await page.evaluate(() => ({ turn: window.RPChessClassicChess.snapshot().turn, moves: window.RPChessClassicChess.moveLog.length, ai: window.RPChessChessAI.snapshot() }));
    assert.strictEqual(aiWhite.turn, 'w', 'AI must hand turn back to White player');
    assert.strictEqual(aiWhite.moves, 2, 'one human move must receive one AI reply');
    assert.strictEqual(aiWhite.ai.initialized, true, 'Stockfish worker must initialize');
    assert.strictEqual(aiWhite.ai.degraded, false, 'Stockfish browser path must not degrade');
    assert.strictEqual(await page.locator('[data-ai-thinking]').isVisible(), false, 'large thinking plaque must stay visually hidden');

    await page.locator('[data-classic-new]').click();
    await page.locator('[data-game-setup-modal]:not([hidden])').waitFor();
    await startFromSetup(page, { mode: 'ai', elo: '400', color: 'b' });
    await page.waitForFunction(() => window.RPChessClassicChess.moveLog.length >= 1 && !window.RPChessChessAI.thinking && !window.RPChessChessAI.snapshot().animating, null, { timeout: 20000 });
    assert.strictEqual(await page.evaluate(() => window.RPChessClassicChess.snapshot().turn), 'b', 'AI first move must hand turn to Black player');
    assert.strictEqual(await page.locator('[data-chess-board] [data-square]').first().getAttribute('data-square'), 'h1', 'Black player view must rotate board');

    await page.locator('[data-classic-screen] [data-settings]').click();
    await page.locator('[data-settings-modal]:not([hidden])').waitFor();
    await page.locator('[data-settings-modal] [data-close-modal]').click();
    await page.locator('[data-classic-menu]').click();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await mobile.goto(url, { waitUntil: 'networkidle' });
    await openSetup(mobile);
    await startFromSetup(mobile, { mode: 'local' });
    assert.strictEqual(await mobile.locator('[data-reboot-foundation]').isHidden(), true, 'mobile menu scene must hide during game');
    assert.strictEqual(await mobile.locator('[data-chess-board] [data-square]').count(), 64, 'mobile board must have 64 squares');
    assert.strictEqual(await mobile.locator('[data-piece-marker]').count(), 32, 'mobile pieces must retain technical markers');
    const boardBox = await mobile.locator('[data-chess-board]').boundingBox();
    assert(boardBox && boardBox.width > 300 && boardBox.width <= 390, `mobile board width must fit viewport: ${boardBox?.width}`);
    await clickMove(mobile, 'e2', 'e4');
    await waitForMoveAnimation(mobile);
    assert((await pieceSrc(mobile, 'e4')).includes('unit_pawn_player.png'), 'mobile board interaction must move pieces');
    const scrollState = await mobile.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, clientHeight: document.documentElement.clientHeight }));
    assert(scrollState.scrollHeight > scrollState.clientHeight, 'mobile Classic Chess screen must remain vertically scrollable');

    assert.deepStrictEqual(errors, [], `desktop page errors:\n${errors.join('\n')}`);
    assert.deepStrictEqual(mobileErrors, [], `mobile page errors:\n${mobileErrors.join('\n')}`);
    console.log('Classic Chess + real Stockfish production polish Chromium acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});