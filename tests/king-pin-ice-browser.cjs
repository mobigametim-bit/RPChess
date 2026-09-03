const assert=require('assert');
const {chromium}=require('playwright');

const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const FEN='k3r3/n7/8/8/8/8/4R3/R3K3 w - - 0 1';

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error.stack||error)));
    await page.goto(url,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>Boolean(globalThis.RPChessClassicChess?.loadFen));
    await page.evaluate(fen=>globalThis.RPChessClassicChess.loadFen(fen,{mode:'local'}),FEN);
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    await page.waitForFunction(()=>document.querySelector('[data-square="e2"]')?.dataset.pinState==='partial'&&document.querySelector('[data-square="a7"]')?.dataset.pinState==='full');

    const state=await page.evaluate(()=>{
      const inspect=square=>{
        const cell=document.querySelector(`[data-square="${square}"]`),ice=cell?.querySelector('.classic-pin-ice');
        return {pin:cell?.dataset.pinState||'',src:ice?.getAttribute('src')||'',opacity:ice?getComputedStyle(ice).opacity:'',pointerEvents:ice?getComputedStyle(ice).pointerEvents:''};
      };
      return {white:inspect('e2'),black:inspect('a7')};
    });
    assert.deepStrictEqual(state.white,{pin:'partial',src:'assets/vfx/pin_ice_partial.png',opacity:'0.5',pointerEvents:'none'});
    assert.deepStrictEqual(state.black,{pin:'full',src:'assets/vfx/pin_ice_full.png',opacity:'0.5',pointerEvents:'none'});

    const dimensions=await page.evaluate(async()=>{
      const load=file=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({w:image.naturalWidth,h:image.naturalHeight});image.onerror=()=>reject(new Error(`failed to load ${image.src}`));image.src=`assets/vfx/${file}`;});
      return {full:await load('pin_ice_full.png'),partial:await load('pin_ice_partial.png')};
    });
    assert(Math.max(dimensions.full.w,dimensions.full.h)<=384,`full pin runtime asset exceeds 384px: ${JSON.stringify(dimensions.full)}`);
    assert(Math.max(dimensions.partial.w,dimensions.partial.h)<=384,`partial pin runtime asset exceeds 384px: ${JSON.stringify(dimensions.partial)}`);
    assert.deepStrictEqual(pageErrors,[]);
    console.log(`King pin ice browser: PASS — white partial + black full visible together at 50% opacity; runtime full=${dimensions.full.w}x${dimensions.full.h}, partial=${dimensions.partial.w}x${dimensions.partial.h}`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
