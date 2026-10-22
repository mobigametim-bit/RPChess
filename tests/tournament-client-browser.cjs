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
let first,second,desktop;
try {
 // Test real desktop setup at the reporter's 1792×852 size, plus a shorter
 // landscape window. Buttons may use an internal scroll on small displays,
 // but must NEVER be clipped behind an unscrollable viewport.
 desktop=await client(1792,852);
 // Wait for the game splash's opacity fade: DOM visibility alone is not enough
 // for visual acceptance screenshots immediately after entering Tournament.
 await desktop.page.waitForTimeout(1600);
 fs.mkdirSync(dir,{recursive:true});
 const checkSetup=async ({requireNoScroll=false}={})=>{
  return desktop.page.evaluate(requireNoScroll=>{
   const panel=document.querySelector('[data-tournament-screen]');
   const controls=['search','invite','join-screen'].map(action=>{
    const button=panel.querySelector('[data-tour-action="'+action+'"]');
    const b=button.getBoundingClientRect();
    return {action,top:b.top,bottom:b.bottom,width:b.width,visible:getComputedStyle(button).display!=='none'};
   });
   return {height:innerHeight,overflow:getComputedStyle(panel).overflowY,
     scrollable:panel.scrollHeight>panel.clientHeight+2,
     allInViewport:controls.every(b=>b.visible&&b.top>=0&&b.bottom<=innerHeight),
     controls};
  },requireNoScroll);
 };
 let prep=await checkSetup({requireNoScroll:true});
 assert(prep.allInViewport,'Desktop 1792×852 buttons must fit at once: '+JSON.stringify(prep));
 await desktop.page.screenshot({path:path.join(dir,'desktop-1792x852-preparation.png')});
 await desktop.page.setViewportSize({width:1024,height:640});
 prep=await checkSetup();
 assert(prep.scrollable||prep.allInViewport,'Short desktop Tournament content must be scrollable: '+JSON.stringify(prep));
 await desktop.page.locator('[data-tour-action="invite"]').scrollIntoViewIfNeeded();
 const inviteBox=await desktop.page.locator('[data-tour-action="invite"]').boundingBox();
 assert(inviteBox&&inviteBox.y>=0&&inviteBox.y+inviteBox.height<=640,
   'Invite button must be reachable on compact desktop');
 await desktop.page.screenshot({path:path.join(dir,'desktop-1024x640-preparation.png')});
 await desktop.context.close();desktop=null;

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
 // Test the same *live* online match at both conventional desktop sizes.
 // The board, both chess clocks and the draw/resign/leave controls must fit
 // without scrolling at these viewport heights.
 for(const [screen,width,height,label] of [
  [first.page,1792,852,'desktop-1792x852-live-pvp.png'],
  [second.page,1366,768,'desktop-1366x768-live-pvp.png']
 ]){
  await screen.setViewportSize({width,height});
  await screen.waitForTimeout(180);
  const layout=await screen.evaluate(()=>{
   const el=(s)=>document.querySelector(s)?.getBoundingClientRect();
   const board=el('[data-tour-board]');
   const bars=[...document.querySelectorAll('.tournament-playerbar')].map(n=>n.getBoundingClientRect());
   const buttons=['offer-draw','resign','back'].map(a=>el('[data-tour-action="'+a+'"]'));
   return {width:innerWidth,height:innerHeight,board:board&&{left:board.left,right:board.right,top:board.top,bottom:board.bottom,width:board.width},
    bars:bars.map(b=>({top:b.top,bottom:b.bottom})),
    buttons:buttons.map(b=>b&&({top:b.top,bottom:b.bottom})),
    panelScroll:getComputedStyle(document.querySelector('[data-tournament-screen]')).overflowY};
  });
  assert(layout.board&&layout.board.width>320&&layout.board.top>=0&&layout.board.bottom<=height,
   'Desktop chess board must fit: '+JSON.stringify(layout));
  assert(layout.bars.length===2&&layout.bars.every(b=>b.top>=0&&b.bottom<=height),
   'Both player clocks must fit on desktop: '+JSON.stringify(layout));
  assert(layout.buttons.every(b=>b&&b.top>=0&&b.bottom<=height),
   'All match actions must fit on desktop: '+JSON.stringify(layout));
  await screen.screenshot({path:path.join(dir,label)});
 }
 await white.locator('[data-tour-action="resign"]').click();
 await Promise.all([first.page.locator('.tournament-center h2').waitFor({timeout:16000}),second.page.locator('.tournament-center h2').waitFor({timeout:16000})]);
 assert.equal(errors.length,0,'No browser page errors: '+errors.join('|'));
 console.log('TOURNAMENT TWO-BROWSER UI PASS: 390x844 + 768x1024, invited real pair, 10+0 board, white/black moves and resign');
}catch(error){console.error('TOURNAMENT TWO-BROWSER UI FAILURE',error.message,'pageErrors:',errors);throw error;}
finally {await Promise.all([first?.context?.close(),second?.context?.close(),desktop?.context?.close()]);await browser.close();}

}
main().catch(error=>{console.error(error);process.exitCode=1;});
