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
 // Shared board theme must ALWAYS be determined by the white-side race,
 // not the local player's race. The same texture is shown to both players.
 const initialBoardRaces=await Promise.all([first.page,second.page].map(page=>
  page.locator('[data-tour-board]').getAttribute('data-board-race')));
 assert.deepEqual(initialBoardRaces,['humans','humans'],
  'Both clients must use the white squad board tiles');
 for(const page of [first.page,second.page]){
  const art=await page.locator('[data-tour-board]').evaluate(board=>({
    light:board.style.getPropertyValue('--board-light-tile'),
    dark:board.style.getPropertyValue('--board-dark-tile')
  }));
  assert(art.light.includes('races/humans/board/white.png')&&art.dark.includes('races/humans/board/black.png'),
   'Tournament board must use real race tile PNG assets: '+JSON.stringify(art));
 }
 const white=colorA==='w'?first.page:second.page;
 const black=colorB==='b'?second.page:first.page;
 async function moveByClicks(page,from,to){
  const origin=page.locator('[data-tour-board] [data-square="'+from+'"]');
  const destination=page.locator('[data-tour-board] [data-square="'+to+'"]');
  await origin.click();await destination.click();
 }
 async function dragMouse(page,from,to){
  const origin=await page.locator('[data-tour-board] [data-square="'+from+'"]').boundingBox();
  const dest=await page.locator('[data-tour-board] [data-square="'+to+'"]').boundingBox();
  assert(origin&&dest,'Mouse drag requires square positions');
  const sx=origin.x+origin.width/2,sy=origin.y+origin.height/2;
  const dx=dest.x+dest.width/2,dy=dest.y+dest.height/2;
  await page.mouse.move(sx,sy);
  await page.mouse.down();
  await page.mouse.move((sx+dx)/2,(sy+dy)/2,{steps:6});
  const ghost=page.locator('.rpchess-piece-drag-ghost');
  await ghost.waitFor({state:'visible',timeout:5000});
  const ghostState=await ghost.evaluate(img=>({
    src:img.currentSrc,rect:img.getBoundingClientRect().toJSON(),
    opacity:getComputedStyle(img).opacity,
    display:getComputedStyle(img).display
  }));
  assert(ghostState.src.includes('pawn')&&ghostState.rect.width>10&&ghostState.opacity!=='0',
    'Mouse drag must SHOW piece following cursor: '+JSON.stringify(ghostState));
  await page.mouse.move(dx,dy,{steps:8});
  await page.mouse.up();
  await ghost.waitFor({state:'detached',timeout:5000});
 }
 async function dragTouch(page,from,to){
  const origin=await page.locator('[data-tour-board] [data-square="'+from+'"]').boundingBox();
  const dest=await page.locator('[data-tour-board] [data-square="'+to+'"]').boundingBox();
  assert(origin&&dest,'Touch drag requires square positions');
  const sx=origin.x+origin.width/2,sy=origin.y+origin.height/2;
  const dx=dest.x+dest.width/2,dy=dest.y+dest.height/2;
  const cdp=await page.context().newCDPSession(page);
  const event=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{
   type,touchPoints:type==='touchEnd'?[]:[{x,y,id:11,radiusX:6,radiusY:6,force:.8}]
  });
  try{
   await event('touchStart',sx,sy);
   for(let i=1;i<=7;i++)await event('touchMove',sx+(dx-sx)*i/14,sy+(dy-sy)*i/14);
   const ghost=page.locator('.rpchess-piece-drag-ghost');
   await ghost.waitFor({state:'visible',timeout:5000});
   const state=await ghost.evaluate(img=>({
    src:img.currentSrc,width:img.getBoundingClientRect().width,
    top:img.getBoundingClientRect().top,
    opacity:getComputedStyle(img).opacity
   }));
   assert(state.src.includes('pawn')&&state.width>10&&state.opacity!=='0',
    'Finger drag must SHOW carried figure: '+JSON.stringify(state));
   for(let i=8;i<=14;i++)await event('touchMove',sx+(dx-sx)*i/14,sy+(dy-sy)*i/14);
   await event('touchEnd',dx,dy);
   await ghost.waitFor({state:'detached',timeout:5000});
  }finally{await cdp.detach();}
 }
 // Mouse and touch dragging are the primary Tourney controls. The original
 // tap-source/tap-destination path remains available as an alternative.
 await dragMouse(white,'e2','e4');
 await black.waitForFunction(()=>!!document.querySelector('[data-tour-board] [data-square="e4"] .classic-piece'),null,{timeout:16000});
 await dragTouch(black,'e7','e5');
 await white.waitForFunction(()=>!!document.querySelector('[data-tour-board] [data-square="e5"] .classic-piece'),null,{timeout:16000});
 await moveByClicks(white,'g1','f3');
 await black.waitForFunction(()=>!!document.querySelector('[data-tour-board] [data-square="f3"] .classic-piece'),null,{timeout:16000});
 assert.equal(await white.locator('[data-tour-board] .classic-piece').count(),32,'No vanished pieces');
 fs.mkdirSync(dir,{recursive:true});
 await first.page.screenshot({path:path.join(dir,'phone-390x844-live-pvp.png'),fullPage:true});
 await second.page.screenshot({path:path.join(dir,'tablet-768x1024-live-pvp.png'),fullPage:true});
 // Test the same *live* online match at both conventional desktop sizes.
 // The board, both chess clocks and the draw/resign/leave controls must fit
 // without scrolling at these viewport heights.
 for(const [screen,width,height,label] of [
  [first.page,1898,786,'desktop-1898x786-live-pvp.png'],
  [second.page,1366,768,'desktop-1366x768-live-pvp.png'],
  [first.page,1024,640,'desktop-1024x640-live-pvp.png'],
  [second.page,900,500,'desktop-900x500-live-pvp.png']
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
    leftRail:el('.tournament-battle-rail')&&{left:el('.tournament-battle-rail').left,right:el('.tournament-battle-rail').right,top:el('.tournament-battle-rail').top,bottom:el('.tournament-battle-rail').bottom},
    journal:el('[data-tour-history]')&&{top:el('[data-tour-history]').top,bottom:el('[data-tour-history]').bottom},
    nav:[...document.querySelectorAll('.tournament-battle-nav button')].map(n=>({top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom})),
    panelScroll:getComputedStyle(document.querySelector('[data-tournament-screen]')).overflowY,
    scrollHeight:document.querySelector('[data-tournament-screen]').scrollHeight,
    clientHeight:document.querySelector('[data-tournament-screen]').clientHeight,
    boardRace:document.querySelector('[data-tour-board]').dataset.boardRace};
  });
  assert(layout.board&&layout.board.width>320&&layout.board.top>=0&&layout.board.bottom<=height,
   'Desktop chess board must fit: '+JSON.stringify(layout));
  assert(layout.bars.length===2&&layout.bars.every(b=>b.top>=0&&b.bottom<=height),
   'Both player clocks must fit on desktop: '+JSON.stringify(layout));
  assert(layout.buttons.every(b=>b&&b.top>=0&&b.bottom<=height),
   'All match actions must fit on desktop: '+JSON.stringify(layout));
  assert(layout.nav.length===2&&layout.nav.every(b=>b.top>=0&&b.bottom<=height),
   'Settings and Main Menu must fit: '+JSON.stringify(layout));
  assert(layout.journal&&layout.journal.top>=0&&layout.journal.bottom<=height,
   'Move journal must remain in viewport: '+JSON.stringify(layout));
  assert(layout.leftRail&&layout.leftRail.right<layout.board.left-3,
   'Left-side panels must remain LEFT of the centered board: '+JSON.stringify(layout));
  assert(Math.abs((layout.board.left+layout.board.right)/2-width/2)<=2.5 &&
          Math.abs((layout.board.top+layout.board.bottom)/2-height/2)<=2.5,
   'Board must be centered within WHOLE viewport, not remaining space: '+JSON.stringify(layout));
  assert(layout.scrollHeight<=layout.clientHeight+2&&layout.panelScroll==='hidden',
   'Landscape match must NOT require scrolling: '+JSON.stringify(layout));
  await screen.screenshot({path:path.join(dir,label)});
 }
 await white.locator('[data-tour-action="resign"]').click();
 await Promise.all([first.page.locator('.tournament-center h2').waitFor({timeout:16000}),second.page.locator('.tournament-center h2').waitFor({timeout:16000})]);
 // Regression for real user's bug: the completed game's 2.4-second poll must
 // NOT resurrect Victory / timeout after starting a new opponent search.
 await white.locator('[data-tour-action="again"]').click();
 await white.waitForTimeout(6100);
 const state=await white.evaluate(()=>({
  page:globalThis.RPChessTournament?.page,
  resultVisible:!!document.querySelector('[data-tournament-screen] .tournament-center h2') &&
    /Победа|Victory|Поражение|Defeat|Ничья|Draw/.test(document.querySelector('[data-tournament-screen] .tournament-center h2')?.textContent||'')
 }));
 assert(!state.resultVisible&&state.page==='search','New matchmaking must not reopen old match result: '+JSON.stringify(state));
 await white.locator('[data-tour-action="cancel"]').click();
 assert.equal(errors.length,0,'No browser page errors: '+errors.join('|'));
 console.log('TOURNAMENT TWO-BROWSER UI PASS: real mouse drag and touch drag with visible ghost, click-to-move, two players and resign');
}catch(error){console.error('TOURNAMENT TWO-BROWSER UI FAILURE',error.message,'pageErrors:',errors);throw error;}
finally {await Promise.all([first?.context?.close(),second?.context?.close(),desktop?.context?.close()]);await browser.close();}

}
main().catch(error=>{console.error(error);process.exitCode=1;});
