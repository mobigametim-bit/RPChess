const assert=require('assert');
const {chromium}=require('playwright');

const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',(error)=>errors.push(String(error.stack||error)));
    await page.goto(url,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>Boolean(globalThis.RPChessClassicChess));
    await page.evaluate(()=>{
      globalThis.RPChessClassicChess.newGame(null,{mode:'local'});
      document.body.classList.add('run-combat-board-active');
    });
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    await page.waitForTimeout(60);

    const before=await page.evaluate(()=>{
      const square=document.querySelector('[data-square="e2"]');
      return getComputedStyle(square,'::after').backgroundImage||'';
    });
    assert(before.includes('aura_white.png'),'source piece must begin with the white aura');

    const moved=await page.evaluate(()=>globalThis.RPChessClassicChess.move('e2','e4'));
    assert.strictEqual(moved.ok,true,'e2-e4 must start the smooth move');

    const during=await page.evaluate(()=>{
      const square=document.querySelector('[data-square="e4"]');
      const image=square?.querySelector('.classic-piece');
      return{
        animating:globalThis.RPChessChessAI?.snapshot?.().animating===true,
        arriving:Boolean(image?.classList.contains('classic-piece--arriving')),
        pieceVisibility:image?getComputedStyle(image).visibility:'',
        auraOpacity:square?getComputedStyle(square,'::after').opacity:'',
        auraImage:square?getComputedStyle(square,'::after').backgroundImage:'',
        flyer:Boolean(document.querySelector('.classic-piece-flyer'))
      };
    });
    assert.strictEqual(during.animating,true,'visual move animation must be active');
    assert.strictEqual(during.arriving,true,'destination piece must remain in arriving state during flyer animation');
    assert.strictEqual(during.pieceVisibility,'hidden','authoritative destination piece must stay hidden until landing');
    assert.strictEqual(during.flyer,true,'piece flyer must be visible during movement');
    assert(during.auraImage.includes('aura_white.png'),'destination keeps the correct aura identity while hidden');
    assert.strictEqual(during.auraOpacity,'0','destination aura must stay invisible while the piece flyer is moving');

    await page.waitForTimeout(320);
    const after=await page.evaluate(()=>{
      const square=document.querySelector('[data-square="e4"]');
      const image=square?.querySelector('.classic-piece');
      return{
        animating:globalThis.RPChessChessAI?.snapshot?.().animating===true,
        arriving:Boolean(image?.classList.contains('classic-piece--arriving')),
        pieceVisibility:image?getComputedStyle(image).visibility:'',
        auraOpacity:square?getComputedStyle(square,'::after').opacity:'',
        auraImage:square?getComputedStyle(square,'::after').backgroundImage:'',
        flyer:Boolean(document.querySelector('.classic-piece-flyer'))
      };
    });
    assert.strictEqual(after.animating,false,'visual move animation must finish');
    assert.strictEqual(after.arriving,false,'destination piece arriving state must clear on landing');
    assert.notStrictEqual(after.pieceVisibility,'hidden','destination piece must become visible on landing');
    assert.strictEqual(after.flyer,false,'piece flyer must be removed on landing');
    assert(after.auraImage.includes('aura_white.png'),'landed piece must retain the white aura');
    assert.strictEqual(after.auraOpacity,'1','destination aura must become visible in the same landed frame');
    assert.deepStrictEqual(errors,[]);

    console.log('Combat aura move sync: PASS — destination aura stays hidden for the 230ms flyer and appears with the landed piece');
  }finally{await browser.close();}
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1;});
