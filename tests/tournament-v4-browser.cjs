/* v4 real-browser viewport contract, with a mocked PvP transport.
 * Visual/UI test only: no server credentials, leaderboard writes, or bots. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const url=(process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173').replace(/\?[^#]*$/,'');
const dir=process.env.RPCHESS_TOURNAMENT_V4_SCREENSHOT_DIR||'test-results/tournament-v4';
const sizes=[
 ['phone-portrait',390,844],['phone-landscape',844,390],
 ['tablet-portrait',768,1024],['tablet-landscape',1024,768],
 ['desktop-portrait',900,1180],['desktop-landscape',1440,840]
];
const matchId='00000000-0000-4000-8000-000000000044';
const response={
 status:'playing',matchId,playerColor:'w',
 players:[
  {color:'w',name:'Йо',power:500,displayPower:553,race:'humans',commanderId:'pilgrim'},
  {color:'b',name:'Грегори',power:640,displayPower:681,race:'orcs',commanderId:'ash_regent'}
 ],
 moves:[],turn:'w',remaining:{w:600000,b:600000},rated:false,serverTime:Date.now()
};
async function main(){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  fs.mkdirSync(dir,{recursive:true});
  for(const [label,width,height] of sizes){
   const context=await browser.newContext({viewport:{width,height},hasTouch:width<1100,isMobile:width<=390});
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/v1/**',async route=>{
    const p=new URL(route.request().url()).pathname;
    if(route.request().method()==='OPTIONS'){
     await route.fulfill({status:204,headers:{
      'access-control-allow-origin':'*','access-control-allow-headers':'Authorization,Content-Type',
      'access-control-allow-methods':'GET,POST,OPTIONS'
     }});
     return;
    }
    let data={status:'waiting'};
    if(p==='/v1/session'){
     const identity=route.request().postDataJSON();
     assert.equal(identity.nick,'Йо','legacy Web/VK Tournament must send saved name');
     assert.equal(identity.commanderId,'pilgrim','legacy Web/VK Tournament must send saved king');
     data={token:'fake-test-only-session',kind:'guest',ranked:false,name:'Йо'};
    }
    else if(p==='/v1/profile')data={ranked:false,power:500,kind:'guest'};
    else if(p==='/v1/queue/join')data={status:'matched',matchId};
    else if(p.endsWith('/snapshot'))data=response;
    await route.fulfill({status:200,contentType:'application/json',headers:{
     'access-control-allow-origin':'*'
    },body:JSON.stringify(data)});
   });
   await page.goto(url+(url.includes('?')?'&':'?')+'rpchess_profile=0&rpchess_gamepush=0',
     {waitUntil:'domcontentloaded',timeout:45000});
   await page.locator('[data-game-loading]').waitFor({state:'hidden',timeout:30000});
   await page.evaluate(async()=>{
    const {createRun,writeRun}=await import('./js/run-persistence.mjs');
    writeRun(createRun({playerName:'Йо',commanderId:'pilgrim'}));
   });
   await page.locator('[data-tournament-open]').click();
   await page.locator('.tournament-profile-card').waitFor();
   const setup=await page.evaluate(()=>{
    const root=document.querySelector('[data-tournament-screen]');
    const p=root.querySelector('.tournament-profile-card');
    const portrait=p.querySelector('img').getBoundingClientRect();
    const names=[p.querySelector('.tournament-profile-name'),p.querySelector('.tournament-race-mark'),p.querySelector('.tournament-power-mark')];
    const row=names.map(el=>el.getBoundingClientRect());
    const btns=[...root.querySelectorAll('.tournament-setup-secondary [data-tour-action]')].map(n=>n.getBoundingClientRect().toJSON());
    return {height:root.clientHeight,scrollHeight:root.scrollHeight,
     portrait:portrait.toJSON(),row:row.map(x=>x.toJSON()),btns,
     text:root.innerText,
     modeCount:root.querySelectorAll('.tournament-mode-tile').length,
     powerIcon:root.querySelector('.tournament-power-mark img')?.getAttribute('src')};
   });
   assert.equal(setup.modeCount,1,label+' must have one mode tile');
   assert(setup.powerIcon.includes('royal_court/emblem.png'),label+' must reuse Chronicle power emblem');
   assert(setup.text.includes('Йо')&&setup.text.includes('Ваш отряд'),label+' player and squad');
   assert(!setup.text.includes('Не куплен')&&!setup.text.includes('Открыт'),label+' no noisy labels');
   await page.screenshot({path:path.join(dir,label+'-preparation.png'),animations:'disabled'});
   for(const box of setup.row)assert(Math.abs(box.y+box.height/2-(setup.portrait.y+setup.portrait.height/2))<18,
     label+' profile stats are vertically centered with portrait: '+JSON.stringify({portrait:setup.portrait,row:setup.row}));
   if(width>height){
    assert(setup.scrollHeight<=setup.height+4,label+' landscape preparation must not scroll as a page: '+JSON.stringify(setup));
    assert(setup.btns.every(b=>b.y>=0&&b.y+b.height<=height+2),
      label+' all three match buttons must fit screen');
   }
   await page.locator('[data-tour-action="search"]').click();
   await page.locator('[data-tour-board]').waitFor({state:'visible',timeout:15000});
   const view=await page.evaluate(()=>{
    const root=document.querySelector('[data-tournament-screen]');
    const board=root.querySelector('[data-tour-board]').getBoundingClientRect();
    const left=root.querySelector('.tournament-clock-panel--rival');
    const right=root.querySelector('.tournament-clock-panel--self');
    const l=left.getBoundingClientRect(),r=right.getBoundingClientRect();
    return {
     board:board.toJSON(),l:l.toJSON(),r:r.toJSON(),viewport:{w:innerWidth,h:innerHeight},
     leftPortrait:left.querySelector('.tournament-duel-portrait').getBoundingClientRect().width,
     rightPortrait:right.querySelector('.tournament-duel-portrait').getBoundingClientRect().width,
     firstName:left.querySelector('.tournament-player strong').textContent,
     secondName:right.querySelector('.tournament-player strong').textContent,
     leftPower:left.querySelector('.tournament-power-mark')?.textContent.trim(),
     rightPower:right.querySelector('.tournament-power-mark')?.textContent.trim(),
     portraits:[...root.querySelectorAll('.tournament-duel-portrait')].map(n=>n.getAttribute('src')),
     raceIcons:[...root.querySelectorAll('.tournament-clock-panel .tournament-race-mark img')].map(n=>n.getAttribute('src'))
    };
   });
   assert.equal(view.firstName,'Грегори');
   assert.equal(view.secondName,'Йо');
   assert.equal(view.leftPower,'681');
   assert.equal(view.rightPower,'553');
   assert(view.portraits.some(src=>src.includes('ash_regent'))&&view.portraits.some(src=>src.includes('pilgrim')));
   assert(view.raceIcons.some(src=>src.includes('/orcs/'))&&view.raceIcons.some(src=>src.includes('/humans/')));
   assert.equal(await page.locator('[data-tour-board] .classic-piece').count(),32);
   if(width>height){
    assert(Math.abs(view.board.height-Math.min(height,width-150))<=15,
      label+' full-height chessboard: '+JSON.stringify(view));
    assert(Math.abs(view.board.width-view.board.height)<5,label+' chessboard square');
    assert(view.l.width-view.leftPortrait<=30 && view.r.width-view.rightPortrait<=30,
      label+' compact portrait cards: '+JSON.stringify(view));
    assert(view.l.x+view.l.width<=view.board.x+2&&view.board.x+view.board.width<=view.r.x+2,
      label+' portrait cards flank, not cover, board');
   }
   await page.screenshot({path:path.join(dir,label+'-match.png'),animations:'disabled'});
   await page.locator('[data-tour-action="panel"]').click();
   await page.locator('#tournament-tools').waitFor({state:'visible'});
   assert.equal(await page.locator('[data-tour-action="offer-draw"]').count(),1);
   assert.equal(await page.locator('[data-tour-action="resign"]').count(),1);
   await page.keyboard.press('Escape');
   await page.locator('#tournament-tools').waitFor({state:'hidden'});
   assert.equal(errors.length,0,label+': JS errors '+errors.join(' | '));
   await context.close();
   console.log('TOURNAMENT V4 '+label+' PASS');
  }
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
