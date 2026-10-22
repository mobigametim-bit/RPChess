/* A real browser on both sides of an actual Cloudflare chess match, without mocks. */
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {chromium}=require('playwright');
const url=process.env.RPCHESS_ACCEPTANCE_URL;
assert(url?.startsWith('https://'),'Use deployed HTTPS acceptance URL');
const dir=process.env.RPCHESS_TOURNAMENT_SCREENSHOT_DIR||'test-results/tournament';
async function main(){
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];
async function client(width,height){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'networkidle',timeout:45000});
 await page.locator('[data-game-loading]').waitFor({state:'hidden',timeout:30000});
 await page.locator('[data-tournament-open]').click();
 await page.locator('[data-tournament-screen]:not([hidden])').waitFor();
 assert(await page.evaluate(()=>globalThis.RPChessTournament?.apiConfigured),'PvP staging API is configured');
 return {context,page};
}
let first,second;
try {
 first=await client(390,844);
 second=await client(768,1024);
 await first.page.locator('[data-tour-action="invite"]').click();
 await first.page.locator('.tournament-room-code').waitFor({state:'visible',timeout:15000});
 const code=(await first.page.locator('.tournament-room-code').innerText()).trim();
 assert(/^[A-Z0-9]{6}$/.test(code),'Real room code generated');
 await second.page.locator('[data-tour-action="join-screen"]').click();
 await second.page.locator('[data-tour-code]').fill(code);
 await second.page.locator('[data-tour-action="join-submit"]').click();
 await Promise.all([first.page.locator('[data-tour-board]').waitFor({timeout:20000}),second.page.locator('[data-tour-board]').waitFor({timeout:20000})]);
 const colorA=await first.page.locator('[data-tour-board]').getAttribute('data-player-color');
 const colorB=await second.page.locator('[data-tour-board]').getAttribute('data-player-color');
 assert(['w','b'].includes(colorA)&&colorB!==colorA,'Two humans must have opposite colors');
 const white=colorA==='w'?first.page:second.page;
 const black=colorB==='b'?second.page:first.page;
 async function move(page,from,to){
  const origin=page.locator('[data-tour-board] [data-square="'+from+'"]');
  const destination=page.locator('[data-tour-board] [data-square="'+to+'"]');
  await origin.click(); await destination.click();
 }
 await move(white,'e2','e4');
 await black.waitForFunction(()=>!!document.querySelector('[data-tour-board] [data-square="e4"] .classic-piece'),null,{timeout:16000});
 await move(black,'e7','e5');
 await white.waitForFunction(()=>!!document.querySelector('[data-tour-board] [data-square="e5"] .classic-piece'),null,{timeout:16000});
 assert.equal(await white.locator('[data-tour-board] .classic-piece').count(),32,'No vanished pieces');
 fs.mkdirSync(dir,{recursive:true});
 await first.page.screenshot({path:path.join(dir,'phone-390x844-live-pvp.png'),fullPage:true});
 await second.page.screenshot({path:path.join(dir,'tablet-768x1024-live-pvp.png'),fullPage:true});
 await white.locator('[data-tour-action="resign"]').click();
 await Promise.all([first.page.locator('.tournament-center h2').waitFor({timeout:16000}),second.page.locator('.tournament-center h2').waitFor({timeout:16000})]);
 assert.equal(errors.length,0,'No browser page errors: '+errors.join('|'));
 console.log('TOURNAMENT TWO-BROWSER UI PASS: 390x844 + 768x1024, invited real pair, 10+0 board, white/black moves and resign');
}catch(error){console.error('TOURNAMENT TWO-BROWSER UI FAILURE',error.message,'pageErrors:',errors);throw error;}
finally {await Promise.all([first?.context?.close(),second?.context?.close()]);await browser.close();}

}
main().catch(error=>{console.error(error);process.exitCode=1;});
