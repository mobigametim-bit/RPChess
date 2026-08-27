const assert = require('assert');
const { chromium } = require('playwright');
const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';
const STANDARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const ART = {
  'king.oathkeeper': 'assets/kings/oathkeeper/piece.png',
  'hero.aldric_wall': 'assets/heroes/aldric_wall/piece_badge.png',
  'hero.mara_chain': 'assets/heroes/mara_chain/piece_badge.png',
  'hero.nemea_quill': 'assets/heroes/nemea_quill/piece_badge.png',
  'hero.brother_orell': 'assets/heroes/brother_orell/piece_badge.png',
  'hero.vael_hammer': 'assets/heroes/vael_hammer/piece_badge.png'
};
async function freshRun(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-new-game]').click();
  await page.locator('[data-roster-screen]:not([hidden])').waitFor();
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.stack || e)));
    await freshRun(page);
    assert.strictEqual(await page.locator('[data-roster-battle]').isVisible(), true, 'temporary Battle bridge must be visible beside Journey until Travel Choice exists');
    await page.locator('[data-roster-battle]').click();
    await page.locator('[data-battle-screen]:not([hidden])').waitFor();
    assert.strictEqual(await page.locator('[data-battle-character]').count(), 6);
    assert.strictEqual(await page.locator('[data-battle-participant]').count(), 6);
    assert.strictEqual((await page.locator('[data-battle-personalized-count]').innerText()).trim(), '6');
    assert.strictEqual(await page.locator('[data-battle-participant="king.oathkeeper"]').isDisabled(), true);
    assert.strictEqual(await page.locator('[data-battle-formation] [data-battle-preview-square]').count(), 16);

    await page.locator('[data-battle-character="hero.aldric_wall"]').click();
    assert.strictEqual(await page.locator('[data-battle-participant="hero.aldric_wall"]').count(), 0);
    assert.strictEqual(await page.locator('[data-battle-preview-square="a1"] img').getAttribute('src'), 'generated_assets/unit_rook_player.png');
    await page.locator('[data-battle-character="hero.aldric_wall"]').click();

    await page.locator('[data-battle-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    const state = await page.evaluate(() => ({
      fen: globalThis.RPChessClassicChess.snapshot().fen,
      planFen: globalThis.RPChessBattle.battlePlan.fen,
      config: globalThis.RPChessChessAI.config,
      formation: globalThis.RPChessBattle.battlePlan.playerFormation.map(({ id, square }) => {
        const img = document.querySelector(`[data-square="${square}"] .classic-piece`);
        return { id, src: img?.getAttribute('src') || '', personalizedId: img?.dataset.personalizedId || '' };
      })
    }));
    assert.strictEqual(state.fen, state.planFen);
    assert.strictEqual(state.fen.split(' ')[0], STANDARD);
    assert(state.fen.includes(' KQkq '));
    assert.strictEqual(state.config.mode, 'ai');
    assert.strictEqual(state.config.playerColor, 'w');
    assert.strictEqual(state.formation.filter((x) => x.id).length, 6);
    assert.strictEqual(state.formation.filter((x) => !x.id).length, 10);
    for (const piece of state.formation.filter((x) => x.id)) {
      assert.strictEqual(piece.personalizedId, piece.id);
      assert.strictEqual(piece.src, ART[piece.id]);
    }
    assert.strictEqual(await page.locator('[data-classic-new]').isHidden(), true);
    assert.strictEqual(await page.locator('[data-classic-menu]').isHidden(), true);

    await page.evaluate(() => globalThis.RPChessBattle.finishBattle({ over: true, type: 'checkmate', winner: 'w', checked: true }));
    await page.locator('[data-battle-aftermath]:not([hidden])').waitFor();
    assert.strictEqual((await page.locator('[data-battle-aftermath-result]').innerText()).trim(), 'ПОБЕДА');
    assert.strictEqual(await page.locator('[data-battle-aftermath]').getByText('Погибли', { exact: true }).count(), 0);
    const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(persisted.battleCount, 1);
    assert.strictEqual(persisted.lastBattle.participants.length, 6);

    const loss = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const lossErrors = [];
    loss.on('pageerror', (e) => lossErrors.push(String(e.stack || e)));
    await freshRun(loss);
    await loss.locator('[data-roster-battle]').click();
    await loss.locator('[data-battle-start]').click();
    await loss.locator('[data-classic-screen]:not([hidden])').waitFor();
    await loss.evaluate(() => globalThis.RPChessBattle.finishBattle({ over: true, type: 'checkmate', winner: 'b', checked: true }));
    await loss.locator('[data-battle-run-end]:not([hidden])').waitFor();
    assert.strictEqual((await loss.locator('[data-battle-run-end-title]').innerText()).trim(), 'КОРОЛЬ ПОГИБ');
    const ended = await loss.evaluate((key) => { const r = JSON.parse(localStorage.getItem(key)); return { ended:r.ended, reason:r.endReason, king:r.roster.find(x=>x.isRunKing).status, battles:r.battleCount }; }, RUN_KEY);
    assert.deepStrictEqual(ended, { ended: true, reason: 'king_dead', king: 'dead', battles: 1 });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileErrors = [];
    mobile.on('pageerror', (e) => mobileErrors.push(String(e.stack || e)));
    await freshRun(mobile);
    await mobile.locator('[data-roster-battle]').click();
    await mobile.locator('[data-battle-screen]:not([hidden])').waitFor();
    const mobileState = await mobile.evaluate(() => ({ sh:document.documentElement.scrollHeight, ch:document.documentElement.clientHeight, sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth, pos:getComputedStyle(document.querySelector('.battle-actionbar')).position }));
    assert(mobileState.sh > mobileState.ch);
    assert(mobileState.sw <= mobileState.cw + 1);
    assert.strictEqual(mobileState.pos, 'sticky');
    assert.strictEqual(await mobile.locator('[data-battle-start]').isVisible(), true);

    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(lossErrors, []);
    assert.deepStrictEqual(mobileErrors, []);
    console.log('Battle standard-army replacement, personalized art, persistence, King-death and mobile Chromium acceptance: PASS');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
