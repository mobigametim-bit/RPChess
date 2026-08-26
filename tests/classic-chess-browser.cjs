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

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('[data-new-game]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    assert.strictEqual(await page.locator('[data-chess-board] [data-square]').count(), 64, 'board must contain 64 squares');
    assert.strictEqual(await page.locator('[data-chess-board] .classic-piece').count(), 32, 'initial position must render 32 pieces');
    assert.strictEqual(await page.locator('[data-reboot-foundation]').isHidden(), true, 'menu must hide during a game');

    await page.locator('[data-square="e2"]').click();
    assert(await page.locator('[data-square="e3"]').evaluate((node) => node.classList.contains('classic-square--legal')), 'e3 must be highlighted as legal');
    assert(await page.locator('[data-square="e4"]').evaluate((node) => node.classList.contains('classic-square--legal')), 'e4 must be highlighted as legal');
    await page.locator('[data-square="e4"]').click();
    assert((await pieceSrc(page, 'e4')).includes('unit_pawn_player.png'), 'white pawn must move to e4');
    assert((await page.locator('[data-classic-turn]').innerText()).includes('чёрных'), 'turn must pass to black');

    await clickMove(page, 'e7', 'e5');
    const fenBeforeIllegal = await page.evaluate(() => window.RPChessClassicChess.snapshot().fen);
    await page.locator('[data-square="e4"]').click();
    await page.locator('[data-square="e5"]').click();
    assert.strictEqual(await page.evaluate(() => window.RPChessClassicChess.snapshot().fen), fenBeforeIllegal, 'illegal pawn move may not change position');

    await page.evaluate(() => window.RPChessClassicChess.loadFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'));
    await clickMove(page, 'e1', 'g1');
    assert((await pieceSrc(page, 'g1')).includes('unit_king_player.png'), 'castling must place king on g1');
    assert((await pieceSrc(page, 'f1')).includes('unit_rook_player.png'), 'castling must place rook on f1');
    assert.strictEqual(await page.locator('[data-square="h1"] .classic-piece').count(), 0, 'rook source must be empty after castling');

    await page.evaluate(() => window.RPChessClassicChess.loadFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1'));
    await clickMove(page, 'e5', 'd6');
    assert((await pieceSrc(page, 'd6')).includes('unit_pawn_player.png'), 'en passant pawn must land on d6');
    assert.strictEqual(await page.locator('[data-square="d5"] .classic-piece').count(), 0, 'en passant must remove pawn from d5');

    await page.evaluate(() => window.RPChessClassicChess.loadFen('7k/P7/8/8/8/8/8/7K w - - 0 1'));
    await clickMove(page, 'a7', 'a8');
    await page.locator('[data-promotion-modal]:not([hidden])').waitFor();
    assert.strictEqual(await page.locator('[data-promotion-options] [data-promotion]').count(), 4, 'promotion must offer four pieces');
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.locator('[data-promotion-modal]').isVisible(), true, 'mandatory promotion modal must ignore Escape');
    await page.locator('[data-promotion="q"]').click();
    assert((await pieceSrc(page, 'a8')).includes('unit_queen_player.png'), 'promotion must render chosen queen asset');

    await page.evaluate(() => window.RPChessClassicChess.newGame());
    for (const [from, to] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) await clickMove(page, from, to);
    await page.locator('[data-game-result]:not([hidden])').waitFor();
    assert.strictEqual((await page.locator('[data-result-title]').innerText()).trim(), 'Мат', 'Fool’s mate must end in checkmate');
    assert((await page.locator('[data-result-text]').innerText()).includes('Чёрные'), 'black must win Fool’s mate');

    await page.evaluate(() => window.RPChessClassicChess.loadFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'));
    assert.strictEqual((await page.locator('[data-result-title]').innerText()).trim(), 'Пат', 'stalemate must be shown in UI');

    await page.evaluate(() => window.RPChessClassicChess.loadFen('7k/8/8/8/8/8/2R5/K7 w - - 99 1'));
    await clickMove(page, 'c2', 'c3');
    assert((await page.locator('[data-result-text]').innerText()).includes('Пятьдесят'), '50-move draw must be shown in UI');

    await page.locator('[data-classic-new]').click();
    assert.strictEqual(await page.locator('[data-chess-board] .classic-piece').count(), 32, 'New Game must reset the board');
    await page.locator('[data-settings]').nth(1).click();
    await page.locator('[data-settings-modal]:not([hidden])').waitFor();
    await page.locator('[data-settings-modal] [data-close-modal]').click();
    await page.locator('[data-classic-menu]').click();
    assert.strictEqual(await page.locator('[data-reboot-foundation]').isVisible(), true, 'main menu must be reachable from Classic Chess');

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await mobile.goto(url, { waitUntil: 'networkidle' });
    await mobile.locator('[data-new-game]').click();
    await mobile.locator('[data-classic-screen]:not([hidden])').waitFor();
    assert.strictEqual(await mobile.locator('[data-chess-board] [data-square]').count(), 64, 'mobile board must have 64 squares');
    const boardBox = await mobile.locator('[data-chess-board]').boundingBox();
    assert(boardBox && boardBox.width > 300 && boardBox.width <= 390, `mobile board width must fit viewport: ${boardBox?.width}`);
    await clickMove(mobile, 'e2', 'e4');
    assert((await pieceSrc(mobile, 'e4')).includes('unit_pawn_player.png'), 'mobile board interaction must move pieces');
    const scrollState = await mobile.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, clientHeight: document.documentElement.clientHeight }));
    assert(scrollState.scrollHeight > scrollState.clientHeight, 'mobile Classic Chess screen must remain vertically scrollable when content exceeds viewport');

    assert.deepStrictEqual(errors, [], `desktop page errors:\n${errors.join('\n')}`);
    assert.deepStrictEqual(mobileErrors, [], `mobile page errors:\n${mobileErrors.join('\n')}`);
    console.log('Classic Chess real Chromium acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
