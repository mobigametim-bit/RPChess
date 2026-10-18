const assert=require('assert');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');

const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const RUN_KEY='rpchess.reboot.v1.run';
const WHITE_GLYPHS=new Set(['♙','♘','♗','♖','♕','♔']);
const BLACK_GLYPHS=new Set(['♟','♞','♝','♜','♛','♚']);

function route(type,playerColor,race){
  const enemyRoleRaces={pawn:race,knight:race,bishop:race,rook:race,queen:race,king:race};
  return{
    id:`side-colors.${type}.${playerColor}`,
    step:1,type,label:type==='battle'?'БИТВА':'СТЫЧКА',stars:6,threatLabel:'ОПАСНАЯ',
    flavor:'Проверка цветового языка боя.',mechanicalHint:'',seed:`side-colors-${type}-${playerColor}`,
    difficultyModel:'power-v1',playerColor,enemyColor:playerColor==='w'?'b':'w',enemyRaceTag:race,enemyRoleRaces,
    sideNarrative:playerColor==='b'?'Враг начинает первым.':'Ваш отряд начинает первым.'
  };
}
async function fresh(page,type,playerColor,race){
  await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate((key)=>localStorage.removeItem(key),RUN_KEY);
  await page.reload({waitUntil:'networkidle'});
  await startNewRun(page);
  const routes=[route(type,playerColor,race),route(type,playerColor,race),route(type,playerColor,race)];
  await page.evaluate(({key,routes,type,playerColor})=>{
    const run=JSON.parse(localStorage.getItem(key));
    run.id=`side-colors-browser-${type}-${playerColor}`;
    run.currentTravelChoices=routes;run.activeTravelChoice=null;
    localStorage.setItem(key,JSON.stringify(run));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  },{key:RUN_KEY,routes,type,playerColor});
  await page.locator('[data-roster-travel]').click();
  await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
  await page.locator(`[data-travel-type="${type}"]`).first().click();
  await page.locator('[data-artifact-choice-modal]').waitFor();
  assert.strictEqual(await page.locator(`[data-${type}-screen]`).isHidden(),true,'combat preparation is skipped');
  await page.waitForTimeout(60);
}
async function prepState(page,type){
  return page.evaluate((type)=>{
    const cardSelector=type==='battle'?'.battle-card__tech-glyph':'.skirmish-card__tech-glyph';
    const formationSelector=type==='battle'?'.battle-formation-cell span[data-piece-color]':'.skirmish-formation-cell[data-piece-color]';
    return{
      cards:[...document.querySelectorAll(cardSelector)].map((node)=>({glyph:node.textContent||'',side:node.dataset.pieceColor||'',color:getComputedStyle(node).color})),
      formation:[...document.querySelectorAll(formationSelector)].map((node)=>({glyph:node.textContent||'',side:node.dataset.pieceColor||'',color:getComputedStyle(node).color}))
    };
  },type);
}
async function combatAuraState(page){
  return page.evaluate(()=>{
    const cells=[...document.querySelectorAll('.classic-square')];
    const chosen=(side)=>{
      const color=side==='white'?'w':'b';
      return cells.find(square=>{
        const art=square.querySelector('.classic-piece')?.getAttribute('src')||'';
        return art.includes(`/pieces/board/${side}/`)||art.includes(`/pieces/${side}.webp`);
      })||document.querySelector(`.classic-square:has(.classic-piece-marker--${color})`);
    };
    const white=chosen('white'),black=chosen('black');
    const state=(node)=>node?{
      side:getComputedStyle(node).getPropertyValue('--combat-piece-glow-side').trim(),
      image:getComputedStyle(node,'::after').backgroundImage||'',
      art:node.querySelector('.classic-piece')?.getAttribute('src')||'',
      glyphDisplay:node.querySelector('.classic-piece-marker')?getComputedStyle(node.querySelector('.classic-piece-marker')).display:'none'
    }:{side:'',image:''};
    return{
      active:document.body.classList.contains('run-combat-board-active'),
      white:state(white),black:state(black)
    };
  });
}
async function redCheckAuraState(page){
  return page.evaluate(()=>{
    const square=document.querySelector('[data-chess-board] .classic-square:has(.classic-piece--new-race)')||document.querySelector('[data-chess-board] .classic-square:has(.classic-piece-marker--w),[data-chess-board] .classic-square:has(.classic-piece-marker--b)');
    if(!square)return{side:'',image:''};
    square.classList.add('classic-square--check');
    const result={
      side:getComputedStyle(square).getPropertyValue('--combat-piece-glow-side').trim(),
      image:getComputedStyle(square,'::after').backgroundImage||''
    };
    square.classList.remove('classic-square--check');
    return result;
  });
}
async function auraAssetResponses(page){
  return page.evaluate(async()=>{
    const files=['aura_white.png','aura_black.png','aura_red.png'];
    return Promise.all(files.map(async(file)=>{
      const response=await fetch(`assets/vfx/${file}`,{cache:'no-store'});
      const bytes=(await response.arrayBuffer()).byteLength;
      return{file,ok:response.ok,status:response.status,type:response.headers.get('content-type')||'',bytes};
    }));
  });
}
function assertPrep(state,side){
  const glyphs=side==='b'?BLACK_GLYPHS:WHITE_GLYPHS;
  const expectedColor=side==='b'?'rgb(8, 9, 11)':'rgb(247, 247, 245)';
  assert(state.cards.length>=6,'hero cards must expose technical glyphs');
  assert(state.formation.length>0,'formation preview must expose technical glyphs');
  for(const item of [...state.cards,...state.formation]){
    assert.strictEqual(item.side,side);
    assert(glyphs.has(item.glyph),`unexpected ${side} glyph: ${item.glyph}`);
    assert.strictEqual(item.color,expectedColor);
  }
}
function assertAuras(state){
  assert.strictEqual(state.active,true,'combat board must activate overlay rules');
  for(const side of ['white','black']){
    const entry=state[side];
    const dedicated=entry.art.includes('/pieces/board/')||/\/kings\/[^/]+\/pieces\/(?:white|black)\.webp$/.test(entry.art)||/\/heroes\/[^/]+\/pieces\/(?:white|black)\/(?:pawn|queen|rook|bishop|knight)\.webp$/.test(entry.art);
    if(dedicated){
      assert(!entry.image.includes('aura_'),`${side} newly illustrated chess piece must not use decorative auras`);
      assert.strictEqual(entry.glyphDisplay,'none',`${side} readable chess piece must hide its role glyph`);
    }else{
      assert.strictEqual(entry.side,side);
      assert(entry.image.includes(`aura_${side}.png`),`${side} old named hero must retain aura until replaced`);
      assert.notStrictEqual(entry.glyphDisplay,'none',`${side} old named hero must retain glyph until replaced`);
    }
  }
}
async function assertNamedHeroBoardArt(page,playerColor){
  const named=await page.evaluate(()=>{
    return [...document.querySelectorAll('[data-chess-board] .classic-piece--personalized')].map(img=>{
      const square=img.closest('.classic-square');
      const marker=square?.querySelector('.classic-piece-marker');
      return {
        id:img.dataset.personalizedId,
        source:img.getAttribute('src')||'',
        incorrectlyGeneric:img.classList.contains('classic-piece--new-race'),
        markerVisible:!!marker&&getComputedStyle(marker).display!=='none',
        aura:getComputedStyle(square,'::after').backgroundImage,
        state:getComputedStyle(square).getPropertyValue('--combat-piece-glow-side').trim(),
        check:square?.classList.contains('classic-square--check'),
        arriving:!!square?.querySelector('.classic-piece--arriving'),
        maskedByRaceSprite:!!square?.querySelector('.classic-piece--new-race')
      };
    });
  });
  assert(named.some(hero=>hero.id==='king.oathkeeper'&&hero.source.includes(`/kings/oathkeeper/pieces/${playerColor==='w'?'white':'black'}.webp`)),
    'Run King must use the selected commander sprite matching his white/black side');
  assert(named.some(hero=>hero.id?.startsWith('hero.')&&hero.source.includes('/heroes/')&&hero.source.endsWith('/piece_badge.png')),
    'named companions must use their existing personal piece_badge.png');
  for(const hero of named){
    if(hero.id==='king.oathkeeper'||/\/heroes\/[^/]+\/pieces\/(?:white|black)\//.test(hero.source)){
      assert(hero.incorrectlyGeneric,`${hero.id}: newly illustrated chess sprites must suppress old glyph and side glow`);
      assert(!hero.markerVisible,`${hero.id}: updated chess sprites must not display a legacy role glyph`);
      assert(!hero.aura.includes('aura_white')&&!hero.aura.includes('aura_black'),
        `${hero.id}: no routine side aura is allowed behind updated pieces`);
      if(hero.check)assert(hero.aura.includes('aura_red'),`${hero.id}: red check feedback must remain`);
      continue;
    }
    assert.strictEqual(hero.incorrectlyGeneric,false,`${hero.id}: legacy named hero artwork stays separate from new chess art`);
    assert(hero.markerVisible,`${hero.id}: legacy glyph remains until that hero is replaced`);
    const expectedSide=hero.check?'red':(playerColor==='w'?'white':'black');
    assert(hero.aura.includes(`aura_${expectedSide}.png`),
      `${hero.id}: legacy hero keeps ${expectedSide} aura; got ${JSON.stringify(hero)}`);
  }
}
function assertRedCheckAura(state){
  assert(!state.side||state.side==='red','check must never retain white/black glow state');
  assert(state.image.includes('aura_red.png'),'check must use aura_red.png');
}
function assertAuraAssets(responses){
  assert.strictEqual(responses.length,3);
  for(const item of responses){
    assert.strictEqual(item.ok,true,`${item.file} must load from production dist`);
    assert.strictEqual(item.status,200,`${item.file} must return HTTP 200`);
    assert(item.type.includes('image/png'),`${item.file} must be served as PNG`);
    assert(item.bytes>0,`${item.file} runtime asset must not be empty`);
  }
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const battle=await browser.newPage({viewport:{width:1440,height:900}}),battleErrors=[];
    battle.on('pageerror',(error)=>battleErrors.push(String(error.stack||error)));
    await fresh(battle,'battle','b','constructs');
    assert((await battle.evaluate(()=>globalThis.RPChessBattle.selectedIds)).includes('king.oathkeeper'),'automatic black-side Battle team includes king');
    await battle.locator('[data-artifact-choice="none"]').click();
    await battle.locator('[data-classic-screen]:not([hidden])').waitFor();
    await battle.waitForTimeout(60);
    assertAuras(await combatAuraState(battle));
    await assertNamedHeroBoardArt(battle,'b');
    assertRedCheckAura(await redCheckAuraState(battle));
    assertAuraAssets(await auraAssetResponses(battle));
    await battle.evaluate(()=>globalThis.RPChessBattle.finishBattle({over:true,type:'stalemate',winner:null}));
    await battle.locator('[data-battle-aftermath]:not([hidden])').waitFor();
    await battle.waitForTimeout(30);
    assert.strictEqual(await battle.evaluate(()=>document.body.classList.contains('run-combat-board-active')),false,'combat aura state must clear after Battle');
    assert.deepStrictEqual(battleErrors,[]);

    const skirmish=await browser.newPage({viewport:{width:1440,height:900}}),skirmishErrors=[];
    skirmish.on('pageerror',(error)=>skirmishErrors.push(String(error.stack||error)));
    await fresh(skirmish,'skirmish','w','demons');
    assert((await skirmish.evaluate(()=>globalThis.RPChessSkirmish.selectedIds)).includes('king.oathkeeper'),'automatic white-side Skirmish includes king');
    await skirmish.locator('[data-artifact-choice="none"]').click();
    await skirmish.locator('[data-classic-screen]:not([hidden])').waitFor();
    await skirmish.waitForTimeout(60);
    assertAuras(await combatAuraState(skirmish));
    await assertNamedHeroBoardArt(skirmish,'w');
    assert.deepStrictEqual(skirmishErrors,[]);

    console.log('Combat side colors: PASS — updated kings and race sprites omit glyphs/auras; unreplaced heroes retain legacy visuals');
  }finally{await browser.close();}
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1;});
