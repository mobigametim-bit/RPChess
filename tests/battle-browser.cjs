const assert = require('assert');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const RUN_KEY = 'rpchess.reboot.v1.run';
const STANDARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

function route(id, { playerColor = 'w', stars = 6, race = 'orcs' } = {}) {
  const enemyRoleRaces = { pawn: race, knight: race, bishop: race, rook: race, queen: race, king: race };
  return {
    id,
    step: 1,
    type: 'battle',
    label: 'БИТВА',
    stars,
    threatLabel: 'ОПАСНАЯ',
    flavor: 'Дорогу перекрывает полностью развёрнутая армия противника.',
    mechanicalHint: 'Полная армия противника.',
    seed: `${id}-seed`,
    difficultyModel: 'power-v1',
    playerColor,
    enemyColor: playerColor === 'w' ? 'b' : 'w',
    enemyRaceTag: race,
    enemyRoleRaces,
    sideNarrative: playerColor === 'b'
      ? 'Враг уже занял поле и начинает первым. Ваш отряд принимает бой, удерживая оборону.'
      : 'Ваш отряд перехватывает инициативу и первым выходит на поле.'
  };
}

async function fresh(page, { woundedKing = false, playerColor = 'w', stars = 6, race = 'orcs', commanderId = 'oathkeeper' } = {}) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), RUN_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await startNewRun(page);
  const routes = [
    route('manual.battle.1', { playerColor, stars, race }),
    route('manual.battle.2', { playerColor, stars, race }),
    route('manual.battle.3', { playerColor, stars, race })
  ];
  await page.evaluate(({ key, woundedKing, routes, commanderId }) => {
    const run = JSON.parse(localStorage.getItem(key));
    run.id = `battle-browser-${routes[0].playerColor}`;
    run.commanderId=commanderId;
    run.currentTravelChoices = routes;
    run.activeTravelChoice = null;
    if (woundedKing) run.roster.find((character) => character.isRunKing).status = 'wounded';
    localStorage.setItem(key, JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  }, { key: RUN_KEY, woundedKing, routes, commanderId });
}

async function enter(page) {
  await page.locator('[data-roster-travel]').click();
  await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
  const card = page.locator('[data-travel-type="battle"]').first();
  assert.strictEqual(await card.count(), 1);
  await card.click();
  await page.locator('[data-artifact-choice-modal]').waitFor();
  assert.strictEqual(await page.locator('[data-battle-screen]').isHidden(),true,'Battle preparation is skipped');
}

async function assertResponsiveStars(page, selector, cardSelector) {
  const layout = await page.locator(selector).evaluate((el, cardSelector) => {
    const card = el.closest(cardSelector);
    const range = document.createRange();
    range.selectNodeContents(el);
    const bounds = card.getBoundingClientRect();
    const rects = [...range.getClientRects()].map((rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }));
    return {
      text: (el.textContent || '').replace(/\u200B/g, ''),
      hasBreak: (el.textContent || '').includes('\u200B'),
      rects,
      bounds: { left: bounds.left, right: bounds.right }
    };
  }, cardSelector);
  assert.strictEqual((layout.text.match(/★/g) || []).length, 12);
  assert.strictEqual(layout.hasBreak, true);
  assert(layout.rects.length >= 1 && layout.rects.length <= 2, `12-star label must occupy one or two lines, got ${layout.rects.length}`);
  for (const rect of layout.rects) {
    assert(rect.left >= layout.bounds.left - 1);
    assert(rect.right <= layout.bounds.right + 1);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.stack || error)));

    await fresh(page, { playerColor: 'w', stars: 12, race: 'orcs', commanderId:'ash_regent' });
    await enter(page);
    assert.strictEqual((await page.evaluate(()=>globalThis.RPChessBattle.selectedIds)).length,6,'Battle automatically chooses all six eligible starter heroes');
    assert.strictEqual((await page.evaluate(()=>globalThis.RPChessBattle.encounter.stars)),12);
    assert.strictEqual(await page.locator('[data-battle-screen]').isHidden(),true);
    await page.locator('[data-artifact-choice="none"]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    const state = await page.evaluate(() => ({ fen: globalThis.RPChessClassicChess.snapshot().fen, plan: globalThis.RPChessBattle.battlePlan }));
    assert.strictEqual(state.fen, state.plan.fen);
    assert.strictEqual(state.fen.split(' ')[0], STANDARD);
    assert.strictEqual(state.plan.playerColor, 'w');
    assert.strictEqual(state.plan.encounter.stars, 12);
    assert.strictEqual(state.plan.playerFormation.filter((piece) => piece.id).length, 6);
    const artContracts=await page.evaluate(async()=>{
      const {boardPieceArtForCharacter,heroPortraitArt,namedPawnPieceArt,NAMED_BISHOP_IDS}=await import('./js/race-assets.mjs');
      const legacy={id:'hero.aldric_wall',pieceType:'rook',pieceArt:'assets/races/humans/pieces/board/white/rook.png'};
      return {
        oldNamed:boardPieceArtForCharacter(legacy,'w'),
        oldNamedBlack:boardPieceArtForCharacter(legacy,'b','r'),
        oldNamedPortrait:heroPortraitArt({...legacy,portrait:'assets/heroes/aldric_wall/portrait.png'}),
        otherNamed:boardPieceArtForCharacter({id:'hero.ergen_cloud',pieceType:'bishop',pieceArt:'assets/races/humans/pieces/board/white/bishop.png'},'w'),
        missingSaveArt:boardPieceArtForCharacter({id:'hero.brother_orell',pieceType:'bishop'},'b'),
        namedBishops:NAMED_BISHOP_IDS.map(id=>({
          id,
          white:boardPieceArtForCharacter({id:`hero.${id}`,pieceType:'bishop',pieceArt:'obsolete.png'},'w'),
          black:boardPieceArtForCharacter({id:`hero.${id}`,pieceType:'bishop',portrait:'obsolete.png'},'b'),
          portrait:heroPortraitArt({id:`hero.${id}`,portrait:'obsolete.png'})
        })),
        nonBishop:boardPieceArtForCharacter({id:'hero.brother_orell',pieceType:'bishop'},'w','rook'),
        namedPawn:boardPieceArtForCharacter({id:'hero.nemea_quill',pieceType:'pawn'},'b'),
        promotedPawn:namedPawnPieceArt({id:'hero.mara_chain'},'queen','w'),
        stalePortrait:heroPortraitArt({id:'hero.nemea_quill',portrait:'assets/heroes/nemea_quill/portrait.png'})
      };
    });
    assert.equal(artContracts.oldNamed,'assets/heroes/aldric_wall/pieces/white/rook.webp',
      'named Rook must use its new white art even if an old save points at race chess art');
    assert.equal(artContracts.oldNamedBlack,'assets/heroes/aldric_wall/pieces/black/rook.webp',
      'named Rook must use its new black art when the role is encoded as r');
    assert.equal(artContracts.oldNamedPortrait,'assets/heroes/aldric_wall/portrait_named.webp',
      'named Rook old-save portrait must resolve to new image');
    assert.equal(artContracts.otherNamed,'assets/heroes/ergen_cloud/piece_badge.png',
      'other named pieces must keep personal badge art even when old save points at race sprite');
    assert.equal(artContracts.missingSaveArt,'assets/heroes/brother_orell/pieces/black/bishop.webp',
      'a saved named Bishop must restore the new black figure, even without pieceArt');
    assert.equal(artContracts.namedBishops.length,7);
    for(const {id,white,black,portrait} of artContracts.namedBishops){
      assert.equal(white,`assets/heroes/${id}/pieces/white/bishop.webp`);
      assert.equal(black,`assets/heroes/${id}/pieces/black/bishop.webp`);
      assert.equal(portrait,`assets/heroes/${id}/portrait_named.webp`);
    }
    assert.equal(artContracts.nonBishop,'assets/heroes/brother_orell/piece_badge.png',
      'unprovided role art must keep the old personal badge fallback');
    assert(artContracts.namedPawn.endsWith('/nemea_quill/pieces/black/pawn.webp'));
    assert(artContracts.promotedPawn.endsWith('/mara_chain/pieces/white/queen.webp'));
    assert(artContracts.stalePortrait.endsWith('/nemea_quill/portrait_named.webp'));
    const generic = state.plan.playerFormation.find((piece) => !piece.id);
    const enemyQueen = state.plan.enemyFormation.find((piece) => piece.pieceType === 'queen');
    const art = await page.evaluate(({ genericSquare, enemySquare }) => ({
      generic: document.querySelector(`[data-square="${genericSquare}"] .classic-piece`)?.getAttribute('src') || '',
      enemy: document.querySelector(`[data-square="${enemySquare}"] .classic-piece`)?.getAttribute('src') || ''
    }), { genericSquare: generic.square, enemySquare: enemyQueen.square });
    assert(art.generic.includes('assets/races/humans/pieces/board/white/'));
    assert(art.enemy.includes('assets/races/orcs/pieces/board/black/queen.png'));
    // The Power badge must display the player's selected King, not a blank
    // rectangle or a hardcoded Oathkeeper in an Ash Regent run.
    await page.evaluate(() => globalThis.RPChessBattle.finishBattle({ over: true, type: 'stalemate', winner: null }));
    await page.locator('[data-battle-aftermath]:not([hidden])').waitFor();
    await page.waitForFunction(()=>{
      const result=document.querySelector('[data-battle-aftermath] .power-result');
      return result&&getComputedStyle(result,'::before').backgroundImage.includes('/assets/kings/ash_regent/portrait.webp');
    },null,{timeout:10000});
    const portraitLoaded=await page.evaluate(async()=>{
      const image=new Image();
      image.src='assets/kings/ash_regent/portrait.webp';
      await image.decode();
      return image.naturalWidth>0&&image.naturalHeight>0;
    });
    assert(portraitLoaded,'selected King portrait must decode successfully in the result screen');
    await page.setViewportSize({width:844,height:390});
    const mobileKing=await page.locator('[data-battle-aftermath] .power-result').evaluate(root=>{
      const pseudo=getComputedStyle(root,'::before'),rect=root.getBoundingClientRect();
      return {image:pseudo.backgroundImage,display:pseudo.display,size:pseudo.width,result:{top:rect.top,bottom:rect.bottom}};
    });
    assert(mobileKing.image.includes('/assets/kings/ash_regent/portrait.webp')&&mobileKing.display!=='none',
      `selected King portrait must be visible after Battle at 844x390: ${JSON.stringify(mobileKing)}`);
    await page.locator('[data-game-loading]').waitFor({state:'hidden',timeout:25000});
  await page.evaluate(()=>document.fonts.ready);
  if(process.env.RPCHESS_MOBILE_POLISH_SCREENSHOT_DIR){
      const fs=require('node:fs'),dir=process.env.RPCHESS_MOBILE_POLISH_SCREENSHOT_DIR;
      fs.mkdirSync(dir,{recursive:true});
      await page.screenshot({path:require('node:path').join(dir,'05-battle-commander-mobile.png')});
    }
    await page.setViewportSize({width:1440,height:900});
    assert.strictEqual(await page.locator('[data-battle-aftermath]').evaluate(node=>node.classList.contains('battle-aftermath--death')),false,
      'ordinary Battle aftermath must keep its existing non-death presentation');
    assert.strictEqual(await page.locator('[data-battle-aftermath] .battle-logo').count(),1,
      'normal Battle aftermath must retain its original logo');
    assert.strictEqual(await page.locator('[data-battle-run-end] .battle-logo').count(),0,
      'King death battle fallback screen must have no logo');
    assert.strictEqual((await page.locator('[data-battle-continue]').innerText()).trim(), 'Продолжить путь');
    await page.locator('[data-battle-continue]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    assert.strictEqual(await page.locator('[data-roster-screen]:not([hidden])').count(), 0, 'Battle aftermath must not route through Roster');
    assert.strictEqual(await page.locator('[data-travel-choice]').count(), 3, 'Battle aftermath must produce the next Travel Choice');
    const continued = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(continued.activeTravelChoice, null, 'completed Battle route must be cleared before next Travel Choice');

    const black = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const blackErrors = [];
    black.on('pageerror', (error) => blackErrors.push(String(error.stack || error)));
    await fresh(black, { playerColor: 'b', stars: 9, race: 'dark_elves' });
    await enter(black);
    assert.strictEqual((await black.evaluate(()=>globalThis.RPChessBattle.encounter.playerColor)),'b');
    await black.locator('[data-artifact-choice="none"]').click();
    await black.locator('[data-classic-screen]:not([hidden])').waitFor();
    const blackPlan = await black.evaluate(() => globalThis.RPChessBattle.battlePlan);
    assert.strictEqual(blackPlan.playerColor, 'b');
    assert.strictEqual(blackPlan.playerFormation.find((piece) => piece.pieceType === 'king').square, 'e8');
    const blackGeneric = blackPlan.playerFormation.find((piece) => !piece.id);
    const darkEnemy = blackPlan.enemyFormation.find((piece) => piece.pieceType === 'rook');
    const blackArt = await black.evaluate(({ genericSquare, enemySquare }) => ({
      generic: document.querySelector(`[data-square="${genericSquare}"] .classic-piece`)?.getAttribute('src') || '',
      enemy: document.querySelector(`[data-square="${enemySquare}"] .classic-piece`)?.getAttribute('src') || '',
      mode: document.querySelector('[data-game-mode]')?.textContent || '',
      firstSquare: document.querySelector('[data-chess-board] [data-square]')?.dataset.square || ''
    }), { genericSquare: blackGeneric.square, enemySquare: darkEnemy.square });
    assert(blackArt.generic.includes('assets/races/humans/pieces/board/black/'));
    assert(blackArt.enemy.includes('assets/races/dark_elves/pieces/board/white/rook.png'),
      'Black-side encounter must show the enemy white-color race board rook');
    assert.strictEqual(blackArt.firstSquare, 'h1', 'Black-side Battle must render the board from Black perspective');
    assert.strictEqual(blackArt.mode, 'Безжалостный Полководец', 'shared combat summary must render the canonical difficulty label');

    const wounded = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const woundedErrors = [];
    wounded.on('pageerror', (error) => woundedErrors.push(String(error.stack || error)));
    await fresh(wounded, { woundedKing: true });
    await enter(wounded);
    assert((await wounded.evaluate(()=>globalThis.RPChessBattle.selectedIds)).includes('king.oathkeeper'),'auto Battle team keeps wounded run king');
    await wounded.locator('[data-artifact-choice="none"]').click();
    await wounded.locator('[data-classic-screen]:not([hidden])').waitFor();
    // A Mercenary debt casualty uses the same aftermath screen but without
    // the normal result logo; the card remains centered in both axes.
    await wounded.evaluate(key=>{
      const run=JSON.parse(localStorage.getItem(key));
      run.battleMercenaryContract={encounterId:'browser.debt',battleCountAtCharge:run.battleCount||0,
        casualtyDebt:true,settled:false,totalCost:100,unpaidValue:100,chargedGold:0,chargedSupplies:0};
      localStorage.setItem(key,JSON.stringify(run));
      window.RPChessBattle.finishBattle({over:true,type:'stalemate',winner:null});
    },RUN_KEY);
    await wounded.locator('[data-battle-aftermath].battle-aftermath--death:not([hidden])').waitFor();
    const deathGeometry=await wounded.locator('[data-battle-aftermath]').evaluate(root=>{
      const panel=root.querySelector('.battle-aftermath-panel')?.getBoundingClientRect();
      const logo=root.querySelector('.battle-logo');
      return {
        x:panel?(panel.left+panel.right)/2-innerWidth/2:999,
        y:panel?(panel.top+panel.bottom)/2-innerHeight/2:999,
        logoHidden:!logo||getComputedStyle(logo).display==='none',
        text:root.querySelector('[data-battle-aftermath-text]')?.textContent||''
      };
    });
    assert(deathGeometry.logoHidden&&Math.abs(deathGeometry.x)<=2&&Math.abs(deathGeometry.y)<=2,
      `Mercenary death aftermath must hide the logo and center its panel: ${JSON.stringify(deathGeometry)}`);
    assert(deathGeometry.text.includes('Наёмники')||deathGeometry.text.includes('Наёмник'),
      'Debt death aftermath must keep its casualty notice');


    const mobile = await browser.newPage({ viewport: { width: 844, height: 390 } });
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.stack || error)));
    await fresh(mobile, { stars: 12 });
    await enter(mobile);
    await mobile.locator('[data-game-loading]').waitFor({state:'hidden',timeout:25000});
    const dialog=await mobile.locator('[data-artifact-choice-modal] .artifact-choice-panel').boundingBox();
    assert(dialog&&dialog.y>=-1&&dialog.y+dialog.height<=391,'automatic Battle artifact choice fits mobile landscape');
    assert.strictEqual(await mobile.locator('[data-battle-screen]').isHidden(),true);
    await mobile.locator('[data-artifact-choice="none"]').click();
    await mobile.locator('[data-classic-screen]:not([hidden])').waitFor();

    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(blackErrors, []);
    assert.deepStrictEqual(woundedErrors, []);
    assert.deepStrictEqual(mobileErrors, []);
    console.log('Battle aftermath→Travel, removed legacy back/actionbar DOM, compact desktop prep, canonical combat summary, owner-rendered landscape-mobile CTA, human color sets, enemy race art, Black-side and wounded King acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});