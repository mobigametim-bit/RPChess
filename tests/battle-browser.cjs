const {acceptMercenariesBeforeArtifact}=require('./browser-test-helpers.cjs');
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
  await acceptMercenariesBeforeArtifact(page);
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
    assert(art.generic.includes('assets/races/orcs/pieces/board/white/'),
      'temporary hired pieces must use Orc race sprites, not generic human pieces');
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
    assert(mobileKing.image.includes(new URL('assets/kings/ash_regent/portrait.webp',url).pathname)&&
      !mobileKing.image.includes('/css/assets/kings/')&&mobileKing.display!=='none',
      `selected King portrait must resolve to the correct public root at 844x390: ${JSON.stringify(mobileKing)}`);
    const actuallyLoaded=await page.locator('[data-battle-aftermath] .power-result').evaluate(async root=>{
      const bg=getComputedStyle(root,'::before').backgroundImage;
      const match=bg.match(/url\(["']?([^"')]+)["']?\)/);
      if(!match)return false;
      return new Promise(resolve=>{
        const image=new Image();
        image.onload=()=>resolve(image.naturalWidth>0&&image.naturalHeight>0);
        image.onerror=()=>resolve(false);
        image.src=match[1];
      });
    });
    assert(actuallyLoaded,'Aftermath commander portrait image must really load, not merely have a CSS URL');
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
    assert(blackArt.generic.includes(`assets/races/orcs/pieces/board/black/${blackGeneric.pieceType}.png`),
      'Black-side hired pieces must use their Orc race sprite, not the old human fallback');
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

    // The weekly Battle now uses the SAME full-screen compact classic-shell
    // layout as the ordinary Battle. Verify layout with real browser geometry,
    // not a CSS/source-string assertion.
    const weekly = await browser.newPage({viewport:{width:1440,height:900}});
    const weeklyErrors=[];
    weekly.on('pageerror',error=>weeklyErrors.push(String(error.message||error)));
    await weekly.goto(url,{waitUntil:'networkidle'});
    await startNewRun(weekly,{legacyTravel:false});
    // The map owner is lazy-loaded by the Roster Travel action in production.
    await weekly.locator('[data-roster-travel]').click();
    await weekly.locator('[data-kingdom-map-screen]:not([hidden])').waitFor();
    await weekly.evaluate(key=>{
      // Seed the normal persisted Kingdom and click the REAL floating defender
      // marker. Do not dynamically import runtime modules inside this fixture:
      // other test pages register a service worker with different module URLs.
      const run=JSON.parse(localStorage.getItem(key));
      const map=run.kingdomMap;
      if(!map)throw new Error('Kingdom map must initialize before weekly fixture');
      const id='1,0';
      const point={status:'completed',completedOnce:true,explored:true,annexed:true,
        selectedEncounter:{id:'weekly.qa',seed:'weekly.qa',type:'battle',stars:3,
          enemyRaceTag:'elves',raceTag:'elves',playerColor:'w'},
        production:{kind:'battle',id:'weekly.qa:production',week:1,amount:1},
        respawnReady:true};
      const next={...map,day:7,cells:{...map.cells,[id]:point},
        centralOwnedCells:[...new Set([...(map.centralOwnedCells||[]),id])]};
      localStorage.setItem(key,JSON.stringify({...run,kingdomMap:next,gold:500,supplies:200}));
      globalThis.RPChessKingdomMap.open();
    },RUN_KEY);
    const marker=weekly.locator('[data-kingdom-collect="1,0"][data-production-kind="battle"]');
    await marker.waitFor({state:'visible'});
    // Production marker deliberately bobs, so Playwright's stationary-element
    // predicate never becomes true. Invoke the actual button click directly.
    await marker.evaluate(button=>button.click());
    await weekly.locator('[data-weekly-defenders]:not([hidden])').waitFor();
    assert.equal(await weekly.locator('.wd-opponent b,.wd-opponent small').count(),0,
      'no truncated enemy text can poke through the stars');
    assert.equal(await weekly.locator('.wd-gold-icon').count(),1,
      'reward uses the actual gold asset instead of a long text label');
    await weekly.locator('[data-wd-carousel] .wd-hero').nth(2).click();
    await weekly.locator('[data-wd-action="start"]').click();
    await weekly.locator('[data-wd-hire-action="yes"]').click();
    await weekly.locator('[data-weekly-battle-screen]:not([hidden])').waitFor();
    const placement=await weekly.locator('[data-weekly-battle-screen]').evaluate(screen=>{
      const board=screen.querySelector('.wd-chess-board')?.getBoundingClientRect();
      const left=screen.querySelector('.classic-party-panel')?.getBoundingClientRect();
      return {board:board&&{x:board.x,y:board.y,right:board.right,bottom:board.bottom,
        width:board.width,height:board.height},left:left&&{right:left.right,bottom:left.bottom},
        viewport:{width:innerWidth,height:innerHeight},
        modalHidden:document.querySelector('[data-weekly-defenders]')?.hidden};
    });
    assert(placement.board&&placement.left&&placement.modalHidden,
      'weekly combat must be a normal full-screen scene, not a modal');
    assert(placement.left.right<=placement.board.x+3&&placement.board.y>=0&&
      placement.board.right<=placement.viewport.width+2&&
      placement.board.bottom<=placement.viewport.height+2,
      'native Battle board must fit viewport with party panel on the left: '+
      JSON.stringify(placement));
    const defenderScreen=weekly.locator('[data-weekly-battle-screen]');
    assert.equal(await defenderScreen.locator('[data-wd-battle-week],[data-wd-battle-heading],[data-wd-battle-title]').count(),0,'obsolete headings removed');
    assert.equal(await defenderScreen.locator('[data-wd-battle-versus] img').count(),2,'actual hero portrait and enemy figure');
    assert.equal(await weekly.locator('[data-resource-hud]').isVisible(),false,'no Gold/Supplies HUD during defender combat');
    for(const action of ['close','pause','speed','skip']){
      const button=defenderScreen.locator('[data-wd-action="'+action+'"]');
      assert.equal(await button.locator('svg,img').count(),1,'icon-only '+action);
      assert(await button.getAttribute('aria-label'),'localized accessible '+action);
    }
    // Capture the real ongoing battle, not the loading splash or empty log.
    await weekly.locator('[data-wd-moves] .wd-move').first().waitFor({state:'visible',timeout:120000});
    await weekly.locator('[data-wd-action="pause"]').click();
    await defenderScreen.locator('[data-wd-battle-versus] img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
    await weekly.waitForTimeout(800);
    await weekly.screenshot({path:'test-results/weekly-defender-desktop.png'});
    await weekly.setViewportSize({width:844,height:390});
    await weekly.waitForTimeout(200);
    const mobilePlacement=await defenderScreen.evaluate(screen=>{
      const board=screen.querySelector('.wd-chess-board').getBoundingClientRect();
      const panel=screen.querySelector('.wd-battle-party').getBoundingClientRect();
      const controls=screen.querySelector('.wd-play-controls').getBoundingClientRect();
      return {left:panel.right,boardX:board.x,boardBottom:board.bottom,boardRight:board.right,
        controlsBottom:controls.bottom,panelBottom:panel.bottom,width:innerWidth,height:innerHeight};
    });
    assert(mobilePlacement.left<=mobilePlacement.boardX+3&&mobilePlacement.boardBottom<=mobilePlacement.height+2&&
      mobilePlacement.boardRight<=mobilePlacement.width+2&&mobilePlacement.controlsBottom<=mobilePlacement.panelBottom+2,
      'landscape defender rail and controls fit alongside board: '+JSON.stringify(mobilePlacement));
    await weekly.screenshot({path:'test-results/weekly-defender-mobile.png'});
    for(const [name,width,height] of [
      ['mobile-portrait',390,844],
      ['tablet-landscape',1280,800],
      ['tablet-portrait',800,1280]
    ]){
      await weekly.setViewportSize({width,height});
      await weekly.evaluate(()=>window.scrollTo(0,0));
      await weekly.waitForTimeout(500);
      if(height>width){
        const bounds=await defenderScreen.evaluate(screen=>{
          const board=screen.querySelector('[data-wd-board]').getBoundingClientRect();
          const first=screen.querySelector('[data-wd-board] .wd-square').getBoundingClientRect();
          const last=screen.querySelector('[data-wd-board] .wd-square:last-child').getBoundingClientRect();
          return {left:board.left,right:board.right,width:board.width,height:board.height,
            firstLeft:first.left,lastRight:last.right,viewport:document.documentElement.clientWidth,
            scrollWidth:document.documentElement.scrollWidth};
        });
        assert(Math.abs(bounds.left)<=1&&Math.abs(bounds.right-bounds.viewport)<=1&&
          Math.abs(bounds.width-bounds.height)<=1&&Math.abs(bounds.firstLeft)<=1&&
          Math.abs(bounds.lastRight-bounds.viewport)<=1&&bounds.scrollWidth<=bounds.viewport+1,
          'portrait playable board must be square and edge-to-edge without overflow: '+name+' '+JSON.stringify(bounds));
        console.log('Defender portrait full-bleed '+name+': '+JSON.stringify(bounds));
      }
      await weekly.screenshot({path:'test-results/weekly-defender-'+name+'.png'});
    }
    await weekly.setViewportSize({width:844,height:390});
    await weekly.evaluate(()=>window.scrollTo(0,0));
    await weekly.waitForTimeout(200);
    const colors=await defenderScreen.locator('[data-wd-grade-legend] .mentor-grade').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).color));
    assert.deepStrictEqual(colors,['rgb(145, 228, 140)','rgb(145, 228, 140)','rgb(243, 214, 110)','rgb(255, 129, 122)','rgb(255, 129, 122)'],'weekly legend uses one green/yellow/red palette');
    const skipAd=defenderScreen.locator('[data-wd-action="skip"]');
    const adNotice=defenderScreen.locator('[data-wd-ad-notice]');
    const pause=defenderScreen.locator('[data-wd-action="pause"]');
    await skipAd.click();
    await adNotice.waitFor({state:'visible'});
    assert.equal(await skipAd.isEnabled(),true,'standalone web unavailable ad does not unlock fast-forward');
    assert.equal(await pause.getAttribute('aria-label'),'Продолжить','unavailable ad preserves the prior pause');
    // Use the actual platform adapter and a simulated native VK ad callback,
    // installed AFTER the normal local run is initialized.
    await weekly.evaluate(()=>{
      globalThis.__weeklyAdCalls=[];
      globalThis.AndroidBridge={
        VKWebAppInit(){},
        VKWebAppShowNativeAds(serialized){
          const params=JSON.parse(serialized);
          globalThis.__weeklyAdCalls.push(params.ad_format);
          globalThis.__weeklyAdReply=(result)=>dispatchEvent(new CustomEvent('VKWebAppEvent',{
            detail:{type:'VKWebAppShowNativeAdsResult',data:{request_id:params.request_id,result}}
          }));
        }
      };
    });
    await skipAd.click();
    await weekly.waitForFunction(()=>globalThis.__weeklyAdCalls.length===1);
    assert.equal(await skipAd.isDisabled(),true,'rewarded request blocks repeated clicks');
    assert.equal(await skipAd.getAttribute('aria-busy'),'true');
    await weekly.evaluate(()=>globalThis.__weeklyAdReply(false));
    await weekly.waitForFunction(()=>document.querySelector('[data-weekly-battle-screen] [data-wd-action="skip"]').disabled===false);
    assert.equal(await pause.getAttribute('aria-label'),'Продолжить','negative ad result does not resume a paused battle');
    await skipAd.click();
    await weekly.waitForFunction(()=>globalThis.__weeklyAdCalls.length===2);
    await weekly.evaluate(()=>globalThis.__weeklyAdReply(true));
    await weekly.waitForFunction(()=>document.querySelector('[data-weekly-battle-screen] [data-wd-action="skip"]').getAttribute('aria-label')==='Ускоренное завершение боя');
    assert.equal(await skipAd.isDisabled(),true,'completed reward unlocks fast-forward exactly once');
    assert.equal(await pause.getAttribute('aria-label'),'Пауза','completed ad resumes the battle');
    assert.deepStrictEqual(await weekly.evaluate(()=>globalThis.__weeklyAdCalls),['reward','reward']);
    await weekly.close();
    assert.deepStrictEqual(weeklyErrors,[]);

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