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
  await page.locator(`[data-${type}-screen]:not([hidden])`).waitFor();
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
    const white=document.querySelector('.classic-square:has(.classic-piece-marker--w)');
    const black=document.querySelector('.classic-square:has(.classic-piece-marker--b)');
    const state=(node)=>node?{
      side:getComputedStyle(node).getPropertyValue('--combat-piece-glow-side').trim(),
      image:getComputedStyle(node,'::after').backgroundImage||''
    }:{side:'',image:''};
    return{
      active:document.body.classList.contains('run-combat-board-active'),
      white:state(white),black:state(black)
    };
  });
}
async function redCheckAuraState(page){
  return page.evaluate(()=>{
    const square=document.querySelector('.classic-square:has(.classic-piece-marker--w),.classic-square:has(.classic-piece-marker--b)');
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
  assert.strictEqual(state.active,true,'run combat board must enable persistent side aura');
  assert.strictEqual(state.white.side,'white');
  assert.strictEqual(state.black.side,'black');
  assert(state.white.image.includes('aura_white.png'),'white side must use aura_white.png');
  assert(state.black.image.includes('aura_black.png'),'black side must use aura_black.png');
  assert.notStrictEqual(state.white.image,state.black.image,'white and black aura art must differ');
}
function assertRedCheckAura(state){
  assert.strictEqual(state.side,'red','check must override side aura state');
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
    assertPrep(await prepState(battle,'battle'),'b');
    await battle.locator('[data-battle-start]').click();
    await battle.locator('[data-classic-screen]:not([hidden])').waitFor();
    await battle.waitForTimeout(60);
    assertAuras(await combatAuraState(battle));
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
    assertPrep(await prepState(skirmish,'skirmish'),'w');
    await skirmish.locator('[data-skirmish-start]').click();
    await skirmish.locator('[data-classic-screen]:not([hidden])').waitFor();
    await skirmish.waitForTimeout(60);
    assertAuras(await combatAuraState(skirmish));
    assert.deepStrictEqual(skirmishErrors,[]);

    console.log('Combat side colors: PASS — prep glyphs match combat side; aura_white/aura_black persist under pieces; aura_red overrides check; aura PNGs load from runtime dist');
  }finally{await browser.close();}
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1;});
